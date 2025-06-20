import { OTLPLazy } from '../lazy/otlp-lazy.js';

/**
 * Опции для декоратора lazyTrace
 */
export interface LazyTraceOptions {
  attributes?: Record<string, string | number | boolean>;
  includeArgs?: boolean;
  includeResult?: boolean;
}

/**
 * Интерфейс для объектов с поддержкой ленивого трейсинга
 */
export interface LazyTraceContext {
  _lazyTracer?: OTLPLazy;
  shouldTrace?(): boolean;
}

/**
 * Декоратор для ленивого трейсинга методов
 * @param spanName - Имя span'а
 * @param options - Опции трейсинга
 */
export function lazyTrace(spanName: string, options: LazyTraceOptions = {}) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    if (typeof originalMethod !== 'function') {
      throw new Error(`@lazyTrace can only be applied to methods`);
    }
    
    descriptor.value = async function (this: LazyTraceContext, ...args: any[]) {
      // Ленивая инициализация трейсера
      if (!this._lazyTracer && (typeof this.shouldTrace !== 'function' || this.shouldTrace() !== false)) {
        try {
          this._lazyTracer = new OTLPLazy();
        } catch (error) {
          // Если не удалось создать трейсер, продолжаем без трейсинга
          console.warn('Failed to initialize tracer:', error);
        }
      }
      
      if (!this._lazyTracer) {
        // Выполняем метод без трейсинга
        return await originalMethod.apply(this, args);
      }

      const spanAttributes: Record<string, any> = {
        'method.name': propertyKey,
        'class.name': target.constructor.name,
        ...options.attributes || {}
      };

      // Добавить аргументы в атрибуты если включено
      if (options.includeArgs && args.length > 0) {
        spanAttributes['method.args.count'] = args.length;
        args.forEach((arg, index) => {
          if (arg !== null && arg !== undefined) {
            spanAttributes[`method.args.${index}.type`] = typeof arg;
            if (typeof arg === 'string' || typeof arg === 'number' || typeof arg === 'boolean') {
              spanAttributes[`method.args.${index}.value`] = String(arg);
            }
          }
        });
      }

      let spanStarted = false;
      
      try {
        await this._lazyTracer.startSpan(spanName, {
          attributes: spanAttributes
        });
        spanStarted = true;
      } catch (spanError) {
        console.warn('Failed to start span:', spanError);
      }

      try {
        const result = await originalMethod.apply(this, args);
        
        // Добавить информацию о результате если включено
        if (spanStarted && options.includeResult) {
          try {
            const resultInfo: Record<string, any> = {
              'result.type': typeof result,
              'result.hasValue': result !== undefined && result !== null
            };
            
            if (result && typeof result === 'object' && 'length' in result) {
              resultInfo['result.length'] = result.length;
            }
            
            await this._lazyTracer.addEvent('method.completed', resultInfo);
          } catch (eventError) {
            console.warn('Failed to add result event:', eventError);
          }
        }
        
        if (spanStarted) {
          try {
            await this._lazyTracer.endSpan(true);
          } catch (endError) {
            console.warn('Failed to end span:', endError);
          }
        }
        
        return result;
      } catch (error) {
        if (spanStarted) {
          try {
            const errorName = error instanceof Error ? error.constructor.name : 'Unknown';
            const errorMessage = error instanceof Error ? error.message : String(error);
            
            await this._lazyTracer.addEvent('method.error', {
              'error.name': errorName,
              'error.message': errorMessage
            });
            await this._lazyTracer.endSpan(false, errorMessage);
          } catch (spanError) {
            console.warn('Failed to handle error in span:', spanError);
          }
        }
        
        // Всегда пробрасываем оригинальную ошибку
        throw error;
      }
    };
    
    return descriptor;
  };
}

/**
 * Базовый класс с поддержкой ленивого трейсинга
 */
export class LazyTraceable implements LazyTraceContext {
  _lazyTracer?: OTLPLazy;

  /**
   * Определяет, нужно ли включать трейсинг
   * По умолчанию включен только в production
   */
  protected shouldTrace(): boolean {
    return process.env.NODE_ENV === 'production';
  }

  /**
   * Получить экземпляр трейсера
   */
  protected getTracer(): OTLPLazy | undefined {
    if (!this._lazyTracer && this.shouldTrace()) {
      try {
        this._lazyTracer = new OTLPLazy();
      } catch (error) {
        console.warn('Failed to create tracer:', error);
      }
    }
    return this._lazyTracer;
  }

  /**
   * Настроить трейсер
   */
  protected configureTracer(config: Parameters<OTLPLazy['configure']>[0]): void {
    const tracer = this.getTracer();
    if (tracer) {
      tracer.configure(config);
    }
  }
}