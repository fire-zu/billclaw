/**
 * OpenClaw runtime context adapter
 *
 * Adapts OpenClaw's plugin API to BillClaw's runtime abstractions.
 */

import type { OpenClawPluginApi } from "../types/openclaw-plugin.js";
import type {
  RuntimeContext,
  ConfigProvider,
  Logger,
  EventEmitter,
} from "@fire-zu/billclaw-core";
import type { BillclawConfig } from "@fire-zu/billclaw-core";

/**
 * OpenClaw logger adapter
 */
export class OpenClawLogger implements Logger {
  constructor(private api: OpenClawPluginApi) {}

  info(...args: unknown[]): void {
    this.api.logger.info?.(...args);
  }

  error(...args: unknown[]): void {
    this.api.logger.error?.(...args);
  }

  warn(...args: unknown[]): void {
    this.api.logger.warn?.(...args);
  }

  debug(...args: unknown[]): void {
    if (process.env.DEBUG) {
      this.api.logger.debug?.(...args);
    }
  }
}

/**
 * OpenClaw config provider
 */
export class OpenClawConfigProvider implements ConfigProvider {
  private cachedConfig?: BillclawConfig;

  constructor(private api: OpenClawPluginApi) {}

  async getConfig(): Promise<BillclawConfig> {
    if (!this.cachedConfig) {
      // Get config from OpenClaw's plugin config
      const config = this.api.pluginConfig as BillclawConfig;
      this.cachedConfig = config;
    }

    return this.cachedConfig;
  }

  async getStorageConfig(): Promise<any> {
    const config = await this.getConfig();
    return config.storage || {
      path: "~/.openclaw/billclaw",
      format: "json",
      encryption: { enabled: false },
    };
  }

  async updateAccount(accountId: string, updates: Partial<any>): Promise<void> {
    // This would need to update OpenClaw's config
    // For now, just log the update
    this.api.logger.info?.(`Account ${accountId} updated:`, updates);
  }

  async getAccount(accountId: string): Promise<any | null> {
    const config = await this.getConfig();
    return config.accounts.find((a) => a.id === accountId) || null;
  }
}

/**
 * OpenClaw event emitter adapter
 */
export class OpenClawEventEmitter implements EventEmitter {
  private listeners = new Map<string, Set<(...args: any[]) => void>>();

  emit(event: string, data?: unknown): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      }
    }
  }

  on(event: string, handler: (...args: any[]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
  }

  off(event: string, handler: (...args: any[]) => void): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }
}

/**
 * OpenClaw runtime context
 */
export class OpenClawRuntimeContext implements RuntimeContext {
  private _logger: Logger;
  private _config: ConfigProvider;
  private _events: EventEmitter;

  constructor(api: OpenClawPluginApi) {
    this._logger = new OpenClawLogger(api);
    this._config = new OpenClawConfigProvider(api);
    this._events = new OpenClawEventEmitter();

    // Define readonly properties at runtime
    Object.defineProperty(this, "logger", {
      value: this._logger,
      writable: false,
      enumerable: true,
      configurable: false,
    });

    Object.defineProperty(this, "config", {
      value: this._config,
      writable: false,
      enumerable: true,
      configurable: false,
    });

    Object.defineProperty(this, "events", {
      value: this._events,
      writable: false,
      enumerable: true,
      configurable: false,
    });
  }

  get logger(): Logger {
    return this._logger;
  }

  get config(): ConfigProvider {
    return this._config;
  }

  get events(): EventEmitter {
    return this._events;
  }
}
