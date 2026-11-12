/**
 * `POST /api/interne/cibles-reseau` — crée ou met à jour une cible (guide ou adresse de page)
 * (F1a-bis). Signée ; 404 tant que `GUIDES_RESEAU_ENABLED` n'est pas vrai. Voir
 * `server/guides-reseau/catalogue-cibles.ts`.
 */
import type { NextRequest } from "next/server";
import { enregistrerCible } from "@/server/guides-reseau/catalogue-cibles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  return enregistrerCible(req);
}
