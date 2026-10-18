/**
 * LISTE BLANCHE DU LIEN D'UNE VIDÉO (plan PLAN-W1-W4 §8.2). Pure, sans base.
 *
 * - `service` : une page de service des thèmes (`themes.ts`, champ `service`) ;
 * - `formation` : `/fr/formations` ou la fiche `/fr/formations/<slugFr>` d'une formation
 *   du catalogue PUBLIC (`catalog-v2.ts`, sans drapeau). Jamais un `id` ni un `slugEn`.
 *
 * Rejouée à la RÉCEPTION (`contrat.ts`, 422 sinon) ET au RENDU (`lienAffiche`) : une
 * formation peut quitter le catalogue après la réception — le lien se rabat alors sur
 * `/fr/formations` ; un lien de service devenu hors liste disparaît.
 */
import { getFormationV2 } from "@/content/formations/catalog-v2";
import { THEMES } from "@/content/videos/themes";

export interface LienVideo {
  readonly type: "service" | "formation";
  readonly chemin: string;
}

const CHEMINS_SERVICES: ReadonlySet<string> = new Set(THEMES.map((t) => `/fr${t.service}`));
const CATALOGUE_FORMATIONS = "/fr/formations";
const RE_FICHE_FORMATION = /^\/fr\/formations\/([a-z0-9]+(?:-[a-z0-9]+)*)$/;

export function lienAutorise(lien: LienVideo): boolean {
  if (lien.type === "service") return CHEMINS_SERVICES.has(lien.chemin);
  if (lien.chemin === CATALOGUE_FORMATIONS) return true;
  const slug = RE_FICHE_FORMATION.exec(lien.chemin)?.[1];
  return slug !== undefined && getFormationV2(slug)?.slugFr === slug;
}

/** Lien à rendre sur la page vidéo, ou `null` (aucun bouton). */
export function lienAffiche(lien: LienVideo): LienVideo | null {
  if (lienAutorise(lien)) return lien;
  return lien.type === "formation" ? { type: "formation", chemin: CATALOGUE_FORMATIONS } : null;
}
