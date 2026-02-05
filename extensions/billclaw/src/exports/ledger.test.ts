/**
 * Tests for Ledger export functionality
 */

import { describe, it, expect } from "vitest";
import {
  transactionToLedger,
  getLedgerAccountMappings,
  type LedgerExportOptions,
} from "./ledger.js";
import type { Transaction } from "../storage/transaction-storage.js";

describe("Ledger Export", () => {
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

  const options: LedgerExportOptions = {
    accountId: "chase-checking",
    year: 2025,
    month: 2,
    commodity: "$",
    payeeAccount: "Expenses:Shopping",
    includeTags: true,
  };

  describe("transactionToLedger", () => {
    it("should convert transaction to Ledger format", () => {
      const result = transactionToLedger(sampleTransaction, options);

      expect(result).toContain("2025/02/05");
      expect(result).toContain("Amazon");
      expect(result).toContain("; :#plaid:");
      expect(result).toContain("Expenses:Shopping");
      expect(result).toContain("$50"); // Amount in dollars
      expect(result).toContain("Assets:Bank:Checking");
    });

    it("should include tags when requested", () => {
      const result = transactionToLedger(sampleTransaction, options);

      expect(result).toContain("; :#plaid:");
    });

    it("should include pending tag for pending transactions", () => {
      const pendingTxn = { ...sampleTransaction, pending: true };
      const result = transactionToLedger(pendingTxn, options);

      expect(result).toContain(":pending:");
    });

    it("should use different tag for Gmail transactions", () => {
      const gmailTxn = { ...sampleTransaction, paymentChannel: "email" };
      const result = transactionToLedger(gmailTxn, options);

      expect(result).toContain("; :#gmail:");
      expect(result).not.toContain(":#plaid:");
    });

    it("should handle positive amounts (income)", () => {
      const incomeTxn = { ...sampleTransaction, amount: 100000 };
      const result = transactionToLedger(incomeTxn, options);

      expect(result).toContain("$1000"); // Amount in dollars
      // Income should credit the target account (line 1 in Ledger format)
      expect(result.split("\n")[1]).toContain("Assets:Bank:Checking");
    });

    it("should not include narration line (Ledger uses payee only)", () => {
      const result = transactionToLedger(sampleTransaction, options);

      // Ledger format doesn't have a separate narration line
      // Format: date + payee + 2 postings + optional tags = 4-5 lines
      const lines = result.split("\n").filter((l) => l.trim().length > 0);
      expect(lines.length).toBeLessThanOrEqual(5);
    });

    it("should handle transactions without merchant name", () => {
      const noMerchantTxn = { ...sampleTransaction, merchantName: "" };
      const result = transactionToLedger(noMerchantTxn, options);

      expect(result).toContain("Unknown");
    });

    it("should use custom payee account if provided", () => {
      const customOptions = { ...options, payeeAccount: "Expenses:Custom" };
      const result = transactionToLedger(sampleTransaction, customOptions);

      expect(result).toContain("Expenses:Custom");
    });

    it("should use category mapping if provided", () => {
      const categoryMapOptions = {
        ...options,
        tagAccounts: {
          Shopping: "Expenses:Shopping:Online",
        },
      };
      const result = transactionToLedger(sampleTransaction, categoryMapOptions);

      expect(result).toContain("Expenses:Shopping:Online");
    });

    it("should use correct date format (YYYY/MM/DD)", () => {
      const result = transactionToLedger(sampleTransaction, options);

      expect(result).toMatch(/\d{4}\/\d{2}\/\d{2}/);
    });
  });

  describe("getLedgerAccountMappings", () => {
    it("should return account mappings for common categories", () => {
      const mappings = getLedgerAccountMappings();

      expect(mappings).toHaveProperty("Food and Drink", "Expenses:Food:Restaurants");
      expect(mappings).toHaveProperty("Groceries", "Expenses:Food:Groceries");
      expect(mappings).toHaveProperty("Gasoline", "Expenses:Transport:Fuel");
      expect(mappings).toHaveProperty("Utilities", "Expenses:Utilities:General");
      expect(mappings).toHaveProperty("Healthcare", "Expenses:Health:Medical");
      expect(mappings).toHaveProperty("Income", "Income:General");
    });

    it("should include mappings for all major categories", () => {
      const mappings = getLedgerAccountMappings();

      // Should have at least 20 mappings
      expect(Object.keys(mappings).length).toBeGreaterThanOrEqual(20);
    });
  });
});
