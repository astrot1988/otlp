# @astrot1988/otlp

Легкая OpenTelemetry обертка для веб-приложений с ленивой загрузкой и простой интеграцией.

## 🚀 Особенности

- **🔄 Ленивая загрузка**: OpenTelemetry инициализируется только при необходимости
- **🎯 Простое API**: Легкие в использовании функции и декораторы
- **🔧 Настраиваемость**: Гибкие опции конфигурации с обновлением во время выполнения
- **🌐 Оптимизировано для веб**: Специально разработано для браузерных приложений
- **🛡️ Устойчивость к ошибкам**: Приложение продолжает работать даже при сбоях телеметрии
- **📦 TypeScript**: Полная поддержка TypeScript

## 📦 Установка

```bash
npm install @astrot1988/otlp
```

## 🚀 Быстрый старт

### Базовое использование

```typescript
import { initializeOTLP, withTrace } from '@astrot1988/otlp';

// Инициализация (вызывается один раз в приложении)
await initializeOTLP({
  enabled: true,
  serviceName: 'my-web-app',
  serviceVersion: '1.0.0',
  endpoint: 'http://localhost:4318/v1/traces',
  debug: true
});

// Использование трейсинга
const result = await withTrace('user-operation', async () => {
  const userData = await fetchUserData();
  return userData;
}, {
  attributes: {
    'user.id': '123',
    'operation.type': 'fetch'
  }
});
```

### React интеграция

```typescript
import React, { useEffect } from 'react';
import { initializeOTLP, withTrace } from '@astrot1988/otlp';

function App() {
  useEffect(() => {
    initializeOTLP({
      enabled: process.env.NODE_ENV === 'production',
      serviceName: 'react-app',
      endpoint: process.env.REACT_APP_OTLP_ENDPOINT,
      enableAutoInstrumentation: true
    });
  }, []);

  const handleUserAction = async () => {
    await withTrace('user-button-click', async () => {
      const response = await fetch('/api/data');
      return response.json();
    }, {
      attributes: {
        'ui.component': 'main-button'
      }
    });
  };

  return <button onClick={handleUserAction}>Click me</button>;
}
```

## 📚 API

### `initializeOTLP(config)`

```typescript
interface OTLPConfig {
  enabled: boolean;                    // Включить/выключить трейсинг
  serviceName?: string;               // Имя сервиса
  serviceVersion?: string;            // Версия сервиса
  endpoint?: string;                  // OTLP коллектор
  debug?: boolean;                    // Отладочные логи
  enableAutoInstrumentation?: boolean; // Авто-трейсинг fetch, XHR, кликов
  headers?: Record<string, string>;   // Заголовки для экспорта
}
```

### `withTrace(spanName, fn, options?)`

```typescript
// Простой трейсинг
const user = await withTrace('get-user', async () => {
  return await database.users.findById(userId);
});

// С атрибутами
const products = await withTrace('search-products', async () => {
  return await searchProducts(query);
}, {
  attributes: {
    'search.query': query,
    'user.id': currentUserId
  }
});

// Включить результат в трейс
const result = await withTrace('api-call', async () => {
  return await fetch('/api/data').then(r => r.json());
}, {
  includeResult: true,
  attributes: {
    'api.endpoint': '/api/data'
  }
});
```

## 🎯 Декораторы

### Базовые декораторы

```typescript
import { traceMethod } from '@astrot1988/otlp';

class UserService {
  @traceMethod('user.get-profile')
  async getUserProfile(userId: string) {
    return await this.database.users.findById(userId);
  }

  @traceMethod('user.update-profile', {
    attributes: {
      'operation.type': 'update'
    }
  })
  async updateUserProfile(userId: string, data: any) {
    return await this.database.users.update(userId, data);
  }

  @traceMethod('user.delete', {
    includeResult: false, // Не включать результат в трейс
    attributes: {
      'operation.critical': true
    }
  })
  async deleteUser(userId: string) {
    await this.database.users.delete(userId);
    return { deleted: true };
  }
}
```

