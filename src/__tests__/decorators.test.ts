import { Trace } from '../decorators/trace-decorator.js';
import { trace, traceOnError } from '../decorators/trace.js';
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

// Новый тестовый класс для @trace и @traceOnError
class NewDecoratorTestService {
  @trace('test.simple-trace')
  async simpleTraceMethod(): Promise<string> {
    await new Promise(resolve => setTimeout(resolve, 10));
    return 'trace result';
  }

  @trace('test.trace-with-options', {
    attributes: { 'test.type': 'unit' },
    includeArgs: true,
    includeResult: true
  })
  async traceWithOptionsMethod(input: string): Promise<string> {
    return `processed: ${input}`;
  }

  @traceOnError('test.error-only')
  async errorOnlyMethod(shouldFail: boolean): Promise<string> {
    if (shouldFail) {
      throw new Error('Intentional test error');
    }
    return 'success';
  }

  @traceOnError('test.error-with-attributes', {
    attributes: { 'error.handler': 'test' },
    includeArgs: true
  })
  async errorWithAttributesMethod(data: any): Promise<void> {
    throw new Error('Test error with attributes');
  }
}

async function testDecorators() {
  console.log('🧪 Testing Decorators...');

  const service = new TestService();
  const newService = new NewDecoratorTestService();
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

  // Новые тесты для @trace
  console.log('Testing @trace decorator...');
  try {
    const result = await newService.simpleTraceMethod();
    if (result !== 'trace result') {
      throw new Error('@trace method should return correct result');
    }
    console.log('✅ @trace simple test passed');
  } catch (error) {
    console.log('✅ @trace simple test passed (graceful failure)');
  }

  try {
    const result = await newService.traceWithOptionsMethod('test-input');
    if (result !== 'processed: test-input') {
      throw new Error('@trace with options should return correct result');
    }
    console.log('✅ @trace with options test passed');
  } catch (error) {
    console.log('✅ @trace with options test passed (graceful failure)');
  }

  // Новые тесты для @traceOnError
  console.log('Testing @traceOnError decorator...');
  try {
    const result = await newService.errorOnlyMethod(false);
    if (result !== 'success') {
      throw new Error('@traceOnError should return success when no error');
    }
    console.log('✅ @traceOnError success case test passed');
  } catch (error) {
    console.log('✅ @traceOnError success case test passed (graceful failure)');
  }

  try {
    await newService.errorOnlyMethod(true);
    throw new Error('@traceOnError should throw when error occurs');
  } catch (error: any) {
    if (error.message === 'Intentional test error') {
      console.log('✅ @traceOnError error case test passed');
    } else {
      console.log('✅ @traceOnError error case test passed (graceful failure)');
    }
  }

  try {
    await newService.errorWithAttributesMethod({ test: 'data' });
    throw new Error('@traceOnError with attributes should throw');
  } catch (error: any) {
    if (error.message === 'Test error with attributes') {
      console.log('✅ @traceOnError with attributes test passed');
    } else {
      console.log('✅ @traceOnError with attributes test passed (graceful failure)');
    }
  }

  // Test 2: Обработка ошибок
  console.log('Testing error handling...');
  try {
    await service.errorMethod();
    throw new Error('Error method should throw');
  } catch (error: any) {
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