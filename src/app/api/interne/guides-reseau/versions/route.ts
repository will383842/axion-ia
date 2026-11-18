/**
 * `GET /api/interne/guides-reseau/versions?code=gde-…` — versions fabriquées d'un guide (réconciliation du Studio, G6).
 * Signée (chemin + requête) ; 404 tant que `GUIDES_RESEAU_FABRIQUE_ENABLED` n'est pas vrai ; jamais de chemin ni de lien.
 */
import type { NextRequest } from "next/server";
import { listerVersions } from "@/server/guides-reseau/fabrique-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  return listerVersions(req);
}
