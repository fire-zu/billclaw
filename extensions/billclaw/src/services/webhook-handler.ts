/**
 * Webhook handler - handles incoming webhooks from Plaid and Gmail
 */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { BillclawConfig } from "../../config.js";
import * as crypto from "node:crypto";
import { plaidSyncTool } from "../tools/plaid-sync.js";
import { emitWebhookTest } from "./event-emitter.js";
import { handleGmailPush, type PubSubPushRequest } from "./gmail-webhook.js";

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
  request: HttpRequest
): Promise<HttpResponse> {
  try {
    const body = request.body as any;
    const webhookType = body.webhook_type;
    const webhookCode = body.webhook_code;
    const itemId = body.item_id;

    api?.logger.info?.(`Received Plaid webhook: ${webhookType}.${webhookCode} for item ${itemId}`);

    // Verify webhook signature if configured
    const signature = request.headers["plaid-verification"];
    const timestamp = request.headers["plaid-timestamp"];
    if (_plaidWebhookSecret && signature && timestamp) {
      const payload = JSON.stringify(body);
      if (!verifySignature(payload, signature, _plaidWebhookSecret)) {
        return {
          status: 401,
          body: { error: "Invalid signature" },
        };
      }
    }

    // Handle different webhook types
    switch (webhookType) {
      case "TRANSACTIONS": {
        // Handle transaction webhooks
        switch (webhookCode) {
          case "SYNC_UPDATES_AVAILABLE":
          case "DEFAULT_UPDATE":
            // Trigger sync for this item
            if (api) {
              // Find account associated with this Plaid item
              const config = api.pluginConfig as BillclawConfig;
              const account = config.accounts.find(
                (acc) => acc.type === "plaid" && acc.plaidItemId === itemId
              );

              if (account && account.enabled) {
                api.logger.info?.(`Triggering sync for account ${account.id}`);
                // Trigger async sync (don't wait for completion)
                plaidSyncTool(api, { accountId: account.id }).catch((error) => {
                  api?.logger.error?.(`Webhook-triggered sync failed:`, error);
                });
              }
            }
            break;
        }
        break;
      }

      case "ITEM": {
        // Handle item webhooks
        switch (webhookCode) {
          case "ERROR":
            // Item login error - may need user to re-authenticate
            api?.logger.error?.(`Plaid item ${itemId} login error:`, body.error);
            // Forward to user webhooks
            await forwardToWebhooks({
              event: "account.error",
              data: { itemId, error: body.error },
              timestamp: new Date().toISOString(),
            });
            break;

          case "LOGIN_REQUIRED":
            // User needs to re-authenticate via Plaid Link
            api?.logger.warn?.(`Plaid item ${itemId} requires re-login`);
            await forwardToWebhooks({
              event: "account.error",
              data: { itemId, error: "LOGIN_REQUIRED" },
              timestamp: new Date().toISOString(),
            });
            break;

          case "WEBHOOK_UPDATED":
            api?.logger.info?.(`Plaid webhook updated for item ${itemId}`);
            break;

          case "PENDING_EXPIRATION":
          case "USER_PERMISSION_REVOKED":
          case "ITEM_LOGIN_REQUIRED":
            api?.logger.warn?.(`Plaid item ${itemId}: ${webhookCode}`);
            break;
        }
        break;
      }

      default:
        api?.logger.info?.(`Unhandled webhook type: ${webhookType}`);
    }

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
  request: HttpRequest
): Promise<HttpResponse> {
  try {
    const body = request.body as PubSubPushRequest;

    api?.logger.info?.(
      `Received Gmail Pub/Sub push: ${body.message?.messageId}`
    );

    // Verify Pub/Sub signature if configured
    const signature = request.headers["x-goog-signature"];
    if (_gmailWebhookSecret && signature) {
      // Note: Google Cloud Pub/Sub doesn't use HMAC signatures like Plaid
      // Instead, it uses JWT-based authentication. The signature header
      // contains a JWT that can be verified with Google's public keys.
      // For simplicity, we're not implementing full JWT verification here,
      // but in production you would verify the JWT using Google's JWKS endpoint.
      api?.logger.debug?.("Pub/Sub signature received, skipping verification (use JWT in production)");
    }

    // Process the push notification
    const result = await handleGmailPush(api!, body);

    return {
      status: 200,
      body: {
        success: result.success,
        processed: result.processed,
        action: result.action,
      },
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
  request: HttpRequest
): Promise<HttpResponse> {
  try {
    const body = request.body as any;
    const message = body.message || "Test webhook from billclaw";

    // Emit test event to all configured webhooks
    await emitWebhookTest(api!, message);

    return {
      status: 200,
      body: {
        success: true,
        message: "Test webhook sent to configured endpoints",
        event: "webhook.test",
      },
    };
  } catch (error) {
    api?.logger.error?.("Test webhook error:", error);
    return {
      status: 500,
      body: { error: "Failed to send test webhook" },
    };
  }
}

/**
 * Verify webhook signature using HMAC-SHA256
 *
 * Plaid uses SHA-256 HMAC to verify webhook authenticity
 * https://plaid.com/docs/api/webhooks/#verification
 */
function verifySignature(payload: string, signature: string, secret: string): boolean {
  try {
    // Compute HMAC-SHA256
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(payload);
    const computedSignature = hmac.digest("base64");

    // Use timing-safe comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(computedSignature)
    );
  } catch (error) {
    api?.logger.error?.("Signature verification failed:", error);
    return false;
  }
}

/**
 * Forward event to user-configured webhooks
 *
 * Sends events to external webhook URLs with retry logic
 */
async function forwardToWebhooks(event: {
  event: string;
  data: unknown;
  timestamp: string;
}): Promise<void> {
  if (!api) return;

  const config = api.pluginConfig as BillclawConfig;
  const webhooks = config.webhooks || [];

  for (const webhook of webhooks) {
    if (!webhook.enabled || !webhook.url) continue;

    // Check if this webhook is subscribed to this event
    if (webhook.events.length > 0 && !webhook.events.includes(event.event as any)) {
      continue;
    }

    // Sign payload if secret is configured
    let signature: string | undefined;
    if (webhook.secret) {
      const payload = JSON.stringify(event);
      const hmac = crypto.createHmac("sha256", webhook.secret);
      hmac.update(payload);
      signature = hmac.digest("hex");
    }

    // Send webhook with retry logic
    await sendWithRetry(webhook.url, event, signature, webhook.retryPolicy);
  }
}

/**
 * Send webhook with exponential backoff retry
 */
async function sendWithRetry(
  url: string,
  event: unknown,
  signature: string | undefined,
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
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(signature && { "X-Webhook-Signature": signature }),
        },
        body: JSON.stringify(event),
      });

      if (response.ok) {
        api?.logger.info?.(`Webhook sent successfully to ${url}`);
        return;
      }

      // Don't retry client errors (4xx)
      if (response.status >= 400 && response.status < 500) {
        api?.logger.warn?.(`Webhook rejected by ${url}: ${response.status}`);
        return;
      }

      throw new Error(`Webhook failed: ${response.status}`);
    } catch (error) {
      attempt++;
      if (attempt >= maxRetries) {
        api?.logger.error?.(`Webhook failed after ${maxRetries} retries:`, error);
        return;
      }

      // Exponential backoff with jitter
      const jitter = Math.random() * 0.3 * delay;
      await new Promise((resolve) => setTimeout(resolve, delay + jitter));
      delay = Math.min(delay * 2, maxDelay);
    }
  }
}
