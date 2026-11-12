import { NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes, createHmac } from "node:crypto";
import { equal, rateLimit } from "@/lib/security";
import { createOrder } from "@/lib/orders";
import { hold } from "@/lib/paypal";
import { get, save, byMerchantRef, locked } from "@/lib/store";
const schema = z.object({
  merchantRef: z.string().min(1).max(100),
  productId: z.enum(["hoodie", "mug", "frame"]),
  paymentStrategy: z.enum(["single", "split"]).optional(),
});
export async function POST(req: Request) {
  try {
    if (
      !process.env.SHOP_API_KEY ||
      !equal(
        req.headers.get("authorization") || "",
        `Bearer ${process.env.SHOP_API_KEY}`,
      )
    )
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    rateLimit("pascal-api", 20);
    const body = schema.parse(await req.json());
    return await locked(`merchant:${body.merchantRef}`, async () => {
      const r =
        (await byMerchantRef(body.merchantRef)) ||
        (await createOrder(
          "pascal-server",
          body.productId,
          "pascal",
          body.merchantRef,
          body.paymentStrategy,
        ));
      await hold({
        orderRef: r.ref,
        total: r.total,
        depositNow: r.deposit,
        currency: r.currency,
      });
      const claim = randomBytes(24).toString("hex");
      const expires = String(Date.now() + 30 * 60000);
      const origin = process.env.APP_URL || "http://localhost:3025";
      const sig = createHmac("sha256", process.env.SESSION_SECRET!)
        .update(`${r.ref}:${claim}:${expires}`)
        .digest("hex");
      await save({ ...(await get(r.ref)), owner: `claim:${claim}` });
      return NextResponse.json({
        orderRef: r.ref,
        checkoutUrl: `${origin}/api/integrations/pascal/claim?ref=${r.ref}&claim=${claim}&expires=${expires}&sig=${sig}`,
        sandbox: true,
      });
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Checkout failed" },
      { status: 400 },
    );
  }
}
