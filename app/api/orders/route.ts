import { NextResponse } from "next/server";
import { session, checkOrigin, rateLimit } from "@/lib/security";
import { createOrder } from "@/lib/orders";
import { list } from "@/lib/store";
import { hold } from "@/lib/paypal";
export const runtime = "nodejs";
export async function GET() {
  try {
    return NextResponse.json({ orders: list(await session()) });
  } catch {
    return NextResponse.json({ error: "Session unavailable" }, { status: 503 });
  }
}
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const owner = await session();
    rateLimit("create:" + owner, 8);
    const body = await req.json();
    const r = createOrder(owner, body.productId);
    return NextResponse.json(
      await hold({
        orderRef: r.ref,
        total: r.total,
        depositNow: r.deposit,
        currency: r.currency,
      }),
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unable to create checkout" },
      { status: 400 },
    );
  }
}
