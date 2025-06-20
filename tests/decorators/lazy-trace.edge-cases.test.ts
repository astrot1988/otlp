import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { lazyTrace } from '../../src/decorators/lazy-trace.js';
import { OTLPLazy } from '../../src/lazy/otlp-lazy.js';

vi.mock('../../src/lazy/otlp-lazy.js');

describe('lazyTrace edge cases', () => {
  let mockOTLPLazy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockOTLPLazy = {
      startSpan: vi.fn(),
      endSpan: vi.fn(),
      addEvent: vi.fn()
    };
    (OTLPLazy as Mock).mockImplementation(() => mockOTLPLazy);
  });

  it('should handle methods that return undefined', async () => {
    class TestService {
      @lazyTrace('test.void', { includeResult: true })
      async voidMethod(): Promise<void> {
        // Ничего не возвращает
      }

      shouldTrace(): boolean { return true; }
    }

    const service = new TestService();
    const result = await service.voidMethod();
    
    expect(result).toBeUndefined();
    expect(mockOTLPLazy.addEvent).toHaveBeenCalledWith('method.completed', {
      'result.type': 'undefined',
      'result.hasValue': false
    });
  });

  it('should handle methods with complex object arguments', async () => {
    class TestService {
      @lazyTrace('test.complex', { includeArgs: true })
      async complexMethod(
        obj: { nested: { value: string } },
        arr: number[],
        func: () => void
      ): Promise<void> {}

      shouldTrace(): boolean { return true; }
    }

    const service = new TestService();
    const complexObj = { nested: { value: 'test' } };
    const array = [1, 2, 3];
    const func = () => {};

    await service.complexMethod(complexObj, array, func);
    
    expect(mockOTLPLazy.startSpan).toHaveBeenCalledWith('test.complex', {
      attributes: {
        'method.name': 'complexMethod',
        'class.name': 'TestService',
        'method.args.count': 3,
        'method.args.0.type': 'object',
        'method.args.1.type': 'object',
        'method.args.2.type': 'function'
      }
    });
  });

  it('should handle synchronous methods', async () => {
    class TestService {
      @lazyTrace('test.sync')
      syncMethod(value: string): string {
        return `sync: ${value}`;
      }

      shouldTrace(): boolean { return true; }
    }

    const service = new TestService();
    
    // Декоратор делает метод асинхронным
    const result = await service.syncMethod('test');
    
    expect(result).toBe('sync: test');
    expect(mockOTLPLazy.startSpan).toHaveBeenCalled();
    expect(mockOTLPLazy.endSpan).toHaveBeenCalledWith(true);
  });

  it('should handle methods with no arguments', async () => {
    class TestService {
      @lazyTrace('test.no-args', { includeArgs: true })
      async noArgsMethod(): Promise<string> {
        return 'no args';
      }

      shouldTrace(): boolean { return true; }
    }

    const service = new TestService();
    await service.noArgsMethod();
    
    expect(mockOTLPLazy.startSpan).toHaveBeenCalledWith('test.no-args', {
      attributes: {
        'method.name': 'noArgsMethod',
        'class.name': 'TestService'
      }
    });
  });

  it('should handle tracer initialization failure gracefully', async () => {
    // Мокаем console.warn чтобы не засорять вывод
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    // Мокаем OTLPLazy чтобы он выбрасывал ошибку при создании
    (OTLPLazy as Mock).mockImplementation(() => {
      throw new Error('Tracer initialization failed');
    });

    class TestService {
      @lazyTrace('test.method')
      async testMethod(): Promise<string> {
        return 'success';
      }

      shouldTrace(): boolean { return true; }
    }

    const service = new TestService();
    
    // Метод должен работать даже если трейсер не инициализировался
    const result = await service.testMethod();
    expect(result).toBe('success');
    expect(consoleSpy).toHaveBeenCalledWith('Failed to initialize tracer:', expect.any(Error));
    
    consoleSpy.mockRestore();
  });

  it('should handle span operations that throw errors', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    mockOTLPLazy.startSpan.mockImplementation(() => {
      throw new Error('Span start failed');
    });

    class TestService {
      @lazyTrace('test.method')
      async testMethod(): Promise<string> {
        return 'success';
      }

      shouldTrace(): boolean { return true; }
    }

    const service = new TestService();
    
    // Метод должен работать даже если span операции падают
    const result = await service.testMethod();
    expect(result).toBe('success');
    expect(consoleSpy).toHaveBeenCalledWith('Span operation failed:', expect.any(Error));
    
    consoleSpy.mockRestore();
  });

  it('should handle class inheritance correctly', async () => {
    class BaseService {
      @lazyTrace('base.method')
      async baseMethod(): Promise<string> {
        return 'base';
      }

      shouldTrace(): boolean { return true; }
    }

    class DerivedService extends BaseService {
      @lazyTrace('derived.method')
      async derivedMethod(): Promise<string> {
        const baseResult = await this.baseMethod();
        return `derived + ${baseResult}`;
      }
    }

    const service = new DerivedService();
    const result = await service.derivedMethod();
    
    expect(result).toBe('derived + base');
    expect(mockOTLPLazy.startSpan).toHaveBeenCalledTimes(2);
    expect(mockOTLPLazy.startSpan).toHaveBeenCalledWith('derived.method', expect.any(Object));
    expect(mockOTLPLazy.startSpan).toHaveBeenCalledWith('base.method', expect.any(Object));
  });
});