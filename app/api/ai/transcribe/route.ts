import { NextResponse } from "next/server";
import { session, checkOrigin, rateLimit } from "@/lib/security";
import { transcribe } from "@/lib/ai";
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    rateLimit("audio:" + (await session()), 6);
    const data = await req.formData();
    const file = data.get("audio");
    if (!(file instanceof File)) throw new Error("Audio file required");
    return NextResponse.json({
      text: await transcribe(file),
      model: "whisper-1",
      provider: "OpenAI",
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Transcription failed" },
      { status: 400 },
    );
  }
}
