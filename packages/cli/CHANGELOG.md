# Changelog

## 0.1.3

### Patch Changes

- Restore original publish workflow configuration to fix npm publishing.
- Updated dependencies
  - @firela/billclaw-core@0.1.3

## 0.1.2

### Patch Changes

- Update npm token and test publishing version 0.1.2.
- Updated dependencies
  - @firela/billclaw-core@0.1.2

## 0.1.1

### Patch Changes

- Fix npm publish workflow and release version 0.1.1.
- Updated dependencies
  - @firela/billclaw-core@0.1.1

## 0.1.0

### Minor Changes

- 12a088e: Implement automated version management with changesets. Added GitHub Actions workflow for automatic version PRs and publishing.

### Patch Changes

- Updated dependencies [12a088e]
  - @firela/billclaw-core@0.1.0

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial release of @fire-zu/billclaw-cli
- Standalone CLI tool for financial data management
- Interactive setup wizard (billclaw setup)
- Manual sync command (billclaw sync)
- Status monitoring command (billclaw status)
- Configuration management (billclaw config)
- Export to Beancount and Ledger (billclaw export)
- Import from CSV/OFX/QFX (billclaw import)
- Colored console output with status badges
- Progress spinners for async operations
- Table formatting for account display
- File-based configuration at ~/.billclaw/config.json
- CLI runtime adapter with console logger
- In-memory event emitter for CLI usage
