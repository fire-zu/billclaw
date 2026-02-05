# Webhook Event Format Reference

This document provides detailed specifications for all billclaw webhook event formats.

## Base Event Structure

All webhook events follow this base structure:

```typescript
interface BillclawEvent {
  id: string;           // Unique event identifier (format: evt_<timestamp>_<random>)
  event: string;        // Event type (see Event Types below)
  timestamp: string;    // ISO 8601 timestamp (UTC)
  version: string;      // Event format version (currently "1.0")
  data: unknown;        // Event-specific data (varies by event type)
}
```

### Example Base Event

```json
{
  "id": "evt_1j2x3k4m5p6q_abc123def",
  "event": "transaction.new",
  "timestamp": "2025-02-05T10:30:45.123Z",
  "version": "1.0",
  "data": { /* event-specific data */ }
}
```

---

## Event Types

### Transaction Events

#### `transaction.new`

Emitted when a new transaction is detected from Plaid, Gmail, or other sources.

**Event Data:**
```typescript
interface TransactionEventData {
  accountId: string;      // Account ID in billclaw
  transactionId: string;  // Unique transaction ID
  date: string;           // ISO date (YYYY-MM-DD)
  amount: number;         // Amount in cents (negative = expense, positive = income)
  currency: string;       // ISO 4217 currency code (USD, EUR, etc.)
  merchantName?: string;  // Merchant or payee name
  category?: string[];    // Category hierarchy
  paymentChannel?: string; // Payment method (online, in store, etc.)
  pending?: boolean;      // Whether transaction is pending
  source: string;         // Data source (plaid, gmail, gocardless, manual)
}
```

**Example:**
```json
{
  "id": "evt_1j2x3k4m5p6q_abc123def",
  "event": "transaction.new",
  "timestamp": "2025-02-05T10:30:45.123Z",
  "version": "1.0",
  "data": {
    "accountId": "chase-checking-456",
    "transactionId": "txn_plaid_abc123xyz",
    "date": "2025-02-05",
    "amount": -4999,
    "currency": "USD",
    "merchantName": "Amazon.com",
    "category": ["Shopping", "Electronics"],
    "paymentChannel": "online",
    "pending": false,
    "source": "plaid"
  }
}
```

#### `transaction.updated`

Emitted when a transaction's status changes (e.g., pending → posted, amount corrected).

**Event Data:** Same as `transaction.new`.

**Example:**
```json
{
  "id": "evt_1j2x3k4m5p6q_def456ghi",
  "event": "transaction.updated",
  "timestamp": "2025-02-05T11:00:00.000Z",
  "version": "1.0",
  "data": {
    "accountId": "chase-checking-456",
    "transactionId": "txn_plaid_abc123xyz",
    "date": "2025-02-05",
    "amount": -4999,
    "currency": "USD",
    "merchantName": "Amazon.com",
    "category": ["Shopping", "Electronics"],
    "paymentChannel": "online",
    "pending": false,  // Changed from true
    "source": "plaid"
  }
}
```

#### `transaction.deleted`

Emitted when a transaction is removed (rare).

**Event Data:**
```typescript
interface TransactionDeletedData {
  transactionId: string;  // ID of deleted transaction
  accountId: string;      // Account that contained the transaction
}
```

**Example:**
```json
{
  "id": "evt_1j2x3k4m5p6q_ghi789jkl",
  "event": "transaction.deleted",
  "timestamp": "2025-02-05T12:00:00.000Z",
  "version": "1.0",
  "data": {
    "transactionId": "txn_plaid_abc123xyz",
    "accountId": "chase-checking-456"
  }
}
```

---

### Sync Events

#### `sync.started`

Emitted when a sync operation begins for an account.

**Event Data:**
```typescript
interface SyncStartedData {
  accountId: string;  // Account being synced
  syncId: string;     // Unique sync operation ID
  status: "started";
}
```

**Example:**
```json
{
  "id": "evt_1j2x3k4m5p6q_mno012pqr",
  "event": "sync.started",
  "timestamp": "2025-02-05T10:30:00.000Z",
  "version": "1.0",
  "data": {
    "accountId": "chase-checking-456",
    "syncId": "sync_20250205_103000_abc",
    "status": "started"
  }
}
```

