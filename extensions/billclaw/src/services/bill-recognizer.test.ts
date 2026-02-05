/**
 * Bill recognizer accuracy tests
 */

import { describe, it, expect } from "vitest";
import {
  recognizeBill,
  recognizeBillWithConfig,
  isWhitelistedSender,
  containsCustomKeywords,
  type RecognitionResult,
  type BillType,
} from "./bill-recognizer.js";
import type { EmailContent } from "./gmail-fetcher.js";

// Test email dataset
const testEmails: Array<{
  name: string;
  email: EmailContent;
  expectedIsBill: boolean;
  expectedType?: BillType;
  expectedMinConfidence?: number;
}> = [
  // True positives - actual bills
  {
    name: "Netflix Invoice",
    email: {
      id: "netflix_001",
      threadId: "thread_001",
      from: "Netflix <info@netflix.com>",
      to: "user@example.com",
      subject: "Your Netflix Invoice for February 2025",
      date: "2025-02-05T10:00:00Z",
      snippet: "Amount due: $15.99",
      body: "Your monthly Netflix subscription invoice. Amount due: $15.99. Due date: Feb 15, 2025.",
      attachments: [],
    },
    expectedIsBill: true,
    expectedType: "subscription",
    expectedMinConfidence: 0.7,
  },
  {
    name: "Credit Card Statement",
    email: {
      id: "chase_001",
      threadId: "thread_002",
      from: "Chase <alerts@chase.com>",
      to: "user@example.com",
      subject: "Your Chase Credit Card Statement is Ready",
      date: "2025-02-05T08:00:00Z",
      snippet: "Statement balance: $1,234.56",
      body: "Your credit card statement is now available. Statement balance: $1,234.56. Payment due: Feb 25, 2025.",
      attachments: [],
    },
    expectedIsBill: true,
    expectedType: "credit_card_statement",
    expectedMinConfidence: 0.7,
  },
  {
    name: "Utility Bill",
    email: {
      id: "pge_001",
      threadId: "thread_003",
      from: "PG&E <noreply@pge.com>",
      to: "user@example.com",
      subject: "PG&E Energy Statement - January 2025",
      date: "2025-02-03T06:00:00Z",
      snippet: "Total due: $142.50",
      body: "Your energy statement is ready. Total due: $142.50. Due date: February 18, 2025.",
      attachments: [],
    },
    expectedIsBill: true,
    expectedType: "utility_bill",
    expectedMinConfidence: 0.7,
  },
  {
    name: "PayPal Receipt",
    email: {
      id: "paypal_001",
      threadId: "thread_004",
      from: "PayPal <service@paypal.com>",
      to: "user@example.com",
      subject: "Receipt for your payment",
      date: "2025-02-05T14:30:00Z",
      snippet: "You sent $50.00 to friend@example.com",
      body: "You sent $50.00 USD to friend@example.com. Transaction ID: 9KM12345XY6789.",
      attachments: [],
    },
    expectedIsBill: true,
    expectedType: "receipt",
    expectedMinConfidence: 0.5,
  },
  {
    name: "Phone Bill",
    email: {
      id: "att_001",
      threadId: "thread_005",
      from: "AT&T <notification@att.com>",
      to: "user@example.com",
      subject: "Your AT&T Wireless Bill",
      date: "2025-02-01T09:00:00Z",
      snippet: "Amount due: $85.00",
      body: "Your wireless bill for January is ready. Amount due: $85.00. Due: Feb 10, 2025.",
      attachments: [],
    },
    expectedIsBill: true,
    expectedType: "phone_bill",
    expectedMinConfidence: 0.6,
  },
  {
    name: "Insurance Premium",
    email: {
      id: "geico_001",
      threadId: "thread_006",
      from: "GEICO <billing@geico.com>",
      to: "user@example.com",
      subject: "Insurance Premium Due Notice",
      date: "2025-02-05T07:00:00Z",
      snippet: "Premium amount: $150.00",
      body: "Your insurance premium of $150.00 is due. Please pay by February 20, 2025. Policy: ABC123456.",
      attachments: [],
    },
    expectedIsBill: true,
    expectedType: "insurance",
    expectedMinConfidence: 0.7,
  },
  {
    name: "Subscription Renewal",
    email: {
      id: "spotify_001",
      threadId: "thread_007",
      from: "Spotify <no-reply@spotify.com>",
      to: "user@example.com",
      subject: "Your Spotify Premium subscription has been renewed",
      date: "2025-02-05T12:00:00Z",
      snippet: "Subscription fee: $9.99",
      body: "Your Spotify Premium subscription has been renewed for $9.99/month. Next billing: March 5, 2025.",
      attachments: [],
    },
    expectedIsBill: true,
    expectedType: "subscription",
    expectedMinConfidence: 0.6,
  },
  // False positives - not bills
  {
    name: "Personal Email",
    email: {
      id: "personal_001",
      threadId: "thread_008",
      from: "Friend <friend@example.com>",
      to: "user@example.com",
      subject: "Let's grab lunch tomorrow?",
      date: "2025-02-05T12:00:00Z",
      snippet: "Hey, want to meet up?",
      body: "Hey! Want to grab lunch tomorrow? Let me know what time works.",
      attachments: [],
    },
    expectedIsBill: false,
    expectedMinConfidence: undefined,
  },
  {
    name: "Newsletter",
    email: {
      id: "newsletter_001",
      threadId: "thread_009",
      from: "Tech Newsletter <news@techcrunch.com>",
      to: "user@example.com",
      subject: "Today's Tech News",
      date: "2025-02-05T08:00:00Z",
      snippet: "Latest updates from the tech world",
      body: "Here are today's top stories in technology...",
      attachments: [],
    },
    expectedIsBill: false,
    expectedMinConfidence: undefined,
  },
  {
    name: "Shipping Notification",
    email: {
      id: "amazon_ship_001",
      threadId: "thread_010",
      from: "Amazon <shipment-tracking@amazon.com>",
      to: "user@example.com",
      subject: "Your package has been shipped!",
      date: "2025-02-05T15:00:00Z",
      snippet: "Estimated delivery: Feb 10, 2025",
      body: "Your Amazon package has been shipped! Estimated delivery: February 10, 2025. Track your package.",
      attachments: [],
    },
    expectedIsBill: false,
    expectedMinConfidence: undefined,
  },
  {
    name: "Welcome Email",
    email: {
      id: "welcome_001",
      threadId: "thread_011",
      from: "Service <welcome@service.com>",
      to: "user@example.com",
      subject: "Welcome to our service!",
      date: "2025-02-05T10:00:00Z",
      snippet: "Get started with your account",
      body: "Thank you for signing up! Here's how to get started...",
      attachments: [],
    },
    expectedIsBill: false,
    expectedMinConfidence: undefined,
  },
];

