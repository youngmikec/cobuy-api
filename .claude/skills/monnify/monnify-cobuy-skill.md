# Monnify API Skill for Co-Buy Application
**Claude Code Reference | APIConf Lagos 2026 Hackathon**

---

## Overview
This skill maps Monnify's core APIs to Co-Buy's specific implementation requirements. Use this as a quick reference when building the backend and integrating with Monnify's payment infrastructure.

---

## 1. Core Monnify Features Used in Co-Buy

### Feature Matrix
| Feature | Co-Buy Use Case | Status | Priority |
|---------|-----------------|--------|----------|
| **Dynamic Virtual Accounts** | Per-contribution collection | ✅ CRITICAL | P0 |
| **Refunds API** | Auto-refund on poll failure | ✅ CRITICAL | P0 |
| **Single Transfers** | Payout to poll beneficiary | ✅ CRITICAL | P0 |
| **Name Enquiry (Verification)** | Validate beneficiary + member accounts | ✅ CRITICAL | P0 |
| **Webhooks** | Real-time status updates | ✅ CRITICAL | P0 |
| **Wallet Balance API** | Pre-flight checks before payout | ✅ REQUIRED | P1 |
| **Direct Debit Mandates** | Ajo/recurring contribution automation | ⏳ ROADMAP | P2 |
| **Bulk Transfers** | Multi-member payouts (future) | ⏳ ROADMAP | P2 |
| **Offline Pay-ins** | Cash collection via agents (future) | ⏳ ROADMAP | P3 |

---

## 2. Payment Collection Flow (In Depth)

### Endpoint: Init Transaction (Dynamic Accounts)
**Purpose:** Generate a unique, temporary virtual account for each contributor

**When to use in Co-Buy:**
- Member joins poll → taps "Pay my share" → backend calls this endpoint
- Account is time-boxed (~40 min) → auto-expires if unused
- Each member gets a different account (one per contribution)

**Request:**
```json
{
  "amount": 1000000,                          // kobo (₦10,000)
  "currencyCode": "NGN",
  "contractCode": "{{CONTRACT_CODE}}",
  "paymentReference": "CB-{pollId}-{memberId}-{nonce}",
  "paymentMethods": ["BANK_TRANSFER"],        // request dynamic account only
  "redirectUrl": "https://cobuy.app/payment-confirm",
  "incomeSplitConfig": null
}
```

**Response fields to extract:**
```json
{
  "accountNumber": "3004111111",              // ← Show to member
  "accountBankCode": "058",                   // ← Include in display
  "expiresAt": "2026-07-15T14:30:00Z",       // ← Show countdown timer
  "transactionReference": "mfw|ABC|123"      // ← Store for refund lookups
}
```

**Co-Buy Implementation Notes:**
- Store `accountNumber`, `accountBankCode`, `expiresAt` in `contributions` table
- Display to member with countdown timer (40 min)
- Member transfers their share amount (₦10,000 or computed share)
- Expiry → contribution status = EXPIRED (member can regenerate)

---

### Webhook: SUCCESSFUL_TRANSACTION (Collection Confirmation)
**Purpose:** Real-time notification when a bank transfer lands into a dynamic account

**Payload structure:**
```json
{
  "eventData": {
    "transactionReference": "MFWEMKA1234567",        // ← Monnify's unique ref
    "paymentReference": "CB-{pollId}-{memberId}-{nonce}",
    "paidOn": "2026-07-15T12:45:00Z",
    "amountPaid": 1000000,                            // kobo
    "transactionAmount": 1000000,
    "payer": {
      "name": "Adebayo Ogunlesi",                     // ← Store for records
      "email": "adebayo@example.com",
      "accountNumber": "2105000000",                  // ← Source account (for refunds)
      "accountBankCode": "050"                        // ← Source bank
    },
    "paymentStatus": "SUCCESSFUL",
    "currencyCode": "NGN"
  }
}
```

**Co-Buy Implementation:**
1. **Verify signature** (`monnify-signature` header via SHA-512)
2. **Deduplicate** (webhook may arrive twice; use `transactionReference` as unique key)
3. **Update contribution:** mark `state = PAID`, store `amount_paid_kobo`, `source_account_*`
4. **Recompute poll:** `amountRaised += amountPaid`; check if `amountRaised >= targetAmount`
5. **Broadcast via WebSocket:** push delta to all members in poll (thermometer jumps)
6. **Check transitions:** if poll reaches target → `OPEN → FUNDED → DISBURSING` (automatic)

**Critical:** Extract `payer.accountNumber` and `payer.accountBankCode` — these are pre-filled as the refund destination if the poll fails.

---

## 3. Payouts & Disbursements (Transfers)

### Endpoint: Name Enquiry (Pre-Flight Verification)
**Purpose:** Verify beneficiary account exists and retrieve official account name

