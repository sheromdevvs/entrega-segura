import { NextResponse } from "next/server";
import { z } from "zod";
import { session, checkOrigin } from "@/lib/security";
import { hitLimit } from "@/lib/store";
import { runSandboxScenario } from "@/lib/scenarios";
export const runtime = "nodejs";
export const maxDuration = 120;
const input = z.object({
  scenario: z
    .enum(["delivered", "refused", "not_home_twice", "defect_refund"])
    .default("delivered"),
  productId: z.enum(["hoodie", "mug", "frame"]).default("hoodie"),
});
// One click runs a whole scenario on the real PayPal Sandbox with PayPal's
// sandbox test card as the buyer. Durable limits keep the shared sandbox
// account usable: per visitor and across every server instance.
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const owner = await session();
    const body = input.parse(await req.json().catch(() => ({})));
    if (!(await hitLimit(`judge-run:${owner}`, 4, 10 * 60000)))
      return NextResponse.json(
        {
          error:
            "Límite de la demo: 4 recorridos cada 10 minutos por visitante. Sus pedidos anteriores siguen disponibles.",
        },
        { status: 429 },
      );
    if (!(await hitLimit("judge-run:all", 60, 60 * 60000)))
      return NextResponse.json(
        {
          error:
            "La demo pública alcanzó su límite por hora. Inténtelo más tarde.",
        },
        { status: 429 },
      );
    const result = await runSandboxScenario(body.scenario, {
      owner,
      productId: body.productId,
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error ? e.message : "No se pudo completar el recorrido",
      },
      { status: 400 },
    );
  }
}
