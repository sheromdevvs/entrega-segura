import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Reservation, ApiCall } from "./types";
let connection: DatabaseSync | undefined;
function db() {
  if (!connection) {
    const dir = process.env.STORE_DIR || ".data";
    mkdirSync(dir, { recursive: true });
    connection = new DatabaseSync(join(dir, "entrega.sqlite"));
    connection.exec(
      "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS reservations(ref TEXT PRIMARY KEY, data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS webhooks(id TEXT PRIMARY KEY, event_id TEXT UNIQUE, body TEXT NOT NULL); CREATE TABLE IF NOT EXISTS notifications(id TEXT PRIMARY KEY, body TEXT NOT NULL, delivered INTEGER DEFAULT 0); CREATE TABLE IF NOT EXISTS operations(id TEXT PRIMARY KEY, amount INTEGER NOT NULL, started INTEGER NOT NULL, state TEXT NOT NULL, result TEXT);",
    );
  }
  return connection;
}
export function save(r: Reservation) {
  db()
    .prepare(
      "INSERT INTO reservations(ref,data) VALUES(?,?) ON CONFLICT(ref) DO UPDATE SET data=excluded.data",
    )
    .run(r.ref, JSON.stringify(r));
  return r;
}
export function get(ref: string) {
  const row = db()
    .prepare("SELECT data FROM reservations WHERE ref=?")
    .get(ref) as { data: string } | undefined;
  if (!row) throw new Error("Order not found");
  return JSON.parse(row.data) as Reservation;
}
export function list(owner: string) {
  return (
    db().prepare("SELECT data FROM reservations ORDER BY rowid DESC").all() as {
      data: string;
    }[]
  )
    .map((x) => JSON.parse(x.data) as Reservation)
    .filter((x) => x.owner === owner);
}
export function byPayPalId(id: string) {
  return (
    db().prepare("SELECT data FROM reservations").all() as { data: string }[]
  )
    .map((x) => JSON.parse(x.data) as Reservation)
    .find(
      (x) =>
        x.paypalOrderId === id ||
        x.authorizationId === id ||
        x.captures.some((c) => c.id === id) ||
        x.refunds.some((c) => c.id === id) ||
        x.payout?.payout_batch_id === id,
    );
}
export function recordWebhook(
  transmissionId: string,
  eventId: string,
  body: unknown,
) {
  return (
    db()
      .prepare("INSERT OR IGNORE INTO webhooks(id,event_id,body) VALUES(?,?,?)")
      .run(transmissionId, eventId, JSON.stringify(body)).changes > 0
  );
}
export function appendCall(ref: string, call: ApiCall) {
  const r = get(ref);
  r.calls.push(call);
  save(r);
}
const pending = new Map<string, Promise<unknown>>();
export async function locked<T>(ref: string, fn: () => Promise<T>): Promise<T> {
  const prior = pending.get(ref) || Promise.resolve();
  const task = prior.catch(() => {}).then(fn);
  pending.set(ref, task);
  try {
    return await task;
  } finally {
    if (pending.get(ref) === task) pending.delete(ref);
  }
}
export function enqueueNotification(id: string, body: string) {
  db()
    .prepare("INSERT OR IGNORE INTO notifications(id,body) VALUES(?,?)")
    .run(id, body);
}
export function pendingNotifications() {
  return db()
    .prepare("SELECT id,body FROM notifications WHERE delivered=0")
    .all() as { id: string; body: string }[];
}
export function deliveredNotification(id: string) {
  db().prepare("UPDATE notifications SET delivered=1 WHERE id=?").run(id);
}

export function byMerchantRef(ref: string) {
  return (
    db().prepare("SELECT data FROM reservations").all() as { data: string }[]
  )
    .map((x) => JSON.parse(x.data) as Reservation)
    .find((x) => x.source === "pascal" && x.merchantRef === ref);
}
export function webhookSeen(transmissionId: string, eventId: string) {
  return !!db()
    .prepare("SELECT id FROM webhooks WHERE id=? OR event_id=?")
    .get(transmissionId, eventId);
}

export function startOperation(ref: string, verb: string, amount: number) {
  const id = ref + ":" + verb;
  db()
    .prepare(
      "INSERT OR IGNORE INTO operations(id,amount,started,state) VALUES(?,?,?,?)",
    )
    .run(id, amount, Date.now(), "pending");
  const row = db()
    .prepare("SELECT amount,started,state,result FROM operations WHERE id=?")
    .get(id) as {
    amount: number;
    started: number;
    state: string;
    result: string | null;
  };
  if (row.amount !== amount)
    throw new Error("Operation amount is already fixed");
  if (row.state === "success") return { id, result: JSON.parse(row.result!) };
  if (row.state === "pending" && Date.now() - row.started > 6 * 3600000)
    throw new Error(
      "Ambiguous PayPal operation is older than six hours; shop reconciliation is required before retrying",
    );
  if (row.state === "failed")
    db()
      .prepare("UPDATE operations SET state='pending',started=? WHERE id=?")
      .run(Date.now(), id);
  return { id };
}
export function finishOperation(id: string, ok: boolean, result: unknown) {
  db()
    .prepare("UPDATE operations SET state=?,result=? WHERE id=?")
    .run(ok ? "success" : "failed", JSON.stringify(result), id);
}

export function assignOwner(ref: string, expected: string, owner: string) {
  return (
    db()
      .prepare(
        "UPDATE reservations SET data=json_set(data,'$.owner',?) WHERE ref=? AND json_extract(data,'$.owner')=?",
      )
      .run(owner, ref, expected).changes > 0
  );
}