**Must be called before EVERY transfer to avoid failures**

**Request:**
```json
{
  "accountNumber": "0123456789",
  "bankCode": "050"
}
```

**Response:**
```json
{
  "accountNumber": "0123456789",
  "accountName": "Supplier Name Ltd",         // ← MUST send this back in transfer
  "bankCode": "050",
  "bankName": "Guaranty Trust Bank"
}
```

**Co-Buy Implementation:**
- Called when poll is created (validate beneficiary account once)
- Called again before transfer (safety check)
- Store returned `accountName` in `polls.beneficiary_account_name`
- If Name Enquiry fails (invalid account) → poll state = ATTENTION, notify leader

---

### Endpoint: Single Transfer (Payout)
**Purpose:** Initiate a transfer from Co-Buy's Monnify wallet to the poll beneficiary

**When to use in Co-Buy:**
- Poll status transitions: `FUNDED → DISBURSING`
- Initiate transfer to beneficiary account
- Async mode: transfer is in-flight; final status via webhook

**Request:**
```json
{
  "reference": "CB-PAY-{pollId}-{nonce}",    // ← Unique reference
  "narration": "Co-Buy poll payout",
  "amount": 10000000,                         // kobo (₦100,000)
  "destinationAccountNumber": "0123456789",
  "destinationBankCode": "050",
  "destinationAccountName": "Supplier Name Ltd", // ← From Name Enquiry
  "async": true,                              // ← Important: don't wait for response
  "senderInfo": {
    "name": "Co-Buy Poll: Cooking Gas",       // ← Shows in beneficiary's statement
    "email": "noreply@cobuy.app"
  }
}
```

**Response:**
```json
{
  "reference": "CB-PAY-...",
  "status": "INITIATED",                      // ← NOT SUCCESS yet (async)
  "transactionRef": "MFWDISBURSE1234"
}
```

**Co-Buy Implementation:**
1. **Pre-flight checks:**
   - `Poll.status == FUNDED`?
   - Wallet balance ≥ payout amount?
   - Beneficiary account name-enquiry verified?
2. **Create `disbursements` record:** state = INITIATED
3. **Call transfer endpoint:** async mode
4. **Update poll state:** `FUNDED → DISBURSING`
5. **Wait for webhook:** (do not poll status endpoint)

