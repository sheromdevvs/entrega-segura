import { describe, it, expect } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
const dir = mkdtempSync(join(tmpdir(), "entrega-journal-"));
process.env.STORE_DIR = dir;
const { startOperation, finishOperation } = await import("../lib/store");
describe("durable operation safety", () => {
  it("locks an operation amount before a network request", () => {
    startOperation("order-1", "refund", 300);
    expect(() => startOperation("order-1", "refund", 400)).toThrow(
      "already fixed",
    );
  });
  it("recovers a known PayPal result without creating another operation", () => {
    const op = startOperation("order-2", "release", 1200);
    finishOperation(op.id, true, { id: "CAPTURE-RECOVERED" });
    expect(startOperation("order-2", "release", 1200).result).toEqual({
      id: "CAPTURE-RECOVERED",
    });
  });
  it("blocks ambiguous retries beyond the assumed six-hour window", () => {
    startOperation("order-3", "release", 1200);
    const db = new DatabaseSync(join(dir, "entrega.sqlite"));
    db.prepare("UPDATE operations SET started=? WHERE id=?").run(
      Date.now() - 7 * 3600000,
      "order-3:release",
    );
    db.close();
    expect(() => startOperation("order-3", "release", 1200)).toThrow(
      "reconciliation",
    );
  });
  it("allows retry after a definitive rejected request", () => {
    const op = startOperation("order-4", "authorize", 2400);
    finishOperation(op.id, false, { name: "ORDER_NOT_APPROVED" });
    expect(() => startOperation("order-4", "authorize", 2400)).not.toThrow();
  });
});
