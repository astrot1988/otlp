// Автоматическая инициализация при импорте модуля
import './auto-init.js';

// Основные экспорты
export { OTLP, otlp, type OTLPConfig } from './otlp.js';

// Экспорт декораторов
export {
  trace,
  traceOnError,
  advancedTrace,
  TraceHTTP,
  TraceDatabase,
  TraceAsync
} from './decorators/index.js';

export type {
  AdvancedTraceOptions
} from './decorators/index.js';

// Функция-обертка для трейсинга
export async function withTrace<T>(
  spanName: string,
  fn: () => Promise<T>,
  options?: {
    includeArgs?: boolean;
    includeResult?: boolean;
    attributes?: Record<string, any>;
  }
): Promise<T> {
  const {OTLP} = await import('./otlp.js');
  const otlp = new OTLP();

  const attributes = {...options?.attributes};

  try {
    const result = await fn();

    otlp.startSpan(spanName, {attributes, isError: false});

    if (options?.includeResult) {
      otlp.addAttribute('result', JSON.stringify(result));
    }

    otlp.endSpan(true);
    return result;
  } catch (error: any) {
    otlp.startSpan(spanName, {attributes, isError: true});
    otlp.addAttribute('error.message', error.message);
    otlp.recordError(error);
    otlp.endSpan(false, error.message);
    throw error;
  }
}
