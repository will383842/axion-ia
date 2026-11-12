/**
 * `GET /api/interne/catalogue-reseau` — liste des cibles (guides et
 * adresses, lus en base), SANS adresse ni chemin de PDF (F1a-bis). Signée ; 404 tant que
 * `GUIDES_RESEAU_ENABLED` n'est pas vrai. Voir `server/guides-reseau/catalogue-cibles.ts`.
 */
import type { NextRequest } from "next/server";
import { listerCatalogue } from "@/server/guides-reseau/catalogue-cibles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  return listerCatalogue(req);
}
