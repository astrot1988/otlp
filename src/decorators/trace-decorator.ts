import { OTLPLazy } from '../lazy/otlp-lazy.js';
import { ConfigManager } from '../config.js';

export function Trace(spanName?: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    if (typeof originalMethod !== 'function') {
      throw new Error('Trace decorator can only be applied to methods');
    }

    const finalSpanName = spanName || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      const config = ConfigManager.getInstance();

      if (!config.getConfig().enabled) {
        return originalMethod.apply(this, args);
      }

      const otlpLazy = new OTLPLazy();

      try {
        await otlpLazy.startSpan(finalSpanName);
        const result = await originalMethod.apply(this, args);
        await otlpLazy.endSpan(true);
        return result;
      } catch (error) {
        await otlpLazy.endSpan(false);
        throw error;
      }
    };

    return descriptor;
  };
}

export function TraceClass(serviceName?: string) {
  return function <T extends { new (...args: any[]): {} }>(constructor: T) {
    // Применяем трейсинг ко всем методам класса
    const prototype = constructor.prototype;
    const methodNames = Object.getOwnPropertyNames(prototype);

    methodNames.forEach(methodName => {
      if (methodName !== 'constructor' && typeof prototype[methodName] === 'function') {
        const descriptor = Object.getOwnPropertyDescriptor(prototype, methodName);
        if (descriptor) {
          const otlp = new OTLPLazy();
          const newDescriptor = otlp.trace(prototype, methodName, descriptor);
          Object.defineProperty(prototype, methodName, newDescriptor);
        }
      }
    });

    return constructor;
  };
}