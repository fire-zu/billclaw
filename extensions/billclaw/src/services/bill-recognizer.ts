/**
 * Email bill recognition service
 *
 * This module identifies whether an email contains a bill/receipt/invoice
 * using keyword matching, sender analysis, and pattern recognition.
 */

import type { EmailContent } from "./gmail-fetcher.js";
import type { BillclawConfig } from "../../config.js";

/**
 * Recognition configuration options
 */
export interface RecognitionConfig {
  keywords?: string[];
  senderWhitelist?: string[];
  confidenceThreshold?: number;
  requireAmount?: boolean;
  requireDate?: boolean;
  billTypePatterns?: Record<string, string[]>;
}

/**
 * Recognition result
 */
export interface RecognitionResult {
  isBill: boolean;
  confidence: number; // 0-1
  billType?: BillType;
  merchant?: string;
  amount?: number;
  currency?: string;
  dueDate?: string;
  accountNumber?: string;
  reasons: string[]; // Why this was identified as a bill
}

/**
 * Types of bills
 */
export type BillType =
  | "credit_card_statement"
  | "utility_bill"
  | "subscription"
  | "insurance"
  | "phone_bill"
  | "internet_bill"
  | "rent"
  | "loan_payment"
  | "invoice"
  | "receipt"
  | "other";

/**
 * Common bill-related keywords in subject lines
 */
const BILL_SUBJECT_KEYWORDS = [
  // Direct bill terms
  "invoice",
  "statement",
  "bill due",
  "amount due",
  "payment due",
  "receipt",
  "confirmation",
  // Financial terms
  "your statement",
  "your bill",
  "your invoice",
  "monthly statement",
  "billing",
  // Subscription terms
  "subscription",
  "membership",
  "renewal",
];

/**
 * Keywords for specific bill types
 */
const BILL_TYPE_KEYWORDS: Record<BillType, string[]> = {
  credit_card_statement: [
    "credit card",
    "card statement",
    "visa statement",
    "mastercard statement",
    "amex statement",
    "statement balance",
    "payment due",
  ],
  utility_bill: [
    "electric bill",
    "water bill",
    "gas bill",
    "utility bill",
    "energy statement",
  ],
  subscription: [
    "netflix",
    "spotify",
    "amazon prime",
    "adobe",
    "microsoft",
    "google workspace",
    "dropbox",
    "subscription",
    "membership",
  ],
  insurance: ["insurance", "premium", "policy", "coverage"],
  phone_bill: ["phone bill", "wireless", "mobile", "at&t", "verizon", "t-mobile"],
  internet_bill: ["internet", "broadband", "xfinity", "spectrum", "fiber"],
  rent: ["rent", "lease", "housing"],
  loan_payment: ["loan payment", "mortgage", "car payment", "student loan"],
  invoice: ["invoice", "inv-", "bill for services"],
  receipt: ["receipt", "order confirmation", "purchase confirmation"],
  other: [],
};

/**
 * Common billing sender domains
 */
const BILLING_SENDERS = [
  // Credit cards
  "@alerts.americanexpress.com",
  "@alertsv2.wellsfargo.com",
  "@discover.com",
  "@chase.com",
  "@citi.com",
  "@bankofamerica.com",
  // Utilities
  "@pge.com",
  "@coned.com",
  "@att.com",
  "@verizon.com",
  // Subscriptions
  "@netflix.com",
  "@spotify.com",
  "@amazon.com",
  "@adobe.com",
  "@microsoft.com",
  // Payment processors
  "@paypal.com",
  "@stripe.com",
  "@squareup.com",
  "@square.com",
  // Generic
  "noreply@",
  "no-reply@",
  "billing@",
  "invoice@",
  "statements@",
  "notifications@",
];

/**
 * Pattern to extract amount from email content
 * Matches: $123.45, 123.45 USD, €99, etc.
 */
const AMOUNT_PATTERN =
  /(?:[$€£¥]|\bUSD?\s?)(\d{1,3}(?:,\d{3})*(?:\.\d{2})|\d+\.\d{2})\s*(?:USD?|EUR|GBP|JPY)?/gi;

/**
 * Pattern to extract dates (YYYY-MM-DD, MM/DD/YYYY, etc.)
 */
