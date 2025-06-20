import { initializeOTLP, withTrace } from '../index.js';
import { ConfigManager } from '../config.js';

// Простой тест-фреймворк
class TestRunner {
  private tests: Array<{ name: string; fn: () => Promise<void> }> = [];
  private passed = 0;
  private failed = 0;

  test(name: string, fn: () => Promise<void>) {
    this.tests.push({ name, fn });
  }

  async run() {
    console.log(`\n🧪 Running ${this.tests.length} integration tests...\n`);

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

    console.log(`\n📊 Integration Results: ${this.passed} passed, ${this.failed} failed\n`);

    if (this.failed > 0) {
      process.exit(1);
    }
  }
}

const runner = new TestRunner();

// Интеграционные тесты
runner.test('Full initialization and tracing workflow', async () => {
  const { configManager, withTrace: wt } = await initializeOTLP({
    enabled: true,
    serviceName: 'integration-test',
    serviceVersion: '1.0.0',
    debug: true
  });

  const config = configManager.getConfig();
  if (config.serviceName !== 'integration-test') {
    throw new Error('Service not configured correctly');
  }

  // Тест трейсинга
  const result = await wt('integration-span', async () => {
    await new Promise(resolve => setTimeout(resolve, 10));
    return 'integration-result';
  });

  if (result !== 'integration-result') {
    throw new Error('Tracing workflow failed');
  }
});

runner.test('Multiple spans workflow', async () => {
  await initializeOTLP({
    enabled: true,
    serviceName: 'multi-span-test',
    debug: true
  });

  const results = [];

  // Первый спан
  const result1 = await withTrace('span-1', async () => {
    await new Promise(resolve => setTimeout(resolve, 5));
    return 'result-1';
  });
  results.push(result1);

  // Второй спан
  const result2 = await withTrace('span-2', async () => {
    await new Promise(resolve => setTimeout(resolve, 5));
    return 'result-2';
  });
  results.push(result2);

  if (results.length !== 2 || results[0] !== 'result-1' || results[1] !== 'result-2') {
    throw new Error('Multiple spans workflow failed');
  }
});

runner.test('Error handling in tracing workflow', async () => {
  await initializeOTLP({
    enabled: true,
    serviceName: 'error-test',
    debug: true
  });

  let errorCaught = false;

  try {
    await withTrace('error-span', async () => {
      throw new Error('Integration test error');
    });
  } catch (error: any) {
    errorCaught = true;
    if (error.message !== 'Integration test error') {
      throw new Error('Wrong error propagated');
    }
  }

  if (!errorCaught) {
    throw new Error('Error should have been caught');
  }
});

runner.test('Disabled tracing integration', async () => {
  await initializeOTLP({
    enabled: false,
    serviceName: 'disabled-test',
    debug: true
  });

  let functionExecuted = false;

  const result = await withTrace('disabled-span', async () => {
    functionExecuted = true;
    return 'disabled-result';
  });

  if (!functionExecuted || result !== 'disabled-result') {
    throw new Error('Function should execute even when tracing is disabled');
  }
});

runner.test('Configuration persistence', async () => {
  const configManager1 = ConfigManager.getInstance();
  configManager1.setConfig({
    enabled: true,
    serviceName: 'persistence-test',
    serviceVersion: '2.0.0'
  });

  const configManager2 = ConfigManager.getInstance();
  const currentConfig = configManager2.getConfig();

  if (currentConfig.serviceName !== 'persistence-test' || currentConfig.serviceVersion !== '2.0.0') {
    throw new Error('Configuration not persisted correctly');
  }
});

runner.test('Environment variables integration', async () => {
  // Сохраняем текущие значения
  const originalEnabled = process.env.OTLP_ENABLED;
  const originalServiceName = process.env.OTLP_SERVICE_NAME;

  try {
    // Устанавливаем переменные окружения
    process.env.OTLP_ENABLED = 'true';
    process.env.OTLP_SERVICE_NAME = 'env-integration-test';

    await initializeOTLP({
      enabled: process.env.OTLP_ENABLED === 'true',
      serviceName: process.env.OTLP_SERVICE_NAME,
      debug: true
    });

    const configManager = ConfigManager.getInstance();
    const config = configManager.getConfig();

    if (!config.enabled || config.serviceName !== 'env-integration-test') {
      throw new Error('Environment variables not integrated correctly');
    }

  } finally {
    // Восстанавливаем переменные окружения
    if (originalEnabled !== undefined) {
      process.env.OTLP_ENABLED = originalEnabled;
    } else {
      delete process.env.OTLP_ENABLED;
    }

    if (originalServiceName !== undefined) {
      process.env.OTLP_SERVICE_NAME = originalServiceName;
    } else {
      delete process.env.OTLP_SERVICE_NAME;
    }
  }
});

// Запуск тестов
runner.run().catch(console.error);
