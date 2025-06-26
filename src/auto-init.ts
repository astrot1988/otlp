// Файл для автоматической инициализации при импорте
import { OTLP } from './otlp.js';

// Автоматическая инициализация при импорте модуля
if (typeof window !== 'undefined' && window.SETTINGS?.OTEL_EXPORTER_OTLP_ENDPOINT_FRONT) {
  new OTLP();
}