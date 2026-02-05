/**
 * Gmail API fetcher service
 *
 * This module handles fetching emails from Gmail API using OAuth tokens.
 * It provides methods to search for bills and extract email content.
 */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { getAccessToken } from "../oauth/gmail.js";

/**
 * Gmail message format
 */
export interface GmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  internalDate?: string;
  payload?: GmailMessagePayload;
}

export interface GmailMessagePayload {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: GmailMessageBody;
  parts?: GmailMessagePayload[];
}

export interface GmailHeader {
  name: string;
  value: string;
}

export interface GmailMessageBody {
  attachmentId?: string;
  size?: number;
  data?: string;
}

/**
 * Gmail search response
 */
export interface GmailListResponse {
  messages?: Array<{ id: string; threadId: string }>;
  nextPageToken?: string;
  resultSizeEstimate?: number;
}

/**
 * Email content extraction result
 */
export interface EmailContent {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  snippet: string;
  body: string;
  attachments: Array<{ id: string; filename: string; mimeType: string }>;
}

/**
 * Make authenticated request to Gmail API
 */
async function gmailRequest<T>(
  api: OpenClawPluginApi,
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const accessToken = await getAccessToken(api);

  const url = `https://www.googleapis.com/gmail/v1${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gmail API error: ${response.status} ${error}`);
  }

  return response.json() as Promise<T>;
}

/**
 * Search for messages matching a query
 */
export async function searchMessages(
  api: OpenClawPluginApi,
  query: string,
  maxResults: number = 50
): Promise<GmailListResponse> {
  const params = new URLSearchParams({
    q: query,
    maxResults: maxResults.toString(),
  });

  return gmailRequest<GmailListResponse>(
    api,
    `/users/me/messages?${params.toString()}`
  );
}

/**
 * Get a specific message by ID
 */
export async function getMessage(
  api: OpenClawPluginApi,
  messageId: string,
  format: "full" | "metadata" | "minimal" = "full"
): Promise<GmailMessage> {
  return gmailRequest<GmailMessage>(
    api,
    `/users/me/messages/${messageId}?format=${format}`
  );
}

/**
 * Get message attachment
 */
export async function getAttachment(
  api: OpenClawPluginApi,
  messageId: string,
  attachmentId: string
): Promise<{ data: string; size: number }> {
  return gmailRequest<{ data: string; size: number }>(
    api,
    `/users/me/messages/${messageId}/attachments/${attachmentId}`
  );
}

/**
 * Extract header value from message payload
 */
function getHeaderValue(
  payload: GmailMessagePayload | undefined,
  name: string
): string {
  if (!payload?.headers) {
    return "";
  }

  const header = payload.headers.find((h) => h.name.toLowerCase() === name.toLowerCase());
  return header?.value || "";
}

/**
 * Decode Base64URL encoded string
 */
function decodeBase64Url(data: string): string {
  // Replace Base64URL characters with Base64 characters
  let base64 = data.replace(/-/g, "+").replace(/_/g, "/");

  // Add padding if needed
  while (base64.length % 4) {
    base64 += "=";
  }

  // Decode
  return Buffer.from(base64, "base64").toString("utf-8");
}

/**
 * Extract text body from message payload
 */
function extractTextBody(payload: GmailMessagePayload | undefined): string {
  if (!payload) {
    return "";
  }

  // If this part has a body, decode it
  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  // If this part has sub-parts, recurse
  if (payload.parts) {
    // Prefer text/plain over text/html
    let textContent = "";
    let htmlContent = "";

    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        textContent = decodeBase64Url(part.body.data);
      } else if (part.mimeType === "text/html" && part.body?.data) {
        htmlContent = decodeBase64Url(part.body.data);
      } else if (part.parts) {
        const content = extractTextBody(part);
        if (content) {
          textContent = content;
        }
      }
    }

    // Return text/plain if available, otherwise text/html
    return textContent || htmlContent;
  }

  return "";
}

/**
 * Extract attachments from message payload
 */
