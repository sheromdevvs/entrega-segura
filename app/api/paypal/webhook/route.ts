import { NextResponse } from "next/server";
import { handleWebhook } from "@/lib/paypal/webhook";
export const runtime = "nodejs";
export async function POST(req: Request) {
  try {
    const raw = await req.text();
    if (raw.length > 1000000)
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    return NextResponse.json(await handleWebhook(raw, req.headers));
  } catch (e) {
    console.error(e instanceof Error ? e.message : "Webhook failed");
    return NextResponse.json(
      { error: "Webhook rejected or processing failed" },
      { status: 400 },
    );
  }
}
