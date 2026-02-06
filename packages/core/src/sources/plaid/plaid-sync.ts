/**
 * Plaid data source for BillClaw - Framework-agnostic Plaid integration
 */

import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
import type {
  TransactionsSyncRequest,
  TransactionsSyncResponse,
} from "plaid";
import type { StorageConfig, WebhookConfig } from "../../models/config.js";
import type { Transaction, SyncState } from "../../storage/transaction-storage.js";
import type { Logger } from "../../errors/errors.js";
import {
  appendTransactions,
  deduplicateTransactions,
  readSyncStates,
  writeGlobalCursor,
  writeSyncState,
} from "../../storage/transaction-storage.js";
import { emitEvent } from "../../services/event-emitter.js";

export interface PlaidConfig {
  clientId: string;
  secret: string;
  environment: "sandbox" | "development" | "production";
}

export interface PlaidAccount {
  id: string;
  plaidAccessToken: string;
}

export interface PlaidSyncResult {
  success: boolean;
  accountId: string;
  transactionsAdded: number;
  transactionsUpdated: number;
  cursor: string;
  errors?: string[];
  requiresReauth?: boolean;
}

/**
 * Create Plaid API client
 */
export function createPlaidClient(config: PlaidConfig): PlaidApi {
  const plaidEnvMap: Record<string, string> = {
    sandbox: PlaidEnvironments.sandbox,
    development: PlaidEnvironments.development,
    production: PlaidEnvironments.production,
  };

  const environment = plaidEnvMap[config.environment] || PlaidEnvironments.sandbox;

  const configuration = new Configuration({
    basePath: environment,
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": config.clientId,
        "PLAID-SECRET": config.secret,
      },
    },
  });

  return new PlaidApi(configuration);
}

/**
 * Convert Plaid transaction to internal format
 */
export function convertTransaction(
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
export async function syncPlaidAccount(
  account: PlaidAccount,
  plaidClient: PlaidApi,
  storageConfig: StorageConfig,
  logger: Logger,
  webhooks: WebhookConfig[] = []
): Promise<PlaidSyncResult> {
  const errors: string[] = [];
  let transactionsAdded = 0;
  let transactionsUpdated = 0;
  let cursor = "";
  let requiresReauth = false;

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

  // Emit sync.started event (fire-and-forget)
  emitEvent(logger, webhooks, "sync.started", { accountId: account.id, syncId })
    .catch((err) => logger.debug?.(`Event emission failed:`, err));

  try {
    // Get previous sync state for cursor
    const previousSyncs = await readSyncStates(account.id, storageConfig);
    const lastSync = previousSyncs.find((s) => s.status === "completed");
    const lastCursor = lastSync?.cursor || undefined;

    const request: TransactionsSyncRequest = {
      access_token: account.plaidAccessToken,
      cursor: lastCursor,
      count: 500,
    };

    const axiosResponse = await plaidClient.transactionsSync(request);
    const response: TransactionsSyncResponse = axiosResponse.data;

    cursor = response.next_cursor || "";
    const removed = response.removed || [];
    const added = response.added || [];

    logger.info?.(
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

    logger.info?.(
      `Sync completed for ${account.id}: ${transactionsAdded} added, ${transactionsUpdated} updated`
    );

    // Emit sync.completed event (fire-and-forget)
    const syncDuration = Date.now() - new Date(syncState.startedAt).getTime();
    emitEvent(logger, webhooks, "sync.completed", {
      accountId: account.id,
      syncId,
      transactionsAdded,
      transactionsUpdated,
      duration: syncDuration,
    }).catch((err) => logger.debug?.(`Event emission failed:`, err));
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    errors.push(errorMsg);
    syncState.status = "failed";
    syncState.error = errorMsg;
    logger.error?.(`Sync failed for ${account.id}:`, error);

    // Emit sync.failed event (fire-and-forget)
    emitEvent(logger, webhooks, "sync.failed", {
      accountId: account.id,
      syncId,
      error: errorMsg,
    }).catch((err) => logger.debug?.(`Event emission failed:`, err));

    // Check for Plaid-specific errors that require user action
    if (error && typeof error === "object") {
      const plaidError = error as any;
      const errorCode = plaidError.code || plaidError.error_code;

      // Item login errors - user needs to re-authenticate via Plaid Link
      if (
        errorCode === "ITEM_LOGIN_REQUIRED" ||
        errorCode === "INVALID_ACCESS_TOKEN" ||
        errorCode === "PRODUCTS_NOT_READY" ||
        (plaidError.response?.data?.error_code === "ITEM_LOGIN_REQUIRED")
      ) {
        logger.warn?.(
          `Account ${account.id} requires re-authentication via Plaid Link`
        );
        syncState.error = `ITEM_LOGIN_REQUIRED: Please re-connect this account via Plaid Link`;
        syncState.requiresReauth = true;
        requiresReauth = true;
      }
    }
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
    requiresReauth,
  };
}

/**
 * Sync multiple Plaid accounts
 */
export async function syncPlaidAccounts(
  accounts: PlaidAccount[],
  plaidConfig: PlaidConfig,
  storageConfig: StorageConfig,
  logger: Logger,
  webhooks: WebhookConfig[] = []
): Promise<PlaidSyncResult[]> {
  if (accounts.length === 0) {
    return [];
  }

  const plaidClient = createPlaidClient(plaidConfig);
  const results: PlaidSyncResult[] = [];

  for (const account of accounts) {
    const result = await syncPlaidAccount(account, plaidClient, storageConfig, logger, webhooks);
    results.push(result);
  }

  // Update global cursor
  await writeGlobalCursor(
    { lastSyncTime: new Date().toISOString() },
    storageConfig
  );

  return results;
}
