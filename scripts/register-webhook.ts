import { api } from "../lib/paypal/client";
import { webhookTypes } from "../lib/paypal/webhook";
import { appendFileSync } from "node:fs";
async function main() {
  const url = process.env.APP_URL;
  if (!url?.startsWith("https://"))
    throw new Error("Set APP_URL to the deployed HTTPS origin first");
  const endpoint = url + "/api/paypal/webhook";
  const existing = await api("/v1/notifications/webhooks");
  const hook =
    existing.webhooks?.find((x: any) => x.url === endpoint) ||
    (await api("/v1/notifications/webhooks", "POST", {
      url: endpoint,
      event_types: webhookTypes.map((name) => ({ name })),
    }));
  console.log(JSON.stringify({ webhookId: hook.id, url: endpoint }));
  appendFileSync(".env", `\nPAYPAL_WEBHOOK_ID=${hook.id}\n`);
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
