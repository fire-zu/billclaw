/**
 * Custom API export functionality
 *
 * This module provides functionality to push billclaw transactions
 * to external APIs via HTTP webhooks.
 *
 * This allows integration with:
 * - Custom backends
 * - Accounting systems
 * - Data pipelines
 * - Third-party services
 */

import type { Transaction } from "../storage/transaction-storage.js";
import { readTransactions } from "../storage/transaction-storage.js";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { StorageConfig } from "../../config.js";
import * as crypto from "node:crypto";

/**
 * Custom API configuration
 */
export interface CustomApiConfig {
  url: string;
  method?: "POST" | "PUT" | "PATCH";
  headers?: Record<string, string>;
  auth?: {
    type: "bearer" | "basic" | "custom";
    token?: string; // For bearer
    username?: string; // For basic
    password?: string; // For basic
  };
  secret?: string; // For HMAC signature
  format?: "json" | "csv" | "xml";
  batchSize?: number; // Number of transactions per request
  retryPolicy?: {
    maxRetries: number;
    initialDelay: number;
    maxDelay: number;
  };
}

/**
 * Export result
 */
export interface ExportResult {
  success: boolean;
  sent: number;
  failed: number;
  errors?: string[];
}

/**
 * Transaction payload for custom API
 */
export interface TransactionPayload {
  transactions: Array<{
    id: string;
    accountId: string;
    date: string;
    amount: number;
    currency: string;
    merchantName?: string;
    category?: string[];
    paymentChannel?: string;
    pending?: boolean;
    source?: string;
  }>;
  metadata: {
    exportId: string;
    timestamp: string;
    accountId: string;
    year: number;
    month: number;
    batch?: {
      current: number;
      total: number;
    };
  };
}

/**
 * Push transactions to a custom API endpoint
 */
export async function pushToCustomApi(
  api: OpenClawPluginApi,
  config: CustomApiConfig,
  accountId: string,
  year: number,
  month: number
): Promise<ExportResult> {
  const pluginConfig = api.pluginConfig as any;
  const storagePath = pluginConfig.storage?.path || "~/.openclaw/billclaw";

  // Read transactions
  const storageConfig: StorageConfig = {
    path: storagePath,
    format: "json",
    encryption: { enabled: false },
  };
  const transactions = await readTransactions(accountId, year, month, storageConfig);

  if (transactions.length === 0) {
    return {
      success: true,
      sent: 0,
      failed: 0,
    };
  }

  // Generate export metadata
  const exportId = generateExportId();

  // Build payload
  const payload: TransactionPayload = {
    transactions: transactions.map((t) => ({
      id: t.transactionId,
      accountId: t.accountId,
      date: t.date,
      amount: t.amount,
      currency: t.currency,
      merchantName: t.merchantName,
      category: t.category,
      paymentChannel: t.paymentChannel,
      pending: t.pending,
      source: t.paymentChannel === "email" ? "gmail" : "plaid",
    })),
    metadata: {
      exportId,
      timestamp: new Date().toISOString(),
      accountId,
      year,
      month,
    },
  };

  // Sign payload if secret is configured
  let signature: string | undefined;
  if (config.secret) {
    signature = generateSignature(payload, config.secret);
  }

  // Build request headers
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "billclaw/1.0",
    "X-Billclaw-Export-Id": exportId,
    ...config.headers,
  };

  // Add signature header if configured
  if (signature) {
    headers["X-Billclaw-Signature"] = signature;
  }

  // Add authentication
  if (config.auth) {
    switch (config.auth.type) {
      case "bearer":
        headers["Authorization"] = `Bearer ${config.auth.token}`;
        break;
      case "basic":
        const credentials = btoa(
          `${config.auth.username}:${config.auth.password}`
        );
        headers["Authorization"] = `Basic ${credentials}`;
        break;
      case "custom":
        // Custom auth headers should be in config.headers
        break;
    }
  }

  // Send request with retry logic
  const retryPolicy = config.retryPolicy || {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 30000,
  };

  try {
    await sendWithRetry(
      config.url,
      config.method || "POST",
      headers,
      payload,
      retryPolicy
    );

    api.logger.info?.(
      `Successfully pushed ${transactions.length} transactions to ${config.url}`
    );

    return {
      success: true,
      sent: transactions.length,
      failed: 0,
    };
  } catch (error) {
    const errorMsg =
      error instanceof Error ? error.message : "Unknown error";

    api.logger.error?.(
      `Failed to push transactions to ${config.url}: ${errorMsg}`
    );

    return {
      success: false,
      sent: 0,
      failed: transactions.length,
      errors: [errorMsg],
    };
  }
}

/**
 * Push transactions in batches
 *
 * Useful for APIs with rate limits or payload size restrictions
 */
