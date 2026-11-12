import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
process.env.STORE_DIR = mkdtempSync(join(tmpdir(), "entrega-split-"));
process.env.PAYPAL_CLIENT_ID = "test";
process.env.PAYPAL_CLIENT_SECRET = "test";
process.env.PAYPAL_ENV = "sandbox";
const { createOrder } = await import("../lib/orders");
const { get, save } = await import("../lib/store");
const paypal = await import("../lib/paypal");
let requests: { path: string; method: string; body: any }[] = [],
  depositApproved = true,
  balanceApproved = false,
  pendingDeposit = false;
beforeEach(() => {
  requests = [];
  depositApproved = true;
  balanceApproved = false;
  pendingDeposit = false;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: any = {}) => {
      const path = new URL(url).pathname,
        method = init.method || "GET",
        body =
          init.body && init.body !== "grant_type=client_credentials"
            ? JSON.parse(init.body)
            : undefined;
      requests.push({ path, method, body });
      if (path.endsWith("/token"))
        return Response.json({ access_token: "test-token", expires_in: 3600 });
      if (path === "/v2/checkout/orders" && method === "POST") {
        const id =
          body.intent === "CAPTURE" ? "DEPOSIT-ORDER" : "BALANCE-ORDER";
        return Response.json(
          {
            id,
            links: [
              {
                rel: "payer-action",
                href: `https://www.sandbox.paypal.com/checkoutnow?token=${id}`,
              },
            ],
          },
          { status: 201 },
        );
      }
      if (path.endsWith("DEPOSIT-ORDER/capture"))
        return Response.json(
          {
            purchase_units: [
              {
                payments: {
                  captures: [
                    {
                      id: "DEPOSIT-CAPTURE",
                      status: pendingDeposit ? "PENDING" : "COMPLETED",
                    },
                  ],
                },
              },
            ],
          },
          { status: 201 },
        );
      if (path.endsWith("/authorize"))
        return Response.json(
          {
            purchase_units: [
              {
                payments: {
                  authorizations: [
                    {
                      id: "BALANCE-AUTH",
                      status: "CREATED",
                      create_time: new Date().toISOString(),
                    },
                  ],
                },
              },
            ],
          },
          { status: 201 },
        );
      if (path.endsWith("/capture"))
        return Response.json(
          { id: "BALANCE-CAPTURE", status: "COMPLETED" },
          { status: 201 },
        );
      if (path.endsWith("/void")) return new Response(null, { status: 204 });
      if (path === "/v1/payments/payouts")
        return Response.json(
          {
            batch_header: {
              payout_batch_id: "PAYOUT-1",
              batch_status: "PENDING",
            },
          },
          { status: 201 },
        );
      if (path.includes("/payments/captures/"))
        return Response.json({ id: "DEPOSIT-CAPTURE", status: "COMPLETED" });
      return Response.json({
        id: path.split("/").at(-1),
        status: path.endsWith("DEPOSIT-ORDER")
          ? depositApproved
            ? "APPROVED"
            : "CREATED"
          : balanceApproved
            ? "APPROVED"
            : "CREATED",
      });
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());
async function checkout() {
  const r = await createOrder("unit", "hoodie", "judge", undefined, "split");
  return paypal.hold({
    orderRef: r.ref,
    total: r.total,
    depositNow: r.deposit,
    currency: r.currency,
  });
}
describe("two-order compatibility strategy, transport mocked", () => {
  it("creates separate CAPTURE deposit and AUTHORIZE balance orders", async () => {
    const r = await checkout();
    const create = requests.filter((x) => x.path === "/v2/checkout/orders");
    expect(create.map((x) => x.body.intent)).toEqual(["CAPTURE", "AUTHORIZE"]);
    expect(create.map((x) => x.body.purchase_units[0].amount.value)).toEqual([
      "12.00",
      "12.00",
    ]);
    expect(r.depositOrderId).toBe("DEPOSIT-ORDER");
    expect(r.paypalOrderId).toBe("BALANCE-ORDER");
  });
  it("retains a completed deposit while awaiting second buyer approval", async () => {
    let r = await checkout();
    r = await paypal.completeApproval({ orderRef: r.ref });
    expect(r.state).toBe("awaiting_balance_approval");
    expect(r.captures[0].id).toBe("DEPOSIT-CAPTURE");
    expect(r.authorizationId).toBeUndefined();
    expect(r.approvalUrl).toContain("BALANCE-ORDER");
  });
  it("authorizes only the balance after both approvals", async () => {
    let r = await checkout();
    await paypal.completeApproval({ orderRef: r.ref });
    balanceApproved = true;
    r = await paypal.completeApproval({ orderRef: r.ref });
    expect(r.state).toBe("held");
    expect(r.authorizationId).toBe("BALANCE-AUTH");
    expect(
      requests.filter((x) => x.path.endsWith("DEPOSIT-ORDER/capture")),
    ).toHaveLength(1);
  });
  it("captures balance once without a partial authorization capture", async () => {
    let r = await checkout();
    balanceApproved = true;
    await paypal.completeApproval({ orderRef: r.ref });
    r = await paypal.release({ orderRef: r.ref });
    await paypal.release({ orderRef: r.ref });
    expect(r.state).toBe("released");
    const balance = requests.filter((x) =>
      x.path.endsWith("BALANCE-AUTH/capture"),
    );
    expect(balance).toHaveLength(1);
    expect(balance[0].body).toMatchObject({
      amount: { value: "12.00" },
      final_capture: true,
    });
  });
  it("rejects a deposit that has not been approved", async () => {
    depositApproved = false;
    const r = await checkout();
    await expect(paypal.completeApproval({ orderRef: r.ref })).rejects.toThrow(
      "deposit",
    );
    expect(requests.filter((x) => x.path.endsWith("/capture"))).toHaveLength(0);
  });
  it("keeps a pending deposit from authorizing or releasing the balance", async () => {
    pendingDeposit = true;
    balanceApproved = true;
    const r = await checkout();
    const result = await paypal.completeApproval({ orderRef: r.ref });
    expect(result.state).toBe("deposit_pending");
    expect(requests.filter((x) => x.path.endsWith("/authorize"))).toHaveLength(
      0,
    );
    await expect(paypal.release({ orderRef: r.ref })).rejects.toThrow(
      "not ready",
    );
  });
  it("voids the balance and retains the independently captured deposit", async () => {
    balanceApproved = true;
    const r = await checkout();
    await paypal.completeApproval({ orderRef: r.ref });
    const voided = await paypal.cancel({ orderRef: r.ref });
    expect(voided.state).toBe("voided");
    expect(voided.captures).toHaveLength(1);
    expect(voided.captures[0].amount).toBe(1200);
  });
  it("prevents a courier payout intent from changing recipient or amount", async () => {
    const r = await createOrder("unit");
    r.state = "released";
    r.captures = [
      {
        id: "PAID-BALANCE",
        amount: 1200,
        role: "balance",
        status: "COMPLETED",
      },
    ];
    await save(r);
    await paypal.payOut({
      orderRef: r.ref,
      amount: 300,
      receiverEmail: "courier@personal.example.com",
      note: "Sandbox",
    });
    await paypal.payOut({
      orderRef: r.ref,
      amount: 300,
      receiverEmail: "courier@personal.example.com",
      note: "Retry",
    });
    await expect(
      paypal.payOut({
        orderRef: r.ref,
        amount: 400,
        receiverEmail: "courier@personal.example.com",
        note: "Changed",
      }),
    ).rejects.toThrow("already fixed");
    expect(
      requests.filter((x) => x.path === "/v1/payments/payouts"),
    ).toHaveLength(1);
    expect((await get(r.ref)).payout?.payout_batch_id).toBe("PAYOUT-1");
  });
});
