// Ledger storage. Postgres (Neon) when DATABASE_URL is set, which is what the
// hosted Vercel deployment uses; node:sqlite under STORE_DIR for local work.
// Every function is async so both backends share one interface.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Pool } from "pg";
import type { Reservation, ApiCall } from "./types";

type Row = Record<string, any>;
type Db = {
  kind: "postgres" | "sqlite";
  all(sql: string, params?: unknown[]): Promise<Row[]>;
  run(sql: string, params?: unknown[]): Promise<number>;
};

const schema = [
  "CREATE TABLE IF NOT EXISTS reservations(ref TEXT PRIMARY KEY, data TEXT NOT NULL, owner TEXT NOT NULL DEFAULT '', source TEXT NOT NULL DEFAULT '', merchant_ref TEXT, created_at BIGINT NOT NULL DEFAULT 0)",
  "CREATE TABLE IF NOT EXISTS webhooks(id TEXT PRIMARY KEY, event_id TEXT UNIQUE, body TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS notifications(id TEXT PRIMARY KEY, body TEXT NOT NULL, delivered INTEGER DEFAULT 0, attempts INTEGER NOT NULL DEFAULT 0, next_attempt BIGINT NOT NULL DEFAULT 0, last_error TEXT, order_ref TEXT, created_at BIGINT NOT NULL DEFAULT 0)",
  "CREATE TABLE IF NOT EXISTS operations(id TEXT PRIMARY KEY, amount INTEGER NOT NULL, started BIGINT NOT NULL, state TEXT NOT NULL, result TEXT)",
  "CREATE TABLE IF NOT EXISTS rate_hits(key TEXT NOT NULL, at BIGINT NOT NULL)",
  "CREATE INDEX IF NOT EXISTS reservations_owner ON reservations(owner, created_at)",
  "CREATE INDEX IF NOT EXISTS notifications_ref ON notifications(order_ref)",
  "CREATE INDEX IF NOT EXISTS rate_hits_key ON rate_hits(key, at)",
];

const scope = globalThis as typeof globalThis & {
  entregaDb?: Promise<Db>;
  entregaLockPool?: Pool;
};

async function pgPool(): Promise<typeof import("pg").Pool> {
  const mod: any = await import("pg");
  return mod.Pool ?? mod.default.Pool;
}
function pgUrl(url?: string) {
  // pg treats sslmode=require as verify-full already; say so to avoid its warning.
  return url?.replace("sslmode=require", "sslmode=verify-full");
}
export function usingPostgres() {
  return !!process.env.DATABASE_URL;
}

async function openPostgres(): Promise<Db> {
  const Pool = await pgPool();
  const pool = new Pool({
    connectionString: pgUrl(process.env.DATABASE_URL),
    max: 5,
    idleTimeoutMillis: 10000,
  });
  // Neon closes idle connections; an idle client error must not crash the process.
  pool.on("error", (e) =>
    console.warn("Postgres idle client error", e.message),
  );
  const toPg = (sql: string) => {
    let i = 0;
    return sql.replace(/\?/g, () => `$${++i}`);
  };
  const db: Db = {
    kind: "postgres",
    async all(sql, params = []) {
      return (await pool.query(toPg(sql), params)).rows;
    },
    async run(sql, params = []) {
      return (await pool.query(toPg(sql), params)).rowCount || 0;
    },
  };
  for (const statement of schema) await db.run(statement);
  return db;
}

async function openSqlite(): Promise<Db> {
  const { DatabaseSync } = await import("node:sqlite");
  const dir = process.env.STORE_DIR || ".data";
  mkdirSync(dir, { recursive: true });
  const c = new DatabaseSync(join(dir, "entrega.sqlite"));
  c.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;");
  // Older local ledgers predate the indexed columns; add and backfill them.
  const migrate = (table: string, add: [string, string][]) => {
    const exists = c.prepare(`PRAGMA table_info(${table})`).all() as {
      name: string;
    }[];
    if (!exists.length) return;
    for (const [name, definition] of add)
      if (!exists.some((x) => x.name === name))
        c.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
  };
  migrate("reservations", [
    ["owner", "TEXT NOT NULL DEFAULT ''"],
    ["source", "TEXT NOT NULL DEFAULT ''"],
    ["merchant_ref", "TEXT"],
    ["created_at", "BIGINT NOT NULL DEFAULT 0"],
  ]);
  migrate("notifications", [
    ["attempts", "INTEGER NOT NULL DEFAULT 0"],
    ["next_attempt", "BIGINT NOT NULL DEFAULT 0"],
    ["last_error", "TEXT"],
    ["order_ref", "TEXT"],
    ["created_at", "BIGINT NOT NULL DEFAULT 0"],
  ]);
  for (const statement of schema) c.exec(statement);
  c.exec(
    "UPDATE reservations SET owner=json_extract(data,'$.owner'), source=json_extract(data,'$.source'), merchant_ref=json_extract(data,'$.merchantRef'), created_at=rowid WHERE created_at=0; UPDATE notifications SET order_ref=json_extract(body,'$.orderRef'), created_at=rowid WHERE order_ref IS NULL;",
  );
  const norm = (params: unknown[]) =>
    params.map((p) => (p === undefined ? null : p)) as (
      string | number | null
    )[];
  return {
    kind: "sqlite",
    async all(sql, params = []) {
      return c.prepare(sql).all(...norm(params)) as Row[];
    },
    async run(sql, params = []) {
      return Number(c.prepare(sql).run(...norm(params)).changes);
    },
  };
}

