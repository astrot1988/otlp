import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { lazyTrace, LazyTraceable, type LazyTraceOptions } from '../../src/decorators/lazy-trace.js';
import { OTLPLazy } from '../../src/lazy/otlp-lazy.js';

// Мокаем OTLPLazy
vi.mock('../../src/lazy/otlp-lazy.js', () => ({
  OTLPLazy: vi.fn().mockImplementation(() => ({
    startSpan: vi.fn(),
    endSpan: vi.fn(),
    addEvent: vi.fn(),
    configure: vi.fn(),
    getConfig: vi.fn(() => ({ enabled: true })),
    isEnabled: vi.fn(() => true),
    isInitialized: vi.fn(() => true)
  }))
}));

describe('lazyTrace decorator', () => {
  let mockOTLPLazy: any;
  let TestClass: any;
  let consoleSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    mockOTLPLazy = {
      startSpan: vi.fn(),
      endSpan: vi.fn(),
      addEvent: vi.fn(),
      configure: vi.fn(),
      getConfig: vi.fn(() => ({ enabled: true })),
      isEnabled: vi.fn(() => true),
      isInitialized: vi.fn(() => true)
    };

    (OTLPLazy as Mock).mockImplementation(() => mockOTLPLazy);

    // Создаем тестовый класс для каждого теста
    TestClass = class TestService {
      _lazyTracer?: OTLPLazy;

      @lazyTrace('test.method')
      async testMethod(value: string): Promise<string> {
        return `processed: ${value}`;
      }

      @lazyTrace('test.error')
      async errorMethod(): Promise<void> {
        throw new Error('Test error');
      }

      shouldTrace(): boolean {
        return true;
      }
    };
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it('should create tracer on first method call', async () => {
    const instance = new TestClass();

    await instance.testMethod('test');

    expect(OTLPLazy).toHaveBeenCalledTimes(1);
    expect(instance._lazyTracer).toBeDefined();
  });

  it('should start and end span successfully', async () => {
    const instance = new TestClass();

    const result = await instance.testMethod('test');

    expect(mockOTLPLazy.startSpan).toHaveBeenCalledWith('test.method', {
      attributes: {
        'method.name': 'testMethod',
        'class.name': 'TestService'
      }
    });
    expect(mockOTLPLazy.endSpan).toHaveBeenCalledWith(true);
    expect(result).toBe('processed: test');
  });

  it('should handle method errors correctly', async () => {
    const instance = new TestClass();

    await expect(instance.errorMethod()).rejects.toThrow('Test error');

    expect(mockOTLPLazy.startSpan).toHaveBeenCalled();
    expect(mockOTLPLazy.addEvent).toHaveBeenCalledWith('method.error', {
      'error.name': 'Error',
      'error.message': 'Test error'
    });
    expect(mockOTLPLazy.endSpan).toHaveBeenCalledWith(false, 'Test error');
  });

  it('should reuse existing tracer', async () => {
    const instance = new TestClass();

    await instance.testMethod('first');
    await instance.testMethod('first');
    await instance.testMethod('second');

    expect(OTLPLazy).toHaveBeenCalledTimes(1); // Трейсер создается только один раз
    expect(mockOTLPLazy.startSpan).toHaveBeenCalledTimes(2); // Но span'ы создаются для каждого вызова
  });

  it('should not create tracer when shouldTrace returns false', async () => {
    class NoTraceService {
      _lazyTracer?: OTLPLazy;

      @lazyTrace('test.method')
      async testMethod(): Promise<string> {
        return 'no trace';
      }

      shouldTrace(): boolean {
        return false;
      }
    }

    const instance = new NoTraceService();
    const result = await instance.testMethod();

    expect(result).toBe('no trace');
    expect(OTLPLazy).not.toHaveBeenCalled();
    expect(instance._lazyTracer).toBeUndefined();
  });

  it('should include method arguments when includeArgs is true', async () => {
    class ArgsTestService {
      _lazyTracer?: OTLPLazy;

      @lazyTrace('test.with-args', { includeArgs: true })
      async methodWithArgs(str: string, num: number, bool: boolean): Promise<string> {
        return `${str}-${num}-${bool}`;
      }

      shouldTrace(): boolean {
        return true;
      }
    }

    const instance = new ArgsTestService();
    await instance.methodWithArgs('test', 42, true);

    expect(mockOTLPLazy.startSpan).toHaveBeenCalledWith('test.with-args', {
      attributes: {
        'method.name': 'methodWithArgs',
        'class.name': 'ArgsTestService',
        'method.args.count': 3,
        'method.args.0.type': 'string',
        'method.args.0.value': 'test',
        'method.args.1.type': 'number',
        'method.args.1.value': '42',
        'method.args.2.type': 'boolean',
        'method.args.2.value': 'true'
      }
    });
  });

  it('should include result when includeResult is true', async () => {
    class ResultTestService {
      _lazyTracer?: OTLPLazy;

      @lazyTrace('test.with-result', { includeResult: true })
      async methodWithResult(): Promise<{ data: string; count: number }> {
        return { data: 'test', count: 5 };
      }

      shouldTrace(): boolean {
        return true;
      }
    }

    const instance = new ResultTestService();
    await instance.methodWithResult();

    expect(mockOTLPLazy.addEvent).toHaveBeenCalledWith('method.completed', {
      'result.type': 'object',
      'result.hasValue': true
    });
  });

  it('should handle custom attributes', async () => {
    class CustomAttrsService {
      _lazyTracer?: OTLPLazy;

      @lazyTrace('test.custom', {
        attributes: {
          'custom.attr': 'value',
          'custom.number': 123
        }
      })
      async customMethod(): Promise<void> {}

      shouldTrace(): boolean {
        return true;
      }
    }

    const instance = new CustomAttrsService();
    await instance.customMethod();

    expect(mockOTLPLazy.startSpan).toHaveBeenCalledWith('test.custom', {
      attributes: {
        'method.name': 'customMethod',
        'class.name': 'CustomAttrsService',
        'custom.attr': 'value',
        'custom.number': 123
      }
    });
  });

  it('should handle tracer creation failure gracefully', async () => {
    (OTLPLazy as Mock).mockImplementation(() => {
      throw new Error('Tracer creation failed');
    });

    const instance = new TestClass();
    const result = await instance.testMethod('test');

    expect(result).toBe('processed: test');
    expect(consoleSpy).toHaveBeenCalledWith('Failed to initialize tracer:', expect.any(Error));
    expect(instance._lazyTracer).toBeUndefined();
  });

  it('should handle span start failure gracefully', async () => {
    mockOTLPLazy.startSpan.mockImplementation(() => {
      throw new Error('Span start failed');
    });

    const instance = new TestClass();
    const result = await instance.testMethod('test');

    expect(result).toBe('processed: test');
    expect(consoleSpy).toHaveBeenCalledWith('Failed to start span:', expect.any(Error));
  });

  it('should handle span end failure gracefully', async () => {
    mockOTLPLazy.endSpan.mockImplementation(() => {
      throw new Error('Span end failed');
    });

    const instance = new TestClass();
    const result = await instance.testMethod('test');

    expect(result).toBe('processed: test');
    expect(consoleSpy).toHaveBeenCalledWith('Failed to end span:', expect.any(Error));
  });

  it('should work with synchronous methods', async () => {
    class SyncService {
      _lazyTracer?: OTLPLazy;

      @lazyTrace('test.sync')
      syncMethod(value: string): string {
        return `sync: ${value}`;
      }

      shouldTrace(): boolean {
        return true;
      }
    }

    const instance = new SyncService();
    const result = await instance.syncMethod('test'); // Декоратор делает метод асинхронным

    expect(result).toBe('sync: test');
    expect(mockOTLPLazy.startSpan).toHaveBeenCalled();
    expect(mockOTLPLazy.endSpan).toHaveBeenCalledWith(true);
  });
});

