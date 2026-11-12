/**
 * `GET|POST /api/interne/mots-cibles` — liaisons mot → cible (F1a-bis). Signées ; 404 tant que
 * `GUIDES_RESEAU_ENABLED` n'est pas vrai. Voir `server/guides-reseau/catalogue-cibles.ts`.
 */
import type { NextRequest } from "next/server";
import { enregistrerMot, listerMots } from "@/server/guides-reseau/catalogue-cibles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  return listerMots(req);
}

export async function POST(req: NextRequest): Promise<Response> {
  return enregistrerMot(req);
}
