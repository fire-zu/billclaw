/**
 * Zod schemas for BillClaw configuration
 *
 * This file contains Zod schemas for type-safe configuration validation.
 * These schemas are framework-agnostic and work across all adapters.
 */

import { z } from "zod"

/**
 * Account types supported by BillClaw
 */
export const AccountTypeSchema = z.enum(["plaid", "gocardless", "gmail"])
export type AccountType = z.infer<typeof AccountTypeSchema>

/**
 * Sync frequency options
 */
export const SyncFrequencySchema = z.enum([
  "realtime",
  "hourly",
  "daily",
  "weekly",
  "manual",
])
export type SyncFrequency = z.infer<typeof SyncFrequencySchema>

/**
 * Plaid environment options
 */
export const PlaidEnvironmentSchema = z.enum([
  "sandbox",
  "development",
  "production",
])
export type PlaidEnvironment = z.infer<typeof PlaidEnvironmentSchema>

/**
 * Webhook event types
 */
export const WebhookEventTypeSchema = z.enum([
  "transaction.new",
  "transaction.updated",
  "transaction.deleted",
  "sync.started",
  "sync.completed",
  "sync.failed",
  "account.connected",
  "account.disconnected",
  "account.error",
  "webhook.test",
])
export type WebhookEventType = z.infer<typeof WebhookEventTypeSchema>

/**
 * Per-account configuration
 */
export const AccountConfigSchema = z.object({
  id: z.string().min(1),
  type: AccountTypeSchema,
  name: z.string().min(1),
  enabled: z.boolean().default(false),
  syncFrequency: SyncFrequencySchema.default("daily"),
  lastSync: z.string().optional(),
  lastStatus: z.enum(["success", "error", "pending"]).optional(),
  // Plaid-specific
  plaidItemId: z.string().optional(),
  plaidAccessToken: z.string().optional(),
  // GoCardless-specific
  gocardlessRequisitionId: z.string().optional(),
  gocardlessAccessToken: z.string().optional(),
  // Gmail-specific
  gmailEmailAddress: z.string().email().optional(),
  gmailAccessToken: z.string().optional(),
  gmailRefreshToken: z.string().optional(),
  gmailTokenExpiry: z.string().optional(), // ISO timestamp
  gmailFilters: z.array(z.string()).optional(),
})
export type AccountConfig = z.infer<typeof AccountConfigSchema>

/**
 * Webhook configuration
 */
export const WebhookConfigSchema = z.object({
  enabled: z.boolean().default(false),
  url: z.string().url().optional(),
  secret: z.string().optional(),
  retryPolicy: z
    .object({
      maxRetries: z.number().int().min(0).default(3),
      initialDelay: z.number().int().min(0).default(1000),
      maxDelay: z.number().int().min(0).default(30000),
    })
    .default({
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 30000,
    }),
  events: z
    .array(WebhookEventTypeSchema)
    .default(["transaction.new", "sync.failed", "account.error"]),
})
export type WebhookConfig = z.infer<typeof WebhookConfigSchema>

/**
 * Storage configuration
 */
export const StorageConfigSchema = z.object({
  path: z.string().default("~/.billclaw"),
  format: z.enum(["json", "csv", "both"]).default("json"),
  encryption: z
    .object({
      enabled: z.boolean().default(false),
      keyPath: z.string().optional(),
    })
    .default({
      enabled: false,
    }),
})
export type StorageConfig = z.infer<typeof StorageConfigSchema>

/**
 * Plaid configuration
 */
export const PlaidConfigSchema = z.object({
  clientId: z.string().optional(),
  secret: z.string().optional(),
  environment: PlaidEnvironmentSchema.default("sandbox"),
  webhookUrl: z.string().url().optional(),
})
export type PlaidConfig = z.infer<typeof PlaidConfigSchema>

/**
 * GoCardless configuration
 */
export const GoCardlessConfigSchema = z.object({
  accessToken: z.string().optional(),
  environment: z.enum(["sandbox", "live"]).default("sandbox"),
})
export type GoCardlessConfig = z.infer<typeof GoCardlessConfigSchema>

/**
 * Gmail configuration
 */
export const GmailConfigSchema = z.object({
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  historyId: z.string().optional(),
  pubsubTopic: z.string().optional(),
  senderWhitelist: z.array(z.string()).default([]),
  keywords: z
    .array(z.string())
    .default(["invoice", "statement", "bill due", "receipt", "payment due"]),
  // Recognition rules
  confidenceThreshold: z.number().min(0).max(1).default(0.5),
  requireAmount: z.boolean().default(false),
  requireDate: z.boolean().default(false),
  // Custom bill type patterns
  billTypePatterns: z.record(z.array(z.string())).optional(),
})
export type GmailConfig = z.infer<typeof GmailConfigSchema>

/**
 * Sync configuration
 */
export const SyncConfigSchema = z.object({
  defaultFrequency: SyncFrequencySchema.default("daily"),
  retryOnFailure: z.boolean().default(true),
  maxRetries: z.number().int().min(0).default(3),
})
export type SyncConfig = z.infer<typeof SyncConfigSchema>

/**
 * Main BillClaw configuration schema
 */
export const BillclawConfigSchema = z.object({
  accounts: z.array(AccountConfigSchema).default([]),
  webhooks: z.array(WebhookConfigSchema).default([]),
  storage: StorageConfigSchema.default({
    path: "~/.billclaw",
    format: "json",
    encryption: { enabled: false },
  }),
  sync: SyncConfigSchema.default({
    defaultFrequency: "daily",
    retryOnFailure: true,
    maxRetries: 3,
  }),
  plaid: PlaidConfigSchema.default({
    environment: "sandbox",
  }),
  gocardless: GoCardlessConfigSchema.optional(),
  gmail: GmailConfigSchema.optional(),
})
export type BillclawConfig = z.infer<typeof BillclawConfigSchema>
