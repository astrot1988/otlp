import { IOTLPTracer, TraceOptions } from '../types.js';

export class NoOpTracer implements IOTLPTracer {
  trace<T>(target: any, propertyKey: string, descriptor: PropertyDescriptor): PropertyDescriptor {
    // Возвращаем оригинальный дескриптор без изменений
    return descriptor;
  }

  startSpan(name: string, options?: TraceOptions): void {
    // No-op
  }

  endSpan(success?: boolean, error?: Error): void {
    // No-op
  }

  addAttribute(key: string, value: any): void {
    // No-op
  }

  recordError(error: Error): void {
    // No-op
  }
}