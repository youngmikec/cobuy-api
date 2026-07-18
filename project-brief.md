# Co-Buy: Community Pooling Platform — Complete Project Brief (v2)
**API Conference Lagos 2026 Developer Challenge (Monnify-powered) | Deadline: July 21, 2026**

---

## 1. Executive Summary

**Co-Buy** is a flexible, general-purpose community pooling platform that enables groups to pool money for any purpose: bulk purchases, group fundraising, home repairs, business capital, ajo (rotating savings), or any collective financial goal. Users create a pool (or "poll") with a target amount; members join and contribute via bank transfer to unique, temporary virtual accounts; when the target is reached, the full amount is automatically transferred to a beneficiary's account (verified via Monnify); if the deadline expires before the target is met, every contributor is automatically refunded.

**Key innovation:** The beneficiary does not need to be a user in the system — just an account number and bank name. This unlocks use cases like collective fundraising for non-members (community projects, family emergencies, school repairs, ajo payouts to external recipients).

**Core Monnify integration:** dynamic virtual accounts (collections), transaction splitting (optional for split payouts), refunds, webhooks, name enquiry, wallet balance checks, and real-time state reconciliation via WebSocket.

**Target users:** communities, savings circles (ajo/esusu), informal groups, cooperatives, and anyone who needs to pool money for a shared goal in Nigeria.

**Hackathon focus:** demonstrate depth of Monnify API usage, trustworthy money handling, flexible poll mechanics (split even/uneven, any category), and a compelling demo moment (share link → QR → join → payment → live thermometer → payout).

---

## 2. Problem & Solution

