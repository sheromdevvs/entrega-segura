# Merchant integration contract

This is an opt-in **sandbox-only** API. It can be implemented by any private merchant backend; no merchant source code needs to become public.

## Create checkout (server to server)

`POST /api/integrations/pascal/checkout`

Header: `Authorization: Bearer <SHOP_API_KEY>` and `Content-Type: application/json`.

```json
{
  "merchantRef": "DEMO-your-opaque-reference",
  "productId": "hoodie",
  "paymentStrategy": "single"
}
```

`paymentStrategy` is optional (`single` or `split`). `split` requires separate deposit and balance approvals; an existing reservation never changes strategy on retry.

Allowed fixture IDs: `hoodie` ($24), `mug` ($12), `frame` ($13). All money is USD, represented as integer cents internally. Amounts are selected on the server. Do not send real names, addresses, customer contact information or payment screenshots.

Response: `{ orderRef, checkoutUrl, sandbox: true }`. Redirect the buyer to `checkoutUrl`. This URL is a sensitive bearer link: do not log it or put it in analytics. It expires 30 minutes after the link is issued and is claimed by one signed guest session. Subsequent claims from another guest are rejected. Repeating a checkout request with the same merchant reference reuses the reservation, replaces the claim and invalidates an old claim; it never creates another payment order for that reference.

The product is fixed when the reservation is created. Start a new reference for a new product. This fixture contract does not accept arbitrary browser-supplied prices. A production catalogue contract is future work.

## Read payment state (server to server)

`GET /api/integrations/pascal/orders?merchantRef=...` with the same bearer header. The merchant must authorize the visitor's merchant reference in its own session before proxying this endpoint. Do not expose `SHOP_API_KEY` in browser code.

Returns: order reference, product, integer total/deposit, money state, capture/refund IDs and statuses, latest gate decision, latest verified PayPal webhook, maintenance status, approval strategy, and `sandbox: true`. No guest ownership token or delivery code is returned.

## Callback to merchant

Set `SHOP_WEBHOOK_URL` and `SHOP_WEBHOOK_SECRET` on Entrega. HTTPS is mandatory except on localhost.

Headers: `X-Entrega-Timestamp` (Unix milliseconds) and `X-Entrega-Signature` (hex HMAC-SHA256 of `timestamp + "." + raw_request_body`). Compare signatures in constant time and reject timestamps outside five minutes. Require `sandbox: true`. Deduplicate by body `id` before triggering any merchant side effect.

```json
{
  "id": "ES-example:held:1:0",
  "type": "reservation.updated",
  "orderRef": "ES-example",
  "merchantRef": "DEMO-example",
  "state": "held",
  "total": 2400,
  "deposit": 1200,
  "captures": [
    {
      "id": "PAYPAL_CAPTURE_ID",
      "role": "deposit",
      "amount": 1200,
      "status": "COMPLETED"
    }
  ],
  "refunds": [],
  "sandbox": true
}
```

Use the authenticated status lookup as the source of truth. Notifications use a persistent local outbox and exponential-backoff retries through the opt-in maintenance scheduler; delivery ordering is not guaranteed. The Pascal demo callback validates the signature and acknowledges without creating commercial side effects; it does not dispatch products or contact customers. It shows state through the authenticated lookup.

## Boundaries

The current single-shop credential is appropriate for this sandbox prototype. It is not a multi-tenant authorization system. Do not point this demo at production payment credentials or commercial order APIs. Authentication for real courier evidence, durable hosting, merchant onboarding, reconciliation workers and a reviewed refund policy are necessary before production use.
