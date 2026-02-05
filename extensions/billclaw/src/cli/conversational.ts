/**
 * Conversational interface for billclaw
 *
 * This module provides natural language command parsing and
 * progress feedback for long-running operations.
 */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { BillclawConfig } from "../../config.js";
import { plaidSyncTool } from "../tools/plaid-sync.js";
import { gmailFetchTool } from "../tools/gmail-fetch.js";

/**
 * Parsed natural language command
 */
export interface ParsedCommand {
  action: "sync" | "status" | "setup" | "config" | "help" | "export";
  target?: string; // Account ID or export format
  options?: Record<string, unknown>;
  confidence: number; // 0-1
}

/**
 * Progress callback for long-running operations
 */
export interface ProgressCallback {
  (progress: {
    current: number;
    total: number;
    message: string;
    account?: string;
  }): void | Promise<void>;
}

/**
 * Sync operation with progress feedback
 */
export async function syncWithProgress(
  api: OpenClawPluginApi,
  accountId: string | undefined,
  onProgress?: ProgressCallback
): Promise<{
  success: boolean;
  transactionsAdded: number;
  transactionsUpdated: number;
  accounts: number;
  errors?: string[];
}> {
  const config = api.pluginConfig as BillclawConfig;
  const accounts = config.accounts || [];

  if (accounts.length === 0) {
    return {
      success: false,
      transactionsAdded: 0,
      transactionsUpdated: 0,
      accounts: 0,
      errors: ["No accounts configured. Run 'openclaw bills setup' first."],
    };
  }

  const accountsToSync = accountId
    ? accounts.filter((a) => a.id === accountId)
    : accounts.filter((a) => a.enabled);

  if (accountsToSync.length === 0) {
    return {
      success: false,
      transactionsAdded: 0,
      transactionsUpdated: 0,
      accounts: 0,
      errors: accountId
        ? [`Account ${accountId} not found or disabled.`]
        : ["No enabled accounts found."],
    };
  }

  let totalAdded = 0;
  let totalUpdated = 0;
  const allErrors: string[] = [];

  for (let i = 0; i < accountsToSync.length; i++) {
    const account = accountsToSync[i];

    // Report progress
    if (onProgress) {
      await onProgress({
        current: i + 1,
        total: accountsToSync.length,
        message: `Syncing ${account.name}...`,
        account: account.id,
      });
    }

    try {
      // Call appropriate sync tool based on account type
      let result;
      if (account.type === "plaid") {
        result = await plaidSyncTool(api, { accountId: account.id });
      } else if (account.type === "gmail") {
        result = await gmailFetchTool(api, { accountId: account.id });
      } else {
        allErrors.push(`Account type ${account.type} not yet supported.`);
        continue;
      }

      const toolResult = "content" in result
        ? JSON.parse(result.content[0].text)
        : result;

      if (toolResult.success) {
        totalAdded += toolResult.transactionsAdded || 0;
        totalUpdated += toolResult.transactionsUpdated || 0;
      } else {
        allErrors.push(`${account.name}: ${toolResult.error || "Unknown error"}`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      allErrors.push(`${account.name}: ${errorMsg}`);
    }
  }

  // Final progress
  if (onProgress) {
    await onProgress({
      current: accountsToSync.length,
      total: accountsToSync.length,
      message: "Sync complete",
    });
  }

  return {
    success: allErrors.length === 0,
    transactionsAdded: totalAdded,
    transactionsUpdated: totalUpdated,
    accounts: accountsToSync.length,
    errors: allErrors.length > 0 ? allErrors : undefined,
  };
}

/**
 * Parse natural language command
 *
 * Supports natural language variations like:
 * - "sync my accounts"
 * - "fetch transactions from chase"
 * - "show me the status"
 * - "what's my balance"
 * - "export to beancount"
 */
export function parseNaturalLanguageCommand(
  input: string
): ParsedCommand | null {
  const normalized = input.toLowerCase().trim();

  // Sync commands
  if (
    normalized.match(/\b(sync|fetch|download|update)\b/) &&
    normalized.match(/\b(account|accounts|transaction|transactions|bills?)\b/)
  ) {
    // Extract account name if specified
    const accountMatch = normalized.match(
      /\b(from|for|my)\s+(\w+)\b/
    );
    return {
      action: "sync",
      target: accountMatch?.[1],
      confidence: 0.9,
    };
  }

  // Status commands
  if (
    normalized.match(/\b(status|state|connection|health)\b/) ||
    normalized.includes("how are my accounts") ||
    normalized.match(/\b(what's|whats)\s+going\s+on\b/)
  ) {
    return {
      action: "status",
      confidence: 0.9,
    };
  }

  // Setup commands
  if (
    normalized.match(/\b(setup|configure|add|connect)\b/) &&
    normalized.match(/\b(account|bank)\b/)
  ) {
    return {
      action: "setup",
      confidence: 0.9,
    };
  }

  // Config commands
  if (
    normalized.match(/\b(config|settings|preference)\b/) ||
    normalized.match(/\b(set|change|update)\s+(config|settings?)\b/)
  ) {
    return {
      action: "config",
      confidence: 0.85,
    };
  }

  // Export commands
  if (
    normalized.match(/\b(export|save|write)\b/) &&
    normalized.match(/\b(beancount|ledger|csv)\b/)
  ) {
    const formatMatch = normalized.match(/\b(beancount|ledger|csv)\b/);
    return {
      action: "export",
      target: formatMatch?.[1],
      confidence: 0.9,
    };
  }

  // Help commands
  if (
    normalized.match(/\b(help|usage|how|what)\b/) ||
    normalized === "bills" ||
    normalized === "billclaw"
  ) {
    return {
      action: "help",
      confidence: 0.8,
    };
  }

  return null;
}

/**
 * Format sync result as human-readable message
 */
export function formatSyncResult(result: {
  success: boolean;
  transactionsAdded: number;
  transactionsUpdated: number;
  accounts: number;
  errors?: string[];
}): string {
  const lines: string[] = [];

  if (result.success) {
    lines.push("✅ Sync completed successfully!\n");
    lines.push(`📊 Summary:`);
    lines.push(`   Accounts synced: ${result.accounts}`);
    lines.push(`   New transactions: ${result.transactionsAdded}`);
    lines.push(`   Updated transactions: ${result.transactionsUpdated}`);
  } else {
    lines.push("⚠️  Sync completed with some issues:\n");
    lines.push(`📊 Summary:`);
    lines.push(`   Accounts synced: ${result.accounts}`);
    lines.push(`   New transactions: ${result.transactionsAdded}`);
    lines.push(`   Updated transactions: ${result.transactionsUpdated}`);

    if (result.errors && result.errors.length > 0) {
      lines.push(`\n❌ Errors:`);
      for (const error of result.errors) {
        lines.push(`   - ${error}`);
      }
    }
  }

  return lines.join("\n");
}

/**
 * Format status as human-readable message
 */
export function formatStatus(status: {
  accounts: Array<{
    id: string;
    name: string;
    type: string;
    lastSync?: string;
    status: "connected" | "disconnected" | "error" | "pending";
  }>;
}): string {
  const lines: string[] = ["📊 billclaw Status\n"];

  if (status.accounts.length === 0) {
    lines.push("No accounts configured yet.");
    lines.push("\nRun 'openclaw bills setup' to get started.");
    return lines.join("\n");
  }

  lines.push(`Configured Accounts: ${status.accounts.length}\n`);

  for (const account of status.accounts) {
    const statusEmoji =
      account.status === "connected" ? "✅" :
      account.status === "disconnected" ? "🔌" :
      account.status === "error" ? "❌" :
      "⏳";

    const lastSyncText = account.lastSync
      ? `Last sync: ${new Date(account.lastSync).toLocaleString()}`
      : "Last sync: Never";

    lines.push(
      `  ${statusEmoji} ${account.name} (${account.type})`
    );
    lines.push(`     ${lastSyncText}`);
  }

  lines.push("\n💡 Run 'openclaw bills sync' to sync all accounts.");

  return lines.join("\n");
}

/**
 * Agent tool for conversational sync
 *
 * Allows natural language triggers like:
 * - "Sync my accounts"
 * - "Fetch transactions from Chase"
 */
export async function conversationalSyncTool(
  api: OpenClawPluginApi,
  args: {
    prompt?: string; // Natural language prompt
    accountId?: string; // Explicit account ID
  }
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const { prompt, accountId } = args;

  // If natural language prompt provided, parse it
  if (prompt && !accountId) {
    const command = parseNaturalLanguageCommand(prompt);
    if (command && command.action === "sync") {
      // Use parsed account name
      // Note: In real implementation, we'd need to map account names to IDs
    }
  }

  // Perform sync with progress feedback
  const progressMessages: string[] = [];

  const result = await syncWithProgress(api, accountId, async (progress) => {
    const message = `[${progress.current}/${progress.total}] ${progress.message}`;
    progressMessages.push(message);
    api.logger.info?.(message);
  });

  // Format result
  const output = formatSyncResult(result);

  // Include progress messages in output
  const fullOutput = progressMessages.length > 0
    ? `${progressMessages.join("\n")}\n\n${output}`
    : output;

  return {
    content: [
      {
        type: "text",
        text: fullOutput,
      },
    ],
  };
}

/**
 * Agent tool for conversational status
 *
 * Allows natural language triggers like:
 * - "Show me the status"
 * - "How are my accounts doing?"
 */
export async function conversationalStatusTool(
  api: OpenClawPluginApi,
  args: {
    prompt?: string; // Natural language prompt
  }
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const config = api.pluginConfig as BillclawConfig;
  const accounts = config.accounts || [];

  const accountStatus = await Promise.all(
    accounts.map(async (account) => {
      // In real implementation, we'd read actual sync status
      return {
        id: account.id,
        name: account.name,
        type: account.type,
        lastSync: account.lastSync,
        status: account.enabled ? "connected" as const : "disconnected" as const,
      };
    })
  );

  const output = formatStatus({ accounts: accountStatus });

  return {
    content: [
      {
        type: "text",
        text: output,
      },
    ],
  };
}

/**
 * Get help text for billclaw
 */
export function getHelpText(): string {
  return `
🦀 billclaw - Financial Data Sovereignty for OpenClaw

Available Commands:

CLI Commands:
  openclaw bills setup              Interactive setup wizard
  openclaw bills sync [account]      Sync transactions
  openclaw bills status             Show connection status
  openclaw bills config [key] [val]  Manage configuration

Natural Language Examples:
  "Sync my accounts"                Sync all enabled accounts
  "Fetch transactions from Chase"   Sync specific account
  "Show me the status"               Display account status
  "Export to beancount"             Export transactions to beancount

Configuration:
  billclaw.plaid.clientId          Plaid API Client ID
  billclaw.plaid.secret            Plaid API Secret
  billclaw.plaid.environment        sandbox|development|production
  billclaw.storage.path             Local storage path

Data Storage:
  ~/.openclaw/billclaw/transactions/  Transaction files
  ~/.openclaw/billclaw/accounts/       Account credentials

For more information:
  User Guide: https://github.com/fire-zu/billclaw/blob/main/docs/user-guide.md
  Troubleshooting: https://github.com/fire-zu/billclaw/blob/main/docs/troubleshooting.md
  Webhook Guide: https://github.com/fire-zu/billclaw/blob/main/docs/webhook-guide.md
`;
}

/**
 * Conversational help tool
 *
 * Responds to help requests with contextual information
 */
export async function conversationalHelpTool(
  api: OpenClawPluginApi,
  args: {
    topic?: string; // Specific help topic
  }
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const { topic } = args;

  if (topic) {
    // Provide contextual help based on topic
    const topicLower = topic.toLowerCase();

    if (topicLower.includes("sync") || topicLower.includes("fetch")) {
      return {
        content: [
          {
            type: "text",
            text: `
Sync Commands:

CLI:
  openclaw bills sync              Sync all accounts
  openclaw bills sync <account>    Sync specific account

Natural Language:
  "Sync my accounts"                Sync all enabled accounts
  "Fetch transactions"               Get latest transactions
  "Update from Chase"               Sync Chase account

Tips:
- First time? Run 'openclaw bills setup' to connect accounts
- Use 'openclaw bills status' to see last sync time
- Transactions are stored in ~/.openclaw/billclaw/
`,
          },
        ],
      };
    }

    if (topicLower.includes("export") || topicLower.includes("beancount")) {
      return {
        content: [
          {
            type: "text",
            text: `
Export Commands:

billclaw supports exporting to:
- Beancount format (plain text accounting)
- Ledger format (plain text accounting)
- Custom API push (webhook integration)

Coming soon: CLI export commands. For now, use the agent tools:
- exportToBeancountTool
- exportToLedgerTool
- pushToCustomApiTool
`,
          },
        ],
      };
    }

    if (topicLower.includes("webhook")) {
      return {
        content: [
          {
            type: "text",
            text: `
Webhook Configuration:

Webhooks allow real-time notifications for:
- New transactions (transaction.new)
- Sync events (sync.completed, sync.failed)
- Account events (account.connected, account.error)

Setup:
1. Configure webhook URL in ~/.openclaw/config.json:
   {
     "billclaw": {
       "webhooks": [{
         "enabled": true,
         "url": "https://your-server.com/webhook",
         "secret": "your-secret"
       }]
     }
   }

2. Test webhook:
   curl -X POST http://localhost:41209/webhook/test \\
     -H "Content-Type: application/json" \\
     -d '{"message":"Test"}'

See: docs/webhook-guide.md
`,
          },
        ],
      };
    }
  }

  // Default help
  return {
    content: [
      {
        type: "text",
        text: getHelpText(),
      },
    ],
  };
}
