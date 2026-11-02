/** GET /api/audit-terrain/v1/etat : voir src/server/audit-terrain/reception.ts. */
import type { NextRequest } from "next/server";
import { lireEtat } from "@/server/audit-terrain/reception";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  return lireEtat(req);
}
