import { ConfigManager } from '../config.js';
import { getOTLPCore } from '../core/otlp-core.js';

export class OTLPLazy {
  private currentSpan: any = null;
  private core = getOTLPCore();

  public async startSpan(name: string, options?: {
    attributes?: Record<string, any>;
    kind?: any;
  }): Promise<void> {
    const config = ConfigManager.getInstance();

    if (!config.getConfig().enabled) {
      return;
    }

    try {
      await this.core.initialize();
      this.currentSpan = await this.core.createSpan(name, options);
    } catch (error: unknown) {
      console.warn('Failed to start span:', error);
    }
  }

  public async endSpan(success: boolean, message?: string): Promise<void> {
    if (this.currentSpan) {
      this.currentSpan.setStatus(success, message);
      this.currentSpan.end();
      this.currentSpan = null;
    }
  }

  public async addAttribute(key: string, value: any): Promise<void> {
    if (this.currentSpan) {
      this.currentSpan.addAttribute(key, value);
    }
  }

  public async addEvent(name: string, attributes?: Record<string, any>): Promise<void> {
    if (this.currentSpan) {
      this.currentSpan.addEvent(name, attributes);
    } else {
      // Fallback для тестов и отладки
      const config = ConfigManager.getInstance();
      if (config.getConfig().debug) {
        console.log(`Event: ${name}`, attributes);
      }
    }
  }

  public isEnabled(): boolean {
    const config = ConfigManager.getInstance();
    return config.getConfig().enabled;
  }

  public async trace<T>(
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ): Promise<PropertyDescriptor> {
    if (!descriptor || typeof descriptor.value !== 'function') {
      throw new Error('Trace can only be applied to methods');
    }

    const originalMethod = descriptor.value;
    const spanName = `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      const config = ConfigManager.getInstance();

      if (!config.getConfig().enabled) {
        return originalMethod.apply(this, args);
      }

      const otlpLazy = new OTLPLazy();

      try {
        await otlpLazy.startSpan(spanName);
        const result = await originalMethod.apply(this, args);
        await otlpLazy.endSpan(true);
        return result;
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await otlpLazy.endSpan(false, errorMessage);
        throw error;
      }
    };

    return descriptor;
  }
}