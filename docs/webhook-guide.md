# Webhook Integration Guide

This guide explains how to configure and use webhooks with billclaw to receive real-time notifications about transactions, sync events, and account status changes.

## Overview

billclaw webhooks allow you to receive HTTP POST notifications when specific events occur, such as:
- New transactions are detected
- Sync operations complete or fail
- Accounts connect, disconnect, or encounter errors
- Test webhooks for verification

## Benefits

- **Real-time updates**: Get notified immediately when new transactions arrive
- **Integration**: Connect billclaw to external systems (accounting, analytics, etc.)
- **Automation**: Trigger custom workflows based on financial events
- **Security**: HMAC-SHA256 signature verification for all webhooks

---

## Quick Start

### 1. Configure Webhook Endpoint

Add a webhook to your billclaw configuration:

**Via CLI:**
```bash
openclaw config set billclaw.webhooks '[{"enabled":true,"url":"https://your-server.com/webhook","secret":"your-secret-here","events":["transaction.new","sync.failed"]}]'
```

**Via config file (~/.openclaw/config.json):**
```json
{
  "billclaw": {
    "webhooks": [
      {
        "enabled": true,
        "url": "https://your-server.com/webhook",
        "secret": "your-secret-here",
        "events": ["transaction.new", "sync.failed"],
        "retryPolicy": {
          "maxRetries": 3,
          "initialDelay": 1000,
          "maxDelay": 30000
        }
      }
    ]
  }
}
```

### 2. Create Webhook Handler

Create an HTTP endpoint to receive webhooks:

```javascript
// Node.js/Express example
app.post('/webhook', (req, res) => {
  const signature = req.headers['x-billclaw-signature'];
  const eventId = req.headers['x-billclaw-event-id'];
  const eventType = req.headers['x-billclaw-event-type'];
  const timestamp = req.headers['x-billclaw-timestamp'];

  // Verify signature
  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (signature !== `sha256=${expectedSignature}`) {
    return res.status(401).send('Invalid signature');
  }

  // Process event
  console.log(`Received event: ${eventType} (${eventId})`);
  console.log('Data:', req.body.data);

  // Return 200 to acknowledge
  res.status(200).send('OK');
});
```

### 3. Test Your Webhook

Send a test webhook to verify your endpoint is working:

```bash
curl -X POST http://localhost:41209/webhook/test \
  -H "Content-Type: application/json" \
  -d '{"message":"Test webhook from billclaw"}'
```

---

## Configuration Reference

### Webhook Configuration

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `enabled` | boolean | No | `false` | Whether the webhook is active |
| `url` | string | Yes | - | The webhook endpoint URL |
| `secret` | string | No | - | Secret key for HMAC signature (recommended) |
| `events` | array | No | See below | Events to subscribe to |
| `retryPolicy` | object | No | See below | Retry configuration |

### Default Events

If `events` is not specified, the webhook subscribes to:
- `transaction.new`
- `sync.failed`
- `account.error`

### Retry Policy

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `maxRetries` | integer | `3` | Maximum number of retry attempts |
| `initialDelay` | integer | `1000` | Initial delay in milliseconds |
| `maxDelay` | integer | `30000` | Maximum delay between retries |

---

## Event Types

### Transaction Events

#### `transaction.new`

Emitted when a new transaction is detected:

```json
{
  "id": "evt_1234567890_abc",
  "event": "transaction.new",
  "timestamp": "2025-02-05T10:30:00Z",
  "version": "1.0",
  "data": {
    "accountId": "chase-checking",
    "transactionId": "txn_abc123",
    "date": "2025-02-05",
    "amount": -5000,
    "currency": "USD",
    "merchantName": "Amazon",
    "category": ["Shopping", "Electronics"],
    "source": "plaid"
  }
}
```

#### `transaction.updated`

Emitted when a transaction's status changes (e.g., pending → posted).

#### `transaction.deleted`

