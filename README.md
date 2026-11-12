# Entrega Segura

**A deposit to create. The balance on delivery.** A delivery-aware checkout for personalized-gift shops that sell over WhatsApp, based on Pascal Studio's workflow in Ecuador.

**PayPal:** Orders v2, Payments v2 partial/final capture, void, refund, reauthorization, Payouts and webhook-signature verification. **AI:** Spanish text, voice and image interpretation; message drafts; explanation of a decision already made by code. **Measured:** 22/24 text classifications (91.7%) in a small labelled set, with [all predictions published](reports/ai-evaluation.json). **Two clearly separated modes:** a complete guided view with illustrative money and real AI, and a real PayPal Sandbox integration awaiting its final buyer-approved lifecycle validation. No live payments, real customers, or private Pascal source code.

## What happens to the money · 30 seconds

![One approval, two moments of payment](public/money-flow.svg)

A fictional $24 custom hoodie, excluding shipping:

1. Buyer approves a $24 PayPal authorization.
2. Capture $12 for production using `final_capture: false`.
3. Leave the other $12 authorized, within PayPal's time limits.
4. Delivered + correct code → capture $12 using `final_capture: true`.
5. Refused at the door → void the remaining hold; retain the disclosed production deposit.

If the merchant account does not support repeated captures, the implemented **two-order strategy** uses a $12 `CAPTURE` deposit order and a $12 `AUTHORIZE` balance order. It requires two buyer approvals and never silently charges another deposit after a failure.

The intended benefit: the buyer does not pay the balance without a confirmed delivery; the shop can see the balance authorization before dispatching; neither checks bank-transfer screenshots. A hold is time-limited and can fail. This is not escrow or insurance. PayPal disputes and buyer rights still apply.

## Try it

**Local review first. Hosted URL: not published yet.** The owner requested completing the application and design before delegating final account setup and real payment validation.

