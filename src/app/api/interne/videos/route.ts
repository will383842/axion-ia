/**
 * `POST` / `DELETE /api/interne/videos` — réception signée des vidéos du studio
 * (lot W1, plan PLAN-W1-W4 §3). ÉTEINT par défaut (`VIDEOS_SITE_ENABLED`).
 *
 * Nom `interne` (et non `internal`) : validé par Will, cf. décision D1.
 * Jamais statique : le drapeau est lu au runtime (incident P3-01).
 */
import type { NextRequest } from "next/server";
import { controlerEntree } from "@/server/videos/entree";
import { recevoirPublication, recevoirRetrait } from "@/server/videos/reception";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHEMIN_VIDEOS = "/api/interne/videos";

export async function POST(req: NextRequest): Promise<Response> {
  const entree = await controlerEntree(req, { methode: "POST", chemin: CHEMIN_VIDEOS });
  if (!entree.ok) return entree.reponse;
  return recevoirPublication(entree);
}

export async function DELETE(req: NextRequest): Promise<Response> {
  const entree = await controlerEntree(req, { methode: "DELETE", chemin: CHEMIN_VIDEOS });
  if (!entree.ok) return entree.reponse;
  return recevoirRetrait(entree);
}
