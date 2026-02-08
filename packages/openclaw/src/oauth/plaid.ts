/**
 * Plaid OAuth handler - OpenClaw adapter
 *
 * This is an adapter layer that calls the framework-agnostic OAuth implementation
 * from @firela/billclaw-core and adds OpenClaw-specific functionality (config management).
 *
 * @packageDocumentation
 */

import type { OpenClawPluginApi } from "../types/openclaw-plugin.js"
import {
  plaidOAuthHandler as corePlaidOAuthHandler,
  type PlaidConfig,
} from "@firela/billclaw-core"
import type { Logger } from "@firela/billclaw-core"

/**
 * Get a logger from OpenClaw API, or provide a no-op logger
 */
function getLogger(api: OpenClawPluginApi): Logger {
  return {
    info: api.logger?.info || (() => {}),
    error: api.logger?.error || (() => {}),
    warn: api.logger?.warn || (() => {}),
    debug: api.logger?.debug || (() => {}),
  }
}

/**
 * Get Plaid configuration from OpenClaw config
 *
 * Checks both pluginConfig and environment variables for credentials.
 */
function getPlaidConfig(api: OpenClawPluginApi): PlaidConfig {
  const pluginConfig = api.pluginConfig as any
  const plaidConfig = pluginConfig?.plaid || {}

  const clientId = plaidConfig.clientId || process.env.PLAID_CLIENT_ID
  const secret = plaidConfig.secret || process.env.PLAID_SECRET
  const environment = plaidConfig.environment || "sandbox"

  if (!clientId || !secret) {
    throw new Error(
      "Plaid credentials not configured. Set PLAID_CLIENT_ID and PLAID_SECRET environment variables, or configure them in billclaw settings.",
    )
  }

  return {
    clientId,
    secret,
    environment: environment as "sandbox" | "development" | "production",
  }
}

/**
 * Save Plaid OAuth tokens to account configuration
 *
 * NOTE: This requires the OpenClaw runtime to support config updates.
 * The actual persistence depends on the OpenClawConfigProvider implementation.
 */
async function savePlaidTokensToAccount(
  api: OpenClawPluginApi,
  accountId: string,
  accessToken: string,
  itemId: string,
): Promise<void> {
  const logger = getLogger(api)

  // Get config from OpenClaw
  const config = api.pluginConfig as any

  // Find and update the account
  const accountIndex = config.accounts?.findIndex(
    (a: any) => a.id === accountId && a.type === "plaid",
  )

  if (accountIndex === -1 || accountIndex === undefined) {
    logger.warn(
      `Plaid account ${accountId} not found in config. Tokens not saved.`,
    )
    return
  }

  // Update account with tokens
  config.accounts[accountIndex] = {
    ...config.accounts[accountIndex],
    plaidAccessToken: accessToken,
    plaidItemId: itemId,
    enabled: true, // Auto-enable account after successful OAuth
  }

  // Note: The actual persistence to disk depends on OpenClaw's config management
  // The updated config is in memory but OpenClaw needs to handle persistence
  logger.info(
    `Plaid tokens updated in memory for account ${accountId}. Persistence depends on OpenClaw config management.`,
  )
}

/**
 * Handle Plaid Link OAuth flow
 *
 * This is an OpenClaw adapter that calls the framework-agnostic OAuth handler
 * from @firela/billclaw-core and adds OpenClaw-specific functionality.
 *
 * Flow:
 * 1. Create Link token (no params) - Returns { url, token: linkToken }
 * 2. Handle Link success callback - Receives publicToken
 * 3. Exchange public_token for access_token - Returns { url: "", token: accessToken, itemId }
 *    - If accountId is provided, tokens are automatically saved to account config
 *
 * @param api - OpenClaw plugin API
 * @param publicToken - Optional public token from Plaid Link callback
 * @param accountId - Optional account ID to save tokens to
 * @returns OAuthResult with URL and token
 */
export async function plaidOAuthHandler(
  api: OpenClawPluginApi,
  publicToken?: string,
  accountId?: string,
): Promise<{
  url: string
  token?: string
  itemId?: string
  accessToken?: string
}> {
  try {
    const config = getPlaidConfig(api)
    const logger = getLogger(api)

    // Call the framework-agnostic OAuth handler from core
    const result = await corePlaidOAuthHandler(
      config,
      publicToken,
      accountId,
      logger,
    )

    // Save tokens to account config if accountId is provided and we have accessToken
    if (accountId && result.accessToken && publicToken) {
      await savePlaidTokensToAccount(
        api,
        accountId,
        result.accessToken,
        result.itemId || "",
      )
      logger.info(`Plaid tokens saved for account ${accountId}`)
    }

    return result
  } catch (error) {
    getLogger(api).error("Plaid OAuth error:", error)
    throw error
  }
}
