# Changelog

## 0.1.0

### Minor Changes

- 12a088e: Implement automated version management with changesets. Added GitHub Actions workflow for automatic version PRs and publishing.

### Patch Changes

- Updated dependencies [12a088e]
  - @fire-zu/billclaw-core@0.1.0

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial release of @fire-zu/billclaw-openclaw
- OpenClaw plugin adapter for BillClaw
- Agent tools:
  - plaid_sync - Sync transactions from Plaid
  - gmail_fetch_bills - Fetch bills from Gmail
  - bill_parse - Parse bills from various formats
  - conversational_sync - Natural language sync
  - conversational_status - Natural language status
  - conversational_help - Help documentation
- CLI commands:
  - bills setup - Interactive setup wizard
  - bills sync - Manual sync trigger
  - bills status - Account status display
  - bills config - Configuration management
- OAuth providers:
  - plaid - Plaid Link OAuth flow
  - gmail - Gmail OAuth 2.0 flow
- Background services:
  - billclaw-sync - Automatic sync service
  - billclaw-webhook - Webhook handler
- OpenClaw runtime context adapter
- Plugin manifest configuration
