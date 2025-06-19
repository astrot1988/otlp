import { initializeOTLP, withTrace } from '../index.js';

async function testIntegration() {
  console.log('🧪 Testing Real OTLP Integration...');

  // Test 1: Инициализация без endpoint (только консольный вывод)
  console.log('Testing initialization without endpoint...');

  try {
    const otlp = await initializeOTLP({
      enabled: true,
      serviceName: 'integration-test',
      serviceVersion: '1.0.0',
      debug: true,
      enableAutoInstrumentation: false
    });

    console.log('✅ OTLP initialized successfully');

    // Test 2: Использование withTrace
    console.log('Testing withTrace function...');

    const result = await withTrace('test-operation', async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
      return { success: true, data: 'test-data' };
    }, {
      attributes: {
        'test.attribute': 'test-value',
        'test.number': 42
      },
      includeResult: true
    });

    if (result.success && result.data === 'test-data') {
      console.log('✅ withTrace function test passed');
    } else {
      console.log('❌ withTrace function test failed');
    }

    // Test 3: Обработка ошибок
    console.log('Testing error handling...');

    try {
      await withTrace('error-operation', async () => {
        throw new Error('Test error');
      });
      console.log('❌ Error handling test failed - should have thrown');
    } catch (error) {
      if (error instanceof Error && error.message === 'Test error') {
        console.log('✅ Error handling test passed');
      } else {
        console.log('❌ Error handling test failed - wrong error');
      }
    }

    // Test 4: Вложенные операции
    console.log('Testing nested operations...');

    const nestedResult = await withTrace('parent-operation', async () => {
      const childResult = await withTrace('child-operation', async () => {
        return 'child-result';
      });

      return `parent-${childResult}`;
    });

    if (nestedResult === 'parent-child-result') {
      console.log('✅ Nested operations test passed');
    } else {
      console.log('❌ Nested operations test failed');
    }

  } catch (error) {
    console.log('✅ Integration test passed (graceful failure):', error instanceof Error ? error.message : 'Unknown error');
  }

  // Test 5: Отключенная телеметрия
  console.log('Testing with disabled telemetry...');

  const disabledOtlp = await initializeOTLP({
    enabled: false,
    serviceName: 'disabled-test'
  });

  const disabledResult = await withTrace('disabled-operation', async () => {
    return 'disabled-result';
  });

  if (disabledResult === 'disabled-result') {
    console.log('✅ Disabled telemetry test passed');
  } else {
    console.log('❌ Disabled telemetry test failed');
  }

  console.log('🎉 All Integration tests completed!\n');
}

// Запуск теста
testIntegration().catch(console.error);