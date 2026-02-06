# billclaw Cost Guide

Understanding costs when using billclaw with your own Plaid account.

## TL;DR

- **You pay Plaid directly** - No markup, no intermediaries
- **Free tier available** - Up to 100 items (accounts) in development
- **Production usage** - Pay-per-use, typically $0.01-$0.03 per transaction sync
- **Data sovereignty** - Your tokens are local, not on a paid service's servers

---

## Traditional vs billclaw Cost Model

### Traditional Financial Apps

```
You → [App Company] → Plaid API
       ↓
    Monthly subscription fees
    + Data selling to offset costs
    + You lose data sovereignty
```

**Typical Costs:**
- Mint/YNAB/etc: Free (your data is the product)
- Paid apps: $5-$15/month (plus your data)
- Hidden cost: Your financial data sold to advertisers

### billclaw Model

```
You → [Local billclaw] → Plaid API
       ↓
    Pay Plaid directly
    + No data selling
    + Full data sovereignty
```

**Your Costs:**
- Plaid API usage (paid directly to Plaid)
- billclaw software: Free & open source
- Your data: Yours alone

---

## Plaid Pricing (as of 2025)

### Development/Sandbox Environment

**Free** for testing and development.

| Resource | Limit |
|----------|-------|
| Items (accounts) | 100 |
| Transactions | Unlimited |
| Webhooks | Included |

**Perfect for:**
- Testing billclaw setup
- Development and experimentation
- Small personal projects

### Production Environment

Pay-per-use pricing. Common tiers:

| Product | Price | Notes |
|---------|-------|-------|
| **Transactions** | ~$0.01-$0.03 per sync | Per transaction per sync |
| **Items (accounts)** | ~$0.50-$2.00 per item | Monthly, varies by tier |
| **Webhooks** | Included | No extra charge |

