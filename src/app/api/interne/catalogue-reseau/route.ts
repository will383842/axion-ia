/**
 * `GET /api/interne/catalogue-reseau` — liste des cibles d'un mot (guides du catalogue +
 * adresses actives), SANS l'adresse elle-même (F1a). Signée ; 404 tant que
 * `GUIDES_RESEAU_ENABLED` n'est pas vrai. Voir `server/guides-reseau/catalogue-cibles.ts`.
 */
import type { NextRequest } from "next/server";
import { listerCatalogue } from "@/server/guides-reseau/catalogue-cibles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  return listerCatalogue(req);
}
