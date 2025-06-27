# @astrot1988/otlp

Легкая OpenTelemetry обертка для веб-приложений

## 📦 Установка

```bash
npm install @astrot1988/otlp
```

## 🔧 Применение

### Автоматически

```typescript
// Просто импортируй библиотеку - она автоматически инициализируется
import '@astrot1988/otlp';

// Если в window.SETTINGS есть OTEL_EXPORTER_OTLP_ENDPOINT_FRONT, 
// трейсинг включится автоматически

```


### Ручная настройка
```typescript
import { OTLP } from '@astrot1988/otlp';

// Создание экземпляра с настройками
const otlp = new OTLP({
  enabled: true,
  mode: 'auto', // или 'manual'
  traceOnlyErrors: true, // трейсить только ошибки
  options: {
    serviceName: 'my-web-app',
    serviceVersion: '2.0.0',
    endpoint: 'https://my-otel-collector.com/v1/traces',
    headers: {
      'Authorization': 'Bearer token'
    },
    resourceAttributes: {
      'environment': 'production',
      'team': 'frontend'
    },
    debug: true
  }
});

```


### Настройка через window.SETTINGS
```html
<script>
window.SETTINGS = {
  OTEL_EXPORTER_OTLP_ENDPOINT_FRONT: 'https://otel-collector.example.com/v1/traces',
  OTEL_RESOURCE_ATTRIBUTES: {
    'service.environment': 'production',
    'service.team': 'frontend',
    'deployment.version': '1.2.3'
  }
};
</script>

<script type="module">
// Библиотека автоматически подхватит настройки из window.SETTINGS
import '@astrot1988/otlp';
</script>

```

### Ручное управление спанами
```typescript
import { OTLP } from '@astrot1988/otlp';

const otlp = new OTLP();

async function complexOperation() {
  // Начинаем спан
  otlp.startSpan('complex.operation', {
    attributes: { 'operation.id': '123' }
  });

  try {
    // Добавляем атрибуты по ходу выполнения
    otlp.addAttribute('step', 'validation');
    await validateData();

    otlp.addAttribute('step', 'processing');
    const result = await processData();

    otlp.addAttribute('step', 'saving');
    await saveResult(result);

    // Добавляем событие
    otlp.addEvent('operation.completed', {
      'result.count': result.length
    });

    // Завершаем успешно
    otlp.endSpan(true, 'Operation completed successfully');
    
    return result;
  } catch (error) {
    // Записываем ошибку
    otlp.recordError(error);
    otlp.endSpan(false, error.message);
    throw error;
  }
}

```


### Использование декораторов
```typescript
import { trace, traceOnError, advancedTrace } from '@astrot1988/otlp';

class UserService {
  // Обычный трейсинг (работает только если traceOnlyErrors: false)
  @trace('user.fetch')
  async getUser(id: string) {
    const response = await fetch(`/api/users/${id}`);
    return response.json();
  }

  // Трейсинг только при ошибках
  @traceOnError('user.create', {
    includeArgs: true,
    attributes: { 'operation.type': 'create' }
  })
  async createUser(userData: any) {
    const response = await fetch('/api/users', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
    
    if (!response.ok) {
      throw new Error(`Failed to create user: ${response.status}`);
    }
    
    return response.json();
  }

  // Продвинутый трейсинг с таймаутом
  @advancedTrace({
    spanName: 'user.update',
    includeArgs: true,
    includeResult: true,
    timeout: 5000
  })
  async updateUser(id: string, data: any) {
    const response = await fetch(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    return response.json();
  }
}

```
