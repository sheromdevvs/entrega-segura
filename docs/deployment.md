# Deployment preparation

The application is complete for local review. Final buyer-approved PayPal validation and external hosting setup are deferred by the owner. No production deploy or main merge has been authorized.

## Native Render service

Use the included `render.yaml`: Node 22.19+, build `npm ci && npm run build`, start `npm start`, health path `/api/health`. Automatic deployments are disabled in the blueprint. Set APP_URL, SESSION_SECRET and sandbox/AI credentials in Render's environment. Configure the merchant API/callback secrets only when connecting the separately approved Pascal deployment.

The free service's filesystem is ephemeral, and sleeping instances cannot continuously monitor expiry. For reliable ledger state and scheduled maintenance, select an awake single instance with a persistent disk and configure STORE_DIR to its mount. Do not describe free ephemeral storage as durable. No paid plan has been provisioned by this work.

## Container alternative

The included Dockerfile uses Node 22, a non-root runtime user and `/app/data` as a volume. Its build context excludes .env, local data, Git and reports. Build/run only when the owner chooses to use this route:

```sh
docker build -t entrega-segura .
docker run --rm -p 3025:3025 --env-file .env -v entrega-ledger:/app/data entrega-segura
```

Docker was not available in the implementation environment; the container recipe has not been executed. The regular Next production build is checked separately.

## Webhook and maintenance activation

1. Complete final sandbox buyer approval and the partial/final-capture compatibility check. If needed, use the implemented two-order strategy.
2. Host the approved version on an HTTPS origin; set APP_URL to that exact origin.
3. Run `npm run webhook:register`, then set PAYPAL_WEBHOOK_ID in the host environment as well.
4. Receive a genuine payment notification and retain its real `verification_status: SUCCESS` evidence. A mock postback is not acceptable proof.
5. Choose PAYPAL_CAPTURE_STRATEGY, then enable MAINTENANCE_ENABLED=true after the account validation. The scheduler reconciles eligible orders and retries the outbox. It never captures money just because a timer fired.
6. For an external scheduler, set a strong MAINTENANCE_SECRET and POST to `/api/internal/maintenance` using its bearer header. Do not put the secret in a URL. The endpoint is disabled without that secret.
7. Configure Pascal's opt-in demo and the matching server-only credentials on its own approved deployment. Do not point it at commercial orders, databases or WhatsApp.

Stop local test servers when testing ends. Never manually deploy Pascal to Vercel; its existing main integration and the owner's merge authorization remain the applicable production path.
