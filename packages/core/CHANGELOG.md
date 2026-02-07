# Changelog

## 0.1.0

### Minor Changes

- 12a088e: Implement automated version management with changesets. Added GitHub Actions workflow for automatic version PRs and publishing.

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial release of @fire-zu/billclaw-core
- Framework-agnostic core business logic
- Data models with Zod validation
- Transaction storage with JSON/CSV support
- File locking for concurrent access safety
- Streaming JSON support for large datasets
- Memory cache with TTL-based expiration
- Query indexes for improved performance
- Plaid integration for bank transactions
- Gmail integration for bill parsing
- Beancount and Ledger exporters
- Platform keychain integration
- Audit logging for security events
- Runtime abstractions (Logger, ConfigProvider, EventEmitter)

### Security

- Platform keychain storage for credentials
- HMAC signing for webhook verification
- Audit logging for credential operations
