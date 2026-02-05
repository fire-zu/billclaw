/**
 * CLI command implementations for billclaw
 */

import type { AccountConfig } from "../../config.js";

/**
 * Interactive setup wizard for connecting bank accounts
 */
export async function setupWizard(): Promise<void> {
  console.log("🦀 billclaw Setup Wizard");
  console.log("This will guide you through connecting your bank accounts.\n");

  // TODO: Implement interactive setup
  // 1. Select data source (Plaid, GoCardless, Gmail)
  // 2. OAuth flow
  // 3. Configure sync settings
  // 4. Save config

  console.log("Setup wizard coming soon!");
  console.log("For now, please configure manually via ~/.openclaw/billclaw/config.json");
}

/**
 * Manually trigger sync for all or specific account
 */
export async function syncCommand(accountId?: string): Promise<{
  success: boolean;
  accounts: number;
  transactions: number;
  errors: string[];
}> {
  console.log(`🔄 Syncing${accountId ? ` account ${accountId}` : " all accounts"}...`);

  // TODO: Implement sync logic
  // 1. Load accounts from config
  // 2. For each enabled account:
  //    - Call appropriate sync handler (Plaid/Gmail/GoCardless)
  //    - Store transactions in local JSON files
  //    - Update sync status

  return {
    success: false,
    accounts: 0,
    transactions: 0,
    errors: ["Not implemented yet"],
  };
}

/**
 * Show connection status and recent sync results
 */
export async function statusCommand(): Promise<void> {
  console.log("📊 billclaw Status\n");

  // TODO: Implement status display
  // 1. Load accounts from config
  // 2. Show per-account status (enabled/connected/last sync)
  // 3. Show recent sync results
  // 4. Display error messages if any

  console.log("Status command coming soon!");
}

/**
 * Manage configuration
 */
export async function configCommand(args: { key?: string; value?: string }): Promise<void> {
  // TODO: Implement config get/set
  if (args.key && args.value) {
    console.log(`Setting ${args.key} = ${args.value}`);
  } else if (args.key) {
    console.log(`Getting ${args.key}`);
  } else {
    console.log("Config management coming soon!");
  }
}
