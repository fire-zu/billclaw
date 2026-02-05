/**
 * Gmail OAuth 2.0 handler for billclaw
 *
 * This module handles Google OAuth 2.0 authentication flow for Gmail access.
 * It integrates with OpenClaw's auth-profiles.json for token management.
 */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { BillclawConfig } from "../../config.js";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import * as crypto from "node:crypto";

/**
 * Google OAuth 2.0 configuration
 */
export interface GmailOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

/**
 * Gmail token storage format (auth-profiles.json compatible)
 */
export interface GmailToken {
  access_token: string;
  refresh_token?: string;
  expiry_date: number;
  token_type: string;
  scope: string;
}

/**
 * OAuth state for CSRF protection
 */
interface OAuthState {
  state: string;
  codeVerifier: string;
  redirectUri: string;
  createdAt: number;
}

/**
 * Default OAuth scopes for Gmail access
 */
const DEFAULT_GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];

/**
 * In-memory OAuth state storage (for active flows)
 */
const activeStates = new Map<string, OAuthState>();

/**
 * Clean up expired OAuth states
 */
function cleanupExpiredStates(): void {
  const now = Date.now();
  const EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

  for (const [key, state] of activeStates.entries()) {
    if (now - state.createdAt > EXPIRY_MS) {
      activeStates.delete(key);
    }
  }
}

// Clean up states every 5 minutes
setInterval(cleanupExpiredStates, 5 * 60 * 1000);

/**
 * Get auth profiles path
 */
function getAuthProfilesPath(): string {
  return path.join(os.homedir(), ".openclaw", "auth-profiles.json");
}

/**
 * Load auth-profiles.json
 */
async function loadAuthProfiles(): Promise<Record<string, unknown>> {
  const profilesPath = getAuthProfilesPath();

  try {
    const content = await fs.readFile(profilesPath, "utf-8");
    return JSON.parse(content);
  } catch {
    // File doesn't exist or is invalid, return empty
    return {};
  }
}

/**
 * Save auth-profiles.json
 */
