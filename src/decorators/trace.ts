import { OTLPLazy } from '../lazy/otlp-lazy';
import { OTLPFull } from '../full/otlp-full';

interface TraceOptions {
  attributes?: Record<string, any>;
  includeArgs?: boolean;
  includeResult?: boolean;
  traceOnError?: boolean;
}

export function trace(spanName: string, options: TraceOptions = {}) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor?.value || target[propertyKey];

    const newMethod = async function (...args: any[]) {
      if (options.traceOnError) {
        try {
          return await originalMethod.apply(this, args);
        } catch (error) {
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
        } catch (error) {
          await tracer.endSpan(false, error.message);
          throw error;
        }
      }
    };

    if (descriptor) {
      descriptor.value = newMethod;
      return descriptor;
    } else {
      target[propertyKey] = newMethod;
    }
  };
}

export function traceOnError(spanName: string, options: Omit<TraceOptions, 'traceOnError'> = {}) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor?.value || target[propertyKey];

    const newMethod = async function (...args: any[]) {
      try {
        return await originalMethod.apply(this, args);
      } catch (error) {
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

    if (descriptor) {
      descriptor.value = newMethod;
      return descriptor;
    } else {
      target[propertyKey] = newMethod;
    }
  };
}