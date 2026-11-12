# Deployment

## Current hosting (Vercel + Neon)

- URL: https://entrega-segura-app.vercel.app (`entrega-segura.vercel.app` belongs to someone else). The domain is attached to the Vercel project `entrega-segura`, so every `vercel deploy --prod` moves it automatically.
- `vercel.json` pins the Next.js framework preset and region `iad1`.
- Ledger: Neon Postgres (`aws-us-east-1`). `DATABASE_URL` (pooled) for queries, `DATABASE_URL_UNPOOLED` for per-reservation advisory locks. Tables are created on first use; see `lib/store.ts`.
- Production env vars: `PAYPAL_ENV=sandbox`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`, `OPENAI_API_KEY`, `DEEPINFRA_API_KEY`, `SESSION_SECRET`, `APP_URL`, `DATABASE_URL`, `DATABASE_URL_UNPOOLED`. The Pascal merchant variables (`SHOP_*`, `PASCAL_DEMO_URL`) are not set, so the Pascal integration routes answer 401 on the hosted demo.
- Vercel deployment protection (SSO) is disabled for this project so judges can open it.

Redeploy: `vercel deploy --prod --yes`.

## Webhook

1. `APP_URL=https://entrega-segura-app.vercel.app npm run webhook:register` (registered id `7YN52330AD573344H`).
2. Put the id in the Vercel env as `PAYPAL_WEBHOOK_ID` and redeploy.
3. Proof: `APP_URL=… PAYPAL_WEBHOOK_ID=… DATABASE_URL=… npm run webhook:proof` → `reports/webhook-proof.json`.

The sandbox sometimes delivers events many minutes late. When an order polled from `/judge` is resolved and still has no verified webhook after 15 s, the server asks PayPal once to resend its own event for that order (`POST /v1/notifications/webhooks-events/{id}/resend`). The resent delivery is signed by PayPal and verified like any other.

## Maintenance

Off on Vercel (no long-running process). For scheduled reconciliation/reauthorization set `MAINTENANCE_SECRET` and call `POST /api/internal/maintenance` with `Authorization: Bearer <secret>` from an external scheduler. It never captures money because a timer fired.

## Alternatives kept in the repo

`render.yaml` (Render web service) and the `Dockerfile` (Node 22, non-root, `/app/data` volume for SQLite) were prepared earlier and not used. Without `DATABASE_URL` the app falls back to SQLite under `STORE_DIR`, which needs a persistent disk and a single instance.
