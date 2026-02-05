/**
 * Plaid sync tool - syncs transactions from Plaid-connected accounts
 */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
import type {
  TransactionsSyncRequest,
  TransactionsSyncResponse,
} from "plaid";
import type { BillclawConfig } from "../../config.js";
import type { StorageConfig } from "../storage/transaction-storage.js";
import { Transaction, SyncState } from "../storage/transaction-storage.js";
import {
  appendTransactions,
  deduplicateTransactions,
  readSyncStates,
  writeGlobalCursor,
  writeSyncState,
} from "../storage/transaction-storage.js";

export interface PlaidSyncParams {
  accountId?: string;
}

export interface PlaidSyncResult {
  success: boolean;
  accountId: string;
  transactionsAdded: number;
  transactionsUpdated: number;
  cursor: string;
  errors?: string[];
}

/**
 * Get Plaid client configuration
 */
function getPlaidConfig(context: OpenClawPluginApi): {
  clientId: string;
  secret: string;
  environment: string;
} {
  const config = context.pluginConfig as BillclawConfig;
  const plaidConfig = config?.plaid || {};

  const clientId = plaidConfig.clientId || process.env.PLAID_CLIENT_ID;
  const secret = plaidConfig.secret || process.env.PLAID_SECRET;
  const environment = plaidConfig.environment || "sandbox";

  if (!clientId || !secret) {
    throw new Error(
      "Plaid credentials not configured. Set PLAID_CLIENT_ID and PLAID_SECRET environment variables."
    );
  }

  const plaidEnvMap: Record<string, string> = {
    sandbox: PlaidEnvironments.sandbox,
    development: PlaidEnvironments.development,
    production: PlaidEnvironments.production,
  };

  return {
    clientId,
    secret,
    environment: plaidEnvMap[environment] || PlaidEnvironments.sandbox,
  };
}

/**
 * Create Plaid API client
 */
function createPlaidClient(context: OpenClawPluginApi): PlaidApi {
  const { clientId, secret, environment } = getPlaidConfig(context);

  const configuration = new Configuration({
    basePath: environment,
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": clientId,
        "PLAID-SECRET": secret,
      },
    },
  });

  return new PlaidApi(configuration);
}

/**
 * Convert Plaid transaction to internal format
 */
