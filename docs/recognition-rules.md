# Bill Recognition Rules Guide

This guide explains how billclaw identifies bills in your Gmail inbox and how to customize recognition rules.

## Overview

billclaw uses a multi-factor recognition system to identify bill and receipt emails:

1. **Keyword Matching** - Subject and body content analysis
2. **Sender Analysis** - Domain and email address verification
3. **Pattern Recognition** - Amount, date, and account number extraction
4. **Confidence Scoring** - Weighted factors with configurable threshold

## Recognition Process

### Step 1: Keyword Matching

The system searches for bill-related keywords in:

**Email Subject:**
- `invoice`, `statement`, `bill due`, `amount due`, `payment due`, `receipt`
- `subscription`, `membership`, `renewal`
- `your statement`, `your bill`, `your invoice`

**Email Body:**
- Same keywords as subject (lower weight)
- Contextual patterns (e.g., "monthly statement", "billing")

### Step 2: Sender Analysis

The system checks the sender against:

**Known Billing Domains:**
- `@netflix.com` - Netflix
- `@spotify.com` - Spotify
- `@att.com` - AT&T
- `@paypal.com` - PayPal
- `chase.com`, `bankofamerica.com`, `wellsfargo.com` - Banks

**Sender Whitelist (User Configured):**
- Custom domains you trust
- Specific email addresses
- Supports patterns like `@domain.com`

### Step 3: Data Extraction

The system extracts:

| Field | Pattern | Examples |
|-------|---------|---------|
| **Amount** | `$123.45`, `€99`, `123.45 USD` | `$15.99`, `€50.00`, `100 USD` |
| **Date** | YYYY-MM-DD, MM/DD/YYYY, "January 15, 2025" | `2025-02-15`, `02/15/2025`, `Feb 15, 2025` |
| **Account Number** | Account: XXXX, Ref: #XXX | `Account: 1234`, `Ref: INV-2025-001` |

### Step 4: Confidence Calculation

Confidence score (0-1) is calculated from:

| Factor | Weight | Example |
|--------|--------|---------|
| Subject keywords | +0.40 | Subject contains "invoice" |
| Body keywords | +0.20 | Body contains "payment due" |
| Known sender domain | +0.20 | From `@netflix.com` |
| Contains amount | +0.10 | Email includes `$15.99` |
| Contains date | +0.05 | Email includes due date |
| Contains account # | +0.05 | Email includes reference number |

**Final confidence** = Sum of all factors (max 1.0)

### Step 5: Bill Decision

If `confidence >= threshold` (default 0.5), email is identified as a bill.

---

## Default Bill Types

The system classifies bills into these types:

| Bill Type | Keywords | Example Senders |
|-----------|----------|-----------------|
| **credit_card_statement** | credit card, card statement, visa, mastercard, amex | `@chase.com`, `@bankofamerica.com` |
| **utility_bill** | electric, water, gas, utility, energy | `@pge.com`, `@coned.com` |
| **subscription** | netflix, spotify, amazon, adobe, subscription, membership | `@netflix.com`, `@spotify.com` |
| **insurance** | insurance, premium, policy, coverage | `@geico.com`, `@progressive.com` |
| **phone_bill** | wireless, mobile, at&t, verizon, t-mobile | `@att.com`, `@verizon.com` |
| **internet_bill** | internet, broadband, xfinity, spectrum, fiber | `@comcast.com`, `@spectrum.com` |
| **rent** | rent, lease, housing | Landlord emails |
| **loan_payment** | loan, mortgage, car payment, student loan | Lender emails |
| **invoice** | invoice, inv-, bill for services | Service providers |
| **receipt** | receipt, order confirmation, purchase | Online stores |
| **other** | (other bill types) | Uncategorized |

---

## Customizing Recognition

### Add Trusted Senders

Whitelist specific senders or domains to automatically trust their emails:

**Via CLI:**
```bash
openclaw config set billclaw.gmail.senderWhitelist '["@netflix.com","billing@paypal.com","@amazon.com"]'
```

