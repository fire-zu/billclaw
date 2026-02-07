/**
 * Plaid OAuth handler - implements Plaid Link flow
 *
 * This module handles the Plaid Link OAuth flow for connecting bank accounts.
 * It supports two modes:
 * 1. Link token creation (for initializing Plaid Link frontend)
 * 2. Public token exchange (for completing the connection)
 */

import type { OpenClawPluginApi } from "../types/openclaw-plugin.js"
import { createPlaidClient, type PlaidConfig } from "@firela/billclaw-core"
import type {
  LinkTokenCreateRequest,
  LinkTokenCreateResponse,
  ItemPublicTokenExchangeRequest,
  ItemPublicTokenExchangeResponse,
} from "plaid"

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
 * Create Plaid Link token for initializing Link frontend
 */
async function createLinkToken(
  api: OpenClawPluginApi,
  accountId?: string,
): Promise<{ linkToken: string }> {
  const plaidConfig = getPlaidConfig(api)
  const plaidClient = createPlaidClient(plaidConfig)

  const request: LinkTokenCreateRequest = {
    user: {
      client_user_id: accountId || `user_${Date.now()}`,
    },
    client_name: "BillClaw",
    products: ["transactions" as any],
    country_codes: ["US" as any],
    language: "en",
  }

  const axiosResponse = await plaidClient.linkTokenCreate(request)
  const response: LinkTokenCreateResponse = axiosResponse.data

  api.logger.info?.("Plaid Link token created successfully")

  return { linkToken: response.link_token }
}

/**
 * Exchange Plaid public token for access token
 */
async function exchangePublicToken(
  api: OpenClawPluginApi,
  publicToken: string,
): Promise<{ accessToken: string; itemId: string }> {
  const plaidConfig = getPlaidConfig(api)
  const plaidClient = createPlaidClient(plaidConfig)

  const request: ItemPublicTokenExchangeRequest = {
    public_token: publicToken,
  }

  const axiosResponse = await plaidClient.itemPublicTokenExchange(request)
  const response: ItemPublicTokenExchangeResponse = axiosResponse.data

  api.logger.info?.("Plaid public token exchanged successfully")

  return {
    accessToken: response.access_token,
    itemId: response.item_id,
  }
}

/**
 * Handle Plaid Link OAuth flow
 *
 * This integrates Plaid Link (https://plaid.com/docs/link/)
 * for secure bank account connection.
 *
 * Flow:
 * 1. Create Link token (no params) - Returns { url, token: linkToken }
 * 2. Handle Link success callback - Receives publicToken
 * 3. Exchange public_token for access_token - Returns { url: "", token: accessToken, itemId }
 *
 * @param api - OpenClaw plugin API
 * @param publicToken - Optional public token from Plaid Link callback
 * @returns OAuthResult with URL and token
 */
export async function plaidOAuthHandler(
  api: OpenClawPluginApi,
  publicToken?: string,
): Promise<{
  url: string
  token?: string
  itemId?: string
  accessToken?: string
}> {
  try {
    if (!publicToken) {
      // No public token provided - create Link token for initializing Link
      const { linkToken } = await createLinkToken(api)

      // Return Plaid Link URL and the link token
      return {
        url: "https://cdn.plaid.com/link/v2/stable/link.html",
        token: linkToken,
      }
    }

    // Public token provided - exchange for access token
    const { accessToken, itemId } = await exchangePublicToken(api, publicToken)

    // Return the access token and item ID for storage
    return {
      url: "",
      token: accessToken,
      itemId,
      accessToken,
    }
  } catch (error) {
    api.logger.error?.("Plaid OAuth error:", error)
    throw error
  }
}
