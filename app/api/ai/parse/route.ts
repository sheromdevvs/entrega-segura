import { NextResponse } from "next/server";
import { z } from "zod";
import { checkOrigin, session, rateLimit } from "@/lib/security";
import { parseMessage } from "@/lib/ai";
const schema = z.object({
  text: z.string().trim().min(1).max(3000),
  photo: z
    .string()
    .max(7000000)
    .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/)
    .optional(),
});
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    rateLimit("parser:" + (await session()), 12);
    const data = schema.parse(await req.json());
    return NextResponse.json({
      ai: await parseMessage(data.text, !!data.photo, data.photo),
      paymentsInvoked: false,
    });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error ? e.message : "No se pudo interpretar el mensaje.",
      },
      { status: 400 },
    );
  }
}