### Продвинутые декораторы

```typescript
import { traceClass, traceMethod, conditionalTrace } from '@astrot1988/otlp';

@traceClass('payment-service') // Трейсинг всех методов класса
class PaymentService {
  @traceMethod('payment.process')
  async processPayment(amount: number, cardData: any) {
    return await this.chargeCard(amount, cardData);
  }

  @conditionalTrace('payment.refund', {
    condition: (amount) => amount > 100, // Трейсинг только для сумм > 100
    attributes: {
      'operation.type': 'refund'
    }
  })
  async refundPayment(amount: number, paymentId: string) {
    return await this.processRefund(amount, paymentId);
  }

  @traceMethod('payment.validate', {
    timeout: 5000, // Таймаут операции
    onError: (error, context) => {
      // Кастомная обработка ошибок
      console.error('Payment validation failed:', error);
    }
  })
  async validatePayment(paymentData: any) {
    return await this.validate(paymentData);
  }
}
```

## 🔄 Ленивая загрузка

Библиотека поддерживает ленивую загрузку OpenTelemetry - трейсинг инициализируется только при первом использовании.

### Базовый пример ленивой загрузки

```typescript
import { OTLPLazy } from '@astrot1988/otlp';

// Создание экземпляра не инициализирует OpenTelemetry
const tracer = new OTLPLazy();

// OpenTelemetry инициализируется только при первом вызове
await tracer.startSpan('lazy-operation', {
  attributes: {
    'operation.type': 'lazy-loaded'
  }
});

// Добавление атрибутов и событий
await tracer.addAttribute('step', 'processing');
await tracer.addEvent('processing.started', {
  'timestamp': Date.now()
});

// Выполнение работы
await performSomeWork();

await tracer.addEvent('processing.completed');
await tracer.endSpan(true);
```

### Условная ленивая загрузка

```typescript
class DataService {
  private tracer: OTLPLazy | null = null;

  private getTracer() {
    if (!this.tracer && this.shouldEnableTracing()) {
      this.tracer = new OTLPLazy();
    }
    return this.tracer;
  }

  private shouldEnableTracing() {
    return process.env.NODE_ENV === 'production' || 
           process.env.ENABLE_TRACING === 'true';
  }

  async processData(data: any[]) {
    const tracer = this.getTracer();
    
    if (tracer) {
      await tracer.startSpan('data.process-batch', {
        attributes: {
          'batch.size': data.length,
          'data.type': 'user-data'
        }
      });
    }

    try {
      const results = [];
      
      for (const item of data) {
        if (tracer) {
          await tracer.addEvent('item.processing', {
            'item.id': item.id
          });
        }

        const result = await this.processItem(item);
        results.push(result);
      }

      if (tracer) {
        await tracer.addAttribute('results.count', results.length);
        await tracer.endSpan(true);
      }

      return results;
    } catch (error) {
      if (tracer) {
        await tracer.endSpan(false, error.message);
      }
      throw error;
    }
  }
}
```

### Ленивая загрузка с декораторами

```typescript
import { OTLPLazy } from '@astrot1988/otlp';

// Кастомный декоратор с ленивой загрузкой
function lazyTrace(spanName: string, options: any = {}) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      // Ленивая инициализация трейсера
      if (!this._lazyTracer && this.shouldTrace?.() !== false) {
        this._lazyTracer = new OTLPLazy();
      }

      if (this._lazyTracer) {
        await this._lazyTracer.startSpan(spanName, {
          attributes: options.attributes || {}
        });

        try {
          const result = await originalMethod.apply(this, args);
          await this._lazyTracer.endSpan(true);
          return result;
        } catch (error) {
          await this._lazyTracer.endSpan(false, error.message);
          throw error;
        }
      } else {
        return await originalMethod.apply(this, args);
      }
    };

    return descriptor;
  };
}

class PaymentService {
  @lazyTrace('payment.process', {
    attributes: {
      'service': 'payment',
      'operation': 'process'
    }
  })
  async processPayment(amount: number) {
    // Трейсинг инициализируется только при первом вызове
    return await this.chargeCard(amount);
  }

  shouldTrace() {
    return process.env.NODE_ENV === 'production';
  }
}
```

