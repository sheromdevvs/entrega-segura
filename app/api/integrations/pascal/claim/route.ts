import { NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import { session, equal } from "@/lib/security";
import { get, assignOwner } from "@/lib/store";
export async function GET(req: Request) {
  try {
    const u = new URL(req.url),
      ref = u.searchParams.get("ref") || "",
      claim = u.searchParams.get("claim") || "",
      expires = u.searchParams.get("expires") || "",
      sig = u.searchParams.get("sig") || "";
    const expected = createHmac("sha256", process.env.SESSION_SECRET!)
      .update(`${ref}:${claim}:${expires}`)
      .digest("hex");
    if (!equal(sig, expected)) throw new Error("Invalid link");
    const r = await get(ref);
    if (!Number.isFinite(Number(expires)) || Date.now() > Number(expires))
      throw new Error("Link expired");
    const owner = await session();
    if (r.owner !== owner && !(await assignOwner(ref, `claim:${claim}`, owner)))
      throw new Error("Link already claimed");
    return NextResponse.redirect(
      new URL(
        `/judge?ref=${ref}`,
        process.env.APP_URL || "http://localhost:3025",
      ),
    );
  } catch {
    return NextResponse.json(
      { error: "Checkout link invalid, expired or already claimed" },
      { status: 403 },
    );
  }
}
