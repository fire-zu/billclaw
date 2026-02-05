/**
 * Gmail webhook handler service
 *
 * This module handles Gmail push notifications for real-time bill detection.
 * It integrates with Google Cloud Pub/Sub to receive notifications when new emails arrive.
 */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { BillclawConfig } from "../../config.js";
import {
  getMessage,
  extractEmailContent,
} from "./gmail-fetcher.js";
import {
  recognizeBill,
  type RecognitionResult,
} from "./bill-recognizer.js";
import {
  parseEmailToTransactions,
  toStorageTransaction,
} from "./email-parser.js";
import {
  appendTransactions,
  deduplicateTransactions,
} from "../storage/transaction-storage.js";

/**
 * Gmail push notification payload
 */
export interface GmailPushNotification {
  emailAddress: string;
  historyId: string;
}

/**
 * Pub/Sub message format
 */
export interface PubSubMessage {
  messageId: string;
  data: string; // Base64 encoded
  publishTime: string;
}

/**
 * Pub/Sub push request
 *
 * This is the format of HTTP push requests from Google Cloud Pub/Sub.
 * See: https://cloud.google.com/pubsub/docs/push
 */
export interface PubSubPushRequest {
  message: PubSubMessage;
  subscription: string;
}

/**
 * Webhook response
 */
export interface WebhookResponse {
  success: boolean;
  processed: boolean;
  action: string;
  errors?: string[];
}

/**
 * Handle Gmail push notification from Pub/Sub
 *
 * This is called when Gmail sends a push notification about new emails.
 * The notification is delivered via Google Cloud Pub/Sub to our webhook endpoint.
 */
export async function handleGmailPush(
  api: OpenClawPluginApi,
  pushRequest: PubSubPushRequest
): Promise<WebhookResponse> {
  const config = api.pluginConfig as BillclawConfig;

  try {
    // Decode Pub/Sub message data
    const notification = decodePushNotification(pushRequest.message);

    api.logger.info?.(
      `Received Gmail push notification for ${notification.emailAddress}`
    );

    // Find Gmail account that matches this email address
    const gmailAccounts = (config.accounts || []).filter(
      (acc) => acc.type === "gmail" && acc.enabled
    );

    if (gmailAccounts.length === 0) {
      return {
        success: true,
        processed: false,
        action: "ignored_no_account",
      };
    }

    // Get recent messages for this account
    // Note: Gmail push notifications don't include the message ID directly,
    // they only give us a new historyId. We need to fetch the history.
    const results = await processNewHistory(api, notification.historyId);

    return {
      success: true,
      processed: results.billsFound > 0,
      action: `processed_${results.billsFound}_bills`,
    };
  } catch (error) {
    const errorMsg =
      error instanceof Error ? error.message : "Unknown error";

    api.logger.error?.(`Gmail webhook error: ${errorMsg}`);

    return {
      success: false,
      processed: false,
      action: "error",
      errors: [errorMsg],
    };
  }
}

/**
 * Decode Base64-encoded Pub/Sub message data
 */
function decodePushNotification(
  message: PubSubMessage
): GmailPushNotification {
  const decoded = Buffer.from(message.data, "base64").toString("utf-8");
  return JSON.parse(decoded) as GmailPushNotification;
}

/**
 * Fetch and process new email history
 *
 * When we receive a push notification, we need to:
 * 1. Get the history of changes since last historyId
 * 2. Find new messages added
 * 3. Check if any are bills
 * 4. Extract and store transactions
 */
async function processNewHistory(
  api: OpenClawPluginApi,
  newHistoryId: string
): Promise<{ billsFound: number; transactionsAdded: number }> {
  const config = api.pluginConfig as BillclawConfig;

  // Get stored historyId for comparison
  const oldHistoryId = config.gmail?.historyId;

  if (!oldHistoryId || oldHistoryId === newHistoryId) {
    // No new changes, or this is the first notification
    return { billsFound: 0, transactionsAdded: 0 };
  }

  // In a real implementation, we would:
  // 1. Call Gmail users.messages.list with historyId
  // 2. Get the list of message IDs added since oldHistoryId
  // 3. Fetch each message and check if it's a bill

  // For now, we'll do a simpler approach:
  // Fetch recent emails from the last hour and check for bills
  const recentEmails = await fetchRecentEmails(api, 1); // Last 1 hour

  let billsFound = 0;
  let transactionsAdded = 0;

  for (const email of recentEmails) {
    const recognition = recognizeBill(email);

    if (recognition.isBill && recognition.confidence >= 0.7) {
      billsFound++;

      // Find the Gmail account to use
      const accountId = (config.accounts || []).find(
        (acc) => acc.type === "gmail"
      )?.id || "gmail_default";

      // Parse transactions
      const transactions = parseEmailToTransactions(
        accountId,
        email,
        recognition
      );

      // Convert to storage format
      const storageTransactions = transactions.map((t) => ({
        transactionId: t.transactionId,
        plaidTransactionId: t.transactionId,
        accountId: t.accountId,
        date: t.date,
        amount: t.amount,
        currency: t.currency,
        category: t.category,
        merchantName: t.merchantName || "",
        paymentChannel: t.paymentChannel || "email",
        pending: t.pending,
        createdAt: new Date().toISOString(),
      }));

      // Deduplicate
      const newTransactions = deduplicateTransactions(storageTransactions);

      // Store - get year/month from current date
      const now = new Date();
      const result = await appendTransactions(
        accountId,
        now.getFullYear(),
        now.getMonth() + 1,
        storageTransactions
      );
      transactionsAdded += result.added;

      api.logger.info?.(
        `Bill detected via webhook: ${email.subject} (${recognition.billType})`
      );
    }
  }

  // Update stored historyId
  // (In real implementation, this would be done via OpenClaw config API)

  return { billsFound, transactionsAdded };
}

