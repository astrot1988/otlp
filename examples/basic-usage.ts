import { initializeOTLP, withTrace } from '../src/index.js';

async function basicExample() {
  console.log('🚀 Basic OTLP Usage Example\n');

  // Инициализация OTLP
  const otlp = await initializeOTLP({
    enabled: true,
    serviceName: 'my-web-app',
    serviceVersion: '1.0.0',
    debug: true,
    // endpoint: 'http://localhost:4318/v1/traces', // Раскомментируйте для отправки в реальный коллектор
    enableAutoInstrumentation: true
  });

  console.log('✅ OTLP initialized');

  // Пример 1: Простое использование
  console.log('\n📝 Example 1: Simple tracing');

  const result1 = await withTrace('user-login', async () => {
    // Имитация логики входа пользователя
    await new Promise(resolve => setTimeout(resolve, 100));
    return { userId: 123, username: 'john_doe' };
  });

  console.log('User login result:', result1);

  // Пример 2: С атрибутами
  console.log('\n📝 Example 2: Tracing with attributes');

  const result2 = await withTrace('database-query', async () => {
    // Имитация запроса к базе данных
    await new Promise(resolve => setTimeout(resolve, 50));
    return [{ id: 1, name: 'Product 1' }, { id: 2, name: 'Product 2' }];
  }, {
    attributes: {
      'db.operation': 'SELECT',
      'db.table': 'products',
      'db.rows_affected': 2
    },
    includeResult: true
  });

  console.log('Database query result:', result2);

  // Пример 3: Обработка ошибок
  console.log('\n📝 Example 3: Error handling');

  try {
    await withTrace('payment-processing', async () => {
      // Имитация ошибки платежа
      throw new Error('Payment gateway timeout');
    }, {
      attributes: {
        'payment.amount': 99.99,
        'payment.currency': 'USD'
      }
    });
  } catch (error) {
    console.log('Payment error handled:', error.message);
  }

  // Пример 4: Вложенные операции
  console.log('\n📝 Example 4: Nested operations');

  const result4 = await withTrace('order-processing', async () => {
    // Проверка инвентаря
    const inventory = await withTrace('inventory-check', async () => {
      await new Promise(resolve => setTimeout(resolve, 30));
      return { available: true, quantity: 5 };
    });

    if (!inventory.available) {
      throw new Error('Out of stock');
    }

    // Создание заказа
    const order = await withTrace('order-creation', async () => {
      await new Promise(resolve => setTimeout(resolve, 40));
      return { orderId: 'ORD-123', status: 'created' };
    });

    // Отправка уведомления
    await withTrace('notification-send', async () => {
      await new Promise(resolve => setTimeout(resolve, 20));
      return { sent: true };
    });

    return { order, inventory };
  });

  console.log('Order processing result:', result4);

  console.log('\n🎉 All examples completed successfully!');
}

// Запуск примера
