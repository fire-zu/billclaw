# billclaw

Bank transaction and bill data import plugin for OpenClaw with **data sovereignty**.

## Overview

billclaw enables you to import your financial transaction data from Plaid, Gmail, and other sources while maintaining complete control over your data. All access tokens and transaction records are stored locally on your machine - never on third-party servers.

## Features

- **Plaid Integration** - Sync transactions from US/Canadian bank accounts via Plaid
- **Gmail Bills** - Parse bills from email receipts
- **Local Storage** - All data stored in `~/.openclaw/billclaw/`
- **Data Sovereignty** - Access tokens stored locally, not on cloud servers
- **Multiple Sync Modes** - Real-time (webhook), hourly, daily, weekly, or manual

## Installation

### Requirements

- OpenClaw CLI installed
- Node.js 18+
- Plaid API credentials (for bank sync)

### Setup

1. **Get Plaid API Credentials** (optional, for bank sync)
   - Go to [Plaid Dashboard](https://dashboard.plaid.com)
   - Sign up for an account
   - Note your Client ID and Secret

2. **Configure billclaw**

   ```bash
   # Set environment variables (recommended)
   export PLAID_CLIENT_ID="your_client_id"
   export PLAID_SECRET="your_secret"

   # Or configure via OpenClaw config
   openclaw config set billclaw.plaid.clientId YOUR_CLIENT_ID
   openclaw config set billclaw.plaid.secret YOUR_SECRET
   openclaw config set billclaw.plaid.environment sandbox
   ```

3. **Connect Bank Accounts**

   ```bash
   openclaw bills setup
   ```

## Documentation

### Data Source Setup

| Guide | Description |
|-------|-------------|
| [Plaid Setup Guide](docs/plaid-setup-guide.md) | Step-by-step Plaid API configuration for US/Canadian banks |
| [Gmail Setup Guide](docs/gmail-setup-guide.md) | Gmail API configuration, OAuth 2.0, and Pub/Sub setup |

### Usage & Configuration

| Guide | Description |
|-------|-------------|
| [User Guide](docs/user-guide.md) | Complete usage documentation and CLI command reference |
| [Recognition Rules](docs/recognition-rules.md) | How bill recognition works, customization, and tuning |
| [Cost Guide](docs/costs.md) | Understanding costs for Plaid and Gmail APIs |

### Integration & Exports

| Guide | Description |
|-------|-------------|
| [Webhook Integration Guide](docs/webhook-guide.md) | Configure webhooks for real-time event notifications |
| [Event Format Reference](docs/event-format-reference.md) | Detailed webhook event payload specifications |

### Support

| Guide | Description |
|-------|-------------|
| [Troubleshooting Guide](docs/troubleshooting.md) | Diagnose and resolve common issues with billclaw |

## Usage

### Sync Transactions

```bash
# Sync all accounts
openclaw bills sync

# Sync specific account
openclaw bills sync <account_id>
```

### Check Status

```bash
openclaw bills status
```

### Manage Configuration

```bash
# View all config
openclaw bills config

# Set a value
openclaw bills config plaid.environment development
```

## Configuration

### Account Configuration

```typescript
{
  "accounts": [
    {
      "id": "chase-checking",
      "type": "plaid",           // "plaid" | "gocardless" | "gmail"
      "name": "Chase Checking",
      "enabled": true,
      "syncFrequency": "daily",   // "realtime" | "hourly" | "daily" | "weekly" | "manual"
      "plaidAccessToken": "access-sandbox-xxx",
      "plaidItemId": "item-sandbox-xxx"
    }
  ]
}
```

### Storage Configuration

```typescript
{
  "storage": {
    "path": "~/.openclaw/billclaw",
    "format": "json",            // "json" | "csv" | "both"
    "encryption": {
      "enabled": false,
      "keyPath": "/path/to/key"  // Optional: for encryption
    }
  }
}
```

### Webhook Configuration

```typescript
{
  "webhooks": [
    {
      "enabled": true,
      "url": "https://your-server.com/webhook",
      "secret": "your_hmac_secret",
      "events": [
        "transaction.new",
        "transaction.updated",
        "sync.failed"
      ]
    }
  ]
}
```

## Data Storage

All data is stored locally in:

```
~/.openclaw/billclaw/
├── accounts.json           # Account registry
├── accounts/{id}.json      # Account credentials (encrypted)
├── transactions/{id}/YYYY/MM.json  # Transactions by month
├── sync/{id}/{syncId}.json # Sync state for idempotency
├── cursor.json             # Global sync cursor
└── manifest.json           # Version + statistics
```

## Agent Tools

### `plaid_sync`

Sync transactions from Plaid-connected bank accounts.

```typescript
{
  "accountId": "optional-account-id"
}
```

### `gmail_fetch_bills`

Fetch and parse bills from Gmail.

```typescript
{
  "days": 30  // Number of days to look back
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

## Development

### Build

```bash
cd extensions/billclaw
npm run build
```

### Run Tests

```bash
npm test
npm run test:coverage
```

### Lint

```bash
npm run lint
npm run format
```

## Security Notes

- Access tokens are stored locally in `~/.openclaw/billclaw/accounts/`
- Tokens are never transmitted to external servers (except Plaid API)
- Enable encryption in config to encrypt stored tokens
- Use environment variables for sensitive credentials

## Troubleshooting

For comprehensive troubleshooting information, see the [Troubleshooting Guide](docs/troubleshooting.md).

### Quick Checks

```bash
# Check sync status
openclaw bills status

# Check logs
openclaw logs billclaw-sync

# View configuration
openclaw bills config
```

### Common Issues

| Issue | Solution |
|-------|----------|
| Sync fails | Check credentials and network connection |
| Invalid Plaid credentials | Run `openclaw config set billclaw.plaid.clientId YOUR_ID` |
| Data not appearing | Check `~/.openclaw/billclaw/transactions/` directory |
| Authentication errors | Run `openclaw bills setup` to re-authenticate |

For detailed solutions, see the [Troubleshooting Guide](docs/troubleshooting.md).

## License

MIT

## Author

@fire-zu

## Links

- [Plaid Documentation](https://plaid.com/docs/)
- [OpenClaw Documentation](https://openclaw.ai/docs)
- [GitHub Repository](https://github.com/fire-zu/billclaw)
