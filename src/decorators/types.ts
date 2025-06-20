export interface LazyTraceable {
  _lazyTracer?: any;
  _errorTracer?: any;
  shouldTrace?(): boolean;
}

export interface LazyTraceOptions {
  attributes?: Record<string, any>;
  includeResult?: boolean;
  condition?: (...args: any[]) => boolean;
  timeout?: number;
}

export interface LazyTraceErrorOptions {
  attributes?: Record<string, any>;
  includeArgs?: boolean;
  errorFilter?: (error: Error) => boolean;
  onError?: (error: Error, context: any) => void;
}

export interface LazyTraceAdvancedOptions extends LazyTraceOptions, LazyTraceErrorOptions {
  onSuccess?: (result: any, context: any) => void;
  traceOnlyOnError?: boolean;
}