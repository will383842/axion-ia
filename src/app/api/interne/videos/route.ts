/**
 * `POST` / `DELETE /api/interne/videos` — réception signée des vidéos du studio
 * (lot W1, plan PLAN-W1-W4 §3). ÉTEINT par défaut (`VIDEOS_SITE_ENABLED`).
 *
 * Nom `interne` (et non `internal`) : validé par Will, cf. décision D1.
 * Jamais statique : le drapeau est lu au runtime (incident P3-01).
 */
import { after, type NextRequest } from "next/server";
import { controlerEntree } from "@/server/videos/entree";
import { apresPublication, type EffetPublication } from "@/server/videos/apres-publication";
import { recevoirPublication, recevoirRetrait } from "@/server/videos/reception";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHEMIN_VIDEOS = "/api/interne/videos";

/**
 * Planifie ce qui suit la réponse (cache, edge, IndexNow) : `after()` quand on est dans une
 * requête ; sinon (tests, scripts) on l'exécute tout de suite sans attendre. Jamais d'exception.
 */
function planifier(effet: EffetPublication): void {
  // Un IndexNow qui échoue est tracé par `apresPublication` (console + Sentry), jamais dans le
  // journal : la réponse enregistrée doit rester celle qu'a reçue le studio (idempotence).
  const tache = async (): Promise<void> => {
    await apresPublication(effet);
  };
  try {
    after(tache);
  } catch {
    void tache().catch((err: unknown) => console.error("[videos] suite de publication :", err));
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const entree = await controlerEntree(req, { methode: "POST", chemin: CHEMIN_VIDEOS });
  if (!entree.ok) return entree.reponse;
  const { reponse, effet } = await recevoirPublication(entree);
  if (effet) planifier(effet);
  return reponse;
}

export async function DELETE(req: NextRequest): Promise<Response> {
  const entree = await controlerEntree(req, { methode: "DELETE", chemin: CHEMIN_VIDEOS });
  if (!entree.ok) return entree.reponse;
  const { reponse, effet } = await recevoirRetrait(entree);
  if (effet) planifier(effet);
  return reponse;
}