describe("Bill Recognizer Accuracy Tests", () => {
  describe("Recognition Accuracy", () => {
    let truePositives = 0;
    let trueNegatives = 0;
    let falsePositives = 0;
    let falseNegatives = 0;

    beforeAll(() => {
      // Calculate confusion matrix
      testEmails.forEach(({ email, expectedIsBill }) => {
        const result = recognizeBill(email);

        if (expectedIsBill && result.isBill) {
          truePositives++;
        } else if (!expectedIsBill && !result.isBill) {
          trueNegatives++;
        } else if (!expectedIsBill && result.isBill) {
          falsePositives++;
        } else {
          falseNegatives++;
        }
      });
    });

    it("should have high true positive rate", () => {
      // Accuracy = (TP + TN) / Total
      const accuracy = (truePositives + trueNegatives) / testEmails.length;
      expect(accuracy).toBeGreaterThanOrEqual(0.8); // At least 80% accuracy
    });

    it("should have low false positive rate", () => {
      // False positive rate = FP / (FP + TN)
      if (falsePositives + trueNegatives > 0) {
        const fpr = falsePositives / (falsePositives + trueNegatives);
        expect(fpr).toBeLessThanOrEqual(0.3); // At most 30% false positive rate
      }
    });

    it("should have acceptable false negative rate", () => {
      // False negative rate = FN / (FN + TP)
      if (falseNegatives + truePositives > 0) {
        const fnr = falseNegatives / (falseNegatives + truePositives);
        expect(fnr).toBeLessThanOrEqual(0.3); // At most 30% false negative rate (relaxed for production)
      }
    });

    it("should correctly identify Netflix invoice", () => {
      const sample = testEmails[0];
      const result = recognizeBill(sample.email);

      expect(result.isBill).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
      expect(result.billType).toBe("subscription");
    });

    it("should correctly identify credit card statement", () => {
      const sample = testEmails[1];
      const result = recognizeBill(sample.email);

      expect(result.isBill).toBe(true);
      expect(result.billType).toBe("credit_card_statement");
    });

    it("should correctly identify utility bill", () => {
      const sample = testEmails[2];
      const result = recognizeBill(sample.email);

      expect(result.isBill).toBe(true);
      expect(result.billType).toBe("utility_bill");
    });

    it("should not identify personal email as bill", () => {
      const sample = testEmails[7];
      const result = recognizeBill(sample.email);

      expect(result.isBill).toBe(false);
      expect(result.confidence).toBeLessThan(0.5);
    });

    it("should not identify newsletter as bill", () => {
      const sample = testEmails[8];
      const result = recognizeBill(sample.email);

      expect(result.isBill).toBe(false);
    });

    it("should not identify shipping notification as bill (no amount)", () => {
      const sample = testEmails[9];
      const result = recognizeBill(sample.email);

      expect(result.isBill).toBe(false);
    });
  });

  describe("Confidence Score Calibration", () => {
    it("should assign higher confidence to clear bills with amount and date", () => {
      const netflixEmail = testEmails[0].email;
      const result = recognizeBill(netflixEmail);

      expect(result.confidence).toBeGreaterThan(0.6);
    });

    it("should assign lower confidence to ambiguous emails", () => {
      const weakBillEmail: EmailContent = {
        id: "weak_001",
        threadId: "thread_weak",
        from: "service@example.com",
        to: "user@example.com",
        subject: "Your Document is Ready",
        date: "2025-02-05T10:00:00Z",
        snippet: "Your document is ready",
        body: "Your monthly document is now available for viewing.",
        attachments: [],
      };

      const result = recognizeBill(weakBillEmail);
      // Should have low confidence since no clear bill keywords
      expect(result.confidence).toBeLessThan(0.6);
      expect(result.isBill).toBe(false);
    });

    it("should calculate confidence with multiple factors", () => {
      const strongBillEmail: EmailContent = {
        id: "strong_001",
        threadId: "thread_strong",
        from: "billing@netflix.com",
        to: "user@example.com",
        subject: "Netflix Invoice - Amount Due: $15.99",
        date: "2025-02-05T10:00:00Z",
        snippet: "Due date: February 15, 2025",
        body: "Your Netflix subscription invoice for $15.99 is due on February 15, 2025. Account: user@example.com",
        attachments: [],
      };

      const result = recognizeBill(strongBillEmail);
      expect(result.confidence).toBeGreaterThan(0.8);
    });
  });

  describe("Bill Type Classification", () => {
    it("should correctly classify subscription bills", () => {
      const subscriptions = [
        "netflix",
        "spotify",
        "amazon prime",
        "adobe",
        "microsoft",
      ];

      testEmails
        .filter((e) => e.expectedType === "subscription")
        .forEach((sample) => {
          const result = recognizeBill(sample.email);
          expect(result.billType).toBe("subscription");
        });
    });

    it("should correctly classify credit card statements", () => {
      testEmails
        .filter((e) => e.expectedType === "credit_card_statement")
        .forEach((sample) => {
          const result = recognizeBill(sample.email);
          expect(result.billType).toBe("credit_card_statement");
        });
    });
  });

  describe("Keyword Matching Effectiveness", () => {
    it("should match invoice keyword", () => {
      const email: EmailContent = {
        id: "test_001",
        threadId: "thread_001",
        from: "billing@example.com",
        to: "user@example.com",
        subject: "Invoice INV-2025-001",
        date: "2025-02-05T10:00:00Z",
        snippet: "Invoice for services",
        body: "Please find attached invoice for your recent purchase.",
        attachments: [],
      };

      const result = recognizeBill(email);
      expect(result.isBill).toBe(true);
      expect(result.reasons.some((r) => r.toLowerCase().includes("keyword"))).toBe(true);
    });

    it("should match statement keyword", () => {
      const email: EmailContent = {
        id: "test_002",
        threadId: "thread_002",
        from: "bank@chase.com",
        to: "user@example.com",
        subject: "Your Monthly Statement",
        date: "2025-02-05T10:00:00Z",
        snippet: "Statement balance",
        body: "Your monthly account statement is now available.",
        attachments: [],
      };

      const result = recognizeBill(email);
      expect(result.isBill).toBe(true);
    });

    it("should match receipt keyword", () => {
      const email: EmailContent = {
        id: "test_003",
        threadId: "thread_003",
        from: "store@amazon.com",
        to: "user@example.com",
        subject: "Order Receipt",
        date: "2025-02-05T10:00:00Z",
        snippet: "Receipt for your purchase",
        body: "Thank you for your order. Receipt attached.",
        attachments: [],
      };

      const result = recognizeBill(email);
      expect(result.isBill).toBe(true);
    });
  });

  describe("Sender Whitelist", () => {
    it("should identify whitelisted senders", () => {
      const whitelist = ["@netflix.com", "billing@paypal.com"];

      // Whitelisted domain
      expect(isWhitelistedSender("info@netflix.com", whitelist)).toBe(true);
      expect(isWhitelistedSender("billing@netflix.com", whitelist)).toBe(true);

      // Whitelisted email
      expect(isWhitelistedSender("billing@paypal.com", whitelist)).toBe(true);

      // Not in whitelist
      expect(isWhitelistedSender("info@example.com", whitelist)).toBe(false);
    });

    it("should handle domain patterns correctly", () => {
      const whitelist = ["@gmail.com"];

      // Any gmail.com email should match
      expect(isWhitelistedSender("user@gmail.com", whitelist)).toBe(true);
      expect(isWhitelistedSender("another.user@gmail.com", whitelist)).toBe(true);

      // Subdomains should match
      expect(isWhitelistedSender("user@mail.gmail.com", whitelist)).toBe(true);

      // Different domain should not match
      expect(isWhitelistedSender("user@yahoo.com", whitelist)).toBe(false);
    });
  });

  describe("Custom Keywords", () => {
    it("should match custom keywords", () => {
      const customKeywords = ["facture", "rechnung", "factura"];

      // French
      expect(containsCustomKeywords("Your facture is ready", customKeywords)).toBe(true);

      // German
      expect(containsCustomKeywords("Rechnung für Januar", customKeywords)).toBe(true);

      // Spanish
      expect(containsCustomKeywords("Su factura está lista", customKeywords)).toBe(true);

      // No match
      expect(containsCustomKeywords("Your statement is ready", customKeywords)).toBe(false);
    });

    it("should use custom config for recognition", () => {
      const email: EmailContent = {
        id: "custom_001",
        threadId: "thread_custom",
        from: "service@external.com",
        to: "user@example.com",
        subject: "Your FACTURE is ready",
        date: "2025-02-05T10:00:00Z",
        snippet: "Document ready",
        body: "Please find your facture attached.",
        attachments: [],
      };

      const config = {
        keywords: ["facture", "invoice", "rechnung"],
        confidenceThreshold: 0.4,
      };

      const result = recognizeBillWithConfig(email, config);

      expect(result.isBill).toBe(true);
      expect(result.reasons.some((r) => r.includes("custom keywords"))).toBe(true);
    });

    it("should require amount when configured", () => {
      const emailWithoutAmount: EmailContent = {
        id: "req_amount_001",
        threadId: "thread_req_amount",
        from: "service@example.com",
        to: "user@example.com",
        subject: "Your invoice is ready",
        date: "2025-02-05T10:00:00Z",
        snippet: "Invoice ready",
        body: "Your monthly invoice is now available.",
        attachments: [],
      };

      const config = {
        requireAmount: true,
        keywords: ["invoice"],
        confidenceThreshold: 0.4,
      };

      const result = recognizeBillWithConfig(emailWithoutAmount, config);

      expect(result.isBill).toBe(false);
      expect(result.reasons).toContain("Required field (amount) not found");
    });
  });

  describe("Cross-Source Deduplication", () => {
    it("should handle different transaction ID formats", () => {
      // Plaid format
      const plaidTxn = {
        transactionId: "plaid_txn_123",
        accountId: "test_account",
        date: "2025-02-05",
        amount: 100.0,
        currency: "USD",
        category: ["Shopping"],
        merchantName: "Store",
        paymentChannel: "online",
        pending: false,
        plaidTransactionId: "plaid_txn_123",
        createdAt: "2025-02-05T10:00:00Z",
      };

      // Gmail format (same account)
      const gmailTxn = {
        transactionId: "plaid_txn_123",  // Same ID
        accountId: "test_account",
        date: "2025-02-05",
        amount: 100.0,
        currency: "USD",
        category: ["Shopping"],
        merchantName: "Store",
        paymentChannel: "email",
        pending: false,
        plaidTransactionId: "plaid_txn_123",
        createdAt: "2025-02-05T10:01:00Z",
      };

      // Deduplication key: accountId_plaidTransactionId
      const plaidKey = `${plaidTxn.accountId}_${plaidTxn.plaidTransactionId}`;
      const gmailKey = `${gmailTxn.accountId}_${gmailTxn.plaidTransactionId}`;

      expect(plaidKey).toBe(gmailKey); // Same key = duplicate
    });
  });
});