**Via config file:**
```json
{
  "billclaw": {
    "gmail": {
      "senderWhitelist": [
        "@netflix.com",
        "billing@paypal.com",
        "@amazon.com"
      ]
    }
  }
}
```

**Patterns:**
- `@netflix.com` - Matches any email from netflix.com
- `billing@paypal.com` - Matches only this specific email
- `@domain.com` - Domain pattern matching

### Add Custom Keywords

Add keywords in multiple languages:

**Via CLI:**
```bash
openclaw config set billclaw.gmail.keywords '["invoice","facture","rechnung","factura"]'
```

**Via config file:**
```json
{
  "billclaw": {
    "gmail": {
      "keywords": [
        "invoice",    // English
        "facture",    // French
        "rechnung",   // German
        "factura"     // Spanish
      ]
    }
  }
}
```

### Adjust Confidence Threshold

Control the minimum confidence required to identify an email as a bill:

**Via CLI:**
```bash
openclaw config set billclaw.gmail.confidenceThreshold 0.7
```

**Via config file:**
```json
{
  "billclaw": {
    "gmail": {
      "confidenceThreshold": 0.7
    }
  }
}
```

**Threshold Guidelines:**
- `0.3-0.4` - Aggressive (may catch more false positives)
- `0.5` - Balanced (default)
- `0.6-0.7` - Conservative (fewer false positives)
- `0.8+` - Strict (only clear bills)

### Require Specific Fields

Force emails to contain certain data to be considered bills:

**Require amount:**
```bash
openclaw config set billclaw.gmail.requireAmount true
```

**Require due date:**
```bash
openclaw config set billclaw.gmail.requireDate true
```

**Both fields:**
```json
{
  "billclaw": {
    "gmail": {
      "requireAmount": true,
      "requireDate": true
    }
  }
}
```

---

## Recognition Examples

### Example 1: Netflix Subscription Invoice

**Email:**
```
From: Netflix <info@netflix.com>
Subject: Your Netflix Invoice for February 2025
Body: Your monthly subscription: $15.99. Due: Feb 15, 2025.
```

**Recognition Process:**
1. ✅ Subject contains "Invoice" (+0.40)
2. ✅ Sender in known billing domain (+0.20)
3. ✅ Contains amount (+0.10)
4. ✅ Contains date (+0.05)
5. **Confidence: 0.75** → ✅ Identified as bill
6. **Type:** subscription

### Example 2: Personal Email (Not a Bill)

**Email:**
```
From: Friend <friend@example.com>
Subject: Lunch tomorrow?
Body: Want to grab lunch tomorrow? Let me know.
```

**Recognition Process:**
1. ❌ No bill keywords in subject
2. ❌ Unknown sender
3. ❌ No amount
4. ❌ No date
5. **Confidence: 0.0** → ❌ Not a bill

### Example 3: Shipping Notification (Ambiguous)

**Email:**
```
From: Amazon <shipment-tracking@amazon.com>
Subject: Your package has shipped!
Body: Your Amazon package has been shipped. Estimated delivery: Feb 10, 2025.
```

**Recognition Process:**
1. ❌ No bill keywords
2. ✅ Known sender domain (amazon.com)
3. ❌ No amount
4. ✅ Contains date (+0.05)
5. **Confidence: 0.25** → ❌ Not a bill (below threshold)

---

## Tuning Recognition

### Problem: Too Many False Positives

**Symptom:** Non-bill emails identified as bills

**Solutions:**
1. **Increase confidence threshold:**
   ```bash
   openclaw config set billclaw.gmail.confidenceThreshold 0.7
   ```

2. **Require amount:**
   ```bash
   openclaw config set billclaw.gmail.requireAmount true
   ```

3. **Use more specific keywords:**
   ```bash
   openclaw config set billclaw.gmail.keywords '["invoice","statement","bill due"]'
   ```

### Problem: Missing Bills

**Symptom:** Known bills not being detected

**Solutions:**
1. **Lower confidence threshold:**
   ```bash
   openclaw config set billclaw.gmail.confidenceThreshold 0.4
   ```

2. **Add sender to whitelist:**
   ```bash
   openclaw config set billclaw.gmail.senderWhitelist '[@sender-domain.com]'
   ```