export async function pushToCustomApiBatched(
  api: OpenClawPluginApi,
  config: CustomApiConfig & { batchSize: number },
  accountId: string,
  year: number,
  month: number
): Promise<ExportResult> {
  const pluginConfig = api.pluginConfig as any;
  const storagePath = pluginConfig.storage?.path || "~/.openclaw/billclaw";

  // Read transactions
  const storageConfig: StorageConfig = {
    path: storagePath,
    format: "json",
    encryption: { enabled: false },
  };
  const transactions = await readTransactions(accountId, year, month, storageConfig);

  if (transactions.length === 0) {
    return {
      success: true,
      sent: 0,
      failed: 0,
    };
  }

  const batchSize = config.batchSize || 100;
  const batches = Math.ceil(transactions.length / batchSize);

  let totalSent = 0;
  let totalFailed = 0;
  const errors: string[] = [];

  for (let i = 0; i < batches; i++) {
    const batch = transactions.slice(i * batchSize, (i + 1) * batchSize);
    const exportId = generateExportId();

    const payload: TransactionPayload = {
      transactions: batch.map((t) => ({
        id: t.transactionId,
        accountId: t.accountId,
        date: t.date,
        amount: t.amount,
        currency: t.currency,
        merchantName: t.merchantName,
        category: t.category,
        paymentChannel: t.paymentChannel,
        pending: t.pending,
        source: t.paymentChannel === "email" ? "gmail" : "plaid",
      })),
      metadata: {
        exportId,
        timestamp: new Date().toISOString(),
        accountId,
        year,
        month,
        batch: {
          current: i + 1,
          total: batches,
        },
      },
    };

    // Sign payload if secret is configured
    let signature: string | undefined;
    if (config.secret) {
      signature = generateSignature(payload, config.secret);
    }

    // Build request headers
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "billclaw/1.0",
      "X-Billclaw-Export-Id": exportId,
      "X-Billclaw-Batch": `${i + 1}/${batches}`,
      ...config.headers,
    };

    if (signature) {
      headers["X-Billclaw-Signature"] = signature;
    }

    // Add authentication
    if (config.auth) {
      switch (config.auth.type) {
        case "bearer":
          headers["Authorization"] = `Bearer ${config.auth.token}`;
          break;
        case "basic":
          const credentials = btoa(
            `${config.auth.username}:${config.auth.password}`
          );
          headers["Authorization"] = `Basic ${credentials}`;
          break;
      }
    }

    try {
      const retryPolicy = config.retryPolicy || {
        maxRetries: 3,
        initialDelay: 1000,
        maxDelay: 30000,
      };

      await sendWithRetry(
        config.url,
        config.method || "POST",
        headers,
        payload,
        retryPolicy
      );

      totalSent += batch.length;
      api.logger.info?.(
        `Batch ${i + 1}/${batches}: Sent ${batch.length} transactions`
      );
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Unknown error";
      totalFailed += batch.length;
      errors.push(`Batch ${i + 1}: ${errorMsg}`);
      api.logger.error?.(`Batch ${i + 1} failed: ${errorMsg}`);
    }
  }

  return {
    success: totalFailed === 0,
    sent: totalSent,
    failed: totalFailed,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Send HTTP request with retry logic
 */
async function sendWithRetry(
  url: string,
  method: string,
  headers: Record<string, string>,
  payload: unknown,
  retryPolicy: { maxRetries: number; initialDelay: number; maxDelay: number }
): Promise<void> {
  const maxRetries = retryPolicy.maxRetries || 3;
  const initialDelay = retryPolicy.initialDelay || 1000;
  const maxDelay = retryPolicy.maxDelay || 30000;

  let attempt = 0;
  let delay = initialDelay;

  while (attempt < maxRetries) {
    try {
      const response = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        return;
      }

      // Don't retry client errors (4xx)
      if (response.status >= 400 && response.status < 500) {
        throw new Error(`API rejected request: ${response.status}`);
      }

      throw new Error(`API request failed: ${response.status}`);
    } catch (error) {
      attempt++;
      if (attempt >= maxRetries) {
        throw error;
      }

      // Exponential backoff with jitter
      const jitter = Math.random() * 0.3 * delay;
      await new Promise((resolve) => setTimeout(resolve, delay + jitter));
      delay = Math.min(delay * 2, maxDelay);
    }
  }
}

/**
 * Generate HMAC-SHA256 signature for payload
 */
function generateSignature(payload: unknown, secret: string): string {
  const payloadString = JSON.stringify(payload);
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(payloadString);
  return `sha256=${hmac.digest("hex")}`;
}

/**
 * Generate unique export ID
 */
function generateExportId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return `export_${timestamp}_${random}`;
}

/**
 * Agent tool to push transactions to a custom API
 *
 * Usage in agent:
 * ```typescript
 * const result = await pushToCustomApiTool(api, {
 *   url: "https://your-api.com/transactions",
 *   accountId: "chase-checking",
 *   year: 2025,
 *   month: 2,
 *   auth: {
 *     type: "bearer",
 *     token: "your-token",
 *   },
 * });
 * ```
 */
export async function pushToCustomApiTool(
  api: OpenClawPluginApi,
  args: {
    url: string;
    accountId: string;
    year: number;
    month?: number;
    method?: "POST" | "PUT" | "PATCH";
    auth?: {
      type: "bearer" | "basic" | "custom";
      token?: string;
      username?: string;
      password?: string;
    };
    secret?: string;
    batchSize?: number;
  }
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const config: CustomApiConfig = {
    url: args.url,
    method: args.method || "POST",
    auth: args.auth,
    secret: args.secret,
    batchSize: args.batchSize,
  };

  const result = await pushToCustomApi(
    api,
    config,
    args.accountId,
    args.year,
    args.month || new Date().getMonth() + 1
  );

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}
