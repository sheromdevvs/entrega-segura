import { describe, it, expect } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
const dir = mkdtempSync(join(tmpdir(), "entrega-journal-"));
process.env.STORE_DIR = dir;
const { startOperation, finishOperation } = await import("../lib/store");
describe("durable operation safety", () => {
  it("locks an operation amount before a network request", async () => {
    await startOperation("order-1", "refund", 300);
    await expect(startOperation("order-1", "refund", 400)).rejects.toThrow(
      "already fixed",
    );
  });
  it("recovers a known PayPal result without creating another operation", async () => {
    const op = await startOperation("order-2", "release", 1200);
    await finishOperation(op.id, true, { id: "CAPTURE-RECOVERED" });
    expect((await startOperation("order-2", "release", 1200)).result).toEqual({
      id: "CAPTURE-RECOVERED",
    });
  });
  it("blocks ambiguous retries beyond the assumed six-hour window", async () => {
    await startOperation("order-3", "release", 1200);
    const db = new DatabaseSync(join(dir, "entrega.sqlite"));
    db.prepare("UPDATE operations SET started=? WHERE id=?").run(
      Date.now() - 7 * 3600000,
      "order-3:release",
    );
    db.close();
    await expect(startOperation("order-3", "release", 1200)).rejects.toThrow(
      "reconciliation",
    );
  });
  it("allows retry after a definitive rejected request", async () => {
    const op = await startOperation("order-4", "authorize", 2400);
    await finishOperation(op.id, false, { name: "ORDER_NOT_APPROVED" });
    await expect(
      startOperation("order-4", "authorize", 2400),
    ).resolves.toBeTruthy();
  });
});