**Note:** Prices are approximate and subject to change. Check [Plaid Pricing](https://plaid.com/pricing) for current rates.

### Tier Examples

| Tier | Items | Transactions | Monthly Cost |
|------|-------|--------------|--------------|
| **Starter** | 1-2 items | < 500 syncs | $0-$15 |
| **Personal** | 3-5 items | 500-2000 syncs | $15-$50 |
| **Power User** | 5-10 items | 2000-5000 syncs | $50-$150 |

*Estimates based on typical usage patterns*

---

## Cost Optimization Strategies

### 1. Reduce Sync Frequency

Sync less frequently to reduce API calls:

```bash
# Change from hourly to daily
openclaw config set billclaw.sync.frequencyMinutes 1440  # 24 hours
```

**Impact:**
- Hourly (24x/day): Higher cost
- Daily (1x/day): ~96% reduction in API calls

### 2. Selective Account Syncing

Disable sync for accounts you don't need:

```json
{
  "accounts": [
    {
      "id": "checking",
      "enabled": true,
      "syncFrequency": "daily"
    },
    {
      "id": "savings",
      "enabled": false,  // Disabled
      "syncFrequency": "manual"
    }
  ]
}
```

### 3. Use Webhooks Efficiently

Webhooks are more efficient than polling:

- **Webhook:** Only called when new data available
- **Polling:** Called every X minutes regardless of updates

Configure webhooks for real-time updates without API waste:

```bash
openclaw config set billclaw.sync.frequencyMinutes 0  # Webhook-only mode
```

### 4. Development Environment for Testing

Use Sandbox/Development for testing:

```bash
openclaw config set billclaw.plaid.environment development
```

**Benefits:**
- Free to use
- Test with fake data
- No production costs

### 5. Manual Sync for Low-Activity Accounts

For accounts with infrequent transactions:

```json
{
  "accounts": [
    {
      "id": "investment-account",
      "syncFrequency": "manual"  // Only sync when you run the command
    }
  ]
}
```

---

## Sample Cost Calculations

### Scenario 1: Single Checking Account

- **Items:** 1 (checking account)
- **Transactions:** ~100 per month
- **Sync frequency:** Daily (30 syncs/month)

**Estimated Monthly Cost:**
- Item fee: ~$1-2
- Transaction syncs: 100 × $0.02 = ~$2
- **Total: ~$3-5/month**

### Scenario 2: Multiple Accounts, Frequent Sync

- **Items:** 3 (checking, savings, credit card)
- **Transactions:** ~400 per month across all accounts
- **Sync frequency:** Hourly (720 syncs/month)

**Estimated Monthly Cost:**
- Item fees: 3 × $1.50 = ~$4.50
- Transaction syncs: 400 × $0.02 × 30 days = ~$240
- **Total: ~$245/month**

**Optimization:** Reduce to daily sync → ~$15/month

### Scenario 3: Power User

- **Items:** 5 (multiple bank + investment accounts)
- **Transactions:** ~1000 per month
- **Sync frequency:** Daily (30 syncs/month)

**Estimated Monthly Cost:**
- Item fees: 5 × $1.50 = ~$7.50
- Transaction syncs: 1000 × $0.02 = ~$20
- **Total: ~$28/month**

---

## Hidden Costs of Traditional Apps

When comparing costs, consider what traditional apps do with your data:

| Practice | Traditional Apps | billclaw |
|----------|------------------|----------|
| **Data selling** | Yes (revenue source) | No |
| **Data mining** | Yes | No |
| **Advertising targeting** | Yes | No |
| **Third-party sharing** | Yes (in TOS) | No |
| **Data portability** | Limited | Full (JSON files) |
| **Token control** | On their servers | On your machine |

**Value of Data Sovereignty:**

While billclaw may have direct costs, you avoid:
- Privacy violations from data selling
- Targeted advertising based on financial data
- Lock-in to a specific service
- Risk of app shutdown losing access

---

## Cost Comparison with Alternatives

### vs. Mint (Free, but...)

| Factor | Mint | billclaw |
|--------|------|----------|
| **Direct cost** | Free | $5-30/month (Plaid fees) |
| **Data ownership** | Mint's servers | Your local storage |
| **Data selling** | Yes (ad revenue) | No |
| **Shutdown risk** | Yes (Mint shut down 2023) | No (local files) |
| **Privacy** | Low | High |

### vs. YNAB ($99/year)

| Factor | YNAB | billclaw |
|--------|------|----------|
| **Direct cost** | $99/year ($8.25/mo) | $5-30/month (Plaid fees) |
| **Data ownership** | YNAB servers | Your local storage |
| **Budgeting features** | Yes | No (import only) |
| **Privacy** | Medium | High |

### vs. Custom Plaid Integration

| Factor | Custom Development | billclaw |
|--------|-------------------|----------|
| **Development cost** | $5,000-20,000 | Free (open source) |
| **Maintenance** | Ongoing | Community-supported |
| **Setup time** | Weeks | Minutes |
| **Features** | Custom | Standard + extensible |

---

## Getting Started with Minimal Cost

### Step 1: Use Sandbox Environment (Free)

```bash
# Configure for sandbox
openclaw config set billclaw.plaid.environment sandbox
```

Test everything without spending a dime.

### Step 2: Move to Development (Free Tier)

```bash
# Switch to development
openclaw config set billclaw.plaid.environment development
```

Use real data with free-tier limits (up to 100 items).

### Step 3: Production When Ready

```bash
# Switch to production
openclaw config set billclaw.plaid.environment production
```

Only pay for what you use, directly to Plaid.

---

## Frequently Asked Questions

### Is billclaw free?

**billclaw software:** Yes, free and open source.

**Plaid API:** You pay Plaid directly for API usage. Development/sandbox is free. Production has pay-per-use pricing.

### Do I need a Plaid subscription?

No pay-as-you-go. You only pay for what you use, calculated monthly.

### Can I use billclaw without Plaid?

Not currently. Plaid is the primary data source. Future versions may support:
- GoCardless (European banks)
- Gmail bill parsing
- Manual CSV import

### What happens if I stop paying Plaid?

- Your existing transaction data remains in local storage
- You can export your data at any time
- You just can't fetch new transactions without Plaid access

### Is it cheaper than paid apps?

It depends on your usage:
- **Light users (1-2 accounts, daily sync):** Similar or slightly more than subscription apps
- **Heavy users (5+ accounts, hourly sync):** May cost more
- **Value proposition:** Data sovereignty, privacy, and no lock-in

### How do I monitor my Plaid costs?

1. Log into [Plaid Dashboard](https://dashboard.plaid.com)
2. Go to **"Billing"** or **"Usage"**
3. View real-time usage and cost estimates
4. Set up billing alerts

---

## Cost Summary

| Aspect | Details |
|--------|---------|
| **Software cost** | Free (open source) |
| **Plaid cost** | Pay-per-use, free for development |
| **Typical personal cost** | $5-30/month |
| **Payment** | Directly to Plaid (no markup) |
| **Data sovereignty** | Included (priceless) |

---

## Additional Resources

- [Plaid Official Pricing](https://plaid.com/pricing)
- [Plaid Dashboard](https://dashboard.plaid.com)
- [User Guide](user-guide.md) for setup and optimization tips
- [GitHub Repository](https://github.com/fire-zu/billclaw) for support

---

**Bottom Line:** billclaw gives you full control over your financial data. You pay Plaid directly for their API, but your tokens and transactions stay on your machine. No intermediaries, no data selling, no lock-in.