Emitted when a transaction is removed.

### Sync Events

#### `sync.started`

Emitted when a sync operation begins:

```json
{
  "id": "evt_1234567890_def",
  "event": "sync.started",
  "timestamp": "2025-02-05T10:30:00Z",
  "version": "1.0",
  "data": {
    "accountId": "chase-checking",
    "syncId": "sync_abc123",
    "status": "started"
  }
}
```

#### `sync.completed`

Emitted when a sync finishes successfully:

```json
{
  "id": "evt_1234567890_ghi",
  "event": "sync.completed",
  "timestamp": "2025-02-05T10:31:00Z",
  "version": "1.0",
  "data": {
    "accountId": "chase-checking",
    "syncId": "sync_abc123",
    "status": "completed",
    "transactionsAdded": 15,
    "transactionsUpdated": 3,
    "duration": 60000
  }
}
```

#### `sync.failed`

Emitted when a sync operation fails:

```json
{
  "id": "evt_1234567890_jkl",
  "event": "sync.failed",
  "timestamp": "2025-02-05T10:32:00Z",
  "version": "1.0",
  "data": {
    "accountId": "chase-checking",
    "syncId": "sync_abc123",
    "status": "failed",
    "error": "API rate limit exceeded"
  }
}
```

### Account Events

#### `account.connected`

Emitted when an account is successfully connected.

#### `account.disconnected`

Emitted when an account is disconnected.

#### `account.error`

Emitted when an account encounters an error:

```json
{
  "id": "evt_1234567890_mno",
  "event": "account.error",
  "timestamp": "2025-02-05T10:33:00Z",
  "version": "1.0",
  "data": {
    "accountId": "chase-checking",
    "accountType": "plaid",
    "status": "error",
    "error": "LOGIN_REQUIRED"
  }
}
```

### Test Events

#### `webhook.test`

Emitted when testing webhook configuration:

```json
{
  "id": "evt_1234567890_pqr",
  "event": "webhook.test",
  "timestamp": "2025-02-05T10:34:00Z",
  "version": "1.0",
  "data": {
    "message": "Test webhook from billclaw",
    "triggeredBy": "user"
  }
}
```

---

## HTTP Headers

All webhook requests include these headers:

| Header | Description | Example |
|--------|-------------|---------|
| `Content-Type` | Always `application/json` | `application/json` |
| `User-Agent` | Identifies billclaw | `billclaw/1.0` |
| `X-Billclaw-Event-Id` | Unique event identifier | `evt_1234567890_abc` |
| `X-Billclaw-Event-Type` | Event type | `transaction.new` |
| `X-Billclaw-Timestamp` | Event timestamp | `2025-02-05T10:30:00Z` |
| `X-Billclaw-Signature` | HMAC-SHA256 signature | `sha256=abc123...` |

---

## Signature Verification

Webhooks are signed using HMAC-SHA256 to verify authenticity.

### How to Verify

1. Extract the signature from the `X-Billclaw-Signature` header
2. Remove the `sha256=` prefix to get the raw signature
3. Compute HMAC-SHA256 of the raw request body using your secret
4. Compare using timing-safe comparison

### Node.js Example

```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  // Remove sha256= prefix
  const providedSignature = signature.replace('sha256=', '');

  // Timing-safe comparison
  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(providedSignature)
  );
}

// Usage
const isValid = verifyWebhook(
  JSON.stringify(req.body),
  req.headers['x-billclaw-signature'],
  WEBHOOK_SECRET
);

if (!isValid) {
  return res.status(401).send('Invalid signature');
}
```

### Python Example

```python
import hmac
import hashlib

def verify_webhook(payload, signature, secret):
    expected_signature = hmac.new(
        secret.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()

    # Remove sha256= prefix
    provided_signature = signature.replace('sha256=', '')

    # Constant-time comparison
    return hmac.compare_digest(expected_signature, provided_signature)

# Usage
import json
payload = json.dumps(request.json)
signature = request.headers.get('X-Billclaw-Signature', '')

if not verify_webhook(payload, signature, WEBHOOK_SECRET):
    return 'Invalid signature', 401
```

