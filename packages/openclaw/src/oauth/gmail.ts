/**
 * Gmail OAuth handler - OpenClaw adapter
 *
 * This is an adapter layer that calls the framework-agnostic OAuth implementation
 * from @firela/billclaw-core and adds OpenClaw-specific functionality (config management).
 *
 * @packageDocumentation
 */

import type { OpenClawPluginApi } from "../types/openclaw-plugin.js"
import {
  gmailOAuthHandler as coreGmailOAuthHandler,
  refreshGmailToken as coreRefreshGmailToken,
  type GmailOAuthConfig,
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
 * Get Gmail configuration from OpenClaw config
 */
function getGmailConfig(api: OpenClawPluginApi): GmailOAuthConfig {
  const pluginConfig = api.pluginConfig as any
  const gmailConfig = pluginConfig?.gmail || {}

  const clientId = gmailConfig.clientId || process.env.GMAIL_CLIENT_ID
  const clientSecret =
    gmailConfig.clientSecret || process.env.GMAIL_CLIENT_SECRET

  if (!clientId) {
    throw new Error(
      "Gmail OAuth not configured. Set GMAIL_CLIENT_ID environment variable or configure it in billclaw settings.",
    )
  }

  return {
    clientId,
    clientSecret: clientSecret || "",
  }
}

/**
 * Save Gmail OAuth tokens to account configuration
 *
 * NOTE: This requires the OpenClaw runtime to support config updates.
 * The actual persistence depends on the OpenClawConfigProvider implementation.
 */
async function saveGmailTokensToAccount(
  api: OpenClawPluginApi,
  accountId: string,
  accessToken: string,
  refreshToken: string | undefined,
  expiresIn: number | undefined,
): Promise<void> {
  const logger = getLogger(api)

  // Calculate token expiry timestamp
  const expiresAt = expiresIn
    ? new Date(Date.now() + expiresIn * 1000).toISOString()
    : undefined

  // Get config from OpenClaw
  const config = api.pluginConfig as any

  // Find and update the account
  const accountIndex = config.accounts?.findIndex(
    (a: any) => a.id === accountId && a.type === "gmail",
  )

  if (accountIndex === -1 || accountIndex === undefined) {
    logger.warn(
      `Gmail account ${accountId} not found in config. Tokens not saved.`,
    )
    return
  }

  // Update account with tokens
  config.accounts[accountIndex] = {
    ...config.accounts[accountIndex],
    gmailAccessToken: accessToken,
    gmailRefreshToken: refreshToken,
    gmailTokenExpiry: expiresAt,
    enabled: true, // Auto-enable account after successful OAuth
  }

  // Note: The actual persistence to disk depends on OpenClaw's config management
  // The updated config is in memory but OpenClaw needs to handle persistence
  logger.info(
    `Gmail tokens updated in memory for account ${accountId}. Persistence depends on OpenClaw config management.`,
  )
}

/**
 * Handle Gmail OAuth flow
 *
 * This is an OpenClaw adapter that calls the framework-agnostic OAuth handler
 * from @firela/billclaw-core and adds OpenClaw-specific functionality.
 *
 * Flow:
 * 1. Initialize OAuth (no params) - Returns { url, state }
 * 2. Handle callback (code + state + accountId) - Returns { accessToken, refreshToken }
 *    - Tokens are automatically saved to account config if accountId is provided
 *
 * @param api - OpenClaw plugin API
 * @param context - OAuth context with optional code, state, redirectUri, and accountId
 * @returns OAuthResult with URL and/or token
 */
export async function gmailOAuthHandler(
  api: OpenClawPluginApi,
  context?: {
    code?: string
    state?: string
    redirectUri?: string
    accountId?: string
  },
): Promise<{
  url: string
  state?: string
  accessToken?: string
  refreshToken?: string
  expiresIn?: number
}> {
  try {
    const { code, state, redirectUri, accountId } = context || {}
    const config = getGmailConfig(api)
    const logger = getLogger(api)

    // Call the framework-agnostic OAuth handler from core
    const result = await coreGmailOAuthHandler(config, { code, state, redirectUri }, logger)

    // Save tokens to account config if accountId is provided and we have accessToken
    if (accountId && result.accessToken && code) {
      await saveGmailTokensToAccount(
        api,
        accountId,
        result.accessToken,
        result.refreshToken,
        result.expiresIn,
      )
      logger.info(
        `Gmail tokens saved for account ${accountId} (expires in ${result.expiresIn}s)`,
      )
    }

    return result
  } catch (error) {
    getLogger(api).error("Gmail OAuth error:", error)
    throw error
  }
}

/**
 * Refresh Gmail access token using refresh token
 *
 * @param api - OpenClaw plugin API
 * @param accountId - Account ID to refresh token for
 * @returns New access token and expiry info, or null if refresh failed
 */
export async function refreshGmailToken(
  api: OpenClawPluginApi,
  accountId: string,
): Promise<{ accessToken: string; expiresIn: number } | null> {
  const config = api.pluginConfig as any
  const logger = getLogger(api)

  // Find the account
  const account = config.accounts?.find(
    (a: any) => a.id === accountId && a.type === "gmail",
  )

  if (!account) {
    logger.error(`Gmail account ${accountId} not found`)
    return null
  }

  const gmailConfig = getGmailConfig(api)

  if (!account.gmailRefreshToken) {
    logger.error(
      `No refresh token available for Gmail account ${accountId}. User must re-authenticate.`,
    )
    return null
  }

  // Call the framework-agnostic refresh handler from core
  const result = await coreRefreshGmailToken(
    gmailConfig,
    account.gmailRefreshToken,
    logger,
  )

  if (!result) {
    return null
  }

  // Save new tokens to account config
  await saveGmailTokensToAccount(
    api,
    accountId,
    result.accessToken,
    account.gmailRefreshToken,
    result.expiresIn,
  )

  return result
}