### The Problem
Nigerians pool money every day — for bulk purchases (rice, gas), rotating savings (ajo/esusu), emergency fundraising (medical bills, repairs), business capital, or community projects — but organizing collective contributions involves:
- Cash collection (theft, loss, disputes)
- Manual tracking (spreadsheets, error-prone)
- Trust issues (who holds the money? who's actually paid?)
- Refunds on failure (chasing people for their money back)
- Friction in sharing (word-of-mouth only, no trackable link)

### The Solution
**Co-Buy digitizes the pooling layer.** Anyone creates a pool with a name, target amount, deadline, and beneficiary account (internal user or external account). Members join via a sharable link or QR code, pay to unique, Monnify-issued temporary accounts, and the platform handles collection, verification, automatic payout, and refunds — all auditable via webhooks and a PostgreSQL ledger.

**Use cases enabled:**
- **Bulk purchasing:** buy rice, gas, building materials at wholesale prices
- **Ajo/Esusu:** rotating savings groups with automated payouts to each member's turn
- **Fundraising:** medical bills, school fees, home repairs, emergency relief
- **Group contributions:** pooling for community projects, team gifts, business capital
- **Any collective goal:** if a group needs to pool money, Co-Buy handles it

---

## 3. Core Mechanic & User Flows

### 3.1 The All-or-Nothing Poll Model

```
User 1 (Leader) creates a poll:
├─ Name: "Buy cooking gas for Street 5 residents"
├─ Description: "Bulk buy from distributor, split cost"
├─ Category: "Bulk Purchase" (or "Ajo", "Fundraising", "Repair", etc.)
├─ Target amount: ₦200,000
├─ Deadline: 2 weeks
├─ Max members: 20
├─ Split even: TRUE (system auto-calculates ₦10,000 per member)
├─ Beneficiary (external, no user account needed):
│    ├─ Account number: "0123456789"
│    ├─ Bank name: "Dangote Gas Ltd"
│    └─ Account holder: "Gas Distribution"
├─ Poll status: OPEN (default)
├─ Slots remaining: 20
└─ Generate share link: "https://cobuy.app/join/abc123xyz"
   └─ + Generate QR code for the link

Users 2–21 join via share link or scan QR:
├─ Each enters their refund bank account (verified live via Name Enquiry)
├─ Each sees: "Your share: ₦10,000 (1 of 20 slots)"
├─ Taps "Pay my share"
├─ Receives unique 40-min virtual account (e.g., 3004111111)
├─ Transfers ₦10,000 via their bank app
├─ Payment lands → webhook fires → contribution marked PAID
├─ Slots remaining: 19 → 18 → ... (live on all phones)
└─ Other members' phones show thermometer jump in real time

When poll reaches target (at 20 members):
├─ State: OPEN → FUNDED (automatic)
├─ Verify beneficiary account via Monnify Name Enquiry
├─ Initiate transfer: ₦200,000 to "0123456789" at Dangote Gas
├─ State: FUNDED → DISBURSING
├─ Disbursement webhook lands
└─ State: DISBURSING → COMPLETED; members see "Poll funded 🎉 → Gas distributor paid"

Ajo use case example:
├─ Name: "Street 5 Ajo - August Round"
├─ Category: "Ajo/Esusu"
├─ Target: ₦100,000
├─ Max members: 10 (₦10,000 each)
├─ Beneficiary (different each month): currently Adebayo Ogunlesi's account
├─ When filled → ₦100,000 paid to Adebayo
├─ Next month: new poll, same group, beneficiary = next member in rotation
├─ System tracks history so members can see who got paid when

If poll expires (deadline passes, target not met):
├─ State: OPEN → EXPIRED
├─ Automatically transition to REFUNDING
├─ Initiate one refund per PAID member, back to their verified account
├─ Refund webhooks land
└─ Members see "Refunding…" → each row ticks to "Refunded ✓" live
```

---

## 4. Poll Mechanics & Features

### 4.1 Poll Structure

**Field set (revised):**
```
polls {
  id: UUID
  leader_user_id: UUID
  name: string                    -- "Buy cooking gas", "Street 5 Ajo August", "Repair community center"
  description: string             -- detailed explanation
  category: enum                  -- "BulkPurchase", "Ajo", "Fundraising", "Repair", "Investment", "Custom"
  targetAmount: bigint (kobo)
  amountRaised: bigint (kobo)    -- running total, updated per webhook
  
  beneficiary_account_number: string
  beneficiary_bank_name: string   -- or bankCode
  beneficiary_account_name: string -- from Monnify Name Enquiry
  beneficiary_user_id: UUID (nullable) -- if beneficiary is a Co-Buy member
  
  deadline_at: timestamp
  maxMembers: integer
  slotsRemaining: integer         -- auto-computed: maxMembers - joined_count
  splitEven: boolean              -- if true, system calculates share = targetAmount / maxMembers
  memberShareAmount: bigint       -- computed if splitEven=true, or set manually if false
  
  status: enum                    -- OPEN, CLOSED, EXPIRED, ALMOSTFUL, COMPLETED, REFUNDING, REFUNDED
  
  share_link: string              -- "https://cobuy.app/join/{shareToken}"
  share_qr_code: string           -- base64-encoded QR code image
  
  created_at: timestamp
  state_changed_at: timestamp
}
```

### 4.2 Share Link & QR Code Generation

**On poll creation:**
1. Backend generates a unique `shareToken` (e.g., 16-char random string)
2. Creates share link: `https://cobuy.app/join/{shareToken}`
3. Encodes link into QR code (using a library like `qrcode` for Node.js or `qr_flutter` for Flutter)
4. Stores both in `polls.share_link` and `polls.share_qr_code`

**Mobile flow:**
- Leader taps "Share poll"
- Options: copy link, send via WhatsApp/SMS, display QR on screen
- Others scan QR or tap link → app navigates to `/join/{shareToken}` → shows poll details + "Join" button

**Backend validation:**
```
GET /polls/join/{shareToken}
├─ Look up poll by shareToken
├─ Check status is OPEN
├─ Check deadline hasn't passed
├─ Check slots remaining > 0
└─ Return poll details + join form

POST /polls/{pollId}/members (with shareToken validation)
├─ Verify token matches poll
├─ Add membership
└─ Proceed with refund account verification
```

### 4.3 Poll Status States

- **OPEN:** accepting members (default after creation)
- **ALMOSTFUL:** target nearly reached (e.g., 90% funded) — UX hint to close early or wait for final slots
- **CLOSED:** leader manually closed before deadline (auto-refund any paid members)
- **FUNDED:** target reached (automatic transition)
- **DISBURSING:** transfer to beneficiary in flight
- **COMPLETED:** beneficiary paid, poll settled
- **EXPIRED:** deadline hit, target not met (auto-transition to REFUNDING)
- **REFUNDING:** auto-refunds in flight
- **REFUNDED:** all members refunded, poll settled

---

## 5. Architecture Overview

```
┌─────────────────┐         REST + WebSocket          ┌─────────────────┐
│   Flutter app   │◄──────────────────────────────────►│   API server    │
│  (members +     │                                    │  (Node/Nest or  │
│   leader)       │                                    │   FastAPI)      │
└─────────────────┘                                    └────────┬────────┘
                                                               │
                                                    ┌──────────┼──────────┐
                                                    ▼          ▼          ▼
                                             ┌────────┐ ┌──────────┐ ┌──────────┐
                                             │ Monnify│ │PostgreSQL│ │Redis/Queue
                                             │  API   │ │ (ledger) │ │(webhooks)
                                             └────┬───┘ └──────────┘ └──────────┘
                                                  │
                                                  │ webhooks
                                                  ▼
                                         /webhooks/monnify
                                                  │
                                         (verify → dedupe → process)
```

---

## 6. Revised Data Model

```sql
-- Users and accounts
users
  id UUID PRIMARY KEY
  phone VARCHAR(15) UNIQUE
  verified_at TIMESTAMP
  created_at TIMESTAMP

bank_accounts
  id UUID PRIMARY KEY
  user_id UUID FOREIGN KEY
  account_number VARCHAR(20)
  bank_code VARCHAR(10)
  account_name VARCHAR(255)
  verified_at TIMESTAMP
  created_at TIMESTAMP

-- Polls (generalized, formerly "pools")
polls
  id UUID PRIMARY KEY
  leader_user_id UUID FOREIGN KEY
  
  name VARCHAR(255)
  description TEXT
  category VARCHAR(50)              -- "BulkPurchase", "Ajo", "Fundraising", "Repair", "Investment", "Custom"
  
  targetAmount_kobo BIGINT
  amountRaised_kobo BIGINT DEFAULT 0
  memberShareAmount_kobo BIGINT     -- per-member share (computed or set)
  splitEven BOOLEAN DEFAULT true    -- if true, share = target / maxMembers
  
  beneficiary_account_number VARCHAR(20)
  beneficiary_bank_name VARCHAR(255)
  beneficiary_account_name VARCHAR(255)  -- from Monnify Name Enquiry
  beneficiary_user_id UUID (nullable)    -- if beneficiary is a member
  
  maxMembers INT
  slotsRemaining INT                -- computed
  
  share_link VARCHAR(255)           -- "https://cobuy.app/join/{shareToken}"
  share_token VARCHAR(32) UNIQUE    -- for looking up poll by share link
  share_qr_code LONGBLOB (nullable) -- base64 encoded or URL to image
  
  deadline_at TIMESTAMP
  status VARCHAR(50)                -- OPEN, CLOSED, EXPIRED, ALMOSTFUL, FUNDED, DISBURSING, COMPLETED, REFUNDING, REFUNDED
  
  created_at TIMESTAMP
  state_changed_at TIMESTAMP

-- Memberships
memberships
  id UUID PRIMARY KEY
  poll_id UUID FOREIGN KEY
  user_id UUID FOREIGN KEY
  refund_account_id UUID FOREIGN KEY → bank_accounts
  
  state VARCHAR(50)                 -- JOINED, AWAITING_PAYMENT, PAID, REFUND_PENDING, REFUNDED, REFUND_FAILED
  joined_at TIMESTAMP

-- Contributions (payments into the poll)
contributions
  id UUID PRIMARY KEY
  membership_id UUID FOREIGN KEY
  poll_id UUID FOREIGN KEY
  
  monnify_payment_reference VARCHAR(64) UNIQUE
  monnify_transaction_reference VARCHAR(64)
  
  dynamic_account_number VARCHAR(20)
  dynamic_account_bank VARCHAR(10)
  dynamic_account_expires_at TIMESTAMP
  
  amount_expected_kobo BIGINT
  amount_paid_kobo BIGINT
  
  source_account_number VARCHAR(20)
  source_bank_code VARCHAR(10)
  source_account_name VARCHAR(255)
  
  state VARCHAR(50)                 -- PENDING, PAID, OVERPAID, UNDERPAID, EXPIRED
  paid_at TIMESTAMP
  created_at TIMESTAMP

-- Disbursements (payouts to beneficiary)
disbursements
  id UUID PRIMARY KEY
  poll_id UUID FOREIGN KEY
  beneficiary_type VARCHAR(50)      -- "USER", "EXTERNAL_ACCOUNT"
  beneficiary_user_id UUID (nullable)
  
  monnify_reference VARCHAR(64) UNIQUE
  destination_account VARCHAR(20)
  destination_bank_code VARCHAR(10)
  destination_account_name VARCHAR(255)
  
  amount_kobo BIGINT
  state VARCHAR(50)                 -- INITIATED, SUCCESS, FAILED, REVERSED
  initiated_at TIMESTAMP
  finalized_at TIMESTAMP
  created_at TIMESTAMP

-- Refunds
refunds
  id UUID PRIMARY KEY
  contribution_id UUID FOREIGN KEY
  poll_id UUID FOREIGN KEY
  
  refund_reference VARCHAR(64) UNIQUE
  monnify_transaction_reference VARCHAR(64)
  
  destination_account VARCHAR(20)
  destination_bank_code VARCHAR(10)
  
  amount_kobo BIGINT
  state VARCHAR(50)                 -- INITIATED, COMPLETED, FAILED
  initiated_at TIMESTAMP
  finalized_at TIMESTAMP
  created_at TIMESTAMP

-- Webhook audit trail
webhook_events
  id UUID PRIMARY KEY
  event_type VARCHAR(100)
  monnify_reference VARCHAR(64)
  raw_payload JSONB
  signature_valid BOOLEAN
  processed_at TIMESTAMP
  dedupe_key VARCHAR(255) UNIQUE
  created_at TIMESTAMP
```

---

## 7. Poll State Machine

```
OPEN (default)
  ├─ (member joins) → OPEN (loop)
  ├─ (collection webhook lands) → update amountRaised, check if target hit
  │  └─ amountRaised ≥ target → FUNDED
  ├─ amountRaised ≥ 0.9 * target → ALMOSTFUL (UX hint, no state change)
  ├─ (leader closes manually) → CLOSED
  │  └─ auto-refund any paid members → REFUNDING → REFUNDED
  ├─ (deadline hits, amountRaised < target) → EXPIRED
  │  └─ auto-cascade → REFUNDING → REFUNDED

FUNDED
  ├─ (auto, immediate)
  └─→ DISBURSING
         ├─ (disbursement webhook SUCCESS)
         └─→ COMPLETED (terminal)
         ├─ (disbursement webhook FAILED or REVERSED)
         └─→ DISBURSE_RETRY (manual)

COMPLETED (terminal)
  └─ Beneficiary paid, poll settled

REFUNDING
  ├─ (all refund webhooks COMPLETED)
  └─→ REFUNDED (terminal)
  ├─ (any refund FAILED)
  └─→ REFUND_ATTENTION (manual)

REFUNDED (terminal)
  └─ All members refunded, poll settled
```

---

## 8. User Flows

### 8.1 Create Poll

```
Leader taps "Create Poll"
├─ Enter name, description, category
├─ Enter target amount
├─ Enter max members
├─ Toggle "Split even" (if true, share auto-calculates)
├─ Enter deadline
├─ Enter beneficiary (choose: self, another Co-Buy user, or external account)
│  ├─ If self: use leader's verified account
│  ├─ If another user: search + confirm (that user doesn't need to "accept")
│  └─ If external: enter account number + bank name + account holder name
│     └─ Monnify Name Enquiry verifies it live
├─ Review + create
└─ Poll status: OPEN, share link + QR generated

Share flow (optional, immediate):
├─ Tap "Share poll"
├─ Options: copy link, WhatsApp, SMS, display QR code on screen
└─ Others tap link → join poll
```

### 8.2 Join Poll

```
User taps share link or scans QR
├─ App navigates to `/join/{shareToken}`
├─ Shows poll details (name, description, target, deadline, members joined, share amount)
├─ Taps "Join poll"
├─ Prompted to verify refund account (if not already set)
│  └─ Enter account number + bank code
│  └─ Monnify Name Enquiry confirms it live
├─ Membership created, state: JOINED
├─ Poll shows: "You've joined! Tap 'Pay my share' when ready"
└─ Slots remaining: 20 → 19 (live update via WebSocket)
```

### 8.3 Pay Share

```
Member taps "Pay my share"
├─ Backend calls Monnify initTransaction
├─ Unique dynamic account returned (40-min expiry)
├─ App displays: account number, bank, amount, countdown timer
├─ Member transfers from their bank app
├─ Payment lands → Monnify webhook fires
├─ Backend marks contribution PAID, recomputes poll
└─ Member sees: "Payment confirmed ✓" + thermometer jumps live on all phones in poll

If payment expires (40 min passes):
└─ Contribution status: EXPIRED, member can tap "Pay again" for a new account
```

### 8.4 Poll Reaches Target

```
Last member pays
├─ amountRaised hits target
├─ Poll state: OPEN → FUNDED (automatic)
├─ Backend checks wallet balance
├─ Initiates transfer to beneficiary (verified account)
├─ Poll state: FUNDED → DISBURSING
├─ Disbursement webhook lands (webhook final status)
└─ Poll state: DISBURSING → COMPLETED

All members see:
├─ "Poll funded 🎉"
├─ "Beneficiary account: [name] [bank]"
├─ "Amount transferred: ₦[amount]"
└─ Settlement receipt (if beneficiary is a member, they see confirmation)
```

### 8.5 Poll Expires (Refund Flow)

```
Deadline hits, target not met
├─ Poll state: OPEN → EXPIRED (auto-scheduler)
├─ Transition to REFUNDING (automatic)
├─ Backend initiates refunds for all PAID members
├─ Refund webhooks land as refunds complete
└─ Poll state: REFUNDING → REFUNDED (terminal)

Each member sees (live):
├─ "Poll deadline passed"
├─ "Target not met, refunding…"
├─ Member row: "Refunded ✓" as webhook lands
└─ Refund receipt (amount + date + status)
```

---

## 9. Monnify API Integration Details

### 9.1 Collections (Money In)

Same as before: `initTransaction` with dynamic account, collection webhook with source account details.

### 9.2 Disbursements (Money Out)

**Pre-flight: Name Enquiry** (verify beneficiary account once, before transfer)
```
POST /api/v1/disbursements/accounts/validate
{
  "accountNumber": "0123456789",
  "bankCode": "050"
}

Response:
{
  "requestSuccessful": true,
  "responseBody": {
    "accountNumber": "0123456789",
    "accountName": "Gas Distribution Ltd",   // Store this
    "bankCode": "050",
    "bankName": "Guaranty Trust Bank"
  }
}
```

**Initiate Transfer (async mode):**
```
POST /api/v1/disbursements/single
{
  "reference": "CB-PAY-{pollId}-{nonce}",
  "narration": "Co-Buy poll payout",
  "amount": 20000000,                        // kobo
  "destinationAccountNumber": "0123456789",
  "destinationBankCode": "050",
  "destinationAccountName": "Gas Distribution Ltd",  // from Name Enquiry
  "async": true,
  "senderInfo": {
    "name": "Co-Buy Poll: [poll name]",
    "email": "leader@cobuy.app"
  }
}
```

**Refunds:** Identical to before — per-member refund to verified account.

### 9.3 Verification Endpoints

- **Name Enquiry:** verify beneficiary account + capture account name
- **Wallet Balance:** check before payout wave
- **Verify Transaction:** optional belt-and-braces check before crediting large contributions
- **Get Banks:** cache at boot for dropdowns

---

## 10. Authentication & Authorization

**Phone + OTP + JWT (same as before):**

1. User enters phone → OTP sent
2. User verifies OTP → JWT issued
3. User sets refund account once (required before joining any poll)
4. All requests include `Authorization: Bearer {token}`

**Additional auth rules:**
- **Poll leader:** only leader can close a poll, edit beneficiary, generate share link
- **Member:** can only refund to their own verified account
- **Non-user beneficiary:** not authenticated; system only needs account details + verification via Name Enquiry

---

## 11. WebSocket Real-Time Updates

**On poll detail screen, app listens to channel `poll:{pollId}`:**

```javascript
// Backend broadcasts after each webhook:
io.to(`poll:${pollId}`).emit('poll_update', {
  event: 'contribution_paid',
  member_id: memberId,
  member_name: "Adebayo O.",
  amount_kobo: 1000000,
  amountRaised_kobo: 5000000,
  targetAmount_kobo: 10000000,
  thermometer_percent: 50,
  slotsRemaining: 5,
  all_member_states: [ /* updated states */ ]
});

// On poll completion:
io.to(`poll:${pollId}`).emit('poll_update', {
  event: 'poll_funded',
  status: 'FUNDED',
  message: 'Poll target reached! Transferring to beneficiary…'
});

// On refund:
io.to(`poll:${pollId}`).emit('poll_update', {
  event: 'member_refunded',
  member_id: memberId,
  status: 'REFUNDED',
  message: 'Your contribution has been refunded'
});
```

**Mobile listening:**
```dart
socket.on('poll_update', (delta) {
  setState(() {
    poll.amountRaised = delta['amountRaised_kobo'];
    poll.slotsRemaining = delta['slotsRemaining'];
    members = members.map((m) =>
      m.id == delta['member_id'] ? {...m, state: delta['state']} : m
    ).toList();
  });
  // Thermometer animates, member rows update live
});
```

---

## 12. Build Plan: Day-by-Day

| Day | Backend | Mobile |
|---|---|---|
| **Wed 15** | Send Monnify activation emails. Sandbox account setup. Auth + token module. DB schema (new polls table with share fields). Deploy skeleton. Test webhook signature verification. | Flutter scaffold: auth (phone+OTP), poll list, poll detail screen. WebSocket client. |
| **Thu 16** | Contribution flow: initTransaction → dynamic account → collection webhook → mark PAID. Name Enquiry for poll creation. | Join poll via share link/QR. Refund account verification. "Pay my share" screen with account + countdown. |
| **Fri 17** | Full poll state machine + deadline scheduler. Beneficiary account Name Enquiry + pre-validation. Disbursement flow (to external account). | Live thermometer, member list with states, slotsRemaining live. |
| **Sat 18** | Refund fan-out. Reconciliation cron. Share link/QR code generation. Multiple poll support (member in multiple polls). | Success flow (poll funded receipt). Failure flow (refunding → refunded). Polish. |
| **Sun 19** | Feature freeze noon. Bug bash. Seed demo data (2 polls: one filling, one refunding). | Same. |
| **Mon 20** | Record backup demo video. Rehearse 5×. README listing all Monnify APIs. | Rehearse with backend. |
| **Tue 21** | Submit early. Do not deploy after submitting. | — |

---

## 13. Demo Script (3 minutes)

```
[Projector showing poll list screen]

"This is Co-Buy. Nigerians pool money every day — for bulk purchases, rotating savings (ajo), 
emergency fundraising, community projects. But it's messy: spreadsheets, cash boxes, trust issues.

Co-Buy fixes that. Anyone creates a poll with a target and deadline. Members join via a link 
or QR code, transfer money, and if the target is reached, it's automatically paid to the 
beneficiary. If not, everyone is auto-refunded.

[Show poll creation flow]

I'll create a poll real quick. Name: 'Street 5 cooking gas'. Target: ₦200k. 20 members. 
Split even: yes, so each pays ₦10k. Beneficiary: an external gas distributor account.

[Tap create]

Poll is live. Here's the share link. Judge, scan this QR code with your phone and join.

[Judge scans QR, opens link, sees poll details, taps 'Join']

Judge verifies their refund account (we use Monnify's Name Enquiry to confirm it's real — 
see: 'Adebayo Ogunlesi — GTBank. Confirm?').

Now Judge taps 'Pay my share'. They get a unique account number to transfer ₦10k to.

[Judge opens Monnify Payment Simulator, transfers]

[LIVE MOMENT — critical]
Watch all phones.

[On your phone, thermometer jumps from 0% to 5%. Slots remaining: 19. Judge's phone also 
updates live via WebSocket. 🎉]

Two more payments...

[Teammate + another phone send payments]

[Thermometer now at 15%. Remaining: 17.]

That's the live part. Fast forward to poll reaching target.

[Swipe to another poll that's at 100%]

This poll hit target. ₦200,000 collected. We initiate the transfer to the gas distributor's 
account (verified via Name Enquiry). Transfer receipt shows it landed.

[Show receipt]

Members see: 'Poll funded 🎉 → Beneficiary paid → Settlement complete.'

Now, the failure case.

[Swipe to an expired poll]

This poll deadline passed without reaching target. Watch it refund automatically.

[Poll status: OPEN → EXPIRED → REFUNDING]

[Each member row ticks to 'Refunded ✓' as refund webhooks land]

No calls, no screenshots, no waitlists. The money walks itself home.

[Close with]

That's the core. Use cases: bulk purchases, ajo/esusu (rotating savings), emergency funds, 
community projects, business capital — anything a group needs to pool for. Beneficiary can 
be a member or an external account. Share via link or QR. Automatic payout. Automatic refunds.

This is real fintech for informal economies. We're making community money coordination 
transparent, trustworthy, and scalable."
```

---

## 14. Key Implementation Notes

### Backend
- **Poll status machine:** OPEN is default; transitions are atomic (DB transaction + row lock)
- **Share token generation:** 32-char random string (or UUID), stored in `polls.share_token`, used to look up poll by link
- **QR code generation:** use `qrcode` (Node.js) or similar; encode the share link URL; store as base64 or PNG URL
- **Beneficiary validation:** if external account, call Monnify Name Enquiry and store the returned `accountName`. Store everything in `disbursements` table before initiating transfer.
- **Non-user beneficiaries:** no user account needed; just account details. If disbursement fails, poll state → DISBURSE_ATTENTION (manual retry via dashboard)
- **Multiple polls per member:** members can join unlimited polls; each poll is independent
- **Scheduler:** every 2 min, check polls where deadline_at ≤ now and status=OPEN → auto-transition to EXPIRED → REFUNDING

### Mobile
- **Share link deep linking:** when user taps link or opens from browser, route to `/join/{shareToken}` screen with poll pre-loaded
- **QR scanner:** use camera plugin (`qr_flutter` for generation, `mobile_scanner` for reading)
- **Poll categories as filters:** home screen shows "All polls" + filters by category (Bulk Purchase, Ajo, Fundraising, etc.)
- **Demo data:** seed 2–3 polls at boot (one OPEN with members paying, one EXPIRED with refunds landing)

### Demo Day
- Deploy live 24 hours before deadline
- Record backup video
- Seed live demo data: one poll with 3 members paid, one expiring/refunding
- Print README with all Monnify APIs listed
- Rehearse the script 5 times
- Have phones ready for judge to scan QR and join live

---

## 15. Use Cases & Categories

**Supported poll categories** (suggest in UI, member selects):

1. **Bulk Purchase** — rice, gas, building materials, groceries
2. **Ajo/Esusu** — rotating savings, monthly contributions
3. **Fundraising** — medical bills, emergencies, community relief
4. **Repair** — home/community/school repairs
5. **Investment** — business capital, group projects
6. **Group Gift** — birthday, wedding, farewell gifts
7. **Education** — school fees pooling, study materials
8. **Custom** — any other reason

Each category can have different copy/descriptions to guide users.

---

## 16. Monetization & Business Model

**Platform fee (2%):** Baked into poll target. Transparent, collected upfront.

```
Beneficiary quote: ₦100,000
Platform fee: 2% = ₦2,000
Poll target: ₦102,000
Member share (10 members): ₦10,200 each

Collections: ₦102,000
Payout to beneficiary: ₦100,000
Co-Buy net: ₦2,000
```

**Secondary (roadmap, not in hackathon):**
- Premium features: recurring polls (monthly ajo), advanced analytics, branding
- B2B licensing to cooperatives/groups
- Yield on float

---

## 17. Critical Day-1 Checklist

- [ ] Email Monnify: refund API, disbursement API, MFA-off (sandbox)
- [ ] Create sandbox account, API key, client secret
- [ ] Test Payment Simulator
- [ ] Confirm sandbox wallet balance
- [ ] Email organizers: verify hackathon rules, deadline, submission requirements
- [ ] Design system: poll creation, share link, QR code screens
- [ ] Backend tech: Node.js/Nest.js or Python/FastAPI (decide)
- [ ] Mobile tech: Flutter (decide)
- [ ] Deployment: Render or Railway for backend

---

## 18. Success Criteria for Judges

✓ **Generalized pooling:** works for any use case (bulk, ajo, fundraising, repair, etc.)
✓ **Non-user beneficiaries:** external accounts work seamlessly
✓ **Sharing mechanics:** share link + QR code, both functional
✓ **API depth:** 6+ Monnify endpoints (collections, disbursements, refunds, name enquiry, wallet balance, webhooks)
✓ **Trust story:** verified accounts, transparent fees, automatic refunds
✓ **Demo moment:** QR → join → pay → thermometer jumps live
✓ **Ajo support:** demonstrate rotating savings as one use case
✓ **Real beneficiary:** show payout to external account (non-member)

---

## 19. References & Resources

- **Monnify API:** https://developers.monnify.com
- **QR code (Node.js):** npm install qrcode
- **QR code (Flutter):** pub.dev packages qr_flutter, mobile_scanner
- **Socket.io:** https://socket.io
- **Deployment:** Render.com, Railway.app

---

**Version 2 — Updated for generalized pooling, ajo support, non-user beneficiaries, share links, and QR codes. Ready to build.**
