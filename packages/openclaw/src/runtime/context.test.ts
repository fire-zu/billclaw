/**
 * Tests for OpenClaw runtime context adapter
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  OpenClawRuntimeContext,
  OpenClawLogger,
  OpenClawConfigProvider,
  OpenClawEventEmitter,
} from "./context.js";
import type { OpenClawPluginApi } from "../../types/openclaw-plugin.js";

// Mock OpenClaw API
const createMockApi = (): OpenClawPluginApi => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
  pluginConfig: {
    accounts: [],
    storage: {
      path: "~/.openclaw/billclaw",
      format: "json",
      encryption: { enabled: false },
    },
    sync: {
      defaultFrequency: "daily",
      maxRetries: 3,
      retryOnFailure: true,
    },
    plaid: {
      environment: "sandbox",
    },
  },
  registerTool: vi.fn(),
  registerCli: vi.fn(),
  registerOAuth: vi.fn(),
  registerService: vi.fn(),
});

describe("OpenClawLogger", () => {
  let mockApi: OpenClawPluginApi;
  let logger: OpenClawLogger;

  beforeEach(() => {
    mockApi = createMockApi();
    logger = new OpenClawLogger(mockApi);
  });

  describe("info", () => {
    it("should call api.logger.info if available", () => {
      logger.info("test message");
      expect(mockApi.logger.info).toHaveBeenCalledWith("test message");
    });

    it("should handle multiple arguments", () => {
      logger.info("message", "arg2", { key: "value" });
      expect(mockApi.logger.info).toHaveBeenCalledWith("message", "arg2", { key: "value" });
    });

    it("should not throw if info is not available", () => {
      const apiWithoutInfo = {
        ...mockApi,
        logger: {},
      };
      const logger = new OpenClawLogger(apiWithoutInfo);
      expect(() => logger.info("test")).not.toThrow();
    });
  });

  describe("error", () => {
    it("should call api.logger.error if available", () => {
      logger.error("error message");
      expect(mockApi.logger.error).toHaveBeenCalledWith("error message");
    });

    it("should not throw if error is not available", () => {
      const apiWithoutError = {
        ...mockApi,
        logger: {},
      };
      const logger = new OpenClawLogger(apiWithoutError);
      expect(() => logger.error("test")).not.toThrow();
    });
  });

  describe("warn", () => {
    it("should call api.logger.warn if available", () => {
      logger.warn("warning message");
      expect(mockApi.logger.warn).toHaveBeenCalledWith("warning message");
    });
  });

  describe("debug", () => {
    it("should call api.logger.debug if DEBUG env var is set", () => {
      const originalDebug = process.env.DEBUG;
      process.env.DEBUG = "1";

      logger.debug("debug message");
      expect(mockApi.logger.debug).toHaveBeenCalledWith("debug message");

      process.env.DEBUG = originalDebug;
    });

    it("should not call api.logger.debug if DEBUG env var is not set", () => {
      const originalDebug = process.env.DEBUG;
      delete process.env.DEBUG;

      logger.debug("debug message");
      expect(mockApi.logger.debug).not.toHaveBeenCalled();

      if (originalDebug) {
        process.env.DEBUG = originalDebug;
      }
    });
  });
});

describe("OpenClawConfigProvider", () => {
  let mockApi: OpenClawPluginApi;
  let provider: OpenClawConfigProvider;

  beforeEach(() => {
    mockApi = createMockApi();
    provider = new OpenClawConfigProvider(mockApi);
  });

  describe("getConfig", () => {
    it("should return plugin config", async () => {
      const config = await provider.getConfig();
      expect(config).toEqual(mockApi.pluginConfig);
    });

    it("should cache config", async () => {
      const config1 = await provider.getConfig();
      const config2 = await provider.getConfig();
      expect(config1).toBe(config2); // Same reference
    });
  });

  describe("getStorageConfig", () => {
    it("should return storage config", async () => {
      const storageConfig = await provider.getStorageConfig();
      expect(storageConfig).toBeDefined();
      expect(storageConfig.path).toBe("~/.openclaw/billclaw");
    });

    it("should return default storage config if not set", async () => {
      const apiWithoutStorage = {
        ...mockApi,
        pluginConfig: {},
      };
      const provider = new OpenClawConfigProvider(apiWithoutStorage);

      const storageConfig = await provider.getStorageConfig();
      expect(storageConfig).toBeDefined();
      expect(storageConfig.path).toBe("~/.openclaw/billclaw");
    });
  });

  describe("updateAccount", () => {
    it("should log account update", async () => {
      await provider.updateAccount("test-id", { enabled: true });
      expect(mockApi.logger.info).toHaveBeenCalledWith(
        "Account test-id updated:",
        { enabled: true }
      );
    });
  });

  describe("getAccount", () => {
    beforeEach(() => {
      mockApi.pluginConfig = {
        ...mockApi.pluginConfig,
        accounts: [
          {
            id: "test-1",
            type: "plaid",
            name: "Test Account",
            enabled: true,
            syncFrequency: "daily",
          },
        ],
      };
    });

    it("should return account if found", async () => {
      const account = await provider.getAccount("test-1");
      expect(account).toBeDefined();
      expect(account?.id).toBe("test-1");
    });

    it("should return null if not found", async () => {
      const account = await provider.getAccount("non-existent");
      expect(account).toBeNull();
    });
  });
});

describe("OpenClawEventEmitter", () => {
  let emitter: OpenClawEventEmitter;

  beforeEach(() => {
    emitter = new OpenClawEventEmitter();
  });

  describe("on and emit", () => {
    it("should call registered handlers on emit", () => {
      const handler = vi.fn();
      emitter.on("test-event", handler);

      emitter.emit("test-event", { data: "test" });

      expect(handler).toHaveBeenCalledWith({ data: "test" });
    });

    it("should support multiple handlers for same event", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      emitter.on("test-event", handler1);
      emitter.on("test-event", handler2);

      emitter.emit("test-event");

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    it("should not call handlers for different events", () => {
      const handler = vi.fn();
      emitter.on("event-a", handler);

      emitter.emit("event-b");

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("off", () => {
    it("should remove specific handler", () => {
      const handler = vi.fn();
      emitter.on("test-event", handler);

      emitter.off("test-event", handler);
      emitter.emit("test-event");

      expect(handler).not.toHaveBeenCalled();
    });

    it("should not affect other handlers", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      emitter.on("test-event", handler1);
      emitter.on("test-event", handler2);

      emitter.off("test-event", handler1);
      emitter.emit("test-event");

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("should continue if handler throws", () => {
      const errorHandler = vi.fn(() => {
        throw new Error("Test error");
      });
      const successHandler = vi.fn();

      emitter.on("test-event", errorHandler);
      emitter.on("test-event", successHandler);

      // Should not throw
      expect(() => emitter.emit("test-event")).not.toThrow();

      expect(errorHandler).toHaveBeenCalled();
      expect(successHandler).toHaveBeenCalled();
    });
  });
});

describe("OpenClawRuntimeContext", () => {
  let mockApi: OpenClawPluginApi;
  let context: OpenClawRuntimeContext;

  beforeEach(() => {
    mockApi = createMockApi();
    context = new OpenClawRuntimeContext(mockApi);
  });

  it("should provide logger instance", () => {
    expect(context.logger).toBeInstanceOf(OpenClawLogger);
  });

  it("should provide config provider instance", () => {
    expect(context.config).toBeInstanceOf(OpenClawConfigProvider);
  });

  it("should provide event emitter instance", () => {
    expect(context.events).toBeInstanceOf(OpenClawEventEmitter);
  });

  it("should have readonly properties", () => {
    expect(Object.getOwnPropertyDescriptor(context, "logger")?.writable).toBe(false);
    expect(Object.getOwnPropertyDescriptor(context, "config")?.writable).toBe(false);
    expect(Object.getOwnPropertyDescriptor(context, "events")?.writable).toBe(false);
  });
});
