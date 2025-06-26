export interface TraceContext {
  traceId: string;
  spanId: string;
  baggage: Record<string, any>;
  startTime: number;
}