- [Product and flow](http://localhost:3025)
- [Guided judge demo](http://localhost:3025/judge) — no PayPal approval required
- [PayPal Sandbox workspace](http://localhost:3025/judge?mode=sandbox)
- [Shop workspace](http://localhost:3025/tienda)
- [Design system](http://localhost:3025/design-system)

### Guided view

An illustrative order starts with its production deposit. Explore delivered, refused, two failed delivery attempts, incomplete delivery, and a defect with a synthetic evidence image. The same pure gate computes the outcome; all money stays in browser state and **no PayPal IDs or verified webhooks are fabricated**. A different final outcome loads a new example.

Writing a message, attaching a fictional photo, or submitting a voice note can call the configured real AI provider. The model result is distinct from the rule decision. You can record a voice note in a supported browser or upload one, review the transcript, then submit it. No WhatsApp is sent.

The shop-review tab supports an explicit partial refund, authorization review and an illustrative courier payout. The shop overview includes search, filters, activity and JSON export. The evidence tab exports a labelled report and exposes each gate event.

### Real PayPal Sandbox

Choose a product and either **one approval** or **two approvals**. Create a checkout, open the buyer approval URL, sign in with a sandbox personal account, approve, then select **Ya aprobé · comprobar**. A normal/live PayPal login does not work. Approval is never faked.

After a completed deposit and balance authorization, submit a delivery message with its displayed code or choose a clearly labelled simulated courier outcome. Payment actions use the real sandbox API. Each actual response is expandable with HTTP status, IDs, request ID and `paypal-debug-id`.

Use a new order per final outcome. Defects require an image, an already completed delivery, a report within 48 hours and shop approval of a valid refund amount. Payouts require a completed balance capture, a sandbox recipient, a fixed intent and explicit confirmation. No automatic payout is triggered by the model.

### Private Pascal integration

A separate private branch implements `http://localhost:3015/demo/entrega-segura`. Pascal's server initiates checkout with a shared API key; a signed expiring link assigns the order to the buyer session. Pascal retrieves the payment state through an authenticated API and validates timestamped HMAC callbacks.

The Pascal demo uses isolated fixtures, matching monochrome visuals and server-selected prices. It does not create commercial orders, access production databases, start manufacturing or send WhatsApp. Its implementation remains private. See the public [merchant API contract](docs/integration.md).

## What's real vs simulated

| Component                | Guided view                                                  | Sandbox workspace                                                   |
| ------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------------- |
| Money                    | Explicitly illustrative browser state                        | Real sandbox API implementation                                     |
| PayPal IDs               | None; illustrative entries never appear as provider evidence | Actual IDs and responses when calls occur                           |
| AI text, image and voice | Real configured provider when submitting input               | Same provider implementation                                        |
| Scenario buttons         | Labelled simulated delivery events                           | Labelled simulated delivery events; money calls remain real sandbox |
| Defect scenario image    | Synthetic, explicitly identified                             | User attaches fictional test evidence                               |
| WhatsApp / LAAR          | Simulated                                                    | Simulated; no live Meta, Kapso or LAAR account                      |
| Webhook SUCCESS          | Never simulated                                              | Only after real signature verification                              |
| Pascal                   | Independent demonstration                                    | Local private API integration, isolated from commercial operations  |

**Verification boundary:** earlier real sandbox smoke checks exercised OAuth, order creation/retrieval, exact amount, direct PayPal idempotent replay, unapproved-authorization rejection, invalid authorization and webhook subscriptions. They did not prove settlement. Final buyer-approved partial/final capture, void/refund, real aged-authorization reauthorization, Payouts account capability, and authentic hosted webhook SUCCESS remain deliberately deferred. This revision has not rerun real payment tests at the owner's request.

## PayPal APIs used

Only `https://api-m.sandbox.paypal.com` is allowed; live mode is rejected.

| Endpoint                                            | Use                                                                          |
| --------------------------------------------------- | ---------------------------------------------------------------------------- |
| `POST /v1/oauth2/token`                             | Server authentication                                                        |
| `POST /v2/checkout/orders`                          | Full `AUTHORIZE`, or separate deposit `CAPTURE` + balance `AUTHORIZE` orders |
| `GET /v2/checkout/orders/{id}`                      | Check actual approval                                                        |
| `POST /v2/checkout/orders/{id}/authorize`           | Authorize the full order or balance                                          |
| `POST /v2/checkout/orders/{id}/capture`             | Capture the separate deposit in two-order mode                               |
| `POST /v2/payments/authorizations/{id}/capture`     | Partial deposit or final balance capture                                     |
| `GET /v2/payments/authorizations/{id}`              | Reconcile authorization state                                                |
| `POST /v2/payments/authorizations/{id}/void`        | Void the remaining balance                                                   |
| `POST /v2/payments/authorizations/{id}/reauthorize` | Renew an eligible authorization                                              |
| `GET /v2/payments/captures/{id}`                    | Reconcile capture status                                                     |
| `POST /v2/payments/captures/{id}/refund`            | One reviewed partial refund intent                                           |
| `GET /v2/payments/refunds/{id}`                     | Reconcile refund completion                                                  |
| `POST /v1/payments/payouts`                         | Courier/supplier payout                                                      |
| `GET /v1/payments/payouts/{id}`                     | Reconcile payout batch state                                                 |
| `GET, POST /v1/notifications/webhooks`              | Find/register the deployed subscription                                      |
| `POST /v1/notifications/verify-webhook-signature`   | Verify before processing any event                                           |

The adapter exports `hold`, `release`, `cancel`, `refund`, `payOut`, `status`, with approval, refresh and reauthorization helpers. Every write carries a deterministic `PayPal-Request-Id`. A SQLite intent journal fixes operation amounts, recovers successful responses across restarts and blocks ambiguous retries older than six hours for manual reconciliation. A balance capture is never initiated twice for the same recorded reservation. The system assumes a single service instance and intact durable storage.

Authorizations have a usual three-day honor period and maximum 29-day original lifetime. Reauthorization preserves the original lifetime. The implemented maintenance worker reconciles pending payments, reauthorizes eligible holds, asks the shop near expiry or on failure, and retries merchant callbacks with persistent exponential backoff. It never automatically captures a balance or refunds a claim.

References: [authorize/delay capture](https://developer.paypal.com/checkout/delay-capture/), [Orders v2](https://developer.paypal.com/api/orders/v2/), [Payments v2](https://developer.paypal.com/api/payments/v2/), [Payouts](https://developer.paypal.com/api/payments.payouts-batch/v1/), [webhooks](https://developer.paypal.com/api/rest/webhooks/rest/).

## AI used and how

- **Text:** DeepInfra `meta-llama/Llama-3.3-70B-Instruct` by default; OpenAI `gpt-4.1-mini` when configured. `AI_PROVIDER` / `AI_MODEL` select the text provider/model.
- **Images:** actual attached image + message go to OpenAI `gpt-4.1-mini`; override with `AI_VISION_MODEL`.
- **Voice:** OpenAI `whisper-1` transcribes Spanish. The transcript is editable before interpretation.
- **Output:** a Zod-validated delivery kind, factual interpretation and a draft in Ecuadorian Spanish using **usted**. A separate read-only model call may explain an already computed gate decision. If explanation fails, the deterministic result remains intact.
- **Money:** the model never receives payment credentials or a trusted expected delivery code, never invokes payment tools and never decides a refund. Code checks payment state, exact submitted code, duplicate events, attempt count, expiry and refund evidence. Shop approval is explicit.
- **Development:** OpenAI Codex assisted implementation, tests and documentation. Built-in image generation created four original monochrome fictional assets; no paid image API was invoked. Prompts and assets are documented [here](docs/visual-assets.md). No hidden judge instructions are included.

### Measured result

The first labelled text run scored **22/24 (91.7%)**, temperature 0. [Full results](reports/ai-evaluation.json). This is a small developer-authored set, not an independent benchmark. Image/voice accuracy and explanation quality were not measured.

Two ambiguous messages — “Todavía no me llega el pedido” and “No he recibido nada y nadie vino” — were expected `unknown` but predicted `not_home`. Neither permits collecting a balance. The limitation remains visible; no production reliability claim follows from this score.

Earlier smoke checks exercised [one synthetic Spanish voice note](reports/audio-smoke.json) and [one fictional image](reports/vision-smoke.json). Those are functionality checks, not accuracy benchmarks. The landing audio is locally synthesized and labelled as such; generated photographs do not depict actual customers or deliveries.

## Run locally

Node **22.19+** (22 or 24), npm, and sandbox credentials for the real-payment mode. Built-in `node:sqlite` can emit an experimental warning in Node 22.

```sh
npm ci
cp .env.example .env
# Set APP_URL=http://localhost:3025, STORE_DIR=./.data,
# and SESSION_SECRET to a random string of at least 32 characters.
# Set PayPal sandbox and AI keys for the corresponding features.
npm run dev
```

Generate secrets with `openssl rand -hex 32`. Never commit `.env`, passwords, credentials or the SQLite ledger. `.env.example` lists every variable with no values. The guided delivery scenarios do not require PayPal credentials; actual AI submissions require their provider key.

```sh
npm run typecheck
npm test
npm run build
npm start
```

Private Pascal runs independently on port 3015. Match `SHOP_API_KEY` / `SHOP_WEBHOOK_SECRET` with Pascal's server configuration, set `SHOP_WEBHOOK_URL` to its callback and `PASCAL_DEMO_URL` to its public demo route. These keys never go to browser code. Stop local servers when testing ends.

### Strategy and maintenance

`PAYPAL_CAPTURE_STRATEGY=single` is the default; `split` chooses the two-order fallback. The workspace can select a strategy per new reservation. Never switch an existing paid reservation's strategy or create a replacement deposit automatically.

Maintenance is disabled by default while final payment validation is deferred. After that validation, set `MAINTENANCE_ENABLED=true` to run the single-instance scheduler. `MAINTENANCE_INTERVAL_MS` defaults to 60 seconds; individual orders are normally reconciled no more than every ten minutes. Near-expiry cases need shop attention. The optional `POST /api/internal/maintenance` endpoint requires `Authorization: Bearer <MAINTENANCE_SECRET>` for an external scheduler. `npm run maintenance` executes one batch. These commands may call the real sandbox: do not run them as a substitute for deferred validation.

### Hosting preparation

`render.yaml` and a non-root `Dockerfile` are included. They have not been deployed. Render's free filesystem is ephemeral and the service can sleep: use it only for disposable sandbox state. For a durable ledger and timely maintenance, the owner must choose persistent storage and an awake single instance. The Docker volume is `/app/data`; set `STORE_DIR` to the actual persistent mount. Secrets belong in host environment variables, never the image.

After local review and hosting approval, set `APP_URL` to the deployed HTTPS origin. Register the sandbox webhook with `npm run webhook:register` and copy the returned `PAYPAL_WEBHOOK_ID` into the hosted environment. Localhost alone cannot receive genuine callbacks. A mock notification is not proof of postback verification SUCCESS. See [deployment instructions](docs/deployment.md) and [Render's Next.js guide](https://render.com/docs/deploy-nextjs-app).

## Architecture

```text
Pascal backend (private) ── authenticated API ──→ Entrega Segura
          ↑ signed callbacks / status lookup            │
Chat / audio / image → AI event → deterministic gate → PayPal Sandbox
                                            ↑                 │
                                     verified webhook ←──────┘
Maintenance: reconcile states / renew eligible holds / retry callbacks
Guided view: same pure gate, browser-only illustrative money, no PayPal calls
```

- `app/`: product site, guided/Sandbox judge workspace, shop panel, design-system reference and server routes.
- `components/`: shared navigation, icons, composer, payment evidence, shop actions and interactive product examples.
- `lib/gate/`: pure money policy; no model or network.
- `lib/paypal/`: sandbox client, one-/two-order strategies, intent journal, refund, payout and webhook verification.
- `lib/ai/`: extraction, vision, Whisper and read-only decision explanation.
- `lib/courier/`: simulated LAAR and code-confirmation adapter interface.
- `lib/demo/`: browser-only guided examples using the shared gate.
- `lib/store.ts`: SQLite WAL ledger, immutable operation intents, deduplicated webhook IDs and persistent callback outbox.
- `lib/maintenance.ts`: reconciliation, reauthorization, expiry escalation and callback retries. Opt-in scheduler through `instrumentation.ts`.

This is a single-shop sandbox prototype. Guest sessions represent demo buyer/courier/reviewer roles; the panel is session-scoped, not a production multi-tenant admin system. Real courier identity, operational reconciliation and merchant onboarding remain production work outside the hackathon prototype.

The monochrome system, local OFL-licensed font, image provenance, spacing, state components and accessible interactions are documented in [design foundations](docs/design-system.md).

## Tests

```sh
npm test                 # deterministic unit/property tests; real sandbox tests skipped
npm run typecheck
npm run build
# Only at final account-validation stage:
npm run test:sandbox     # loads .env and calls real PayPal Sandbox
npm run eval:ai          # real AI calls, writes an evaluation report
```

Current unit coverage includes wrong codes, concurrent balance release, pending deposits, duplicate events, one refund intent, one-/two-order flows, changed payout intents, expired and aged authorization, failed renewal, persistent callback backoff, forged and out-of-order webhooks, and the guided scenarios. Property tests cover thousands of generated cases.

The eight-test sandbox smoke suite remains opt-in. Three additional lifecycle checks require a buyer-approved locally stored reservation reference via `SANDBOX_APPROVED_ORDER_ID` (despite the historical name, its value is `ES-...`, not a PayPal ID). The compatibility probe creates a fresh sandbox order, waits for external buyer approval and then tests partial/final capture:

```sh
npm run sandbox:probe
# Approve the printed URL with a sandbox buyer, then:
npm run sandbox:probe -- ES-REFERENCE
```

`reports/local-contract.json` is historical evidence of 17 earlier local API-contract checks; it is not a claim that this revision's real payment lifecycle has been rerun. New validation results are recorded separately. Final external checks are intentionally left for the final stage; the application does not display an invented success.

## License

[MIT](LICENSE) for the new Entrega Segura code. DM Sans is distributed under its [SIL Open Font License](public/fonts/OFL.txt). Pascal Studio's application stays private. Visual references are principles drawn from public Nubank and ElevenLabs material, not copied brand assets or proprietary design-system components.
