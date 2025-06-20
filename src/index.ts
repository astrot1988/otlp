// Основные экспорты
export { ConfigManager, otlpConfig, type OTLPConfig } from './config.js';
export { OTLPLazy } from './lazy/otlp-lazy.js';
export { OTLPCore, getOTLPCore } from './core/otlp-core.js';

// Функция-обертка для трейсинга (альтернатива декораторам)
export async function withTrace<T>(
  spanName: string,
  fn: () => Promise<T>,
  options?: {
    includeArgs?: boolean;
    includeResult?: boolean;
    timeout?: number;
    attributes?: Record<string, any>;
  }
): Promise<T> {
  const { ConfigManager } = await import('./config.js');
  const { OTLPLazy } = await import('./lazy/otlp-lazy.js');

  const config = ConfigManager.getInstance();

  if (!config.getConfig().enabled) {
    return fn();
  }

  const otlpLazy = new OTLPLazy();

  try {
    await otlpLazy.startSpan(spanName, {
      attributes: options?.attributes
    });

    const result = await fn();

    if (options?.includeResult) {
      await otlpLazy.addAttribute('result', JSON.stringify(result));
    }

    await otlpLazy.endSpan(true);
    return result;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await otlpLazy.endSpan(false, errorMessage);
    throw error;
  }
}

// Простая функция для создания и инициализации OTLP
export async function initializeOTLP(config: {
  enabled: boolean;
  serviceName?: string;
  serviceVersion?: string;
  endpoint?: string;
  debug?: boolean;
  enableAutoInstrumentation?: boolean;
  headers?: Record<string, string>;
}) {
  const { ConfigManager } = await import('./config.js');
  const { getOTLPCore } = await import('./core/otlp-core.js');

  const configManager = ConfigManager.getInstance();
  configManager.setConfig(config);

  const core = getOTLPCore();
  await core.initialize();

  return {
    configManager,
    core,
    withTrace: (spanName: string, fn: () => Promise<any>, options?: any) =>
      withTrace(spanName, fn, options)
  };
}