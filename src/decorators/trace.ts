import { OTLP } from '../otlp.js';

interface TraceOptions {
  attributes?: Record<string, any>;
  includeArgs?: boolean;
  includeResult?: boolean;
}

let otlpInstance: OTLP | null = null;

function getOTLPInstance(): OTLP | null {
  if (!otlpInstance) {
    try {
      otlpInstance = new OTLP();
    } catch (error) {
      console.warn('[OTLP] Failed to create instance:', error);
      return null;
    }
  }
  return otlpInstance;
}

export function trace(spanName: string, options: TraceOptions = {}) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const otlp = getOTLPInstance();
      if (!otlp) {
        return originalMethod.apply(this, args);
      }

      const attributes: Record<string, any> = {
        'method.name': propertyKey,
        'class.name': target.constructor.name,
        ...options.attributes
      };

      if (options.includeArgs) {
        attributes['method.args'] = JSON.stringify(args);
      }

      try {
        const result = await originalMethod.apply(this, args);

        otlp.startSpan(spanName, { attributes, isError: false });

        if (options.includeResult) {
          otlp.addAttribute('method.result', JSON.stringify(result));
        }

        otlp.endSpan(true);
        return result;
      } catch (error: any) {
        otlp.startSpan(spanName, { attributes, isError: true });
        otlp.addAttribute('error.message', error.message);
        otlp.recordError(error);
        otlp.endSpan(false, error.message);
        throw error;
      }
    };

    return descriptor;
  };
}

export function traceOnError(spanName: string, options: TraceOptions = {}) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      try {
        return await originalMethod.apply(this, args);
      } catch (error: any) {
        const otlp = getOTLPInstance();
        if (otlp) {
          const attributes: Record<string, any> = {
            'method.name': propertyKey,
            'class.name': target.constructor.name,
            'error.occurred': true,
            ...options.attributes
          };

          if (options.includeArgs) {
            attributes['method.args'] = JSON.stringify(args);
          }

          otlp.startSpan(spanName, { attributes, isError: true });
          otlp.addAttribute('error.message', error.message);
          otlp.recordError(error);
          otlp.endSpan(false, error.message);
        }
        throw error;
      }
    };

    return descriptor;
  };
}