## 🎯 Примеры использования

### E-commerce приложение

```typescript
class ShoppingCart {
  @traceMethod('cart.add-item')
  async addItem(productId: string, quantity: number) {
    // Валидация продукта
    const product = await withTrace('product.validate', async () => {
      const response = await fetch(`/api/products/${productId}`);
      if (!response.ok) throw new Error('Product not found');
      return response.json();
    });

    // Проверка наличия
    await withTrace('inventory.check', async () => {
      if (product.stock < quantity) {
        throw new Error('Insufficient stock');
      }
    }, {
      attributes: {
        'product.id': productId,
        'product.stock': product.stock,
        'requested.quantity': quantity
      }
    });

    // Добавление в корзину
    return withTrace('cart.update', async () => {
      const response = await fetch('/api/cart/items', {
        method: 'POST',
        body: JSON.stringify({ productId, quantity })
      });
      return response.json();
    });
  }

  @traceMethod('cart.checkout', {
    attributes: {
      'operation.critical': true
    }
  })
  async checkout() {
    // Валидация корзины
    await withTrace('cart.validate', async () => {
      const items = await this.getItems();
      if (items.length === 0) {
        throw new Error('Cart is empty');
      }
    });

    // Обработка платежа
    const payment = await withTrace('payment.process', async () => {
      return await this.processPayment();
    });

    // Создание заказа
    return withTrace('order.create', async () => {
      return await this.createOrder(payment.id);
    });
  }
}
```

### Сервис аутентификации

```typescript
@traceClass('auth-service')
class AuthService {
  @traceMethod('auth.login')
  async login(email: string, password: string) {
    // Валидация входных данных
    await withTrace('auth.validate-input', async () => {
      if (!email || !password) {
        throw new Error('Email and password required');
      }
    });

    // Поиск пользователя
    const user = await withTrace('auth.find-user', async () => {
      const response = await fetch('/api/auth/user', {
        method: 'POST',
        body: JSON.stringify({ email })
      });
      if (!response.ok) throw new Error('User not found');
      return response.json();
    });

    // Проверка пароля
    await withTrace('auth.verify-password', async () => {
      const response = await fetch('/api/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      if (!response.ok) throw new Error('Invalid credentials');
    });

    // Генерация токена
    const token = await withTrace('auth.generate-token', async () => {
      const response = await fetch('/api/auth/token', {
        method: 'POST',
        body: JSON.stringify({ userId: user.id })
      });
      return response.json();
    });

    return { user, token };
  }

  @conditionalTrace('auth.refresh-token', {
    condition: (token) => this.isTokenExpiringSoon(token),
    attributes: {
      'auth.operation': 'refresh'
    }
  })
  async refreshToken(token: string) {
    return await this.generateNewToken(token);
  }
}
```

### Ручное управление трейсами

