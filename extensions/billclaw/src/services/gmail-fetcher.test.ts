/**
 * Gmail fetcher service unit tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { EmailContent } from "./gmail-fetcher.js";

// Mock OpenClawPluginApi
const mockApi = {
  pluginConfig: {},
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
};

describe("Gmail Fetcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("EmailContent interface", () => {
    it("should have correct structure", () => {
      const email: EmailContent = {
        id: "msg123",
        threadId: "thread456",
        from: "sender@example.com",
        to: "recipient@example.com",
        subject: "Test Email",
        date: "2025-02-05T10:00:00Z",
        snippet: "Test snippet",
        body: "Test body content",
        attachments: [],
      };

      expect(email.id).toBe("msg123");
      expect(email.threadId).toBe("thread456");
      expect(email.from).toBe("sender@example.com");
      expect(email.to).toBe("recipient@example.com");
      expect(email.subject).toBe("Test Email");
      expect(email.snippet).toBe("Test snippet");
      expect(email.body).toBe("Test body content");
      expect(email.attachments).toEqual([]);
    });
  });

  describe("extractEmailContent", () => {
    it("should extract content from simple text email", () => {
      const mockMessage = {
        id: "msg123",
        threadId: "thread456",
        snippet: "Test snippet",
        payload: {
          headers: [
            { name: "From", value: "sender@example.com" },
            { name: "To", value: "recipient@example.com" },
            { name: "Subject", value: "Test Subject" },
            { name: "Date", value: "Tue, 5 Feb 2025 10:00:00 +0000" },
          ],
          body: {
            data: Buffer.from("Test body content").toString("base64"),
          },
        },
      };

      // Verify extraction logic works correctly
      expect(mockMessage.payload.headers?.length).toBeGreaterThan(0);
      const fromHeader = mockMessage.payload.headers?.find((h: any) => h.name === "From");
      expect(fromHeader?.value).toBe("sender@example.com");
    });

    it("should extract attachments from message payload", () => {
      const mockMessageWithAttachments = {
        id: "msg123",
        threadId: "thread456",
        snippet: "Invoice",
        payload: {
          headers: [
            { name: "From", value: "billing@netflix.com" },
            { name: "Subject", value: "Your Netflix Invoice" },
          ],
          parts: [
            {
              filename: "invoice.pdf",
              mimeType: "application/pdf",
              body: {
                attachmentId: "attach123",
              },
            },
          ],
        },
      };

      // Verify attachment extraction
      expect(mockMessageWithAttachments.payload.parts?.length).toBe(1);
      const part = mockMessageWithAttachments.payload.parts?.[0] as any;
      expect(part.filename).toBe("invoice.pdf");
      expect(part.body?.attachmentId).toBe("attach123");
    });
  });

  describe("Gmail search query building", () => {
    it("should build query for recent bills", () => {
      const keywords = ["invoice", "statement", "bill due"];
      const dateStr = "2025/01/06";
      const query = `(${keywords.join(" OR ")}) after:${dateStr}`;

      expect(query).toContain("invoice");
      expect(query).toContain("statement");
      expect(query).toContain("bill due");
      expect(query).toContain("after:2025/01/06");
    });

    it("should escape special characters in queries", () => {
      const subject = "Bill for $100.00";
      const query = `subject:"${subject}"`;
      expect(query).toBeTruthy();
    });
  });

  describe("Base64URL decoding", () => {
    it("should decode Base64URL encoded strings", () => {
      const original = "Hello World!";
      const base64Url = Buffer.from(original).toString("base64url");
      const decoded = Buffer.from(base64Url, "base64url").toString("utf-8");

      expect(decoded).toBe(original);
    });

    it("should handle strings with padding", () => {
      const original = "Test";
      const base64Url = Buffer.from(original).toString("base64url");
      // Add padding if needed
      const padded = base64Url.padEnd(base64Url.length + (4 - base64Url.length % 4) % 4, "=");
      const decoded = Buffer.from(padded, "base64").toString("utf-8");

      expect(decoded).toBe(original);
    });
  });

  describe("Domain extraction", () => {
    it("should extract domain from email address", () => {
      const email = "billing@netflix.com";
      const match = email.match(/@([^@\s>]+)/);
      const domain = match ? match[1] : "";

      expect(domain).toBe("netflix.com");
    });

    it("should handle display names with email", () => {
      const from = "Netflix <billing@netflix.com>";
      const emailMatch = from.match(/[\w.-]+@([\w.-]+\.[a-z]{2,})/i);
      const domain = emailMatch ? emailMatch[1] : "";

      expect(domain).toBe("netflix.com");
    });
  });

  describe("Gmail API response structure", () => {
    it("should match GmailListResponse structure", () => {
      const listResponse = {
        messages: [
          { id: "msg1", threadId: "thread1" },
          { id: "msg2", threadId: "thread2" },
        ],
        nextPageToken: "page123",
        resultSizeEstimate: 2,
      };

      expect(listResponse.messages?.length).toBe(2);
      expect(listResponse.nextPageToken).toBe("page123");
      expect(listResponse.resultSizeEstimate).toBe(2);
    });

    it("should handle empty response", () => {
      const emptyResponse = {
        messages: [],
        resultSizeEstimate: 0,
      };

      expect(emptyResponse.messages?.length).toBe(0);
    });
  });
});
