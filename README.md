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

## 🔧 Конфигурация

### Базовая конфигурация

```typescript
interface OTLPConfig {
  enabled: boolean;                    // Включить/выключить трейсинг
  serviceName?: string;               // Имя сервиса
  serviceVersion?: string;            // Версия сервиса
  endpoint?: string;                  // OTLP коллектор
  debug?: boolean;                    // Отладочные логи
  enableAutoInstrumentation?: boolean; // Авто-трейсинг fetch, XHR, кликов
  headers?: Record<string, string>;   // Заголовки для экспорта
  traceOnErrorOnly?: boolean;         // Трейсинг только при ошибках
}
```

### Переменные окружения

```bash
# .env
OTLP_ENABLED=true
OTLP_SERVICE_NAME=my-app
OTLP_SERVICE_VERSION=1.0.0
OTLP_ENDPOINT=http://localhost:4318/v1/traces
OTLP_DEBUG=false
OTLP_AUTO_INSTRUMENTATION=true
ENABLE_TRACING=true
```

### Глобальная конфигурация

```typescript
import { ConfigManager } from '@astrot1988/otlp';

const configManager = ConfigManager.getInstance();

// Установка конфигурации
configManager.setConfig({
  enabled: true,
  serviceName: 'my-web-app',
  serviceVersion: '1.0.0',
  endpoint: 'http://localhost:4318/v1/traces',
  debug: true,
  headers: {
    'Authorization': 'Bearer your-token',
    'X-Service-Name': 'my-web-app'
  }
});

// Получение текущей конфигурации
const config = configManager.getConfig();
console.log('Current config:', config);
```

## 🚀 Инициализация

###  Полная инициализация

```typescript
import { initializeOTLP } from '@astrot1988/otlp';

// Инициализация с полной конфигурацией
await initializeOTLP({
  enabled: true,
  serviceName: 'my-web-app',
  serviceVersion: '1.0.0',
  endpoint: 'http://localhost:4318/v1/traces',
  debug: true,
  enableAutoInstrumentation: false,
  headers: {
    'Authorization': 'Bearer your-token',
    'Content-Type': 'application/json'
  }
});

console.log('✅ OTLP initialized successfully');
```

### Ленивая инициализация

```typescript
import { OTLPLazy } from '@astrot1988/otlp';

// Создание экземпляра (OpenTelemetry НЕ инициализируется)
const tracer = new OTLPLazy({
  serviceName: 'my-web-app',
  enableAutoInstrumentation: true,  
  endpoint: 'http://localhost:4318/v1/traces',
  debug: true,
  traceOnErrorOnly: false,         
  serviceVersion: '1.0.0',          
  headers: {                        
    'Authorization': 'Bearer token'
  }
});

// OpenTelemetry инициализируется только при первом использовании
await tracer.startSpan('lazy-operation', {
  attributes: {
    'operation.type': 'lazy-loaded'
  }
});

await tracer.addAttribute('step', 'processing');
await tracer.addEvent('processing.started');

// Выполнение работы
await performSomeWork();

await tracer.endSpan(true);
```

### Способ 2: Ленивая инициализация с конфигурацией
```typescript
import { initializeOTLP, OTLPLazy } from '@astrot1988/otlp';

// ✅ Ленивая инициализация - трейсинг только при ошибках
await initializeOTLP({
  enabled: true,
  serviceName: 'my-lazy-app',
  endpoint: 'http://localhost:4318/v1/traces',
  traceOnErrorOnly: true,           // Только ошибки
  enableAutoInstrumentation: true,  // Автоинструментация включена
  debug: true
});

// Создание экземпляра с дополнительной конфигурацией
const lazyTracer = new OTLPLazy({
  serviceVersion: '2.0.0',
  headers: { 'Authorization': 'Bearer token' }
});

// Обычные операции НЕ трейсятся
await fetch('/api/users'); // ✅ Успех - без трейсинга

// Ошибки трейсятся + включается автоинструментация
try {
  await fetch('/api/error'); // ❌ 500 -> трейсинг активируется!
} catch (error) {
  // Теперь все последующие запросы будут трейситься
}


```


### Полная инициализация (с выборочным трейсингом ошибок)
```typescript
import { initializeOTLPFull, OTLPFull } from '@astrot1988/otlp';

// ✅ Полная инициализация - все готово сразу, но трейсим только ошибки
await initializeOTLPFull({
  enabled: true,
  serviceName: 'my-full-app',
  endpoint: 'http://localhost:4318/v1/traces',
  traceOnErrorOnly: true,           // Только ошибки
  enableAutoInstrumentation: true,  // Автоинструментация сразу активна
  debug: true
});

// Создание экземпляра с конфигурацией
const fullTracer = new OTLPFull({
  serviceVersion: '2.0.0',
  headers: { 'Authorization': 'Bearer token' }
});

// Проверка готовности
console.log('Tracer ready:', fullTracer.isReady());

```


