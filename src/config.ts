export interface OTLPConfig {
  enabled: boolean;
  serviceName?: string;
  serviceVersion?: string;
  endpoint?: string;
  headers?: Record<string, string>;
  debug?: boolean;
  traceOnErrorOnly?: boolean;
  enableAutoInstrumentation?: boolean;
}

export class ConfigManager {
  private static instance: ConfigManager;
  private config: OTLPConfig = {
    enabled: false,
    serviceName: 'unknown-service',
    serviceVersion: '1.0.0',
    debug: false,
    traceOnErrorOnly: false,
    enableAutoInstrumentation: false
  };

  private constructor() {
    this.loadFromEnvironment();
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  public setConfig(config: Partial<OTLPConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public getConfig(): OTLPConfig {
    return { ...this.config };
  }

  private loadFromEnvironment(): void {
    if (typeof process !== 'undefined' && process.env) {
      this.config = {
        ...this.config,
        enabled: process.env.OTLP_ENABLED === 'true',
        serviceName: process.env.OTLP_SERVICE_NAME || this.config.serviceName,
        serviceVersion: process.env.OTLP_SERVICE_VERSION || this.config.serviceVersion,
        endpoint: process.env.OTLP_ENDPOINT || this.config.endpoint,
        debug: process.env.OTLP_DEBUG === 'true'
      };
    }
  }
}

export const otlpConfig = ConfigManager.getInstance();