import { IOTLPTracer, TraceOptions } from '../types.js';
import { ConfigManager, type OTLPConfig } from '../config.js';
import { NoOpTracer } from '../core/no-op.js';

// Импортируем все зависимости сразу
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { Resource } from '@opentelemetry/resources';
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-web';
import { getWebAutoInstrumentations } from '@opentelemetry/auto-instrumentations-web';
import { trace, Span } from '@opentelemetry/api';

export class OTLPFull implements IOTLPTracer {
  private tracer: any = null;
  private provider: WebTracerProvider | null = null;
  private noOpTracer = new NoOpTracer();
  private currentSpan: Span | null = null;
  private isInitialized = false;

  constructor(config?: Partial<OTLPConfig>) {
    if (config) {
      ConfigManager.getInstance().setConfig(config);
    }
    this.initialize();
  }

  private initialize(): void {
    const config = ConfigManager.getInstance().getConfig();

    if (!config.enabled) {
      if (config.debug) {
        console.log('[OTLP-Full] Telemetry is disabled');
      }
      return;
    }

    try {
      const serviceName = config.serviceName || 'unknown-service';
      const serviceVersion = config.serviceVersion || '1.0.0';

      // Создаем ресурс
      const resource = new Resource({
        [SEMRESATTRS_SERVICE_NAME]: serviceName,
        [SEMRESATTRS_SERVICE_VERSION]: serviceVersion,
      });

      // Создаем провайдер трейсов
      this.provider = new WebTracerProvider({ resource });

      // Создаем экспортер только если есть endpoint
      if (config.endpoint) {
        const exporter = new OTLPTraceExporter({
          url: config.endpoint,
          headers: config.headers || {},
        });

        this.provider.addSpanProcessor(new BatchSpanProcessor(exporter));
      }

      // Регистрируем провайдер
      this.provider.register();

      // Получаем трейсер
      this.tracer = this.provider.getTracer(serviceName, serviceVersion);

      if (config.enableAutoInstrumentation) {
        try {
          const instrumentations = getWebAutoInstrumentations();

          instrumentations.forEach(instrumentation => {
            try {
              // Отключаем проблемные инструментации по имени
              const name = instrumentation.instrumentationName || '';
              if (name.includes('fs') || name.includes('http') || name.includes('net')) {
                instrumentation.disable();
                if (config.debug) {
                  console.log(`[OTLP-Full] Disabled instrumentation: ${name}`);
                }
              } else {
                instrumentation.enable();
                if (config.debug) {
                  console.log(`[OTLP-Full] Enabled instrumentation: ${name}`);
                }
              }
            } catch (instrError) {
              if (config.debug) {
                console.warn('[OTLP-Full] Failed to configure instrumentation:', instrumentation.instrumentationName, instrError);
              }
            }
          });
        } catch (autoInstrError) {
          if (config.debug) {
            console.warn('[OTLP-Full] Failed to initialize auto-instrumentation:', autoInstrError);
          }
        }
      }

      this.isInitialized = true;

      if (config.debug) {
        console.log('[OTLP-Full] Initialized successfully', {
          serviceName,
          serviceVersion,
          endpoint: config.endpoint,
          traceOnErrorOnly: config.traceOnErrorOnly,
          enableAutoInstrumentation: config.enableAutoInstrumentation
        });
      }
    } catch (error) {
      console.error('[OTLP-Full] Failed to initialize:', error);
      this.isInitialized = false;
    }
  }

  private isEnabled(): boolean {
    return ConfigManager.getInstance().isEnabled() && this.isInitialized && this.tracer;
  }

  trace<T>(target: any, propertyKey: string, descriptor: PropertyDescriptor): PropertyDescriptor {
    const originalMethod = descriptor.value;

    if (!this.isEnabled()) {
      return descriptor;
    }

    const self = this;

    descriptor.value = async function (...args: any[]) {
      if (!self.isEnabled()) {
        return originalMethod.apply(this, args);
      }

      const config = ConfigManager.getInstance().getConfig();
      const spanName = `${target.constructor.name}.${propertyKey}`;

      try {
        const result = await originalMethod.apply(this, args);

        if (config.traceOnErrorOnly) {
          return result;
        }

        const span = self.tracer.startSpan(spanName);
        span.setStatus({ code: 1 }); // OK
        span.end();

        return result;
      } catch (error) {
        // ✅ ИСПРАВЛЕНО: Правильная типизация error
        const errorMessage = error instanceof Error ? error.message : String(error);
        const span = self.tracer.startSpan(spanName);

        if (error instanceof Error) {
          span.recordException(error);
        }

        span.setStatus({ code: 2, message: errorMessage }); // ERROR
        span.end();
        throw error;
      }
    };

    return descriptor;
  }

  startSpan(name: string, options?: TraceOptions): void {
    if (!this.isEnabled()) return;

    const config = ConfigManager.getInstance().getConfig();

    if (config.traceOnErrorOnly && !options?.onErrorOnly) {
      return;
    }

    this.currentSpan = this.tracer.startSpan(name, {
      attributes: options?.attributes || {}
    });
  }

  endSpan(success: boolean = true, error?: Error): void {
    if (!this.currentSpan) return;

    try {
      if (error) {
        this.currentSpan.recordException(error);
        this.currentSpan.setStatus({ code: 2, message: error.message });
      } else if (success) {
        this.currentSpan.setStatus({ code: 1 });
      }
    } finally {
      this.currentSpan.end();
      this.currentSpan = null;
    }
  }

  addAttribute(key: string, value: any): void {
    if (!this.currentSpan) return;
    this.currentSpan.setAttributes({ [key]: value });
  }

  recordError(error: Error): void {
    if (!this.currentSpan) return;
    this.currentSpan.recordException(error);
  }

  public shutdown(): Promise<void> {
    if (this.provider) {
      return this.provider.shutdown();
    }
    return Promise.resolve();
  }

  public forceFlush(): Promise<void> {
    if (this.provider) {
      return this.provider.forceFlush();
    }
    return Promise.resolve();
  }

  public getTracer() {
    return this.tracer;
  }

  public isReady(): boolean {
    return this.isInitialized && this.tracer !== null;
  }

  public configure(config: Partial<OTLPConfig>): void {
    ConfigManager.getInstance().setConfig(config);

    if (this.isInitialized) {
      this.shutdown().then(() => {
        this.initialize();
      });
    }
  }
}