/**
 * Класс для ленивой инициализации OpenTelemetry
 * Инициализирует трейсинг только при первом использовании
 */
export class OTLPLazy {
  private initialized = false;
  private currentSpan: any = null;
  private tracer: any = null;

  constructor(private config?: {
    serviceName?: string;
    serviceVersion?: string;
    endpoint?: string;
    debug?: boolean;
  }) {}

  /**
   * Ленивая инициализация OpenTelemetry
   */
  private async initialize() {
    if (this.initialized) return;

    try {
      // Динамический импорт OpenTelemetry модулей
      const { trace } = await import('@opentelemetry/api');
      const { WebTracerProvider } = await import('@opentelemetry/sdk-trace-web');
      const { Resource } = await import('@opentelemetry/resources');
      const { SemanticResourceAttributes } = await import('@opentelemetry/semantic-conventions');
      const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-http');
      const { BatchSpanProcessor } = await import('@opentelemetry/sdk-trace-web');

      // Создание провайдера
      const provider = new WebTracerProvider({
        resource: new Resource({
          [SemanticResourceAttributes.SERVICE_NAME]: this.config?.serviceName || 'lazy-otlp-service',
          [SemanticResourceAttributes.SERVICE_VERSION]: this.config?.serviceVersion || '1.0.0',
        }),
      });

      // Настройка экспортера, если указан endpoint
      if (this.config?.endpoint) {
        const exporter = new OTLPTraceExporter({
          url: this.config.endpoint,
        });

        provider.addSpanProcessor(new BatchSpanProcessor(exporter));
      }

      // Регистрация провайдера
      provider.register();

      // Получение трейсера
      this.tracer = trace.getTracer(
        this.config?.serviceName || 'lazy-otlp-service',
        this.config?.serviceVersion || '1.0.0'
      );

      this.initialized = true;

      if (this.config?.debug) {
        console.log('OTLP Lazy initialized successfully', {
          serviceName: this.config.serviceName,
          endpoint: this.config.endpoint
        });
      }
    } catch (error) {
      console.error('Failed to initialize OTLP Lazy:', error);
      this.initialized = false;
    }
  }

  /**
   * Начать новый спан
   */
  async startSpan(name: string, options: {
    attributes?: Record<string, any>;
  } = {}) {
    await this.initialize();

    if (!this.tracer) {
      if (this.config?.debug) {
        console.warn('Tracer not available, skipping span creation');
      }
      return;
    }

    try {
      this.currentSpan = this.tracer.startSpan(name, {
        attributes: options.attributes || {}
      });

      if (this.config?.debug) {
        console.log(`Starting span: ${name}`, options.attributes);
      }
    } catch (error) {
      console.error('Failed to start span:', error);
    }
  }

  /**
   * Добавить атрибут к текущему спану
   */
  async addAttribute(key: string, value: any) {
    if (!this.currentSpan) return;

    try {
      this.currentSpan.setAttributes({ [key]: value });

      if (this.config?.debug) {
        console.log(`Adding attribute: ${key} = ${value}`);
      }
    } catch (error) {
      console.error('Failed to add attribute:', error);
    }
  }

  /**
   * Добавить событие к текущему спану
   */
  async addEvent(name: string, attributes: Record<string, any> = {}) {
    if (!this.currentSpan) return;

    try {
      this.currentSpan.addEvent(name, attributes);

      if (this.config?.debug) {
        console.log(`Adding event: ${name}`, attributes);
      }
    } catch (error) {
      console.error('Failed to add event:', error);
    }
  }

  /**
   * Получить значение атрибута (для внутреннего использования)
   */
  async getAttribute(key: string): Promise<any> {
    // В OpenTelemetry нет прямого способа получить атрибуты спана
    // Возвращаем undefined как заглушку
    return undefined;
  }

  /**
   * Завершить текущий спан
   */
  async endSpan(success: boolean = true, message?: string) {
    if (!this.currentSpan) return;

    try {
      if (!success && message) {
        this.currentSpan.recordException(new Error(message));
        this.currentSpan.setStatus({
          code: 2, // ERROR
          message: message
        });
      } else {
        this.currentSpan.setStatus({
          code: 1 // OK
        });
      }

      this.currentSpan.end();

      if (this.config?.debug) {
        console.log(`Ending span: ${success ? 'success' : 'error'}`, message);
      }

      this.currentSpan = null;
    } catch (error) {
      console.error('Failed to end span:', error);
    }
  }

  /**
   * Проверить, инициализирован ли трейсер
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Получить текущий спан (для расширенного использования)
   */
  getCurrentSpan() {
    return this.currentSpan;
  }
}

/**
 * Экспорт для обратной совместимости
 */
export const otlpLazy = new OTLPLazy();