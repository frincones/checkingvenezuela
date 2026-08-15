**Título del PR:**

```
feat(payments): charge a quotation with a PayPal invoice link
```

**Base:** `dev` ← **Compare:** `feat/paypal-payments`

---

An advisor can now generate a payment link from a quotation, share it by WhatsApp
or let PayPal email it, and see who still owes money. Until now the CRM had no
point at which a customer could pay: quotes went out as a PDF and the payment
happened outside the system with nobody tracking it.

## Why the Invoicing API

- **Orders API v2 was rejected outright**: its `payer-action` link **expires
  after 6 hours**, useless for a link sent over WhatsApp that the client opens
  the next day. This is the option most integrations reach for first.
- **Payment Links API** works on this account (verified against the live API) but
  has no reminders, no per-customer tracking and no partial payments.
- **Invoicing** gives a PayPal-hosted page that never expires, reminders,
  tracking, and is available on any business account without approval.

Sending with `send_to_recipient:false` produces the payable link **without PayPal
emailing anyone** — the default, because advisors share by WhatsApp.

## Two things learned probing the live API

Both are encoded with a comment explaining why:

- The terms field is **`terms_and_conditions`**. PayPal **silently discards
  `term`** with no error, so invoices would have gone out with no terms and
  nobody would have noticed.
- **`invoicer.email_address` must be the real PayPal account.** An alias is
  accepted on POST but any later PUT fails with `USER_NOT_FOUND`, so the field is
  omitted entirely.

## Correctness enforced in the database, not in application code

| Risk | Where it is prevented |
|---|---|
| Two charges for one quotation | Partial unique index `idx_payment_links_one_active` — two simultaneous clicks cannot create two invoices |
| A webhook counted twice | `payment_webhook_events.event_id` is the primary key. PayPal retries |
| Items edited after the charge exists | `lib/payments/quotationGuard.js`, used by **both** paths that edit items — duplicating the check would guarantee they drift |

The amount is always read from the database row, never from the request body.
Webhook signatures are verified against the **raw** body — parsing first breaks
verification, the same reason `app/api/stripe/webhook` reads the arrayBuffer
before touching anything.

## What is included

- **DB**: `payment_links`, `payment_webhook_events`, `quotations.amount_paid/paid_at`, new `paid` status
- **Backend**: OAuth client with token cache, invoices module, charge endpoint, list/cancel/remind, webhook receiver
- **UI**: Payment block in the quotation detail, `/dashboard/payments`, sidebar entry
- **Integration**: payment QR on the quotation PDF (local `qrcode` dependency — PayPal's endpoint returns multipart/form-data and costs a round trip), and a *Pay now* button in the email that already goes out
- **Tooling**: `scripts/paypal/doctor.mjs` diagnoses the whole setup; `setup-webhook.mjs` registers the webhook idempotently

## Decisions

Full amount by default (deposit available but off) · new `paid` quotation status ·
QR mandatory · invoices always issued in USD (there are quotations in EUR;
the original currency is kept in `metadata`).

## Migrations

**Already applied** and verified against the live database. The enum one is a
separate file because `ALTER TYPE ... ADD VALUE` cannot run inside a transaction
block.

## Before this can take payments

1. Fill `PAYPAL_ENV` / `PAYPAL_CLIENT_ID` / `PAYPAL_SECRET` (use a **sandbox** app to test)
2. `node scripts/paypal/setup-webhook.mjs --url https://venezuelavoyages.com/api/webhook/paypal --apply`
3. `node scripts/paypal/doctor.mjs` — should be all green

Without those, the module degrades cleanly: endpoints return 503 with a readable
message and the rest of the CRM is unaffected.

## Still open

**The country the PayPal business account is registered in.** If it is Venezuela,
payments can be collected but **withdrawing to a Venezuelan bank is restricted**
by currency controls. That is the only thing that can invalidate this module and
it cannot be fixed in code.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