const DATE_PATTERN =
  /(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})/gi;

/**
 * Pattern for account/reference numbers
 */
const ACCOUNT_PATTERN =
  /(?:account|ref|reference|invoice)\s*(?:#|number|:)?\s*([A-Z0-9-]{4,})/gi;

/**
 * Currency symbols to names
 */
const CURRENCY_SYMBOLS: Record<string, string> = {
  $: "USD",
  "€": "EUR",
  "£": "GBP",
  "¥": "JPY",
  "₹": "INR",
};

/**
 * Extract sender domain from email address
 */
function extractDomain(email: string): string {
  const match = email.match(/@([^@\s>]+)/);
  return match ? match[1] : "";
}

/**
 * Check if email contains bill-related keywords
 */
function containsBillKeywords(text: string): boolean {
  const lowerText = text.toLowerCase();

  return BILL_SUBJECT_KEYWORDS.some((keyword) =>
    lowerText.includes(keyword)
  );
}

/**
 * Identify bill type based on content
 */
function identifyBillType(subject: string, body: string, sender: string): BillType {
  const combinedText = `${subject} ${body} ${sender}`.toLowerCase();

  for (const [type, keywords] of Object.entries(BILL_TYPE_KEYWORDS)) {
    if (type === "other") continue;

    const matchCount = keywords.filter((keyword) =>
      combinedText.includes(keyword.toLowerCase())
    ).length;

    if (matchCount > 0) {
      return type as BillType;
    }
  }

  return "other";
}

/**
 * Extract amount from text
 */
function extractAmount(text: string): {
  amount?: number;
  currency?: string;
} {
  const matches = text.matchAll(AMOUNT_PATTERN);
  let largestAmount = 0;
  let currency = "USD";

  for (const match of matches) {
    const amountStr = match[1].replace(/,/g, "");
    const amount = parseFloat(amountStr);

    if (amount > largestAmount) {
      largestAmount = amount;
    }

    // Detect currency from matched text
    const fullMatch = match[0];
    if (fullMatch.includes("€")) currency = "EUR";
    else if (fullMatch.includes("£")) currency = "GBP";
    else if (fullMatch.includes("¥")) currency = "JPY";
  }

  if (largestAmount > 0) {
    return { amount: largestAmount, currency };
  }

  return {};
}

/**
 * Extract due date from text
 */
function extractDueDate(text: string): string | undefined {
  const matches = text.matchAll(DATE_PATTERN);

  for (const match of matches) {
    const dateStr = match[1];

    // Return first found date (likely the due date)
    try {
      // Try to parse and validate date
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split("T")[0];
      }
    } catch {
      // Skip invalid dates
    }
  }

  return undefined;
}

/**
 * Extract account/reference number from text
 */
function extractAccountNumber(text: string): string | undefined {
  const matches = text.matchAll(ACCOUNT_PATTERN);

  for (const match of matches) {
    if (match[1]) {
      return match[1];
    }
  }

  return undefined;
}

/**
 * Extract merchant/biller name from sender
 */
function extractMerchantName(from: string, subject: string): string | undefined {
  // Try to extract name from email address
  const emailMatch = from.match(/[\w.-]+@([\w.-]+\.[a-z]{2,})/i);
  if (emailMatch) {
    const domain = emailMatch[1];
    // Convert domain to name (e.g., "netflix.com" -> "Netflix")
    const name = domain.split(".")[0];
    if (name.length > 2) {
      return name.charAt(0).toUpperCase() + name.slice(1);
    }
  }

  // Try to extract from display name
  const displayMatch = from.match(/^"?([^"@\s<]+)"?\s*</);
  if (displayMatch) {
    return displayMatch[1];
  }

  return undefined;
}

/**
 * Calculate confidence score for bill recognition
 */
