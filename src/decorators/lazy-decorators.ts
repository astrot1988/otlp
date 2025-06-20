import { OTLPLazy } from '../lazy/index.js';
import type { LazyTraceable, LazyTraceOptions, LazyTraceErrorOptions, LazyTraceAdvancedOptions } from './types.js';

function isError(error: unknown): error is Error {
  return error instanceof Error;
}

function shouldEnableTracing(instance: LazyTraceable): boolean {
  return instance.shouldTrace?.() !== false &&
    (process.env.NODE_ENV === 'production' || process.env.ENABLE_TRACING === 'true');
}

export function lazyTrace(spanName: string, options: LazyTraceOptions = {}) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    if (!descriptor?.value || typeof descriptor.value !== 'function') {
      throw new Error('lazyTrace decorator can only be applied to methods');
    }

    const originalMethod = descriptor.value;

    descriptor.value = async function (this: LazyTraceable, ...args: any[]) {
      if (options.condition && !options.condition.apply(this, args)) {
        return await originalMethod.apply(this, args);
      }

      if (!this._lazyTracer && shouldEnableTracing(this)) {
        this._lazyTracer = new OTLPLazy();
      }

      if (!this._lazyTracer) {
        return await originalMethod.apply(this, args);
      }

      const startTime = Date.now();
      await this._lazyTracer.startSpan(spanName, {
        attributes: {
          'method.name': propertyKey,
          'class.name': target.constructor.name,
          ...options.attributes
        }
      });

      try {
        let result;
        if (options.timeout) {
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`Method ${propertyKey} timed out after ${options.timeout}ms`)), options.timeout);
          });
          result = await Promise.race([originalMethod.apply(this, args), timeoutPromise]);
        } else {
          result = await originalMethod.apply(this, args);
        }

        await this._lazyTracer.addAttribute('execution.duration_ms', Date.now() - startTime);

        if (options.includeResult && result !== undefined) {
          await this._lazyTracer.addAttribute('result.type', typeof result);
          if (typeof result === 'object' && result !== null) {
            await this._lazyTracer.addAttribute('result.keys_count', Object.keys(result).length);
          }
        }

        await this._lazyTracer.addEvent('method.completed', {
          success: true,
          duration_ms: Date.now() - startTime
        });

        await this._lazyTracer.endSpan(true);
        return result;

      } catch (error) {
        const err = isError(error) ? error : new Error(String(error));

        await this._lazyTracer.addAttribute('execution.duration_ms', Date.now() - startTime);
        await this._lazyTracer.addAttribute('error.type', err.constructor.name);
        await this._lazyTracer.addAttribute('error.message', err.message);

        await this._lazyTracer.addEvent('method.error', {
          error_type: err.constructor.name,
          error_message: err.message,
          duration_ms: Date.now() - startTime
        });

        await this._lazyTracer.endSpan(false, err.message);
        throw error;
      }
    };

    return descriptor;
  };
}

export function lazyTraceOnError(spanName: string, options: LazyTraceErrorOptions = {}) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    if (!descriptor?.value || typeof descriptor.value !== 'function') {
      throw new Error('lazyTraceOnError decorator can only be applied to methods');
    }

    const originalMethod = descriptor.value;

    descriptor.value = async function (this: LazyTraceable, ...args: any[]) {
      const startTime = Date.now();

      try {
        return await originalMethod.apply(this, args);
      } catch (error) {
        const err = isError(error) ? error : new Error(String(error));

        if (options.errorFilter && !options.errorFilter(err)) {
          throw error;
        }

        if (!this._errorTracer && shouldEnableTracing(this)) {
          this._errorTracer = new OTLPLazy();
        }

        if (this._errorTracer) {
          await this._errorTracer.startSpan(spanName, {
            attributes: {
              'method.name': propertyKey,
              'class.name': target.constructor.name,
              'error.occurred': true,
              'execution.duration_ms': Date.now() - startTime,
              ...options.attributes
            }
          });

          if (options.includeArgs && args.length > 0) {
            await this._errorTracer.addAttribute('args.count', args.length);
            for (let i = 0; i < args.length; i++) {
              const arg = args[i];
              if (arg != null) {
                await this._errorTracer.addAttribute(`args.${i}.type`, typeof arg);
                if (['string', 'number', 'boolean'].includes(typeof arg)) {
                  await this._errorTracer.addAttribute(`args.${i}.value`, String(arg).substring(0, 100));
                }
              }
            }
          }

          await this._errorTracer.addAttribute('error.name', err.name);
          await this._errorTracer.addAttribute('error.message', err.message);
          await this._errorTracer.addAttribute('error.stack', err.stack?.substring(0, 1000) || '');

          if (err.cause) {
            await this._errorTracer.addAttribute('error.cause', String(err.cause));
          }

          await this._errorTracer.addEvent('error.details', {
            error_name: err.name,
            error_message: err.message,
            method_name: propertyKey,
            class_name: target.constructor.name,
            execution_time_ms: Date.now() - startTime,
            timestamp: new Date().toISOString()
          });

          if (options.onError) {
            try {
              options.onError(err, {
                methodName: propertyKey,
                className: target.constructor.name,
                args,
                duration: Date.now() - startTime
              });
            } catch (handlerError) {
              const handlerErr = isError(handlerError) ? handlerError : new Error(String(handlerError));
              await this._errorTracer.addEvent('error.handler_failed', {
                handler_error: handlerErr.message
              });
            }
          }

          await this._errorTracer.endSpan(false, `${err.name}: ${err.message}`);
        }

        throw error;
      }
    };

    return descriptor;
  };
}

