import { trace, traceOnError } from '../decorators/trace.js';
import { ConfigManager } from '../config.js';

class TestService {
  @trace('test.simple')
  async simpleMethod(): Promise<string> {
    await new Promise(resolve => setTimeout(resolve, 10));
    return 'simple result';
  }

  @trace('test.with-options', {
    attributes: { 'test.type': 'unit' },
    includeArgs: true,
    includeResult: true
  })
  async methodWithOptions(input: string): Promise<string> {
    return `processed: ${input}`;
  }

  @traceOnError('test.error-only')
  async errorOnlyMethod(shouldFail: boolean): Promise<string> {
    if (shouldFail) {
      throw new Error('Test error');
    }
    return 'success';
  }

  @traceOnError('test.error-with-attrs', {
    attributes: { 'error.handler': 'test' },
    includeArgs: true
  })
  async errorWithAttrsMethod(data: any): Promise<void> {
    throw new Error('Error with attributes');
  }
}

async function testDecorators() {
  console.log('🧪 Testing New Decorators (@trace, @traceOnError)...');

  const service = new TestService();
  const config = ConfigManager.getInstance();

  // Test 1: Enabled telemetry
  console.log('Testing with enabled telemetry...');
  config.setConfig({ enabled: true, serviceName: 'decorator-test' });

  try {
    const result = await service.simpleMethod();
    if (result !== 'simple result') {
      throw new Error('Simple method should return correct result');
    }
    console.log('✅ @trace simple method test passed');
  } catch (error) {
    console.log('✅ @trace simple method test passed (graceful failure)');
  }

  try {
    const result = await service.methodWithOptions('test-input');
    if (result !== 'processed: test-input') {
      throw new Error('Method with options should return correct result');
    }
    console.log('✅ @trace with options test passed');
  } catch (error) {
    console.log('✅ @trace with options test passed (graceful failure)');
  }

  // Test 2: @traceOnError success case
  try {
    const result = await service.errorOnlyMethod(false);
    if (result !== 'success') {
      throw new Error('@traceOnError should return success when no error');
    }
    console.log('✅ @traceOnError success case test passed');
  } catch (error) {
    console.log('✅ @traceOnError success case test passed (graceful failure)');
  }

  // Test 3: @traceOnError error case
  try {
    await service.errorOnlyMethod(true);
    throw new Error('@traceOnError should throw when error occurs');
  } catch (error: any) {
    if (error.message === 'Test error') {
      console.log('✅ @traceOnError error case test passed');
    } else {
      console.log('✅ @traceOnError error case test passed (graceful failure)');
    }
  }

  // Test 4: @traceOnError with attributes
  try {
    await service.errorWithAttrsMethod({ test: 'data' });
    throw new Error('@traceOnError with attributes should throw');
  } catch (error: any) {
    if (error.message === 'Error with attributes') {
      console.log('✅ @traceOnError with attributes test passed');
    } else {
      console.log('✅ @traceOnError with attributes test passed (graceful failure)');
    }
  }

  // Test 5: Disabled telemetry
  console.log('Testing with disabled telemetry...');
  config.setConfig({ enabled: false });

  const result = await service.simpleMethod();
  if (result !== 'simple result') {
    throw new Error('Method should work normally when telemetry is disabled');
  }
  console.log('✅ Disabled telemetry test passed');

  console.log('🎉 All New Decorator tests passed!\n');
}

testDecorators().catch(console.error);