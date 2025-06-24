import { OTLPLazy } from '../lazy/otlp-lazy';
import { ConfigManager } from '../config';

interface WithTraceOptions {
  attributes?: Record<string, any>;
  condition?: (...args: any[]) => boolean;
  dynamicAttributes?: (...args: any[]) => Record<string, any>;
  onSuccess?: (result: any, span: any) => void;
  onError?: (error: any, span: any) => void;
}

export function withTrace(spanName: string, options: WithTraceOptions = {}) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const config = ConfigManager.getInstance().getConfig();

      // Проверяем, нужно ли трейсить
      if (!config.enabled) {
        return originalMethod.apply(this, args);
      }

      // Проверяем условие
      if (options.condition && !options.condition(...args)) {
        return originalMethod.apply(this, args);
      }

      // Проверяем traceOnErrorOnly
      if (config.traceOnErrorOnly) {
        // Выполняем метод без трейсинга, но ловим ошибки
        try {
          return await originalMethod.apply(this, args);
        } catch (error) {
          // При ошибке создаем трейс
          await traceError(spanName, error, args, options);
          throw error;
        }
      }

      // Обычное трейсирование
      const tracer = new OTLPLazy();

      try {
        // Собираем атрибуты
        const attributes = {
          ...options.attributes,
          ...(options.dynamicAttributes ? options.dynamicAttributes(...args) : {})
        };

        await tracer.startSpan(spanName, { attributes });

        const result = await originalMethod.apply(this, args);

        if (options.onSuccess && tracer.currentSpan) {
          options.onSuccess(result, tracer.currentSpan);
        }

        await tracer.endSpan(true);
        return result;

      } catch (error: any) {
        if (options.onError && tracer.currentSpan) {
          options.onError(error, tracer.currentSpan);
        }

        await tracer.endSpan(false, error.message);
        throw error;
      }
    };

    return descriptor;
  };
}

// Вспомогательный метод для трейсинга ошибок
async function traceError(spanName: string, error: any, args: any[], options: WithTraceOptions) {
  const tracer = new OTLPLazy();

  const attributes = {
    ...options.attributes,
    ...(options.dynamicAttributes ? options.dynamicAttributes(...args) : {}),
    'error.occurred': true
  };

  await tracer.startSpan(spanName, { attributes, isError: true });

  if (options.onError && tracer.currentSpan) {
    options.onError(error, tracer.currentSpan);
  }

  await tracer.endSpan(false, error.message);
}