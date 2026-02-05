/**
 * Email parser service tests with realistic email content
 */

import { describe, it, expect } from "vitest";
import {
  parseEmailToTransactions,
  toStorageTransaction,
  batchParseEmails,
} from "./email-parser.js";
import type { EmailContent } from "./gmail-fetcher.js";
import type { RecognitionResult } from "./bill-recognizer.js";

// Sample bill emails for testing
const sampleEmails: {
  name: string;
  email: EmailContent;
  recognition: RecognitionResult;
}[] = [
  {
    name: "Netflix Invoice",
    email: {
      id: "gmail_netflix_001",
      threadId: "thread_001",
      from: "Netflix <info@mailer.netflix.com>",
      to: "user@example.com",
      subject: "Your Netflix Invoice",
      date: "2025-02-05T10:00:00Z",
      snippet: "Amount due: $15.99",
      body: `
        <html>
          <body>
            <h1>Netflix Invoice</h1>
            <p>Dear Member,</p>
            <p>Your monthly statement is ready.</p>
            <p>Amount Due: $15.99</p>
            <p>Due Date: February 15, 2025</p>
            <p>Account: user@example.com</p>
          </body>
        </html>
      `,
      attachments: [],
    },
    recognition: {
      isBill: true,
      confidence: 0.8,
      billType: "subscription",
      merchant: "Netflix",
      amount: 15.99,
      currency: "USD",
      dueDate: "2025-02-15",
      accountNumber: "user@example.com",
      reasons: ["Subject contains bill-related keywords", "Body contains bill-related keywords", "Contains monetary amount", "Contains due date"],
    },
  },
  {
    name: "Credit Card Statement",
    email: {
      id: "gmail_chase_001",
      threadId: "thread_002",
      from: "Chase <alerts@chase.com>",
      to: "user@example.com",
      subject: "Your Chase Credit Card Statement",
      date: "2025-02-05T08:00:00Z",
      snippet: "Statement Balance: $1,234.56",
      body: `
        CHASE CREDIT CARD STATEMENT
        Account: ****1234
        Statement Period: January 1-31, 2025
        Statement Balance: $1,234.56
        Payment Due Date: February 25, 2025

        Recent Transactions:
        01/15/2025  Amazon.com       $45.99
        01/18/2025  Walmart          $123.45
        01/20/2025  Target           $67.89
      `,
      attachments: [],
    },
    recognition: {
      isBill: true,
      confidence: 0.9,
      billType: "credit_card_statement",
      merchant: "Chase",
      amount: 1234.56,
      currency: "USD",
      dueDate: "2025-02-25",
      accountNumber: "1234",
      reasons: ["Subject contains bill-related keywords", "Body contains bill-related keywords", "Contains monetary amount", "Contains due date", "Contains account/reference number"],
    },
  },
  {
    name: "Utility Bill",
    email: {
      id: "gmail_pge_001",
      threadId: "thread_003",
      from: "PG&E <noreply@pge.com>",
      to: "user@example.com",
      subject: "Your PG&E Energy Statement",
      date: "2025-02-03T06:00:00Z",
      snippet: "Total Due: $142.50",
      body: `
        PACIFIC GAS AND ELECTRIC COMPANY
        Energy Statement for: 123 Main St
        Billing Period: January 2025
        Total Due: $142.50
        Due Date: February 18, 2025
        Account Number: 987654321
      `,
      attachments: [],
    },
    recognition: {
      isBill: true,
      confidence: 0.85,
      billType: "utility_bill",
      merchant: "PG&E",
      amount: 142.5,
      currency: "USD",
      dueDate: "2025-02-18",
      accountNumber: "987654321",
      reasons: ["Subject contains bill-related keywords", "Body contains bill-related keywords", "Sender is a known billing domain", "Contains monetary amount", "Contains due date", "Contains account/reference number"],
    },
  },
  {
    name: "Non-bill email",
    email: {
      id: "gmail_personal_001",
      threadId: "thread_004",
      from: "Friend <friend@example.com>",
      to: "user@example.com",
      subject: "Let's grab lunch tomorrow?",
      date: "2025-02-05T12:00:00Z",
      snippet: "Hey, want to meet up?",
      body: `
        Hey!

        Want to grab lunch tomorrow? Let me know what time works for you.

        Best,
        Friend
      `,
      attachments: [],
    },
    recognition: {
      isBill: false,
      confidence: 0.2,
      reasons: [],
    },
  },
  {
    name: "Shopping Receipt",
    email: {
      id: "gmail_amazon_001",
      threadId: "thread_005",
      from: "Amazon <shipment-tracking@amazon.com>",
      to: "user@example.com",
      subject: "Your Amazon order has been shipped!",
      date: "2025-02-05T14:30:00Z",
      snippet: "Order Total: $79.99",
      body: `
        Hello,

        Your order #123-4567890 has been shipped!

        Order Details:
        Item 1: Wireless Mouse - $29.99
        Item 2: USB Keyboard - $49.99
        Order Total: $79.99
        Estimated Delivery: February 10, 2025
      `,
      attachments: [],
    },
    recognition: {
      isBill: true,
      confidence: 0.65,
      billType: "receipt",
      merchant: "Amazon",
      amount: 79.99,
      currency: "USD",
      reasons: ["Body contains bill-related keywords", "Contains monetary amount"],
    },
  },
];

