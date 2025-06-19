import { IOTLPTracer, TraceOptions } from '../types.js';
import { ConfigManager } from '../config.js';
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

  constructor() {
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
      // Создаем ресурс
      const resource = new Resource({
        [SEMRESATTRS_SERVICE_NAME]: config.serviceName,
        [SEMRESATTRS_SERVICE_VERSION]: config.serviceVersion,
      });

      // Создаем провайдер трейсов
      this.provider = new WebTracerProvider({ resource });

      // Создаем экспортер
      const exporter = new OTLPTraceExporter({
        url: config.endpoint,
        headers: config.headers,
      });

      // Добавляем процессор
      this.provider.addSpanProcessor(new BatchSpanProcessor(exporter));

      // Регистрируем провайдер
      this.provider.register();

      // Получаем трейсер
      this.tracer = this.provider.getTracer(config.serviceName, config.serviceVersion);

      // Автоинструментирование (если включено)
      if (config.enableAutoInstrumentation) {
        const instrumentations = getWebAutoInstrumentations({
          '@opentelemetry/instrumentation-fs': {
            enabled: false,
          },
        });

        instrumentations.forEach(instrumentation => {
          try {
            instrumentation.enable();
          } catch (error) {
            if (config.debug) {
              console.warn('[OTLP-Full] Failed to enable instrumentation:', error);
            }
          }
        });
      }

      this.isInitialized = true;

      if (config.debug) {
        console.log('[OTLP-Full] Initialized successfully');
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
      const span = self.tracer.startSpan(spanName);

      try {
        const result = await originalMethod.apply(this, args);

        if (!config.traceOnErrorOnly) {
          span.setStatus({ code: 1 }); // OK
        }

        return result;
      } catch (error) {
        span.recordException(error);
        span.setStatus({ code: 2, message: error.message }); // ERROR
        throw error;
      } finally {
        span.end();
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

  // Дополнительные методы для полной версии
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
}