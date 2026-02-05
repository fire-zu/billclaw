/**
 * Background sync service - runs scheduled transaction synchronization
 */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { AccountConfig, type BillclawConfig } from "../../config.js";
import type { PlaidSyncResult } from "../tools/plaid-sync.js";
import { plaidSyncTool } from "../tools/plaid-sync.js";

export interface SyncServiceState {
  isRunning: boolean;
  lastSync: string | null;
  nextSync: string | null;
  accountsSynced: number;
}

/**
 * Calculate next sync time based on sync frequency
 */
export function calculateNextSync(frequency: string, lastSync?: Date): Date {
  const now = new Date();
  const base = lastSync || now;

  switch (frequency) {
    case "realtime":
      // Webhook-based, no scheduled sync
      return new Date(0);

    case "hourly":
      return new Date(base.getTime() + 60 * 60 * 1000);

    case "daily":
      // Next day at same time
      const nextDay = new Date(base);
      nextDay.setDate(nextDay.getDate() + 1);
      return nextDay;

    case "weekly":
      // Next week on same day
      const nextWeek = new Date(base);
      nextWeek.setDate(nextWeek.getDate() + 7);
      return nextWeek;

    case "manual":
      // No scheduled sync
      return new Date(0);

    default:
      return new Date(base.getTime() + 24 * 60 * 60 * 1000);
  }
}

/**
 * Check if an account is due for sync
 */
export function isDueForSync(account: AccountConfig): boolean {
  if (!account.enabled || !account.lastSync) {
    return true;
  }

  const lastSync = new Date(account.lastSync);
  const nextSync = calculateNextSync(account.syncFrequency, lastSync);

  // Manual accounts never sync automatically
  if (account.syncFrequency === "manual") {
    return false;
  }

  // Realtime accounts sync via webhook, not scheduled
  if (account.syncFrequency === "realtime") {
    return false;
  }

  return new Date() >= nextSync;
}

/**
 * Trigger sync for a single account
 */
async function syncAccount(
  accountId: string,
  context: OpenClawPluginApi
): Promise<void> {
  try {
    const result: PlaidSyncResult = await plaidSyncTool(context, {
      accountId,
    });

    if (result.success) {
      context.logger.info?.(
        `Sync completed for ${accountId}: ${result.transactionsAdded} added, ${result.transactionsUpdated} updated`
      );
    } else {
      context.logger.error?.(
        `Sync failed for ${accountId}:`,
        result.errors || []
      );
    }
  } catch (error) {
    context.logger.error?.(`Error syncing ${accountId}:`, error);
  }
}

/**
 * Background service for automatic transaction synchronization
 *
 * This service runs periodically (based on account sync frequency settings)
 * and syncs transactions from all enabled accounts.
 */
export async function syncService(context: OpenClawPluginApi): Promise<void> {
  context.logger.info?.("billclaw sync service started");

  const config = context.pluginConfig as BillclawConfig;
  const accounts: AccountConfig[] = config?.accounts || [];

  // Filter for Plaid accounts
  const plaidAccounts = accounts.filter(
    (acc) => acc.type === "plaid" && acc.enabled
  );

  if (plaidAccounts.length === 0) {
    context.logger.info?.("No enabled Plaid accounts to sync");
    return;
  }

  context.logger.info?.(`Found ${plaidAccounts.length} Plaid accounts to check`);

  let syncedCount = 0;

  for (const account of plaidAccounts) {
    if (isDueForSync(account)) {
      context.logger.info?.(`Syncing account: ${account.name} (${account.id})`);
      await syncAccount(account.id, context);
      syncedCount++;
    } else {
      context.logger.info?.(
        `Skipping ${account.name} (${account.id}): not due for sync`
      );
    }
  }

  context.logger.info?.(`Sync service completed: ${syncedCount} accounts synced`);
}
