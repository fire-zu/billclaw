/**
 * Sync command
 *
 * Manually trigger transaction sync from configured accounts.
 */

import type { CliCommand, CliContext } from "./registry.js"
import { Spinner } from "../utils/progress.js"
import { success, error, formatStatus } from "../utils/format.js"
import { Billclaw } from "@fire-la/billclaw-core"

/**
 * Run sync command
 */
async function runSync(
  context: CliContext,
  args: { account?: string; all?: boolean },
): Promise<void> {
  const { runtime } = context
  const billclaw = new Billclaw(runtime)

  const accountId = args.account
  const syncAll = args.all ?? false

  if (syncAll || !accountId) {
    await syncAllAccounts(billclaw)
  } else {
    await syncSingleAccount(billclaw, accountId)
  }
}

/**
 * Sync all configured accounts
 */
async function syncAllAccounts(billclaw: Billclaw): Promise<void> {
  const spinner = new Spinner({ text: "Getting accounts..." }).start()

  try {
    const accounts = await billclaw.getAccounts()
    spinner.succeed(`Found ${accounts.length} account(s)`)

    if (accounts.length === 0) {
      console.log("No accounts configured. Run 'billclaw setup' first.")
      return
    }

    let totalAdded = 0
    let totalUpdated = 0
    const errors: string[] = []

    for (const account of accounts) {
      const accountSpinner = new Spinner({
        text: `Syncing ${account.id}...`,
      }).start()

      try {
        let results
        switch (account.type) {
          case "plaid":
            results = await billclaw.syncPlaid([account.id])
            break
          case "gmail":
            results = await billclaw.syncGmail([account.id])
            break
          default:
            throw new Error(`Unknown account type: ${account.type}`)
        }

        const added = results.reduce((sum, r) => sum + r.transactionsAdded, 0)
        const updated = results.reduce(
          (sum, r) => sum + r.transactionsUpdated,
          0,
        )
        totalAdded += added
        totalUpdated += updated

        accountSpinner.succeed(
          `${account.id}: ${formatStatus("success")} (+${added}, ~${updated})`,
        )

        for (const result of results) {
          if (result.errors) {
            errors.push(...result.errors)
          }
        }
      } catch (err) {
        accountSpinner.fail(`${account.id}: ${(err as Error).message}`)
        errors.push(`${account.id}: ${(err as Error).message}`)
      }
    }

    console.log("")
    console.log("Sync Summary:")
    console.log(`  Transactions added: ${totalAdded}`)
    console.log(`  Transactions updated: ${totalUpdated}`)

    if (errors.length > 0) {
      console.log(`  Errors: ${errors.length}`)
      for (const err of errors) {
        console.log(`    - ${err}`)
      }
    } else {
      success("All accounts synced successfully!")
    }
  } catch (err) {
    spinner.fail("Sync failed")
    throw err
  }
}

/**
 * Sync a single account
 */
async function syncSingleAccount(
  billclaw: Billclaw,
  accountId: string,
): Promise<void> {
  const spinner = new Spinner({
    text: `Syncing account ${accountId}...`,
  }).start()

  try {
    const accounts = await billclaw.getAccounts()
    const account = accounts.find((a) => a.id === accountId)

    if (!account) {
      spinner.fail(`Account ${accountId} not found`)
      return
    }

    let results
    switch (account.type) {
      case "plaid":
        results = await billclaw.syncPlaid([accountId])
        break
      case "gmail":
        results = await billclaw.syncGmail([accountId])
        break
      default:
        throw new Error(`Unknown account type: ${account.type}`)
    }

    const added = results.reduce((sum, r) => sum + r.transactionsAdded, 0)
    const updated = results.reduce((sum, r) => sum + r.transactionsUpdated, 0)

    spinner.succeed(`Synced ${accountId}: +${added} new, ${updated} updated`)

    const errors = results.flatMap((r) => r.errors || [])
    if (errors.length > 0) {
      console.log("Errors:")
      for (const err of errors) {
        console.log(`  - ${err}`)
      }
    }
  } catch (err) {
    spinner.fail(`Sync failed: ${(err as Error).message}`)
    throw err
  }
}

/**
 * Sync command definition
 */
export const syncCommand: CliCommand = {
  name: "sync",
  description: "Manually trigger transaction sync",
  aliases: ["pull"],
  options: [
    {
      flags: "-a, --account <id>",
      description: "Specific account ID to sync",
    },
    {
      flags: "--all",
      description: "Sync all accounts (default)",
    },
  ],
  handler: (context, args) =>
    runSync(context, args as { account?: string; all?: boolean }),
}
