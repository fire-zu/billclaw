# BillClaw

Financial data sovereignty with multi-platform plugin architecture.

## Overview

BillClaw is an open-source financial data import system that puts you in control of your financial data. Instead of storing your banking credentials with third-party services, BillClaw stores them locally and syncs transactions directly to your own storage.

### Key Features

- **Data Sovereignty**: Your credentials stay on your machine
- **Multi-Source**: Import from Plaid, Gmail, and GoCardless
- **Flexible Export**: Export to Beancount, Ledger, or CSV
- **Framework Agnostic**: Use with OpenClaw, as a CLI, or as a library
- **Local Storage**: All data stored locally with optional encryption
- **Real-time Sync**: Webhook support for instant transaction updates

## Architecture

BillClaw uses a **Framework-Agnostic Core + Adapter Pattern** architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                      BillClaw Monorepo                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────┐  ┌──────────────────┐               │
│  │  OpenClaw Plugin │  │   Standalone CLI │               │
│  │  (AI Framework)  │  │   (Terminal)     │               │
│  └────────┬─────────┘  └────────┬─────────┘               │
│           │                      │                          │
│           └──────────┬───────────┘                          │
│                      ▼                                      │
│           ┌────────────────────┐                           │
│           │  @firela/billclaw-core  │                     │
│           │  (Framework-Agnostic) │                         │
│           │  ├─ oauth/           │                         │
│           │  ├─ models/          │                         │
│           │  ├─ storage/         │                         │
│           │  └─ sources/         │                         │
│           └────────┬────────────┘                           │
│                      │                                      │
│           ┌──────────┴──────────────────────┐             │
│           ▼                                 ▼             │
│    ┌──────────────┐              ┌──────────────┐       │
│    │  OpenClaw    │              │     CLI      │       │
│    │  Adapter     │              │   Adapter    │       │
│    └──────────────┘              └──────────────┘       │
│           │                                 │             │
│           └──────────┬──────────────────────────┘             │
│                      ▼                                        │
│           ┌────────────────────┐                             │
│           │  @firela/            │                             │
│           │  billclaw-connect    │                             │
│           │  (OAuth Service)      │                             │
│           │  └─ Web UI           │                             │
│           │  └─ HTTP Endpoints   │                             │
│           └────────────────────┘                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Key Changes (Phase 0 - 2026-02-08)**:
- ✅ Extracted OAuth core logic to `@firela/billclaw-core`
- ✅ Added `@firela/billclaw-connect` OAuth service
- ✅ Implemented adapter pattern for OpenClaw/CLI/Connect
- ✅ Complete OAuth flow with web UI

For detailed architecture documentation, see [docs/architecture.md](./docs/architecture.md).

## Packages

### [@firela/billclaw-core](./packages/core)

Framework-agnostic core business logic. This package contains all the functionality with zero dependencies on any AI framework.

- Data models with Zod validation
- Transaction storage with caching and indexing
- Plaid and Gmail integration
- Beancount and Ledger exporters
- Security: keychain integration and audit logging

### [@firela/billclaw-openclaw](./packages/openclaw)

OpenClaw plugin adapter. Integrates BillClaw with the OpenClaw AI framework.

- 6 agent tools (plaid_sync, gmail_fetch, bill_parse, etc.)
- 4 CLI commands (bills setup, sync, status, config)
- 2 OAuth providers (Plaid, Gmail)
- 2 background services (sync, webhook)

### [@firela/billclaw-cli](./packages/cli)

Standalone command-line interface. Use BillClaw without any AI framework.

- Interactive setup wizard
- Transaction sync and status monitoring
- Configuration management
- Export to Beancount/Ledger
- Import from CSV/OFX/QFX

### [@firela/billclaw-connect](./packages/connect)

OAuth service for financial data provider authentication.

- Express web server (localhost:4456)
- Plaid Link web interface
- Gmail OAuth web interface
- Framework-agnostic OAuth handlers
- Local-first deployment

**Usage**:
```bash
cd packages/connect
pnpm build
# Configure .env with PLAID_CLIENT_ID and PLAID_SECRET
node dist/server.js
# Visit http://localhost:4456
```

## Quick Start

### Using Connect OAuth Service (Recommended)

The easiest way to connect your financial accounts:

```bash
# 1. Build the Connect service
cd packages/connect
pnpm build

# 2. Configure your Plaid credentials
cat > .env << EOF
PLAID_CLIENT_ID=your_client_id
PLAID_SECRET=your_secret
PLAID_ENVIRONMENT=sandbox
PORT=4456
EOF

# 3. Start the service
source .env && node dist/server.js

# 4. Open your browser
open http://localhost:4456
```

### As OpenClaw Plugin

### As OpenClaw Plugin

```bash
cd ~/.openclaw/extensions
npm install @firela/billclaw-openclaw
```

### As Standalone CLI

```bash
npm install -g @firela/billclaw-cli
billclaw setup
billclaw sync
```

### As a Library

```bash
npm install @firela/billclaw-core
```

```typescript
import { Billclaw } from "@firela/billclaw-core";

const billclaw = new Billclaw(runtime);
await billclaw.syncPlaid();
const transactions = await billclaw.getTransactions("all", 2024, 1);
```

## Development

### Prerequisites

- Node.js >= 20.0.0
- pnpm >= 9.0.0

### Setup

```bash
# Clone repository
git clone https://github.com/fire-la/billclaw.git
cd billclaw

# Install dependencies
pnpm install

# Build all packages
pnpm build
```

### Scripts

```bash
pnpm build           # Build all packages
pnpm test            # Run all tests
pnpm lint            # Lint all packages
pnpm format          # Format all code
pnpm clean           # Clean build artifacts
```

### Project Structure

```
billclaw/
├── packages/
│   ├── core/          # Framework-agnostic core
│   ├── openclaw/      # OpenClaw plugin adapter
│   └── cli/           # Standalone CLI
├── .github/
│   └── workflows/     # CI/CD pipelines
├── .husky/            # Pre-commit hooks
├── pnpm-workspace.yaml
└── package.json
```

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

MIT - see [LICENSE](./LICENSE) file for details.

## Acknowledgments

- [Plaid](https://plaid.com/) - Bank account API
- [OpenClaw](https://openclaw.dev) - AI framework
- [Beancount](https://beancount.github.io/) - Plain text accounting

## Links

- [GitHub](https://github.com/fire-la/billclaw)
- [npm](https://www.npmjs.com/org/fire-la)
- [Documentation](https://github.com/fire-la/billclaw/wiki)