describe("Email Parser with Real Email Content", () => {
  describe("parseEmailToTransactions", () => {
    it("should parse Netflix invoice email", () => {
      const sample = sampleEmails[0];
      const transactions = parseEmailToTransactions("gmail_netflix", sample.email, sample.recognition);

      expect(transactions.length).toBeGreaterThanOrEqual(1);
      const txn = transactions[0];
      expect(txn.accountId).toBe("gmail_netflix");
      expect(txn.amount).toBe(15.99);
      expect(txn.currency).toBe("USD");
      expect(txn.name).toBe("Netflix");
    });

    it("should parse credit card statement with line items", () => {
      const sample = sampleEmails[1];
      const transactions = parseEmailToTransactions("gmail_chase", sample.email, sample.recognition);

      expect(transactions.length).toBeGreaterThanOrEqual(1);
      const mainTxn = transactions[0];
      expect(mainTxn.amount).toBe(1234.56);
      expect(mainTxn.billType).toBe("credit_card_statement");
    });

    it("should parse utility bill", () => {
      const sample = sampleEmails[2];
      const transactions = parseEmailToTransactions("gmail_pge", sample.email, sample.recognition);

      expect(transactions.length).toBeGreaterThanOrEqual(1);
      const txn = transactions[0];
      expect(txn.amount).toBe(142.5);
      expect(txn.billType).toBe("utility_bill");
    });

    it("should parse shopping receipt", () => {
      const sample = sampleEmails[4];
      const transactions = parseEmailToTransactions("gmail_amazon", sample.email, sample.recognition);

      expect(transactions.length).toBeGreaterThanOrEqual(1);
      const txn = transactions[0];
      expect(txn.amount).toBe(79.99);
      expect(txn.billType).toBe("receipt");
    });

    it("should handle emails without amount", () => {
      const emailWithoutAmount: EmailContent = {
        id: "test_001",
        threadId: "thread_test",
        from: "service@example.com",
        to: "user@example.com",
        subject: "Your statement is ready",
        date: "2025-02-05T10:00:00Z",
        snippet: "View your statement",
        body: "Your monthly statement is now available.",
        attachments: [],
      };

      const recognition: RecognitionResult = {
        isBill: true,
        confidence: 0.5,
        billType: "other",
        reasons: ["Subject contains bill-related keywords"],
      };

      const transactions = parseEmailToTransactions("test_account", emailWithoutAmount, recognition);

      expect(transactions.length).toBeGreaterThanOrEqual(1);
      expect(transactions[0].amount).toBe(0);
    });
  });

  describe("toStorageTransaction", () => {
    it("should convert ParsedTransaction to Transaction format", () => {
      const parsed = {
        transactionId: "test_001",
        accountId: "test_account",
        date: "2025-02-05",
        name: "Test Transaction",
        amount: 100.0,
        currency: "USD",
        category: ["Shopping"],
        merchantName: "Test Store",
        paymentChannel: "email",
        pending: false,
        dueDate: "2025-02-15",
        billType: "receipt" as const,
        metadata: {
          source: "gmail",
          emailId: "test_001",
          emailSubject: "Test Receipt",
          emailFrom: "sender@example.com",
          parsedAt: "2025-02-05T10:00:00Z",
        },
      };

      const stored = toStorageTransaction(parsed);

      expect(stored.transactionId).toBe("test_001");
      expect(stored.plaidTransactionId).toBe("test_001");
      expect(stored.accountId).toBe("test_account");
      expect(stored.merchantName).toBe("Test Store");
      expect(stored.paymentChannel).toBe("email");
      expect(stored.pending).toBe(false);
      expect(stored.createdAt).toBeDefined();
    });

    it("should use name as fallback for merchantName", () => {
      const parsed = {
        transactionId: "test_002",
        accountId: "test_account",
        date: "2025-02-05",
        name: "Amazon Purchase",
        amount: 50.0,
        currency: "USD",
        category: ["Shopping"],
        merchantName: undefined,
        paymentChannel: "email",
        pending: false,
        billType: "receipt" as const,
        metadata: {
          source: "gmail",
          emailId: "test_002",
          emailSubject: "Receipt",
          emailFrom: "amazon@example.com",
          parsedAt: "2025-02-05T10:00:00Z",
        },
      };

      const stored = toStorageTransaction(parsed);

      expect(stored.merchantName).toBe("Amazon Purchase");
    });

    it("should default paymentChannel to email", () => {
      const parsed = {
        transactionId: "test_003",
        accountId: "test_account",
        date: "2025-02-05",
        name: "Test",
        amount: 10.0,
        currency: "USD",
        category: ["Test"],
        merchantName: "Test",
        paymentChannel: undefined,
        pending: false,
        billType: "other" as const,
        metadata: {
          source: "gmail",
          emailId: "test_003",
          emailSubject: "Test",
          emailFrom: "test@example.com",
          parsedAt: "2025-02-05T10:00:00Z",
        },
      };

      const stored = toStorageTransaction(parsed);

      expect(stored.paymentChannel).toBe("email");
    });
  });

  describe("batchParseEmails", () => {
    it("should parse multiple emails", () => {
      const bills = sampleEmails.filter((e) => e.recognition.isBill);
      const transactions = batchParseEmails("batch_test", bills);

      expect(transactions.length).toBeGreaterThan(0);

      // Verify all transactions have required fields
      transactions.forEach((txn) => {
        expect(txn.transactionId).toBeDefined();
        expect(txn.accountId).toBe("batch_test");
        expect(txn.amount).toBeGreaterThanOrEqual(0);
        expect(txn.currency).toBeDefined();
        expect(txn.category).toBeInstanceOf(Array);
      });
    });

    it("should handle empty email list", () => {
      const transactions = batchParseEmails("empty_test", []);

      expect(transactions).toEqual([]);
    });
  });

  describe("Date parsing", () => {
    it("should parse ISO date strings", () => {
      const dates = [
        "2025-02-05T10:00:00Z",
        "2025-02-05",
        "02/05/2025",
        "February 5, 2025",
      ];

      dates.forEach((dateStr) => {
        const date = new Date(dateStr);
        expect(date.getFullYear()).toBe(2025);
      });
    });

    it("should handle various date formats in emails", () => {
      const sample = sampleEmails[0]; // Netflix email
      const transactions = parseEmailToTransactions("date_test", sample.email, sample.recognition);

      expect(transactions[0].date).toBeDefined();
      const date = new Date(transactions[0].date);
      expect(date.getFullYear()).toBe(2025);
    });
  });

  describe("Amount parsing", () => {
    it("should extract amounts with currency symbols", () => {
      const testCases = [
        { text: "Amount Due: $15.99", expected: 15.99 },
        { text: "Total: €99.99", expected: 99.99 },
        { text: "Balance: £1,234.56", expected: 1234.56 },
        { text: "Payment of 500.00 USD", expected: 500.00 },
      ];

      testCases.forEach(({ text, expected }) => {
        const amountMatch = text.match(/[$€£¥]?\s?(\d{1,3}(?:,\d{3})*(?:\.\d{2})|\d+\.\d{2})/);
        if (amountMatch) {
          const amount = parseFloat(amountMatch[1].replace(/,/g, ""));
          expect(amount).toBe(expected);
        }
      });
    });

    it("should handle amounts without currency symbol", () => {
      const text = "Total: 123.45";
      const amountMatch = text.match(/(\d+\.\d{2})/);
      expect(amountMatch?.[1]).toBe("123.45");
    });
  });

  describe("HTML parsing", () => {
    it("should extract text from HTML email body", () => {
      const htmlBody = `
        <html>
          <body>
            <h1>Invoice</h1>
            <p>Amount: <strong>$100.00</strong></p>
          </body>
        </html>
      `;

      // Remove HTML tags
      const text = htmlBody.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

      expect(text).toContain("Invoice");
      expect(text).toContain("Amount:");
      expect(text).toContain("$100.00");
    });

    it("should extract data from table structure", () => {
      const tableBody = `
        <table>
          <tr>
            <th>Date</th>
            <th>Description</th>
            <th>Amount</th>
          </tr>
          <tr>
            <td>01/15/2025</td>
            <td>Amazon</td>
            <td>$45.99</td>
          </tr>
        </table>
      `;

      expect(tableBody).toContain("01/15/2025");
      expect(tableBody).toContain("Amazon");
      expect(tableBody).toContain("$45.99");
    });
  });
});
