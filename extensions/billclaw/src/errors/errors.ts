/**
 * Error handling utilities for billclaw
 *
 * Provides user-friendly error messages, recovery suggestions,
 * and troubleshooting guides.
 */

import * as os from "node:os";
import * as path from "node:path";

/**
 * Error categories for better user messaging
 */
export enum ErrorCategory {
  // Configuration errors
  CONFIG = "configuration",
  CREDENTIALS = "credentials",
  NETWORK = "network",

  // Plaid errors
  PLAID_API = "plaid_api",
  PLAID_AUTH = "plaid_auth",
  PLAID_ITEM = "plaid_item",

  // Gmail errors
  GMAIL_API = "gmail_api",
  GMAIL_AUTH = "gmail_auth",

  // Storage errors
  STORAGE = "storage",
  FILE_SYSTEM = "file_system",

  // General errors
  UNKNOWN = "unknown",
}

/**
 * User-friendly error with recovery suggestions
 */
export interface UserError {
  type: "UserError"; // Type discriminator
  category: ErrorCategory;
  title: string;
  message: string;
  suggestions: string[];
  docsLink?: string;
  error?: Error; // Original error for debugging
}

/**
 * Create a user-friendly error
 */
export function createUserError(
  category: ErrorCategory,
  title: string,
  message: string,
  suggestions: string[],
  docsLink?: string,
  originalError?: Error
): UserError {
  return {
    type: "UserError",
    category,
    title,
    message,
    suggestions,
    docsLink,
    error: originalError,
  };
}

/**
 * Format error for display to user
 */
export function formatError(error: UserError): string {
  const lines: string[] = [];

  // Header with category emoji
  const categoryEmoji = getCategoryEmoji(error.category);
  lines.push(`${categoryEmoji} ${error.title}`);
  lines.push("");

  // Message
  lines.push(error.message);
  lines.push("");

  // Suggestions
  if (error.suggestions.length > 0) {
    lines.push("💡 Suggestions:");
    for (let i = 0; i < error.suggestions.length; i++) {
      lines.push(`   ${i + 1}. ${error.suggestions[i]}`);
    }
  }

  // Docs link
  if (error.docsLink) {
    lines.push("");
    lines.push(`📚 Learn more: ${error.docsLink}`);
  }

  return lines.join("\n");
}

/**
 * Get emoji for error category
 */
function getCategoryEmoji(category: ErrorCategory): string {
  const emojis: Record<ErrorCategory, string> = {
    [ErrorCategory.CONFIG]: "⚙️",
    [ErrorCategory.CREDENTIALS]: "🔑",
    [ErrorCategory.NETWORK]: "🌐",
    [ErrorCategory.PLAID_API]: "🏦",
    [ErrorCategory.PLAID_AUTH]: "🔐",
    [ErrorCategory.PLAID_ITEM]: "📝",
    [ErrorCategory.GMAIL_API]: "📧",
    [ErrorCategory.GMAIL_AUTH]: "🔐",
    [ErrorCategory.STORAGE]: "💾",
    [ErrorCategory.FILE_SYSTEM]: "📁",
    [ErrorCategory.UNKNOWN]: "❓",
  };
  return emojis[category] || "❓";
}

/**
 * Parse Plaid error codes and create user-friendly errors
 */
