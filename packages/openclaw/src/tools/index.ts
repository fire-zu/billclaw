/**
 * OpenClaw tool adapters for BillClaw
 *
 * These adapters wrap the core BillClaw functionality to work with
 * OpenClaw's tool API.
 */

import type { OpenClawPluginApi } from "../types/openclaw-plugin.js"
import { Billclaw } from "@firela/billclaw-core"
import { OpenClawRuntimeContext } from "../runtime/context.js"

/**
 * Create a BillClaw instance from OpenClaw API
 */
function createBillclaw(api: OpenClawPluginApi): Billclaw {
  const runtime = new OpenClawRuntimeContext(api)
  return new Billclaw(runtime)
}

/**
 * Plaid sync tool
 */
export const plaidSyncTool = {
  name: "plaid_sync",
  label: "Plaid Sync",
  description: "Sync transactions from Plaid-connected bank accounts",
  parameters: {
    accountId: {
      type: "string",
      optional: true,
      description: "Specific account ID to sync (omits to sync all)",
    },
  } as const,

  async execute(api: OpenClawPluginApi, params: { accountId?: string }) {
    const billclaw = createBillclaw(api)
    const results = await billclaw.syncPlaid(
      params.accountId ? [params.accountId] : undefined,
    )

    const totalAdded = results.reduce((sum, r) => sum + r.transactionsAdded, 0)
    const totalUpdated = results.reduce(
      (sum, r) => sum + r.transactionsUpdated,
      0,
    )
    const errors = results.flatMap((r) => r.errors || [])

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: errors.length === 0,
              accountsSynced: results.length,
              transactionsAdded: totalAdded,
              transactionsUpdated: totalUpdated,
              errors: errors.length > 0 ? errors : undefined,
            },
            null,
            2,
          ),
        },
      ],
    }
  },
}

/**
 * Gmail fetch bills tool
 */
export const gmailFetchTool = {
  name: "gmail_fetch_bills",
  label: "Gmail Fetch Bills",
  description: "Fetch and parse bills from Gmail",
  parameters: {
    accountId: {
      type: "string",
      optional: true,
      description: "Specific Gmail account ID to sync (omit for all)",
    },
    days: {
      type: "number",
      optional: true,
      description: "Number of days to look back (default: 30)",
    },
  } as const,

  async execute(
    api: OpenClawPluginApi,
    params: { accountId?: string; days?: number },
  ) {
    const billclaw = createBillclaw(api)
    const results = await billclaw.syncGmail(
      params.accountId ? [params.accountId] : undefined,
      params.days ?? 30,
    )

    const totalEmails = results.reduce((sum, r) => sum + r.emailsProcessed, 0)
    const totalBills = results.reduce((sum, r) => sum + r.billsExtracted, 0)
    const totalAdded = results.reduce((sum, r) => sum + r.transactionsAdded, 0)
    const errors = results.flatMap((r) => r.errors || [])

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: errors.length === 0,
              accountsProcessed: results.length,
              emailsProcessed: totalEmails,
              billsExtracted: totalBills,
              transactionsAdded: totalAdded,
              errors: errors.length > 0 ? errors : undefined,
            },
            null,
            2,
          ),
        },
      ],
    }
  },
}

/**
 * Bill parse tool
 */
export const billParseTool = {
  name: "bill_parse",
  label: "Bill Parse",
  description: "Parse bill data from various formats (PDF, CSV, email)",
  parameters: {
    source: {
      type: "string",
      description: "Source type: plaid, gmail, file, or email",
    },
    data: {
      type: "string",
      description: "Raw data or file path to parse",
    },
  } as const,

  async execute(
    _api: OpenClawPluginApi,
    params: { source: string; data: string },
  ) {
    // This is a stub - the actual implementation would depend on the source type
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: false,
              source: params.source,
              transactions: [],
              errors: ["Bill parsing not yet implemented"],
            },
            null,
            2,
          ),
        },
      ],
    }
  },
}

/**
 * Conversational sync tool
 */
export const conversationalSyncTool = {
  name: "conversational_sync",
  label: "Conversational Sync",
  description: "Sync transactions with natural language support",
  parameters: {
    prompt: {
      type: "string",
      optional: true,
      description: "Natural language prompt (e.g., 'Sync my accounts')",
    },
    accountId: {
      type: "string",
      optional: true,
      description: "Explicit account ID to sync",
    },
  } as const,

  async execute(
    api: OpenClawPluginApi,
    params: { prompt?: string; accountId?: string },
  ) {
    const billclaw = createBillclaw(api)

    // If accountId is specified, sync that account
    if (params.accountId) {
      return plaidSyncTool.execute(api, { accountId: params.accountId })
    }

    // Otherwise, sync all due accounts
    const results = await billclaw.syncDueAccounts()

    const totalAdded = results.reduce((sum, r) => sum + r.transactionsAdded, 0)
    const totalUpdated = results.reduce(
      (sum, r) => sum + r.transactionsUpdated,
      0,
    )
    const errors = results.flatMap((r) => r.errors || [])

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: errors.length === 0,
              accountsSynced: results.length,
              transactionsAdded: totalAdded,
              transactionsUpdated: totalUpdated,
              errors: errors.length > 0 ? errors : undefined,
            },
            null,
            2,
          ),
        },
      ],
    }
  },
}

/**
 * Conversational status tool
 */
export const conversationalStatusTool = {
  name: "conversational_status",
  label: "Conversational Status",
  description: "Show account status with natural language",
  parameters: {
    prompt: {
      type: "string",
      optional: true,
      description: "Natural language prompt",
    },
  } as const,

  async execute(api: OpenClawPluginApi, _params: { prompt?: string }) {
    const billclaw = createBillclaw(api)
    const accounts = await billclaw.getAccounts()

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              accounts,
              message: `Found ${accounts.length} configured accounts`,
            },
            null,
            2,
          ),
        },
      ],
    }
  },
}

/**
 * Conversational help tool
 */
export const conversationalHelpTool = {
  name: "conversational_help",
  label: "Conversational Help",
  description: "Get help with billclaw commands and features",
  parameters: {
    topic: {
      type: "string",
      optional: true,
      description: "Specific help topic (sync, export, webhook, etc.)",
    },
  } as const,

  async execute(_api: OpenClawPluginApi, params: { topic?: string }) {
    const helpText = getHelpText(params.topic)

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              topic: params.topic || "general",
              help: helpText,
            },
            null,
            2,
          ),
        },
      ],
    }
  },
}

/**
 * Get help text for a topic
 */
function getHelpText(topic?: string): string {
  const helps: Record<string, string> = {
    sync: "Sync transactions from connected accounts. Use 'bills sync' to manually trigger sync.",
    export:
      "Export transactions to Beancount or Ledger format. Configure export options in config.",
    webhook:
      "Configure webhooks for real-time transaction updates. Set webhook URL and HMAC secret in config.",
    setup:
      "Run 'bills setup' to connect new bank accounts via Plaid Link or Gmail OAuth.",
  }

  if (topic && helps[topic]) {
    return helps[topic]
  }

  return `Available commands: bills setup, bills sync, bills status, bills config

Available topics: ${Object.keys(helps).join(", ")}

For more information, visit: https://github.com/fire-la/billclaw`
}