describe('LazyTraceable base class', () => {
  let consoleSpy: any;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should provide default shouldTrace implementation', () => {
    class TestService extends LazyTraceable {}

    const instance = new TestService();

    // По умолчанию трейсинг включен только в production
    const originalEnv = process.env.NODE_ENV;

    process.env.NODE_ENV = 'production';
    expect(instance['shouldTrace']()).toBe(true);

    process.env.NODE_ENV = 'development';
    expect(instance['shouldTrace']()).toBe(false);

    process.env.NODE_ENV = originalEnv;
  });

  it('should provide getTracer method', () => {
    class TestService extends LazyTraceable {
      protected shouldTrace(): boolean {
        return true;
      }
    }

    const instance = new TestService();
    const tracer = instance['getTracer']();

    expect(tracer).toBeDefined();
    expect(instance._lazyTracer).toBe(tracer);
  });

  it('should handle tracer creation failure in getTracer', () => {
    (OTLPLazy as Mock).mockImplementation(() => {
      throw new Error('Tracer creation failed');
    });

    class TestService extends LazyTraceable {
      protected shouldTrace(): boolean {
        return true;
      }
    }

    const instance = new TestService();
    const tracer = instance['getTracer']();

    expect(tracer).toBeUndefined();
    expect(consoleSpy).toHaveBeenCalledWith('Failed to create tracer:', expect.any(Error));
  });

  it('should provide configureTracer method', () => {
    class TestService extends LazyTraceable {
      protected shouldTrace(): boolean {
        return true;
      }
    }

    const instance = new TestService();
    const config = { endpoint: 'http://test.com' };

    instance['configureTracer'](config);

    expect(instance._lazyTracer).toBeDefined();
    expect(mockOTLPLazy.configure).toHaveBeenCalledWith(config);
  });

  it('should not configure tracer if it cannot be created', () => {
    (OTLPLazy as Mock).mockImplementation(() => {
      throw new Error('Tracer creation failed');
    });

    class TestService extends LazyTraceable {
      protected shouldTrace(): boolean {
        return true;
      }
    }

    const instance = new TestService();
    const config = { endpoint: 'http://test.com' };

    instance['configureTracer'](config);

    expect(mockOTLPLazy.configure).not.toHaveBeenCalled();
  });
});