export function parsePlaidError(error: {
  error_code?: string;
  error_message?: string;
  error_type?: string;
  display_message?: string;
  request_id?: string;
}): UserError {
  const errorCode = error.error_code || "UNKNOWN";
  const errorMessage = error.error_message || error.display_message || "An error occurred";
  const requestId = error.request_id;

  // Login required
  if (errorCode === "ITEM_LOGIN_REQUIRED" || error.error_type === "ITEM_LOGIN_REQUIRED") {
    return createUserError(
      ErrorCategory.PLAID_AUTH,
      "Account Re-Authentication Required",
      "Your bank account requires re-authentication. This happens when your bank credentials have changed or expired.",
      [
        "Run 'openclaw bills setup' to re-authenticate via Plaid Link",
        "This will open a secure browser window where you can log into your bank",
        "After re-authentication, your transactions will sync normally",
      ],
      "https://plaid.com/docs/errors/#item-login-required"
    );
  }

  // Invalid credentials
  if (errorCode === "INVALID_ACCESS_TOKEN" || error.error_type === "INVALID_ACCESS_TOKEN") {
    return createUserError(
      ErrorCategory.PLAID_AUTH,
      "Invalid Access Token",
      "Your access token is invalid. This can happen if the token was revoked or corrupted.",
      [
        "Run 'openclaw bills setup' to reconnect your account",
        "If this persists, remove and re-add the account",
      ],
      "https://plaid.com/docs/errors/#invalid-access-token"
    );
  }

  // Product not ready
  if (errorCode === "PRODUCT_NOT_READY") {
    return createUserError(
      ErrorCategory.PLAID_API,
      "Account Not Ready",
      "Your account is not fully set up yet. Plaid is still processing your account information.",
      [
        "Wait a few minutes and try again",
        "If this persists, contact Plaid support",
      ],
      "https://plaid.com/docs/errors/#product-not-ready"
    );
  }

  // Rate limit
  if (errorCode === "RATE_LIMIT_EXCEEDED") {
    return createUserError(
      ErrorCategory.PLAID_API,
      "API Rate Limit Exceeded",
      "Too many requests have been made to the Plaid API. Please wait before trying again.",
      [
        "Wait a few minutes before syncing again",
        "Consider syncing less frequently (e.g., daily instead of hourly)",
        "If you need higher rate limits, upgrade your Plaid plan",
      ],
      "https://plaid.com/docs/errors/#rate-limit-exceeded"
    );
  }

  // Institution down
  if (errorCode === "INSTITUTION_DOWN") {
    return createUserError(
      ErrorCategory.PLAID_API,
      "Bank temporarily unavailable",
      "Your bank's systems are temporarily down for maintenance.",
      [
        "Wait a few minutes and try again",
        "Check your bank's website for service status updates",
        "Your transactions will sync automatically once the bank is back online",
      ],
      undefined
    );
  }

  // Invalid credentials
  if (errorCode === "INVALID_CREDENTIALS") {
    return createUserError(
      ErrorCategory.PLAID_API,
      "Invalid API Credentials",
      "The Plaid API credentials configured are invalid.",
      [
        "Run 'openclaw config set billclaw.plaid.clientId YOUR_CLIENT_ID'",
        "Run 'openclaw config set billclaw.plaid.secret YOUR_SECRET'",
        "Verify your credentials at https://dashboard.plaid.com",
      ],
      "https://dashboard.plaid.com"
    );
  }

  // Generic Plaid error
  return createUserError(
    ErrorCategory.PLAID_API,
    "Plaid API Error",
    `${errorMessage}${requestId ? ` (Request ID: ${requestId})` : ""}`,
    [
      "Try again in a few minutes",
      "If the problem persists, run 'openclaw bills status' for more details",
      "Check Plaid status at https://status.plaid.com",
    ],
    "https://plaid.com/docs/errors/"
  );
}

/**
 * Parse Gmail API errors and create user-friendly errors
 */
export function parseGmailError(error: {
  code?: number;
  message?: string;
  status?: number;
}): UserError {
  const statusCode = error.status || error.code || 0;

  // Unauthorized
  if (statusCode === 401) {
    return createUserError(
      ErrorCategory.GMAIL_AUTH,
      "Gmail Authentication Failed",
      "Your Gmail access has expired or been revoked. You need to re-authenticate.",
      [
        "Run 'openclaw bills setup' to re-authenticate with Gmail",
        "Make sure you grant read-only access to your Gmail",
        "Check that Google Cloud OAuth credentials are valid",
      ],
      "https://developers.google.com/gmail/api/auth"
    );
  }

  // Forbidden
  if (statusCode === 403) {
    return createUserError(
      ErrorCategory.GMAIL_API,
      "Gmail Access Denied",
      "Access to Gmail was denied. This usually means the OAuth token lacks the required permissions.",
      [
        "Make sure the Gmail API is enabled in Google Cloud Console",
        "Verify that the OAuth consent screen includes 'gmail.readonly' scope",
        "Re-authenticate to grant proper permissions",
      ],
      "https://developers.google.com/gmail/api/auth"
    );
  }

  // Not found
  if (statusCode === 404) {
    return createUserError(
      ErrorCategory.GMAIL_API,
      "Gmail API Not Found",
      "The Gmail API endpoint could not be found. This may be a configuration issue.",
      [
        "Verify the Gmail API is enabled in your Google Cloud project",
        "Check that the API name is correct: 'gmail.api'",
        "Try re-enabling the Gmail API in Google Cloud Console",
      ],
      "https://console.cloud.google.com/apis/library/gmail-api"
    );
  }

  // Rate limit
  if (statusCode === 429) {
    return createUserError(
      ErrorCategory.GMAIL_API,
      "Gmail API Rate Limit Exceeded",
      "Too many requests have been made to the Gmail API. You've hit the daily quota limit.",
      [
        "Wait until tomorrow when the quota resets",
        "Reduce sync frequency to avoid hitting the limit",
        "Consider using Gmail push notifications instead of polling",
        "Free tier: 250 quota units/day (see costs.md for details)",
      ],
      "https://developers.google.com/gmail/api/v1/quota"
    );
  }

  // Generic Gmail error
  return createUserError(
    ErrorCategory.GMAIL_API,
    "Gmail API Error",
    error.message || "An error occurred while communicating with Gmail",
    [
      "Check your internet connection",
      "Verify Gmail API is enabled in Google Cloud Console",
      "Try again in a few minutes",
    ],
    "https://developers.google.com/gmail/api"
  );
}

