import { createHash } from "node:crypto";
import { appendCall, startOperation, finishOperation } from "../store";
const base = "https://api-m.sandbox.paypal.com";
let cached: { value: string; expires: number } | undefined;
export function requestId(ref: string, verb: string, amount = 0) {
  return createHash("sha256")
    .update(`${ref}:${verb}:${amount}`)
    .digest("hex")
    .slice(0, 38);
}
export async function token() {
  if (process.env.PAYPAL_ENV && process.env.PAYPAL_ENV !== "sandbox")
    throw new Error("Only PayPal Sandbox is supported");
  if (cached && cached.expires > Date.now()) return cached.value;
  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET)
    throw new Error("PayPal Sandbox is not configured");
  const r = await fetch(base + "/v1/oauth2/token", {
    method: "POST",
    headers: {
      Authorization:
        "Basic " +
        Buffer.from(
          process.env.PAYPAL_CLIENT_ID + ":" + process.env.PAYPAL_CLIENT_SECRET,
        ).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(20000),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(`PayPal authentication failed (${r.status})`);
  cached = {
    value: d.access_token,
    expires: Date.now() + (d.expires_in - 60) * 1000,
  };
  return cached.value;
}
function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        k,
        /^(payer|shipping|email_address|payer_info|payee|receiver|name|address|phone|email)$/i.test(
          k,
        )
          ? "[redacted]"
          : redact(v),
      ]),
    );
  return value;
}
export async function api(
  path: string,
  method = "GET",
  body?: unknown,
  context?: { ref: string; verb: string; amount?: number; log?: boolean },
) {
  const id =
    method !== "GET"
      ? requestId(
          context?.ref || path,
          context?.verb || method,
          context?.amount,
        )
      : undefined;
  const operation =
    context && context.log !== false && method !== "GET"
      ? startOperation(context.ref, context.verb, context.amount || 0)
      : undefined;
  if (operation?.result) return operation.result;
  const r = await fetch(base + path, {
    method,
    headers: {
      Authorization: `Bearer ${await token()}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(id ? { "PayPal-Request-Id": id } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(25000),
    cache: "no-store",
  });
  const raw = await r.text();
  const d = raw ? JSON.parse(raw) : {};
  if (
    operation &&
    (r.ok ||
      (r.status < 500 &&
        d.details?.[0]?.issue !== "PREVIOUS_REQUEST_IN_PROGRESS"))
  )
    finishOperation(operation.id, r.ok, d);
  const call = {
    at: new Date().toISOString(),
    path,
    method,
    status: r.status,
    debugId: r.headers.get("paypal-debug-id"),
    requestId: id,
    response: redact(d) as Record<string, unknown>,
  };
  console.log(
    JSON.stringify({
      service: "paypal",
      path,
      method,
      status: r.status,
      debugId: call.debugId,
      requestId: id,
    }),
  );
  if (context && context.log !== false) appendCall(context.ref, call);
  if (!r.ok)
    throw new Error(
      `PayPal ${r.status}: ${d.details?.[0]?.issue || d.name || "request failed"} (debug ${call.debugId})`,
    );
  return d;
}
export function money(cents: number) {
  if (!Number.isSafeInteger(cents) || cents <= 0)
    throw new Error("Invalid amount");
  return { currency_code: "USD", value: (cents / 100).toFixed(2) };
}