#### `sync.completed`

Emitted when a sync operation completes successfully.

**Event Data:**
```typescript
interface SyncCompletedData {
  accountId: string;
  syncId: string;
  status: "completed";
  transactionsAdded?: number;  // Number of new transactions
  transactionsUpdated?: number; // Number of updated transactions
  duration?: number;            // Duration in milliseconds
}
```

**Example:**
```json
{
  "id": "evt_1j2x3k4m5p6q_pqr345stu",
  "event": "sync.completed",
  "timestamp": "2025-02-05T10:31:00.000Z",
  "version": "1.0",
  "data": {
    "accountId": "chase-checking-456",
    "syncId": "sync_20250205_103000_abc",
    "status": "completed",
    "transactionsAdded": 15,
    "transactionsUpdated": 3,
    "duration": 60000
  }
}
```

#### `sync.failed`

Emitted when a sync operation fails.

**Event Data:**
```typescript
interface SyncFailedData {
  accountId: string;
  syncId: string;
  status: "failed";
  error: string;  // Error message
}
```

**Example:**
```json
{
  "id": "evt_1j2x3k4m5p6q_stu678vwx",
  "event": "sync.failed",
  "timestamp": "2025-02-05T10:32:00.000Z",
  "version": "1.0",
  "data": {
    "accountId": "chase-checking-456",
    "syncId": "sync_20250205_103000_abc",
    "status": "failed",
    "error": "API rate limit exceeded: 429 Too Many Requests"
  }
}
```

---

### Account Events

#### `account.connected`

Emitted when an account is successfully connected (e.g., after Plaid Link OAuth).

**Event Data:**
```typescript
interface AccountConnectedData {
  accountId: string;
  accountType: "plaid" | "gmail" | "gocardless";
  status: "connected";
}
```

**Example:**
```json
{
  "id": "evt_1j2x3k4m5p6q_vwx789yz",
  "event": "account.connected",
  "timestamp": "2025-02-05T09:00:00.000Z",
  "version": "1.0",
  "data": {
    "accountId": "chase-checking-456",
    "accountType": "plaid",
    "status": "connected"
  }
}
```

#### `account.disconnected`

Emitted when an account is disconnected by the user.

**Event Data:**
```typescript
interface AccountDisconnectedData {
  accountId: string;
  accountType: "plaid" | "gmail" | "gocardless";
  status: "disconnected";
}
```

**Example:**
```json
{
  "id": "evt_1j2x3k4m5p6q_yzab0123",
  "event": "account.disconnected",
  "timestamp": "2025-02-05T15:00:00.000Z",
  "version": "1.0",
  "data": {
    "accountId": "chase-checking-456",
    "accountType": "plaid",
    "status": "disconnected"
  }
}
```

#### `account.error`

Emitted when an account encounters an error requiring user attention.

**Event Data:**
```typescript
interface AccountErrorData {
  accountId: string;
  accountType: "plaid" | "gmail" | "gocardless";
  status: "error";
  error: string;  // Error code or message
}
```

**Common Error Codes:**
- `LOGIN_REQUIRED` - User needs to re-authenticate via Plaid Link
- `ITEM_LOGIN_REQUIRED` - Plaid item credentials expired
- `INVALID_ACCESS_TOKEN` - Access token is invalid
- `INSUFFICIENT_CREDENTIALS` - Missing credentials
- `RATE_LIMIT_EXCEEDED` - API rate limit reached

**Example:**
```json
{
  "id": "evt_1j2x3k4m5p6q_234bc567de",
  "event": "account.error",
  "timestamp": "2025-02-05T16:00:00.000Z",
  "version": "1.0",
  "data": {
    "accountId": "chase-checking-456",
    "accountType": "plaid",
    "status": "error",
    "error": "LOGIN_REQUIRED"
  }
}
```

---

### Test Events

#### `webhook.test`

Emitted when testing webhook configuration.

