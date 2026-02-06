/**
 * Gmail OAuth handler - implements Gmail OAuth 2.0 flow
 *
 * This module handles Gmail OAuth 2.0 authorization using PKCE (Proof Key for Code Exchange).
 *
 * Flow:
 * 1. Generate authorization URL (with PKCE) - Returns { url, state }
 * 2. Handle callback - Receives authorization code
 * 3. Exchange code for access token - Returns { accessToken, refreshToken }
 */

import type { OpenClawPluginApi } from "../types/openclaw-plugin.js"

/**
 * Validated Gmail config with required fields
 */
interface ValidatedGmailConfig {
  clientId: string
  clientSecret: string
}

/**
 * Get Gmail configuration from OpenClaw config
 */
function getGmailConfig(api: OpenClawPluginApi): ValidatedGmailConfig {
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
 * Generate random code verifier for PKCE
 */
function generateCodeVerifier(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return base64UrlEncode(array)
}

/**
 * Generate code challenge from verifier for PKCE
 */
async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const hash = await crypto.subtle.digest("SHA-256", data)
  return base64UrlEncode(new Uint8Array(hash))
}

/**
 * Base64URL encode a byte array
 */
function base64UrlEncode(bytes: Uint8Array): string {
  const binString = Array.from(bytes, (byte) => String.fromCharCode(byte))
  const base64 = btoa(binString.join(""))
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")
}

/**
 * State parameter storage (in-memory for security)
 * In production, this should be stored in a secure session
 */
const oauthStateStore = new Map<string, {
  codeVerifier: string
  timestamp: number
}>()

/**
 * Clean up expired states (older than 10 minutes)
 */
function cleanupExpiredStates(): void {
  const now = Date.now()
  const maxAge = 10 * 60 * 1000 // 10 minutes
  for (const [key, value] of oauthStateStore.entries()) {
    if (now - value.timestamp > maxAge) {
      oauthStateStore.delete(key)
    }
  }
}

/**
 * Generate Gmail OAuth authorization URL
 *
 * Uses PKCE for security without requiring client secret.
 */
async function generateAuthorizationUrl(
  api: OpenClawPluginApi,
  redirectUri: string = "http://localhost:3000/callback",
): Promise<{ url: string; state: string }> {
  cleanupExpiredStates()

  const gmailConfig = getGmailConfig(api)

  // Generate PKCE verifier and challenge
  const codeVerifier = generateCodeVerifier()
  const codeChallenge = await generateCodeChallenge(codeVerifier)

  // Generate state parameter for CSRF protection
  const state = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")

  // Store state and verifier
  oauthStateStore.set(state, {
    codeVerifier,
    timestamp: Date.now(),
  })

  // Build authorization URL
  const params = new URLSearchParams()
  params.set("client_id", gmailConfig.clientId)
  params.set("redirect_uri", redirectUri)
  params.set("response_type", "code")
  params.set("scope", "https://www.googleapis.com/auth/gmail.readonly")
  params.set("state", state)
  params.set("code_challenge", codeChallenge)
  params.set("code_challenge_method", "S256")
  params.set("access_type", "offline") // Allow refresh token
  params.set("prompt", "consent") // Force consent to get refresh token

  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`

  api.logger.info?.("Gmail authorization URL generated")

  return { url, state }
}

/**
 * Exchange authorization code for access token
 *
 * Completes the OAuth flow by exchanging the authorization code
 * for an access token (and optionally refresh token).
 */
async function exchangeCodeForToken(
  api: OpenClawPluginApi,
  code: string,
  state: string,
  redirectUri: string = "http://localhost:3000/callback",
): Promise<{ accessToken: string; refreshToken?: string; expiresIn?: number }> {
  // Retrieve stored state
  const storedState = oauthStateStore.get(state)
  if (!storedState) {
    throw new Error("Invalid or expired OAuth state. Please try again.")
  }

  // Clean up state
  oauthStateStore.delete(state)

  const gmailConfig = getGmailConfig(api)

  // Exchange code for token
  const tokenUrl = "https://oauth2.googleapis.com/token"
  const params = new URLSearchParams()
  params.set("code", code)
  params.set("client_id", gmailConfig.clientId)
  if (gmailConfig.clientSecret) {
    params.set("client_secret", gmailConfig.clientSecret)
  }
  params.set("redirect_uri", redirectUri)
  params.set("grant_type", "authorization_code")
  params.set("code_verifier", storedState.codeVerifier)

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to exchange token: ${response.status} ${errorText}`)
  }

  const data = (await response.json()) as {
    access_token: string
    refresh_token?: string
    expires_in: number
  }

  api.logger.info?.("Gmail access token obtained successfully")

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  }
}

/**
 * Handle Gmail OAuth flow
 *
 * This integrates Gmail OAuth 2.0 with PKCE for secure authorization.
 *
 * Flow:
 * 1. Initialize OAuth (no params) - Returns { url, state }
 * 2. Handle callback (code + state) - Returns { accessToken, refreshToken }
 *
 * @param api - OpenClaw plugin API
 * @param context - OAuth context with optional code and state from callback
 * @returns OAuthResult with URL and/or token
 */
export async function gmailOAuthHandler(
  api: OpenClawPluginApi,
  context?: { code?: string state?: string redirectUri?: string },
): Promise<{
  url: string
  state?: string
  accessToken?: string
  refreshToken?: string
  expiresIn?: number
}> {
  try {
    const { code, state, redirectUri } = context || {}

    // Phase 1: Generate authorization URL
    if (!code) {
      const { url: authUrl, state: newState } = await generateAuthorizationUrl(
        api,
        redirectUri,
      )
      return {
        url: authUrl,
        state: newState,
      }
    }

    // Phase 2: Exchange authorization code for access token
    if (!state) {
      throw new Error("State parameter is required for code exchange")
    }

    const { accessToken, refreshToken, expiresIn } = await exchangeCodeForToken(
      api,
      code,
      state,
      redirectUri,
    )

    return {
      url: "",
      accessToken,
      refreshToken,
      expiresIn,
    }
  } catch (error) {
    api.logger.error?.("Gmail OAuth error:", error)
    throw error
  }
}