/**
 * Parse network errors
 */
export function parseNetworkError(error: Error): UserError {
  const message = error.message.toLowerCase();

  // Connection refused
  if (message.includes("econnrefused") || message.includes("connection refused")) {
    return createUserError(
      ErrorCategory.NETWORK,
      "Connection Refused",
      "Could not connect to the server. The service may be down or your network is blocking the connection.",
      [
        "Check your internet connection",
        "Verify you're not behind a firewall or proxy",
        "If using a VPN, try disconnecting it",
        "Check if the service is temporarily down",
      ],
      undefined
    );
  }

  // Timeout
  if (message.includes("timeout") || message.includes("timed out")) {
    return createUserError(
      ErrorCategory.NETWORK,
      "Request Timeout",
      "The request took too long to complete. This could be due to slow network or server issues.",
      [
        "Check your internet connection speed",
        "Try again in a few minutes",
        "If syncing many transactions, consider reducing the date range",
      ],
      undefined
    );
  }

  // DNS resolution failed
  if (message.includes("enotfound") || message.includes("getaddrinfo")) {
    return createUserError(
      ErrorCategory.NETWORK,
      "DNS Resolution Failed",
      "Could not resolve the server address. This might be a DNS or network configuration issue.",
      [
        "Check your internet connection",
        "Try switching to a different DNS server (e.g., 8.8.8.8)",
        "Flush your DNS cache: ipconfig /flushdns (Windows) or sudo dscacheutil -flushcache (macOS)",
        "If you're using a VPN, try disconnecting it",
      ],
      undefined
    );
  }

  // Generic network error
  return createUserError(
    ErrorCategory.NETWORK,
    "Network Error",
    error.message || "An error occurred while communicating with the server",
    [
      "Check your internet connection",
      "Try again in a few minutes",
      "If the problem persists, check your network settings",
    ],
    undefined
  );
}

/**
 * Parse file system errors
 */
export function parseFileSystemError(error: Error, filePath?: string): UserError {
  const code = (error as any).code;
  const message = error.message;

  // Permission denied
  if (code === "EACCES" || code === "EPERM") {
    return createUserError(
      ErrorCategory.FILE_SYSTEM,
      "Permission Denied",
      `Cannot access ${filePath || "file or directory"}. You don't have the required permissions.`,
      [
        "Check file/directory permissions",
        "Try running with elevated privileges if appropriate",
        "Ensure the user has read/write access to ~/.openclaw/",
      ],
      undefined
    );
  }

  // No space left
  if (code === "ENOSPC") {
    return createUserError(
      ErrorCategory.STORAGE,
      "Disk Full",
      "No space left on device. Cannot save transactions.",
      [
        "Free up disk space by deleting unnecessary files",
        "Check disk usage: df -h (Linux/macOS) or Get-PSDrive (Windows)",
        "Consider moving the billclaw data directory to a drive with more space",
      ],
      undefined
    );
  }

  // Directory not found
  if (code === "ENOENT" && message.includes("no such file")) {
    return createUserError(
      ErrorCategory.FILE_SYSTEM,
      "File or Directory Not Found",
      `The file or directory ${filePath || ""} does not exist.`,
      [
        "Run 'openclaw bills setup' to initialize billclaw",
        "Verify the data directory path is correct",
        "Check that the directory ~/.openclaw/billclaw/ exists",
      ],
      undefined
    );
  }

  // Generic file system error
  return createUserError(
    ErrorCategory.FILE_SYSTEM,
    "File System Error",
    message || "An error occurred while accessing the file system",
    [
      "Check file/directory permissions",
      "Ensure the data directory exists and is writable",
      "Try running 'openclaw bills setup' to reinitialize",
    ],
    undefined
  );
}