function db() {
  if (!scope.entregaDb) {
    scope.entregaDb = usingPostgres() ? openPostgres() : openSqlite();
    scope.entregaDb.catch(() => (scope.entregaDb = undefined));
  }
  return scope.entregaDb;
}

let clock = 0;
function now() {
  // Strictly increasing so "newest first" ordering is stable within a process.
  clock = Math.max(clock + 1, Date.now());
  return clock;
}

const parse = (rows: Row[]) =>
  rows.map((x) => JSON.parse(x.data) as Reservation);

export async function save(r: Reservation) {
  await (
    await db()
  ).run(
    "INSERT INTO reservations(ref,data,owner,source,merchant_ref,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(ref) DO UPDATE SET data=excluded.data, owner=excluded.owner, source=excluded.source, merchant_ref=excluded.merchant_ref",
    [r.ref, JSON.stringify(r), r.owner, r.source, r.merchantRef ?? null, now()],
  );
  return r;
}
export async function get(ref: string) {
  const [row] = await (
    await db()
  ).all("SELECT data FROM reservations WHERE ref=?", [ref]);
  if (!row) throw new Error("Order not found");
  return JSON.parse(row.data) as Reservation;
}
export async function list(owner: string) {
  return parse(
    await (
      await db()
    ).all(
      "SELECT data FROM reservations WHERE owner=? ORDER BY created_at DESC LIMIT 100",
      [owner],
    ),
  );
}
export async function listAll(limit = 500) {
  return parse(
    await (
      await db()
    ).all("SELECT data FROM reservations ORDER BY created_at DESC LIMIT ?", [
      limit,
    ]),
  );
}
export async function byPayPalId(id: string) {
  if (!id) return undefined;
  const rows = await (
    await db()
  ).all("SELECT data FROM reservations WHERE data LIKE ?", [
    `%${id.replace(/[%_]/g, "")}%`,
  ]);
  return parse(rows).find(
    (x) =>
      x.paypalOrderId === id ||
      x.depositOrderId === id ||
      x.authorizationId === id ||
      x.captures.some((c) => c.id === id) ||
      x.refunds.some((c) => c.id === id) ||
      x.payout?.payout_batch_id === id,
  );
}
export async function byMerchantRef(ref: string) {
  const [row] = await (
    await db()
  ).all(
    "SELECT data FROM reservations WHERE source='pascal' AND merchant_ref=? ORDER BY created_at DESC LIMIT 1",
    [ref],
  );
  return row ? (JSON.parse(row.data) as Reservation) : undefined;
}
export async function assignOwner(
  ref: string,
  expected: string,
  owner: string,
) {
  const r = await get(ref);
  if (r.owner !== expected) return false;
  return (
    (await (
      await db()
    ).run("UPDATE reservations SET data=?, owner=? WHERE ref=? AND owner=?", [
      JSON.stringify({ ...r, owner }),
      owner,
      ref,
      expected,
    ])) > 0
  );
}
export async function appendCall(ref: string, call: ApiCall) {
  const r = await get(ref);
  r.calls.push(call);
  await save(r);
}

export async function recordWebhook(
  transmissionId: string,
  eventId: string,
  body: unknown,
) {
  return (
    (await (
      await db()
    ).run(
      "INSERT INTO webhooks(id,event_id,body) VALUES(?,?,?) ON CONFLICT DO NOTHING",
      [transmissionId, eventId, JSON.stringify(body)],
    )) > 0
  );
}
export async function webhookSeen(transmissionId: string, eventId: string) {
  return (
    (
      await (
        await db()
      ).all("SELECT id FROM webhooks WHERE id=? OR event_id=?", [
        transmissionId,
        eventId,
      ])
    ).length > 0
  );
}

