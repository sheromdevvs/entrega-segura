import { NextResponse } from "next/server";
import { equal, rateLimit } from "@/lib/security";
import { runMaintenance } from "@/lib/maintenance";
export async function POST(req: Request) {
  if (
    !process.env.MAINTENANCE_SECRET ||
    !equal(
      req.headers.get("authorization") || "",
      `Bearer ${process.env.MAINTENANCE_SECRET}`,
    )
  )
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    rateLimit("maintenance-cron", 2);
    return NextResponse.json(await runMaintenance());
  } catch {
    return NextResponse.json(
      { error: "Maintenance failed; inspect server logs" },
      { status: 503 },
    );
  }
}