### Универсальная инициализация с выбором режима
```typescript
import { initializeOTLPWithMode } from '@astrot1988/otlp';

// ✅ Выбор режима в зависимости от окружения
const telemetry = await initializeOTLPWithMode({
  enabled: true,
  serviceName: 'my-universal-app',
  endpoint: 'http://localhost:4318/v1/traces',
  traceOnErrorOnly: true,
  enableAutoInstrumentation: true,
  mode: process.env.NODE_ENV === 'production' ? 'lazy' : 'full'
});

console.log('Telemetry initialized:', telemetry);

```


### Динамическое переключение режимов
```typescript
import { ConfigManager, OTLPLazy, OTLPFull } from '@astrot1988/otlp';

const config = ConfigManager.getInstance();

// Начинаем с трейсинга только ошибок
config.setConfig({
  enabled: true,
  serviceName: 'dynamic-app',
  traceOnErrorOnly: true,
  enableAutoInstrumentation: true
});

const tracer = new OTLPLazy();

// В процессе работы переключаемся на полный трейсинг
setTimeout(() => {
  config.setConfig({
    traceOnErrorOnly: false // Теперь трейсим все
  });
  
  console.log('Switched to full tracing mode');
}, 60000);

```


### Условная инициализация

```typescript
import { ConfigManager, initializeOTLP } from '@astrot1988/otlp';

// Инициализация только в продакшене
const shouldInitialize = process.env.NODE_ENV === 'production' || 
                         process.env.ENABLE_TRACING === 'true';

if (shouldInitialize) {
  await initializeOTLP({
    enabled: true,
    serviceName: 'my-app',
    endpoint: process.env.OTLP_ENDPOINT
  });
} else {
  // Отключаем трейсинг для разработки
  ConfigManager.getInstance().setConfig({ enabled: false });
}
```


### Проверка состояния трейсинга
```typescript
import { ConfigManager } from '@astrot1988/otlp';

function getTracingStatus() {
  const config = ConfigManager.getInstance().getConfig();
  
  return {
    enabled: config.enabled,
    mode: config.traceOnErrorOnly ? 'error-only' : 'full',
    autoInstrumentation: config.enableAutoInstrumentation,
    service: config.serviceName,
    endpoint: config.endpoint,
    description: config.traceOnErrorOnly 
      ? '🔥 Tracing only errors - lightweight mode'
      : '📊 Tracing everything - full observability'
  };
}

console.log('Current tracing status:', getTracingStatus());

```

## 🎯 Работа с декораторами

### Базовые декораторы
```typescript
  // Всегда трейсит
  @trace('api.settlements.findOne', {
    attributes: { 'http.method': 'GET' },
    includeArgs: true,
    includeResult: true
  })
  static async findOne(id: number): Promise<SettlementEntity> {
    const res = await api.get(`/odata/settlements_geometry(${id})`);
    return new SettlementEntity(res.d);
  }

  // Трейсит только ошибки
  @traceOnError('api.settlements.error', {
    attributes: { 'error.type': 'api' },
    includeArgs: true
  })
  static async riskyOperation(data: any): Promise<void> {
    if (Math.random() > 0.5) {
      throw new Error('Random failure');
    }
  }
}
```




```typescript
import { lazyTrace, lazyTraceOnError, type LazyTraceable } from '@astrot1988/otlp';

class UserService implements LazyTraceable {
  _lazyTracer?: any;
  _errorTracer?: any;

  // Опциональный метод для контроля трейсинга
  shouldTrace(): boolean {
    return process.env.NODE_ENV === 'production';
  }

  // Полный трейсинг метода
  @lazyTrace('user.get-profile', {
    includeResult: true,
    attributes: {
      'operation.type': 'read',
      'data.source': 'database'
    }
  })
  async getUserProfile(userId: string): Promise<UserProfile> {
    const response = await fetch(`/api/users/${userId}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  }

  // Трейсинг только при ошибках
  @lazyTraceOnError('user.update-profile', {
    includeArgs: true,
    errorFilter: (error: Error) => {
      // Трейсируем только серверные ошибки
      return !error.message.includes('validation');
    },
    attributes: {
      'operation.type': 'update',
      'operation.critical': true
    },
    onError: (error: Error, context: any) => {
      console.error('Critical user update error:', {
        error: error.message,
        userId: context.args[0],
        duration: context.duration
      });
    }
  })
  async updateUserProfile(userId: string, data: Partial<UserProfile>): Promise<UserProfile> {
    // Валидация
    if (!data.name) {
      throw new Error('Name validation failed');
    }

    const response = await fetch(`/api/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    return await response.json();
  }

  // Трейсинг с таймаутом
  @lazyTrace('user.delete', {
    timeout: 5000,
    includeResult: false,
    attributes: {
      'operation.type': 'delete',
      'operation.critical': true
    }
  })
  async deleteUser(userId: string): Promise<void> {
    const response = await fetch(`/api/users/${userId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      throw new Error(`Failed to delete user: ${response.status}`);
    }
  }
}

interface UserProfile {
  id: string;
  name: string;
  email: string;
}
```

### Продвинутые декораторы

```typescript
import { lazyTraceAdvanced } from '@astrot1988/otlp';

class PaymentService implements LazyTraceable {
  _lazyTracer?: any;
  _errorTracer?: any;

