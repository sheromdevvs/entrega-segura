import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { session, checkOrigin, rateLimit } from "@/lib/security";
import { get, save } from "@/lib/store";
import { completeApproval, refresh, reauthorize, hold } from "@/lib/paypal";
import { parseMessage } from "@/lib/ai";
import {
  processEvent,
  shopRefund,
  notifyShop,
  flushNotifications,
} from "@/lib/orders";
import { SimulatedLaar } from "@/lib/courier";
const input = z.object({
  action: z.enum([
    "approve",
    "message",
    "scenario",
    "refund",
    "refresh",
    "reauthorize",
    "retry_checkout",
    "retry_notifications",
    "retry_event",
  ]),
  text: z.string().max(3000).optional(),
  scenario: z
    .enum([
      "delivered",
      "refused",
      "not_home",
      "defect_reported",
      "partial_delivery",
    ])
    .optional(),
  code: z
    .string()
    .regex(/^\d{4}$/)
    .optional(),
  photo: z.string().max(7000000).optional(),
  amount: z.number().int().positive().optional(),
});
async function owned(ref: string) {
  const r = get(ref);
  if (r.owner !== (await session())) throw new Error("Order not found");
  return r;
}
export async function GET(
  _: Request,
  { params }: { params: Promise<{ ref: string }> },
) {
  try {
    return NextResponse.json(await owned((await params).ref));
  } catch {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
}
export async function POST(
  req: Request,
  { params }: { params: Promise<{ ref: string }> },
) {
  let ref: string | undefined;
  let authorized = false;
  try {
    checkOrigin(req);
    ref = (await params).ref;
    const r = await owned(ref);
    authorized = true;
    rateLimit(r.owner, 40);
    const body = input.parse(await req.json());
    if (body.action === "approve") {
      const result = await completeApproval({ orderRef: ref });
      await notifyShop(result);
      return NextResponse.json({ order: result });
    }
    if (body.action === "retry_event") {
      const event = r.events.find((x) => x.applied === false);
      if (!event) throw new Error("No pending delivery action");
      return NextResponse.json({ order: await processEvent(ref, event) });
    }
    if (body.action === "refresh")
      return NextResponse.json({ order: await refresh({ orderRef: ref }) });
    if (body.action === "retry_checkout")
      return NextResponse.json({
        order: await hold({
          orderRef: ref,
          total: r.total,
          depositNow: r.deposit,
          currency: r.currency,
        }),
      });
    if (body.action === "retry_notifications") {
      await flushNotifications();
      return NextResponse.json({ order: get(ref) });
    }
    if (body.action === "reauthorize")
      return NextResponse.json({ order: await reauthorize({ orderRef: ref }) });
    if (body.action === "refund")
      return NextResponse.json({
        order: await shopRefund(ref, body.amount || 0),
      });
    if (body.action === "message") {
      if (!body.text?.trim()) throw new Error("Escriba un mensaje primero.");
      const photo = body.photo;
      const hasPhoto =
        !!photo &&
        /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(photo);
      if (photo && !hasPhoto) throw new Error("Invalid photo attachment");
      const ai = await parseMessage(
        body.text,
        hasPhoto,
        hasPhoto ? photo : undefined,
      );
      const code = body.code || body.text.match(/\b\d{4}\b/)?.[0];
      const order = await processEvent(ref, {
        id: randomUUID(),
        kind: ai.kind,
        at: new Date().toISOString(),
        code,
        hasPhoto,
        photo: hasPhoto ? photo : undefined,
        interpretation: ai,
        source: "chat",
        text: body.text,
      });
      return NextResponse.json({ order, ai });
    }
    const kind = body.scenario;
    if (!kind) throw new Error("Choose a scenario");
    if (kind === "defect_reported")
      throw new Error(
        "Para reportar un defecto, adjunte una foto y envíe un mensaje.",
      );
    const courier = await new SimulatedLaar(
      kind === "partial_delivery" ? "in_transit" : kind,
    ).getStatus(`DEMO-${ref}`);
    return NextResponse.json({
      order: await processEvent(ref, {
        id: randomUUID(),
        kind,
        at: courier.at,
        source: "simulated_laar",
        code: kind === "delivered" ? r.code : undefined,
        text: courier.evidence,
      }),
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Action failed",
        ...(ref && authorized
          ? {
              order: (() => {
                try {
                  return get(ref!);
                } catch {
                  return undefined;
                }
              })(),
            }
          : {}),
      },
      { status: 400 },
    );
  }
}
