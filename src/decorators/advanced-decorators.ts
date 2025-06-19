import { OTLPLazy } from '../lazy/otlp-lazy.js';
import { ConfigManager } from '../config.js';

export interface AdvancedTraceOptions {
  spanName?: string;
  includeArgs?: boolean;
  includeResult?: boolean;
  timeout?: number;
  retryOnError?: boolean;
  useLazyLoading?: boolean;
  customSpanProcessor?: (span: any, args: any[], result?: any, error?: Error) => void;
}

export function AdvancedTrace(options: AdvancedTraceOptions = {}) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    if (typeof originalMethod !== 'function') {
      throw new Error('AdvancedTrace decorator can only be applied to methods');
    }

    const spanName = options.spanName || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      const config = ConfigManager.getInstance();

      if (!config.getConfig().enabled) {
        return originalMethod.apply(this, args);
      }

      const otlpLazy = new OTLPLazy();

      try {
        await otlpLazy.startSpan(spanName);

        if (options.includeArgs) {
          await otlpLazy.addAttribute('method.args', JSON.stringify(args));
        }

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

        if (options.includeResult) {
          await otlpLazy.addAttribute('method.result', JSON.stringify(result));
        }

        if (options.customSpanProcessor) {
          options.customSpanProcessor(null, args, result);
        }

        await otlpLazy.endSpan(true);
        return result;

      } catch (error) {
        if (options.customSpanProcessor) {
          options.customSpanProcessor(null, args, undefined, error);
        }

        await otlpLazy.endSpan(false);

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
  return AdvancedTrace({
    ...options,
    spanName: options.spanName || 'http-request',
    timeout: options.timeout || 30000
  });
}

export function TraceDatabase(options: Partial<AdvancedTraceOptions> = {}) {
  return AdvancedTrace({
    ...options,
    spanName: options.spanName || 'database-operation',
    timeout: options.timeout || 10000
  });
}

export function TraceAsync(options: Partial<AdvancedTraceOptions> = {}) {
  return AdvancedTrace({
    ...options,
    spanName: options.spanName || 'async-operation'
  });
}
