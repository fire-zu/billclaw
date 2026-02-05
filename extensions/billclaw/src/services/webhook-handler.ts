/**
 * Webhook handler - handles incoming webhooks from Plaid and Gmail
 */

import type { ServiceContext, HttpRequest, HttpResponse } from "@openclaw/plugin-sdk";

export interface WebhookPayload {
  event: string;
  data: any;
  timestamp: string;
  signature?: string;
}

/**
 * HTTP endpoint for handling Plaid and Gmail webhooks
 *
 * Verifies signatures and processes webhook events
 */
export async function webhookHandler(context: ServiceContext): Promise<void> {
  context.logger.info("billclaw webhook handler registered");

  // Register HTTP routes for webhook endpoints
  context.http.register({
    path: "/webhook/plaid",
    method: "POST",
    handler: handlePlaidWebhook,
  });

  context.http.register({
    path: "/webhook/gmail",
    method: "POST",
    handler: handleGmailWebhook,
  });

  context.http.register({
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
  request: HttpRequest,
  context: ServiceContext
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
    context.logger.error("Plaid webhook error:", error);
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
  request: HttpRequest,
  context: ServiceContext
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
    context.logger.error("Gmail webhook error:", error);
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
  request: HttpRequest,
  context: ServiceContext
): Promise<HttpResponse> {
  try {
    // TODO: Implement test webhook
    // Send a test event to configured webhooks
    // Event type: webhook.test

    return {
      status: 200,
      body: { test: "success" },
    };
  } catch (error) {
    return {
      status: 500,
      body: { error: "Test failed" },
    };
  }
}

/**
 * Verify webhook signature
 */
function verifySignature(payload: string, signature: string, secret: string): boolean {
  // TODO: Implement HMAC-SHA256 verification
  // 1. Compute HMAC-SHA256 of payload using secret
  // 2. Compare with provided signature (timing-safe)
  // 3. Check timestamp to prevent replay attacks
  return false;
}

/**
 * Forward event to user-configured webhooks
 */
async function forwardToWebhooks(event: any, context: ServiceContext): Promise<void> {
  // TODO: Implement webhook forwarding
  // 1. Load configured webhooks
  // 2. For each webhook with matching event subscription:
  //    - Sign payload with webhook secret
  //    - Send POST request
  //    - Handle retries with exponential backoff
  //    - Log failures
}
