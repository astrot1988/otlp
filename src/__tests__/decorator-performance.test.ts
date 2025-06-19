import { ConfigManager } from '../config.js';
import { Trace } from '../decorators/trace-decorator.js';
import { LazyLoader } from '../lazy/loader.js';

class PerformanceTestService {
  @Trace()
  async lightMethod(): Promise<number> {
    return Math.random();
  }

  async heavyMethodWithoutTrace(): Promise<number> {
    // Имитация тяжелой работы
    let sum = 0;
    for (let i = 0; i < 1000; i++) {
      sum += Math.random();
    }
    return sum;
  }

  @Trace()
  async heavyMethodWithTrace(): Promise<number> {
    // Имитация тяжелой работы
    let sum = 0;
    for (let i = 0; i < 1000; i++) {
      sum += Math.random();
    }
    return sum;
  }
}

async function testDecoratorPerformance() {
  console.log('🧪 Testing Decorator Performance...');

  LazyLoader.reset();
  const config = ConfigManager.getInstance();

  // Test 1: Производительность с отключенной телеметрией
  console.log('Testing performance with disabled telemetry...');
  config.setConfig({ enabled: false, serviceName: 'perf-test' });

  const service = new PerformanceTestService();

  const iterations = 100;

  // Тест без трейсинга
  const startWithout = Date.now();
  for (let i = 0; i < iterations; i++) {
    await service.heavyMethodWithoutTrace();
  }
  const timeWithout = Date.now() - startWithout;

  // Тест с отключенным трейсингом (должен быть почти такой же)
  const startDisabled = Date.now();
  for (let i = 0; i < iterations; i++) {
    await service.heavyMethodWithTrace();
  }
  const timeDisabled = Date.now() - startDisabled;

  const overheadDisabled = ((timeDisabled - timeWithout) / timeWithout) * 100;

  console.log(`Without tracing: ${timeWithout}ms`);
  console.log(`With disabled tracing: ${timeDisabled}ms`);
  console.log(`Overhead when disabled: ${overheadDisabled.toFixed(2)}%`);

  if (overheadDisabled > 5) { // Не более 5% накладных расходов при отключенной телеметрии
    console.warn('⚠️ High overhead when telemetry is disabled');
  } else {
    console.log('✅ Low overhead when telemetry is disabled');
  }

  // Test 2: Производительность с включенной телеметрией
  console.log('Testing performance with enabled telemetry...');
  config.setConfig({
    enabled: true,
    serviceName: 'perf-test',
    endpoint: 'http://localhost:9999/v1/traces'
  });

  const lightIterations = 10; // Меньше итераций для включенной телеметрии

  const startEnabled = Date.now();
  for (let i = 0; i < lightIterations; i++) {
    await service.lightMethod();
  }
  const timeEnabled = Date.now() - startEnabled;

  console.log(`With enabled tracing (${lightIterations} iterations): ${timeEnabled}ms`);
  console.log('✅ Performance test completed (enabled telemetry may be slower due to network attempts)');

  console.log('🎉 All Performance tests completed!\n');
}

// Запуск теста
testDecoratorPerformance().catch(console.error);