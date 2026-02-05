# Plaid Setup Guide

This guide walks you through setting up Plaid API credentials for billclaw. With billclaw, you maintain **data sovereignty** - your Plaid access tokens are stored locally on your machine, not on any third-party server.

## Why Use Your Own Plaid Credentials?

Traditional financial apps store your Plaid access token on their servers:

```
Traditional: User → [App Server] → Plaid API
             Token stored on App Server (you lose control)

billclaw:    User → [Local OpenClaw] → Plaid API
             Token stored locally (you keep control)
```

**Benefits:**
- Full control over your financial data
- No third-party data mining
- Your tokens never leave your machine
- You pay Plaid directly (transparent pricing)

## Step 1: Create a Plaid Account

1. Go to [Plaid Dashboard](https://dashboard.plaid.com)
2. Click **"Sign Up"** (or **"Sign In"** if you have an account)
3. Complete the registration form

## Step 2: Generate API Keys

Once logged in:

1. Navigate to **"API Keys"** in the left sidebar
2. You'll see three environments:
   - **Sandbox** - For testing (free)
   - **Development** - For development (free tier available)
   - **Production** - For live use (requires payment)

3. For each environment, note these values:

   | Field | Description | Example |
   |-------|-------------|---------|
   | **Client ID** | Your public identifier | `645a3b2c...` |
   | **Secret** | Your secret key (keep secure!) | `abcd1234...` |

## Step 3: Configure Webhooks (Optional)

For real-time transaction updates:

1. In Plaid Dashboard, go to **"Developers" → "Webhooks"**
2. Click **"Add New Webhook"**
3. Enter your webhook URL:
   - **Local testing**: Use a tunneling service like ngrok
   - **Production**: Your HTTPS endpoint

   ```
   https://your-domain.com/openclaw/webhook/billclaw
   ```

4. Select webhook types:
   - `TRANSACTIONS` - For transaction updates
   - `ITEM` - For login/token status changes

5. Note your **Webhook Key** for signature verification

## Step 4: Configure billclaw

### Option A: Using Environment Variables (Recommended)

```bash
# Add to your shell profile (~/.bashrc, ~/.zshrc, etc.)
export PLAID_CLIENT_ID="your_client_id"
export PLAID_SECRET="your_secret"
export PLAID_ENVIRONMENT="sandbox"  # sandbox|development|production
```

### Option B: Using OpenClaw Config

```bash
openclaw config set billclaw.plaid.clientId YOUR_CLIENT_ID
openclaw config set billclaw.plaid.secret YOUR_SECRET
openclaw config set billclaw.plaid.environment sandbox
```

### Option C: Using Interactive Setup Wizard

```bash
openclaw bills setup
```

The wizard will prompt you for your credentials.

## Step 5: Connect Your Bank Account

### Option A: Using Plaid Link (Recommended)

1. Run the setup wizard:
   ```bash
   openclaw bills setup
   ```

2. Select **"Plaid (US/Canada banks)"**

3. Follow the Link flow:
   - Select your bank from the list
   - Enter your bank credentials
   - Verify via MFA if required
   - Authorize data access

4. billclaw will store the access token locally

### Option B: Manual Token Configuration

If you already have a Plaid access token:

```bash
openclaw config set billclaw.accounts[0].plaidAccessToken YOUR_ACCESS_TOKEN
openclaw config set billclaw.accounts[0].plaidItemId YOUR_ITEM_ID
```

## Step 6: Sync Your Transactions

```bash
# Sync all configured accounts
openclaw bills sync

# Sync a specific account
openclaw bills sync <account_id>
```

Your transactions will be stored in:
```
~/.openclaw/billclaw/transactions/<account_id>/YYYY/MM.json
```

## Environment Differences

| Environment | Use Case | Cost | Data |
|-------------|----------|------|------|
| **Sandbox** | Development & Testing | Free | Fake/test data |
| **Development** | Pre-production | Free tier available | Real data, limited |
| **Production** | Live usage | Pay-per-use | Real data |

Start with **Sandbox** for testing, then upgrade to **Development** or **Production** when ready.

## Troubleshooting

### Invalid Credentials

**Error:** `INVALID_CREDENTIALS`

**Solution:**
- Verify your Client ID and Secret match the Plaid Dashboard
- Check that the environment matches (sandbox/development/production)

### Item Login Required

**Error:** `ITEM_LOGIN_REQUIRED`

**Solution:**
- User needs to re-authenticate via Plaid Link
- Run `openclaw bills setup` to re-link the account

### No Transactions Returned

**Possible Causes:**
- New account may have no recent transactions
- Plaid may still be processing initial data
- Check account permissions in Plaid Dashboard

### Webhook Not Receiving Events

**Checklist:**
1. Verify webhook URL is publicly accessible (not localhost)
2. Confirm webhook is active in Plaid Dashboard
3. Check firewall/security settings
4. Verify HMAC secret matches in both places

## Security Best Practices

1. **Never commit credentials to version control**
   - Use environment variables
   - Add `.env` to `.gitignore`

2. **Rotate secrets periodically**
   - Update your Plaid Secret every 90 days
   - Re-run setup wizard with new credentials

3. **Use least-privilege access**
   - Only request necessary permissions
   - Disable unused accounts in config

4. **Enable webhook signature verification**
   - Always verify HMAC signatures
   - Keeps webhook endpoint secure

## Next Steps

- [Read the User Guide](user-guide.md) for usage examples
- [Learn about costs](costs.md) and pricing
- [Check the main README](../README.md) for configuration options

## Additional Resources

- [Plaid Official Documentation](https://plaid.com/docs/)
- [Plaid Dashboard](https://dashboard.plaid.com)
- [Plaid Link Quickstart](https://plaid.com/docs/link/)
- [billclaw GitHub](https://github.com/fire-zu/billclaw)