function calculateConfidence(
  result: Partial<RecognitionResult>,
  email: EmailContent
): number {
  let confidence = 0;
  const reasons: string[] = [];
  const combinedText = `${email.subject} ${email.body} ${email.from}`.toLowerCase();

  // Check subject keywords (strong indicator)
  if (containsBillKeywords(email.subject)) {
    confidence += 0.4;
    reasons.push("Subject contains bill-related keywords");
  }

  // Check body keywords
  if (containsBillKeywords(email.body)) {
    confidence += 0.2;
    reasons.push("Body contains bill-related keywords");
  }

  // Check sender domain
  const senderDomain = extractDomain(email.from).toLowerCase();
  if (BILLING_SENDERS.some((s) => senderDomain.includes(s.toLowerCase()))) {
    confidence += 0.2;
    reasons.push("Sender is a known billing domain");
  }

  // Check for amount
  if (result.amount && result.amount > 0) {
    confidence += 0.1;
    reasons.push("Contains monetary amount");
  }

  // Check for due date
  if (result.dueDate) {
    confidence += 0.05;
    reasons.push("Contains due date");
  }

  // Check for account number
  if (result.accountNumber) {
    confidence += 0.05;
    reasons.push("Contains account/reference number");
  }

  result.reasons = reasons;
  return Math.min(confidence, 1.0);
}

/**
 * Recognize if an email contains a bill
 */
export function recognizeBill(email: EmailContent): RecognitionResult {
  const result: Partial<RecognitionResult> = {
    isBill: false,
    confidence: 0,
  };

  // Extract data
  result.billType = identifyBillType(email.subject, email.body, email.from);
  result.merchant = extractMerchantName(email.from, email.subject);

  const amountData = extractAmount(`${email.subject} ${email.body}`);
  if (amountData.amount) {
    result.amount = amountData.amount;
  }
  if (amountData.currency) {
    result.currency = amountData.currency;
  }

  result.dueDate = extractDueDate(`${email.subject} ${email.body}`);
  result.accountNumber = extractAccountNumber(`${email.subject} ${email.body}`);

  // Calculate confidence
  result.confidence = calculateConfidence(result, email);

  // Determine if it's a bill (confidence threshold: 0.5)
  result.isBill = result.confidence >= 0.5;

  return result as RecognitionResult;
}

/**
 * Filter emails to only bills
 */
export function filterBills(emails: EmailContent[]): Array<{
  email: EmailContent;
  recognition: RecognitionResult;
}> {
  return emails
    .map((email) => ({
      email,
      recognition: recognizeBill(email),
    }))
    .filter(({ recognition }) => recognition.isBill)
    .sort((a, b) => b.recognition.confidence - a.recognition.confidence);
}

/**
 * Check if a sender is a known billing sender
 */
export function isKnownBillingSender(sender: string): boolean {
  const domain = extractDomain(sender).toLowerCase();
  return BILLING_SENDERS.some((s) => domain.includes(s.toLowerCase()));
}

/**
 * Check if sender is in whitelist (supports email addresses and domain patterns)
 */
export function isWhitelistedSender(
  sender: string,
  whitelist: string[]
): boolean {
  if (whitelist.length === 0) return false;

  const senderLower = sender.toLowerCase();
  const domain = extractDomain(sender).toLowerCase();

  return whitelist.some((whitelistEntry) => {
    const entry = whitelistEntry.toLowerCase();
    // Exact match
    if (senderLower === entry) return true;
    // Domain match (e.g., @netflix.com matches any email from netflix.com)
    if (entry.startsWith("@") && domain.includes(entry.substring(1))) {
      return true;
    }
    // Pattern match (e.g., "netflix.com" matches "user@netflix.com")
    if (domain.includes(entry)) return true;
    return false;
  });
}

/**
 * Check if text contains any of the custom keywords
 */
export function containsCustomKeywords(
  text: string,
  keywords: string[]
): boolean {
  if (keywords.length === 0) return false;
  const lowerText = text.toLowerCase();
  return keywords.some((keyword) => lowerText.includes(keyword.toLowerCase()));
}

/**
 * Recognize if an email contains a bill with custom configuration
 *
 * This function allows overriding default recognition behavior with:
 * - Custom keywords
 * - Sender whitelist
 * - Custom confidence threshold
 * - Required fields (amount, date)
 */
