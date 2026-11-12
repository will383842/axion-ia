/**
 * `POST /api/interne/cibles-adresses` — crée ou met à jour une adresse de page ciblable par un
 * mot (F1a). Signée ; 404 tant que `GUIDES_RESEAU_ENABLED` n'est pas vrai ; l'hôte doit figurer
 * dans `CIBLES_ADRESSES_HOTES`. Voir `server/guides-reseau/catalogue-cibles.ts`.
 */
import type { NextRequest } from "next/server";
import { enregistrerAdresse } from "@/server/guides-reseau/catalogue-cibles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  return enregistrerAdresse(req);
}
