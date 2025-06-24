// Основные экспорты
export { ConfigManager, otlpConfig, type OTLPConfig } from './config';

// Экспорт декораторов из правильного файла
export {
  lazyTrace,
  lazyTraceOnError
} from './decorators/lazy-decorators.js';

// Экспорт типов для декораторов
export type {
  LazyTraceable,
  LazyTraceOptions,
  LazyTraceErrorOptions
} from './decorators/types.js';

// Экспорт классов трейсеров
export { OTLPLazy } from './lazy/index.js';
export { OTLPFull } from './full/otlp-full.js';

// ✅ ИСПРАВЛЕНО: Импортируем тип OTLPConfig для использования в типах
import type { OTLPConfig } from './config.js';

// Тип для инициализации - частичная конфигурация с обязательными полями
export type InitializeOTLPConfig = Partial<OTLPConfig> & {
  enabled: boolean;
  serviceName: string;
};

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
  const {ConfigManager} = await import('./config.js');
  const {OTLPLazy} = await import('./lazy/otlp-lazy.js');

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

// ✅ Функция для ленивой инициализации OTLP
export async function initializeOTLP(config: InitializeOTLPConfig) {
  const {ConfigManager} = await import('./config.js');
  const {getOTLPCore} = await import('./core/otlp-core.js');

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

// ✅ Функция для полной инициализации OTLP
export async function initializeOTLPFull(config: InitializeOTLPConfig) {
  const {ConfigManager} = await import('./config.js');
  const {OTLPFull} = await import('./full/otlp-full.js');

  const configManager = ConfigManager.getInstance();
  configManager.setConfig(config);

  // Создаем экземпляр полной версии
  const otlpFull = new OTLPFull();

  return {
    configManager,
    otlpFull,
    withTrace: (spanName: string, fn: () => Promise<any>, options?: any) =>
      withTrace(spanName, fn, options)
  };
}

// ✅ Универсальная функция инициализации с выбором режима
export async function initializeOTLPWithMode(
  config: InitializeOTLPConfig & {
    mode?: 'lazy' | 'full'
  }
) {
  const mode = config.mode || 'lazy';

  if (mode === 'full') {
    return await initializeOTLPFull(config);
  } else {
    return await initializeOTLP(config);
  }
}