---

## Retry Logic

billclaw automatically retries failed webhook deliveries using exponential backoff:

| Attempt | Delay | Jitter |
|---------|-------|--------|
| 1 | 1 second | ±300ms |
| 2 | 2 seconds | ±600ms |
| 3 | 4 seconds | ±1.2s |

**Retry conditions:**
- Network errors (timeout, connection refused)
- 5xx server errors
- 429 rate limit errors

**No retry on:**
- 4xx client errors (400, 401, 403, 404, etc.)

---

## Testing Your Webhook

### 1. Local Testing with Ngrok

```bash
# Install ngrok
brew install ngrok

# Start your local server
node server.js

# Expose local server
ngrok http 3000

# Use ngrok URL in webhook config
openclaw config set billclaw.webhooks '[{"enabled":true,"url":"https://abc123.ngrok.io/webhook"}]'
```

### 2. Test Webhook Endpoint

```bash
# Send test event
curl -X POST http://localhost:41209/webhook/test \
  -H "Content-Type: application/json" \
  -d '{"message":"Testing my webhook"}'
```

### 3. Trigger Real Events

```bash
# Sync transactions to trigger transaction.new events
openclaw bills sync

# This will emit transaction.new events for any new transactions
```

---

## Best Practices

### 1. Use HTTPS

Always use HTTPS URLs for production webhooks to ensure data is encrypted in transit.

### 2. Verify Signatures

Always verify webhook signatures to prevent forged requests.

### 3. Return Quickly

Return a 200 status code quickly, then process the event asynchronously:

```javascript
app.post('/webhook', (req, res) => {
  // Quick verification
  if (!verifySignature(req)) {
    return res.status(401).send('Invalid');
  }

  // Acknowledge immediately
  res.status(200).send('OK');

  // Process asynchronously
  processEventAsync(req.body);
});
```

### 4. Handle Duplicates

Webhooks may be delivered multiple times. Use `eventId` for deduplication:

```javascript
const processedEvents = new Set();

app.post('/webhook', (req, res) => {
  const eventId = req.headers['x-billclaw-event-id'];

  if (processedEvents.has(eventId)) {
    return res.status(200).send('Already processed');
  }

  processedEvents.add(eventId);
  // Process event...
});
```

### 5. Log Everything

Log all webhook events for debugging:

```javascript
app.post('/webhook', (req, res) => {
  console.log({
    eventId: req.headers['x-billclaw-event-id'],
    eventType: req.headers['x-billclaw-event-type'],
    timestamp: req.headers['x-billclaw-timestamp'],
    body: req.body
  });
});
```

---

## Troubleshooting

### Webhook Not Received

**Possible causes:**
1. Webhook not enabled in config
2. URL is incorrect or unreachable
3. Server returned non-200 status
4. Signature verification failed on your end

**Solutions:**
```bash
# Check webhook configuration
openclaw config get billclaw.webhooks

# Check billclaw logs
openclaw logs billclaw

# Test with test webhook
curl -X POST http://localhost:41209/webhook/test \
  -H "Content-Type: application/json" \
  -d '{"message":"test"}'
```

### Signature Verification Failing

**Check:**
1. Secret matches between config and verification code
2. You're verifying the raw request body (not parsed JSON)
3. You're removing the `sha256=` prefix before comparison

### Duplicate Events

**Solution:** Deduplicate based on `X-Billclaw-Event-Id` header.

---

## Additional Resources

- [Event Format Reference](event-format-reference.md) - Detailed event payload documentation
- [User Guide](user-guide.md) - Complete usage documentation
- [GitHub Repository](https://github.com/fire-zu/billclaw) - Report issues