**Event Data:**
```typescript
interface WebhookTestData {
  message: string;       // Test message
  triggeredBy: string;   // Usually "user"
}
```

**Example:**
```json
{
  "id": "evt_1j2x3k4m5p6q_890fg123hi",
  "event": "webhook.test",
  "timestamp": "2025-02-05T17:00:00.000Z",
  "version": "1.0",
  "data": {
    "message": "Test webhook from billclaw",
    "triggeredBy": "user"
  }
}
```

---

## HTTP Request Format

### Headers

| Header | Description | Example |
|--------|-------------|---------|
| `Content-Type` | Always `application/json` | `application/json` |
| `User-Agent` | billclaw version | `billclaw/1.0` |
| `X-Billclaw-Event-Id` | Unique event identifier | `evt_1j2x3k4m5p6q_abc` |
| `X-Billclaw-Event-Type` | Event type | `transaction.new` |
| `X-Billclaw-Timestamp` | Event timestamp | `2025-02-05T10:30:45.123Z` |
| `X-Billclaw-Signature` | HMAC-SHA256 signature (if secret configured) | `sha256=abc123...` |

### Request Body

The request body is JSON containing the complete event object:

```json
{
  "id": "evt_1j2x3k4m5p6q_abc123def",
  "event": "transaction.new",
  "timestamp": "2025-02-05T10:30:45.123Z",
  "version": "1.0",
  "data": {
    // Event-specific data
  }
}
```

### Response Requirements

Your webhook endpoint should:

1. **Return quickly** - Process asynchronously if needed
2. **Return 200 OK** - To acknowledge successful delivery
3. **Return 401/403** - If signature verification fails
4. **Return 4xx/5xx** - To trigger retry (up to maxRetries)

---

## Signature Format

If a webhook secret is configured, billclaw signs all events using HMAC-SHA256.

### Signature Header

```
X-Billclaw-Signature: sha256=<signature>
```

### Signature Computation

1. Create the signature payload (event without signature field):
```json
{
  "id": "evt_1j2x3k4m5p6q_abc123def",
  "event": "transaction.new",
  "timestamp": "2025-02-05T10:30:45.123Z",
  "version": "1.0",
  "data": { /* ... */ }
}
```

2. Compute HMAC-SHA256:
```
signature = hmac_sha256(secret, json_payload)
```

3. Return as hex digest with prefix:
```
sha256=<hex_digest>
```

### Verification

See [Webhook Integration Guide](webhook-guide.md#signature-verification) for verification examples.

---

## Versioning

The `version` field indicates the event format version. Currently:
- **1.0** - Initial event format

### Backward Compatibility

- billclaw will maintain backward compatibility within major versions
- New fields may be added without changing the version
- Breaking changes will increment the major version

### Handling New Versions

Always check the `version` field:
```javascript
if (event.version !== '1.0') {
  console.warn('Unknown event version:', event.version);
  // Handle unknown version appropriately
}
```

---

## Event Ordering

Events are delivered in the order they occur within a single sync operation, but **not guaranteed** to be globally ordered:

```
sync.started → transaction.new (x15) → sync.completed
```

However, concurrent syncs may interleave events:
```
sync.started (account A) → sync.started (account B) → transaction.new (account A) → ...
```

Use the `timestamp` field to determine event order if needed.

---

## Testing Events

Use the test webhook endpoint to verify your integration:

```bash
curl -X POST http://localhost:41209/webhook/test \
  -H "Content-Type: application/json" \
  -d '{"message":"My test message"}'
```

This will emit a `webhook.test` event to all configured webhooks.

---

## Type Guards

For TypeScript users, type guards are available:

```typescript
import {
  isTransactionEvent,
  isSyncEvent,
  isAccountEvent
} from 'billclaw';

if (isTransactionEvent(event)) {
  // TypeScript knows event.data is TransactionEventData
  console.log(event.data.merchantName);
}
```

---

## Additional Resources

- [Webhook Integration Guide](webhook-guide.md) - Setup and configuration
- [User Guide](user-guide.md) - Complete usage documentation
- [GitHub Repository](https://github.com/fire-zu/billclaw) - Source code and issues
