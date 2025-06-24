export interface OTLPConfig {
  enabled?: boolean;
  endpoint?: string;
  serviceName: string;
  serviceVersion?: string;
  environment?: string;
  enableAutoInstrumentation?: boolean;
  traceOnErrorOnly?: boolean;
  headers?: Record<string, string>;
  debug?: boolean;
}

export interface TraceOptions {
  spanName?: string;
  attributes?: Record<string, any>;
  onErrorOnly?: boolean;
}

export interface SpanContext {
  spanName: string;
  startTime: number;
  attributes: Record<string, any>;
}

export interface IOTLPTracer {
  trace<T>(target: any, propertyKey: string, descriptor: PropertyDescriptor): PropertyDescriptor;
  startSpan(name: string, options?: TraceOptions): void;
  endSpan(success?: boolean, messageOrError?: string | Error): void;
  addAttribute(key: string, value: any): void;
  recordError(error: Error): void;
}