/**
 * Gmail fetch tool - fetches and parses bills from Gmail
 */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { BillclawConfig, AccountConfig } from "../../config.js";
import {
  fetchBillEmails,
  type EmailContent,
} from "../services/gmail-fetcher.js";
import {
  filterBills,
  recognizeBill,
  recognizeBillWithPluginConfig,
} from "../services/bill-recognizer.js";
import {
  batchParseEmails,
  parseEmailToTransactions,
  toStorageTransaction,
  type ParserResult,
  type ParsedTransaction,
} from "../services/email-parser.js";
import {
  appendTransactions,
  deduplicateTransactions,
} from "../storage/transaction-storage.js";

export interface GmailFetchParams {
  accountId?: string;
  days?: number;
}

export interface GmailFetchResult {
  success: boolean;
  accountId: string;
  emailsProcessed: number;
  billsExtracted: number;
  transactionsAdded: number;
  transactionsUpdated: number;
  errors?: string[];
}

/**
 * OpenClaw tool return format
 */
interface ToolReturn {
  content: Array<{ type: string; text: string }>;
}

/**
 * Convert GmailFetchResult to OpenClaw tool return format
 */
export function toToolReturn(result: GmailFetchResult): ToolReturn {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}

/**
 * Get Gmail account ID from config
 */
function getGmailAccountId(
  config: BillclawConfig,
  paramsAccountId?: string
): string {
  // Find Gmail account in config
  const gmailAccounts = (config.accounts || []).filter(
    (acc) => acc.type === "gmail" && acc.enabled
  );

  if (gmailAccounts.length === 0) {
    throw new Error(
      "No Gmail accounts configured. Run 'openclaw bills setup' first."
    );
  }

  // Use provided account ID or first Gmail account
  if (paramsAccountId) {
    const account = gmailAccounts.find((acc) => acc.id === paramsAccountId);
    if (!account) {
      throw new Error(`Gmail account not found: ${paramsAccountId}`);
    }
    return paramsAccountId;
  }

  return gmailAccounts[0].id;
}

/**
 * Fetch bills from Gmail for the specified time period
 * Returns OpenClaw tool format: { content: [{ type: "text", text: "..." }] }
 */
export async function gmailFetchTool(
  api: OpenClawPluginApi,
  params: GmailFetchParams = {}
): Promise<ToolReturn> {
  const config = api.pluginConfig as BillclawConfig;
  const days = params.days ?? 30;

  const accountId = getGmailAccountId(config, params.accountId);

  try {
    // Step 1: Fetch emails from Gmail
    api.logger.info?.(
      `Fetching emails from last ${days} days for account ${accountId}...`
    );
    const emails = await fetchBillEmails(api, days);

    api.logger.info?.(`Found ${emails.length} emails`);

    if (emails.length === 0) {
      return toToolReturn({
        success: true,
        accountId,
        emailsProcessed: 0,
        billsExtracted: 0,
        transactionsAdded: 0,
        transactionsUpdated: 0,
      });
    }

    // Step 2: Recognize which emails are bills
    api.logger.info?.("Recognizing bills from emails...");

    // Use config-aware recognition if Gmail config is available
    const hasGmailConfig = config.gmail &&
      (config.gmail.senderWhitelist?.length > 0 ||
       config.gmail.keywords?.length > 0 ||
       config.gmail.confidenceThreshold !== undefined);

    const emailsWithRecognition = emails.map((email) => ({
      email,
      recognition: hasGmailConfig
        ? recognizeBillWithPluginConfig(email, config)
        : recognizeBill(email),
    }));

    // Filter to only bills
    const bills = emailsWithRecognition.filter(
      ({ recognition }) => recognition.isBill
    );
    api.logger.info?.(`Identified ${bills.length} bill emails`);

    if (bills.length === 0) {
      return toToolReturn({
        success: true,
        accountId,
        emailsProcessed: emails.length,
        billsExtracted: 0,
        transactionsAdded: 0,
        transactionsUpdated: 0,
      });
    }

    // Step 3: Parse emails into transactions
    api.logger.info?.("Parsing bill emails into transactions...");
    const parsedTransactions = batchParseEmails(accountId, bills);
    api.logger.info?.(
      `Parsed ${parsedTransactions.length} transactions from bills`
    );

    // Step 4: Deduplicate against existing transactions
    api.logger.info?.("Deduplicating transactions...");

    // Convert to storage format first
    const storageTransactions = parsedTransactions.map((t) => ({
      transactionId: t.transactionId,
      plaidTransactionId: t.transactionId,
      accountId: t.accountId,
      date: t.date,
      amount: t.amount,
      currency: t.currency,
      category: t.category,
      merchantName: t.merchantName || "",
      paymentChannel: t.paymentChannel || "email",
      pending: t.pending,
      createdAt: new Date().toISOString(),
    }));

    const newTransactions = deduplicateTransactions(storageTransactions);

    // Step 5: Store new transactions
    api.logger.info?.("Storing transactions...");

    // Get current year/month for storage
    const now = new Date();
    const storageResult = await appendTransactions(
      accountId,
      now.getFullYear(),
      now.getMonth() + 1,
      storageTransactions
    );

    // Step 6: Log bill details
    for (const bill of bills) {
      api.logger.info?.(
        `Bill: ${bill.email.subject} from ${bill.email.from} (confidence: ${bill.recognition.confidence.toFixed(2)})`
      );
      if (bill.recognition.amount) {
        api.logger.info?.(
          `  Amount: ${bill.recognition.currency} ${bill.recognition.amount}`
        );
      }
      if (bill.recognition.dueDate) {
        api.logger.info?.(`  Due Date: ${bill.recognition.dueDate}`);
      }
    }

    return toToolReturn({
      success: true,
      accountId,
      emailsProcessed: emails.length,
      billsExtracted: bills.length,
      transactionsAdded: storageResult.added,
      transactionsUpdated: storageResult.updated,
    });
  } catch (error) {
    const errorMsg =
      error instanceof Error ? error.message : "Unknown error occurred";

    api.logger.error?.(`Gmail fetch failed: ${errorMsg}`);

    return toToolReturn({
      success: false,
      accountId,
      emailsProcessed: 0,
      billsExtracted: 0,
      transactionsAdded: 0,
      transactionsUpdated: 0,
      errors: [errorMsg],
    });
  }
}

/**
 * Helper: parse bill from a specific email (for Agent use)
 */
export async function parseBillFromEmail(
  api: OpenClawPluginApi,
  email: EmailContent
): Promise<ParserResult> {
  const accountId = "gmail_manual"; // Default account for manual parsing

  const recognition = recognizeBill(email);

  if (!recognition.isBill) {
    return {
      success: false,
      transactions: [],
      errors: ["Email not recognized as a bill"],
    };
  }

  return {
    success: true,
    transactions: parseEmailToTransactions(accountId, email, recognition),
  };
}