**Error handling:**
- D07: Duplicate reference (same account + amount within 2 min) → retry with new reference
- D04: Insufficient wallet → poll state = DISBURSE_ATTENTION (manual)
- Invalid account details → Name Enquiry catches this (won't reach transfer)

---

### Webhook: SUCCESSFUL_DISBURSEMENT / FAILED_DISBURSEMENT
**Purpose:** Confirm transfer landed or failed

**Payload (simplified):**
```json
{
  "eventData": {
    "reference": "CB-PAY-{pollId}-{nonce}",  // ← Match to disbursements record
    "status": "SUCCESS" | "FAILED",
    "transactionRef": "MFWDISBURSE1234",
    "amount": 10000000,
    "destinationAccountNumber": "0123456789"
  }
}
```

**Co-Buy Implementation:**
- SUCCESS → disbursement state = SUCCESS → poll state = `DISBURSING → COMPLETED`
- FAILED → disbursement state = FAILED → poll state = `DISBURSING → DISBURSE_RETRY` (manual retry via dashboard)

---

## 4. Refunds (Auto-Refund on Poll Failure)

### Endpoint: Initiate Refund
**Purpose:** Automatically refund contributors when poll expires or is cancelled

**When to use in Co-Buy:**
- Poll deadline passes, target not met → poll state = EXPIRED
- Leader closes poll manually → poll state = CANCELLED
- Both → auto-transition to REFUNDING
- For each PAID contribution: initiate refund

**Critical constraint:** Cannot refund to virtual accounts (Monnify restriction). **Must refund to the source bank account** from the collection webhook.

**Request (per member):**
```json
{
  "transactionReference": "MFWEMKA1234567",  // ← FROM collection webhook
  "refundReference": "CB-RF-{contributionId}-{nonce}",
  "refundAmount": 1000000,                    // kobo
  "destinationAccountNumber": "2105000000",   // ← Source account from webhook
  "destinationAccountBankCode": "050",
  "destinationAccountName": "Adebayo O.",     // Optional but recommended
  "refundReason": "Poll target not met",
  "customerNote": "COBUY REFUND"              // Max 16 chars (shown on bank alert)
}
```

**Co-Buy Implementation:**
1. Poll status: `OPEN → EXPIRED` (auto-scheduler every 2 min)
2. Transition to REFUNDING (automatic)
3. For each membership with state = PAID:
   - Look up contribution → get source account + bank code
   - Call Refund endpoint
   - Create `refunds` record: state = INITIATED
4. Wait for webhook (do not poll)

**Constraints:**
- Minimum refund: ₦100
- Cost: ₦10 per refund from wallet (error D04 if insufficient)
- References are single-use; retries use new reference
- Refund webhook is final status (SUCCESSFUL_REFUND or FAILED_REFUND)

---

### Webhook: SUCCESSFUL_REFUND / FAILED_REFUND
**Purpose:** Confirm each refund landed or failed

**Payload:**
```json
{
  "eventData": {
    "refundReference": "CB-RF-...",           // ← Match to refunds record
    "status": "COMPLETED" | "FAILED",
    "amount": 1000000
  }
}
```

**Co-Buy Implementation:**
- COMPLETED → refund state = COMPLETED → membership state = REFUNDED
- FAILED → refund state = FAILED → poll state = REFUND_ATTENTION (manual retry)
- WebSocket broadcast: each member sees their row tick to "Refunded ✓" as webhook lands

---

## 5. Verification & Identity

### Endpoint: Name Enquiry (KYC Validation)
**Purpose:** Verify account ownership and retrieve official name

**Used in Co-Buy for:**
1. **Poll creation:** validate beneficiary account
2. **Member onboarding:** verify member's refund account
3. **Pre-transfer safety:** confirm account name before disbursement

**Request:**
```json
{
  "accountNumber": "2105000000",
  "bankCode": "050"
}
```

**Response:**
```json
{
  "accountNumber": "2105000000",
  "accountName": "Adebayo Ogunlesi",
  "bankCode": "050",
  "bankName": "Zenith Bank"
}
```

**Co-Buy UX:**
- Member enters account number + bank
- Show live confirmation: "**Adebayo Ogunlesi** — Zenith Bank. Confirm?"
- Store name in `bank_accounts.account_name`
- This becomes the refund destination

---

### Endpoint: Get Banks (Reference Data)
**Purpose:** Fetch list of supported banks with codes

**Request:**
```
GET /api/v1/banks
```

**Response:**
```json
[
  { "name": "Guaranty Trust Bank", "code": "050" },
  { "name": "Zenith Bank", "code": "057" },
  { "name": "Access Bank", "code": "044" },
  ...
]
```

**Co-Buy Implementation:**
- Cache this list at boot
- Use bank codes in dropdowns for account entry
- Avoid hardcoding bank lists

---

## 6. Wallet & Pre-Flight Checks

### Endpoint: Wallet Balance
**Purpose:** Check available funds before initiating payouts

**Request:**
```
GET /api/v1/merchant/wallet/balance
```

**Response:**
```json
{
  "walletBalance": 500000000,      // kobo (₦5,000,000)
  "reservedAmount": 0,
  "ledgerBalance": 500000000
}
```

**Co-Buy Implementation:**
- Call before initiating any transfer or refund wave
- If insufficient: poll state = ATTENTION, notify ops
- Refunds cost ₦10 each; check balance before fan-out

---

## 7. Webhook Security & Best Practices

### Signature Verification
**Every webhook includes a `monnify-signature` header:**

```
monnify-signature: SHA512(clientSecret + rawBody)
```

**Implementation:**
```typescript
import crypto from 'crypto';

function verifyMonnifySignature(rawBody: string, signature: string, clientSecret: string): boolean {
  const hash = crypto.createHmac('sha512', clientSecret)
    .update(rawBody)          // Must be raw bytes, NOT parsed JSON
    .digest('hex');
  return hash === signature;
}
```

**Critical:** Register raw-body middleware BEFORE JSON parser, or hash never matches.

---

### Webhook Processing Pipeline (Co-Buy)

```
POST /webhooks/monnify
  1. Read raw request body (before any parsing)
  2. Verify signature (SHA-512)
     └─ Mismatch? Log, return 200, mark invalid, STOP
  3. Parse JSON
  4. Insert into webhook_events (dedupe_key UNIQUE)
     └─ Duplicate? Return 200, STOP
  5. Return 200 IMMEDIATELY (best practice)
  6. Enqueue async worker job
  
Worker (async):
  ├─ Event type routing
  ├─ DB transaction with row locks
  ├─ State transitions
  └─ WebSocket broadcast
```

**Key:** Return 200 fast. Process async. Webhooks may retry if no 200 within seconds.

---

## 8. Pro Tips for Co-Buy

### 1. Webhook Over Polling
❌ **BAD:** `setInterval(() => checkTransferStatus(), 5000)`
✅ **GOOD:** Listen for SUCCESSFUL_DISBURSEMENT webhook

Webhooks are cleaner, faster, and respect rate limits.

---

### 2. MFA/OTP for Disbursements
**By default in sandbox:** MFA/OTP is ON → disbursement requires OTP email confirmation.

**For hackathon demo:** Contact Monnify (`integration-support@monnify.com`) to disable OTP on your wallet so transfers happen without human intervention.

**Request email should say:** "Hackathon context, requesting MFA/OTP disabled on sandbox disbursement wallet for automated payouts."

---

### 3. Idempotent References
Every `paymentReference`, `refundReference`, and `transfer reference` must be unique per request:

```typescript
const nonce = crypto.randomBytes(8).toString('hex');
const paymentReference = `CB-${pollId}-${memberId}-${nonce}`;
```

Do NOT reuse references. Monnify will reject or treat as duplicate.

---

### 4. Reconciliation Safety Net
Webhooks are the fast path. Polling is the safety net:

```typescript
// Every 2 minutes, poll for stuck transactions
const stuckContributions = await db.contributions.find({ 
  state: 'PENDING', 
  created_at: { $lt: Date.now() - 10*60*1000 }  // 10+ min old
});

for (const contrib of stuckContributions) {
  const status = await monnify.verifyTransaction(contrib.monnify_payment_reference);
  if (status === 'SUCCESSFUL') {
    // Webhook was lost; manually mark PAID
    await markContributionPaid(contrib.id);
  }
}
```

---

### 5. Rate Limiting
Monnify webhooks may be heavily looped if you don't acknowledge with 200. Be respectful:
- Return 200 within 5 seconds
- Process heavy logic asynchronously
- Use idempotency to survive retries

---

## 9. Error Codes Reference

### Collection Errors
| Code | Meaning | Action |
|------|---------|--------|
| R2 | Cannot refund to virtual account | Refund to source bank account only |
| R5 | Refund wallet insufficient | Check wallet balance, top up |
| R6 | Invalid account details | Name Enquiry will catch this before transfer |
| R42 | One reserved account per customer | Use dynamic accounts (not reserved) |

### Disbursement Errors
| Code | Meaning | Action |
|------|---------|--------|
| D04 | Wallet balance insufficient | Check wallet, poll state = ATTENTION |
| D05 | Duplicate transfer within 2 min | Retry with new reference after 2 min |
| D07 | Transfer to same account/amount in 2 min | Retry with new reference after 2 min |

---

## 10. Co-Buy Integration Checklist

- [ ] **Auth:** Call login endpoint, cache bearer token, refresh before 30-min expiry
- [ ] **Collections:** Init transaction → dynamic account → poll display → collection webhook → mark PAID → WebSocket push
- [ ] **Verification:** Name Enquiry for beneficiary (poll creation) + member (refund account setup)
- [ ] **Payouts:** Wallet balance check → Name Enquiry pre-flight → transfer async → disbursement webhook → state transition
- [ ] **Refunds:** Poll EXPIRED/CANCELLED → fan-out refunds (async) → refund webhooks → member updates
- [ ] **Webhooks:** Signature verification (SHA-512) → deduplicate → async processing → WebSocket broadcast
- [ ] **Reconciliation:** Cron every 2 min polling stuck PENDING/INITIATED records
- [ ] **Demo:** Disable MFA/OTP on sandbox disbursement for live demo
- [ ] **Error handling:** Wallet insufficient, invalid accounts, duplicate references, failed transfers

---

## 11. Quick API Reference Table

| Feature | Endpoint | Method | Co-Buy Use |
|---------|----------|--------|-----------|
| **Auth** | `/api/v1/auth/login` | POST | Get bearer token |
| **Init Transaction** | `/api/v1/transactions/init` | POST | Per-member dynamic account |
| **Collection Webhook** | (inbound) | POST | Mark contribution PAID |
| **Name Enquiry** | `/api/v1/disbursements/accounts/validate` | POST | Verify account (beneficiary + member) |
| **Get Banks** | `/api/v1/banks` | GET | Bank dropdown list |
| **Wallet Balance** | `/api/v1/merchant/wallet/balance` | GET | Pre-flight payout check |
| **Single Transfer** | `/api/v1/disbursements/single` | POST | Payout to beneficiary |
| **Disbursement Webhook** | (inbound) | POST | Transfer landed/failed |
| **Initiate Refund** | `/api/v1/refunds` | POST | Per-member auto-refund |
| **Refund Webhook** | (inbound) | POST | Refund landed/failed |
| **Verify Transaction** | `/api/v1/transactions/query` | GET | Reconciliation polling |

---

## 12. Monnify Documentation Links

- **Main Docs:** https://developers.monnify.com
- **API Reference:** https://developers.monnify.com/api
- **Collections:** https://developers.monnify.com/docs/collections/overview
- **Disbursements:** https://developers.monnify.com/docs/disbursements/overview
- **Webhooks:** https://developers.monnify.com/docs/webhooks/event-types
- **Verification:** https://developers.monnify.com/docs/identity-and-verification
- **Support Email:** integration-support@monnify.com

---

**This skill is the single source of truth for Monnify integration in Co-Buy. Use it for rapid reference during backend development.**
