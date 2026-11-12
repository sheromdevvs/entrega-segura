import { cookies } from "next/headers";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32)
    throw new Error("Set SESSION_SECRET to at least 32 characters");
  return s;
}
export function equal(a: string, b: string) {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export async function session() {
  const jar = await cookies();
  const raw = jar.get("es_session")?.value;
  if (raw) {
    const [id, sig] = raw.split(".");
    if (
      id &&
      sig &&
      equal(sig, createHmac("sha256", secret()).update(id).digest("hex"))
    )
      return id;
  }
  const id = randomBytes(24).toString("hex");
  jar.set(
    "es_session",
    `${id}.${createHmac("sha256", secret()).update(id).digest("hex")}`,
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.APP_URL?.startsWith("https://"),
      path: "/",
      maxAge: 86400,
    },
  );
  return id;
}
export function checkOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (
    origin &&
    origin !== new URL(process.env.APP_URL || "http://localhost:3025").origin
  )
    throw new Error("Cross-origin write rejected");
}
const buckets = new Map<string, { count: number; until: number }>();
export function rateLimit(key: string, max = 40) {
  if (buckets.size > 10000)
    for (const [k, v] of buckets) if (v.until < Date.now()) buckets.delete(k);
  const b = buckets.get(key);
  if (!b || b.until < Date.now()) {
    buckets.set(key, { count: 1, until: Date.now() + 60000 });
    return;
  }
  if (++b.count > max)
    throw new Error("Rate limit reached; try again in one minute");
}