async function saveAuthProfiles(profiles: Record<string, unknown>): Promise<void> {
  const profilesPath = getAuthProfilesPath();
  const dir = path.dirname(profilesPath);

  // Ensure directory exists
  await fs.mkdir(dir, { recursive: true });

  // Write with atomic rename pattern
  const tmpPath = `${profilesPath}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(profiles, null, 2), "utf-8");
  await fs.rename(tmpPath, profilesPath);
}

/**
 * Get Gmail OAuth config from plugin config or environment
 */
export function getGmailOAuthConfig(
  api: OpenClawPluginApi
): GmailOAuthConfig {
  const config = api.pluginConfig as BillclawConfig;

  const clientId = config?.gmail?.clientId || process.env.GMAIL_CLIENT_ID;
  const clientSecret = config?.gmail?.clientSecret || process.env.GMAIL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Gmail OAuth credentials not configured. Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET environment variables."
    );
  }

  return {
    clientId,
    clientSecret,
    redirectUri: "http://localhost:41209/callback", // OpenClaw OAuth callback port
    scopes: DEFAULT_GMAIL_SCOPES,
  };
}

/**
 * Generate PKCE code challenge and verifier
 */
function generatePKCE(): { codeChallenge: string; codeVerifier: string } {
  // Generate random code verifier
  const codeVerifier = crypto.randomBytes(32).toString("base64url");

  // Generate code challenge (S256 method)
  const hash = crypto.createHash("sha256").update(codeVerifier).digest();
  const codeChallenge = hash.toString("base64url");

  return { codeChallenge, codeVerifier };
}

/**
 * Generate OAuth authorization URL
 *
 * Returns the URL to redirect the user to for OAuth consent
 */
export async function generateAuthUrl(api: OpenClawPluginApi): Promise<{
  authUrl: string;
  state: string;
}> {
  const oauthConfig = getGmailOAuthConfig(api);
  const { codeChallenge, codeVerifier } = generatePKCE();
  const state = crypto.randomBytes(16).toString("hex");

  // Store OAuth state
  activeStates.set(state, {
    state,
    codeVerifier,
    redirectUri: oauthConfig.redirectUri,
    createdAt: Date.now(),
  });

  // Build authorization URL
  const params = new URLSearchParams({
    client_id: oauthConfig.clientId,
    redirect_uri: oauthConfig.redirectUri,
    response_type: "code",
    scope: oauthConfig.scopes.join(" "),
    state: state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    access_type: "offline", // Request refresh token
    prompt: "consent", // Force consent to get refresh token
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  return { authUrl, state };
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(
  api: OpenClawPluginApi,
  code: string,
  state: string
): Promise<GmailToken> {
  const oauthConfig = getGmailOAuthConfig(api);

  // Verify state
  const oauthState = activeStates.get(state);
  if (!oauthState) {
    throw new Error("Invalid or expired OAuth state");
  }

  // Exchange code for token
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code,
      client_id: oauthConfig.clientId,
      client_secret: oauthConfig.clientSecret,
      redirect_uri: oauthConfig.redirectUri,
      grant_type: "authorization_code",
      code_verifier: oauthState.codeVerifier,
    }),
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  const tokenData = (await tokenResponse.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type?: string;
    scope?: string;
  };

  // Calculate expiry date
  const expiresIn = tokenData.expires_in || 3600;
  const expiryDate = Date.now() + expiresIn * 1000;

  const token: GmailToken = {
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    expiry_date: expiryDate,
    token_type: tokenData.token_type || "Bearer",
    scope: tokenData.scope || oauthConfig.scopes.join(" "),
  };

  // Store token in auth-profiles.json
  const profiles = await loadAuthProfiles();
  profiles.gmail = token;
  await saveAuthProfiles(profiles);

  // Clean up state
  activeStates.delete(state);

  return token;
}

/**
 * Get stored Gmail token
 */
export async function getStoredToken(): Promise<GmailToken | null> {
  const profiles = await loadAuthProfiles();
  const token = profiles.gmail as GmailToken | undefined;

  if (!token) {
    return null;
  }

  return token;
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(
  api: OpenClawPluginApi
): Promise<GmailToken> {
  const oauthConfig = getGmailOAuthConfig(api);
  const oldToken = await getStoredToken();

  if (!oldToken?.refresh_token) {
    throw new Error("No refresh token available. Please re-authenticate.");
  }

  // Refresh token
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: oauthConfig.clientId,
      client_secret: oauthConfig.clientSecret,
      refresh_token: oldToken.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    throw new Error(`Token refresh failed: ${error}`);
  }

  const tokenData = (await tokenResponse.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type?: string;
    scope?: string;
  };

  // Calculate expiry date
  const expiresIn = tokenData.expires_in || 3600;
  const expiryDate = Date.now() + expiresIn * 1000;

  const token: GmailToken = {
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token || oldToken.refresh_token,
    expiry_date: expiryDate,
    token_type: tokenData.token_type || "Bearer",
    scope: tokenData.scope || oldToken.scope,
  };

  // Store updated token
  const profiles = await loadAuthProfiles();
  profiles.gmail = token;
  await saveAuthProfiles(profiles);

  return token;
}

/**
 * Get valid access token (refresh if needed)
 */
export async function getAccessToken(api: OpenClawPluginApi): Promise<string> {
  const token = await getStoredToken();

  if (!token) {
    throw new Error("Not authenticated. Please run OAuth flow first.");
  }

  // Check if token is expired or will expire soon (5 minutes)
  const now = Date.now();
  const expiryBuffer = 5 * 60 * 1000;

  if (token.expiry_date - now < expiryBuffer) {
    // Token is expiring soon, refresh it
    const refreshed = await refreshAccessToken(api);
    return refreshed.access_token;
  }

  return token.access_token;
}

/**
 * Revoke token (logout)
 */
export async function revokeToken(): Promise<void> {
  const token = await getStoredToken();

  if (token?.access_token) {
    try {
      // Revoke token at Google
      await fetch(`https://oauth2.googleapis.com/revoke?token=${token.access_token}`);
    } catch {
      // Ignore revoke errors, just clear local storage
    }
  }

  // Remove from storage
  const profiles = await loadAuthProfiles();
  delete profiles.gmail;
  await saveAuthProfiles(profiles);
}

/**
 * Get user info from Google
 */
export async function getUserInfo(
  api: OpenClawPluginApi
): Promise<{ email: string; name?: string }> {
  const accessToken = await getAccessToken(api);

  const response = await fetch(
    "https://www.googleapis.com/oauth2/v2/userinfo",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to get user info: ${response.statusText}`);
  }

  const userInfo = (await response.json()) as {
    email: string;
    name?: string;
  };

  return {
    email: userInfo.email,
    name: userInfo.name,
  };
}

/**
 * OAuth handler for OpenClaw plugin registration
 *
 * This function handles the OAuth flow for Gmail authentication.
 * It's called by OpenClaw when a user initiates the Gmail OAuth flow.
 */
export async function gmailOAuth(
  api: OpenClawPluginApi
): Promise<{
  success: boolean;
  authUrl?: string;
  email?: string;
  error?: string;
}> {
  // Check if already authenticated
  const token = await getStoredToken();
  if (token) {
    try {
      const userInfo = await getUserInfo(api);
      return {
        success: true,
        email: userInfo.email,
      };
    } catch {
      // Token might be expired, generate new auth URL
    }
  }

  // Generate auth URL for OAuth flow
  const { authUrl } = await generateAuthUrl(api);
  return {
    success: true,
    authUrl,
  };
}
