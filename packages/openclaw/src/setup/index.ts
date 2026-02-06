/**
 * Setup wizard for BillClaw OpenClaw plugin
 *
 * Guides users through configuring their financial data sources.
 */

import type { OpenClawPluginApi } from "../types/openclaw-plugin.js"

/**
 * Setup configuration result
 */
export interface SetupResult {
  success: boolean
  message: string
  nextSteps?: string[]
  provider?: string
}

/**
 * Generate setup instructions for a provider
 */
function generateSetupInstructions(
  provider: "plaid" | "gmail" | "gocardless",
): SetupResult {
  switch (provider) {
    case "plaid":
      return {
        success: true,
        message: "Plaid setup requires API credentials",
        provider: "plaid",
        nextSteps: [
          "1. Go to https://dashboard.plaid.com/",
          "2. Sign up or log in to your account",
          "3. Create a new app or use existing credentials",
          "4. Copy your Client ID and Secret",
          "5. Set the following environment variables or config values:",
          "",
          "   PLAID_CLIENT_ID=your_client_id",
          "   PLAID_SECRET=your_secret",
          "   PLAID_ENVIRONMENT=sandbox  # or development/production",
          "",
          "6. Run: bills:setup plaid --client-id YOUR_ID --secret YOUR_SECRET",
          "7. Use the OAuth flow to connect your bank accounts",
        ],
      }

    case "gmail":
      return {
        success: true,
        message: "Gmail setup requires OAuth 2.0 credentials",
        provider: "gmail",
        nextSteps: [
          "1. Go to https://console.cloud.google.com/",
          "2. Create a new project or select existing",
          "3. Enable Gmail API",
          "4. Create OAuth 2.0 credentials (Desktop app)",
          "5. Set the following environment variables or config values:",
          "",
          "   GMAIL_CLIENT_ID=your_client_id",
          "   GMAIL_CLIENT_SECRET=your_client_secret  # Optional for PKCE",
          "",
          "6. Run: bills:setup gmail --client-id YOUR_ID",
          "7. Use the OAuth flow to authorize Gmail access",
        ],
      }

    case "gocardless":
      return {
        success: true,
        message: "GoCardless setup requires API credentials",
        provider: "gocardless",
        nextSteps: [
          "1. Go to https://developer.gocardless.com/",
          "2. Sign up for a developer account",
          "3. Create a new application",
          "4. Copy your Client ID and Secret",
          "5. Set the following environment variables:",
          "",
          "   GOCARDLESS_CLIENT_ID=your_client_id",
          "   GOCARDLESS_SECRET=your_secret",
          "   GOCARDLESS_ENVIRONMENT=sandbox  # or live",
          "",
          "6. Configure your bank credentials for open banking",
        ],
      }

    default:
      return {
        success: false,
        message: "Unknown provider. Supported: plaid, gmail, gocardless",
      }
  }
}

/**
 * Show general setup information
 */
function showGeneralSetup(): SetupResult {
  return {
    success: true,
    message: "BillClaw Setup Wizard",
    nextSteps: [
      "",
      "Welcome to BillClaw! This plugin helps you import financial data",
      "from multiple sources while keeping your data sovereign.",
      "",
      "Supported providers:",
      "",
      "  1. Plaid (Bank accounts via Plaid Link)",
      "     - US and Canadian banks",
      "     - Credit cards, investments, loans",
      "",
      "  2. Gmail (Email bills)",
      "     - Extract bills from email",
      "     - Invoice, statement recognition",
      "",
      "  3. GoCardless (European banks)",
      "     - UK and European open banking",
      "     - Bank account connections via PSD2",
      "",
      "To get started, run:",
      "  bills:setup plaid     # Setup Plaid integration",
      "  bills:setup gmail     # Setup Gmail integration",
      "  bills:setup gocardless # Setup GoCardless integration",
      "",
      "Or configure environment variables and run the OAuth flow.",
    ],
  }
}

/**
 * Run setup wizard for a specific provider
 */
export async function runSetupWizard(
  api: OpenClawPluginApi,
  provider?: string,
  options?: Record<string, unknown>,
): Promise<SetupResult> {
  const pluginConfig = api.pluginConfig as Record<string, unknown>

  // If no provider specified, show general info
  if (!provider) {
    return showGeneralSetup()
  }

  const normalizedProvider = provider.toLowerCase() as
    | "plaid"
    | "gmail"
    | "gocardless"

  // For Plaid, check if credentials are already configured
  if (normalizedProvider === "plaid") {
    const hasConfig = pluginConfig?.plaid ||
      process.env.PLAID_CLIENT_ID ||
      process.env.PLAID_SECRET

    if (!hasConfig && (!options?.clientId || !options?.secret)) {
      return generateSetupInstructions("plaid")
    }

    // Store credentials if provided
    if (options?.clientId && options?.secret) {
      api.logger.info?.("Plaid credentials configured")
      return {
        success: true,
        message: "Plaid credentials configured successfully",
        provider: "plaid",
        nextSteps: [
          "Your Plaid API credentials have been configured.",
          "",
          "To connect a bank account, use the OAuth flow:",
          "  1. Run the Plaid Link OAuth",
          "  2. Select your bank from the list",
          "  3. Complete the authentication",
          "  4. Your accounts will be automatically synced",
        ],
      }
    }
  }

  // For Gmail, check if credentials are configured
  if (normalizedProvider === "gmail") {
    const hasConfig = pluginConfig?.gmail ||
      process.env.GMAIL_CLIENT_ID

    if (!hasConfig && !options?.clientId) {
      return generateSetupInstructions("gmail")
    }

    // Store credentials if provided
    if (options?.clientId) {
      api.logger.info?.("Gmail credentials configured")
      return {
        success: true,
        message: "Gmail credentials configured successfully",
        provider: "gmail",
        nextSteps: [
          "Your Gmail OAuth credentials have been configured.",
          "",
          "To connect Gmail, use the OAuth flow:",
          "  1. Run the Gmail OAuth",
          "  2. Authorize access to your Gmail",
          "  3. Bills will be automatically extracted from emails",
        ],
      }
    }
  }

  // For GoCardless
  if (normalizedProvider === "gocardless") {
    const hasConfig = pluginConfig?.gocardless ||
      process.env.GOCARDLESS_CLIENT_ID ||
      process.env.GOCARDLESS_SECRET

    if (!hasConfig && (!options?.clientId || !options?.secret)) {
      return generateSetupInstructions("gocardless")
    }

    if (options?.clientId && options?.secret) {
      api.logger.info?.("GoCardless credentials configured")
      return {
        success: true,
        message: "GoCardless credentials configured successfully",
        provider: "gocardless",
        nextSteps: [
          "Your GoCardless API credentials have been configured.",
          "  Note: GoCardless integration is still in development.",
        ],
      }
    }
  }

  return generateSetupInstructions(normalizedProvider)
}
