/**
 * billclaw configuration schema
 *
 * Parseable schema with embedded uiHints for OpenClaw config UI
 */

import * as os from "node:os";
import * as path from "node:path";

/**
 * Account types supported by billclaw
 */
export const ACCOUNT_TYPES = ["plaid", "gocardless", "gmail"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

/**
 * Sync frequency options
 */
export const SYNC_FREQUENCIES = ["realtime", "hourly", "daily", "weekly", "manual"] as const;
export type SyncFrequency = (typeof SYNC_FREQUENCIES)[number];

/**
 * Plaid environment options
 */
export const PLAID_ENVIRONMENTS = ["sandbox", "development", "production"] as const;
export type PlaidEnvironment = (typeof PLAID_ENVIRONMENTS)[number];

/**
 * Webhook event types
 */
export const WEBHOOK_EVENT_TYPES = [
  "transaction.new",
  "transaction.updated",
  "transaction.deleted",
  "sync.started",
  "sync.completed",
  "sync.failed",
  "account.connected",
  "account.disconnected",
  "account.error",
  "webhook.test",
] as const;
export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

/**
 * Per-account configuration
 */
export type AccountConfig = {
  id: string;
  type: AccountType;
  name: string;
  enabled: boolean;
  syncFrequency: SyncFrequency;
  lastSync?: string;
  lastStatus?: "success" | "error" | "pending";
  // Plaid-specific
  plaidItemId?: string;
  plaidAccessToken?: string;
  // GoCardless-specific
  gocardlessRequisitionId?: string;
  gocardlessAccessToken?: string;
  // Gmail-specific
  gmailEmailAddress?: string;
  gmailFilters?: string[];
};

/**
 * Webhook configuration
 */
export type WebhookConfig = {
  enabled: boolean;
  url?: string;
  secret?: string;
  retryPolicy: {
    maxRetries: number;
    initialDelay: number;
    maxDelay: number;
  };
  events: WebhookEventType[];
};

/**
 * Storage configuration
 */
export type StorageConfig = {
  path: string;
  format: "json" | "csv" | "both";
  encryption: {
    enabled: boolean;
    keyPath?: string;
  };
};

/**
 * Plaid configuration
 */
export type PlaidConfig = {
  clientId?: string;
  secret?: string;
  environment: PlaidEnvironment;
  webhookUrl?: string;
};

/**
 * Sync configuration
 */
export type SyncConfig = {
  defaultFrequency: SyncFrequency;
  retryOnFailure: boolean;
  maxRetries: number;
};

/**
 * Main billclaw configuration
 */
export type BillclawConfig = {
  accounts: AccountConfig[];
  webhooks: WebhookConfig[];
  storage: StorageConfig;
  sync: SyncConfig;
  plaid: PlaidConfig;
};

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
 * Resolve default storage path
 */
function resolveDefaultStoragePath(): string {
  return path.join(os.homedir(), ".openclaw", "billclaw");
}

/**
 * Validate account config
 */
function validateAccountConfig(account: unknown): account is AccountConfig {
  if (!account || typeof account !== "object") {
    return false;
  }
  const acc = account as Record<string, unknown>;

  return (
    typeof acc.id === "string" &&
    typeof acc.type === "string" &&
    ACCOUNT_TYPES.includes(acc.type as AccountType) &&
    typeof acc.name === "string" &&
    typeof acc.enabled === "boolean" &&
    typeof acc.syncFrequency === "string" &&
    SYNC_FREQUENCIES.includes(acc.syncFrequency as SyncFrequency)
  );
}

/**
 * Main config schema with parse method and embedded uiHints
 */
export const billclawConfigSchema = {
  parse(value: unknown): BillclawConfig {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("billclaw config required");
    }

    const cfg = value as Record<string, unknown>;

    // Validate accounts array
    const accounts: AccountConfig[] = [];
    if (cfg.accounts && Array.isArray(cfg.accounts)) {
      for (const account of cfg.accounts) {
        if (!validateAccountConfig(account)) {
          throw new Error(`Invalid account config: ${JSON.stringify(account)}`);
        }
        accounts.push(account as AccountConfig);
      }
    }

    // Validate webhooks array
    const webhooks: WebhookConfig[] = [];
    if (cfg.webhooks && Array.isArray(cfg.webhooks)) {
      for (const webhook of cfg.webhooks) {
        if (!webhook || typeof webhook !== "object") {
          throw new Error("Invalid webhook config");
        }
        webhooks.push(webhook as WebhookConfig);
      }
    }

    // Validate storage config
    let storage: StorageConfig = {
      path: resolveDefaultStoragePath(),
      format: "json",
      encryption: { enabled: false },
    };
    if (cfg.storage && typeof cfg.storage === "object") {
      const sto = cfg.storage as Record<string, unknown>;

      // Extract format
      let storageFormat: "json" | "csv" | "both" = "json";
      if (sto.format === "csv" || sto.format === "both") {
        storageFormat = sto.format;
      }

      // Extract encryption config
      let encryptionEnabled = false;
      let keyPath: string | undefined = undefined;
      if (sto.encryption && typeof sto.encryption === "object") {
        const enc = sto.encryption as Record<string, unknown>;
        if (typeof enc.enabled === "boolean") {
          encryptionEnabled = enc.enabled;
        }
        if (typeof enc.keyPath === "string") {
          keyPath = enc.keyPath;
        }
      }

      storage = {
        path: typeof sto.path === "string" ? sto.path : storage.path,
        format: storageFormat,
        encryption: {
          enabled: encryptionEnabled,
          keyPath,
        },
      };
    }

    // Validate sync config
    let sync: SyncConfig = {
      defaultFrequency: "daily",
      retryOnFailure: true,
      maxRetries: 3,
    };
    if (cfg.sync && typeof cfg.sync === "object") {
      const sy = cfg.sync as Record<string, unknown>;
      sync = {
        defaultFrequency: SYNC_FREQUENCIES.includes(sy.defaultFrequency as SyncFrequency) ?
                           sy.defaultFrequency as SyncFrequency : "daily",
        retryOnFailure: typeof sy.retryOnFailure === "boolean" ? sy.retryOnFailure : true,
        maxRetries: typeof sy.maxRetries === "number" ? sy.maxRetries : 3,
      };
    }

    // Validate plaid config
    let plaid: PlaidConfig = {
      environment: "sandbox",
    };
    if (cfg.plaid && typeof cfg.plaid === "object") {
      const pl = cfg.plaid as Record<string, unknown>;
      plaid = {
        clientId: typeof pl.clientId === "string" ? pl.clientId : undefined,
        secret: typeof pl.secret === "string" ? resolveEnvVars(pl.secret) : undefined,
        environment: PLAID_ENVIRONMENTS.includes(pl.environment as PlaidEnvironment) ?
                      pl.environment as PlaidEnvironment : "sandbox",
        webhookUrl: typeof pl.webhookUrl === "string" ? pl.webhookUrl : undefined,
      };
    }

    return {
      accounts,
      webhooks,
      storage,
      sync,
      plaid,
    };
  },

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
  },
};