export async function enqueueNotification(id: string, body: string) {
  let orderRef: string | null = null;
  try {
    orderRef = JSON.parse(body).orderRef ?? null;
  } catch {}
  await (
    await db()
  ).run(
    "INSERT INTO notifications(id,body,order_ref,created_at) VALUES(?,?,?,?) ON CONFLICT DO NOTHING",
    [id, body, orderRef, now()],
  );
}
export async function pendingNotifications(orderRef?: string) {
  const d = await db();
  return (
    orderRef
      ? await d.all(
          "SELECT id,body FROM notifications WHERE delivered=0 AND next_attempt<=? AND order_ref=? ORDER BY created_at LIMIT 50",
          [Date.now(), orderRef],
        )
      : await d.all(
          "SELECT id,body FROM notifications WHERE delivered=0 AND next_attempt<=? ORDER BY created_at LIMIT 50",
          [Date.now()],
        )
  ) as { id: string; body: string }[];
}
export async function failedNotification(id: string, error: string) {
  const d = await db();
  const [row] = await d.all("SELECT attempts FROM notifications WHERE id=?", [
    id,
  ]);
  if (!row) return;
  const attempts = Number(row.attempts) + 1;
  await d.run(
    "UPDATE notifications SET attempts=?,next_attempt=?,last_error=? WHERE id=?",
    [
      attempts,
      Date.now() + Math.min(1800000, 30000 * 2 ** Math.min(attempts - 1, 6)),
      error,
      id,
    ],
  );
}
export async function deliveredNotification(id: string) {
  await (
    await db()
  ).run("UPDATE notifications SET delivered=1 WHERE id=?", [id]);
}
export async function retryNotificationsFor(ref: string) {
  await (
    await db()
  ).run(
    "UPDATE notifications SET next_attempt=0 WHERE delivered=0 AND order_ref=?",
    [ref],
  );
}
export async function notificationSummary(ref: string) {
  return (
    await (
      await db()
    ).all(
      "SELECT id,delivered,attempts,next_attempt,last_error FROM notifications WHERE order_ref=? ORDER BY created_at DESC LIMIT 20",
      [ref],
    )
  ).map((x) => ({
    id: String(x.id),
    delivered: Number(x.delivered),
    attempts: Number(x.attempts),
    next_attempt: Number(x.next_attempt),
    last_error: x.last_error ?? null,
  }));
}

export async function startOperation(
  ref: string,
  verb: string,
  amount: number,
) {
  const id = ref + ":" + verb;
  const d = await db();
  await d.run(
    "INSERT INTO operations(id,amount,started,state) VALUES(?,?,?,?) ON CONFLICT DO NOTHING",
    [id, amount, Date.now(), "pending"],
  );
  const [row] = await d.all(
    "SELECT amount,started,state,result FROM operations WHERE id=?",
    [id],
  );
  if (Number(row.amount) !== amount)
    throw new Error("Operation amount is already fixed");
  if (row.state === "success")
    return { id, result: JSON.parse(row.result) as any };
  if (row.state === "pending" && Date.now() - Number(row.started) > 6 * 3600000)
    throw new Error(
      "Ambiguous PayPal operation is older than six hours; shop reconciliation is required before retrying",
    );
  if (row.state === "failed")
    await d.run("UPDATE operations SET state='pending',started=? WHERE id=?", [
      Date.now(),
      id,
    ]);
  return { id } as { id: string; result?: any };
}
export async function finishOperation(
  id: string,
  ok: boolean,
  result: unknown,
) {
  await (
    await db()
  ).run("UPDATE operations SET state=?,result=? WHERE id=?", [
    ok ? "success" : "failed",
    JSON.stringify(result),
    id,
  ]);
}

/** Durable sliding-window limiter shared by every server instance. */
export async function hitLimit(key: string, max: number, windowMs: number) {
  const d = await db();
  const since = Date.now() - windowMs;
  const [row] = await d.all(
    "SELECT COUNT(*) AS n FROM rate_hits WHERE key=? AND at>?",
    [key, since],
  );
  if (Number(row?.n || 0) >= max) return false;
  await d.run("INSERT INTO rate_hits(key,at) VALUES(?,?)", [key, Date.now()]);
  if (Math.random() < 0.05)
    await d.run("DELETE FROM rate_hits WHERE at<?", [Date.now() - 86400000]);
  return true;
}

// Per-reservation mutual exclusion. In-process ordering always applies; with
// Postgres a session advisory lock also serialises work across serverless
// instances (a PayPal webhook may land on another instance mid-capture).
const pending = new Map<string, Promise<unknown>>();
async function lockPool() {
  if (!scope.entregaLockPool) {
    // Session advisory locks need a direct connection, not the PgBouncer pooler.
    const Pool = await pgPool();
    scope.entregaLockPool = new Pool({
      connectionString: pgUrl(
        process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL,
      ),
      max: 10,
      idleTimeoutMillis: 10000,
    });
    scope.entregaLockPool.on("error", (e) =>
      console.warn("Postgres lock client error", e.message),
    );
  }
  return scope.entregaLockPool;
}
async function withDbLock<T>(key: string, fn: () => Promise<T>) {
  const client = await (await lockPool()).connect();
  let healthy = true;
  const onError = () => (healthy = false);
  client.on("error", onError);
  try {
    await client.query("SET lock_timeout = '60s'");
    await client.query("SELECT pg_advisory_lock(hashtext($1))", [key]);
    try {
      return await fn();
    } finally {
      try {
        await client.query("SELECT pg_advisory_unlock(hashtext($1))", [key]);
      } catch {
        healthy = false;
      }
    }
  } finally {
    client.off("error", onError);
    client.release(!healthy);
  }
}
export async function locked<T>(ref: string, fn: () => Promise<T>): Promise<T> {
  const prior = pending.get(ref) || Promise.resolve();
  const run = usingPostgres() ? () => withDbLock(ref, fn) : fn;
  const task = prior.catch(() => {}).then(run);
  pending.set(ref, task);
  try {
    return await task;
  } finally {
    if (pending.get(ref) === task) pending.delete(ref);
  }
}
