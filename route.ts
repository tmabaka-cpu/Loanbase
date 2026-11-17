import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";

export const dynamic = "force-dynamic";

/** Liveness check for the load balancer and monitoring: is the app up and can it reach the database? */
export async function GET() {
  try {
    await getDatabase().db.execute(sql`select 1`);
    return NextResponse.json({ status: "ok", database: "ok" });
  } catch {
    return NextResponse.json({ status: "degraded", database: "unreachable" }, { status: 503 });
  }
}
