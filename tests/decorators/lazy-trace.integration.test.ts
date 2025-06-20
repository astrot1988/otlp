import { describe, it, expect, beforeEach, vi } from 'vitest';
import { lazyTrace, LazyTraceable } from '../../src/decorators/lazy-trace.js';
import { ConfigManager } from '../../src/config.js';

describe('lazyTrace integration tests', () => {
  let configManager: ConfigManager;

  beforeEach(() => {
    configManager = ConfigManager.getInstance();
    configManager.setConfig({
      enabled: true,
      serviceName: 'test-service',
      debug: true
    });
  });

  it('should work with real service class', async () => {
    class UserService extends LazyTraceable {
      @lazyTrace('user.get', {
        attributes: {
          'service': 'user-service'
        },
        includeArgs: true
      })
      async getUser(id: string): Promise<{ id: string; name: string }> {
        // Имитация асинхронной операции
        await new Promise(resolve => setTimeout(resolve, 10));
        return { id, name: `User ${id}` };
      }

      @lazyTrace('user.create', {
        includeResult: true
      })
      async createUser(userData: { name: string; email: string }): Promise<{ id: string; name: string; email: string }> {
        await new Promise(resolve => setTimeout(resolve, 5));
        return { id: 'new-id', ...userData };
      }

      protected shouldTrace(): boolean {
        return configManager.getConfig().enabled;
      }
    }

    const userService = new UserService();

    // Тест успешного выполнения
    const user = await userService.getUser('123');
    expect(user).toEqual({ id: '123', name: 'User 123' });

    // Тест создания пользователя
    const newUser = await userService.createUser({ name: 'John', email: 'john@test.com' });
    expect(newUser).toEqual({ id: 'new-id', name: 'John', email: 'john@test.com' });

    // Проверяем, что трейсер был создан
    expect(userService._lazyTracer).toBeDefined();
  });

  it('should handle complex nested operations', async () => {
    class PaymentService extends LazyTraceable {
      @lazyTrace('payment.process')
      async processPayment(amount: number): Promise<{ success: boolean; transactionId: string }> {
        const validated = await this.validatePayment(amount);
        if (!validated) {
          throw new Error('Payment validation failed');
        }

        return await this.chargeCard(amount);
      }

      @lazyTrace('payment.validate')
      async validatePayment(amount: number): Promise<boolean> {
        await new Promise(resolve => setTimeout(resolve, 5));
        return amount > 0 && amount <= 10000;
      }

      @lazyTrace('payment.charge')
      async chargeCard(amount: number): Promise<{ success: boolean; transactionId: string }> {
        await new Promise(resolve => setTimeout(resolve, 10));
        return {
          success: true,
          transactionId: `txn_${Date.now()}`
        };
      }

      protected shouldTrace(): boolean {
        return true;
      }
    }

    const paymentService = new PaymentService();

    // Тест успешного платежа
    const result = await paymentService.processPayment(100);
    expect(result.success).toBe(true);
    expect(result.transactionId).toMatch(/^txn_\d+$/);

    // Тест неудачного платежа
    await expect(paymentService.processPayment(-50)).rejects.toThrow('Payment validation failed');

    // Проверяем, что трейсер создан
    expect(paymentService._lazyTracer).toBeDefined();
  });

  it('should respect configuration changes', async () => {
    class ConfigurableService {
      _lazyTracer?: any;

      @lazyTrace('service.operation')
      async doOperation(): Promise<string> {
        return 'completed';
      }

      shouldTrace(): boolean {
        return configManager.getConfig().enabled;
      }
    }

    // Включаем трейсинг
    configManager.setConfig({ enabled: true });
    const service = new ConfigurableService();
    await service.doOperation();
    expect(service._lazyTracer).toBeDefined();

    // Отключаем трейсинг для нового экземпляра
    configManager.setConfig({ enabled: false });
    const service2 = new ConfigurableService();
    await service2.doOperation();
    expect(service2._lazyTracer).toBeUndefined();
  });
});
