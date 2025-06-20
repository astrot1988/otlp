import type { OTLPLazy } from '../lazy/index.js';

export interface LazyTraceable {
  _lazyTracer?: OTLPLazy;
  _errorTracer?: OTLPLazy;
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
  onError?: (error: Error, context: {
    methodName: string;
    className: string;
    args: any[];
    duration: number;
  }) => void;
}

export interface LazyTraceAdvancedOptions extends LazyTraceOptions, LazyTraceErrorOptions {
  onSuccess?: (result: any, context: {
    methodName: string;
    className: string;
    args: any[];
    duration: number;
  }) => void;
  traceOnlyOnError?: boolean;
}