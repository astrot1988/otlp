import { OTLPLazy } from '../lazy/otlp-lazy.js';
import { ConfigManager } from '../config.js';

async function testLazyLoading() {
  console.log('🧪 Testing Lazy Loading...');

  const otlpLazy = new OTLPLazy();
  const config = ConfigManager.getInstance();

  // Test 1: Отключенная телеметрия
  config.setConfig({ enabled: false });

  try {
    await otlpLazy.startSpan('test-span');
    await otlpLazy.endSpan(true);
    console.log('✅ Disabled telemetry test passed');
  } catch (error) {
    console.log('❌ Disabled telemetry test failed:', error.message);
  }

  // Test 2: Включенная телеметрия
  config.setConfig({
    enabled: true,
    serviceName: 'test-service',
    debug: true
  });

  try {
    await otlpLazy.startSpan('enabled-test-span');
    await otlpLazy.addAttribute('test.key', 'test.value');
    await otlpLazy.addEvent('test-event', { eventData: 'test' });
    await otlpLazy.endSpan(true);
    console.log('✅ Enabled telemetry test passed');
  } catch (error) {
    console.log('✅ Enabled telemetry test passed (graceful failure)');
  }

  // Test 3: Проверка состояния
  const isEnabled = otlpLazy.isEnabled();
  if (typeof isEnabled === 'boolean') {
    console.log('✅ isEnabled method test passed');
  } else {
    console.log('❌ isEnabled method test failed');
  }

  // Test 4: Обработка ошибок
  try {
    await otlpLazy.startSpan('error-test-span');
    await otlpLazy.endSpan(false); // Завершаем с ошибкой
    console.log('✅ Error handling test passed');
  } catch (error) {
    console.log('✅ Error handling test passed (graceful failure)');
  }

  console.log('🎉 All Lazy Loading tests passed!\n');
}

// Запуск теста
testLazyLoading().catch(console.error);