/**
 * BillClaw Connect - OAuth Service Server
 *
 * Provides a web interface for OAuth authentication with financial data providers.
 *
 * @packageDocumentation
 */

import express from "express"
import path from "path"
import { fileURLToPath } from "url"
import { ConfigManager } from "@firela/billclaw-core"
import { plaidRouter } from "./routes/plaid.js"
import { gmailRouter } from "./routes/gmail.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Start the Connect server
 */
async function startServer() {
  const configManager = ConfigManager.getInstance()
  const connectConfig = await configManager.getServiceConfig("connect")

  const PORT = connectConfig.port
  const HOST = connectConfig.host

  const app = express()

  // Middleware
  app.use(express.json())
  app.use(express.urlencoded({ extended: true }))

  // Serve static files (HTML pages) - use src/public for development
  app.use(express.static(path.join(__dirname, "../src/public")))

  // Health check endpoint
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "billclaw-connect" })
  })

  // OAuth routes
  app.use("/oauth/plaid", plaidRouter)
  app.use("/oauth/gmail", gmailRouter)

  // Default route
  app.get("/", (_req, res) => {
    res.json({
      service: "BillClaw Connect",
      version: "0.1.0",
      endpoints: {
        health: "/health",
        plaid: "/oauth/plaid",
        gmail: "/oauth/gmail",
      },
    })
  })

  // Start server
  app.listen(PORT, () => {
    console.log(`BillClaw Connect server running on http://${HOST}:${PORT}`)
    console.log(`- Plaid OAuth: http://${HOST}:${PORT}/oauth/plaid`)
    console.log(`- Gmail OAuth: http://${HOST}:${PORT}/oauth/gmail`)
  })
}

// Start the server
startServer().catch((error) => {
  console.error("Failed to start Connect server:", error)
  process.exit(1)
})
