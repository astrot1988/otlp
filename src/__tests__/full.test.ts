import { ConfigManager } from '../config.js';
import { OTLPFull } from '../full/otlp-full.js';

async function testFullLoading() {
  console.log('🧪 Testing Full Loading...');

  // Test 1: Отключенная телеметрия
  const config = ConfigManager.getInstance();
  config.setConfig({ enabled: false, serviceName: 'test-service-full' });

  const otlpDisabled = new OTLPFull();

  if (otlpDisabled.isReady()) {
    throw new Error('OTLP should not be ready when disabled');
  }

  // Методы должны работать как no-op
  otlpDisabled.startSpan('test-span');
  otlpDisabled.addAttribute('key', 'value');
  otlpDisabled.endSpan(true);

  console.log('✅ Disabled telemetry full loading test passed');

  // Test 2: Включенная телеметрия
  config.setConfig({
    enabled: true,
    serviceName: 'test-service-full',
    debug: true,
    endpoint: 'http://localhost:9999/v1/traces'
  });

  const otlpEnabled = new OTLPFull();

  // Даем время на инициализацию
  await new Promise(resolve => setTimeout(resolve, 100));

  // Проверяем методы управления
  console.log('OTLP Ready:', otlpEnabled.isReady());

  otlpEnabled.startSpan('test-span-full');
  otlpEnabled.addAttribute('test-key', 'test-value');
  otlpEnabled.endSpan(true);

  // Тестируем shutdown
  await otlpEnabled.shutdown();
  console.log('✅ Full loading with enabled telemetry test passed');

  console.log('🎉 All Full Loading tests passed!\n');
}

// Запуск теста
testFullLoading().catch(console.error);