import {ConfigManager, type OTLPConfig} from '../config.js';

export class OTLPLazy {
  private configManager: ConfigManager;
  private initialized = false;
  private currentSpan: any = null;
  private tracer: any = null;

  constructor(config?: Partial<OTLPConfig>) {
    this.configManager = ConfigManager.getInstance();

    if (config) {
      this.configManager.setConfig(config);
    }
  }

  configure(config: Partial<OTLPConfig>): void {
    this.configManager.setConfig(config);

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

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    const config = this.configManager.getConfig();
    if (!config.enabled) return;

    try {
      const { trace } = await import('@opentelemetry/api');
      const { WebTracerProvider } = await import('@opentelemetry/sdk-trace-web');
      const { Resource } = await import('@opentelemetry/resources');
      const { SemanticResourceAttributes } = await import('@opentelemetry/semantic-conventions');
      const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-http');
      const { BatchSpanProcessor } = await import('@opentelemetry/sdk-trace-web');

      const provider = new WebTracerProvider({
        resource: new Resource({
          [SemanticResourceAttributes.SERVICE_NAME]: config.serviceName || 'lazy-otlp-service',
          [SemanticResourceAttributes.SERVICE_VERSION]: config.serviceVersion || '1.0.0',
        }),
      });

      if (config.endpoint) {
        const exporter = new OTLPTraceExporter({
          url: config.endpoint,
          headers: config.headers || {},
        });
        provider.addSpanProcessor(new BatchSpanProcessor(exporter));
      }

      provider.register();

      this.tracer = trace.getTracer(
        config.serviceName || 'lazy-otlp-service',
        config.serviceVersion || '1.0.0'
      );

      this.initialized = true;

      if (config.debug) {
        console.log('OTLP Lazy initialized successfully', {
          serviceName: config.serviceName,
          endpoint: config.endpoint
        });
      }
    } catch (error) {
      if (config.debug) {
        console.error('Failed to initialize OTLP:', error);
      }
    }
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

    if (config.traceOnErrorOnly && !options?.isError) {
      return;
    }

    await this.ensureInitialized();

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
          this.currentSpan.setStatus({ code: 1 });
        } else {
          this.currentSpan.setStatus({ code: 2, message: message || 'Error' });
        }
        this.currentSpan.end();
        this.currentSpan = null;
      } catch (error) {
        const config = this.configManager.getConfig();
        if (config.debug) {
          console.warn('Failed to end span:', error);
        }
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

  public async setStatus(code: 'OK' | 'ERROR', description?: string): Promise<void> {
    if (!this.configManager.getConfig().enabled) {
      return;
    }

    try {
      if (this.currentSpan) {
        if (code === 'OK') {
          this.currentSpan.setStatus({ code: 1 }); // SpanStatusCode.OK = 1
        } else {
          this.currentSpan.setStatus({
            code: 2, // SpanStatusCode.ERROR = 2
            message: description
          });
        }
      }
    } catch (error) {
      if (this.configManager.getConfig().debug) {
        console.warn('Failed to set span status:', error);
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
}