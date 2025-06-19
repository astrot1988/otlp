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

````typescript
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

### Ленивая загрузка с проверкой производительности

```typescript
class PerformanceAwareService {
  private tracer: OTLPLazy | null = null;
  private tracingOverhead = 0;

  private async getTracerIfEfficient() {
    // Инициализируем трейсер только если накладные расходы приемлемы
    if (!this.tracer) {
      const start = performance.now();
      this.tracer = new OTLPLazy();
      
      // Измеряем время инициализации
      await this.tracer.startSpan('test-span');
      await this.tracer.endSpan(true);
      
      this.tracingOverhead = performance.now() - start;
      
      // Если инициализация слишком медленная, отключаем трейсинг
      if (this.tracingOverhead > 100) { // 100ms threshold
        console.warn('Tracing overhead too high, disabling');
        this.tracer = null;
        return null;
      }
    }

    return this.tracer;
  }

  async performCriticalOperation() {
    const tracer = await this.getTracerIfEfficient();
    
    if (tracer) {
      await tracer.startSpan('critical.operation', {
        attributes: {
          'tracing.overhead_ms': this.tracingOverhead
        }
      });
    }

    try {
      const result = await this.executeCriticalLogic();
      
      if (tracer) {
        await tracer.endSpan(true);
      }
      
      return result;
    } catch (error) {
      if (tracer) {
        await tracer.endSpan(false, error.message);
      }
      throw error;
    }
  }
}
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
```