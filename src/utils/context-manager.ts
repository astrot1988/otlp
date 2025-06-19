import { ConfigManager } from '../config.js';

export interface TraceContext {
  traceId: string;
  spanId: string;
  baggage: Record<string, any>;
  startTime: number;
}

export class ContextManager {
  private static instance: ContextManager;
  private contexts: Map<string, TraceContext> = new Map();
  private currentContext: TraceContext | null = null;

  private constructor() {}

  public static getInstance(): ContextManager {
    if (!ContextManager.instance) {
      ContextManager.instance = new ContextManager();
    }
    return ContextManager.instance;
  }

  public createContext(name: string): TraceContext {
    const context: TraceContext = {
      traceId: this.generateId(),
      spanId: this.generateId(),
      baggage: {},
      startTime: Date.now()
    };

    this.contexts.set(name, context);
    this.currentContext = context;

    if (ConfigManager.getInstance().getConfig().debug) {
      console.log(`[Context] Created context: ${name}`, context);
    }

    return context;
  }

  public getContext(name?: string): TraceContext | null {
    if (name) {
      return this.contexts.get(name) || null;
    }
    return this.currentContext;
  }

  public setCurrentContext(context: TraceContext): void {
    this.currentContext = context;
  }

  public addBaggage(key: string, value: any, contextName?: string): void {
    const context = contextName ? this.contexts.get(contextName) : this.currentContext;
    if (context) {
      context.baggage[key] = value;
    }
  }

  public getBaggage(key: string, contextName?: string): any {
    const context = contextName ? this.contexts.get(contextName) : this.currentContext;
    return context?.baggage[key];
  }

  public clearContext(name?: string): void {
    if (name) {
      this.contexts.delete(name);
    } else {
      this.currentContext = null;
    }
  }

  public getAllContexts(): Record<string, TraceContext> {
    return Object.fromEntries(this.contexts);
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
}