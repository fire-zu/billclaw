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
  ConfigManager,
} from "@firela/billclaw-core"

export const plaidRouter: Router = express.Router()

/**
 * GET /oauth/plaid/link-token
 *
 * Create a Plaid Link token for initializing the Plaid Link frontend.
 */
plaidRouter.get("/link-token", async (_req, res) => {
  try {
    const configManager = ConfigManager.getInstance()
    const config = await configManager.getServiceConfig("plaid")
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

    const configManager = ConfigManager.getInstance()
    const config = await configManager.getServiceConfig("plaid")
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
