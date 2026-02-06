# Gmail Setup Guide

This guide walks you through setting up Gmail API access for billclaw. With billclaw, you maintain **data sovereignty** - your Gmail OAuth tokens are stored locally on your machine.

## Overview

billclaw uses Gmail API to fetch bill and receipt emails from your Gmail inbox. The integration uses OAuth 2.0 for secure authentication and supports real-time push notifications via Google Cloud Pub/Sub.

## Why Use Your Own Gmail Credentials?

Traditional email parsing services:
```
You → [App Server] → Gmail API
             Token on App Server
```

**billclaw model:**
```
You → [Local billclaw] → Gmail API
      Token on your machine (data sovereignty)
```

**Benefits:**
- Full control over your email data
- No third-party email mining
- Your OAuth tokens never leave your machine
- You pay Google directly (transparent pricing)

## Prerequisites

- Google account with Gmail access
- Google Cloud Project
- Node.js 18+ installed
- billclaw plugin installed

---

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Sign in with your Google account
3. Click **"Select a project"** → **"New Project"**
4. Enter project name:
   ```
   Project name: billclaw-gmail
   Organization: (optional)
   ```
5. Click **"Create"**

---

## Step 2: Enable Gmail API

1. In the Google Cloud Console, navigate to **"APIs & Services"** → **"Library"**
2. Search for **"Gmail API"**
3. Click on it and select **"Enable"**

---

## Step 3: Configure OAuth Consent Screen

1. Navigate to **"APIs & Services"** → **"OAuth consent screen"**
2. Select **"External"** user type
3. Fill in the app information:
   - **App name**: `billclaw`
   - **User support email**: Your email
   - **Developer contact information**: Your email
   - **Authorized domains**: (optional) Add your domain
4. Click **"Save and Continue"**
5. Scopes: Click **"Add or remove scopes"** and add:
   - `.../auth/gmail.readonly`
   - `.../auth/userinfo.email`
6. Test users: Add your email address for testing
7. Click **"Save and Continue"**

---

## Step 4: Create OAuth 2.0 Client ID

1. Navigate to **"APIs & Services"** → **"Credentials"**
2. Click **"Create Credentials"** → **"OAuth client ID"**
3. Select **"Web application"** (for local development) or **"Desktop app"**
4. Configure the OAuth client:
   - **Name**: `billclaw Gmail`
   - **Authorized redirect URIs**: `http://localhost:41209/callback` (OpenClaw OAuth callback port)
5. Click **"Create"**

