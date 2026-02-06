/**
 * BillClaw OpenClaw Plugin
 *
 * OpenClaw adapter for BillClaw financial data import.
 *
 * @packageDocumentation
 */

import type { OpenClawPluginApi } from "./types/openclaw-plugin.js"
import {
  plaidSyncTool,
  gmailFetchTool,
  billParseTool,
  conversationalSyncTool,
  conversationalStatusTool,
  conversationalHelpTool,
} from "./tools/index.js"
import { registerWebhookHandlers } from "./services/webhook-handler.js"
import { runSetupWizard } from "./setup/index.js"

/**
 * BillClaw OpenClaw plugin
 */
export default {
  id: "billclaw",
  name: "BillClaw",
  description:
    "Financial data sovereignty with multi-platform plugin architecture",
  kind: "integrations" as const,

  register(api: OpenClawPluginApi) {
    api.logger.info?.("billclaw: plugin registered")

    // ========================================================================
    // Tools
    // ========================================================================

    api.registerTool({
      name: plaidSyncTool.name,
      label: plaidSyncTool.label,
      description: plaidSyncTool.description,
      parameters: plaidSyncTool.parameters,
      execute: async (_toolCallId, params) => {
        return plaidSyncTool.execute(api, params as never)
      },
    })

    api.registerTool({
      name: gmailFetchTool.name,
      label: gmailFetchTool.label,
      description: gmailFetchTool.description,
      parameters: gmailFetchTool.parameters,
      execute: async (_toolCallId, params) => {
        return gmailFetchTool.execute(api, params as never)
      },
    })

    api.registerTool({
      name: billParseTool.name,
      label: billParseTool.label,
      description: billParseTool.description,
      parameters: billParseTool.parameters,
      execute: async (_toolCallId, params) => {
        return billParseTool.execute(api, params as never)
      },
    })

    api.registerTool({
      name: conversationalSyncTool.name,
      label: conversationalSyncTool.label,
      description: conversationalSyncTool.description,
      parameters: conversationalSyncTool.parameters,
      execute: async (_toolCallId, params) => {
        return conversationalSyncTool.execute(api, params as never)
      },
    })

    api.registerTool({
      name: conversationalStatusTool.name,
      label: conversationalStatusTool.label,
      description: conversationalStatusTool.description,
      parameters: conversationalStatusTool.parameters,
      execute: async (_toolCallId, params) => {
        return conversationalStatusTool.execute(api, params as never)
      },
    })

    api.registerTool({
      name: conversationalHelpTool.name,
      label: conversationalHelpTool.label,
      description: conversationalHelpTool.description,
      parameters: conversationalHelpTool.parameters,
      execute: async (_toolCallId, params) => {
        return conversationalHelpTool.execute(api, params as never)
      },
    })

    // ========================================================================
    // CLI Commands
    // ========================================================================

    api.registerCli({
      commands: [
        "bills",
        "bills:setup",
        "bills:sync",
        "bills:status",
        "bills:config",
      ],
      handler: ({ program }) => {
        const bills = program
          .command("bills")
          .description("Manage financial data accounts and transaction imports")

        bills
          .command("setup")
          .description("Interactive setup wizard for connecting accounts")
          .argument("[provider]", "Provider to setup (plaid, gmail, gocardless)")
          .option("--client-id <id>", "API Client ID")
          .option("--secret <secret>", "API Secret")
          .option("--environment <env>", "API Environment")
          .action(async (provider = undefined, options?: Record<string, unknown>) => {
            api.logger.info?.("Running setup wizard...")
            const result = await runSetupWizard(api, provider, options)
            if (result.nextSteps) {
              return {
                message: result.message,
                nextSteps: result.nextSteps.join("\n"),
              }
            }
            return { message: result.message }
          })

        bills
          .command("sync")
          .description("Manually trigger transaction sync")
          .argument("[accountId]", "Specific account ID to sync")
          .action(async (accountId = undefined) => {
            api.logger.info?.(
              `Syncing${
                accountId ? ` account ${accountId}` : " all accounts"
              }...`,
            )
            const result = await plaidSyncTool.execute(api, { accountId })
            api.logger.info?.("Sync complete:", result)
            return result
          })

        bills
          .command("status")
          .description("Show connection status and recent sync results")
          .action(async () => {
            const result = await conversationalStatusTool.execute(api, {})
            api.logger.info?.("Status:", result)
            return result
          })

        bills
          .command("config")
          .description("Manage plugin configuration")
          .argument("[key]", "Config key to view/set")
          .argument("[value]", "Config value to set")
          .action(async (key = undefined, value = undefined) => {
            if (key && value) {
              api.logger.info?.(`Setting config: ${key} = ${value}`)
              return { message: `Config ${key} updated` }
            } else if (key) {
              const config = api.pluginConfig as Record<string, unknown>
              return { [key]: config[key] }
            } else {
              return api.pluginConfig
            }
          })
      },
    })

    // ========================================================================
    // OAuth Providers
    // ========================================================================

    api.registerOAuth({
      name: "plaid",
      description: "Plaid Link OAuth flow for connecting bank accounts",
      handler: async (context) => {
        api.logger.info?.("Plaid OAuth initiated")
        const { plaidOAuthHandler } = await import("./oauth/plaid.js")
        const publicToken = context?.publicToken as string | undefined
        return plaidOAuthHandler(api, publicToken)
      },
    })

    api.registerOAuth({
      name: "gmail",
      description: "Gmail OAuth 2.0 flow for accessing email bills",
      handler: async (context) => {
        api.logger.info?.("Gmail OAuth initiated")
        const { gmailOAuthHandler } = await import("./oauth/gmail.js")
        const code = context?.code as string | undefined
        const state = context?.state as string | undefined
        const redirectUri = context?.redirectUri as string | undefined
        return gmailOAuthHandler(api, { code, state, redirectUri })
      },
    })

    // ========================================================================
    // Webhook Handlers
    // ========================================================================

    const cfg = api.pluginConfig as any
    const plaidSecret =
      cfg.plaid?.webhookSecret || process.env.PLAID_WEBHOOK_SECRET

    registerWebhookHandlers({
      api,
      plaidWebhookSecret: plaidSecret,
    })

    // ========================================================================
    // Background Services
    // ========================================================================

    api.registerService({
      id: "billclaw-sync",
      start: async () => {
        api.logger.info?.("billclaw: sync service started")
      },
      stop: async () => {
        api.logger.info?.("billclaw: sync service stopped")
      },
    })

    api.registerService({
      id: "billclaw-webhook",
      start: async () => {
        api.logger.info?.("billclaw: webhook handler started")
      },
      stop: async () => {
        api.logger.info?.("billclaw: webhook handler stopped")
      },
    })
  },
}