function extractAttachments(
  payload: GmailMessagePayload | undefined
): Array<{ id: string; filename: string; mimeType: string }> {
  if (!payload) {
    return [];
  }

  const attachments: Array<{ id: string; filename: string; mimeType: string }> = [];

  function scanParts(part: GmailMessagePayload): void {
    // Check if this part is an attachment
    if (part.filename && part.body?.attachmentId) {
      attachments.push({
        id: part.body.attachmentId,
        filename: part.filename,
        mimeType: part.mimeType || "application/octet-stream",
      });
    }

    // Recurse into sub-parts
    if (part.parts) {
      for (const subPart of part.parts) {
        scanParts(subPart);
      }
    }
  }

  scanParts(payload);
  return attachments;
}

/**
 * Extract full email content from Gmail message
 */
export async function extractEmailContent(
  api: OpenClawPluginApi,
  message: GmailMessage
): Promise<EmailContent> {
  const payload = message.payload;

  return {
    id: message.id,
    threadId: message.threadId,
    from: getHeaderValue(payload, "From"),
    to: getHeaderValue(payload, "To"),
    subject: getHeaderValue(payload, "Subject"),
    date: getHeaderValue(payload, "Date"),
    snippet: message.snippet || "",
    body: extractTextBody(payload),
    attachments: extractAttachments(payload),
  };
}

/**
 * Fetch emails with bill-related keywords
 */
export async function fetchBillEmails(
  api: OpenClawPluginApi,
  daysBack: number = 30
): Promise<EmailContent[]> {
  // Build search query for bill-related emails
  const keywords = [
    'invoice OR "statement" OR "bill due" OR receipt',
    'subscription OR payment OR "amount due"',
    '"your bill" OR "your statement" OR "your invoice"',
  ];

  // Add date filter
  const date = new Date();
  date.setDate(date.getDate() - daysBack);
  const dateStr = date.toISOString().split("T")[0].replace(/-/g, "/");

  const query = `(${keywords.join(" OR ")}) after:${dateStr}`;

  // Search for messages
  const searchResult = await searchMessages(api, query, 50);

  if (!searchResult.messages) {
    return [];
  }

  // Fetch full message content for each message
  const emails: EmailContent[] = [];

  for (const messageRef of searchResult.messages) {
    try {
      const message = await getMessage(api, messageRef.id);
      const emailContent = await extractEmailContent(api, message);
      emails.push(emailContent);
    } catch (error) {
      api.logger.error?.(`Failed to fetch message ${messageRef.id}:`, error);
    }
  }

  return emails;
}

/**
 * Fetch recent emails from a specific sender
 */
export async function fetchEmailsFromSender(
  api: OpenClawPluginApi,
  sender: string,
  daysBack: number = 30
): Promise<EmailContent[]> {
  const date = new Date();
  date.setDate(date.getDate() - daysBack);
  const dateStr = date.toISOString().split("T")[0].replace(/-/g, "/");

  const query = `from:${sender} after:${dateStr}`;

  const searchResult = await searchMessages(api, query, 20);

  if (!searchResult.messages) {
    return [];
  }

  const emails: EmailContent[] = [];

  for (const messageRef of searchResult.messages) {
    try {
      const message = await getMessage(api, messageRef.id);
      const emailContent = await extractEmailContent(api, message);
      emails.push(emailContent);
    } catch (error) {
      api.logger.error?.(`Failed to fetch message ${messageRef.id}:`, error);
    }
  }

  return emails;
}

/**
 * Get labels from Gmail (for filtering)
 */
export async function getLabels(api: OpenClawPluginApi): Promise<any[]> {
  const response = await gmailRequest<{ labels: any[] }>(
    api,
    "/users/me/labels"
  );
  return response.labels || [];
}

/**
 * Get profile info
 */
export async function getProfile(api: OpenClawPluginApi): Promise<{
  emailAddress: string;
  messagesTotal: number;
  threadsTotal: number;
  historyId: string;
}> {
  return gmailRequest<any>(api, "/users/me/profile");
}