```typescript
import { OTLPLazy } from '@astrot1988/otlp';

class ComplexOperation {
  async executeComplexWorkflow() {
    const tracer = new OTLPLazy();
    const startTime = Date.now();

    // Начало основного спана
    await tracer.startSpan('complex-workflow', {
      attributes: {
        'workflow.version': '1.0',
        'workflow.type': 'complex'
      }
    });

    try {
      // Шаг 1
      await tracer.addAttribute('current.step', 'validation');
      await tracer.addEvent('step.started', { step: 'validation' });
      
      const validationResult = await this.validateInput();
      
      await tracer.addEvent('step.completed', { 
        step: 'validation',
        result: 'success' 
      });

      // Шаг 2
      await tracer.addAttribute('current.step', 'processing');
      await tracer.addEvent('step.started', { step: 'processing' });
      
      const processingResult = await this.processData();
      
      await tracer.addAttribute('processing.items_count', processingResult.length);
      await tracer.addEvent('step.completed', { 
        step: 'processing',
        items_processed: processingResult.length 
      });

      // Шаг 3
      await tracer.addAttribute('current.step', 'finalization');
      await tracer.addEvent('step.started', { step: 'finalization' });
      
      const finalResult = await this.finalizeResults(processingResult);
      
      await tracer.addEvent('workflow.completed', {
        total_duration_ms: Date.now() - startTime,
        final_result_size: finalResult.length
      });

      // Успешное завершение
      await tracer.endSpan(true, 'Workflow completed successfully');
      
      return finalResult;

    } catch (error) {
      // Добавление информации об ошибке
      await tracer.addEvent('workflow.error', {
        error_type: error.constructor.name,
        error_message: error.message,
        current_step: await tracer.getAttribute('current.step')
      });

      // Завершение с ошибкой
      await tracer.endSpan(false, error.message);
      
      throw error;
    }
  }
}
```

## 🔧 Конфигурация

### Переменные окружения

```bash
OTLP_ENABLED=true
OTLP_SERVICE_NAME=my-app
OTLP_SERVICE_VERSION=1.0.0
OTLP_ENDPOINT=http://localhost:4318/v1/traces
OTLP_DEBUG=false
OTLP_AUTO_INSTRUMENTATION=true
```

### Условный трейсинг

```typescript
// Трейсинг только в продакшене
await initializeOTLP({
  enabled: process.env.NODE_ENV === 'production',
  serviceName: 'my-app',
  endpoint: process.env.OTLP_ENDPOINT
});

// Трейсинг только для определенных пользователей
const shouldTrace = user.isBetaUser || user.isAdmin;
if (shouldTrace) {
  await withTrace('beta-feature', async () => {
    return await executeBetaFeature();
  });
}

// Трейсинг с семплированием (10% запросов)
const shouldTrace = Math.random() < 0.1;
if (shouldTrace) {
  await withTrace('high-frequency-operation', async () => {
    return await operation();
  });
}
```

### Динамическое изменение конфигурации

```typescript
import { ConfigManager } from '@astrot1988/otlp';

const config = ConfigManager.getInstance();

// Включить трейсинг во время выполнения
config.setConfig({ enabled: true, debug: true });

// Отключить для определенных операций
config.setConfig({ enabled: false });
await withTrace('operation', async () => {
  return await operation(); // Не будет трейситься
});

// Включить обратно
config.setConfig({ enabled: true });
```

## 🛠️ Интеграция с фреймворками

### Next.js

```typescript
// pages/_app.tsx
import { useEffect } from 'react';
import { initializeOTLP } from '@astrot1988/otlp';

function MyApp({ Component, pageProps }) {
  useEffect(() => {
    initializeOTLP({
      enabled: process.env.NODE_ENV === 'production',
      serviceName: 'nextjs-app',
      endpoint: process.env.NEXT_PUBLIC_OTLP_ENDPOINT,
      enableAutoInstrumentation: true
    });
  }, []);

  return <Component {...pageProps} />;
}

// pages/api/users.ts
import { withTrace } from '@astrot1988/otlp';

export default async function handler(req, res) {
  const users = await withTrace('api.get-users', async () => {
    return await database.users.findMany();
  }, {
    attributes: {
      'http.method': req.method,
      'http.url': req.url
    }
  });

  res.json(users);
}
```

### Vue.js

```typescript
// main.ts
import { createApp } from 'vue';
import { initializeOTLP } from '@astrot1988/otlp';

const app = createApp(App);

initializeOTLP({
  enabled: import.meta.env.PROD,
  serviceName: 'vue-app',
  endpoint: import.meta.env.VITE_OTLP_ENDPOINT
});

// В компонентах
import { withTrace } from '@astrot1988/otlp';

export default {
  methods: {
    async fetchData() {
      this.data = await withTrace('fetch-component-data', async () => {
        const response = await fetch('/api/data');
        return response.json();
      }, {
        attributes: {
          'component': 'UserDashboard',
          'user.id': this.userId
        }
      });
    }
  }
};
```

