import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";

export const dynamic = "force-dynamic";

export async function GET() {
  // Readiness verifies the application schema as well as the database connection.
  // Never return connection strings, provider errors, or user information.
  try {
    await db.course.count();
    return NextResponse.json({ status: "ok", service: "opentj", database: "ready" }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ status: "unavailable", service: "opentj", database: "unavailable" }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
