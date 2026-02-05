/**
 * Webhook handler - handles incoming webhooks from Plaid and Gmail
 */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { BillclawConfig } from "../../config.js";

export interface WebhookPayload {
  event: string;
  data: unknown;
  timestamp: string;
  signature?: string;
}

export interface HttpRequest {
  body: unknown;
  headers: Record<string, string>;
  query: Record<string, string>;
}

export interface HttpResponse {
  status: number;
  body: unknown;
}

let api: OpenClawPluginApi | null = null;
let _plaidWebhookSecret: string | undefined;
let _gmailWebhookSecret: string | undefined;

/**
 * HTTP endpoint for handling Plaid and Gmail webhooks
 *
 * Verifies signatures and processes webhook events
 */
export async function webhookHandler(context: OpenClawPluginApi): Promise<void> {
  api = context;

  const cfg = context.pluginConfig as BillclawConfig;

  // Extract webhook secrets from config
  if (cfg.plaid.secret) {
    _plaidWebhookSecret = cfg.plaid.secret;
  }
  // Gmail webhook secret would be configured separately

  context.logger.info?.("billclaw webhook handler registered");

  // Register HTTP routes for webhook endpoints
  context.http?.register({
    path: "/webhook/plaid",
    method: "POST",
    handler: handlePlaidWebhook,
  });

  context.http?.register({
    path: "/webhook/gmail",
    method: "POST",
    handler: handleGmailWebhook,
  });

  context.http?.register({
    path: "/webhook/test",
    method: "POST",
    handler: handleTestWebhook,
  });
}

/**
 * Handle Plaid webhooks
 *
 * Plaid webhooks: https://plaid.com/docs/api/webhooks/
 * Events: TRANSACTION, ITEM, BANK_TRANSFER, etc.
 */
async function handlePlaidWebhook(
  _request: HttpRequest
): Promise<HttpResponse> {
  try {
    // TODO: Implement Plaid webhook handling
    // 1. Verify webhook signature (HMAC-SHA256)
    // 2. Parse webhook type
    // 3. Handle specific event types:
    //    - TRANSACTIONS: Trigger sync for affected item
    //    - ITEM: Handle login errors, removed items
    //    - BANK_TRANSFER: Handle transfer status updates
    // 4. Forward to user-configured webhooks if enabled

    return {
      status: 200,
      body: { received: true },
    };
  } catch (error) {
    api?.logger.error?.("Plaid webhook error:", error);
    return {
      status: 500,
      body: { error: "Webhook processing failed" },
    };
  }
}

/**
 * Handle Gmail push notifications
 *
 * Gmail push notifications via Google Cloud Pub/Sub
 */
async function handleGmailWebhook(
  _request: HttpRequest
): Promise<HttpResponse> {
  try {
    // TODO: Implement Gmail webhook handling
    // 1. Verify Pub/Sub message authenticity
    // 2. Extract email ID from message
    // 3. Fetch email content
    // 4. Parse for bill/transaction data
    // 5. Store in local files
    // 6. Forward to user-configured webhooks if enabled

    return {
      status: 200,
      body: { received: true },
    };
  } catch (error) {
    api?.logger.error?.("Gmail webhook error:", error);
    return {
      status: 500,
      body: { error: "Webhook processing failed" },
    };
  }
}

/**
 * Handle test webhooks
 *
 * Allows users to test their webhook configuration
 */
async function handleTestWebhook(
  _request: HttpRequest
): Promise<HttpResponse> {
  // TODO: Implement test webhook
  // Send a test event to configured webhooks
  // Event type: webhook.test

  return {
    status: 200,
    body: { test: "success" },
  };
}

/**
 * Verify webhook signature
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function verifySignature(_payload: string, _signature: string, _secret: string): boolean {
  // TODO: Implement HMAC-SHA256 verification
  // 1. Compute HMAC-SHA256 of payload using secret
  // 2. Compare with provided signature (timing-safe)
  // 3. Check timestamp to prevent replay attacks
  return false;
}

/**
 * Forward event to user-configured webhooks
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function forwardToWebhooks(_event: unknown): Promise<void> {
  // TODO: Implement webhook forwarding
  // 1. Load configured webhooks
  // 2. For each webhook with matching event subscription:
  //    - Sign payload with webhook secret
  //    - Send POST request
  //    - Handle retries with exponential backoff
  //    - Log failures
}
