declare global {
  interface Window {
    SETTINGS?: {
      OTEL_EXPORTER_OTLP_ENDPOINT_FRONT?: string;
      OTEL_RESOURCE_ATTRIBUTES?: Record<string, any>;
      OTEL_TRACES_EXPORTER?: string;
      OTEL_SERVICE_NAME?: string;
      OTEL_SERVICE_VERSION?: string;
      OTEL_LOG_LEVEL?: string;
      [key: string]: any;
    };
  }
}

export interface OTLPConfig {
  enabled: boolean;
  mode: 'auto' | 'manual';
  traceOnlyErrors: boolean;
  options?: {
    serviceName?: string;
    serviceVersion?: string;
    endpoint?: string;
    headers?: Record<string, string>;
    resourceAttributes?: Record<string, any>;
    debug?: boolean;
  };
}

export class OTLP {
  private config: OTLPConfig;
  private provider: any = null;
  private tracer: any = null;
  private initialized = false;
  private currentSpan: any = null;

  constructor(config?: Partial<OTLPConfig>) {
    this.config = this.mergeWithDefaults(config);

    if (this.config.enabled) {
      this.initialize();
    }
  }

  private mergeWithDefaults(config?: Partial<OTLPConfig>): OTLPConfig {
    const settings = typeof window !== 'undefined' ? window.SETTINGS : {};

    // Извлекаем все OTEL_ переменные из settings
    const otelVars = this.extractOtelVariables(settings);

    return {
      enabled: config?.enabled ?? !!(settings?.OTEL_EXPORTER_OTLP_ENDPOINT_FRONT),
      mode: config?.mode ?? 'auto',
      traceOnlyErrors: config?.traceOnlyErrors ?? true,
      options: {
        serviceName: otelVars.OTEL_SERVICE_NAME || 'web-app',
        serviceVersion: otelVars.OTEL_SERVICE_VERSION || '1.0.0',
        endpoint: `${otelVars.OTEL_EXPORTER_OTLP_ENDPOINT_FRONT}/v1/traces`,
        resourceAttributes: {
          ...otelVars.OTEL_RESOURCE_ATTRIBUTES,
          ...otelVars  // Все OTEL_ переменные как переменные окружения
        },
        debug: otelVars.OTEL_LOG_LEVEL === 'debug',
        ...config?.options
      }
    };
  }

  private extractOtelVariables(settings: any): Record<string, any> {
    const otelVars: Record<string, any> = {};

    if (settings) {
      Object.keys(settings).forEach(key => {
        if (key.startsWith('OTEL_')) {
          otelVars[key] = settings[key];
        }
      });
    }

    return otelVars;
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const { WebTracerProvider } = await import('@opentelemetry/sdk-trace-web');
      const { Resource } = await import('@opentelemetry/resources');
      const { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION } = await import('@opentelemetry/semantic-conventions');
      const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-http');
      const { BatchSpanProcessor } = await import('@opentelemetry/sdk-trace-web');
      const { trace } = await import('@opentelemetry/api');

      const resource = new Resource({
        [SEMRESATTRS_SERVICE_NAME]: this.config.options?.serviceName || 'web-app',
        [SEMRESATTRS_SERVICE_VERSION]: this.config.options?.serviceVersion || '1.0.0',
        ...this.config.options?.resourceAttributes
      });

      this.provider = new WebTracerProvider({ resource });

      if (this.config.options?.endpoint) {
        const exporter = new OTLPTraceExporter({
          url: this.config.options.endpoint,
          headers: this.config.options.headers || {}
        });
        this.provider.addSpanProcessor(new BatchSpanProcessor(exporter));
      }

      this.provider.register();

      if (this.config.mode === 'auto') {
        await this.enableAutoInstrumentation();
      }

      this.tracer = trace.getTracer(
        this.config.options?.serviceName || 'web-app',
        this.config.options?.serviceVersion || '1.0.0'
      );

      this.initialized = true;

      if (this.config.options?.debug) {
        console.log('[OTLP] Initialized successfully', this.config);
      }
    } catch (error) {
      console.error('[OTLP] Failed to initialize:', error);
    }
  }

  private async enableAutoInstrumentation(): Promise<void> {
    try {
      const { getWebAutoInstrumentations } = await import('@opentelemetry/auto-instrumentations-web');
      const instrumentations = getWebAutoInstrumentations();

      instrumentations.forEach(instrumentation => {
        try {
          instrumentation.enable();
        } catch (error) {
          if (this.config.options?.debug) {
            console.warn('[OTLP] Failed to enable instrumentation:', error);
          }
        }
      });
    } catch (error) {
      if (this.config.options?.debug) {
        console.warn('[OTLP] Auto-instrumentation failed:', error);
      }
    }
  }

  // Методы для ручного трейсинга
  startSpan(name: string, options?: { attributes?: Record<string, any>; isError?: boolean }): void {
    if (!this.shouldTrace(options?.isError)) return;

    this.currentSpan = this.tracer?.startSpan(name, {
      attributes: options?.attributes || {}
    });
  }

  endSpan(success: boolean = true, message?: string): void {
    if (!this.currentSpan) return;

    try {
      if (success) {
        this.currentSpan.setStatus({ code: 1 });
        if (message) {
          this.currentSpan.setAttributes({ 'span.message': message });
        }
      } else {
        this.currentSpan.setStatus({ code: 2, message: message || 'Error' });
      }
    } finally {
      this.currentSpan.end();
      this.currentSpan = null;
    }
  }

  addAttribute(key: string, value: any): void {
    if (this.currentSpan) {
      this.currentSpan.setAttributes({ [key]: value });
    }
  }

  private shouldTrace(isError: boolean = false): boolean {
    if (!this.config.enabled || !this.initialized || !this.tracer) return false;
    if (this.config.traceOnlyErrors && !isError) return false;
    return true;
  }

  async shutdown(): Promise<void> {
    if (this.provider) {
      await this.provider.shutdown();
    }
  }

  recordError(error: Error): void {
    if (this.currentSpan) {
      this.currentSpan.recordException(error);
    }
  }

  addEvent(name: string, attributes?: Record<string, any>): void {
    if (this.currentSpan) {
      this.currentSpan.addEvent(name, attributes);
    }
  }
}

// Автоматическая инициализация при импорте
let defaultInstance: OTLP | null = null;

if (typeof window !== 'undefined' && window.SETTINGS?.OTEL_EXPORTER_OTLP_ENDPOINT_FRONT) {
  defaultInstance = new OTLP();
}

export { defaultInstance as otlp };