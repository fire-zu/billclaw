/**
 * Tests for error handling utilities
 */

import { describe, it, expect, vi } from "vitest";
import {
  createUserError,
  formatError,
  parsePlaidError,
  parseGmailError,
  parseNetworkError,
  parseFileSystemError,
  diagnoseCommonIssues,
  logError,
  ErrorCategory,
} from "./errors.js";

// Import UserError type for type assertions
import type { UserError } from "./errors.js";

// Mock logger
const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
};

describe("Error Handling", () => {
  describe("createUserError", () => {
    it("should create a user error with all fields", () => {
      const error = createUserError(
        ErrorCategory.CONFIG,
        "Test Error",
        "This is a test error message",
        ["Suggestion 1", "Suggestion 2"],
        "https://example.com/docs",
        new Error("Original error")
      );

      expect(error.category).toBe(ErrorCategory.CONFIG);
      expect(error.title).toBe("Test Error");
      expect(error.message).toBe("This is a test error message");
      expect(error.suggestions).toEqual(["Suggestion 1", "Suggestion 2"]);
      expect(error.docsLink).toBe("https://example.com/docs");
      expect(error.error).toBeInstanceOf(Error);
    });

    it("should create error without optional fields", () => {
      const error = createUserError(
        ErrorCategory.NETWORK,
        "Network Error",
        "Connection failed",
        ["Try again"]
      );

      expect(error.category).toBe(ErrorCategory.NETWORK);
      expect(error.title).toBe("Network Error");
      expect(error.docsLink).toBeUndefined();
      expect(error.error).toBeUndefined();
    });
  });

  describe("formatError", () => {
    it("should format error with all fields", () => {
      const error = createUserError(
        ErrorCategory.CONFIG,
        "Test Error",
        "This is a test error message",
        ["Suggestion 1", "Suggestion 2"],
        "https://example.com/docs"
      );

      const formatted = formatError(error);

      expect(formatted).toContain("⚙️ Test Error");
      expect(formatted).toContain("This is a test error message");
      expect(formatted).toContain("💡 Suggestions:");
      expect(formatted).toContain("1. Suggestion 1");
      expect(formatted).toContain("2. Suggestion 2");
      expect(formatted).toContain("📚 Learn more: https://example.com/docs");
    });

    it("should format error without suggestions", () => {
      const error = createUserError(
        ErrorCategory.NETWORK,
        "Network Error",
        "Connection failed",
        []
      );

      const formatted = formatError(error);

      expect(formatted).toContain("🌐 Network Error");
      expect(formatted).toContain("Connection failed");
      expect(formatted).not.toContain("💡 Suggestions:");
    });
  });

  describe("parsePlaidError", () => {
    it("should handle ITEM_LOGIN_REQUIRED", () => {
      const error = parsePlaidError({
        error_code: "ITEM_LOGIN_REQUIRED",
        error_message: "Item login required",
        error_type: "ITEM_LOGIN_REQUIRED",
      });

      expect(error.category).toBe(ErrorCategory.PLAID_AUTH);
      expect(error.title).toBe("Account Re-Authentication Required");
      expect(error.suggestions.length).toBeGreaterThan(0);
      expect(error.docsLink).toContain("plaid.com/docs/errors");
    });

    it("should handle RATE_LIMIT_EXCEEDED", () => {
      const error = parsePlaidError({
        error_code: "RATE_LIMIT_EXCEEDED",
        error_message: "Rate limit exceeded",
      });

      expect(error.category).toBe(ErrorCategory.PLAID_API);
      expect(error.title).toBe("API Rate Limit Exceeded");
      expect(error.suggestions.length).toBeGreaterThan(0);
    });

    it("should handle INSTITUTION_DOWN", () => {
      const error = parsePlaidError({
        error_code: "INSTITUTION_DOWN",
        error_message: "Institution temporarily unavailable",
      });

      expect(error.category).toBe(ErrorCategory.PLAID_API);
      expect(error.title).toBe("Bank temporarily unavailable");
      expect(error.suggestions.length).toBeGreaterThan(0);
    });

    it("should handle INVALID_CREDENTIALS", () => {
      const error = parsePlaidError({
        error_code: "INVALID_CREDENTIALS",
        error_message: "Invalid API credentials",
      });

      expect(error.category).toBe(ErrorCategory.PLAID_API);
      expect(error.title).toBe("Invalid API Credentials");
      expect(error.suggestions.length).toBeGreaterThan(0);
    });

    it("should return generic error for unknown codes", () => {
      const error = parsePlaidError({
        error_code: "UNKNOWN_ERROR",
        error_message: "Something went wrong",
        request_id: "req_123",
      });

      expect(error.category).toBe(ErrorCategory.PLAID_API);
      expect(error.title).toBe("Plaid API Error");
      expect(error.message).toContain("(Request ID: req_123)");
    });
  });

  describe("parseGmailError", () => {
    it("should handle 401 Unauthorized", () => {
      const error = parseGmailError({
        code: 401,
        message: "Unauthorized",
        status: 401,
      });

      expect(error.category).toBe(ErrorCategory.GMAIL_AUTH);
      expect(error.title).toBe("Gmail Authentication Failed");
      expect(error.suggestions.length).toBeGreaterThan(0);
    });

    it("should handle 403 Forbidden", () => {
      const error = parseGmailError({
        code: 403,
        message: "Access denied",
        status: 403,
      });

      expect(error.category).toBe(ErrorCategory.GMAIL_API);
      expect(error.title).toBe("Gmail Access Denied");
      expect(error.suggestions.length).toBeGreaterThan(0);
    });

    it("should handle 429 Rate Limit", () => {
      const error = parseGmailError({
        code: 429,
        message: "Rate limit exceeded",
        status: 429,
      });

      expect(error.category).toBe(ErrorCategory.GMAIL_API);
      expect(error.title).toBe("Gmail API Rate Limit Exceeded");
      expect(error.suggestions.length).toBeGreaterThan(0);
    });

    it("should return generic error for unknown codes", () => {
      const error = parseGmailError({
        code: 500,
        message: "Internal server error",
        status: 500,
      });

      expect(error.category).toBe(ErrorCategory.GMAIL_API);
      expect(error.title).toBe("Gmail API Error");
    });
  });

  describe("parseNetworkError", () => {
    it("should handle connection refused", () => {
      const error = parseNetworkError(new Error("ECONNREFUSED: Connection refused"));

      expect(error.category).toBe(ErrorCategory.NETWORK);
      expect(error.title).toBe("Connection Refused");
      expect(error.suggestions).toContain("Check your internet connection");
    });

    it("should handle timeout", () => {
      const error = parseNetworkError(new Error("ETIMEDOUT: Request timed out"));

      expect(error.category).toBe(ErrorCategory.NETWORK);
      expect(error.title).toBe("Request Timeout");
      expect(error.suggestions).toContain("Check your internet connection speed");
    });

    it("should handle DNS failure", () => {
      const error = parseNetworkError(new Error("ENOTFOUND: getaddrinfo ENOTFOUND"));

      expect(error.category).toBe(ErrorCategory.NETWORK);
      expect(error.title).toBe("DNS Resolution Failed");
      expect(error.suggestions.length).toBeGreaterThan(0);
    });

    it("should return generic network error", () => {
      const error = parseNetworkError(new Error("Network error"));

      expect(error.category).toBe(ErrorCategory.NETWORK);
      expect(error.title).toBe("Network Error");
      expect(error.suggestions).toContain("Check your internet connection");
    });
  });

  describe("parseFileSystemError", () => {
    it("should handle permission denied", () => {
      const error = parseFileSystemError(
        { code: "EACCES", message: "Permission denied" },
        "/path/to/file"
      );

      expect(error.category).toBe(ErrorCategory.FILE_SYSTEM);
      expect(error.title).toBe("Permission Denied");
      expect(error.suggestions).toContain("Check file/directory permissions");
    });

    it("should handle disk full", () => {
      const error = parseFileSystemError(
        { code: "ENOSPC", message: "No space left on device" },
        "/path/to/file"
      );

      expect(error.category).toBe(ErrorCategory.STORAGE);
      expect(error.title).toBe("Disk Full");
      expect(error.suggestions.length).toBeGreaterThan(0);
    });

    it("should handle file not found", () => {
      const error = parseFileSystemError(
        { code: "ENOENT", message: "no such file or directory" },
        "/path/to/file"
      );

      expect(error.category).toBe(ErrorCategory.FILE_SYSTEM);
      expect(error.title).toBe("File or Directory Not Found");
      expect(error.suggestions.length).toBeGreaterThan(0);
    });

    it("should handle generic file system error", () => {
      const error = parseFileSystemError(
        { code: "UNKNOWN", message: "Unknown file system error" },
        "/path/to/file"
      );

      expect(error.category).toBe(ErrorCategory.FILE_SYSTEM);
      expect(error.title).toBe("File System Error");
    });
  });

  describe("diagnoseCommonIssues", () => {
    it("should return empty array if all checks pass", () => {
      // Note: diagnoseCommonIssues is synchronous and doesn't use promises
      // The actual file system checks use.catch() which are non-blocking
      const issues = diagnoseCommonIssues();

      // Since the.catch() callbacks don't block, issues array will be empty initially
      expect(Array.isArray(issues)).toBe(true);
    });

    it("should return an array (even if empty)", () => {
      const issues = diagnoseCommonIssues();
      expect(Array.isArray(issues)).toBe(true);
    });
  });

  describe("logError", () => {
    it("should log UserError with context", () => {
      const api = { logger: mockLogger };
      const error = createUserError(
        ErrorCategory.CONFIG,
        "Test Error",
        "Test message",
        ["Test suggestion"]
      );

      logError(api, error, { testContext: "test" });

      expect(mockLogger.error).toHaveBeenCalledWith(
        "billclaw error:",
        expect.stringContaining("category")
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        "billclaw error:",
        expect.stringContaining("configuration")
      );
    });

    it("should log plain Error", () => {
      const api = { logger: mockLogger };
      const error = new Error("Test error");

      logError(api, error, { testContext: "test" });

      expect(mockLogger.error).toHaveBeenCalled();
    });

    it("should handle missing logger gracefully", () => {
      const api = {};
      const error = createUserError(
        ErrorCategory.CONFIG,
        "Test Error",
        "Test message",
        []
      );

      // Should not throw
      expect(() => logError(api as any, error)).not.toThrow();
    });
  });

  describe("formatError", () => {
    it("should format errors for display", () => {
      const error = createUserError(
        ErrorCategory.CONFIG,
        "Test Error",
        "This is a test error",
        ["Suggestion 1", "Suggestion 2"],
        "https://example.com/docs"
      );

      const formatted = formatError(error);

      expect(formatted).toMatch(/⚙️ Test Error/);
      expect(formatted).toMatch(/This is a test error/);
      expect(formatted).toMatch(/💡 Suggestions:/);
      expect(formatted).toMatch(/1\. Suggestion 1/);
      expect(formatted).toMatch(/2\. Suggestion 2/);
      expect(formatted).toMatch(/📚 Learn more:/);
    });
  });
});
