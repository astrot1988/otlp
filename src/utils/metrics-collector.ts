import { ConfigManager } from '../config.js';

export interface Metric {
  name: string;
  value: number;
  timestamp: number;
  tags: Record<string, string>;
  type: 'counter' | 'gauge' | 'histogram' | 'timer';
}

export class MetricsCollector {
  private static instance: MetricsCollector;
  private metrics: Metric[] = [];
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();
  private timers: Map<string, number> = new Map();

  private constructor() {}

  public static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector();
    }
    return MetricsCollector.instance;
  }

  public counter(name: string, value: number = 1, tags: Record<string, string> = {}): void {
    if (!ConfigManager.getInstance().isEnabled()) return;

    const currentValue = this.counters.get(name) || 0;
    this.counters.set(name, currentValue + value);

    this.addMetric({
      name,
      value: currentValue + value,
      timestamp: Date.now(),
      tags,
      type: 'counter'
    });
  }

  public gauge(name: string, value: number, tags: Record<string, string> = {}): void {
    if (!ConfigManager.getInstance().isEnabled()) return;

    this.gauges.set(name, value);

    this.addMetric({
      name,
      value,
      timestamp: Date.now(),
      tags,
      type: 'gauge'
    });
  }

  public histogram(name: string, value: number, tags: Record<string, string> = {}): void {
    if (!ConfigManager.getInstance().isEnabled()) return;

    this.addMetric({
      name,
      value,
      timestamp: Date.now(),
      tags,
      type: 'histogram'
    });
  }

  public startTimer(name: string): () => void {
    if (!ConfigManager.getInstance().isEnabled()) {
      return () => {}; // No-op
    }

    const startTime = Date.now();
    this.timers.set(name, startTime);

    return () => {
      const endTime = Date.now();
      const duration = endTime - startTime;

      this.addMetric({
        name,
        value: duration,
        timestamp: endTime,
        tags: {},
        type: 'timer'
      });

      this.timers.delete(name);
    };
  }

  public getMetrics(): Metric[] {
    return [...this.metrics];
  }

  public getCounterValue(name: string): number {
    return this.counters.get(name) || 0;
  }

  public getGaugeValue(name: string): number {
    return this.gauges.get(name) || 0;
  }

  public clearMetrics(): void {
    this.metrics = [];
  }

  public getMetricsSummary(): Record<string, any> {
    return {
      totalMetrics: this.metrics.length,
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      activeTimers: this.timers.size
    };
  }

  private addMetric(metric: Metric): void {
    this.metrics.push(metric);

    // Ограничиваем количество метрик в памяти
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-500); // Оставляем последние 500
    }

    if (ConfigManager.getInstance().getConfig().debug) {
      console.log('[Metrics]', metric);
    }
  }
}