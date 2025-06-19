import { ConfigManager } from '../config.js';

export class LazyLoader {
  private static tracerPromise: Promise<any> | null = null;
  private static isLoading = false;

  public static async loadTracer(): Promise<any> {
    const config = ConfigManager.getInstance().getConfig();

    if (!config.enabled) {
      if (config.debug) {
        console.log('[OTLP] Telemetry is disabled, skipping tracer load');
      }
      return null;
    }

    if (this.tracerPromise) {
      return this.tracerPromise;
    }

    if (this.isLoading) {
      // Ждем завершения текущей загрузки
      while (this.isLoading) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      return this.tracerPromise;
    }

    this.isLoading = true;

    try {
      this.tracerPromise = this.createTracer();
      const tracer = await this.tracerPromise;

      if (config.debug) {
        console.log('[OTLP] Tracer loaded successfully');
      }

      return tracer;
    } catch (error) {
      console.error('[OTLP] Failed to load tracer:', error);
      this.tracerPromise = null;
      return null;
    } finally {
      this.isLoading = false;
    }
  }

  private static async createTracer(): Promise<any> {
    // Динамический импорт OpenTelemetry зависимостей
    const [
      { WebTracerProvider },
      { Resource },
      { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION },
      { OTLPTraceExporter },
      { BatchSpanProcessor },
      { getWebAutoInstrumentations }
    ] = await Promise.all([
      import('@opentelemetry/sdk-trace-web'),
      import('@opentelemetry/resources'),
      import('@opentelemetry/semantic-conventions'),
      import('@opentelemetry/exporter-trace-otlp-http'),
      import('@opentelemetry/sdk-trace-web'),
      import('@opentelemetry/auto-instrumentations-web')
    ]);

    const config = ConfigManager.getInstance().getConfig();

    // Создаем ресурс
    const resource = new Resource({
      [SEMRESATTRS_SERVICE_NAME]: config.serviceName,
      [SEMRESATTRS_SERVICE_VERSION]: config.serviceVersion,
    });

    // Создаем провайдер трейсов
    const provider = new WebTracerProvider({ resource });

    // Создаем экспортер
    const exporter = new OTLPTraceExporter({
      url: config.endpoint,
      headers: config.headers,
    });

    // Добавляем процессор
    provider.addSpanProcessor(new BatchSpanProcessor(exporter));

    // Регистрируем провайдер
    provider.register();

    // Автоинструментирование (если включено)
    if (config.enableAutoInstrumentation) {
      const instrumentations = getWebAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': {
          enabled: false,
        },
      });

      // Регистрируем инструментации
      instrumentations.forEach(instrumentation => {
        instrumentation.enable();
      });
    }

    return provider.getTracer(config.serviceName, config.serviceVersion);
  }

  public static reset(): void {
    this.tracerPromise = null;
    this.isLoading = false;
  }
}