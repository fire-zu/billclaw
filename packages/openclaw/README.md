# @firela/billclaw-openclaw

OpenClaw plugin adapter for BillClaw financial data import.

## Overview

This package provides an OpenClaw plugin that integrates BillClaw's financial data capabilities with the OpenClaw AI framework. It exposes:

- **Agent Tools**: Plaid sync, Gmail fetch, bill parsing, conversational interface
- **CLI Commands**: `bills setup`, `bills sync`, `bills status`, `bills config`
- **OAuth Providers**: Plaid Link and Gmail OAuth flows
- **Background Services**: Sync service and webhook handler

## Installation

### As OpenClaw Extension

```bash
cd ~/.openclaw/extensions
npm install @firela/billclaw-openclaw
```

### Manual Registration

Add to your OpenClaw configuration:

```json
{
  "extensions": ["@firela/billclaw-openclaw"]
}
```

## Quick Start

### Using Agent Tools

```typescript
// In an OpenClaw agent context
const result = await agent.useTool("plaid_sync", {
  accountId: "plaid-123"
});
// Returns: { success: true, transactionsAdded: 42, ... }
```

### Using CLI Commands

```bash
# In OpenClaw CLI
openclaw bills setup
openclaw bills sync
openclaw bills status
openclaw bills config storage.path
```

### OAuth Integration

```typescript
// In OpenClaw OAuth flow
const oauth = await openclaw.getOAuthProvider("plaid");
const { url, token } = await oauth.handler(context);
```

## Available Tools

### plaid_sync

Sync transactions from Plaid-connected bank accounts.

```typescript
await agent.useTool("plaid_sync", {
  accountId: "plaid-123"  // Optional - syncs all if omitted
});
```

**Response:**
```json
{
  "success": true,
  "accountsSynced": 1,
  "transactionsAdded": 42,
  "transactionsUpdated": 5
}
```

### gmail_fetch_bills

Fetch and parse bills from Gmail.

```typescript
await agent.useTool("gmail_fetch_bills", {
  accountId: "gmail-123",
  days: 30  // Optional - default 30
});
```

**Response:**
```json
{
  "success": true,
  "accountsProcessed": 1,
  "emailsProcessed": 150,
  "billsExtracted": 12,
  "transactionsAdded": 12
}
```

### bill_parse

Parse bill data from various formats.

```typescript
await agent.useTool("bill_parse", {
  source: "email",
  data: "raw email content"
});
```

### conversational_sync

Sync with natural language support.

```typescript
await agent.useTool("conversational_sync", {
  prompt: "Sync my accounts"
});
```

### conversational_status

Show account status with natural language.

```typescript
await agent.useTool("conversational_status", {});
```

### conversational_help

Get help with BillClaw commands.

```typescript
await agent.useTool("conversational_help", {
  topic: "sync"
});
```

## CLI Commands

### bills setup

Interactive setup wizard for connecting accounts.

```bash
openclaw bills setup
```

### bills sync

Manually trigger transaction sync.

```bash
# Sync all accounts
openclaw bills sync

# Sync specific account
openclaw bills sync plaid-123
```

### bills status

Show connection status and recent sync results.

```bash
openclaw bills status
```

### bills config

Manage plugin configuration.

```bash
# View all config
openclaw bills config

# View specific key
openclaw bills config storage.path

# Set value
openclaw bills config storage.format json
```

## OAuth Providers

### Plaid

```typescript
const oauth = await openclaw.getOAuthProvider("plaid");
const { url } = await oauth.handler(context);
// Redirect user to Plaid Link
```

### Gmail

```typescript
const oauth = await openclaw.getOAuthProvider("gmail");
const { url } = await oauth.handler(context);
// Redirect user to Google OAuth
```

## Background Services

### billclaw-sync

Automatic sync service that runs on configured intervals.

### billclaw-webhook

HTTP webhook handler for real-time transaction updates from Plaid.

## Configuration

Plugin configuration is managed through OpenClaw's plugin config system:

```json
{
  "accounts": [],
  "storage": {
    "path": "~/.openclaw/billclaw",
    "format": "json"
  },
  "sync": {
    "defaultFrequency": "daily",
    "maxRetries": 3
  }
}
```

## Architecture

```
┌─────────────────────────────────────────┐
│           OpenClaw Framework            │
├─────────────────────────────────────────┤
│  BillClaw Plugin                        │
│  ├── Agent Tools (6)                    │
│  ├── CLI Commands (4)                   │
│  ├── OAuth Providers (2)                │
│  └── Background Services (2)            │
├─────────────────────────────────────────┤
│  @firela/billclaw-core                 │
│  (Framework-agnostic core logic)        │
└─────────────────────────────────────────┘
```

## Development

```bash
# Build
pnpm build

# Watch mode
pnpm dev

# Test
pnpm test
```

## License

MIT

## See Also

- [@firela/billclaw-core](https://github.com/fire-la/billclaw/tree/main/packages/core)
- [@firela/billclaw-cli](https://github.com/fire-la/billclaw/tree/main/packages/cli)
- [OpenClaw Documentation](https://openclaw.dev)
