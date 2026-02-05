/**
 * Tests for Beancount export functionality
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  transactionToBeancount,
  getBeancountAccountMappings,
  type BeancountExportOptions,
} from "./beancount.js";
import type { Transaction } from "../storage/transaction-storage.js";

// Mock OpenClawPluginApi
const mockApi = {
  pluginConfig: {
    storage: {
      path: "~/.openclaw/billclaw",
    },
  },
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
} as any;

describe("Beancount Export", () => {
  const sampleTransaction: Transaction = {
    transactionId: "txn_123",
    accountId: "chase-checking",
    date: "2025-02-05",
    amount: -5000,
    currency: "USD",
    category: ["Shopping", "Electronics"],
    merchantName: "Amazon",
    paymentChannel: "online",
    pending: false,
    plaidTransactionId: "plaid_txn_123",
    createdAt: "2025-02-05T10:00:00Z",
  };

  const options: BeancountExportOptions = {
    accountId: "chase-checking",
    year: 2025,
    month: 2,
    commodity: "USD",
    payeeAccount: "Expenses:Shopping",
    includeTags: true,
  };

  describe("transactionToBeancount", () => {
    it("should convert transaction to Beancount format", () => {
      const result = transactionToBeancount(sampleTransaction, options);

      expect(result).toContain("2025-02-05");
      expect(result).toContain('* "Amazon"');
      expect(result).toContain("#plaid");
      expect(result).toContain("Expenses:Shopping");
      expect(result).toContain("50.00"); // Amount in dollars
      expect(result).toContain("USD");
      expect(result).toContain("Assets:Bank:Checking");
    });

    it("should include tags when requested", () => {
      const result = transactionToBeancount(sampleTransaction, options);

      expect(result).toContain("#plaid");
    });

    it("should include pending tag for pending transactions", () => {
      const pendingTxn = { ...sampleTransaction, pending: true };
      const result = transactionToBeancount(pendingTxn, options);

      expect(result).toContain("#pending");
    });

    it("should use different tag for Gmail transactions", () => {
      const gmailTxn = { ...sampleTransaction, paymentChannel: "email" };
      const result = transactionToBeancount(gmailTxn, options);

      expect(result).toContain("#gmail");
      expect(result).not.toContain("#plaid");
    });

    it("should handle positive amounts (income)", () => {
      const incomeTxn = { ...sampleTransaction, amount: 100000 };
      const result = transactionToBeancount(incomeTxn, options);

      expect(result).toContain("1000.00"); // Amount in dollars
      expect(result).toContain("USD");
      // Income should credit the target account
      expect(result.split("\n")[2]).toContain("Assets:Bank:Checking");
    });

    it("should include category in narration", () => {
      const result = transactionToBeancount(sampleTransaction, options);

      expect(result).toContain('"Shopping, Electronics"');
    });

    it("should handle transactions without category", () => {
      const noCategoryTxn = { ...sampleTransaction, category: [] };
      const result = transactionToBeancount(noCategoryTxn, options);

      // Should not include a narration line
      expect(result).not.toContain('"\n  "');
    });

    it("should handle transactions without merchant name", () => {
      const noMerchantTxn = { ...sampleTransaction, merchantName: "" };
      const result = transactionToBeancount(noMerchantTxn, options);

      expect(result).toContain('* "Unknown"');
    });

    it("should use custom payee account if provided", () => {
      const customOptions = { ...options, payeeAccount: "Expenses:Custom" };
      const result = transactionToBeancount(sampleTransaction, customOptions);

      expect(result).toContain("Expenses:Custom");
    });

    it("should use category mapping if provided", () => {
      const categoryMapOptions = {
        ...options,
        tagAccounts: {
          "Shopping": "Expenses:Shopping:Online",
        },
      };
      const result = transactionToBeancount(
        sampleTransaction,
        categoryMapOptions
      );

      expect(result).toContain("Expenses:Shopping:Online");
    });
  });

  describe("getBeancountAccountMappings", () => {
    it("should return account mappings for common categories", () => {
      const mappings = getBeancountAccountMappings();

      expect(mappings).toHaveProperty("Food and Drink", "Expenses:Food:Restaurants");
      expect(mappings).toHaveProperty("Groceries", "Expenses:Food:Groceries");
      expect(mappings).toHaveProperty("Gasoline", "Expenses:Transport:Fuel");
      expect(mappings).toHaveProperty("Utilities", "Expenses:Utilities:General");
      expect(mappings).toHaveProperty("Healthcare", "Expenses:Health:Medical");
      expect(mappings).toHaveProperty("Income", "Income:General");
    });

    it("should include mappings for all major categories", () => {
      const mappings = getBeancountAccountMappings();

      // Should have at least 20 mappings
      expect(Object.keys(mappings).length).toBeGreaterThanOrEqual(20);
    });
  });
});
