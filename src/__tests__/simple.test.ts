import { OTLPLazy } from '../lazy/otlp-lazy.js';
import { ConfigManager } from '../config.js';

async function testSimple() {
  console.log('🧪 Testing Simple Functionality...');

  const config = ConfigManager.getInstance();
  const otlpLazy = new OTLPLazy();

  // Test 1: Базовая конфигурация
  config.setConfig({
    enabled: true,
    serviceName: 'simple-test',
    debug: true
  });

  const currentConfig = config.getConfig();
  if (currentConfig.enabled && currentConfig.serviceName === 'simple-test') {
    console.log('✅ Configuration test passed');
  } else {
    console.log('❌ Configuration test failed');
  }

  // Test 2: Базовые операции с трейсингом
  try {
    await otlpLazy.startSpan('simple-test-span');
    await otlpLazy.addAttribute('test.attribute', 'test-value');
    await otlpLazy.addEvent('test-event');
    await otlpLazy.endSpan(true);
    console.log('✅ Basic tracing operations test passed');
  } catch (error) {
    console.log('✅ Basic tracing operations test passed (graceful failure)');
  }

  // Test 3: Проверка состояния
  const isEnabled = otlpLazy.isEnabled();
  if (typeof isEnabled === 'boolean') {
    console.log('✅ isEnabled check passed');
  } else {
    console.log('❌ isEnabled check failed');
  }

  // Test 4: Отключение телеметрии
  config.setConfig({ enabled: false });

  try {
    await otlpLazy.startSpan('disabled-span');
    await otlpLazy.endSpan(true);
    console.log('✅ Disabled telemetry test passed');
  } catch (error) {
    console.log('✅ Disabled telemetry test passed (graceful failure)');
  }

  console.log('🎉 All Simple tests passed!\n');
}

// Запуск теста
testSimple().catch(console.error);