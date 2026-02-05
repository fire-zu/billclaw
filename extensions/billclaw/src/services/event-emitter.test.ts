/**
 * Tests for event-emitter service
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  emitEvent,
  emitTransactionNew,
  emitSyncStarted,
  emitAccountConnected,
  verifySignature,
  isTransactionEvent,
  isSyncEvent,
  isAccountEvent,
  type BillclawEvent,
} from "./event-emitter.js";

// Mock OpenClawPluginApi
const mockApi = {
  pluginConfig: {
    webhooks: [
      {
        enabled: true,
        url: "https://example.com/webhook",
        secret: "test-secret",
        events: ["transaction.new", "sync.started", "sync.completed", "account.connected"],
        retryPolicy: {
          maxRetries: 3,
          initialDelay: 1000,
          maxDelay: 30000,
        },
      },
    ],
  },
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
} as any;

// Mock fetch
global.fetch = vi.fn();

describe("Event Emitter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("emitEvent", () => {
    it("should create an event with correct structure", async () => {
      const testEvent = {
        id: expect.stringMatching(/^evt_/),
        event: "transaction.new" as const,
        timestamp: expect.any(String),
        version: "1.0",
        data: {
          accountId: "test-account",
          transactionId: "txn-123",
          amount: 100,
          currency: "USD",
        },
      };

      // Mock successful fetch response
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
      });

      await emitEvent(mockApi, "transaction.new", testEvent.data);

      expect(global.fetch).toHaveBeenCalledWith(
        "https://example.com/webhook",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            "User-Agent": "billclaw/1.0",
            "X-Billclaw-Event-Id": expect.stringMatching(/^evt_/),
            "X-Billclaw-Event-Type": "transaction.new",
            "X-Billclaw-Signature": expect.stringMatching(/^sha256=/),
          }),
          body: expect.stringContaining('"event":"transaction.new"'),
        })
      );
    });

    it("should skip webhooks that are not enabled", async () => {
      const disabledApi = {
        ...mockApi,
        pluginConfig: {
          webhooks: [
            {
              enabled: false,
              url: "https://example.com/webhook",
              events: ["transaction.new"],
            },
          ],
        },
      };

      await emitEvent(disabledApi, "transaction.new", {});

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("should skip webhooks not subscribed to the event", async () => {
      const unsubscribedApi = {
        ...mockApi,
        pluginConfig: {
          webhooks: [
            {
              enabled: true,
              url: "https://example.com/webhook",
              events: ["sync.completed"], // Not transaction.new
            },
          ],
        },
      };

      await emitEvent(unsubscribedApi, "transaction.new", {});

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("should handle webhook failures gracefully", async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error("Network error"));

      await expect(
        emitEvent(mockApi, "transaction.new", {})
      ).resolves.not.toThrow();

      expect(mockApi.logger.error).toHaveBeenCalledWith(
        expect.stringContaining("Webhook failed"),
        expect.any(Error)
      );
    });

    it("should not retry on 4xx client errors", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
      });

      await emitEvent(mockApi, "transaction.new", {});

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("Convenience Functions", () => {
    beforeEach(() => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
      });
    });

    it("should emit transaction.new event", async () => {
      await emitTransactionNew(mockApi, {
        accountId: "chase-checking",
        transactionId: "txn-123",
        date: "2025-02-05",
        amount: -5000,
        currency: "USD",
        merchantName: "Amazon",
        category: ["Shopping"],
        source: "plaid",
      });

      expect(global.fetch).toHaveBeenCalled();
      const body = JSON.parse((global.fetch as any).mock.calls[0][1].body);
      expect(body.event).toBe("transaction.new");
      expect(body.data.merchantName).toBe("Amazon");
    });

    it("should emit sync.started event", async () => {
      await emitSyncStarted(mockApi, "chase-checking", "sync-123");

      expect(global.fetch).toHaveBeenCalled();
      const body = JSON.parse((global.fetch as any).mock.calls[0][1].body);
      expect(body.event).toBe("sync.started");
      expect(body.data.accountId).toBe("chase-checking");
    });

    it("should emit account.connected event", async () => {
      await emitAccountConnected(mockApi, "chase-checking", "plaid");

      expect(global.fetch).toHaveBeenCalled();
      const body = JSON.parse((global.fetch as any).mock.calls[0][1].body);
      expect(body.event).toBe("account.connected");
      expect(body.data.accountType).toBe("plaid");
    });
  });

  describe("Signature Verification", () => {
    it("should verify correct signatures", () => {
      const payload = JSON.stringify({ id: "", event: "transaction.new", timestamp: "", version: "1.0", data: { test: "data" } });

      // Generate a valid HMAC signature
      const crypto = require("node:crypto");
      const signature = crypto.createHmac("sha256", "secret").update(payload).digest("hex");

      const isValid = verifySignature(
        payload,
        `sha256=${signature}`,
        "secret"
      );

      expect(isValid).toBe(true);
    });

    it("should reject incorrect signatures", () => {
      const payload = JSON.stringify({ test: "data" });

      const isValid = verifySignature(
        payload,
        "sha256=wrongsignature",
        "secret"
      );

      expect(isValid).toBe(false);
    });

    it("should reject signatures with wrong secret", () => {
      const payload = JSON.stringify({ test: "data" });
      const crypto = require("node:crypto");
      const signature = crypto.createHmac("sha256", "secret1").update(payload).digest("hex");

      const isValid = verifySignature(
        payload,
        `sha256=${signature}`,
        "secret2" // Different secret
      );

      expect(isValid).toBe(false);
    });
  });

  describe("Type Guards", () => {
    it("should identify transaction events", () => {
      const transactionEvent: BillclawEvent = {
        id: "evt_123",
        event: "transaction.new",
        timestamp: "2025-02-05T00:00:00Z",
        version: "1.0",
        data: {
          accountId: "test",
          transactionId: "txn-123",
          date: "2025-02-05",
          amount: 100,
          currency: "USD",
          source: "plaid",
        },
      };

      expect(isTransactionEvent(transactionEvent)).toBe(true);
      expect(isSyncEvent(transactionEvent)).toBe(false);
      expect(isAccountEvent(transactionEvent)).toBe(false);
    });

    it("should identify sync events", () => {
      const syncEvent: BillclawEvent = {
        id: "evt_123",
        event: "sync.completed",
        timestamp: "2025-02-05T00:00:00Z",
        version: "1.0",
        data: {
          accountId: "test",
          syncId: "sync-123",
          status: "completed",
          transactionsAdded: 10,
        },
      };

      expect(isTransactionEvent(syncEvent)).toBe(false);
      expect(isSyncEvent(syncEvent)).toBe(true);
      expect(isAccountEvent(syncEvent)).toBe(false);
    });

    it("should identify account events", () => {
      const accountEvent: BillclawEvent = {
        id: "evt_123",
        event: "account.connected",
        timestamp: "2025-02-05T00:00:00Z",
        version: "1.0",
        data: {
          accountId: "test",
          accountType: "plaid",
          status: "connected",
        },
      };

      expect(isTransactionEvent(accountEvent)).toBe(false);
      expect(isSyncEvent(accountEvent)).toBe(false);
      expect(isAccountEvent(accountEvent)).toBe(true);
    });
  });
});
