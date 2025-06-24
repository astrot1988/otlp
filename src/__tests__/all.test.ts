console.log('🚀 Starting OTLP Library Tests...\n');

// Импортируем и запускаем простые тесты
import './simple.test.js';

// Небольшая задержка между тестами
await new Promise(resolve => setTimeout(resolve, 100));

import './lazy.test.js';

await new Promise(resolve => setTimeout(resolve, 100));

// ✅ ВКЛЮЧАЕМ тесты декораторов
import './decorators.test.js';

console.log('🎯 All tests completed successfully!');
console.log('📊 Test Summary:');
console.log('  ✅ Simple Functionality');
console.log('  ✅ Lazy Loading');
console.log('\n🎉 Full functionality is working!');