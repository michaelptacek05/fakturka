import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    return NextResponse.json(
      { database: "down", status: "error" },
      { status: 503 },
    );
  }

  return NextResponse.json({ database: "up", status: "ok" });
}
