/**
 * Webhook handlers for BillClaw OpenClaw plugin
 *
 * This module provides HTTP route handlers for receiving webhooks from
 * external services (Plaid, GoCardless, etc.) and forwarding them to
 * configured external webhook endpoints.
 */

import type { OpenClawPluginApi } from "../types/openclaw-plugin.js"
import { emitEvent, verifySignature } from "@fire-la/billclaw-core"
import type { WebhookEventType } from "@fire-la/billclaw-core"

/**
 * Dependencies for webhook handlers
 */
interface WebhookHandlerDependencies {
  api: OpenClawPluginApi
  plaidWebhookSecret?: string
}

// Global API reference for webhook handlers
let api: OpenClawPluginApi | null = null
let configWebhooks: any[] = []
let plaidWebhookSecret: string | undefined

/**
 * Convert OpenClaw logger to BillClaw Logger interface
 */
function toLogger(
  logger: OpenClawPluginApi["logger"] | undefined,
): {
  info: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  debug: (...args: unknown[]) => void
} {
  // Ensure all methods are defined and callable
  const log = logger?.info || (() => {})
  const logError = logger?.error || (() => {})
  const logWarn = logger?.warn || (() => console.warn)
  const logDebug = logger?.debug || (() => {})

  return {
    info: log,
    error: logError,
    warn: logWarn,
    debug: logDebug,
  }
}

/**
 * Register webhook handlers with OpenClaw HTTP routes
 *
 * This function registers HTTP routes for:
 * - /webhook/plaid - Plaid webhook handler
 * - /webhook/gocardless - GoCardless webhook handler
 * - /webhook/test - Test webhook endpoint
 */
export function registerWebhookHandlers(
  dependencies: WebhookHandlerDependencies,
): void {
  api = dependencies.api
  plaidWebhookSecret = dependencies.plaidWebhookSecret

  // Get webhooks from config
  const pluginConfig = api.pluginConfig as any
  configWebhooks = pluginConfig?.webhooks || []

  api.logger.info?.("billclaw webhook handler registered")

  // Register HTTP routes
  api.http?.register({
    path: "/webhook/plaid",
    method: "POST",
    description: "Plaid webhook handler",
    handler: handlePlaidWebhook,
  })

  api.http?.register({
    path: "/webhook/gocardless",
    method: "POST",
    description: "GoCardless webhook handler",
    handler: handleGoCardlessWebhook,
  })

  api.http?.register({
    path: "/webhook/test",
    method: "POST",
    description: "Test webhook endpoint",
    handler: handleTestWebhook,
  })
}

/**
 * Handle Plaid webhook
 *
 * Processes webhooks from Plaid:
 * - TRANSACTIONS/SYNC_UPDATES_AVAILABLE: Trigger sync for the item
 * - ITEM/ERROR: Emit account.error event
 * - ITEM/LOGIN_REQUIRED: Notify user to re-authenticate
 */
async function handlePlaidWebhook(request: {
  body: unknown
  headers: Record<string, string>
  query: Record<string, string>
}): Promise<{ status: number; body: { received: boolean; error?: string } }> {
  try {
    const body = request.body as any
    const webhookType = body.webhook_type
    const webhookCode = body.webhook_code
    const itemId = body.item_id

    api?.logger.info?.(
      `Received Plaid webhook: ${webhookType}.${webhookCode} for item ${itemId}`,
    )

    // Verify signature if configured
    const signature = request.headers["plaid-verification"]
    const timestamp = request.headers["plaid-timestamp"]
    if (plaidWebhookSecret && signature && timestamp) {
      const payload = JSON.stringify(body)
      if (!verifySignature(payload, signature, plaidWebhookSecret)) {
        return {
          status: 401,
          body: { received: false, error: "Invalid signature" },
        }
      }
    }

    // Handle webhook events
    switch (webhookType) {
      case "TRANSACTIONS":
        if (webhookCode === "SYNC_UPDATES_AVAILABLE") {
          // Find the account associated with this item
          const pluginConfig = api?.pluginConfig as any
          const account = pluginConfig?.accounts?.find(
            (acc: any) =>
              acc.type === "plaid" && acc.plaidItemId === itemId && acc.enabled,
          )

          if (account && api) {
            // Trigger async sync (don't wait for completion)
            const { plaidSyncTool } = await import("../tools/index.js")
            plaidSyncTool
              .execute(api, { accountId: account.id })
              .catch((error) => {
                api?.logger.error?.(`Webhook-triggered sync failed:`, error)
              })
          }
        }
        break

      case "ITEM":
        if (webhookCode === "ERROR" || webhookCode === "LOGIN_REQUIRED") {
          const error = body.error ?? {
            error_code: webhookCode,
            error_message: "Item login required",
          }
          // Emit account error event
          await emitEvent(
            toLogger(api!.logger),
            configWebhooks,
            "account.error" as WebhookEventType,
            {
              accountId: itemId,
              accountType: "plaid",
              error: JSON.stringify(error),
            },
          ).catch((err) => api?.logger.debug?.(`Event emission failed:`, err))
        }
        break
    }

    return { status: 200, body: { received: true } }
  } catch (error) {
    api?.logger.error?.(`Error handling Plaid webhook:`, error)
    return {
      status: 500,
      body: { received: false, error: "Internal server error" },
    }
  }
}

/**
 * Handle GoCardless webhook
 *
 * Processes webhooks from GoCardless (placeholder implementation)
 */
async function handleGoCardlessWebhook(_request: {
  body: unknown
  headers: Record<string, string>
  query: Record<string, string>
}): Promise<{ status: number; body: { received: boolean } }> {
  try {
    api?.logger.info?.("Received GoCardless webhook")

    // TODO: Implement GoCardless webhook handling
    // - Verify signature
    // - Process mandate events
    // - Trigger sync if needed

    return { status: 200, body: { received: true } }
  } catch (error) {
    api?.logger.error?.(`Error handling GoCardless webhook:`, error)
    return { status: 500, body: { received: false } }
  }
}

/**
 * Handle test webhook
 *
 * Sends a test event to all configured webhooks to verify connectivity
 */
async function handleTestWebhook(_request: {
  body: unknown
  headers: Record<string, string>
  query: Record<string, string>
}): Promise<{ status: number; body: { sent: boolean; error?: string } }> {
  try {
    api?.logger.info?.("Received test webhook request")

    // Emit test event to all configured webhooks
    await emitEvent(
      toLogger(api!.logger),
      configWebhooks,
      "webhook.test" as WebhookEventType,
      {
        message: "Test webhook from BillClaw",
        triggeredBy: "user",
      },
    )

    return { status: 200, body: { sent: true } }
  } catch (error) {
    api?.logger.error?.(`Error handling test webhook:`, error)
    return {
      status: 500,
      body: { sent: false, error: "Internal server error" },
    }
  }
}