function convertTransaction(
  plaidTxn: any,
  accountId: string
): Transaction {
  return {
    transactionId: `${accountId}_${plaidTxn.transaction_id}`,
    accountId,
    date: plaidTxn.date,
    amount: Math.round(plaidTxn.amount * 100), // Convert to cents
    currency: plaidTxn.iso_currency_code,
    category: plaidTxn.category || [],
    merchantName: plaidTxn.merchant_name || plaidTxn.name || "Unknown",
    paymentChannel: plaidTxn.payment_channel,
    pending: plaidTxn.pending,
    plaidTransactionId: plaidTxn.transaction_id,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Sync transactions from a single Plaid account
 */
async function syncAccount(
  context: OpenClawPluginApi,
  account: { id: string; plaidAccessToken?: string },
  storageConfig: StorageConfig
): Promise<PlaidSyncResult> {
  const errors: string[] = [];
  let transactionsAdded = 0;
  let transactionsUpdated = 0;
  let cursor = "";

  const syncId = `sync_${Date.now()}`;
  const syncState: SyncState = {
    syncId,
    accountId: account.id,
    startedAt: new Date().toISOString(),
    status: "running",
    transactionsAdded: 0,
    transactionsUpdated: 0,
    cursor: "",
  };

  try {
    // Get previous sync state for cursor
    const previousSyncs = await readSyncStates(account.id, storageConfig);
    const lastSync = previousSyncs.find((s) => s.status === "completed");
    const lastCursor = lastSync?.cursor || undefined;

    const plaidClient = createPlaidClient(context);

    const request: TransactionsSyncRequest = {
      access_token: account.plaidAccessToken || "",
      cursor: lastCursor,
      count: 500,
    };

    const axiosResponse = await plaidClient.transactionsSync(request);
    const response: TransactionsSyncResponse = axiosResponse.data;

    cursor = response.next_cursor || "";
    const removed = response.removed || [];
    const added = response.added || [];

    context.logger.info(
      `Plaid sync for ${account.id}: ${added.length} added, ${removed.length} removed`
    );

    // Convert transactions
    const transactions: Transaction[] = added.map((txn) =>
      convertTransaction(txn, account.id)
    );

    // Deduplicate transactions (24h window)
    const deduplicated = deduplicateTransactions(transactions, 24);

    // Group by month for storage
    const byMonth = new Map<string, Transaction[]>();
    for (const txn of deduplicated) {
      const date = new Date(txn.date);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      if (!byMonth.has(key)) {
        byMonth.set(key, []);
      }
      byMonth.get(key)!.push(txn);
    }

    // Store transactions per month
    for (const [monthKey, monthTransactions] of byMonth.entries()) {
      const [year, month] = monthKey.split("-").map(Number);
      const result = await appendTransactions(
        account.id,
        year,
        month,
        monthTransactions,
        storageConfig
      );
      transactionsAdded += result.added;
      transactionsUpdated += result.updated;
    }

    // Update sync state
    syncState.status = "completed";
    syncState.completedAt = new Date().toISOString();
    syncState.transactionsAdded = transactionsAdded;
    syncState.transactionsUpdated = transactionsUpdated;
    syncState.cursor = cursor;

    context.logger.info(
      `Sync completed for ${account.id}: ${transactionsAdded} added, ${transactionsUpdated} updated`
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    errors.push(errorMsg);
    syncState.status = "failed";
    syncState.error = errorMsg;
    context.logger.error(`Sync failed for ${account.id}:`, error);
  } finally {
    await writeSyncState(syncState, storageConfig);
  }

  return {
    success: errors.length === 0,
    accountId: account.id,
    transactionsAdded,
    transactionsUpdated,
    cursor,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Sync transactions from Plaid for a specific account or all accounts
 */
export async function plaidSyncTool(
  context: OpenClawPluginApi,
  params: PlaidSyncParams
): Promise<PlaidSyncResult> {
  const config = context.pluginConfig as BillclawConfig;
  const accounts = config?.accounts || [];
  const storageConfig: StorageConfig = config?.storage || {};

  // Filter for Plaid accounts
  const plaidAccounts = accounts.filter(
    (acc) => acc.type === "plaid" && acc.enabled && acc.plaidAccessToken
  );

  if (plaidAccounts.length === 0) {
    return {
      success: false,
      accountId: params.accountId || "all",
      transactionsAdded: 0,
      transactionsUpdated: 0,
      cursor: "",
      errors: ["No enabled Plaid accounts found"],
    };
  }

  // Sync specific account or all Plaid accounts
  const accountsToSync = params.accountId
    ? plaidAccounts.filter((acc) => acc.id === params.accountId)
    : plaidAccounts;

  if (accountsToSync.length === 0) {
    return {
      success: false,
      accountId: params.accountId || "all",
      transactionsAdded: 0,
      transactionsUpdated: 0,
      cursor: "",
      errors: params.accountId
        ? [`Account ${params.accountId} not found or not enabled`]
        : ["No enabled Plaid accounts found"],
    };
  }

  let totalAdded = 0;
  let totalUpdated = 0;
  let lastCursor = "";
  const allErrors: string[] = [];

  for (const account of accountsToSync) {
    const result = await syncAccount(context, account, storageConfig);

    if (!result.success && result.errors) {
      allErrors.push(...result.errors);
    }

    totalAdded += result.transactionsAdded;
    totalUpdated += result.transactionsUpdated;
    if (result.cursor) {
      lastCursor = result.cursor;
    }
  }

  // Update global cursor
  await writeGlobalCursor(
    { lastSyncTime: new Date().toISOString() },
    storageConfig
  );

  return {
    success: allErrors.length === 0,
    accountId: params.accountId || "all",
    transactionsAdded: totalAdded,
    transactionsUpdated: totalUpdated,
    cursor: lastCursor,
    errors: allErrors.length > 0 ? allErrors : undefined,
  };
}
