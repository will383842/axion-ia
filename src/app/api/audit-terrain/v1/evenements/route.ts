/** POST /api/audit-terrain/v1/evenements : voir src/server/audit-terrain/reception.ts. */
import type { NextRequest } from "next/server";
import { recevoirEvenements } from "@/server/audit-terrain/reception";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  return recevoirEvenements(req);
}
