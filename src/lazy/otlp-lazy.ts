import {ConfigManager, type OTLPConfig} from '../config.js';

export class OTLPLazy {
  private configManager: ConfigManager;
  private initialized = false;
  private currentSpan: any = null;
  private tracer: any = null;

  constructor(config?: Partial<OTLPConfig>) {
    this.configManager = ConfigManager.getInstance();

    // ✅ Поддержка частичной конфигурации в конструкторе
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
  }

  public async endSpan(success: boolean, message?: string): Promise<void> {
    if (this.currentSpan) {
      this.currentSpan.setStatus(success, message);
      this.currentSpan.end();
      this.currentSpan = null;
    }
  }

  public async addAttribute(key: string, value: any): Promise<void> {
    if (this.currentSpan) {
      this.currentSpan.addAttribute(key, value);
    }
  }

  public async addEvent(name: string, attributes?: Record<string, any>): Promise<void> {
    if (this.currentSpan) {
      this.currentSpan.addEvent(name, attributes);
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
      // Здесь должна быть логика инициализации OpenTelemetry
      // Замените на вашу существующую логику инициализации

      this.initialized = true;

      if (config.debug) {
        console.log('OTLP Lazy initialized successfully', {
          serviceName: config.serviceName,
          endpoint: config.endpoint,
          traceOnErrorOnly: config.traceOnErrorOnly,
          enableAutoInstrumentation: config.enableAutoInstrumentation
        });
      }
    } catch (error) {
      if (config.debug) {
        console.error('Failed to initialize OTLP:', error);
      }
    }
  }

}