---
name: billclaw
description: This skill should be used when managing financial data, syncing bank transactions via Plaid/GoCardless, fetching bills from Gmail, or exporting to Beancount/Ledger formats. Provides local-first data sovereignty for OpenClaw users.
tags: [finance, banking, plaid, gocardless, gmail, beancount, ledger, transactions]
---

# BillClaw - Financial Data Sovereignty for OpenClaw

Complete financial data management skill for OpenClaw with local-first architecture. Sync bank transactions, fetch bills from email, and export to accounting formats.

## When to Use This Skill

Use this skill when:
- Syncing bank transactions from Plaid (US/Canada) or GoCardless (Europe)
- Fetching and parsing bills from Gmail
- Exporting financial data to Beancount or Ledger formats
- Managing local transaction storage with caching and indexing
- Running financial data operations with full data sovereignty

## Package Information

- **Packages**: `@firela/billclaw-core`, `@firela/billclaw-cli`, `@firela/billclaw-openclaw`
- **Repository**: https://github.com/fire-la/billclaw
- **Version**: 0.0.1
- **License**: MIT

## Installation

### Via npm

```bash
# Core package (framework-agnostic)
npm install @firela/billclaw-core

# CLI application
npm install @firela/billclaw-cli

# OpenClaw plugin
npm install @firela/billclaw-openclaw
```

### Via pnpm

```bash
pnpm add @firela/billclaw-core
pnpm add @firela/billclaw-cli
pnpm add @firela/billclaw-openclaw
```

## CLI Usage

### Setup Wizard

```bash
billclaw setup
```

Interactive wizard for:
- Linking Plaid accounts
- Configuring Gmail bill fetching
- Setting up local storage path

### Sync Transactions

```bash
# Sync all accounts
billclaw sync

# Sync specific account
billclaw sync --account <account-id>

# Sync with date range
billclaw sync --from 2024-01-01 --to 2024-12-31
```

### Status & Configuration

```bash
# View account status
billclaw status

# List all accounts
billclaw config accounts

# View storage statistics
billclaw status --storage
```

### Export Data

```bash
# Export to Beancount
billclaw export --format beancount --output transactions.beancount

# Export to Ledger
billclaw export --format ledger --output transactions.ledger

# Export with date filter
billclaw export --from 2024-01-01 --format beancount
```

## OpenClaw Plugin Usage

When installed in OpenClaw, this skill provides:

### Tools

- `plaid_sync` - Sync bank transactions from Plaid
- `gmail_fetch` - Fetch bills from Gmail
- `bill_parse` - Parse bill documents
- `conversational_sync` - Natural language sync interface
- `conversational_status` - Check sync status
- `conversational_help` - Get help with commands

### Commands

- `/billclaw-setup` - Configure accounts
- `/billclaw-sync` - Sync transactions
- `/billclaw-status` - View status
- `/billclaw-config` - Manage configuration

### OAuth Providers

- Plaid Link integration for bank account linking
- Gmail OAuth for bill fetching

## Features

### Data Sources

| Source | Description | Regions |
|--------|-------------|---------|
| **Plaid** | Bank transaction sync | US, Canada |
| **GoCardless** | European bank integration | Europe |
| **Gmail** | Bill fetching via email | Global |

### Storage Architecture

- **Location**: `~/.billclaw/` (configurable)
- **Format**: Monthly partitioned JSON files
- **Caching**: TTL-based in-memory cache
- **Deduplication**: 24-hour window based on transaction ID
- **Streaming**: Efficient handling of large datasets

### Export Formats

- **Beancount**: Double-entry accounting format
- **Ledger**: CLI accounting tool format
- **CSV**: Spreadsheet-compatible format

### Security

- Platform keychain storage for credentials (keytar)
- Audit logging for all credential access
- Optional AES-256-GCM encryption
- Local-first architecture - your data never leaves your control

## Configuration

Configuration is stored in `~/.billclaw/config.yaml`:

```yaml
accounts:
  - id: plaid-checking
    type: plaid
    name: "My Checking Account"
    enabled: true
    syncFrequency: daily

  - id: gmail-bills
    type: gmail
    name: "Bill Email Fetcher"
    enabled: true
    syncFrequency: daily

storage:
  path: "~/.billclaw"
  format: json

sync:
  defaultFrequency: daily
  retryOnFailure: true
  maxRetries: 3
```

## Runtime Abstractions

The core package is framework-agnostic and uses runtime abstractions:

- **Logger**: Abstract logging interface
- **ConfigProvider**: Configuration management
- **EventEmitter**: Event system for sync operations

This allows BillClaw to work across different environments (CLI, OpenClaw plugin, future platforms).

## Event System

BillClaw emits events for important operations:

- `transaction.added` - New transactions added
- `transaction.updated` - Existing transactions updated
- `sync.started` - Sync operation started
- `sync.completed` - Sync operation completed
- `sync.failed` - Sync operation failed
- `account.connected` - Account successfully connected
- `account.disconnected` - Account disconnected
- `account.error` - Account error occurred

## Scripts

### Validate Skill

Run validation before publishing:

```bash
./skills/billclaw/scripts/validate-skill.sh skills/billclaw
```

This checks:
- SKILL.md format and required fields
- File size limits
- Directory structure
- Description quality

## Troubleshooting

### Issue: Plaid Link fails

**Solution**: Ensure Plaid credentials are configured:
```bash
billclaw config plaid --client-id <id> --secret <secret>
```

### Issue: Gmail fetch returns no bills

**Solution**: Check Gmail filters and sender whitelist:
```bash
billclaw config gmail --filters "from:billing@service.com"
```

### Issue: Export format incorrect

**Solution**: Verify account mappings:
```bash
billclaw export --format beancount --show-mappings
```

## Resources

- **Documentation**: https://github.com/fire-la/billclaw
- **npm packages**: https://www.npmjs.com/org/firela
- **Issues**: https://github.com/fire-la/billclaw/issues

## Contributing

Contributions are welcome! Please see CONTRIBUTING.md in the repository.

## License

MIT License - See LICENSE file for details.

## Changelog

### 0.0.1 (2025-02-07)

Initial release:
- Plaid integration for US/Canada banks
- GoCardless integration for European banks
- Gmail bill fetching and parsing
- Local token storage with keychain
- Beancount and Ledger export
- CLI with setup wizard
- OpenClaw plugin with tools and commands
- GitHub Actions publishing workflow
