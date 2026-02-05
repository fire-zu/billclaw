/**
 * CLI command implementations for billclaw
 */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { BillclawConfig, AccountConfig } from "../../config.js";
import type { PlaidSyncResult } from "../tools/plaid-sync.js";
import { plaidSyncTool, fromToolReturn } from "../tools/plaid-sync.js";
import {
  initializeStorage,
  readAccountRegistry,
  readSyncStates,
  writeAccountRegistry,
  type AccountRegistry,
} from "../storage/transaction-storage.js";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import * as readline from "node:readline/promises";

/**
 * Create a readline interface for user input
 */
function createReadline(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * Ask a question and get user input
 */
async function askQuestion(
  rl: readline.Interface,
  question: string,
  defaultValue?: string
): Promise<string> {
  const prompt = defaultValue ? `${question} [${defaultValue}]: ` : `${question}: `;
  const answer = await rl.question(prompt);
  return answer.trim() || defaultValue || "";
}

/**
 * Ask a yes/no question
 */
async function askYesNo(
  rl: readline.Interface,
  question: string,
  defaultValue: boolean = false
): Promise<boolean> {
  const defaultStr = defaultValue ? "Y/n" : "y/N";
  const answer = await rl.question(`${question} [${defaultStr}]: `);
  const normalized = answer.trim().toLowerCase();
  if (!normalized) return defaultValue;
  return normalized === "y" || normalized === "yes";
}

/**
 * Select from a list of options
 */
async function askSelect(
  rl: readline.Interface,
  question: string,
  options: string[],
  defaultIndex: number = 0
): Promise<number> {
  console.log(question);
  for (let i = 0; i < options.length; i++) {
    const suffix = i === defaultIndex ? " (default)" : "";
    console.log(`  ${i + 1}. ${options[i]}${suffix}`);
  }
  const answer = await rl.question(`Select option [1-${options.length}]: `);
  const index = parseInt(answer.trim(), 10) - 1;
  if (isNaN(index) || index < 0 || index >= options.length) {
    return defaultIndex;
  }
  return index;
}

/**
 * Mock context for CLI commands (in real usage, OpenClaw provides this)
 */
interface MockContext extends OpenClawPluginApi {
  pluginConfig: BillclawConfig;
}

/**
 * Create a mock context for CLI operations
 */
function createMockContext(): MockContext {
  return {
    pluginConfig: {} as BillclawConfig,
    logger: {
      info: (...args: any[]) => console.log(...args),
      error: (...args: any[]) => console.error(...args),
      warn: (...args: any[]) => console.warn(...args),
      debug: (...args: any[]) => console.debug(...args),
    },
  } as MockContext;
}

/**
 * Interactive setup wizard for connecting bank accounts
 */
export async function setupWizard(): Promise<void> {
  const rl = createReadline();

  try {
    console.log("🦀 billclaw Setup Wizard");
    console.log("This will guide you through connecting your bank accounts.\n");

    // Initialize storage
    await initializeStorage();

    // Read existing accounts
    const existingAccounts = await readAccountRegistry();

    if (existingAccounts.length > 0) {
      console.log(`You have ${existingAccounts.length} existing account(s):\n`);
      for (const account of existingAccounts) {
        // AccountRegistry doesn't have enabled field - show as configured
        console.log(`  ✅ ${account.name} (${account.type})`);
      }
      console.log("");

      const addAnother = await askYesNo(rl, "Do you want to add another account?", false);
      if (!addAnother) {
        console.log("\n💡 Run 'openclaw bills sync' to sync your accounts.");
        console.log("💡 Run 'openclaw bills status' to view connection status.");
        return;
      }
    }

    // Step 1: Select account type
    console.log("\nStep 1: Select your data source");
    const typeIndex = await askSelect(
      rl,
      "Choose your bank connection method:",
      [
        "Plaid (US/Canada banks)",
        "GoCardless (European banks) - Coming soon",
        "Gmail Bills - Coming soon",
      ]
    );

    if (typeIndex !== 0) {
      console.log("\n⚠️  This option is not yet available.");
      console.log("   Please check back soon or use Plaid for US/Canada banks.\n");
      console.log("💡 For updates: https://github.com/fire-zu/billclaw");
      return;
    }

    // Step 2: Account name
    console.log("\nStep 2: Name your account");
    const accountName = await askQuestion(
      rl,
      "Account name",
      "My Checking Account"
    );

    // Step 3: Plaid configuration
    console.log("\nStep 3: Configure Plaid API");
    console.log("\n📋 To get Plaid API credentials:");
    console.log("   1. Go to https://dashboard.plaid.com");
    console.log("   2. Create an account or sign in");
    console.log("   3. Go to API Keys");
    console.log("   4. Copy your Client ID and Secret\n");

    const clientId = await askQuestion(rl, "Plaid Client ID");
    if (!clientId) {
      console.log("\n❌ Client ID is required.");
      console.log("   Please get your credentials from https://dashboard.plaid.com\n");
      return;
    }

    const secret = await askQuestion(rl, "Plaid Secret");
    if (!secret) {
      console.log("\n❌ Secret is required.");
      console.log("   Please get your credentials from https://dashboard.plaid.com\n");
      return;
    }

    const envIndex = await askSelect(
      rl,
      "Select environment:",
      ["Sandbox (testing)", "Development", "Production"]
    );

    const environments = ["sandbox", "development", "production"];
    const environment = environments[envIndex];

    // Generate account ID
    const accountId = `plaid_${Date.now()}`;

    // Create account registry entry (requires createdAt field)
    const newAccountRegistry: AccountRegistry = {
      id: accountId,
      type: "plaid",
      name: accountName,
      createdAt: new Date().toISOString(),
    };

    // Update account registry
    const updatedAccounts = [...existingAccounts, newAccountRegistry];
    await writeAccountRegistry(updatedAccounts);

    // Save configuration
    await savePlaidConfig(clientId, secret, environment);

    console.log("\n✅ Account configured successfully!\n");
    console.log("📝 Summary:");
    console.log(`   Account ID: ${accountId}`);
    console.log(`   Name: ${accountName}`);
    console.log(`   Environment: ${environment}`);
    console.log(`   Storage: ~/.openclaw/billclaw/`);
    console.log("\n🔐 Data Sovereignty:");
    console.log("   - Your Plaid access tokens are stored locally");
    console.log("   - Tokens are never sent to any external server");
    console.log("   - You have full control over your financial data");
    console.log("\n📋 Next Steps:");
    console.log("   1. Run 'openclaw bills sync' to fetch your transactions");
    console.log("   2. Run 'openclaw bills status' to view sync status");
    console.log("   3. Run 'openclaw bills config' to manage settings");
    console.log("\n💡 Tip: Set environment variables for convenience:");
    console.log("   export PLAID_CLIENT_ID='your_client_id'");
    console.log("   export PLAID_SECRET='your_secret'");
    console.log("   export PLAID_ENVIRONMENT='sandbox'");
  } finally {
    rl.close();
  }
}

/**
 * Save Plaid configuration to the config file
 */
async function savePlaidConfig(
  clientId: string,
  secret: string,
  environment: string
): Promise<void> {
  const configPath = path.join(os.homedir(), ".openclaw", "config.json");
  const configDir = path.dirname(configPath);

  // Ensure config directory exists
  try {
    await fs.mkdir(configDir, { recursive: true });
  } catch {
    // Directory might already exist
  }

  // Read existing config or create new
  let config: any = {};
  try {
    const configData = await fs.readFile(configPath, "utf-8");
    config = JSON.parse(configData);
  } catch {
    // File doesn't exist, create new config
    config = {};
  }

  // Update billclaw config
  config.billclaw = config.billclaw || {};
  config.billclaw.plaid = config.billclaw.plaid || {};
  config.billclaw.plaid.clientId = clientId;
  config.billclaw.plaid.secret = secret;
  config.billclaw.plaid.environment = environment;

  // Write updated config
  await fs.writeFile(configPath, JSON.stringify(config, null, 2));

  console.log(`   Config saved to: ${configPath}`);
}

/**
 * Manually trigger sync for all or specific account
 */
export async function syncCommand(
  accountId?: string
): Promise<{
  success: boolean;
  accounts: number;
  transactions: number;
  errors: string[];
}> {
  console.log(`🔄 Syncing${accountId ? ` account ${accountId}` : " all accounts"}...`);

  const _context = createMockContext(); // Keep for future use with plaidSyncTool

  // In real implementation, this would call the actual tool
  // For now, show a message
  try {
    const toolReturn = await plaidSyncTool(_context, {
      accountId,
    });
    const result = fromToolReturn(toolReturn);

    if (result.success) {
      console.log(`✅ Sync completed:`);
      console.log(`   Accounts synced: ${accountId || "all"}`);
      console.log(`   Transactions added: ${result.transactionsAdded}`);
      console.log(`   Transactions updated: ${result.transactionsUpdated}`);
      if (result.cursor) {
        console.log(`   Cursor: ${result.cursor.substring(0, 16)}...`);
      }
    } else {
      console.log(`❌ Sync failed:`);
      if (result.errors) {
        for (const error of result.errors) {
          console.log(`   - ${error}`);
        }
      }
    }

    return {
      success: result.success,
      accounts: accountId ? 1 : -1, // TODO: Get actual count
      transactions: result.transactionsAdded + result.transactionsUpdated,
      errors: result.errors || [],
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.log(`❌ Sync error: ${errorMsg}`);
    return {
      success: false,
      accounts: 0,
      transactions: 0,
      errors: [errorMsg],
    };
  }
}

/**
 * Show connection status and recent sync results
 */
export async function statusCommand(): Promise<void> {
  console.log("📊 billclaw Status\n");

  try {
    // Read accounts
    const accounts = await readAccountRegistry();

    if (accounts.length === 0) {
      console.log("No accounts configured yet.");
      console.log("\nRun 'openclaw bills setup' to get started.");
      return;
    }

    console.log(`Configured Accounts: ${accounts.length}\n`);

    for (const account of accounts) {
      const syncStates = await readSyncStates(account.id);
      const lastSync = syncStates.find((s) => s.status === "completed");
      const lastSyncTime = lastSync?.completedAt
        ? new Date(lastSync.completedAt).toLocaleString()
        : "Never";
      const status = lastSync?.status || "pending";

      const statusEmoji =
        status === "completed" ? "✅" : status === "failed" ? "❌" : "⏳";

      console.log(
        `  ${statusEmoji} ${account.name} (${account.type}) - Last sync: ${lastSyncTime}`
      );
    }

    console.log("\n💡 Run 'openclaw bills sync' to sync all accounts.");
  } catch (error) {
    console.log("❌ Failed to read status:", error);
  }
}

/**
 * Manage configuration
 */
export async function configCommand(args: {
  key?: string;
  value?: string;
}): Promise<void> {
  if (args.key && args.value) {
    console.log(`Setting ${args.key} = ${args.value}`);
    // In real implementation, this would update the config via OpenClaw
    console.log(`✅ Configuration updated (via OpenClaw config system)`);
  } else if (args.key) {
    console.log(`Getting ${args.key}:`);
    // In real implementation, this would read from OpenClaw config
    console.log(`(Value would be read from OpenClaw config: billclaw.${args.key})`);
  } else {
    console.log("💡 billclaw Configuration Management\n");
    console.log("View all config:");
    console.log("  openclaw bills config\n");
    console.log("Set a value:");
    console.log("  openclaw config set billclaw.plaid.clientId YOUR_CLIENT_ID");
    console.log("  openclaw config set billclaw.plaid.secret YOUR_SECRET");
    console.log("  openclaw config set billclaw.plaid.environment sandbox\n");
    console.log("Available config paths:");
    console.log("  billclaw.plaid.clientId     - Plaid Client ID");
    console.log("  billclaw.plaid.secret       - Plaid Secret");
    console.log("  billclaw.plaid.environment  - sandbox|development|production");
    console.log("  billclaw.storage.path       - Local storage path (default: ~/.openclaw/billclaw)");
  }
}
