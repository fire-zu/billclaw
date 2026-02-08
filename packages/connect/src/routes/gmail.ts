/**
 * Gmail OAuth routes
 *
 * Provides HTTP endpoints for Gmail OAuth 2.0 flow.
 *
 * @packageDocumentation
 */

import express from "express"
import type { Router } from "express"
import {
  gmailOAuthHandler,
  ConfigManager,
} from "@firela/billclaw-core"

export const gmailRouter: Router = express.Router()

/**
 * GET /oauth/gmail/authorize
 *
 * Generate a Gmail OAuth authorization URL.
 */
gmailRouter.get("/authorize", async (req, res) => {
  try {
    const configManager = ConfigManager.getInstance()
    const config = await configManager.getServiceConfig("gmail")
    const redirectUri = req.query.redirectUri as string | undefined

    const result = await gmailOAuthHandler(config, { redirectUri })

    res.json({
      success: true,
      authUrl: result.url,
      state: result.state,
    })
  } catch (error) {
    console.error("Error generating Gmail authorization URL:", error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
})

/**
 * POST /oauth/gmail/exchange
 *
 * Exchange a Gmail authorization code for access token.
 */
gmailRouter.post("/exchange", async (req, res) => {
  try {
    const { code, state, redirectUri } = req.body

    if (!code || !state) {
      return res.status(400).json({
        success: false,
        error: "code and state are required",
      })
    }

    const configManager = ConfigManager.getInstance()
    const config = await configManager.getServiceConfig("gmail")
    const result = await gmailOAuthHandler(config, { code, state, redirectUri })

    res.json({
      success: true,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
    })
  } catch (error) {
    console.error("Error exchanging Gmail authorization code:", error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
})