  shouldTrace(): boolean {
    return true;
  }

  // Комбинированный декоратор с расширенными возможностями
  @lazyTraceAdvanced('payment.process', {
    includeArgs: true,
    includeResult: true,
    timeout: 10000,
    errorFilter: (error: Error) => {
      // Трейсируем все ошибки кроме валидационных
      return !error.message.includes('validation');
    },
    onSuccess: (result: any, context: any) => {
      console.log('Payment processed successfully:', {
        paymentId: result.id,
        amount: context.args[0],
        duration: context.duration
      });
    },
    onError: (error: Error, context: any) => {
      console.error('Payment processing failed:', {
        error: error.message,
        amount: context.args[0],
        duration: context.duration
      });
    },
    attributes: {
      'service.name': 'payment-service',
      'operation.critical': true
    }
  })
  async processPayment(amount: number, cardData: CardData): Promise<PaymentResult> {
    // Валидация
    if (amount <= 0) {
      throw new Error('Amount validation failed');
    }

    // Обработка платежа
    const response = await fetch('/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, cardData })
    });

    if (!response.ok) {
      throw new Error(`Payment failed: ${response.status}`);
    }

    return await response.json();
  }

  // Трейсинг только при ошибках
  @lazyTraceAdvanced('payment.refund', {
    traceOnlyOnError: true,
    includeArgs: true,
    attributes: {
      'operation.type': 'refund'
    }
  })
  async refundPayment(paymentId: string, amount: number): Promise<RefundResult> {
    const response = await fetch(`/api/payments/${paymentId}/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount })
    });

    if (!response.ok) {
      throw new Error(`Refund failed: ${response.status}`);
    }

    return await response.json();
  }
}

interface CardData {
  number: string;
  cvv: string;
  expiry: string;
}

interface PaymentResult {
  id: string;
  status: string;
  amount: number;
}

interface RefundResult {
  id: string;
  status: string;
  refundAmount: number;
}
```

## 🔄 Работа без декораторов

### Функциональный подход

```typescript
import { withTrace, OTLPLazy } from '@astrot1988/otlp';

class DataService {
  // Использование withTrace функции
  async fetchUserData(userId: string): Promise<UserData> {
    return withTrace('data.fetch-user', async () => {
      const response = await fetch(`/api/users/${userId}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.json();
    }, {
      attributes: {
        'user.id': userId,
        'operation.type': 'fetch'
      },
      includeResult: true
    });
  }

  // Ручное управление трейсами
  async processUserData(userData: UserData[]): Promise<ProcessedData[]> {
    const tracer = new OTLPLazy({
      serviceName: 'data-service',
      debug: true
    });

    await tracer.startSpan('data.process-batch', {
      attributes: {
        'batch.size': userData.length,
        'operation.type': 'processing'
      }
    });

    try {
      const results: ProcessedData[] = [];

      for (const user of userData) {
        await tracer.addEvent('user.processing', {
          'user.id': user.id
        });

        const processed = await this.processUser(user);
        results.push(processed);

        await tracer.addAttribute(`user.${user.id}.processed`, true);
      }

      await tracer.addAttribute('results.count', results.length);
      await tracer.addEvent('batch.completed', {
        'processed.count': results.length
      });

      await tracer.endSpan(true);
      return results;

    } catch (error) {
      await tracer.addAttribute('error.message', error.message);
      await tracer.endSpan(false, error.message);
      throw error;
    }
  }

  private async processUser(user: UserData): Promise<ProcessedData> {
    // Обработка пользователя
    return {
      id: user.id,
      processedAt: new Date(),
      status: 'processed'
    };
  }
}

interface UserData {
  id: string;
  name: string;
  email: string;
}

interface ProcessedData {
  id: string;
  processedAt: Date;
  status: string;
}
```

### Условный трейсинг

```typescript
import { ConfigManager, OTLPLazy } from '@astrot1988/otlp';

class ConditionalService {
  private shouldTrace(operation: string): boolean {
    const config = ConfigManager.getInstance().getConfig();
    
    // Различные условия для разных операций
    if (operation.includes('critical')) {
      return true; // Всегда трейсим критические операции
    }
    
    if (operation.includes('frequent')) {
      return Math.random() < 0.1; // 10% семплирование для частых операций
    }
    
    return config.enabled;
  }

  async performOperation(type: 'critical' | 'frequent' | 'normal', data: any): Promise<any> {
    const operationName = `service.${type}-operation`;
    
    if (!this.shouldTrace(operationName)) {
      // Выполняем без трейсинга
      return await this.executeOperation(data);
    }

    // Выполняем с трейсингом
    return withTrace(operationName, async () => {
      return await this.executeOperation(data);
    }, {
      attributes: {
        'operation.type': type,
        'data.size': JSON.stringify(data).length
      }
    });
  }

  private async executeOperation(data: any): Promise<any> {
    // Логика операции
    await new Promise(resolve => setTimeout(resolve, 100));
    return { result: 'success', processedData: data };
  }
}
```

## 🌐 Настройка для фреймворков

### Натив
