import {ConfigManager, type OTLPConfig} from '../config.js';

export class OTLPLazy {
  private configManager: ConfigManager;
  private initialized = false;
  private currentSpan: any = null;
  private tracer: any = null;

  // ✅ ИСПРАВЛЕНО: Полная поддержка всех полей OTLPConfig
  constructor(config?: Partial<OTLPConfig>) {
    this.configManager = ConfigManager.getInstance();

    if (config) {
      this.configManager.setConfig(config);
    }
  }

  configure(config: Partial<OTLPConfig>): void {
    this.configManager.setConfig(config);

    // Если уже инициализирован, сбросить состояние для пересоздания с новой конфигурацией
    if (this.initialized) {
      this.reset();
    }
  }

  getConfig(): OTLPConfig {
    return this.configManager.getConfig();
  }

  private reset(): void {
    this.initialized = false;
    this.currentSpan = null;
    this.tracer = null;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  isEnabled(): boolean {
    return this.configManager.getConfig().enabled;
  }

  public async startSpan(name: string, options?: {
    attributes?: Record<string, any>;
    kind?: any;
    isError?: boolean;
  }): Promise<void> {
    const config = this.configManager.getConfig();

    if (!config.enabled) {
      return;
    }

    // ✅ Проверяем traceOnErrorOnly
    if (config.traceOnErrorOnly && !options?.isError) {
      return;
    }

    await this.ensureInitialized();

    // Создаем span после инициализации
    if (this.tracer) {
      try {
        this.currentSpan = this.tracer.startSpan(name, {
          attributes: options?.attributes || {}
        });
      } catch (error) {
        if (config.debug) {
          console.warn('Failed to start span:', error);
        }
      }
    }
  }

  public async endSpan(success: boolean, message?: string): Promise<void> {
    if (this.currentSpan) {
      try {
        if (success) {
          this.currentSpan.setStatus({ code: 1 }); // OK
        } else {
          this.currentSpan.setStatus({ code: 2, message: message || 'Error' }); // ERROR
        }
        this.currentSpan.end();
      } catch (error) {
        const config = this.configManager.getConfig();
        if (config.debug) {
          console.warn('Failed to end span:', error);
        }
      } finally {
        this.currentSpan = null;
      }
    }
  }

  public async addAttribute(key: string, value: any): Promise<void> {
    if (this.currentSpan) {
      try {
        this.currentSpan.setAttributes({ [key]: value });
      } catch (error) {
        const config = this.configManager.getConfig();
        if (config.debug) {
          console.warn('Failed to add attribute:', error);
        }
      }
    }
  }

  public async addEvent(name: string, attributes?: Record<string, any>): Promise<void> {
    if (this.currentSpan) {
      try {
        this.currentSpan.addEvent(name, attributes);
      } catch (error) {
        const config = this.configManager.getConfig();
        if (config.debug) {
          console.warn('Failed to add event:', error);
        }
      }
    } else {
      // Fallback для тестов и отладки
      const config = this.configManager.getConfig();
      if (config.debug) {
        console.log(`Event: ${name}`, attributes);
      }
    }
  }

  public async trace<T>(
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ): Promise<PropertyDescriptor> {
    if (!descriptor || typeof descriptor.value !== 'function') {
      throw new Error('Trace can only be applied to methods');
    }

    const originalMethod = descriptor.value;
    const spanName = `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      const config = ConfigManager.getInstance().getConfig();

      if (!config.enabled) {
        return originalMethod.apply(this, args);
      }

      const otlpLazy = new OTLPLazy();

      try {
        await otlpLazy.startSpan(spanName);
        const result = await originalMethod.apply(this, args);
        await otlpLazy.endSpan(true);
        return result;
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        // ✅ При ошибке помечаем как error span
        await otlpLazy.startSpan(spanName, { isError: true });
        await otlpLazy.endSpan(false, errorMessage);
        throw error;
      }
    };

    return descriptor;
  }

  /**
   * Ленивая инициализация OpenTelemetry
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) {
      return;
    }

    const config = this.configManager.getConfig();

    if (!config.enabled) {
      if (config.debug) {
        console.log('OTLP: Tracing is disabled');
      }
      return;
    }

    try {
      // ✅ Динамический импорт OpenTelemetry модулей
      const { trace } = await import('@opentelemetry/api');
      const { WebTracerProvider } = await import('@opentelemetry/sdk-trace-web');
      const { Resource } = await import('@opentelemetry/resources');
      const { SemanticResourceAttributes } = await import('@opentelemetry/semantic-conventions');
      const { BatchSpanProcessor } = await import('@opentelemetry/sdk-trace-web');

      const serviceName = config.serviceName || 'unknown-service';
      const serviceVersion = config.serviceVersion || '1.0.0';

      // Создание провайдера
      const provider = new WebTracerProvider({
        resource: new Resource({
          [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
          [SemanticResourceAttributes.SERVICE_VERSION]: serviceVersion,
        }),
      });

      // Настройка экспортера, если указан endpoint
      if (config.endpoint) {
        const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-http');
        const exporter = new OTLPTraceExporter({
          url: config.endpoint,
          headers: config.headers || {},
        });

        provider.addSpanProcessor(new BatchSpanProcessor(exporter));
      }

      // ✅ Автоинструментация (если включена)
      if (config.enableAutoInstrumentation) {
        try {
          const { getWebAutoInstrumentations } = await import('@opentelemetry/auto-instrumentations-web');
          const { registerInstrumentations } = await import('@opentelemetry/instrumentation');

          const instrumentations = getWebAutoInstrumentations();
          registerInstrumentations({
            instrumentations: instrumentations,
          });

          if (config.debug) {
            console.log('OTLP Lazy: Auto-instrumentation enabled');
          }
        } catch (autoInstrError) {
          if (config.debug) {
            console.warn('OTLP Lazy: Failed to enable auto-instrumentation:', autoInstrError);
          }
        }
      }

      // Регистрация провайдера
      provider.register();

      // Получение трейсера
      this.tracer = trace.getTracer(serviceName, serviceVersion);

      this.initialized = true;

      if (config.debug) {
        console.log('OTLP Lazy initialized successfully', {
          serviceName,
          serviceVersion,
          endpoint: config.endpoint,
          traceOnErrorOnly: config.traceOnErrorOnly,
          enableAutoInstrumentation: config.enableAutoInstrumentation
        });
      }
    } catch (error) {
      if (config.debug) {
        console.error('Failed to initialize OTLP Lazy:', error);
      }
      this.initialized = false;
    }
  }
}