/**
 * Configuration management module
 *
 * Provides unified configuration management for BillClaw with:
 * - Singleton ConfigManager
 * - Environment variable overrides
 * - File locking for concurrent access
 * - Hybrid caching (TTL + mtime validation)
 *
 * @packageDocumentation
 */

export {
  ConfigManager,
  type ConfigManagerOptions,
} from "./config-manager.js"

export {
  loadEnvOverrides,
  getEnvValue,
  hasEnvOverrides,
  getEnvMappings,
} from "./env-loader.js"
