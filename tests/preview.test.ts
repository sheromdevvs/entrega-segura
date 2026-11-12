import { describe, it, expect } from "vitest";
import {
  createPreview,
  previewEvent,
  previewRefund,
} from "../lib/demo/preview";
import { ledger } from "../lib/presentation";
import type { DeliveryEvent } from "../lib/types";
const event = (
  kind: DeliveryEvent["kind"],
  id: string = kind,
  code?: string,
): DeliveryEvent => ({
  kind,
  id,
  at: new Date().toISOString(),
  source: "simulated_laar",
  text: "Illustrative event",
  code,
});
describe("guided view uses deterministic rules without provider calls", () => {
  it("starts with an illustrative production deposit", () => {
    const r = createPreview();
    expect(ledger(r)).toMatchObject({ deposit: 1200, held: 1200, balance: 0 });
    expect(r.paypalOrderId).toBeUndefined();
    expect(r.lastWebhook).toBeUndefined();
  });
  it("resolves a matching code exactly once", () => {
    let r = createPreview();
    r = previewEvent(r, event("delivered", "one", r.code));
    r = previewEvent(r, event("delivered", "two", r.code));
    expect(r.state).toBe("released");
    expect(r.captures.filter((x) => x.role === "balance")).toHaveLength(1);
    expect(ledger(r).collected).toBe(2400);
  });
  it("voids only the balance on refusal", () => {
    const r = previewEvent(createPreview(), event("refused"));
    expect(r.state).toBe("voided");
    expect(ledger(r)).toMatchObject({ deposit: 1200, held: 0, balance: 0 });
  });
  it("escalates the second absence", () => {
    let r = createPreview();
    r = previewEvent(r, event("not_home", "first"));
    expect(r.decisions.at(-1)?.action).toBe("wait");
    r = previewEvent(r, event("not_home", "second"));
    expect(r.decisions.at(-1)?.action).toBe("ask_shop");
    expect(r.state).toBe("held");
  });
  it("requires reviewed photo evidence before an illustrative refund", () => {
    let r = createPreview("mug");
    expect(() => previewRefund(r, 300)).toThrow();
    r = previewEvent(r, event("delivered", "delivery", r.code));
    r = previewEvent(r, {
      ...event("defect_reported", "defect"),
      hasPhoto: true,
      photo: "/images/defect-evidence.webp",
    });
    r = previewRefund(r, 300);
    expect(r.state).toBe("refunded");
    expect(ledger(r).refunded).toBe(300);
    expect(() => previewRefund(r, 300)).toThrow();
  });
  it("rounds the custom-production deposit to whole dollars", () => {
    const r = createPreview("frame");
    expect(r.total).toBe(1300);
    expect(r.deposit).toBe(700);
    expect(ledger(r).held).toBe(600);
  });
});
