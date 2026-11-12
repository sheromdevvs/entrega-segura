import { NextResponse } from "next/server";
import { equal } from "@/lib/security";
import { byMerchantRef } from "@/lib/store";
export async function GET(req: Request) {
  if (
    !process.env.SHOP_API_KEY ||
    !equal(
      req.headers.get("authorization") || "",
      `Bearer ${process.env.SHOP_API_KEY}`,
    )
  )
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const r = byMerchantRef(
    new URL(req.url).searchParams.get("merchantRef") || "",
  );
  if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    orderRef: r.ref,
    merchantRef: r.merchantRef,
    product: r.product,
    state: r.state,
    total: r.total,
    deposit: r.deposit,
    captures: r.captures,
    refunds: r.refunds,
    lastWebhook: r.lastWebhook,
    decision: r.decisions.at(-1),
    sandbox: true,
  });
}
