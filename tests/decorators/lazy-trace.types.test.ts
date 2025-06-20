import { describe, it, expect } from 'vitest';
import { lazyTrace, LazyTraceable, type LazyTraceOptions, type LazyTraceContext } from '../../src/decorators/lazy-trace.js';

describe('lazyTrace types', () => {
  it('should have correct LazyTraceOptions interface', () => {
    const options: LazyTraceOptions = {
      attributes: {
        'string.attr': 'value',
        'number.attr': 123,
        'boolean.attr': true
      },
      includeArgs: true,
      includeResult: false
    };

    expect(typeof options.attributes).toBe('object');
    expect(typeof options.includeArgs).toBe('boolean');
    expect(typeof options.includeResult).toBe('boolean');
  });

  it('should have correct LazyTraceContext interface', () => {
    class TestContext implements LazyTraceContext {
      _lazyTracer?: any;
      
      shouldTrace?(): boolean {
        return true;
      }
    }

    const context = new TestContext();
    expect(context.shouldTrace?.()).toBe(true);
  });

  it('should work with class inheritance', async () => {
    class BaseService extends LazyTraceable {
      @lazyTrace('base.method')
      async baseMethod(): Promise<string> {
        return 'base';
      }
    }

    class DerivedService extends BaseService {
      @lazyTrace('derived.method')
      async derivedMethod(): Promise<string> {
        const base = await this.baseMethod();
        return `derived-${base}`;
      }

      protected shouldTrace(): boolean {
        return false; // Отключаем для теста
      }
    }

    const service = new DerivedService();
    const result = await service.derivedMethod();
    
    expect(result).toBe('derived-base');
  });

  it('should work with generic methods', async () => {
    class GenericService extends LazyTraceable {
      @lazyTrace('generic.method')
      async processData<T>(data: T): Promise<T> {
        return data;
      }

      protected shouldTrace(): boolean {
        return false;
      }
    }

    const service = new GenericService();
    
    const stringResult = await service.processData('test');
    expect(stringResult).toBe('test');
    
    const numberResult = await service.processData(42);
    expect(numberResult).toBe(42);
    
    const objectResult = await service.processData({ key: 'value' });
    expect(objectResult).toEqual({ key: 'value' });
  });

  it('should preserve method signatures', async () => {
    class SignatureService extends LazyTraceable {
      @lazyTrace('signature.method')
      async complexMethod(
        required: string,
        optional?: number,
        defaultValue: boolean = true,
        ...rest: string[]
      ): Promise<{
        required: string;
        optional?: number;
        defaultValue: boolean;
        rest: string[];
      }> {
        return {
          required,
          optional,
          defaultValue,
          rest
        };
      }

      protected shouldTrace(): boolean {
        return false;
      }
    }

    const service = new SignatureService();
    
    const result1 = await service.complexMethod('test');
    expect(result1).toEqual({
      required: 'test',
      optional: undefined,
      defaultValue: true,
      rest: []
    });

    const result2 = await service.complexMethod('test', 42, false, 'a', 'b', 'c');
    expect(result2).toEqual({
      required: 'test',
      optional: 42,
      defaultValue: false,
      rest: ['a', 'b', 'c']
    });
  });
});