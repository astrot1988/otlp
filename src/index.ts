// Основные экспорты
export { ConfigManager, otlpConfig, type OTLPConfig } from './config.js';
export { lazyTrace, lazyTraceOnError, type LazyTraceable } from './decorators/index.js';
export { OTLPLazy } from './lazy/index.js';

// Функция-обертка для трейсинга
export async function withTrace<T>(
  spanName: string,
  fn: () => Promise<T>,
  options?: {
    attributes?: Record<string, any>;
  }
): Promise<T> {
  const { ConfigManager } = await import('./config.js');
  const { OTLPLazy } = await import('./lazy/index.js');

  const config = ConfigManager.getInstance();
  if (!config.getConfig().enabled) {
    return fn();
  }

  const otlpLazy = new OTLPLazy();
  try {
    await otlpLazy.startSpan(spanName, { attributes: options?.attributes });
    const result = await fn();
    await otlpLazy.endSpan(true);
    return result;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await otlpLazy.endSpan(false, errorMessage);
    throw error;
  }
}

// Простая инициализация OTLP
export async function initializeOTLP(config: {
  enabled: boolean;
  serviceName?: string;
  serviceVersion?: string;
  endpoint?: string;
  debug?: boolean;
}) {
  const { ConfigManager } = await import('./config.js');
  const configManager = ConfigManager.getInstance();
  configManager.setConfig(config);
  return { configManager, withTrace };
}