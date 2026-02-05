/**
 * billclaw - Bank transaction and bill data import for OpenClaw
 *
 * Data sovereignty for your financial data.
 * Hold your own Plaid/bank access tokens locally.
 *
 * @author fire-zu
 * @license MIT
 */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { Type } from "@sinclair/typebox";
import { billclawConfigSchema } from "./config.js";

// ============================================================================
// Plugin Definition
// ============================================================================

const billclawPlugin = {
  id: "billclaw",
  name: "BillClaw",
  description: "Bank transaction and bill data import with data sovereignty",
  kind: "integrations" as const,
  configSchema: billclawConfigSchema,

  register(api: OpenClawPluginApi) {
    const cfg = billclawConfigSchema.parse(api.pluginConfig);

    api.logger.info(`billclaw: plugin registered (${cfg.accounts.length} accounts configured)`);

    // ========================================================================
    // Tools
    // ========================================================================

    api.registerTool(
      {
        name: "plaid_sync",
        label: "Plaid Sync",
        description:
          "Sync transactions from Plaid-connected bank accounts. Use this to fetch the latest transactions from configured bank accounts.",
        parameters: Type.Object({
          accountId: Type.Optional(
            Type.String({ description: "Specific account ID to sync (omits to sync all)" }),
          ),
        }),
        async execute(_toolCallId, params) {
          const { plaidSyncTool } = await import("./src/tools/plaid-sync.js");
          return plaidSyncTool(api, params as { accountId?: string });
        },
      },
      { name: "plaid_sync" },
    );

    api.registerTool(
      {
        name: "gmail_fetch_bills",
        label: "Gmail Fetch Bills",
        description: "Fetch and parse bills from Gmail",
        parameters: Type.Object({
          days: Type.Optional(
            Type.Number({ description: "Number of days to look back (default: 30)" }),
          ),
        }),
        async execute(_toolCallId, params) {
          const { gmailFetchTool } = await import("./src/tools/gmail-fetch.js");
          return gmailFetchTool(params as { days?: number });
        },
      },
      { name: "gmail_fetch_bills" },
    );

    api.registerTool(
      {
        name: "bill_parse",
        label: "Bill Parse",
        description: "Parse bill data from various formats (PDF, CSV, email)",
        parameters: Type.Object({
          source: Type.String({
            description: "Source type: plaid, gmail, file, or email",
          }),
          data: Type.String({ description: "Raw data or file path to parse" }),
        }),
        async execute(_toolCallId, params) {
          const { billParseTool } = await import("./src/tools/bill-parse.js");
          return billParseTool(params as never);
        },
      },
      { name: "bill_parse" },
    );

    // ========================================================================
    // CLI Commands
    // ========================================================================

    api.registerCli(
      ({ program }: { program: any }) => {
        const bills = program
          .command("bills")
          .description("Manage bank account connections and transaction imports");

        bills
          .command("setup")
          .description("Interactive setup wizard for connecting bank accounts")
          .action(async () => {
            const { setupWizard } = await import("./src/cli/commands.js");
            return setupWizard();
          });

        bills
          .command("sync")
          .description("Manually trigger transaction sync for all connected accounts")
          .argument("[accountId]", "Specific account ID to sync")
          .action(async (accountId = undefined) => {
            const { syncCommand } = await import("./src/cli/commands.js");
            return syncCommand(accountId);
          });

        bills
          .command("status")
          .description("Show connection status and recent sync results")
          .action(async () => {
            const { statusCommand } = await import("./src/cli/commands.js");
            return statusCommand();
          });

        bills
          .command("config")
          .description("Manage plugin configuration")
          .argument("[key]", "Config key to view/set")
          .argument("[value]", "Config value to set")
          .action(async (key = undefined, value = undefined) => {
            const { configCommand } = await import("./src/cli/commands.js");
            return configCommand({ key, value });
          });
      },
      { commands: ["bills", "bills:setup", "bills:sync", "bills:status", "bills:config"] },
    );

    // ========================================================================
    // OAuth Providers
    // ========================================================================

    api.registerOAuth({
      name: "plaid",
      description: "Plaid Link OAuth flow for connecting bank accounts",
      handler: async (context) => {
        const { plaidOAuth } = await import("./src/oauth/plaid.js");
        return plaidOAuth(context);
      },
    });

    // ========================================================================
    // Background Services
    // ========================================================================

    api.registerService({
      id: "billclaw-sync",
      start: async () => {
        const { syncService } = await import("./src/services/sync-service.js");
        await syncService(api);
        api.logger.info("billclaw: sync service started");
      },
      stop: async () => {
        api.logger.info("billclaw: sync service stopped");
      },
    });

    api.registerService({
      id: "billclaw-webhook",
      start: async () => {
        const { webhookHandler } = await import("./src/services/webhook-handler.js");
        await webhookHandler(api);
        api.logger.info("billclaw: webhook handler started");
      },
      stop: async () => {
        api.logger.info("billclaw: webhook handler stopped");
      },
    });
  },
};

export default billclawPlugin;
