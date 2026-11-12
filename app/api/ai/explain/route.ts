import { NextResponse } from "next/server";
import { z } from "zod";
import { checkOrigin, session, rateLimit } from "@/lib/security";
import { explainDecision } from "@/lib/ai";
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    rateLimit("explain:" + (await session()), 12);
    const decision = z
      .object({
        action: z.enum([
          "release",
          "cancel",
          "wait",
          "ask_shop",
          "refund_partial",
        ]),
        reason: z.string().min(1).max(1000),
      })
      .parse(await req.json());
    return NextResponse.json({
      explanation: await explainDecision(decision),
      paymentsInvoked: false,
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "La explicación de IA no está disponible. La regla determinista se conserva.",
      },
      { status: 503 },
    );
  }
}
