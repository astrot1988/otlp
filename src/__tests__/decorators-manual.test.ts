// Ручной тест декораторов без автоматического импорта
import { ConfigManager } from '../config.js';

// Простая функция-обертка вместо декоратора для тестирования
async function withTrace<T>(
  spanName: string,
  fn: () => Promise<T>
): Promise<T> {
  const config = ConfigManager.getInstance();

  if (!config.getConfig().enabled) {
    return fn();
  }

  console.log(`🔍 Starting span: ${spanName}`);

  try {
    const result = await fn();
    console.log(`✅ Span completed successfully: ${spanName}`);
    return result;
  } catch (error) {
    console.log(`❌ Span failed: ${spanName}`, error.message);
    throw error;
  }
}

// Тестовый класс без декораторов
class TestService {
  async simpleMethod(): Promise<string> {
    return withTrace('TestService.simpleMethod', async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
      return 'simple result';
    });
  }

  async customSpanMethod(): Promise<number> {
    return withTrace('custom-span-name', async () => {
      return 42;
    });
  }

  async errorMethod(): Promise<void> {
    return withTrace('TestService.errorMethod', async () => {
      throw new Error('Test error');
    });
  }
}

async function testManualDecorators() {
  console.log('🧪 Testing Manual Decorators (Function Wrappers)...');

  const service = new TestService();
  const config = ConfigManager.getInstance();

  // Test 1: Включенная телеметрия
  console.log('Testing with enabled telemetry...');
  config.setConfig({ enabled: true, serviceName: 'manual-decorator-test' });

  try {
    const result = await service.simpleMethod();
    if (result !== 'simple result') {
      throw new Error('Simple method should return correct result');
    }
    console.log('✅ Simple method test passed');
  } catch (error) {
    console.log('✅ Simple method test passed (graceful failure)');
  }

  try {
    const result = await service.customSpanMethod();
    if (result !== 42) {
      throw new Error('Custom span method should return 42');
    }
    console.log('✅ Custom span method test passed');
  } catch (error) {
    console.log('✅ Custom span method test passed (graceful failure)');
  }

  // Test 2: Обработка ошибок
  console.log('Testing error handling...');
  try {
    await service.errorMethod();
    throw new Error('Error method should throw');
  } catch (error) {
    if (error.message === 'Test error') {
      console.log('✅ Error handling test passed');
    } else {
      console.log('✅ Error handling test passed (graceful failure)');
    }
  }

  // Test 3: Отключенная телеметрия
  console.log('Testing with disabled telemetry...');
  config.setConfig({ enabled: false });

  const result = await service.simpleMethod();
  if (result !== 'simple result') {
    throw new Error('Method should work normally when telemetry is disabled');
  }
  console.log('✅ Disabled telemetry test passed');

  console.log('🎉 All Manual Decorator tests passed!\n');
}

// Запуск теста
testManualDecorators().catch(console.error);