### Angular

```typescript
// app.module.ts
import { APP_INITIALIZER } from '@angular/core';
import { initializeOTLP } from '@astrot1988/otlp';

function initializeTracing() {
  return () => initializeOTLP({
    enabled: !environment.production,
    serviceName: 'angular-app',
    endpoint: environment.otlpEndpoint
  });
}

@NgModule({
  providers: [
    {
      provide: APP_INITIALIZER,
      useFactory: initializeTracing,
      multi: true
    }
  ]
})
export class AppModule { }

// В сервисах
import { Injectable } from '@angular/core';
import { withTrace } from '@astrot1988/otlp';

@Injectable()
export class UserService {
  async getUser(id: string) {
    return withTrace('user.get', async () => {
      return this.http.get(`/api/users/${id}`).toPromise();
    });
  }
}
```

## 🔍 Отладка

### Включение отладочного режима

```typescript
await initializeOTLP({
  enabled: true,
  serviceName: 'debug-app',
  debug: true // Включает логирование всех операций трейсинга
});

// В консоли увидите:
// OTLP initialized successfully { serviceName: 'debug-app' }
// Starting span: user-operation
// Adding attribute: user.id = 123
// Ending span: user-operation (success)
```

### Проверка конфигурации

```typescript
import { ConfigManager } from '@astrot1988/otlp';

const config = ConfigManager.getInstance();
console.log('Current config:', config.getConfig());

// Проверка состояния
if (!config.getConfig().enabled) {
  console.log('Tracing is disabled');
}
```

### Тестирование без внешнего коллектора

```typescript
// Трейсы создаются, но не отправляются
await initializeOTLP({
  enabled: true,
  serviceName: 'test-app',
  debug: true
  // Без endpoint - трейсы только логируются
});

const result = await withTrace('test-operation', async () => {
  return 'success';
});

console.log('Result:', result); // Result: success
```

## 📦 Сборка и развертывание

### Webpack конфигурация

```javascript
// webpack.config.js
module.exports = {
  resolve: {
    fallback: {
      "buffer": require.resolve("buffer/"),
      "util": require.resolve("util/")
    }
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.OTLP_ENDPOINT': JSON.stringify(process.env.OTLP_ENDPOINT),
      'process.env.OTLP_ENABLED': JSON.stringify(process.env.OTLP_ENABLED)
    })
  ]
};
```

### Docker

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .

ENV OTLP_ENABLED=true
ENV OTLP_SERVICE_NAME=my-app
ENV OTLP_ENDPOINT=http://otel-collector:4318/v1/traces

EXPOSE 3000
CMD ["npm", "start"]
```

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  template:
    spec:
      containers:
      - name: my-app
        image: my-app:latest
        env:
        - name: OTLP_ENABLED
          value: "true"
        - name: OTLP_SERVICE_NAME
          value: "my-app"
        - name: OTLP_ENDPOINT
          value: "http://otel-collector:4318/v1/traces"
```

## 🤝 Совместимость

- **Браузеры**: Chrome 60+, Firefox 55+, Safari 12+, Edge 79+
- **Node.js**: 16+ (для SSR)
- **Фреймворки**: React, Vue, Angular, Next.js, Nuxt.js
- **Сборщики**: Webpack, Vite, Rollup, Parcel
- **TypeScript**: 4.5+

## 📄 Лицензия

MIT

## 🤝 Вклад в проект

Приветствуются Pull Request'ы и Issues!

1. Fork проекта
2. Создайте feature branch (`git checkout -b feature/amazing-feature`)
3. Commit изменения (`git commit -m 'Add amazing feature'`)
4. Push в branch (`git push origin feature/amazing-feature`)
5. Откройте Pull Request

