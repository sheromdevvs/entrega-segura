import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { decide, approveRefund } from "../lib/gate";
import { requestId } from "../lib/paypal/client";
import type { Reservation, DeliveryEvent, EventKind } from "../lib/types";
export function reservation(): Reservation {
  return {
    ref: "ES-TEST",
    owner: "test",
    source: "judge",
    product: "Hoodie",
    total: 2400,
    deposit: 1200,
    currency: "USD",
    code: "4821",
    createdAt: new Date().toISOString(),
    authorizationAt: new Date().toISOString(),
    originalAuthorizationAt: new Date().toISOString(),
    state: "held",
    captures: [
      { id: "DEP", amount: 1200, status: "COMPLETED", role: "deposit" },
    ],
    refunds: [],
    events: [],
    decisions: [],
    calls: [],
  };
}
function event(kind: EventKind, code?: string): DeliveryEvent {
  return {
    id: "event-1",
    kind,
    code,
    at: new Date().toISOString(),
    source: "chat",
    text: "test",
  };
}
describe("delivery gate", () => {
  it("releases only on delivered with matching code", () =>
    expect(decide(reservation(), event("delivered", "4821")).action).toBe(
      "release",
    ));
  it("refuses wrong or missing code", () => {
    expect(decide(reservation(), event("delivered", "0000")).action).toBe(
      "ask_shop",
    );
    expect(decide(reservation(), event("delivered")).action).toBe("ask_shop");
  });
  it("voids balance on refusal", () =>
    expect(decide(reservation(), event("refused")).action).toBe("cancel"));
  it("waits once and escalates second absence", () => {
    const r = reservation();
    const e = event("not_home");
    expect(decide(r, e).action).toBe("wait");
    r.events.push({ ...e, id: "prior" });
    expect(decide(r, e).action).toBe("ask_shop");
  });
  it("escalates incomplete delivery", () =>
    expect(decide(reservation(), event("partial_delivery")).action).toBe(
      "ask_shop",
    ));
  it("escalates defect without automatically refunding", () => {
    const r = reservation();
    r.state = "released";
    r.events = [event("delivered", "4821")];
    expect(
      decide(r, { ...event("defect_reported"), id: "defect", hasPhoto: true })
        .action,
    ).toBe("ask_shop");
  });
  it("requires human review and completed capture for refund", () => {
    const r = reservation();
    expect(approveRefund(r, 300).action).toBe("ask_shop");
    r.state = "released";
    r.events = [
      { ...event("delivered", "4821"), id: "delivery" },
      { ...event("defect_reported"), hasPhoto: true },
    ];
    r.decisions = [{ action: "ask_shop", reason: "Review" }];
    expect(approveRefund(r, 300).action).toBe("refund_partial");
    expect(approveRefund(r, 1300).action).toBe("ask_shop");
  });
  it("blocks expired authorization", () => {
    const r = reservation();
    r.originalAuthorizationAt = new Date(
      Date.now() - 30 * 86400000,
    ).toISOString();
    expect(decide(r, event("delivered", "4821")).action).toBe("ask_shop");
  });
  it("deduplicates events", () => {
    const r = reservation();
    r.events = [event("delivered", "4821")];
    expect(decide(r, event("delivered", "4821")).action).toBe("wait");
  });
  it("rejects invalid and future evidence dates", () => {
    for (const at of ["invalid", new Date(Date.now() + 86400000).toISOString()])
      expect(
        decide(reservation(), { ...event("delivered", "4821"), at }).action,
      ).toBe("ask_shop");
  });
  it("property: arbitrary wrong codes cannot release", () =>
    fc.assert(
      fc.property(
        fc.string().filter((x) => x !== "4821"),
        (code) => {
          expect(
            decide(reservation(), event("delivered", code)).action,
          ).not.toBe("release");
        },
      ),
      { numRuns: 1000 },
    ));
  it("property: resolved balances cannot be captured again", () =>
    fc.assert(
      fc.property(
        fc.constantFrom("released", "voided", "refunded"),
        fc.constantFrom<EventKind>(
          "delivered",
          "refused",
          "not_home",
          "partial_delivery",
          "unknown",
        ),
        (state, kind) => {
          const r = reservation();
          r.state = state;
          expect(decide(r, event(kind, "4821")).action).not.toBe("release");
        },
      ),
      { numRuns: 1000 },
    ));
  it("property: ledger balance capture blocks any future release", () =>
    fc.assert(
      fc.property(
        fc.constantFrom<EventKind>(
          "delivered",
          "refused",
          "not_home",
          "unknown",
        ),
        (kind) => {
          const r = reservation();
          r.captures.push({
            id: "BAL",
            amount: 1200,
            status: "PENDING",
            role: "balance",
          });
          expect(decide(r, event(kind, "4821")).action).not.toBe("release");
        },
      ),
      { numRuns: 500 },
    ));
});
describe("idempotency", () => {
  it("stable per order, operation and integer amount", () => {
    expect(requestId("a", "release", 1200)).toBe(
      requestId("a", "release", 1200),
    );
    expect(requestId("a", "release", 1200)).not.toBe(
      requestId("a", "deposit", 1200),
    );
    expect(requestId("a", "release", 1200)).not.toBe(
      requestId("b", "release", 1200),
    );
  });
  it("property: all request IDs meet PayPal length limit", () =>
    fc.assert(
      fc.property(fc.string(), fc.string(), fc.integer(), (ref, verb, amt) => {
        expect(requestId(ref, verb, amt)).toMatch(/^[0-9a-f]{38}$/);
      }),
      { numRuns: 1000 },
    ));
});
