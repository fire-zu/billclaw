/**
 * Minimal OpenClaw SDK type stubs for development
 * These will be replaced by the actual SDK types when installed
 */

declare module "openclaw/plugin-sdk" {
  export interface OpenClawLogger {
    info(...args: unknown[]): void;
    error(...args: unknown[]): void;
    warn(...args: unknown[]): void;
    debug(...args: unknown[]): void;
  }

  export interface OpenClawHttpApi {
    register(route: {
      path: string;
      method: string;
      handler: (request: {
        body: unknown;
        headers: Record<string, string>;
        query: Record<string, string>;
      }) => Promise<{
        status: number;
        body: unknown;
      }>;
    }): void;
  }

  export interface OpenClawPluginApi {
    readonly pluginConfig: unknown;
    logger: OpenClawLogger;
    http?: OpenClawHttpApi;

    registerTool(
      tool: {
        name: string;
        label: string;
        description: string;
        parameters: unknown;
        execute: (toolCallId: string, params: unknown) => unknown;
      },
      options?: { name?: string }
    ): void;

    registerCli(
      registration: (args: { program: any }) => void,
      options?: { commands?: string[] }
    ): void;

    registerOAuth(config: {
      name: string;
      description: string;
      handler: (context: OpenClawPluginApi) => unknown;
    }): void;

    registerService(config: {
      id: string;
      start: () => Promise<void>;
      stop: () => Promise<void>;
    }): void;
  }
}

declare module "@sinclair/typebox" {
  export const Type: {
    Object(properties?: Record<string, unknown>, options?: unknown): unknown;
    String(options?: unknown): unknown;
    Number(options?: unknown): unknown;
    Boolean(options?: unknown): unknown;
    Optional<T>(type: T): T;
  };
}
