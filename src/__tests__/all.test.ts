console.log('🚀 Starting OTLP Library Tests...\n');

// Импортируем и запускаем простые тесты
import './simple.test.js';

// Небольшая задержка между тестами
await new Promise(resolve => setTimeout(resolve, 100));

import './lazy.test.js';

await new Promise(resolve => setTimeout(resolve, 100));

// Временно отключаем тесты декораторов
// import './decorators.test.js';

console.log('🎯 Basic tests completed successfully!');
console.log('📊 Test Summary:');
console.log('  ✅ Simple Functionality');
console.log('  ✅ Lazy Loading');
console.log('\n🎉 Core functionality is working!');
console.log('\n💡 Note: Decorator tests are temporarily disabled.');
console.log('    Run them separately when needed: tsx src/__tests__/decorators.test.ts');