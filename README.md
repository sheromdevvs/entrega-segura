# Entrega Segura

**A deposit to create. The balance on delivery.** Cash-on-delivery without the cash, for small shops in Latin America that sell custom products over WhatsApp. Modelled on Pascal Studio, a custom-gift shop in Quito, Ecuador.

**Live demo:** https://entrega-segura-app.vercel.app · **One-click real sandbox run:** https://entrega-segura-app.vercel.app/judge?mode=sandbox

|                   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **What it does**  | The buyer approves the full amount once. A 50% deposit is captured to fund production; the other 50% stays authorized. Delivered with the buyer's 4-digit code → the balance is captured. Refused at the door → the balance authorization is voided. AI reads the messy human side (text, voice notes, photos); deterministic code, never the model, decides what happens to money.                                                                                                                                       |
| **Who it is for** | Small shops that today ask for two bank transfers and check screenshots by hand, and their buyers, who pay the balance only for something that arrived.                                                                                                                                                                                                                                                                                                                                                                   |
| **PayPal APIs**   | Orders v2 (`AUTHORIZE`), Payments v2 (partial capture with `final_capture: false`, final capture, void, refund, reauthorize), Payouts v1, Webhooks (registration, `verify-webhook-signature`, event resend). All on the free sandbox.                                                                                                                                                                                                                                                                                     |
| **Measured**      | Scripted run on the real PayPal Sandbox: 6/6 money scenarios passed with PayPal IDs and debug ids ([reports/sandbox-e2e.json](reports/sandbox-e2e.json)). 9 genuine PayPal webhooks verified `SUCCESS` on the deployed URL; a forged one rejected (HTTP 400, PayPal says `FAILURE`) ([reports/webhook-proof.json](reports/webhook-proof.json)). 71 tests pass (58 unit/property + 13 against the real sandbox). AI text parser: 22/24 on a small labelled set ([reports/ai-evaluation.json](reports/ai-evaluation.json)). |
| **Real**          | Every PayPal call and ID (sandbox, no live money); signature-verified webhooks; AI calls (DeepInfra/OpenAI); the delivery gate; the Postgres ledger.                                                                                                                                                                                                                                                                                                                                                                      |
| **Simulated**     | The courier (LAAR has an API, we have no access yet), the WhatsApp chats, and the buyer in the one-click run (PayPal's sandbox test card instead of a human approval). All people and orders are fictional; prices are the shop's real ones.                                                                                                                                                                                                                                                                              |

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

Hosted on Vercel (sandbox only): **https://entrega-segura-app.vercel.app**

- [Product and flow](https://entrega-segura-app.vercel.app)
- [Real sandbox, one click](https://entrega-segura-app.vercel.app/judge?mode=sandbox) — choose a scenario, press **Ejecutar en Sandbox**. About 10 seconds; every step shows its PayPal IDs. Limited to 4 runs per visitor every 10 minutes and 60 per hour overall.
- [Guided judge demo](https://entrega-segura-app.vercel.app/judge) — no PayPal calls, all outcomes, real AI when you type
- [Shop workspace](https://entrega-segura-app.vercel.app/tienda)
- [Design system](https://entrega-segura-app.vercel.app/design-system)

Locally the same routes run on `http://localhost:3025`.

### Guided view

An illustrative order starts with its production deposit. Explore delivered, refused, two failed delivery attempts, incomplete delivery, and a defect with a synthetic evidence image. The same pure gate computes the outcome; all money stays in browser state and **no PayPal IDs or verified webhooks are fabricated**. A different final outcome loads a new example.

Writing a message, attaching a fictional photo, or submitting a voice note can call the configured real AI provider. The model result is distinct from the rule decision. You can record a voice note in a supported browser or upload one, review the transcript, then submit it. No WhatsApp is sent.

The shop-review tab supports an explicit partial refund, authorization review and an illustrative courier payout. The shop overview includes search, filters, activity and JSON export. The evidence tab exports a labelled report and exposes each gate event.

### Real PayPal Sandbox

**One click (judges):** the buyer is PayPal's published sandbox test card (Visa 4012000077777777 sent as Orders v2 `payment_source.card`), so PayPal approves without a browser. The server then runs the same verbs as the human flow: create the `AUTHORIZE` order, capture the 50% deposit with `final_capture: false`, receive a simulated LAAR delivery event carrying the buyer's code, let the gate decide, capture (or void) the balance, and replay the delivery to show there is no second charge. Verified webhooks arrive shortly after; when the sandbox delivers late, the app asks PayPal to resend its own event (Webhooks resend API), and that delivery still goes through signature verification.

**Human approval:** choose a product and either **one approval** or **two approvals**. Create a checkout, open the buyer approval URL, sign in with a sandbox personal account, approve, then select **Ya aprobé · comprobar**. A normal/live PayPal login does not work. Approval is never faked.

After a completed deposit and balance authorization, submit a delivery message with its displayed code or choose a clearly labelled simulated courier outcome. Payment actions use the real sandbox API. Each actual response is expandable with HTTP status, IDs, request ID and `paypal-debug-id`.

Use a new order per final outcome. Defects require an image, an already completed delivery, a report within 48 hours and shop approval of a valid refund amount. Payouts require a completed balance capture, a sandbox recipient, a fixed intent and explicit confirmation. No automatic payout is triggered by the model.

### Private Pascal integration

A separate private branch implements `http://localhost:3015/demo/entrega-segura`. Pascal's server initiates checkout with a shared API key; a signed expiring link assigns the order to the buyer session. Pascal retrieves the payment state through an authenticated API and validates timestamped HMAC callbacks.

The Pascal demo uses isolated fixtures, matching monochrome visuals and server-selected prices. It does not create commercial orders, access production databases, start manufacturing or send WhatsApp. Its implementation remains private. See the public [merchant API contract](docs/integration.md).

## What's real vs simulated

| Component                | Guided view                                                  | Sandbox workspace                                                   |
| ------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------------- |
| Money                    | Explicitly illustrative browser state                        | Real PayPal Sandbox calls                                           |
| Buyer approval           | None                                                         | Human: PayPal approval link. One click: PayPal's sandbox test card  |
| PayPal IDs               | None; illustrative entries never appear as provider evidence | Actual IDs and responses when calls occur                           |
| AI text, image and voice | Real configured provider when submitting input               | Same provider implementation                                        |
| Scenario buttons         | Labelled simulated delivery events                           | Labelled simulated delivery events; money calls remain real sandbox |
| Defect scenario image    | Synthetic, explicitly identified                             | User attaches fictional test evidence                               |
| WhatsApp / LAAR          | Simulated                                                    | Simulated; no live Meta, Kapso or LAAR account                      |
| Webhook SUCCESS          | Never simulated                                              | Only after real signature verification                              |
| Pascal                   | Independent demonstration                                    | Local private API integration, isolated from commercial operations  |

### Measured on the real sandbox (2026-11-12)

`npm run sandbox:e2e` ran every money path against `api-m.sandbox.paypal.com` and saved IDs and `paypal-debug-id`s to [reports/sandbox-e2e.json](reports/sandbox-e2e.json):

| Scenario            | Result                                                                                                                     | Key PayPal IDs                                                                                         |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Delivered with code | $12 deposit + $12 balance captured on one authorization; repeated delivery → no second capture                             | order `9GA51186MN289643N`, auth `37M693238M146131R`, captures `8WG56307DG908532N`, `27J97872DJ7024347` |
| Refused at the door | balance authorization `VOIDED`, deposit kept                                                                               | auth `4H391159H5245732V`, deposit `2BC783505L887032K`                                                  |
| Not home ×2         | `wait`, then `ask_shop`; authorization still `PARTIALLY_CAPTURED`, nothing charged or voided                               | auth `59L63985PT081594R`                                                                               |
| Defect with photo   | gate asks the shop; shop approves a $4.00 partial refund                                                                   | refund `5GM25835TJ0006947` (PayPal status `PENDING`, reason `ECHECK`, a sandbox funding quirk)         |
| Courier payout      | $1.00 payout to a sandbox account, batch `SUCCESS`                                                                         | batch `QRZGXJZSLV4BW`                                                                                  |
| Retry / duplicate   | 5 concurrent `release()` + repeated event + raw replay with the same `PayPal-Request-Id` → PayPal returns the same capture | capture `7Y877363RC263794G`                                                                            |

Payout note: the real courier fee is $3 (Quito) to $6.50 (LAAR). The shared sandbox business account answers `INSUFFICIENT_FUNDS` for those amounts (and, after two $1 payouts, for $1 too), so the demo pays out $1.00. The payout ran successfully once at 07:23 UTC; a later rerun failed for that reason, and both are in the report.

Webhooks: subscription `7YN52330AD573344H` on the deployed URL. [reports/webhook-proof.json](reports/webhook-proof.json) lists 9 genuine deliveries verified `SUCCESS` and applied, and a forged event rejected by the endpoint (HTTP 400) for which PayPal's verification API answers `FAILURE`.

Not proven on the real sandbox: an aged authorization reauthorization (it needs a 3-day-old hold; unit-tested only).

## PayPal APIs used

Only `https://api-m.sandbox.paypal.com` is allowed; live mode is rejected.

| Endpoint                                                      | Use                                                                          |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `POST /v1/oauth2/token`                                       | Server authentication                                                        |
| `POST /v2/checkout/orders`                                    | Full `AUTHORIZE`, or separate deposit `CAPTURE` + balance `AUTHORIZE` orders |
| `GET /v2/checkout/orders/{id}`                                | Check actual approval                                                        |
| `POST /v2/checkout/orders/{id}/authorize`                     | Authorize the full order or balance                                          |
| `POST /v2/checkout/orders/{id}/capture`                       | Capture the separate deposit in two-order mode                               |
| `POST /v2/payments/authorizations/{id}/capture`               | Partial deposit or final balance capture                                     |
| `GET /v2/payments/authorizations/{id}`                        | Reconcile authorization state                                                |
| `POST /v2/payments/authorizations/{id}/void`                  | Void the remaining balance                                                   |
| `POST /v2/payments/authorizations/{id}/reauthorize`           | Renew an eligible authorization                                              |
| `GET /v2/payments/captures/{id}`                              | Reconcile capture status                                                     |
| `POST /v2/payments/captures/{id}/refund`                      | One reviewed partial refund intent                                           |
| `GET /v2/payments/refunds/{id}`                               | Reconcile refund completion                                                  |
| `POST /v1/payments/payouts`                                   | Courier/supplier payout                                                      |
| `GET /v1/payments/payouts/{id}`                               | Reconcile payout batch state                                                 |
| `GET, POST /v1/notifications/webhooks`                        | Find/register the deployed subscription                                      |
| `POST /v1/notifications/verify-webhook-signature`             | Verify before processing any event                                           |
| `GET /v1/notifications/webhooks-events`, `POST …/{id}/resend` | Ask PayPal to resend its own late event for an order (still verified)        |

The adapter exports `hold`, `release`, `cancel`, `refund`, `payOut`, `status`, with approval, refresh and reauthorization helpers. Every write carries a deterministic `PayPal-Request-Id`. An intent journal (Postgres on the hosted app, SQLite locally) fixes operation amounts, recovers successful responses across restarts and blocks ambiguous retries older than six hours for manual reconciliation. A balance capture is never initiated twice for the same recorded reservation. With Postgres, a session advisory lock per reservation serialises work across serverless instances, so a webhook landing on another instance cannot race a capture.

Authorizations have a usual three-day honor period and maximum 29-day original lifetime. Reauthorization preserves the original lifetime. The implemented maintenance worker reconciles pending payments, reauthorizes eligible holds, asks the shop near expiry or on failure, and retries merchant callbacks with persistent exponential backoff. It never automatically captures a balance or refunds a claim.

References: [authorize/delay capture](https://developer.paypal.com/checkout/delay-capture/), [Orders v2](https://developer.paypal.com/api/orders/v2/), [Payments v2](https://developer.paypal.com/api/payments/v2/), [Payouts](https://developer.paypal.com/api/payments.payouts-batch/v1/), [webhooks](https://developer.paypal.com/api/rest/webhooks/rest/).

## AI used and how

- **Text:** DeepInfra `meta-llama/Llama-3.3-70B-Instruct` by default; OpenAI `gpt-4.1-mini` when configured. `AI_PROVIDER` / `AI_MODEL` select the text provider/model.
- **Images:** actual attached image + message go to OpenAI `gpt-4.1-mini`; override with `AI_VISION_MODEL`.
- **Voice:** OpenAI `whisper-1` transcribes Spanish. The transcript is editable before interpretation.
- **Output:** a Zod-validated delivery kind, factual interpretation and a draft in Ecuadorian Spanish using **usted**. A separate read-only model call may explain an already computed gate decision. If explanation fails, the deterministic result remains intact.
- **Money:** the model never receives payment credentials or a trusted expected delivery code, never invokes payment tools and never decides a refund. Code checks payment state, exact submitted code, duplicate events, attempt count, expiry and refund evidence. Shop approval is explicit.
- **Development:** OpenAI Codex assisted implementation, tests and documentation; Claude Code did the Postgres storage, the one-click sandbox path, the end-to-end runs and the deployment. Built-in image generation created four original monochrome fictional assets; no paid image API was invoked. Prompts and assets are documented [here](docs/visual-assets.md). No hidden judge instructions are included.

### Measured result

The first labelled text run scored **22/24 (91.7%)**, temperature 0. [Full results](reports/ai-evaluation.json). This is a small developer-authored set, not an independent benchmark. Image/voice accuracy and explanation quality were not measured.

Two ambiguous messages — “Todavía no me llega el pedido” and “No he recibido nada y nadie vino” — were expected `unknown` but predicted `not_home`. Neither permits collecting a balance. The limitation remains visible; no production reliability claim follows from this score.

Earlier smoke checks exercised [one synthetic Spanish voice note](reports/audio-smoke.json) and [one fictional image](reports/vision-smoke.json). Those are functionality checks, not accuracy benchmarks. The landing audio is locally synthesized and labelled as such; generated photographs do not depict actual customers or deliveries.

## Run locally

Node **22.19+** (22 or 24), npm, and sandbox credentials for the real-payment mode. Without `DATABASE_URL` the ledger is built-in `node:sqlite` under `STORE_DIR` (it can emit an experimental warning in Node 22). Set `DATABASE_URL` (and `DATABASE_URL_UNPOOLED` for locks) to use Postgres; tables are created on first use.

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

Maintenance is disabled by default. On a long-running host, set `MAINTENANCE_ENABLED=true` to run the in-process scheduler. `MAINTENANCE_INTERVAL_MS` defaults to 60 seconds; individual orders are normally reconciled no more than every ten minutes. Near-expiry cases need shop attention. The optional `POST /api/internal/maintenance` endpoint requires `Authorization: Bearer <MAINTENANCE_SECRET>` for an external scheduler. `npm run maintenance` executes one batch. These commands call the real sandbox.

### Hosting

The demo runs on Vercel (project `entrega-segura`, region `iad1`) with a Neon Postgres ledger. Production environment: PayPal sandbox credentials, AI keys, `SESSION_SECRET`, `APP_URL`, `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `PAYPAL_WEBHOOK_ID`. The webhook was registered with `npm run webhook:register` against the HTTPS origin. Maintenance stays off on Vercel (no long-running process); `POST /api/internal/maintenance` exists for an external scheduler. `render.yaml` and the `Dockerfile` remain as alternatives and were not used. See [deployment notes](docs/deployment.md).

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
- `lib/store.ts`: ledger (Postgres when `DATABASE_URL` is set, SQLite otherwise), immutable operation intents, deduplicated webhook IDs, persistent callback outbox, durable rate limits, per-reservation locks.
- `lib/scenarios.ts`: scripted real-sandbox scenarios shared by `/api/judge/run` and `scripts/sandbox-e2e.ts`.
- `lib/maintenance.ts`: reconciliation, reauthorization, expiry escalation and callback retries. Opt-in scheduler through `instrumentation.ts`.

This is a single-shop sandbox prototype. Guest sessions represent demo buyer/courier/reviewer roles; the panel is session-scoped, not a production multi-tenant admin system. Real courier identity, operational reconciliation and merchant onboarding remain production work outside the hackathon prototype.

The monochrome system, local OFL-licensed font, image provenance, spacing, state components and accessible interactions are documented in [design foundations](docs/design-system.md).

## Tests

```sh
npm test                 # 58 deterministic unit/property tests; sandbox tests skipped
npm run typecheck
npm run build
npm run test:sandbox     # all 71: adds 8 sandbox API checks + 5 card-funded lifecycle tests (real captures, void, refund)
npm run sandbox:e2e      # the six scenarios above → reports/sandbox-e2e.json
npm run webhook:proof    # needs APP_URL, PAYPAL_WEBHOOK_ID, DATABASE_URL of the deployment → reports/webhook-proof.json
npm run eval:ai          # real AI calls, writes an evaluation report
```

Last run (2026-11-12): `npm run test:sandbox` → 71/71 passed. The unit tests also pass against Postgres (`DATABASE_URL` pointing at a scratch schema).

Unit coverage includes wrong codes, concurrent balance release, pending deposits, duplicate events, one refund intent, one-/two-order flows, changed payout intents, expired and aged authorization, failed renewal, persistent callback backoff, forged and out-of-order webhooks, and the guided scenarios. Property tests cover thousands of generated cases. `npm run sandbox:probe` still offers the human-approval path: it prints a PayPal approval URL, then finishes deposit and balance after you approve as a sandbox buyer.

Screenshots of the deployed pages at 1440 px and 390 px: [reports/screenshots/live/](reports/screenshots/live/).

## License

[MIT](LICENSE) for the new Entrega Segura code. DM Sans is distributed under its [SIL Open Font License](public/fonts/OFL.txt). Pascal Studio's application stays private. Visual references are principles drawn from public Nubank and ElevenLabs material, not copied brand assets or proprietary design-system components.
