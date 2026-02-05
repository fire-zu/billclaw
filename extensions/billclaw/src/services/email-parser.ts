/**
 * Email parser service
 *
 * This module extracts structured transaction data from bill emails.
 * It handles various email formats (HTML, plain text) and produces
 * normalized transaction records compatible with Plaid format.
 */

import type { EmailContent } from "./gmail-fetcher.js";
import type { BillType, RecognitionResult } from "./bill-recognizer.js";
import type { Transaction } from "../storage/transaction-storage.js";

/**
 * Parsed transaction data
 */
export interface ParsedTransaction {
  transactionId: string;
  accountId: string;
  date: string;
  name: string;
  amount: number;
  currency: string;
  category: string[];
  merchantName?: string;
  paymentChannel?: string;
  pending: boolean;
  dueDate?: string;
  accountNumber?: string;
  billType?: BillType;
  metadata: {
    source: "gmail";
    emailId: string;
    emailSubject: string;
    emailFrom: string;
    parsedAt: string;
  };
}

/**
 * Parser result
 */
export interface ParserResult {
  success: boolean;
  transactions: ParsedTransaction[];
  errors?: string[];
}

/**
 * Parse email content into structured transaction data
 */
export function parseEmailToTransactions(
  accountId: string,
  email: EmailContent,
  recognition: RecognitionResult
): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];

  // Generate transaction ID from email ID
  const transactionId = `gmail_${email.id}`;

  // Create base transaction
  const transaction: ParsedTransaction = {
    transactionId,
    accountId,
    date: new Date(email.date).toISOString().split("T")[0],
    name: recognition.merchant || recognition.billType || "Bill Payment",
    amount: recognition.amount || 0,
    currency: recognition.currency || "USD",
    category: inferCategory(recognition.billType),
    merchantName: recognition.merchant,
    paymentChannel: "email",
    pending: false,
    dueDate: recognition.dueDate,
    accountNumber: recognition.accountNumber,
    billType: recognition.billType,
    metadata: {
      source: "gmail",
      emailId: email.id,
      emailSubject: email.subject,
      emailFrom: email.from,
      parsedAt: new Date().toISOString(),
    },
  };

  transactions.push(transaction);

  // If it's a credit card statement, try to extract individual transactions
  if (recognition.billType === "credit_card_statement") {
    const lineItems = extractLineItems(email);
    transactions.push(...lineItems);
  }

  return transactions;
}

/**
 * Infer transaction category from bill type
 */
function inferCategory(billType?: BillType): string[] {
  const categoryMap: Record<BillType, string[]> = {
    credit_card_statement: ["Finance", "Credit Card"],
    utility_bill: ["Utilities", "Housing"],
    subscription: ["Entertainment", "Software"],
    insurance: ["Insurance", "Finance"],
    phone_bill: ["Utilities", "Phone"],
    internet_bill: ["Utilities", "Internet"],
    rent: ["Housing", "Rent"],
    loan_payment: ["Finance", "Loan"],
    invoice: ["Services", "Business"],
    receipt: ["Shopping", "Retail"],
    other: ["Uncategorized"],
  };

  return categoryMap[billType || "other"];
}

/**
 * Extract line items from credit card statement emails
 */
function extractLineItems(email: EmailContent): ParsedTransaction[] {
  const items: ParsedTransaction[] = [];

  // Try to parse HTML tables
  const tableItems = extractTableItems(email.body);
  if (tableItems.length > 0) {
    return tableItems;
  }

  // Try to parse text-based lists
  const textItems = extractTextListItems(email.body);
  if (textItems.length > 0) {
    return textItems;
  }

  return items;
}

/**
 * Extract items from HTML tables in email body
 */
