/**
 * Plaid OAuth routes
 *
 * Provides HTTP endpoints for Plaid Link OAuth flow.
 *
 * @packageDocumentation
 */

import express from "express"
import type { Router } from "express"
import {
  plaidOAuthHandler,
  type PlaidConfig,
} from "@firela/billclaw-core"

export const plaidRouter: Router = express.Router()

/**
 * GET /oauth/plaid/link-token
 *
 * Create a Plaid Link token for initializing the Plaid Link frontend.
 */
plaidRouter.get("/link-token", async (_req, res) => {
  try {
    const config = getPlaidConfig()
    const result = await plaidOAuthHandler(config)

    // Return the Link token and the Plaid Link URL
    res.json({
      success: true,
      linkToken: result.token,
      plaidUrl: result.url,
    })
  } catch (error) {
    console.error("Error creating Plaid Link token:", error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
})

/**
 * POST /oauth/plaid/exchange
 *
 * Exchange a Plaid public token for an access token.
 */
plaidRouter.post("/exchange", async (req, res) => {
  try {
    const { publicToken, accountId } = req.body

    if (!publicToken) {
      return res.status(400).json({
        success: false,
        error: "publicToken is required",
      })
    }

    const config = getPlaidConfig()
    const result = await plaidOAuthHandler(config, publicToken, accountId)

    res.json({
      success: true,
      accessToken: result.accessToken,
      itemId: result.itemId,
    })
  } catch (error) {
    console.error("Error exchanging Plaid public token:", error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
})

/**
 * Get Plaid configuration from environment variables
 */
function getPlaidConfig(): PlaidConfig {
  const clientId = process.env.PLAID_CLIENT_ID
  const secret = process.env.PLAID_SECRET
  const environment = (process.env.PLAID_ENVIRONMENT || "sandbox") as
    | "sandbox"
    | "development"
    | "production"

  if (!clientId || !secret) {
    throw new Error(
      "Plaid credentials not configured. Set PLAID_CLIENT_ID and PLAID_SECRET environment variables.",
    )
  }

  return { clientId, secret, environment }
}
