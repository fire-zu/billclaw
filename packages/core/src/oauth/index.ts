/**
 * Framework-agnostic OAuth module
 *
 * This module provides OAuth handlers for various financial data providers.
 * All handlers are independent of any specific runtime framework.
 *
 * @packageDocumentation
 */

// Types
export type {
  PlaidConfig,
  GmailOAuthConfig,
  OAuthConfig,
  PlaidLinkTokenResult,
  PlaidTokenExchangeResult,
  PlaidOAuthResult,
  GmailAuthUrlResult,
  GmailTokenResult,
  GmailOAuthResult,
  OAuthContext,
  OAuthHandlerOptions,
} from "./types.js"

// Plaid
export {
  createLinkToken,
  exchangePublicToken,
  plaidOAuthHandler,
} from "./providers/plaid.js"

// Gmail
export {
  cleanupExpiredStates,
  generateAuthorizationUrl,
  exchangeCodeForToken,
  gmailOAuthHandler,
  refreshGmailToken,
} from "./providers/gmail.js"
