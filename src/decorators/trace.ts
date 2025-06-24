import { OTLPLazy } from '../lazy/otlp-lazy';
import { OTLPFull } from '../full/otlp-full';

interface TraceOptions {
  attributes?: Record<string, any>;
  includeArgs?: boolean;    // Включает аргументы метода в атрибуты трейса
  includeResult?: boolean;  // Включает результат выполнения метода в атрибуты трейса
  traceOnError?: boolean;   // Трейсит только при ошибках через OTLPFull
}

export function trace(spanName: string, options: TraceOptions = {}) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      if (options.traceOnError) {
        // Режим только ошибок - используем OTLPFull
        try {
          return await originalMethod.apply(this, args);
        } catch (error: any) {
          const tracer = new OTLPFull();
          const attributes = { ...options.attributes };

          if (options.includeArgs) {
            attributes['method.args'] = JSON.stringify(args);
          }

          await tracer.startSpan(spanName, { attributes });
          await tracer.endSpan(false, error.message);
          throw error;
        }
      } else {
        // Обычный режим - используем OTLPLazy
        const tracer = new OTLPLazy();

        try {
          const attributes = { ...options.attributes };

          if (options.includeArgs) {
            attributes['method.args'] = JSON.stringify(args);
          }

          await tracer.startSpan(spanName, { attributes });
          const result = await originalMethod.apply(this, args);

          if (options.includeResult) {
            await tracer.addAttribute('method.result', JSON.stringify(result));
          }

          await tracer.endSpan(true);
          return result;
        } catch (error: any) {
          await tracer.endSpan(false, error.message);
          throw error;
        }
      }
    };

    return descriptor;
  };
}

export function traceOnError(spanName: string, options: Omit<TraceOptions, 'traceOnError'> = {}) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      try {
        return await originalMethod.apply(this, args);
      } catch (error: any) {
        const tracer = new OTLPFull();
        const attributes = { ...options.attributes };

        if (options.includeArgs) {
          attributes['method.args'] = JSON.stringify(args);
        }

        await tracer.startSpan(spanName, { attributes });
        await tracer.endSpan(false, error.message);
        throw error;
      }
    };

    return descriptor;
  };
}