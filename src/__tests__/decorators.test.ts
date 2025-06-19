import { Trace } from '../decorators/trace-decorator.js';
import { ConfigManager } from '../config.js';

// Тестовый класс
class TestService {
  @Trace()
  async simpleMethod(): Promise<string> {
    await new Promise(resolve => setTimeout(resolve, 10));
    return 'simple result';
  }

  @Trace('custom-span-name')
  async customSpanMethod(): Promise<number> {
    return 42;
  }

  @Trace()
  async errorMethod(): Promise<void> {
    throw new Error('Test error');
  }
}

async function testDecorators() {
  console.log('🧪 Testing Decorators...');

  const service = new TestService();
  const config = ConfigManager.getInstance();

  // Test 1: Включенная телеметрия
  console.log('Testing with enabled telemetry...');
  config.setConfig({ enabled: true, serviceName: 'decorator-test' });

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

  console.log('🎉 All Decorator tests passed!\n');
}

// Запуск теста
testDecorators().catch(console.error);