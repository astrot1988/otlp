import { OTLP } from '../otlp.js';

export interface AdvancedTraceOptions {
  spanName?: string;
  includeArgs?: boolean;
  includeResult?: boolean;
  timeout?: number;
  retryOnError?: boolean;
  customSpanProcessor?: (args: any[], result?: any, error?: Error) => void;
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

export function advancedTrace(options: AdvancedTraceOptions = {}) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    if (typeof originalMethod !== 'function') {
      throw new Error('advancedTrace decorator can only be applied to methods');
    }

    const spanName = options.spanName || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      const otlp = getOTLPInstance();
      if (!otlp) {
        return originalMethod.apply(this, args);
      }

      const attributes: Record<string, any> = {
        'method.name': propertyKey,
        'class.name': target.constructor.name
      };

      if (options.includeArgs) {
        attributes['method.args'] = JSON.stringify(args);
      }

      try {
        let result;

        if (options.timeout) {
          result = await Promise.race([
            originalMethod.apply(this, args),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Method timeout')), options.timeout)
            )
          ]);
        } else {
          result = await originalMethod.apply(this, args);
        }

        // Успешное выполнение
        otlp.startSpan(spanName, { attributes, isError: false });

        if (options.includeResult) {
          otlp.addAttribute('method.result', JSON.stringify(result));
        }

        if (options.customSpanProcessor) {
          options.customSpanProcessor(args, result);
        }

        otlp.endSpan(true);
        return result;

      } catch (error: any) {
        // Ошибка
        otlp.startSpan(spanName, { attributes, isError: true });

        if (options.customSpanProcessor) {
          options.customSpanProcessor(args, undefined, error);
        }

        otlp.addAttribute('error.message', error.message);
        otlp.recordError(error);
        otlp.endSpan(false, error.message);

        if (options.retryOnError) {
          console.warn(`Retrying ${spanName} due to error:`, error);
          return descriptor.value.apply(this, args);
        }

        throw error;
      }
    };

    return descriptor;
  };
}
export function TraceHTTP(options: Partial<AdvancedTraceOptions> = {}) {
  return advancedTrace({
    ...options,
    spanName: options.spanName || 'http-request',
    timeout: options.timeout || 30000
  });
}

export function TraceDatabase(options: Partial<AdvancedTraceOptions> = {}) {
  return advancedTrace({
    ...options,
    spanName: options.spanName || 'database-operation',
    timeout: options.timeout || 10000
  });
}

export function TraceAsync(options: Partial<AdvancedTraceOptions> = {}) {
  return advancedTrace({
    ...options,
    spanName: options.spanName || 'async-operation'
  });
}
