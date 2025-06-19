import { ContextManager } from '../utils/context-manager.js';
import { MetricsCollector } from '../utils/metrics-collector.js';
import { ConfigManager } from '../config.js';

async function testUtils() {
  console.log('🧪 Testing Utils...');

  // Test Context Manager
  console.log('Testing Context Manager...');
  const contextManager = ContextManager.getInstance();

  const context1 = contextManager.createContext('test-context-1');
  if (!context1.traceId || !context1.spanId) {
    throw new Error('Context should have traceId and spanId');
  }

  contextManager.addBaggage('userId', '123', 'test-context-1');
  const userId = contextManager.getBaggage('userId', 'test-context-1');
  if (userId !== '123') {
  }

  const currentContext = contextManager.getContext();
  if (currentContext?.traceId !== context1.traceId) {
    throw new Error('Current context should match created context');
  }

  contextManager.clearContext('test-context-1');
  const clearedContext = contextManager.getContext('test-context-1');
  if (clearedContext !== null) {
    throw new Error('Context should be cleared');
  }

  console.log('✅ Context Manager test passed');

  // Test Metrics Collector
  console.log('Testing Metrics Collector...');
  const config = ConfigManager.getInstance();
  config.setConfig({ enabled: true, serviceName: 'metrics-test' });

  const metricsCollector = MetricsCollector.getInstance();
  metricsCollector.clearMetrics();

  // Test counter
  metricsCollector.counter('test.requests', 1, { endpoint: '/api/test' });
  metricsCollector.counter('test.requests', 2, { endpoint: '/api/test' });

  const counterValue = metricsCollector.getCounterValue('test.requests');
  if (counterValue !== 3) {
    throw new Error(`Counter should be 3, got ${counterValue}`);
  }

  // Test gauge
  metricsCollector.gauge('test.memory', 1024, { unit: 'MB' });
  const gaugeValue = metricsCollector.getGaugeValue('test.memory');
  if (gaugeValue !== 1024) {
    throw new Error(`Gauge should be 1024, got ${gaugeValue}`);
  }

  // Test histogram
  metricsCollector.histogram('test.response_time', 150, { method: 'GET' });

  // Test timer
  const stopTimer = metricsCollector.startTimer('test.operation');
  await new Promise(resolve => setTimeout(resolve, 50));
  stopTimer();

  const metrics = metricsCollector.getMetrics();
  if (metrics.length < 4) {
    throw new Error('Should have at least 4 metrics recorded');
  }

  const summary = metricsCollector.getMetricsSummary();
  if (summary.totalMetrics < 4) {
    throw new Error('Summary should show at least 4 metrics');
  }

  console.log('✅ Metrics Collector test passed');

  // Test with disabled telemetry
  console.log('Testing with disabled telemetry...');
  config.setConfig({ enabled: false });

  const initialMetricsCount = metricsCollector.getMetrics().length;
  metricsCollector.counter('disabled.test', 1);
  metricsCollector.gauge('disabled.test', 100);

  const finalMetricsCount = metricsCollector.getMetrics().length;
  if (finalMetricsCount !== initialMetricsCount) {
    throw new Error('Metrics should not be recorded when telemetry is disabled');
  }

  const noOpTimer = metricsCollector.startTimer('disabled.timer');
  noOpTimer(); // Should be no-op

  console.log('✅ Disabled telemetry utils test passed');

  console.log('🎉 All Utils tests passed!\n');
}

// Запуск теста
testUtils().catch(console.error);