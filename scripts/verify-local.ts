import { createHmac, randomUUID } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";
const app = "http://localhost:3025",
  shop = "http://localhost:3015";
const results: { name: string; passed: boolean; detail?: string }[] = [];
function check(name: string, condition: boolean, detail?: string) {
  results.push({ name, passed: condition, detail });
  console.log(`${condition ? "PASS" : "FAIL"} ${name}`);
  if (!condition) process.exitCode = 1;
}
async function main() {
  let r = await fetch(app + "/api/health");
  check("Entrega health", r.ok);
  r = await fetch(shop + "/demo/entrega-segura");
  check("Private Pascal checkout page serves", r.ok);
  r = await fetch(app + "/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: app },
    body: JSON.stringify({ productId: "hoodie" }),
  });
  const order = await r.json();
  const cookie = r.headers.get("set-cookie")?.split(";")[0] || "";
  check(
    "Create real sandbox checkout via guest session",
    r.ok && !!order.paypalOrderId && !!cookie,
    order.paypalOrderId,
  );
  r = await fetch(app + `/api/orders/${order.ref}`);
  const denied = await r.json();
  check("Other guest cannot read order", r.status === 404 && !denied.calls);
  r = await fetch(app + `/api/orders/${order.ref}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "refresh" }),
  });
  const deniedWrite = await r.json();
  check(
    "Other guest cannot mutate or recover order in error body",
    !r.ok && !deniedWrite.order,
  );
  r = await fetch(app + `/api/orders/${order.ref}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
      Origin: "https://attacker.example",
    },
    body: JSON.stringify({ action: "refresh" }),
  });
  check("Cross-origin writes rejected", r.status === 400);
  r = await fetch(app + `/api/orders/${order.ref}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
      Origin: app,
    },
    body: JSON.stringify({ action: "approve" }),
  });
  const unapproved = await r.json();
  check(
    "Unapproved buyer cannot trigger deposit",
    !r.ok && unapproved.order.captures.length === 0,
  );
  r = await fetch(app + "/api/integrations/pascal/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  check("Integration requires server credential", r.status === 401);
  const ref = "DEMO-CONTRACT-" + randomUUID();
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.SHOP_API_KEY}`,
  };
  r = await fetch(app + "/api/integrations/pascal/checkout", {
    method: "POST",
    headers,
    body: JSON.stringify({ merchantRef: ref, productId: "mug" }),
  });
  const integrated = await r.json();
  check(
    "Authenticated Pascal integration creates checkout",
    r.ok && integrated.sandbox === true,
    integrated.orderRef,
  );
  r = await fetch(app + "/api/integrations/pascal/checkout", {
    method: "POST",
    headers,
    body: JSON.stringify({ merchantRef: ref, productId: "mug" }),
  });
  const replay = await r.json();
  check(
    "Integration retry returns same reservation",
    replay.orderRef === integrated.orderRef,
  );
  r = await fetch(replay.checkoutUrl, { redirect: "manual" });
  const claimCookie = r.headers.get("set-cookie")?.split(";")[0] || "";
  check(
    "Signed claim assigns checkout to browser",
    r.status === 307 && !!claimCookie,
  );
  r = await fetch(replay.checkoutUrl, { redirect: "manual" });
  check("Claim cannot be stolen by another browser", r.status === 403);
  r = await fetch(app + `/api/orders/${integrated.orderRef}`, {
    headers: { Cookie: claimCookie },
  });
  check("Claimed browser can read its reservation", r.ok);
  r = await fetch(app + `/api/integrations/pascal/orders?merchantRef=${ref}`, {
    headers,
  });
  const state = await r.json();
  check(
    "Pascal reads authoritative payment status by API",
    r.ok &&
      state.state === "awaiting_approval" &&
      state.total === 1200 &&
      !state.owner,
  );
  const event = JSON.stringify({
    id: "test:" + ref,
    type: "reservation.updated",
    merchantRef: ref,
    orderRef: integrated.orderRef,
    state: "awaiting_approval",
    sandbox: true,
  });
  const time = String(Date.now());
  const sig = createHmac("sha256", process.env.SHOP_WEBHOOK_SECRET!)
    .update(time + "." + event)
    .digest("hex");
  r = await fetch(shop + "/api/demo/entrega-segura/webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Entrega-Timestamp": time,
      "X-Entrega-Signature": sig,
    },
    body: event,
  });
  check("Pascal accepts authenticated integration callback", r.ok);
  r = await fetch(shop + "/api/demo/entrega-segura/webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Entrega-Timestamp": time,
      "X-Entrega-Signature": "forged",
    },
    body: event,
  });
  check("Pascal rejects forged callback", r.status === 401);
  r = await fetch(app + "/api/paypal/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: "forged", resource: {} }),
  });
  check("Unsigned PayPal webhook rejected", !r.ok);
  r = await fetch(app + `/api/orders/${order.ref}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
      Origin: app,
    },
    body: JSON.stringify({
      action: "message",
      text: "No había nadie, dejé aviso.",
    }),
  });
  const parsed = await r.json();
  check(
    "Live AI parsing routes through gate without charging unapproved order",
    r.ok &&
      parsed.ai.kind === "not_home" &&
      parsed.order.state === "awaiting_approval" &&
      parsed.order.captures.length === 0,
    parsed.ai ? `${parsed.ai.provider} / ${parsed.ai.model}` : parsed.error,
  );
  mkdirSync("reports", { recursive: true });
  writeFileSync(
    "reports/local-contract.json",
    JSON.stringify(
      {
        at: new Date().toISOString(),
        scope:
          "Local applications, real sandbox order creation and AI; no buyer-approved captures or real PayPal webhook verification in this check.",
        passed: results.filter((x) => x.passed).length,
        total: results.length,
        results,
      },
      null,
      2,
    ) + "\n",
  );
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
