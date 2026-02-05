/**
 * billclaw configuration schema
 *
 * Uses Zod for runtime validation and uiHints for OpenClaw config UI
 */

import { z } from "zod";

/**
 * Account types supported by billclaw
 */
export enum AccountType {
  Plaid = "plaid",
  GoCardless = "gocardless",
  Gmail = "gmail",
}

/**
 * Sync frequency options
 */
export enum SyncFrequency {
  Realtime = "realtime",
  Hourly = "hourly",
  Daily = "daily",
  Weekly = "weekly",
  Manual = "manual",
}

/**
 * Webhook event types
 */
export enum WebhookEventType {
  TransactionNew = "transaction.new",
  TransactionUpdated = "transaction.updated",
  TransactionDeleted = "transaction.deleted",
  SyncStarted = "sync.started",
  SyncCompleted = "sync.completed",
  SyncFailed = "sync.failed",
  AccountConnected = "account.connected",
  AccountDisconnected = "account.disconnected",
  AccountError = "account.error",
  WebhookTest = "webhook.test",
}

/**
 * Per-account configuration
 */
export const AccountConfigSchema = z.object({
  id: z.string().describe("Unique account identifier"),
  type: z.nativeEnum(AccountType).describe("Account data source type"),
  name: z.string().describe("Display name for the account"),
  enabled: z.boolean().default(true).describe("Whether sync is enabled"),
  syncFrequency: z.nativeEnum(SyncFrequency).default(SyncFrequency.Daily),
  lastSync: z.string().datetime().optional().describe("Last successful sync timestamp"),
  lastStatus: z.enum(["success", "error", "pending"]).optional(),
  // Plaid-specific
  plaidItemId: z.string().optional().describe("Plaid item ID"),
  plaidAccessToken: z.string().optional().describe("Encrypted Plaid access token"),
  // GoCardless-specific
  gocardlessRequisitionId: z.string().optional().describe("GoCardless requisition ID"),
  gocardlessAccessToken: z.string().optional().describe("Encrypted GoCardless access token"),
  // Gmail-specific
  gmailEmailAddress: z.string().email().optional().describe("Gmail address for bill fetching"),
  gmailFilters: z.array(z.string()).optional().describe("Email filters/keywords for bill identification"),
});

export type AccountConfig = z.infer<typeof AccountConfigSchema>;

/**
 * Webhook configuration
 */
export const WebhookConfigSchema = z.object({
  enabled: z.boolean().default(false),
  url: z.string().url().optional().describe("Webhook endpoint URL"),
  secret: z.string().optional().describe("HMAC secret for signature verification"),
  retryPolicy: z.object({
    maxRetries: z.number().int().min(0).max(10).default(3),
    initialDelay: z.number().int().min(1000).default(2000), // ms
    maxDelay: z.number().int().min(5000).default(60000), // ms
  }),
  events: z.array(z.nativeEnum(WebhookEventType)).default([
    WebhookEventType.TransactionNew,
    WebhookEventType.TransactionUpdated,
    WebhookEventType.SyncFailed,
    WebhookEventType.AccountError,
  ]),
});

export type WebhookConfig = z.infer<typeof WebhookConfigSchema>;

/**
 * Storage configuration
 */
export const StorageConfigSchema = z.object({
  path: z.string().default("~/.openclaw/billclaw").describe("Base directory for data storage"),
  format: z.enum(["json", "csv", "both"]).default("json").describe("Storage format"),
  encryption: z.object({
    enabled: z.boolean().default(false),
    keyPath: z.string().optional().describe("Path to encryption key"),
  }),
});

export type StorageConfig = z.infer<typeof StorageConfigSchema>;

/**
 * Main billclaw configuration
 */
export const BillclawConfigSchema = z.object({
  accounts: z.array(AccountConfigSchema).default([]).describe("Configured bank accounts"),
  webhooks: z.array(WebhookConfigSchema).default([]).describe("Webhook endpoints"),
  storage: StorageConfigSchema.default({}).describe("Storage settings"),
  sync: z.object({
    defaultFrequency: z.nativeEnum(SyncFrequency).default(SyncFrequency.Daily),
    retryOnFailure: z.boolean().default(true),
    maxRetries: z.number().int().min(0).max(5).default(3),
  }),
});

export type BillclawConfig = z.infer<typeof BillclawConfigSchema>;

/**
 * UI hints for OpenClaw config interface
 */
export const configUiHints = {
  accounts: {
    label: "Bank Accounts",
    description: "Configure your bank account connections",
    type: "array",
    itemType: "object",
    fields: {
      id: {
        label: "Account ID",
        type: "text",
        placeholder: "Auto-generated or custom ID",
        readonly: true,
      },
      type: {
        label: "Data Source",
        type: "select",
        options: [
          { value: "plaid", label: "Plaid (US/Canada)" },
          { value: "gocardless", label: "GoCardless (Europe)" },
          { value: "gmail", label: "Gmail Bills" },
        ],
      },
      name: {
        label: "Account Name",
        type: "text",
        placeholder: "e.g., My Chase Checking",
      },
      enabled: {
        label: "Enable Sync",
        type: "boolean",
        default: true,
      },
      syncFrequency: {
        label: "Sync Frequency",
        type: "select",
        options: [
          { value: "realtime", label: "Real-time (Webhook)" },
          { value: "hourly", label: "Hourly" },
          { value: "daily", label: "Daily" },
          { value: "weekly", label: "Weekly" },
          { value: "manual", label: "Manual Only" },
        ],
        default: "daily",
      },
    },
  },
  webhooks: {
    label: "Webhooks",
    description: "Configure real-time push notifications for transactions",
    type: "array",
    itemType: "object",
    fields: {
      enabled: {
        label: "Enable Webhook",
        type: "boolean",
        default: false,
      },
      url: {
        label: "Webhook URL",
        type: "url",
        placeholder: "https://your-server.com/webhook",
      },
      secret: {
        label: "HMAC Secret",
        type: "password",
        placeholder: "Optional: for signature verification",
        description: "Leave empty to auto-generate",
      },
      events: {
        label: "Events",
        type: "multiselect",
        options: [
          { value: "transaction.new", label: "New Transaction" },
          { value: "transaction.updated", label: "Updated Transaction" },
          { value: "transaction.deleted", label: "Deleted Transaction" },
          { value: "sync.failed", label: "Sync Failed" },
          { value: "account.error", label: "Account Error" },
        ],
        default: ["transaction.new", "sync.failed", "account.error"],
      },
    },
  },
  storage: {
    label: "Storage",
    description: "Local data storage settings",
    type: "object",
    fields: {
      path: {
        label: "Storage Path",
        type: "text",
        placeholder: "~/.openclaw/billclaw",
        description: "Directory where transactions will be stored",
      },
      format: {
        label: "File Format",
        type: "select",
        options: [
          { value: "json", label: "JSON (recommended)" },
          { value: "csv", label: "CSV" },
          { value: "both", label: "Both JSON and CSV" },
        ],
        default: "json",
      },
    },
  },
};