function extractTableItems(html: string): ParsedTransaction[] {
  const items: ParsedTransaction[] = [];

  // Simple HTML table parsing (for more robust parsing, consider using a library)
  const tablePattern =
    /<table[^>]*>(.*?)<\/table>/gis;
  const rowPattern = /<tr[^>]*>(.*?)<\/tr>/gis;
  const cellPattern = /<t[dh][^>]*>(.*?)<\/t[dh]>/gis;

  const tableMatches = html.matchAll(tablePattern);

  for (const tableMatch of tableMatches) {
    const tableHtml = tableMatch[1];
    const rows = Array.from(tableHtml.matchAll(rowPattern));

    // Skip header row
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i][1];
      const cells = Array.from(row.matchAll(cellPattern));

      if (cells.length >= 3) {
        // Expected format: [Date, Description, Amount]
        const date = stripHtml(cells[0][1]).trim();
        const description = stripHtml(cells[1][1]).trim();
        const amount = parseAmount(stripHtml(cells[2][1]));

        if (description && amount > 0) {
          items.push({
            transactionId: `gmail_line_${Date.now()}_${i}`,
            accountId: "unknown", // Will be set by caller
            date: parseDate(date) || new Date().toISOString().split("T")[0],
            name: description.substring(0, 50),
            amount,
            currency: "USD",
            category: ["Uncategorized"],
            paymentChannel: "email",
            pending: false,
            metadata: {
              source: "gmail",
              emailId: "line_item",
              emailSubject: "Line item from table",
              emailFrom: "",
              parsedAt: new Date().toISOString(),
            },
          });
        }
      }
    }
  }

  return items;
}

/**
 * Extract items from text-based lists
 */
function extractTextListItems(text: string): ParsedTransaction[] {
  const items: ParsedTransaction[] = [];

  // Try various list formats
  // Format 1: "Date Description Amount"
  const linePattern = /^(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\s+(.+?)\s+[$€£¥]?\s?(\d+\.?\d*)\s*$/gim;
  const matches = text.matchAll(linePattern);

  for (const match of matches) {
    const date = parseDate(match[1]);
    const description = match[2].trim();
    const amount = parseFloat(match[3]);

    if (description && amount > 0) {
      items.push({
        transactionId: `gmail_line_${Date.now()}_${items.length}`,
        accountId: "unknown", // Will be set by caller
        date: date || new Date().toISOString().split("T")[0],
        name: description.substring(0, 50),
        amount,
        currency: "USD",
        category: ["Uncategorized"],
        paymentChannel: "email",
        pending: false,
        metadata: {
          source: "gmail",
          emailId: "line_item",
          emailSubject: "Line item from text",
          emailFrom: "",
          parsedAt: new Date().toISOString(),
        },
      });
    }
  }

  return items;
}

/**
 * Strip HTML tags from string
 */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Parse amount string to number
 */
function parseAmount(amountStr: string): number {
  // Remove currency symbols, commas, and convert to number
  const cleaned = amountStr
    .replace(/[$€£¥]/g, "")
    .replace(/,/g, "")
    .trim();
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Parse date string to ISO format
 */
function parseDate(dateStr: string): string | undefined {
  try {
    // Try parsing various formats
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split("T")[0];
    }
  } catch {
    // Return undefined on parse error
  }
  return undefined;
}

/**
 * Convert ParsedTransaction to Transaction (storage format)
 */
export function toStorageTransaction(
  parsed: ParsedTransaction
): Transaction {
  return {
    transactionId: parsed.transactionId,
    accountId: parsed.accountId,
    date: parsed.date,
    amount: parsed.amount,
    currency: parsed.currency,
    category: parsed.category,
    merchantName: parsed.merchantName || parsed.name,
    paymentChannel: parsed.paymentChannel || "email",
    pending: parsed.pending,
    plaidTransactionId: parsed.transactionId,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Batch parse emails to transactions
 */
export function batchParseEmails(
  accountId: string,
  emailsWithRecognition: Array<{
    email: EmailContent;
    recognition: RecognitionResult;
  }>
): ParsedTransaction[] {
  const allTransactions: ParsedTransaction[] = [];

  for (const { email, recognition } of emailsWithRecognition) {
    try {
      const transactions = parseEmailToTransactions(
        accountId,
        email,
        recognition
      );
      allTransactions.push(...transactions);
    } catch (error) {
      // Log error but continue processing
      console.error(`Failed to parse email ${email.id}:`, error);
    }
  }

  return allTransactions;
}

/**
 * Parse email and return ParserResult
 */
export function parseEmail(
  accountId: string,
  email: EmailContent,
  recognition: RecognitionResult
): ParserResult {
  try {
    const transactions = parseEmailToTransactions(
      accountId,
      email,
      recognition
    );

    return {
      success: true,
      transactions,
    };
  } catch (error) {
    return {
      success: false,
      transactions: [],
      errors: [
        error instanceof Error ? error.message : "Unknown parse error",
      ],
    };
  }
}