3. **Add custom keywords:**
   ```bash
   openclaw config set billclaw.gmail.keywords '["custom-keyword","your-bill-term"]'
   ```

### Problem: Wrong Bill Type

**Symptom:** Bills classified incorrectly

**Solutions:**
1. The recognition learns from sender domains and keywords
2. Check the recognition log:
   ```bash
   openclaw logs billclaw-sync
   ```
3. Add custom bill type patterns (if needed)

---

## Advanced: Custom Bill Type Patterns

Define custom keyword patterns for specific bill types:

**Via config file:**
```json
{
  "billclaw": {
    "gmail": {
      "billTypePatterns": {
        "subscription": ["netflix", "spotify", "amazon prime", "adobe", "microsoft 365"],
        "utility_bill": ["electric", "water", "gas", "power", "energy"],
        "insurance": ["geico", "progressive", "state farm", "allstate"],
        "phone_bill": ["at&t", "verizon", "t-mobile", "sprint", "comcast"]
      }
    }
  }
}
```

---

## Debugging Recognition

### Enable Detailed Logging

```bash
# Check sync logs
openclaw logs billclaw-sync
```

### Test Specific Email

You can manually test recognition by forwarding an email to yourself and running sync:

```bash
openclaw bills sync
```

### Export Recognition Results

Recognition results include:
- `confidence` - Confidence score (0-1)
- `billType` - Detected bill type
- `reasons` - Array of reasons for classification

---

## Recognition Rules Reference

### Default Keywords

| Category | Keywords |
|----------|----------|
| **Direct terms** | invoice, statement, bill due, amount due, payment due, receipt |
| **Financial terms** | your statement, your bill, your invoice, monthly statement, billing |
| **Subscription terms** | subscription, membership, renewal |

### Known Billing Domains

**Credit Cards:**
- `@chase.com`
- `@bankofamerica.com`
- `@wellsfargo.com`
- `@discover.com`
- `@americanexpress.com`

**Subscriptions:**
- `@netflix.com`
- `@spotify.com`
- `@adobe.com`
- `@microsoft.com`
- `@amazon.com`

**Utilities:**
- `@comcast.com`
- `@pge.com`
- `@coned.com`

**Payment Processors:**
- `@paypal.com`
- `@stripe.com`
- `@squareup.com`

### Confidence Score Reference

| Confidence | Interpretation |
|------------|----------------|
| 0.9-1.0 | Very high confidence (clear bill with all indicators) |
| 0.7-0.9 | High confidence (bill with most indicators) |
| 0.5-0.7 | Medium confidence (likely bill, may need confirmation) |
| 0.3-0.5 | Low confidence (possibly a bill, ambiguous) |
| 0.0-0.3 | Very low confidence (probably not a bill) |

---

## Troubleshooting Recognition Issues

### "Bill not detected"

**Diagnostic questions:**
1. Is the sender domain in the known billing list?
2. Does the subject or body contain bill keywords?
3. Is the confidence threshold too high?

**Action:**
```bash
# Check recognition reasons
openclaw logs billclaw-sync | grep "Bill:"
```

### "Wrong bill type assigned"

**Cause:** Bill type is inferred from keywords and sender domain

**Solution:** The system learns from patterns. You can manually verify and categorize in your post-processing.

### "Too many false positives"

**Action:** Increase confidence threshold or require amount

### "Missing foreign language bills"

**Solution:** Add custom keywords in your language

---

## Best Practices

1. **Start with default settings** - The default rules work for most English-language bills
2. **Add your regular senders** - Whitelist domains you frequently receive bills from
3. **Review confidence scores** - Check `openclaw logs billclaw-sync` to see why emails are classified
4. **Tune gradually** - Make small adjustments and test the impact
5. **Use realistic test data** - Test with actual bill emails from your inbox

---

## Additional Resources

- [Gmail Setup Guide](gmail-setup-guide.md) - API configuration
- [User Guide](user-guide.md) - CLI usage and workflows
- [Cost Guide](costs.md) - Gmail API pricing
- [billclaw GitHub](https://github.com/fire-zu/billclaw) - Report issues