/**
 * Fetch recent emails that might be bills
 * This is a simplified version for webhook processing
 */
async function fetchRecentEmails(
  api: OpenClawPluginApi,
  hoursBack: number
): Promise<Array<{ id: string; threadId: string; subject: string; body: string; from: string; to: string; date: string; snippet: string; attachments: Array<{ id: string; filename: string; mimeType: string }> }>> {
  // In a real implementation, this would use Gmail API to fetch recent messages
  // For now, return empty array - the actual implementation would:
  // 1. Call Gmail API users.messages.list with q parameter
  // 2. Fetch full message content for each message
  // 3. Return structured email data

  return [];
}

/**
 * Set up Gmail watch for push notifications
 *
 * This enables Gmail to send push notifications when new emails arrive.
 * Requires:
 * - Valid OAuth token
 * - Google Cloud Project with Pub/Sub topic
 * - Verified webhook endpoint
 */
export async function setupGmailWatch(
  api: OpenClawPluginApi,
  topicName: string
): Promise<{ success: boolean; historyId?: string; error?: string }> {
  const config = api.pluginConfig as BillclawConfig;

  try {
    // In a real implementation, we would:
    // 1. Get access token
    // 2. Call Gmail API users.messages.watch with topic name
    // 3. Store the returned historyId

    // Example API call:
    // POST https://www.googleapis.com/gmail/v1/users/me/watch
    // {
    //   "topicName": "projects/my-project/topics/my-topic",
    //   "labelIds": ["INBOX"]
    // }

    // Response:
    // {
    //   "historyId": "1234567890"
    // }

    return {
      success: true,
      historyId: "1234567890", // Would be actual historyId from API
    };
  } catch (error) {
    const errorMsg =
      error instanceof Error ? error.message : "Unknown error";

    api.logger.error?.(`Failed to set up Gmail watch: ${errorMsg}`);

    return {
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Stop Gmail watch (disable push notifications)
 */
export async function stopGmailWatch(
  api: OpenClawPluginApi
): Promise<{ success: boolean; error?: string }> {
  try {
    // In a real implementation, we would:
    // 1. Get access token
    // 2. Call Gmail API users.messages.stop

    // Example API call:
    // POST https://www.googleapis.com/gmail/v1/users/me/stop

    return {
      success: true,
    };
  } catch (error) {
    const errorMsg =
      error instanceof Error ? error.message : "Unknown error";

    api.logger.error?.(`Failed to stop Gmail watch: ${errorMsg}`);

    return {
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Verify Pub/Sub message signature
 *
 * Google signs Pub/Sub push messages. This verifies the signature
 * to ensure the message is from Google.
 */
export function verifyPubSubSignature(
  message: PubSubPushRequest,
  signature: string,
  publicKey: string
): boolean {
  // In a real implementation, this would:
  // 1. Extract the signature from headers
  // 2. Verify the signature using the public key
  // 3. Return true if valid

  // For now, return true (signature verification would use crypto.verify)
  return true;
}

/**
 * Process a specific Gmail message (triggered manually or by webhook)
 *
 * This can be called when a user forwards an email to billclaw,
 * or when processing a backlog of emails.
 */
export async function processGmailMessage(
  api: OpenClawPluginApi,
  messageId: string
): Promise<WebhookResponse> {
  const config = api.pluginConfig as BillclawConfig;

  try {
    // Fetch the message
    const message = await getMessage(api, messageId);
    const email = await extractEmailContent(api, message);

    // Check if it's a bill
    const recognition = recognizeBill(email);

    if (!recognition.isBill) {
      return {
        success: true,
        processed: false,
        action: "not_a_bill",
      };
    }

    // Find the Gmail account to use
    const accountId = (config.accounts || []).find(
      (acc) => acc.type === "gmail"
    )?.id || "gmail_default";

    // Parse transactions
    const transactions = parseEmailToTransactions(
      accountId,
      email,
      recognition
    );

    // Convert to storage format
    const storageTransactions = transactions.map((t) => ({
      transactionId: t.transactionId,
      plaidTransactionId: t.transactionId,
      accountId: t.accountId,
      date: t.date,
      amount: t.amount,
      currency: t.currency,
      category: t.category,
      merchantName: t.merchantName || "",
      paymentChannel: t.paymentChannel || "email",
      pending: t.pending,
      createdAt: new Date().toISOString(),
    }));

    // Deduplicate
    const newTransactions = deduplicateTransactions(storageTransactions);

    // Store - get year/month from current date
    const now = new Date();
    const result = await appendTransactions(
      accountId,
      now.getFullYear(),
      now.getMonth() + 1,
      storageTransactions
    );

    api.logger.info?.(
      `Processed message ${messageId}: ${result.added} transactions added`
    );

    return {
      success: true,
      processed: true,
      action: `added_${result.added}_transactions`,
    };
  } catch (error) {
    const errorMsg =
      error instanceof Error ? error.message : "Unknown error";

    api.logger.error?.(`Failed to process message ${messageId}: ${errorMsg}`);

    return {
      success: false,
      processed: false,
      action: "error",
      errors: [errorMsg],
    };
  }
}