export function lazyTraceAdvanced(spanName: string, options: LazyTraceAdvancedOptions = {}) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    if (!descriptor?.value || typeof descriptor.value !== 'function') {
      throw new Error('lazyTraceAdvanced decorator can only be applied to methods');
    }

    const originalMethod = descriptor.value;

    descriptor.value = async function (this: LazyTraceable, ...args: any[]) {
      if (options.condition && !options.condition.apply(this, args)) {
        return await originalMethod.apply(this, args);
      }

      const startTime = Date.now();
      let tracer: OTLPLazy | null = null;

      // Функция инициализации трейсера с правильной типизацией
      const initTracer = (): OTLPLazy | null => {
        if (!tracer && shouldEnableTracing(this)) {
          tracer = new OTLPLazy();
        }
        return tracer;
      };

      // Если трассируем не только ошибки, инициализируем сразу
      if (!options.traceOnlyOnError) {
        tracer = initTracer();
      }

      try {
        let result;

        // Начинаем спан, если трейсер инициализирован
        if (tracer) {
          await tracer.startSpan(spanName, {
            attributes: {
              'method.name': propertyKey,
              'class.name': target.constructor.name,
              ...options.attributes
            }
          });

          if (options.includeArgs && args.length > 0) {
            await tracer.addAttribute('args.count', args.length);
          }
        }

        // Выполняем метод с таймаутом или без
        if (options.timeout) {
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`Method ${propertyKey} timed out after ${options.timeout}ms`)), options.timeout);
          });

          result = await Promise.race([
            originalMethod.apply(this, args),
            timeoutPromise
          ]);
        } else {
          result = await originalMethod.apply(this, args);
        }

        // Добавляем атрибуты успешного выполнения
        if (tracer) {
          await tracer.addAttribute('execution.duration_ms', Date.now() - startTime);

          if (options.includeResult && result !== undefined) {
            await tracer.addAttribute('result.type', typeof result);
            if (Array.isArray(result)) {
              await tracer.addAttribute('result.length', result.length);
            } else if (typeof result === 'object' && result !== null) {
              await tracer.addAttribute('result.keys_count', Object.keys(result).length);
            }
          }

          await tracer.addEvent('method.completed', {
            success: true,
            duration_ms: Date.now() - startTime
          });

          await tracer.endSpan(true);
        }

        // Вызываем callback успешного выполнения
        if (options.onSuccess) {
          try {
            options.onSuccess(result, {
              methodName: propertyKey,
              className: target.constructor.name,
              args: args,
              duration: Date.now() - startTime
            });
          } catch (callbackError) {
            console.warn('onSuccess callback failed:', callbackError);
          }
        }

        return result;

      } catch (error) {
        const err = isError(error) ? error : new Error(String(error));

        // Проверяем фильтр ошибок
        if (options.errorFilter && !options.errorFilter(err)) {
          throw error;
        }

        // Инициализируем трейсер для ошибки, если еще не инициализирован
        if (!tracer) {
          tracer = initTracer();
        }

        if (tracer) {
          // Если трассируем только ошибки, начинаем спан здесь
          if (options.traceOnlyOnError) {
            await tracer.startSpan(spanName, {
              attributes: {
                'method.name': propertyKey,
                'class.name': target.constructor.name,
                'error.occurred': true,
                ...options.attributes
              }
            });

            if (options.includeArgs && args.length > 0) {
              await tracer.addAttribute('args.count', args.length);
            }
          }

          // Добавляем информацию об ошибке
          await tracer.addAttribute('execution.duration_ms', Date.now() - startTime);
          await tracer.addAttribute('error.type', err.constructor.name);
          await tracer.addAttribute('error.message', err.message);

          if (err.stack) {
            await tracer.addAttribute('error.stack', err.stack.substring(0, 1000));
          }

          await tracer.addEvent('method.error', {
            error_type: err.constructor.name,
            error_message: err.message,
            duration_ms: Date.now() - startTime,
            timestamp: new Date().toISOString()
          });

          await tracer.endSpan(false, err.message);
        }

        // Вызываем callback ошибки
        if (options.onError) {
          try {
            options.onError(err, {
              methodName: propertyKey,
              className: target.constructor.name,
              args: args,
              duration: Date.now() - startTime
            });
          } catch (callbackError) {
            console.warn('onError callback failed:', callbackError);
          }
        }

        throw error;
      }
    };

    return descriptor;
  };
}