**Save your credentials:**
- **Client ID**: (copy this string)
- **Client Secret**: (copy this string - you won't see it again!)

---

## Step 5: Set Up Pub/Sub (Optional - For Real-Time Updates)

For real-time bill detection when new emails arrive:

### 5.1 Create Pub/Sub Topic

1. Navigate to **"Pub/Sub"** → **"Topics"**
2. Click **"Create Topic"**
3. Topic ID: `billclaw-gmail`
4. Click **"Create"**

### 5.2 Create Gmail Push Notification Watch

The watch will be configured when you run `openclaw bills setup`. For manual testing:

1. Enable Gmail API for your project
2. Configure the Pub/Sub topic in your billclaw config:

```bash
openclaw config set billclaw.gmail.pubsubTopic "projects/YOUR_PROJECT_ID/topics/billclaw-gmail"
```

---

## Step 6: Configure billclaw

### Option A: Using Environment Variables (Recommended)

```bash
# Add to your shell profile (~/.bashrc, ~/.zshrc, etc.)
export GMAIL_CLIENT_ID="your_client_id"
export GMAIL_CLIENT_SECRET="your_client_secret"

# Or configure via OpenClaw config
openclaw config set billclaw.gmail.clientId YOUR_CLIENT_ID
openclaw config set billclaw.gmail.clientSecret YOUR_CLIENT_SECRET
```

### Option B: Using Interactive Setup Wizard

```bash
openclaw bills setup
```

The wizard will prompt you for:
1. Data source selection (choose "Gmail Bills")
2. Account name (e.g., "My Gmail")
3. Gmail OAuth credentials (Client ID and Secret)

---

## Step 7: Authenticate with Gmail

### Option A: Automatic via Setup Wizard

When running `openclaw bills setup`, the wizard will automatically initiate the OAuth flow:

1. A browser window will open
2. Sign in with your Google account
3. Grant permission to access your Gmail
4. billclaw will store the OAuth token locally

### Option B: Manual OAuth Flow

```bash
# The setup wizard will provide an OAuth URL
# Open it in your browser and complete authentication
```

---

## Step 8: Test the Integration

### Fetch Bills from Last 30 Days

```bash
openclaw bills sync
# Or with Gmail account specified
openclaw bills sync gmail_001
```

### Check Status

```bash
openclaw bills status
```

Expected output:
```
📊 billclaw Status

Configured Accounts: 1

  ✅ My Gmail (gmail) - Last sync: Feb 5, 2025, 8:15 PM
```

---

## Step 9: Customize Recognition Rules (Optional)

### Add Trusted Senders

```bash
openclaw config set billclaw.gmail.senderWhitelist '["@netflix.com","billing@paypal.com"]'
```

### Add Custom Keywords

```bash
openclaw config set billclaw.gmail.keywords '["invoice","facture","rechnung"]'
```

### Adjust Confidence Threshold

```bash
openclaw config set billclaw.gmail.confidenceThreshold 0.6
```

---

## Configuration Reference

| Configuration | Type | Default | Description |
|----------------|--------|---------|-------------|
| `gmail.clientId` | string | - | Google Cloud OAuth Client ID |
| `gmail.clientSecret` | string | - | Google Cloud OAuth Client Secret (sensitive) |
| `gmail.historyId` | string | - | Gmail history ID (managed automatically) |
| `gmail.pubsubTopic` | string | - | Pub/Sub topic for push notifications |
| `gmail.senderWhitelist` | array | `[]` | Trusted email addresses/domains |
| `gmail.keywords` | array | See below | Bill detection keywords |
| `gmail.confidenceThreshold` | number | `0.5` | Minimum confidence for bill detection (0-1) |
| `gmail.requireAmount` | boolean | `false` | Require amount in bill email |
| `gmail.requireDate` | boolean | `false` | Require due date in bill email |

### Default Keywords

```json
[
  "invoice",
  "statement",
  "bill due",
  "receipt",
  "payment due"
]
```

---

## Environment-Specific Notes

### Sandbox Testing

Google doesn't provide a "sandbox" mode for Gmail API. Instead:
1. Use your personal Gmail account for testing
2. Search for existing bills (invoices, receipts) in your mailbox
3. Test with sample emails before enabling real-time sync

### Production Deployment

For production use:
1. Create a separate Google Cloud project
2. Use **Desktop app** OAuth type (not Web application)
3. Store credentials securely (never commit to version control)
4. Consider rotating credentials periodically
5. Monitor Gmail API quota (free tier: 250 quota units per day)

---

## Troubleshooting

### "Invalid Credentials" Error

**Symptom:** `Gmail API error: 401 Invalid Credentials`

**Solutions:**
1. Verify Client ID and Secret match Google Cloud Console
2. Check that OAuth token hasn't expired (tokens refresh automatically)
3. Re-authenticate: `openclaw bills setup`

### No Emails Found

**Symptom:** `Found 0 emails`

**Solutions:**
1. Check your Gmail account has emails matching bill keywords
2. Verify the search query is working:
   ```bash
   # Manually test search
   # Go to Gmail web interface and search: "invoice OR statement OR receipt after:2025/01/06"
   ```
3. Check date range (default: last 30 days)
4. Verify Gmail API is enabled in Google Cloud Console

### Permission Denied

**Symptom:** `Gmail API error: 403 Permission Denied`

**Solutions:**
1. Verify Gmail API is enabled in Google Cloud Console
2. Check OAuth consent screen includes required scopes
3. Re-authenticate to grant permissions

### Webhook Not Receiving Notifications

**Symptom:** Real-time updates not working

**Solutions:**
1. Verify Pub/Sub topic is configured: `openclaw config get billclaw.gmail.pubsubTopic`
2. Check Google Cloud Pub/Sub topic exists
3. Ensure Gmail watch is active

### Low Recognition Accuracy

**Symptom:** Bills not being detected correctly

**Solutions:**
1. Add senders to whitelist: `openclaw config set billclaw.gmail.senderWhitelist '["@netflix.com"]'`
2. Add custom keywords for your bills
3. Lower confidence threshold: `openclaw config set billclaw.gmail.confidenceThreshold 0.4`
4. Check recognition logs: `openclaw logs billclaw-sync`

---

## Gmail API Quota and Pricing

### Free Tier Limits

| Resource | Limit |
|----------|-------|
| Quota per day | 250 units |
| Cost per additional 250 units | Free (until Jan 2025) |

### Quota Unit Costs

After the free tier:
- $0.05 per 1,000 quota units (after $200 free credit)

### Quota Usage per Operation

| Operation | Quota Units |
|-----------|-------------|
| List messages | 5 |
| Get message | 5 |
| Create watch | 50 |
| Refresh watch | 50 |

**Note:** Fetching 100 bills would use ~500 quota units (2 free tier days).

---

## Security Best Practices

1. **Never commit credentials to version control**
   ```bash
   # Add to .gitignore
   .env
   ~/.openclaw/config.json
   ```

2. **Use environment variables for sensitive data**
   ```bash
   export GMAIL_CLIENT_ID="xxx"
   export GMAIL_CLIENT_SECRET="xxx"
   ```

3. **Rotate credentials periodically**
   - Update Client Secret every 90 days
   - Re-authenticate if tokens expire

4. **Principle of least privilege**
   - Grant only `gmail.readonly` scope
   - No send/delete permissions needed

5. **Monitor usage**
   - Check Gmail API usage in Google Cloud Console
   - Set up billing alerts

---

## Next Steps

- [Read the User Guide](user-guide.md) for usage examples
- [Read Recognition Rules](recognition-rules.md) for customizing detection
- [Read Cost Guide](costs.md) for Gmail API pricing

---

## Additional Resources

- [Gmail API Documentation](https://developers.google.com/gmail/api)
- [Google Cloud Console](https://console.cloud.google.com)
- [OAuth 2.0 for Mobile & Desktop Apps](https://developers.google.com/identity/protocols/oauth2)
- [Pub/Sub Documentation](https://cloud.google.com/pubsub/docs)
- [billclaw GitHub](https://github.com/fire-zu/billclaw)
