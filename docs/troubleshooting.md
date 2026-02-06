# Troubleshooting Guide

This guide helps you diagnose and resolve common issues with billclaw.

## Table of Contents

- [Configuration Issues](#configuration-issues)
- [Credentials & Authentication](#credentials--authentication)
- [Network Issues](#network-issues)
- [Plaid Integration](#plaid-integration)
- [Gmail Integration](#gmail-integration)
- [Storage Issues](#storage-issues)
- [Sync Problems](#sync-problems)
- [Performance Issues](#performance-issues)

---

## Configuration Issues

### "billclaw not initialized"

**Error:** `The billclaw data directory does not exist.`

**Solution:**
```bash
# Run the setup wizard
openclaw bills setup
```

**What happened:**
The data directory `~/.openclaw/billclaw/` was never created. This happens on first use or after a fresh install.

---

### "No accounts configured"

**Error:** `No accounts configured yet. Run 'openclaw bills setup' first.`

**Solution:**
```bash
# Add a bank account
openclaw bills setup

# Or manually configure
openclaw config set billclaw.plaid.clientId YOUR_CLIENT_ID
openclaw config set billclaw.plaid.secret YOUR_SECRET
```

**What happened:**
billclaw has no bank accounts configured. You need to add at least one account before syncing.

---

### "Invalid configuration"

**Error:** Configuration validation failed

**Solution:**
```bash
# View current configuration
openclaw config get billclaw

# Common fixes:
openclaw config set billclaw.plaid.environment sandbox
openclaw config set billclaw.storage.path ~/.openclaw/billclaw
```

**What happened:**
Your configuration has invalid values or missing required fields.

---

## Credentials & Authentication

### "Invalid Access Token" (Plaid)

**Error:** `Your access token is invalid or has expired.`

**Solution:**
```bash
# Re-authenticate your account
openclaw bills setup

# Select the same account and re-authenticate via Plaid Link
```

**Prevention:**
- Access tokens are stored locally and automatically refreshed
- Re-authentication is only needed if credentials change

---

### "Login Required" (Plaid)

**Error:** `Your bank account requires re-authentication.`

**Solution:**
```bash
# Re-authenticate via setup wizard
openclaw bills setup

# This will open Plaid Link where you can log into your bank
```

**Why this happens:**
- Bank credentials changed (password update)
- Account requires MFA verification
- Bank session expired

---

### "Gmail Authentication Failed"

**Error:** `Your Gmail access has expired or been revoked.`

**Solution:**
```bash
# Re-authenticate with Gmail
openclaw bills setup

# Select Gmail as the data source and complete OAuth flow
```

**Verification:**
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Check that Gmail API is enabled
3. Verify OAuth credentials are valid

---

### "Invalid API Credentials"

**Error:** `The Plaid/Gmail API credentials configured are invalid.`

**Solution:**

**For Plaid:**
```bash
openclaw config set billclaw.plaid.clientId YOUR_CLIENT_ID
openclaw config set billclaw.plaid.secret YOUR_SECRET
```

**For Gmail:**
```bash
openclaw config set billclaw.gmail.clientId YOUR_CLIENT_ID
openclaw config set billclaw.gmail.clientSecret YOUR_CLIENT_SECRET
```

**Verification:**
- Plaid: Check credentials at https://dashboard.plaid.com
- Gmail: Check credentials at https://console.cloud.google.com

---

## Network Issues

### "Connection Refused"

**Error:** `Could not connect to the server.`

**Diagnosis:**
```bash
# Check internet connection
ping -c 3 api.plaid.com

# Check DNS resolution
nslookup api.plaid.com

# Test HTTPS
curl -I https://api.plaid.com
```

**Solutions:**
1. Check your internet connection
2. Disable VPN if you're using one
3. Check firewall settings
4. Try again in a few minutes

---

### "Request Timeout"

**Error:** `The request took too long to complete.`

**Solutions:**
1. Check internet connection speed
2. Reduce the number of transactions being synced
3. Try syncing during off-peak hours
4. Increase timeout in configuration (if configurable)

---

### "DNS Resolution Failed"

**Error:** `Could not resolve the server address.`

**Solutions:**
```bash
# Flush DNS cache
# macOS:
sudo dscacheutil -flushcache

# Linux:
sudo systemd-resolve --flush-caches

# Windows:
ipconfig /flushdns

# Try Google DNS (8.8.8.8)
```

---

## Plaid Integration

### "Item Login Required"

**Error:** `Your bank account requires re-authentication.`

**Solution:**
```bash
openclaw bills setup
# Select your account and complete Plaid Link
```

**Why this happens:**
- Bank credentials changed
- Account requires MFA
- Token expired (typically 30 days for some banks)

---

### "Invalid Credentials"

**Error:** `Plaid API credentials are invalid.`

**Solution:**
```bash
openclaw config set billclaw.plaid.clientId YOUR_CLIENT_ID
openclaw config set billclaw.plaid.secret YOUR_SECRET
```

**Verification:**
- Check credentials at https://dashboard.plaid.com
- Ensure you're using the correct environment (sandbox/development/production)

---

### "Rate Limit Exceeded"

**Error:** `Too many requests to Plaid API.`

**Solution:**
1. Wait a few minutes before syncing again
2. Reduce sync frequency
3. Check your Plaid plan limits at https://dashboard.plaid.com

**Prevention:**
- Use webhook for real-time updates instead of polling
- Sync less frequently (daily instead of hourly)

---

### "Institution Down"

**Error:** `Bank temporarily unavailable.`

**Solution:**
1. Wait a few minutes and try again
2. Check bank's website for service status
3. Transactions will sync automatically when bank is back online

---

## Gmail Integration

### "Gmail API Not Found"

**Error:** `The Gmail API endpoint could not be found.`

**Solution:**
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Search for "Gmail API"
3. Click "Enable"

---

### "Access Denied"

**Error:** `Gmail access was denied. Missing permissions.`

**Solution:**
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to "APIs & Services" → "OAuth consent screen"
3. Add scope: `.../auth/gmail.readonly`
4. Re-authenticate: `openclaw bills setup`

---

### "Rate Limit Exceeded"

**Error:** `Too many requests to Gmail API.`

**Solution:**
1. Wait until tomorrow when quota resets
2. Reduce sync frequency
3. Use Gmail push notifications instead of polling
4. Check quota at [Gmail API docs](https://developers.google.com/gmail/api/v1/quota)

**Free Tier:**
- 250 quota units/day
- Fetching 100 bills uses ~500 quota units (2 days of free tier)

---

### "No Emails Found"

**Error:** `Found 0 emails matching search criteria.`

**Diagnosis:**
```bash
# Check Gmail search manually
# Go to Gmail web interface and search: "invoice OR statement OR receipt after:2025/01/06"
```

**Solutions:**
1. Verify Gmail has emails matching bill keywords
2. Check date range (default: last 30 days)
3. Ensure Gmail API is enabled
4. Add sender to whitelist: `openclaw config set billclaw.gmail.senderWhitelist '[@domain.com]'`

---

## Storage Issues

### "Permission Denied"

**Error:** `Cannot access file or directory. Missing permissions.`

**Solution:**
```bash
# Check permissions
ls -la ~/.openclaw/billclaw/

# Fix permissions (Linux/macOS)
chmod -R u+rw ~/.openclaw/billclaw/

# If directory doesn't exist:
mkdir -p ~/.openclaw/billclaw/
```

---

### "Disk Full"

**Error:** `No space left on device.`

**Solution:**
```bash
# Check disk space
df -h

# Find large files
du -sh ~/.openclaw/billclaw/transactions/*/*

# Free up space by removing old data
# (Only if you're sure you don't need it)
```

---

### "Corrupted Data"

**Error:** `Cannot read transaction data. File may be corrupted.`

**Solution:**
```bash
# Check file integrity
ls -l ~/.openclaw/billclaw/transactions/

# Remove corrupted files (data will be resynced)
rm ~/.openclaw/billclaw/transactions/<corrupted_file>

# Re-sync to recover data
openclaw bills sync
```

---

## Sync Problems

### "Sync Failed"

**Error:** `Sync operation failed.`

**Diagnosis:**
```bash
# Check sync status
openclaw bills status

# Check logs for details
openclaw logs billclaw-sync
```

**Common causes:**
1. Network connectivity issues
2. Invalid credentials
3. Bank maintenance
4. Rate limiting

---

### "No New Transactions"

**Error:** `Sync completed but 0 new transactions.`

**Possible causes:**
1. All transactions are already synced (check `openclaw bills status`)
2. Date range doesn't include new transactions
3. Bank hasn't posted new transactions yet

**Solution:**
```bash
# Check last sync time
openclaw bills status

# Force full sync (not yet implemented, coming soon)
# For now, check if there are actually new transactions in your bank account
```

---

### "Duplicate Transactions"

**Issue:** Seeing duplicate transactions after sync.

**Solution:**
```bash
# This should not happen as billclaw has deduplication built-in

# If you see duplicates, report a bug at:
# https://github.com/fire-zu/billclaw/issues
```

---

## Performance Issues

### "Slow Sync"

**Issue:** Sync taking longer than expected.

**Solutions:**
1. Reduce sync date range
2. Sync less frequently
3. Check internet connection speed
4. Use webhook for real-time updates instead of polling

---

### "High Memory Usage"

**Issue:** billclaw using too much memory.

**Solutions:**
1. Reduce sync batch size (if configurable)
2. Sync accounts individually instead of all at once
3. Check for memory leaks (report as bug)

---

## Getting Help

### Check Status

```bash
# View account and sync status
openclaw bills status
```

### View Logs

```bash
# View recent logs
openclaw logs billclaw-sync

# View all logs
openclaw logs
```

### Run Diagnostics

```bash
# (Coming soon) Diagnostic command
openclaw bills diagnose
```

### Report Issues

If you can't resolve the issue:

1. **Check the GitHub Issues:** https://github.com/fire-zu/billclaw/issues
2. **Search for similar issues:** Your problem may already be solved
3. **Create a new issue:** Include:
   - Error message
   - Steps to reproduce
   - System information (OS, Node version)
   - Logs from `openclaw logs`

### Community Support

- **OpenClaw Discord:** https://discord.gg/openclaw
- **GitHub Discussions:** https://github.com/fire-zu/billclaw/discussions

---

## Additional Resources

- [User Guide](user-guide.md) - Complete usage documentation
- [Plaid Setup Guide](plaid-setup-guide.md) - Plaid configuration
- [Gmail Setup Guide](gmail-setup-guide.md) - Gmail configuration
- [Webhook Guide](webhook-guide.md) - Webhook integration
- [Cost Guide](costs.md) - Understanding API costs
