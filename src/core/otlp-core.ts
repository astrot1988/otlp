import { trace, context, SpanStatusCode, SpanKind } from '@opentelemetry/api';
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-web';
import { getWebAutoInstrumentations } from '@opentelemetry/auto-instrumentations-web';
import { registerInstrumentations } from '@opentelemetry/instrumentation';

import { ConfigManager, type OTLPConfig } from '../config.js';

export class OTLPCore {
  private provider: WebTracerProvider | null = null;
  private tracer: any = null;
  private initialized = false;

  public async initialize(config?: Partial<OTLPConfig>): Promise<void> {
    if (this.initialized) {
      return;
    }

    const configManager = ConfigManager.getInstance();
    if (config) {
      configManager.setConfig(config);
    }

    const currentConfig = configManager.getConfig();

    if (!currentConfig.enabled) {
      if (currentConfig.debug) {
        console.log('OTLP is disabled');
      }
      return;
    }

    try {
      // Создаем ресурс
      const resource = new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: currentConfig.serviceName || 'unknown-service',
        [SemanticResourceAttributes.SERVICE_VERSION]: currentConfig.serviceVersion || '1.0.0',
      });

      // Создаем провайдер
      this.provider = new WebTracerProvider({
        resource: resource,
      });

      // Создаем экспортер (только если указан endpoint)
      if (currentConfig.endpoint) {
        const exporter = new OTLPTraceExporter({
          url: currentConfig.endpoint,
          headers: currentConfig.headers || {},
        });

        // Добавляем процессор
        this.provider.addSpanProcessor(new BatchSpanProcessor(exporter));
      }

      // Регистрируем провайдер
      this.provider.register();

      // Получаем трейсер
      this.tracer = trace.getTracer(
        currentConfig.serviceName || 'unknown-service',
        currentConfig.serviceVersion || '1.0.0'
      );

      // Автоинструментация (если включена)
      if (currentConfig.enableAutoInstrumentation) {
        registerInstrumentations({
          instrumentations: [getWebAutoInstrumentations()],
        });
      }

      this.initialized = true;

      if (currentConfig.debug) {
        console.log('OTLP initialized successfully', {
          serviceName: currentConfig.serviceName,
          endpoint: currentConfig.endpoint,
          autoInstrumentation: currentConfig.enableAutoInstrumentation
        });
      }

    } catch (error: unknown) {
      console.error('Failed to initialize OTLP:', error);
      // Не бросаем ошибку, чтобы приложение продолжало работать
      this.initialized = false;
    }
  }

  public async createSpan(name: string, options?: {
    kind?: SpanKind;
    attributes?: Record<string, any>;
    parentContext?: any;
  }) {
    if (!this.initialized || !this.tracer) {
      await this.initialize();
    }

    if (!this.tracer) {
      // Возвращаем mock объект для graceful degradation
      return {
        span: null,
        addAttribute: (): void => {},
        addEvent: (): void => {},
        setStatus: (): void => {},
        end: (): void => {}
      };
    }

    const span = this.tracer.startSpan(name, {
      kind: options?.kind || SpanKind.INTERNAL,
      attributes: options?.attributes,
    }, options?.parentContext || context.active());

    return {
      span,
      addAttribute: (key: string, value: any): void => {
        try {
          span.setAttributes({ [key]: value });
        } catch (error: unknown) {
          console.warn('Failed to add attribute:', error);
        }
      },
      addEvent: (eventName: string, attributes?: Record<string, any>): void => {
        try {
          span.addEvent(eventName, attributes);
        } catch (error: unknown) {
          console.warn('Failed to add event:', error);
        }
      },
      setStatus: (success: boolean, message?: string): void => {
        try {
          span.setStatus({
            code: success ? SpanStatusCode.OK : SpanStatusCode.ERROR,
            message: message
          });
        } catch (error: unknown) {
          console.warn('Failed to set status:', error);
        }
      },
      end: (): void => {
        try {
          span.end();
        } catch (error: unknown) {
          console.warn('Failed to end span:', error);
        }
      }
    };
  }

  public async shutdown(): Promise<void> {
    if (this.provider) {
      try {
        await this.provider.shutdown();
      } catch (error: unknown) {
        console.warn('Failed to shutdown OTLP provider:', error);
      }
      this.initialized = false;
    }
  }

  public isInitialized(): boolean {
    return this.initialized;
  }
}

// Синглтон экземпляр
let coreInstance: OTLPCore | null = null;

export function getOTLPCore(): OTLPCore {
  if (!coreInstance) {
    coreInstance = new OTLPCore();
  }
  return coreInstance;
}