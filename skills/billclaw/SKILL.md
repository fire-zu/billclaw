# billclaw - Bank Transaction Import for OpenClaw

> **账单爪** - Take back control of your financial data.

## What is billclaw?

billclaw is an OpenClaw plugin that lets you **hold your own bank access tokens locally**. When you use apps that integrate with Plaid or other data aggregators, those apps store your access tokens on their servers - meaning they have full access to your transaction history.

With billclaw, **you own the data**. The access tokens never leave your device.

### The Problem

```
You → [Budget App] → Plaid → Your Bank
           ↑
   Access Token here!
   The app can see ALL your data.
```

### The Solution

```
You → [OpenClaw + billclaw] → Plaid → Your Bank
           ↑
   Access Token here!
   Data stays on YOUR device.
```

## What Can You Do?

- **Connect bank accounts** via Plaid (US/Canada) or GoCardless (Europe)
- **Fetch bills from Gmail** automatically
- **Store transactions locally** as JSON files
- **Push to webhooks** for real-time integrations
- **Sync manually** or on a schedule

## Setup

Run the interactive setup wizard:

```
openclaw bills setup
```

This will guide you through:
1. Selecting your data source (Plaid, GoCardless, or Gmail)
2. Authorizing access via OAuth
3. Configuring sync preferences

## Commands

### `openclaw bills setup`
Interactive wizard for connecting new accounts.

### `openclaw bills sync`
Manually trigger a sync for all connected accounts.

```bash
# Sync all accounts
openclaw bills sync

# Sync a specific account
openclaw bills sync --account-id chase-checking
```

### `openclaw bills status`
View connection status and recent sync results.

```
Connected Accounts: 3
├── Chase Checking (Plaid) ✅ Last sync: 2 hours ago
├── Gmail Bills ✅ Last sync: 1 day ago
└── BUNQ (GoCardless) ✅ Last sync: 5 hours ago
```

### `openclaw bills config`
Manage configuration settings.

```bash
# View all config
openclaw bills config

# Set a value
openclaw bills config set sync.frequency hourly
```

## Agent Tools

billclaw also provides tools that OpenClaw agents can use:

### `plaid_sync`
Sync transactions from Plaid-connected accounts.

### `gmail_fetch_bills`
Fetch and parse bills from Gmail.

### `bill_parse`
Parse bill data from various formats (PDF, CSV, email).

## Data Storage

Your transaction data is stored locally in `~/.openclaw/billclaw/`:

```
~/.openclaw/billclaw/
├── accounts.json           # Account registry
├── accounts/{id}.json      # Per-account credentials
├── transactions/{id}/YYYY/MM.json
├── sync/{id}/{syncId}.json
└── cursor.json             # Global sync cursor
```

## Webhooks

Configure webhooks to push transactions to other services in real-time:

```bash
openclaw bills config set webhooks[0].url https://your-server.com/webhook
openclaw bills config set webhooks[0].events '["transaction.new","sync.failed"]'
```

Webhook payloads include:
- `transaction.new` - New transaction detected
- `transaction.updated` - Transaction modified
- `transaction.deleted` - Transaction removed
- `sync.started/completed/failed` - Sync status updates
- `account.connected/disconnected/error` - Account status changes

All webhooks are signed with HMAC-SHA256 for verification.

## Examples

### Sync All Accounts
```
Sync my bank accounts
```

### Check Status
```
Show me the status of my billclaw accounts
```

### Fetch Recent Transactions
```
Fetch transactions from the last 7 days
```

### Parse a Bill
```
Parse this bill file: ~/Downloads/statement.pdf
```

## Cost Notice

Plaid charges for API usage. With billclaw, **you pay directly** for your own usage rather than having costs bundled into a subscription. Typical costs for individuals:
- Free tier covers most users
- Paid tiers start at $0-50/month depending on volume

See [Plaid pricing](https://plaid.com/pricing/) for details.

## Privacy & Security

- Access tokens stored locally (encrypted at rest)
- Data never leaves your device unless configured via webhooks
- Open source - code can be audited
- OAuth 2.0 for secure authorization
- Optional encryption for stored data

## Troubleshooting

### Sync Failing
```bash
# Check status for error details
openclaw bills status

# Re-authenticate if token expired
openclaw bills setup --account-id <id>
```

### No Transactions Found
- Ensure the account has recent activity
- Check sync frequency settings
- Verify OAuth token is valid

### Gmail Bills Not Found
- Check email filters in config
- Ensure bill sender is in allowlist
- Verify Gmail watch is active

## Contributing

Contributions welcome! See [GitHub Issues](https://github.com/fire-zu/billclaw/issues) for ways to help.

## License

MIT - see [LICENSE](https://github.com/fire-zu/billclaw/blob/main/LICENSE)

## Links

- GitHub: https://github.com/fire-zu/billclaw
- OpenClaw: https://github.com/openclaw/openclaw
- Plaid: https://plaid.com
- GoCardless: https://gocardless.com
