import { describe, it, expect, beforeEach, vi } from 'vitest';
import { lazyTrace, LazyTraceable } from '../../src/decorators/lazy-trace.js';

describe('lazyTrace performance tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have minimal overhead when tracing is disabled', async () => {
    class PerformanceTestService {
      @lazyTrace('test.method')
      async fastMethod(): Promise<number> {
        return 42;
      }

      shouldTrace(): boolean {
        return false; // Трейсинг отключен
      }
    }

    const service = new PerformanceTestService();
    
    const startTime = performance.now();
    
    // Выполняем много операций
    const promises = Array.from({ length: 1000 }, () => service.fastMethod());
    const results = await Promise.all(promises);
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    expect(results).toHaveLength(1000);
    expect(results.every(r => r === 42)).toBe(true);
    expect(duration).toBeLessThan(100); // Должно быть быстро
  });

  it('should handle concurrent operations correctly', async () => {
    class ConcurrentService extends LazyTraceable {
      private counter = 0;

      @lazyTrace('concurrent.operation')
      async incrementCounter(): Promise<number> {
        const current = this.counter;
        await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
        this.counter = current + 1;
        return this.counter;
      }

      protected shouldTrace(): boolean {
        return true;
      }
    }

    const service = new ConcurrentService();
    
    // Запускаем 50 конкурентных операций
    const promises = Array.from({ length: 50 }, () => service.incrementCounter());
    const results = await Promise.all(promises);
    
    expect(results).toHaveLength(50);
    expect(service._lazyTracer).toBeDefined();
    
    // Проверяем, что все операции завершились
    const maxResult = Math.max(...results);
    expect(maxResult).toBeGreaterThan(0);
  });
});