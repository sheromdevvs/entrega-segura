// Real PayPal Sandbox end-to-end run of every money path. Writes
// reports/sandbox-e2e.json with PayPal IDs and paypal-debug-id values.
// Usage: npm run sandbox:e2e  (needs PAYPAL_CLIENT_ID/SECRET; PAYPAL_BUYER_EMAIL
// is used as the sandbox courier payout recipient).
import { writeFileSync, mkdirSync } from "node:fs";
import { runSandboxScenario, sandboxScenarios } from "../lib/scenarios";
import { usingPostgres } from "../lib/store";

async function main() {
  const only = process.argv.slice(2);
  const results = [];
  let failed = 0;
  for (const scenario of sandboxScenarios) {
    if (only.length && !only.includes(scenario)) continue;
    const started = Date.now();
    try {
      const { order, steps } = await runSandboxScenario(scenario, {
        owner: "sandbox-e2e",
        productId: scenario === "defect_refund" ? "frame" : "hoodie",
        courierEmail: process.env.PAYPAL_BUYER_EMAIL,
      });
      results.push({
        scenario,
        ok: true,
        ms: Date.now() - started,
        orderRef: order.ref,
        finalState: order.state,
        paypal: {
          order: order.paypalOrderId,
          authorization: order.authorizationId,
          captures: order.captures,
          refunds: order.refunds,
          payoutBatch: order.payout?.payout_batch_id,
        },
        decisions: order.decisions.map((d) => d.action),
        steps,
        calls: order.calls.map((c) => ({
          at: c.at,
          method: c.method,
          path: c.path,
          status: c.status,
          debugId: c.debugId,
          requestId: c.requestId,
        })),
      });
      console.log(`PASS ${scenario} ${order.ref} -> ${order.state}`);
    } catch (e) {
      failed++;
      results.push({
        scenario,
        ok: false,
        ms: Date.now() - started,
        error: e instanceof Error ? e.message : String(e),
      });
      console.log(`FAIL ${scenario}: ${e instanceof Error ? e.message : e}`);
    }
  }
  mkdirSync("reports", { recursive: true });
  writeFileSync(
    "reports/sandbox-e2e.json",
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        environment:
          "PayPal Sandbox (api-m.sandbox.paypal.com), US sandbox business account",
        buyer:
          "PayPal sandbox test card 4012000077777777 as Orders v2 payment_source.card (no browser). The hosted human flow uses the PayPal approval link instead.",
        courier:
          "LAAR is simulated (no API access yet); delivery code check is real code",
        storage: usingPostgres() ? "Postgres (Neon)" : "SQLite (local)",
        passed: results.filter((r) => r.ok).length,
        failed,
        results,
      },
      null,
      2,
    ) + "\n",
  );
  if (failed) process.exitCode = 1;
  // pg pools keep the event loop alive.
  setTimeout(() => process.exit(), 200).unref();
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
