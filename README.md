# billclaw

> **账单爪** - Bank transaction and bill data import for OpenClaw

## Data Sovereignty for Your Financial Data

**Problem**: When you use apps that integrate with Plaid and other data aggregators, the access tokens are stored on the app's servers. This means you lose **data sovereignty** - your financial data is controlled by third parties.

**Solution**: billclaw lets you hold your own Plaid/bank access tokens locally, through OpenClaw. Your data, your control.

### Traditional Model vs. OpenClaw Model

```
┌─────────────────────────────────────────────────────────┐
│ Traditional: Data sovereignty with App providers        │
├─────────────────────────────────────────────────────────┤
│   User → [App Server] → Plaid/Bank APIs                 │
│           △                                             │
│      Access Token stored here                           │
│                                                         │
│ ❌ App can view all your transaction data               │
│ ❌ Switching apps requires re-authorizing all banks     │
│ ❌ Apps may leak or monetize your data                  │
│ ❌ Vendor lock-in                                       │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ OpenClaw Model: Data sovereignty returns to you         │
├─────────────────────────────────────────────────────────┤
│   User → [Local OpenClaw] → Plaid/Bank APIs             │
│           △                                             │
│      Access Token stored locally on your device         │
│                                                         │
│ ✅ Data never leaves your device                        │
│ ✅ Switch frontend apps without re-authorizing          │
│ ✅ Zero-knowledge architecture                          │
│ ✅ Complete user control                                │
└─────────────────────────────────────────────────────────┘
```

## Features

- **Plaid Integration**: Connect to 12,000+ financial institutions in US/Canada
- **GoCardless Integration**: Access 2,300+ European banks via PSD2
- **Gmail Bill Fetching**: Automatically extract bills from email
- **Local Storage**: JSON files stored locally, under your control
- **Real-time Sync**: Webhook support for instant updates
- **Multi-Account**: Manage multiple bank accounts independently
- **Idempotent**: Safe to re-run - no duplicate data

## Status

🚧 **Under Active Development** - Phase 0: Architecture Design Complete

This project is currently in early development. Check out the [project board](https://github.com/fire-zu/billclaw/projects) for progress.

## Installation

```bash
# Coming soon
openclaw plugins install @fire-zu/billclaw
```

## Usage

```bash
# Setup wizard
openclaw bills setup

# Manual sync
openclaw bills sync

# Check status
openclaw bills status
```

## Project Structure

```
extensions/billclaw/          # Plugin (core functionality)
├── openclaw.plugin.json
├── index.ts
├── config.ts
└── src/
    ├── tools/               # Agent tools
    ├── cli/                 # CLI commands
    ├── oauth/               # OAuth flows
    └── services/            # Background services

skills/billclaw/              # Skill (user documentation)
└── SKILL.md
```

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

Built for the [OpenClaw](https://github.com/openclaw/openclaw) ecosystem.