/**
 * Get storage directory path
 */
export function getStorageDir(): string {
  const storagePath = "~/.openclaw/billclaw";
  return storagePath.replace(/^~/, os.homedir());
}

/**
 * Check common issues and return helpful errors
 */
export function diagnoseCommonIssues(): UserError[] {
  const issues: UserError[] = [];
  const storageDir = getStorageDir();

  // Check if storage directory exists
  try {
    const fs = require("node:fs/promises");
    const path = require("node:path");

    // Check directory exists
    fs.access(storageDir).catch(() => {
      issues.push(createUserError(
        ErrorCategory.CONFIG,
        "billclaw Not Initialized",
        "The billclaw data directory does not exist. You need to set up billclaw first.",
        [
          "Run 'openclaw bills setup' to initialize billclaw",
          "This will create the necessary directories and configuration",
        ],
        undefined
      ));
    });

    // Check config file exists
    const configPath = path.join(os.homedir(), ".openclaw", "config.json");
    fs.access(configPath).catch(() => {
      issues.push(createUserError(
        ErrorCategory.CONFIG,
        "OpenClaw Config Not Found",
        "The OpenClaw configuration file does not exist.",
        [
          "Run 'openclaw bills setup' to create initial configuration",
          "Or manually create ~/.openclaw/config.json",
        ],
        undefined
      ));
    });
  } catch (error) {
    issues.push(createUserError(
      ErrorCategory.UNKNOWN,
      "Diagnosis Failed",
      "Could not diagnose common issues.",
      [
        "Ensure OpenClaw is properly installed",
        "Check your file system permissions",
      ],
      undefined
    ));
  }

  return issues;
}

/**
 * Type guard to check if error is a UserError
 */
function isUserError(error: unknown): error is UserError {
  return (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    (error as UserError).type === "UserError"
  );
}

/**
 * Log error with context for debugging
 */
export function logError(
  api: { logger?: { info?: (...args: any[]) => void; error?: (...args: any[]) => void } },
  error: UserError | Error,
  context?: Record<string, unknown>
): void {
  const logData = {
    timestamp: new Date().toISOString(),
    category: isUserError(error) ? error.category : ErrorCategory.UNKNOWN,
    message: error.message,
    context,
  } as Record<string, unknown>;

  if (isUserError(error) && error.error) {
    logData.originalError = {
      name: error.error.name,
      message: error.error.message,
      stack: error.error.stack,
    };
  }

  api.logger?.error?.("billclaw error:", JSON.stringify(logData, null, 2));
}

/**
 * Get troubleshooting guide URL for error category
 */
export function getTroubleshootingUrl(category: ErrorCategory): string {
  const baseUrl = "https://github.com/fire-zu/billclaw/blob/main/docs/troubleshooting.md";
  const urls: Partial<Record<ErrorCategory, string>> = {
    [ErrorCategory.CONFIG]: `${baseUrl}#configuration-issues`,
    [ErrorCategory.CREDENTIALS]: `${baseUrl}#credentials--authentication`,
    [ErrorCategory.NETWORK]: `${baseUrl}#network-issues`,
    [ErrorCategory.PLAID_API]: `${baseUrl}#plaid-integration`,
    [ErrorCategory.PLAID_AUTH]: `${baseUrl}#credentials--authentication`,
    [ErrorCategory.PLAID_ITEM]: `${baseUrl}#plaid-integration`,
    [ErrorCategory.GMAIL_API]: `${baseUrl}#gmail-integration`,
    [ErrorCategory.GMAIL_AUTH]: `${baseUrl}#credentials--authentication`,
    [ErrorCategory.STORAGE]: `${baseUrl}#storage-issues`,
    [ErrorCategory.FILE_SYSTEM]: `${baseUrl}#storage-issues`,
  };

  return urls[category] || baseUrl;
}
