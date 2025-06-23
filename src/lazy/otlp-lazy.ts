import {ConfigManager, type OTLPConfig} from '../config.js';

export class OTLPLazy {
  private configManager: ConfigManager;
  private initialized = false;
  private currentSpan: any = null;
  private tracer: any = null;
  private autoInstrumentationEnabled = false;

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
    if (this.initialized) return;

    const config = this.configManager.getConfig();
    if (!config.enabled) return;

    try {
      // ✅ Динамический импорт OpenTelemetry модулей
      const { trace } = await import('@opentelemetry/api');
      const { WebTracerProvider } = await import('@opentelemetry/sdk-trace-web');
      const { Resource } = await import('@opentelemetry/resources');
      const { SemanticResourceAttributes } = await import('@opentelemetry/semantic-conventions');
      const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-http');
      const { BatchSpanProcessor } = await import('@opentelemetry/sdk-trace-web');

      // Создание провайдера
      const provider = new WebTracerProvider({
        resource: new Resource({
          [SemanticResourceAttributes.SERVICE_NAME]: config.serviceName || 'lazy-otlp-service',
          [SemanticResourceAttributes.SERVICE_VERSION]: config.serviceVersion || '1.0.0',
        }),
      });

      // Настройка экспортера
      if (config.endpoint) {
        const exporter = new OTLPTraceExporter({
          url: config.endpoint,
          headers: config.headers || {},
        });
        provider.addSpanProcessor(new BatchSpanProcessor(exporter));
      }

      // Регистрация провайдера
      provider.register();

      // Получение трейсера
      this.tracer = trace.getTracer(
        config.serviceName || 'lazy-otlp-service',
        config.serviceVersion || '1.0.0'
      );

      this.initialized = true;

      // ✅ ДОБАВЛЯЕМ: Включаем автоинструментацию после инициализации
      if (config.enableAutoInstrumentation && !this.autoInstrumentationEnabled) {
        this.setupAutoInstrumentation();
      }

      if (config.debug) {
        console.log('OTLP Lazy initialized successfully', {
          serviceName: config.serviceName,
          endpoint: config.endpoint,
          autoInstrumentation: config.enableAutoInstrumentation
        });
      }
    } catch (error) {
      if (config.debug) {
        console.error('Failed to initialize OTLP:', error);
      }
    }
  }

  // ✅ НОВЫЙ МЕТОД: Настройка автоинструментации
  private setupAutoInstrumentation(): void {
    if (this.autoInstrumentationEnabled) return;

    const config = this.configManager.getConfig();

    // 1. Глобальный обработчик необработанных ошибок
    if (typeof window !== 'undefined') {
      // Браузер
      window.addEventListener('error', (event) => {
        this.handleGlobalError('window.error', event.error || event.message, {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        });
      });

      window.addEventListener('unhandledrejection', (event) => {
        this.handleGlobalError('unhandledrejection', event.reason, {
          type: 'promise_rejection'
        });
      });
    } else if (typeof process !== 'undefined') {
      // Node.js
      process.on('uncaughtException', (error) => {
        this.handleGlobalError('uncaughtException', error);
      });

      process.on('unhandledRejection', (reason, promise) => {
        this.handleGlobalError('unhandledRejection', reason, {
          promise: promise.toString()
        });
      });
    }

    // 2. Инструментация fetch API
    this.instrumentFetch();

    // 3. Инструментация XMLHttpRequest
    this.instrumentXHR();

    // 4. Инструментация console.error
    this.instrumentConsole();

    this.autoInstrumentationEnabled = true;

    if (config.debug) {
      console.log('Auto-instrumentation enabled');
    }
  }

  // ✅ Обработка глобальных ошибок
  private async handleGlobalError(type: string, error: any, metadata: Record<string, any> = {}): Promise<void> {
    const config = this.configManager.getConfig();

    // Если traceOnErrorOnly=true, то глобальные ошибки всегда трейсятся
    // Если traceOnErrorOnly=false, то трейсятся при enabled=true
    if (!config.enabled && config.traceOnErrorOnly) {
      // Временно включаем трейсинг для ошибки
      this.configManager.setConfig({ enabled: true });
    }

    await this.ensureInitialized();

    if (this.tracer) {
      const span = this.tracer.startSpan(`error.${type}`, {
        attributes: {
          'error.type': type,
          'error.message': error?.message || String(error),
          'error.stack': error?.stack,
          'error.name': error?.name,
          ...metadata
        }
      });

      span.setStatus({ code: 2, message: error?.message || String(error) });
      span.end();

      if (config.debug) {
        console.log(`Traced global error: ${type}`, error);
      }
    }
  }

  // ✅ Инструментация fetch
  private instrumentFetch(): void {
    if (typeof window === 'undefined' || !window.fetch) return;

    const originalFetch = window.fetch;
    const self = this;

    window.fetch = async function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method || 'GET';

      const startTime = Date.now();
      let response: Response;
      let error: Error | null = null;

      try {
        response = await originalFetch(input, init);

        // Трейсим ошибки HTTP (4xx, 5xx)
        if (!response.ok) {
          await self.traceHttpError(method, url, response.status, Date.now() - startTime);
        }

        return response;
      } catch (err) {
        error = err as Error;
        await self.traceHttpError(method, url, 0, Date.now() - startTime, error);
        throw err;
      }
    };
  }

  // ✅ Инструментация XMLHttpRequest (самая безопасная версия)
  private instrumentXHR(): void {
    if (typeof window === 'undefined' || !window.XMLHttpRequest) return;

    const OriginalXHR = window.XMLHttpRequest;
    const self = this;

    // ✅ Создаем новый конструктор XMLHttpRequest
    function InstrumentedXHR(this: XMLHttpRequest) {
      const xhr = new OriginalXHR();
      let requestMethod = '';
      let requestUrl = '';
      let requestStartTime = 0;

      // Сохраняем оригинальные методы
      const originalOpen = xhr.open.bind(xhr);
      const originalSend = xhr.send.bind(xhr);

      // ✅ Переопределяем open с правильной типизацией
      xhr.open = function(
        method: string,
        url: string | URL,
        async: boolean = true,
        username?: string | null,
        password?: string | null
      ) {
        requestMethod = method;
        requestUrl = url.toString();
        requestStartTime = Date.now();

        // Вызываем оригинальный метод с переданными аргументами
        if (username !== undefined && password !== undefined) {
          return originalOpen(method, url, async, username, password);
        } else if (username !== undefined) {
          return originalOpen(method, url, async, username);
        } else if (async !== undefined) {
          return originalOpen(method, url, async);
        } else {
          return originalOpen(method, url);
        }
      };

      // ✅ Переопределяем send
      xhr.send = function(body?: Document | XMLHttpRequestBodyInit | null) {
        // Добавляем обработчики событий
        xhr.addEventListener('loadend', () => {
          const duration = Date.now() - requestStartTime;
          if (xhr.status >= 400) {
            self.traceHttpError(requestMethod, requestUrl, xhr.status, duration);
          }
        });

        xhr.addEventListener('error', () => {
          const duration = Date.now() - requestStartTime;
          self.traceHttpError(requestMethod, requestUrl, 0, duration, new Error('Network error'));
        });

        return originalSend(body);
      };

      return xhr;
    }

    // ✅ Копируем статические свойства
    Object.setPrototypeOf(InstrumentedXHR.prototype, OriginalXHR.prototype);
    Object.setPrototypeOf(InstrumentedXHR, OriginalXHR);

    // Копируем константы
    InstrumentedXHR.UNSENT = OriginalXHR.UNSENT;
    InstrumentedXHR.OPENED = OriginalXHR.OPENED;
    InstrumentedXHR.HEADERS_RECEIVED = OriginalXHR.HEADERS_RECEIVED;
    InstrumentedXHR.LOADING = OriginalXHR.LOADING;
    InstrumentedXHR.DONE = OriginalXHR.DONE;

    // ✅ Заменяем глобальный XMLHttpRequest
    window.XMLHttpRequest = InstrumentedXHR as any;
  }

  // ✅ Инструментация console.error
  private instrumentConsole(): void {
    if (typeof console === 'undefined') return;

    const originalError = console.error;
    const self = this;

    console.error = function(...args: any[]) {
      // Вызываем оригинальный console.error
      originalError.apply(console, args);

      // Трейсим ошибку
      const message = args.map(arg =>
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');

      self.handleGlobalError('console.error', new Error(message), {
        arguments: args.length
      });
    };
  }

  // ✅ Трейсинг HTTP ошибок
  private async traceHttpError(method: string, url: string, status: number, duration: number, error?: Error): Promise<void> {
    await this.ensureInitialized();

    if (this.tracer) {
      const span = this.tracer.startSpan(`http.${method.toLowerCase()}`, {
        attributes: {
          'http.method': method,
          'http.url': url,
          'http.status_code': status,
          'http.duration_ms': duration,
          'error.message': error?.message,
          'error.stack': error?.stack
        }
      });

      span.setStatus({
        code: 2,
        message: error?.message || `HTTP ${status}`
      });
      span.end();
    }
  }
}