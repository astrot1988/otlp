import { lazyTrace, lazyTraceOnError } from '../decorators/lazy-decorators.js';
import { ConfigManager } from '../config.js';
import type { LazyTraceable } from '../decorators/types.js';

// Простой тест-фреймворк
class TestRunner {
  private tests: Array<{ name: string; fn: () => Promise<void> }> = [];
  private passed = 0;
  private failed = 0;

  test(name: string, fn: () => Promise<void>) {
    this.tests.push({ name, fn });
  }

  async run() {
    console.log(`\n🧪 Running ${this.tests.length} decorator tests...\n`);

    for (const test of this.tests) {
      try {
        await test.fn();
        console.log(`✅ ${test.name}`);
        this.passed++;
      } catch (error: any) {
        console.log(`❌ ${test.name}`);
        console.log(`   Error: ${error.message}`);
        this.failed++;
      }
    }

    console.log(`\n📊 Decorator Results: ${this.passed} passed, ${this.failed} failed\n`);

    if (this.failed > 0) {
      process.exit(1);
    }
  }
}

// Базовый тестовый сервис без декораторов
class TestService implements LazyTraceable {
  _lazyTracer?: any;
  _errorTracer?: any;

  shouldTrace(): boolean {
    return true;
  }

  async testMethod(value: string): Promise<string> {
    await new Promise(resolve => setTimeout(resolve, 10));
    return `processed: ${value}`;
  }

  async testTimeout(): Promise<string> {
    await new Promise(resolve => setTimeout(resolve, 100));
    return 'should timeout';
  }

  async errorMethod(): Promise<string> {
    throw new Error('Test error');
  }

  async conditionalError(shouldFilter: boolean): Promise<string> {
    throw new Error(shouldFilter ? 'filtered error' : 'normal error');
  }
}

const runner = new TestRunner();

// Настройка перед тестами
const configManager = ConfigManager.getInstance();
process.env.ENABLE_TRACING = 'true';
configManager.setConfig({
  enabled: true,
  serviceName: 'test-service',
  debug: true
});

// Тесты lazyTrace
runner.test('lazyTrace should execute method successfully', async () => {
  const service = new TestService();

  // Применяем декоратор программно
  const decorator = lazyTrace('test-method');
  const descriptor = {
    value: service.testMethod,
    writable: true,
    enumerable: true,
    configurable: true
  };

  decorator(TestService.prototype, 'testMethod', descriptor);
  service.testMethod = descriptor.value;

  const result = await service.testMethod('test');

  if (result !== 'processed: test') {
    throw new Error(`Expected 'processed: test', got '${result}'`);
  }
});

runner.test('lazyTrace should create tracer on first use', async () => {
  const service = new TestService();

  // Применяем декоратор программно
  const decorator = lazyTrace('test-method');
  const descriptor = {
    value: service.testMethod,
    writable: true,
    enumerable: true,
    configurable: true
  };

  decorator(TestService.prototype, 'testMethod', descriptor);
  service.testMethod = descriptor.value;

  if (service._lazyTracer !== undefined) {
    throw new Error('Tracer should be undefined initially');
  }

  await service.testMethod('test');

  if (service._lazyTracer === undefined) {
    throw new Error('Tracer should be defined after first use');
  }
});

runner.test('lazyTrace should handle timeout', async () => {
  const service = new TestService();

  // Применяем декоратор с таймаутом
  const decorator = lazyTrace('test-timeout', { timeout: 50 });
  const descriptor = {
    value: service.testTimeout,
    writable: true,
    enumerable: true,
    configurable: true
  };

  decorator(TestService.prototype, 'testTimeout', descriptor);
  service.testTimeout = descriptor.value;

  let errorThrown = false;

  try {
    await service.testTimeout();
  } catch (error: any) {
    errorThrown = true;
    if (!error.message.includes('timed out')) {
      throw new Error(`Expected timeout error, got: ${error.message}`);
    }
  }

  if (!errorThrown) {
    throw new Error('Timeout error should have been thrown');
  }
});

// Тесты lazyTraceOnError
runner.test('lazyTraceOnError should create tracer on error', async () => {
  const service = new TestService();

  // Применяем декоратор программно
  const decorator = lazyTraceOnError('error-method');
  const descriptor = {
    value: service.errorMethod,
    writable: true,
    enumerable: true,
    configurable: true
  };

  decorator(TestService.prototype, 'errorMethod', descriptor);
  service.errorMethod = descriptor.value;

  if (service._errorTracer !== undefined) {
    throw new Error('Error tracer should be undefined initially');
  }

  try {
    await service.errorMethod();
  } catch (error) {
    // Ожидаем ошибку
  }

  if (service._errorTracer === undefined) {
    throw new Error('Error tracer should be defined after error');
  }
});

runner.test('lazyTraceOnError should respect error filter', async () => {
  const service1 = new TestService();
  const service2 = new TestService();

  // Декоратор с фильтром
  const decorator1 = lazyTraceOnError('conditional-error', {
    errorFilter: (error: Error) => error.message.includes('filtered')
  });

  const descriptor1 = {
    value: service1.conditionalError,
    writable: true,
    enumerable: true,
    configurable: true
  };

  decorator1(TestService.prototype, 'conditionalError', descriptor1);
  service1.conditionalError = descriptor1.value;

  // Тест с фильтром (должен создать трейсер)
  try {
    await service1.conditionalError(true);
  } catch (error) {
    // Ожидаем ошибку
  }

  if (service1._errorTracer === undefined) {
    throw new Error('Error tracer should be created for filtered error');
  }

  // Декоратор с фильтром для второго сервиса
  const descriptor2 = {
    value: service2.conditionalError,
    writable: true,
    enumerable: true,
    configurable: true
  };

  decorator1(TestService.prototype, 'conditionalError', descriptor2);
  service2.conditionalError = descriptor2.value;

  // Тест без фильтра (не должен создать трейсер)
  try {
    await service2.conditionalError(false);
  } catch (error) {
    // Ожидаем ошибку
  }

  if (service2._errorTracer !== undefined) {
    throw new Error('Error tracer should not be created for non-filtered error');
  }
});

runner.test('decorators should not create tracer when disabled', async () => {
  configManager.setConfig({ enabled: false });

  const service = new TestService();

  // Применяем декоратор программно
  const decorator = lazyTrace('test-method');
  const descriptor = {
    value: service.testMethod,
    writable: true,
    enumerable: true,
    configurable: true
  };

  decorator(TestService.prototype, 'testMethod', descriptor);
  service.testMethod = descriptor.value;

  const result = await service.testMethod('test');

  if (result !== 'processed: test') {
    throw new Error('Method should still execute when tracing disabled');
  }

  if (service._lazyTracer !== undefined) {
    throw new Error('Tracer should not be created when disabled');
  }

  // Восстанавливаем настройки
  configManager.setConfig({ enabled: true });
});

runner.test('decorator should throw error for non-methods', async () => {
  let errorThrown = false;

  try {
    const decorator = lazyTrace('test');
    const invalidDescriptor = {
      value: 'not a function',
      writable: true,
      enumerable: true,
      configurable: true
    };

    decorator({}, 'property', invalidDescriptor);
  } catch (error: any) {
    errorThrown = true;
    if (!error.message.includes('can only be applied to methods')) {
      throw new Error(`Expected decorator error, got: ${error.message}`);
    }
  }

  if (!errorThrown) {
    throw new Error('Decorator should throw error for non-methods');
  }
});

// Запуск тестов
runner.run().catch(console.error);
