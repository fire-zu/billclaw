/**
 * Beancount export functionality
 *
 * This module provides functionality to export billclaw transactions
 * to the Beancount plain text accounting format.
 *
 * Beancount format reference: https://beancount.github.io/docs/beancount_language_syntax.html
 */

import type { Transaction } from "../storage/transaction-storage.js";
import { readTransactions } from "../storage/transaction-storage.js";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { StorageConfig } from "../../config.js";

/**
 * Beancount transaction options
 */
export interface BeancountExportOptions {
  accountId: string;
  year: number;
  month: number;
  commodity?: string; // Default: USD
  payeeAccount?: string; // Default: Expenses:Unknown
  tagAccounts?: Record<string, string>; // Map categories to accounts
  includeTags?: boolean; // Include tags for transaction source
  dateFormat?: string; // Default: YYYY-MM-DD
}

/**
 * Convert a billclaw transaction to Beancount format
 */
export function transactionToBeancount(
  txn: Transaction,
  options: BeancountExportOptions
): string {
  const currency = options.commodity || "USD";
  const dateFormat = options.dateFormat || "YYYY-MM-DD";

  // Format date (simplified - in production use proper date formatting)
  const date = txn.date;

  // Build payee line
  const payee = txn.merchantName || "Unknown";
  const narration = txn.category?.join(", ") || "";

  // Build tags
  let tags = "";
  if (options.includeTags) {
    const sourceTag = txn.paymentChannel === "email" ? "#gmail" : "#plaid";
    tags = ` ${sourceTag}`;
    if (txn.pending) {
      tags += " #pending";
    }
  }

  // Build transaction header
  let output = `${date} * "${payee}"${tags}\n`;

  // Add narration if present
  if (narration) {
    output += `  "${narration}"\n`;
  }

  // Determine target account based on category
  const targetAccount =
    options.tagAccounts?.[txn.category?.[0] || ""] ||
    options.payeeAccount ||
    "Expenses:Unknown";

  // Format amount (convert from cents to dollars)
  const amount = (Math.abs(txn.amount) / 100).toFixed(2);

  // Build postings
  if (txn.amount < 0) {
    // Expense/Outflow
    output += `  ${targetAccount}  ${amount} ${currency}\n`;
    output += `  Assets:Bank:Checking\n`;
  } else {
    // Income/Inflow
    output += `  Assets:Bank:Checking  ${amount} ${currency}\n`;
    output += `  ${targetAccount}\n`;
  }

  return output;
}

/**
 * Export transactions to Beancount format
 */
export async function exportToBeancount(
  api: OpenClawPluginApi,
  options: BeancountExportOptions
): Promise<string> {
  const config = api.pluginConfig as any;
  const storagePath = config.storage?.path || "~/.openclaw/billclaw";

  // Read transactions
  const storageConfig: StorageConfig = {
    path: storagePath,
    format: "json",
    encryption: { enabled: false },
  };
  const transactions = await readTransactions(
    options.accountId,
    options.year,
    options.month,
    storageConfig
  );

  if (transactions.length === 0) {
    return "; No transactions found\n";
  }

  // Build Beancount file
  let output = `;; Beancount export from billclaw\n`;
  output += `;; Account: ${options.accountId}\n`;
  output += `;; Period: ${options.year}-${String(options.month).padStart(2, "0")}\n`;
  output += `;; Exported: ${new Date().toISOString()}\n`;
  output += "\n";

  // Add each transaction
  for (const txn of transactions) {
    output += transactionToBeancount(txn, options);
    output += "\n";
  }

  return output;
}

/**
 * Export all transactions for a year to Beancount format
 */
export async function exportYearToBeancount(
  api: OpenClawPluginApi,
  accountId: string,
  year: number,
  options?: Partial<BeancountExportOptions>
): Promise<string> {
  const months: string[] = [];

  for (let month = 1; month <= 12; month++) {
    const monthData = await exportToBeancount(api, {
      accountId,
      year,
      month,
      ...options,
    });
    months.push(monthData);
  }

  return months.join("\n");
}

/**
 * Get recommended account mappings for Beancount
 *
 * Returns a suggested mapping of billclaw categories to Beancount accounts
 */
export function getBeancountAccountMappings(): Record<string, string> {
  return {
    // Food & Dining
    "Food and Drink": "Expenses:Food:Restaurants",
    "Fast Food": "Expenses:Food:FastFood",
    "Groceries": "Expenses:Food:Groceries",

    // Transportation
    "Travel": "Expenses:Travel",
    "Gasoline": "Expenses:Transport:Fuel",
    "Parking": "Expenses:Transport:Parking",
    "Taxi": "Expenses:Transport:Taxi",
    "Ride Share": "Expenses:Transport:Rideshare",
    "Public Transportation": "Expenses:Transport:Public",

    // Shopping
    "Shopping": "Expenses:Shopping:General",
    "Electronics": "Expenses:Shopping:Electronics",
    "Clothing": "Expenses:Shopping:Clothing",
    "Home Improvement": "Expenses:Home:Improvement",

    // Entertainment
    "Entertainment": "Expenses:Entertainment:General",
    "Movies": "Expenses:Entertainment:Movies",
    "Music": "Expenses:Entertainment:Music",
    "Games": "Expenses:Entertainment:Games",
    "Sports": "Expenses:Entertainment:Sports",

    // Bills & Utilities
    "Utilities": "Expenses:Utilities:General",
    "Electric": "Expenses:Utilities:Electric",
    "Gas": "Expenses:Utilities:Gas",
    "Water": "Expenses:Utilities:Water",
    "Internet": "Expenses:Utilities:Internet",
    "Phone": "Expenses:Utilities:Phone",
    "Subscription": "Expenses:Subscriptions",

    // Health
    "Healthcare": "Expenses:Health:Medical",
    "Pharmacy": "Expenses:Health:Pharmacy",
    "Insurance": "Expenses:Insurance:Health",

    // Financial
    "Finance": "Expenses:Financial:Fees",
    "Bank Fee": "Expenses:Financial:BankFees",
    "Interest": "Expenses:Financial:Interest",
    "Transfer": "Expenses:Financial:Transfer",

    // Income
    "Income": "Income:General",
    "Salary": "Income:Salary",
    "Refund": "Income:Refunds",
    "Investment": "Income:Investments",
  };
}

/**
 * Agent tool to export transactions to Beancount format
 *
 * Usage in agent:
 * ```typescript
 * const result = await exportToBeancountTool(api, {
 *   accountId: "chase-checking",
 *   year: 2025,
 *   month: 2,
 *   commodity: "USD",
 * });
 * ```
 */
export async function exportToBeancountTool(
  api: OpenClawPluginApi,
  args: {
    accountId: string;
    year: number;
    month?: number;
    commodity?: string;
    payeeAccount?: string;
    includeTags?: boolean;
  }
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const options: BeancountExportOptions = {
    accountId: args.accountId,
    year: args.year,
    month: args.month || new Date().getMonth() + 1,
    commodity: args.commodity || "USD",
    payeeAccount: args.payeeAccount,
    includeTags: args.includeTags !== false,
  };

  const beancountData = await exportToBeancount(api, options);

  return {
    content: [
      {
        type: "text",
        text: beancountData,
      },
    ],
  };
}
