/**
 * CLI config provider implementation
 *
 * File-based configuration provider for standalone CLI usage.
 */

import * as fs from "node:fs"
import * as path from "node:path"
import * as os from "node:os"
import type { ConfigProvider, BillclawConfig } from "@firela/billclaw-core"

/**
 * CLI config provider options
 */
export interface CliConfigOptions {
  configDir?: string
  configPath?: string
}

/**
 * Default config directory path
 */
function getDefaultConfigDir(): string {
  const home = os.homedir()
  return path.join(home, ".billclaw")
}

/**
 * CLI config provider implementation
 */
export class CliConfigProvider implements ConfigProvider {
  private configPath: string
  private cachedConfig?: BillclawConfig

  constructor(options: CliConfigOptions = {}) {
    const configDir = options.configDir ?? getDefaultConfigDir()
    this.configPath = options.configPath ?? path.join(configDir, "config.json")
  }

  async getConfig(): Promise<BillclawConfig> {
    if (this.cachedConfig) {
      return this.cachedConfig
    }

    try {
      const content = await fs.promises.readFile(this.configPath, "utf-8")
      this.cachedConfig = (JSON.parse(content) as BillclawConfig)
      return this.cachedConfig
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        // Return default config if file doesn't exist
        this.cachedConfig = this.getDefaultConfig()
        return this.cachedConfig
      }
      throw err
    }
  }

  async getStorageConfig(): Promise<any> {
    const config = await this.getConfig()
    return (
      config.storage || {
        path: "~/.billclaw/data",
        format: "json",
        encryption: { enabled: false },
      }
    )
  }

  async updateAccount(accountId: string, updates: Partial<any>): Promise<void> {
    const config = await this.getConfig()
    const accountIndex = config.accounts.findIndex((a) => a.id === accountId)

    if (accountIndex === -1) {
      throw new Error(`Account ${accountId} not found`)
    }

    config.accounts[accountIndex] = {
      ...config.accounts[accountIndex],
      ...updates,
    }

    await this.saveConfig(config)
    this.cachedConfig = config
  }

  async getAccount(accountId: string): Promise<any | null> {
    const config = await this.getConfig()
    return config.accounts.find((a) => a.id === accountId) || null
  }

  async saveConfig(config: BillclawConfig): Promise<void> {
    const configDir = path.dirname(this.configPath)

    // Ensure config directory exists
    await fs.promises.mkdir(configDir, { recursive: true })

    // Write config atomically
    const tmpPath = `${this.configPath}.tmp`
    await fs.promises.writeFile(
      tmpPath,
      JSON.stringify(config, null, 2),
      "utf-8",
    )
    await fs.promises.rename(tmpPath, this.configPath)

    this.cachedConfig = config
  }

  private getDefaultConfig(): BillclawConfig {
    return {
      version: 1,
      accounts: [],
      webhooks: [],
      storage: {
        path: path.join(os.homedir(), ".billclaw"),
        format: "json",
        encryption: { enabled: false },
      },
      sync: {
        defaultFrequency: "manual",
        maxRetries: 3,
        retryOnFailure: true,
      },
      plaid: {
        environment: "sandbox",
      },
      connect: {
        port: 4456,
        host: "localhost",
      },
    }
  }
}

/**
 * Create a default CLI config provider
 */
export function createConfigProvider(
  options?: CliConfigOptions,
): CliConfigProvider {
  return new CliConfigProvider(options)
}
