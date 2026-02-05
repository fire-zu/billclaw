/**
 * billclaw configuration schema
 *
 * Parseable schema with embedded uiHints for OpenClaw config UI
 * Uses Zod for type-safe validation (matching official voice-call plugin)
 */

import * as os from "node:os";
import * as path from "node:path";
import { z } from "zod";
import {
  BillclawConfigSchema,
  type BillclawConfig,
  type AccountConfig,
  type StorageConfig,
} from "./src/config-zod.js";

// Re-export types for other modules
export type { BillclawConfig, AccountConfig, StorageConfig };

/**
 * Resolve environment variables in config values
 */
function resolveEnvVars(value: string): string {
  return value.replace(/\$\{([^}]+)\}/g, (_, envVar) => {
    const envValue = process.env[envVar];
    if (!envValue) {
      throw new Error(`Environment variable ${envVar} is not set`);
    }
    return envValue;
  });
}

/**
 * Main config schema with parse method and embedded uiHints
 */
export const billclawConfigSchema = {
  /**
   * Parse and validate configuration using Zod
   * This provides type-safe validation with detailed error messages
   */
  parse(value: unknown): BillclawConfig {
    // First pass: parse with Zod for type safety
    let config: BillclawConfig;
    try {
      config = BillclawConfigSchema.parse(value);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map(
          (e) => `${e.path.join(".")}: ${e.message}`
        );
        throw new Error(`Configuration validation failed:\n${errorMessages.join("\n")}`);
      }
      throw error;
    }

    // Second pass: resolve environment variables in secret fields
    if (config.plaid.secret) {
      config.plaid.secret = resolveEnvVars(config.plaid.secret);
    }

    return config;
  },

  /**
   * UI hints for OpenClaw configuration interface
   * These match the structure in openclaw.plugin.json
   */
  uiHints: {
    "accounts": {
      label: "Bank Accounts",
      description: "Configure your bank account connections",
      type: "array",
      itemType: "object",
      fields: {
        "id": {
          label: "Account ID",
          type: "text",
          placeholder: "Auto-generated or custom ID",
          readonly: true,
        },
        "type": {
          label: "Data Source",
          type: "select",
          options: [
            { value: "plaid", label: "Plaid (US/Canada)" },
            { value: "gocardless", label: "GoCardless (Europe)" },
            { value: "gmail", label: "Gmail Bills" },
          ],
        },
        "name": {
          label: "Account Name",
          type: "text",
          placeholder: "e.g., My Chase Checking",
        },
        "enabled": {
          label: "Enable Sync",
          type: "boolean",
          default: true,
        },
        "syncFrequency": {
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
    "webhooks": {
      label: "Webhooks",
      description: "Configure real-time push notifications for transactions",
      type: "array",
      itemType: "object",
      fields: {
        "enabled": {
          label: "Enable Webhook",
          type: "boolean",
          default: false,
        },
        "url": {
          label: "Webhook URL",
          type: "url",
          placeholder: "https://your-server.com/webhook",
        },
        "secret": {
          label: "HMAC Secret",
          type: "password",
          placeholder: "Optional: for signature verification",
          help: "Leave empty to auto-generate",
        },
        "events": {
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
    "storage": {
      label: "Storage",
      description: "Local data storage settings",
      type: "object",
      fields: {
        "path": {
          label: "Storage Path",
          type: "text",
          placeholder: "~/.openclaw/billclaw",
          description: "Directory where transactions will be stored",
        },
        "format": {
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
    "plaid.clientId": {
      label: "Plaid Client ID",
      type: "text",
      placeholder: "Your Plaid client ID",
      help: "Get this from your Plaid dashboard",
    },
    "plaid.secret": {
      label: "Plaid Secret",
      type: "password",
      sensitive: true,
      placeholder: "Your Plaid secret",
      help: "Get this from your Plaid dashboard",
    },
    "plaid.environment": {
      label: "Plaid Environment",
      type: "select",
      options: [
        { value: "sandbox", label: "Sandbox (Testing)" },
        { value: "development", label: "Development" },
        { value: "production", label: "Production" },
      ],
      default: "sandbox",
    },
    "plaid.webhookUrl": {
      label: "Plaid Webhook URL",
      type: "url",
      placeholder: "https://your-server.com/webhook/plaid",
      help: "Required for real-time transaction updates",
      advanced: true,
    },
    "sync.defaultFrequency": {
      label: "Default Sync Frequency",
      type: "select",
      options: [
        { value: "hourly", label: "Hourly" },
        { value: "daily", label: "Daily" },
        { value: "weekly", label: "Weekly" },
        { value: "manual", label: "Manual Only" },
      ],
      default: "daily",
    },
    "sync.retryOnFailure": {
      label: "Retry on Failure",
      type: "boolean",
      default: true,
      help: "Automatically retry failed sync operations",
    },
    "gmail.clientId": {
      label: "Gmail OAuth Client ID",
      type: "text",
      placeholder: "Your Google Cloud OAuth client ID",
      help: "Get this from your Google Cloud Console",
    },
    "gmail.clientSecret": {
      label: "Gmail OAuth Client Secret",
      type: "password",
      sensitive: true,
      placeholder: "Your Google Cloud OAuth client secret",
      help: "Get this from your Google Cloud Console",
    },
    "gmail.senderWhitelist": {
      label: "Trusted Senders",
      type: "tags",
      placeholder: "e.g., @netflix.com, billing@paypal.com",
      help: "Email addresses/domains that are trusted for bill detection",
      description: "Add email addresses or domains (e.g., @netflix.com) that should always be checked for bills",
    },
    "gmail.keywords": {
      label: "Bill Keywords",
      type: "tags",
      placeholder: "invoice, statement, bill due, receipt",
      default: ["invoice", "statement", "bill due", "receipt", "payment due"],
      help: "Keywords that indicate an email contains a bill",
    },
    "gmail.pubsubTopic": {
      label: "Gmail Pub/Sub Topic",
      type: "text",
      placeholder: "projects/my-project/topics/my-topic",
      help: "Google Cloud Pub/Sub topic for push notifications",
      advanced: true,
    },
  },
};