export function recognizeBillWithConfig(
  email: EmailContent,
  config: RecognitionConfig
): RecognitionResult {
  const result: Partial<RecognitionResult> = {
    isBill: false,
    confidence: 0,
  };

  const {
    keywords = [],
    senderWhitelist = [],
    confidenceThreshold = 0.5,
    requireAmount = false,
    requireDate = false,
    billTypePatterns,
  } = config;

  // Check sender whitelist first (highest priority)
  if (senderWhitelist.length > 0) {
    if (isWhitelistedSender(email.from, senderWhitelist)) {
      result.confidence = 0.8; // High confidence for whitelisted senders
      result.reasons = [`Sender in whitelist: ${email.from}`];
    }
  }

  // Extract data
  result.billType = identifyBillType(email.subject, email.body, email.from);
  result.merchant = extractMerchantName(email.from, email.subject);

  const amountData = extractAmount(`${email.subject} ${email.body}`);
  if (amountData.amount) {
    result.amount = amountData.amount;
  }
  if (amountData.currency) {
    result.currency = amountData.currency;
  }

  result.dueDate = extractDueDate(`${email.subject} ${email.body}`);
  result.accountNumber = extractAccountNumber(`${email.subject} ${email.body}`);

  // Calculate confidence (with custom keywords)
  if (result.confidence === 0) {
    // Only calculate if not already set by whitelist
    result.confidence = calculateConfidenceWithConfig(
      result,
      email,
      keywords
    );
  }

  // Apply required field checks
  if (requireAmount && !result.amount) {
    result.isBill = false;
    result.confidence = 0;
    result.reasons = ["Required field (amount) not found"];
    return result as RecognitionResult;
  }

  if (requireDate && !result.dueDate) {
    result.isBill = false;
    result.confidence = 0;
    result.reasons = ["Required field (due date) not found"];
    return result as RecognitionResult;
  }

  // Ensure confidence is set
  if (result.confidence === undefined) {
    result.confidence = 0;
  }

  // Determine if it's a bill using custom threshold
  result.isBill = result.confidence >= confidenceThreshold;

  return result as RecognitionResult;
}

/**
 * Calculate confidence score with custom keywords
 */
function calculateConfidenceWithConfig(
  result: Partial<RecognitionResult>,
  email: EmailContent,
  customKeywords: string[]
): number {
  let confidence = 0;
  const reasons: string[] = [];
  const combinedText = `${email.subject} ${email.body} ${email.from}`.toLowerCase();

  // Check custom keywords first
  if (customKeywords.length > 0) {
    if (containsCustomKeywords(email.subject, customKeywords)) {
      confidence += 0.4;
      reasons.push("Subject contains custom keywords");
    }
    if (containsCustomKeywords(email.body, customKeywords)) {
      confidence += 0.2;
      reasons.push("Body contains custom keywords");
    }
  } else {
    // Fall back to default keywords
    if (containsBillKeywords(email.subject)) {
      confidence += 0.4;
      reasons.push("Subject contains bill-related keywords");
    }
    if (containsBillKeywords(email.body)) {
      confidence += 0.2;
      reasons.push("Body contains bill-related keywords");
    }
  }

  // Check sender domain
  const senderDomain = extractDomain(email.from).toLowerCase();
  if (BILLING_SENDERS.some((s) => senderDomain.includes(s.toLowerCase()))) {
    confidence += 0.2;
    reasons.push("Sender is a known billing domain");
  }

  // Check for amount
  if (result.amount && result.amount > 0) {
    confidence += 0.1;
    reasons.push("Contains monetary amount");
  }

  // Check for due date
  if (result.dueDate) {
    confidence += 0.05;
    reasons.push("Contains due date");
  }

  // Check for account number
  if (result.accountNumber) {
    confidence += 0.05;
    reasons.push("Contains account/reference number");
  }

  result.reasons = reasons;
  return Math.min(confidence, 1.0);
}

/**
 * Recognize bill using plugin configuration
 *
 * Convenience function that extracts Gmail config from BillclawConfig
 */
export function recognizeBillWithPluginConfig(
  email: EmailContent,
  pluginConfig: BillclawConfig
): RecognitionResult {
  const gmailConfig = pluginConfig.gmail;

  return recognizeBillWithConfig(email, {
    keywords: gmailConfig?.keywords,
    senderWhitelist: gmailConfig?.senderWhitelist || [],
    confidenceThreshold: gmailConfig?.confidenceThreshold,
    requireAmount: gmailConfig?.requireAmount,
    requireDate: gmailConfig?.requireDate,
    billTypePatterns: gmailConfig?.billTypePatterns,
  });
}

