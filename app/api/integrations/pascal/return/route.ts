import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.redirect(
    process.env.PASCAL_DEMO_URL || "http://localhost:3015/demo/entrega-segura",
  );
}
