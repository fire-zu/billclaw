# billclaw User Guide

Complete guide to using billclaw for importing and managing your financial transaction data with full data sovereignty.

## Table of Contents

- [Quick Start](#quick-start)
- [CLI Commands](#cli-commands)
- [Configuration](#configuration)
- [Data Storage](#data-storage)
- [Agent Tools](#agent-tools)
- [Common Workflows](#common-workflows)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

### Prerequisites

- OpenClaw CLI installed
- Node.js 18+ installed
- Plaid API credentials (see [Plaid Setup Guide](plaid-setup-guide.md))

### 5-Minute Setup

```bash
# 1. Set your Plaid credentials (optional, can use wizard)
export PLAID_CLIENT_ID="your_client_id"
export PLAID_SECRET="your_secret"

# 2. Run the setup wizard
openclaw bills setup

# 3. Follow the prompts to:
#    - Select data source (Plaid)
#    - Name your account
#    - Enter credentials (if not in env vars)

# 4. Sync your transactions
openclaw bills sync

# 5. Check status
openclaw bills status
```

Your data is now stored locally at:
```
~/.openclaw/billclaw/
```

---

## CLI Commands

### `openclaw bills setup`

Interactive wizard for configuring bank connections.

```bash
openclaw bills setup
```

**Prompts:**
1. View existing accounts
2. Choose data source (Plaid, GoCardless, Gmail)
3. Name your account
4. Enter API credentials (or use environment variables)
5. Select environment (sandbox/development/production)

**Example Output:**
```
🦀 billclaw Setup Wizard
This will guide you through connecting your bank accounts.

You have 0 existing account(s).

Step 1: Select your data source
Choose your bank connection method:
  1. Plaid (US/Canada banks) (default)
  2. GoCardless (European banks) - Coming soon
  3. Gmail Bills - Coming soon
Select option [1-3]: 1

Step 2: Name your account
Account name [My Checking Account]: Chase Checking

Step 3: Configure Plaid API
...

✅ Account configured successfully!

📝 Summary:
   Account ID: plaid_1234567890
   Name: Chase Checking
   Environment: sandbox
   Storage: ~/.openclaw/billclaw/

🔐 Data Sovereignty:
   - Your Plaid access tokens are stored locally
   - Tokens are never sent to any external server
   - You have full control over your financial data
```

### `openclaw bills sync`

Manually trigger transaction sync.

```bash
# Sync all accounts
openclaw bills sync

# Sync specific account
openclaw bills sync plaid_1234567890
```

**What it does:**
- Fetches new transactions since last sync
- Updates existing transactions with changes
- Stores data locally in JSON format
- Updates sync cursor for incremental updates

**Example Output:**
```
🔄 Syncing all accounts...
✅ Sync completed:
   Accounts synced: 2
   Transactions added: 47
   Transactions updated: 3
   Cursor: 2025-02-05T10:30:00.000Z...
```

### `openclaw bills status`

View connection status and sync history.

```bash
openclaw bills status
```

**Example Output:**
```
📊 billclaw Status

Configured Accounts: 2

  ✅ Chase Checking (plaid) - Last sync: Feb 5, 2025, 10:30 AM
  ✅ Bank of America Savings (plaid) - Last sync: Feb 5, 2025, 9:15 AM

💡 Run 'openclaw bills sync' to sync all accounts.
```

### `openclaw bills config`

Manage configuration settings.

```bash
# View configuration help
openclaw bills config

# View current config
openclaw config get billclaw

# Set a value
openclaw config set billclaw.plaid.environment development
openclaw config set billclaw.storage.format csv
```

**Available Settings:**

| Path | Type | Description |
|------|------|-------------|
| `billclaw.plaid.clientId` | string | Plaid Client ID |
| `billclaw.plaid.secret` | string | Plaid Secret (sensitive) |
| `billclaw.plaid.environment` | string | `sandbox` \| `development` \| `production` |
| `billclaw.storage.path` | string | Local storage path |
| `billclaw.storage.format` | string | `json` \| `csv` \| `both` |
| `billclaw.sync.frequencyMinutes` | number | Auto-sync interval (minutes) |

---

## Configuration

### Full Configuration Example

```json
{
  "enabled": true,
  "accounts": [
    {
      "id": "chase-checking",
      "type": "plaid",
      "name": "Chase Checking",
      "enabled": true,
      "syncFrequency": "daily",
      "plaidAccessToken": "access-sandbox-xxx",
      "plaidItemId": "item-sandbox-xxx"
    }
  ],
  "plaid": {
    "clientId": "your_client_id",
    "secret": "your_secret",
    "environment": "sandbox"
  },
  "storage": {
    "basePath": "~/.openclaw/billclaw",
    "format": "json"
  },
  "sync": {
    "frequencyMinutes": 60
  },
  "webhooks": [
    {
      "url": "https://your-server.com/webhook",
      "hmacSecret": "your_hmac_secret"
    }
  ]
}
```

### Sync Frequency Options

| Frequency | Description |
|-----------|-------------|
| `realtime` | Instant sync via webhooks |
| `hourly` | Every 60 minutes |
| `daily` | Every 24 hours |
| `weekly` | Every 7 days |
| `manual` | Only on command |

---

## Data Storage

### Storage Structure

```
~/.openclaw/billclaw/
├── accounts.json           # Account registry (metadata)
├── accounts/
│   ├── chase-checking.json  # Per-account credentials (tokens)
│   └── bofa-savings.json
├── transactions/
│   ├── chase-checking/
│   │   ├── 2025/
│   │   │   ├── 01.json      # January 2025 transactions
│   │   │   └── 02.json      # February 2025 transactions
│   │   └── 2025-02.json     # Optional: full-year file
│   └── bofa-savings/
│       └── 2025/
│           └── 02.json
├── sync/
│   ├── chase-checking/
│   │   └── sync_20250205.json  # Sync state for idempotency
│   └── bofa-savings/
│       └── sync_20250205.json
├── cursor.json             # Global sync cursor
└── manifest.json           # Version + statistics
```

### Transaction File Format

```json
{
  "accountId": "chase-checking",
  "year": 2025,
  "month": 2,
  "transactions": [
    {
      "transactionId": "plaid_txn_123",
      "date": "2025-02-05",
      "name": "Grocery Store",
      "amount": -85.32,
      "currency": "USD",
      "category": ["Food & Drink", "Groceries"],
      "merchantName": "Whole Foods Market",
      "pending": false,
      "paymentChannel": "in store",
      "syncedAt": "2025-02-05T10:30:00.000Z"
    }
  ],
  "updatedAt": "2025-02-05T10:30:00.000Z"
}
```

### Accessing Your Data

```bash
# View all transactions
cat ~/.openclaw/billclaw/transactions/*/2025/*.json | jq

# View specific account
cat ~/.openclaw/billclaw/transactions/chase-checking/2025/02.json | jq

# Export to CSV (if configured)
ls ~/.openclaw/billclaw/transactions/*/*.csv
```

---

## Agent Tools

billclaw provides OpenClaw Agent tools for programmatic access.

### `plaid_sync`

Sync transactions from Plaid-connected accounts.

```typescript
{
  "accountId": "optional-account-id"  // Omit for all accounts
}
```

**Usage in Agent:**
```
User: "Sync my bank transactions"

Agent calls: plaid_sync_tool({ accountId: "chase-checking" })

Returns: {
  "success": true,
  "transactionsAdded": 23,
  "transactionsUpdated": 2,
  "cursor": "2025-02-05T10:30:00.000Z"
}
```

### `gmail_fetch_bills`

Fetch and parse bills from Gmail (future feature).

```typescript
{
  "days": 30  // Look back period
}
```

### `bill_parse`

Parse bill data from various formats.

```typescript
{
  "source": "plaid",  // "plaid" | "gmail" | "file" | "email"
  "data": "raw data or file path"
}
```

---

## Common Workflows

### Workflow 1: First-Time Setup

```bash
# 1. Set credentials
export PLAID_CLIENT_ID="your_id"
export PLAID_SECRET="your_secret"

# 2. Run setup wizard
openclaw bills setup

# 3. Initial sync
openclaw bills sync

# 4. Verify data
ls ~/.openclaw/billclaw/transactions/
```

### Workflow 2: Daily Usage

```bash
# Morning: Sync transactions
openclaw bills sync

# Check status
openclaw bills status

# View new transactions (example)
cat ~/.openclaw/billclaw/transactions/*/2025/02.json | jq '.transactions[] | select(.date == "2025-02-05")'
```

### Workflow 3: Adding Multiple Accounts

```bash
# First account
openclaw bills setup
# ... complete wizard

# Add another account
openclaw bills setup
# Wizard will ask: "Do you want to add another account?"
# Select "yes" and repeat

# Sync all
openclaw bills sync
```

### Workflow 4: Troubleshooting Sync Issues

```bash
# 1. Check status
openclaw bills status

# 2. View sync logs
openclaw logs billclaw-sync

# 3. Force re-sync
openclaw bills sync --force

# 4. Check storage integrity
ls -la ~/.openclaw/billclaw/transactions/

# 5. Verify credentials
openclaw config get billclaw.plaid
```

---

## Troubleshooting

### Sync Fails

**Symptom:** `openclaw bills sync` returns errors

**Solutions:**
1. Check credentials: `openclaw config get billclaw.plaid`
2. Verify Plaid account status at [dashboard.plaid.com](https://dashboard.plaid.com)
3. Check logs: `openclaw logs billclaw-sync`
4. Try force re-sync: `openclaw bills sync --force`

### No Transactions Appearing

**Symptom:** Sync succeeds but no transactions

**Possible Causes:**
- New account may have no recent transactions
- Plaid still processing initial data (can take 1-2 minutes)
- Check if transactions are in a different month/year folder

**Verify:**
```bash
ls -R ~/.openclaw/billclaw/transactions/
cat ~/.openclaw/billclaw/manifest.json
```

### Token Expired

**Symptom:** `ITEM_LOGIN_REQUIRED` error

**Solution:**
Re-run setup wizard to re-authenticate:
```bash
openclaw bills setup
# Select the existing account to re-link
```

### Configuration Not Applied

**Symptom:** Config changes don't take effect

**Solution:**
```bash
# Restart any running OpenClaw services
openclaw restart

# Verify config
openclaw config get billclaw
```

---

## Advanced Topics

### Setting Up Webhooks

For real-time transaction updates:

1. Configure webhook in [Plaid Dashboard](https://dashboard.plaid.com)
2. Add webhook URL: `https://your-domain.com/openclaw/webhook/billclaw`
3. Configure billclaw:

```bash
openclaw config set billclaw.webhooks[0].url https://your-domain.com/webhook
openclaw config set billclaw.webhooks[0].hmacSecret YOUR_HMAC_SECRET
```

### Exporting to Other Formats

Configure CSV export:

```bash
openclaw config set billclaw.storage.format both
openclaw bills sync
```

CSV files will be generated alongside JSON files.

### Integrating with Beancount

Use transaction data for Beancount accounting:

```bash
# Export transactions
cat ~/.openclaw/billclaw/transactions/chase-checking/2025/02.json | \
  jq '.transactions[]' | \
  your-beancount-converter-script
```

---

## Getting Help

- **Documentation:** [Plaid Setup Guide](plaid-setup-guide.md) | [Cost Information](costs.md)
- **GitHub Issues:** [github.com/fire-zu/billclaw/issues](https://github.com/fire-zu/billclaw/issues)
- **Plaid Support:** [plaid.com/support](https://plaid.com/support)
- **OpenClaw Discord:** [discord.gg/openclaw](https://discord.gg/openclaw)

---

**Data Sovereignty Notice:** All your access tokens and transaction data are stored locally on your machine. billclaw never sends your credentials or data to any third-party server (except the Plaid API for fetching transactions).
