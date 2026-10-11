// ⚠️ PAS de `import "server-only"` : ce module est appelé depuis le WORKER
// (vivier, réponse automatique), hors de Next.

/**
 * Le lien « Supprimer ma candidature » posé au pied des e-mails aux candidats
 * d'une offre d'emploi (décision de Will, 2026-10-11).
 *
 * Le lien n'efface rien : il ouvre une page qui montre le poste et un bouton.
 * L'effacement se fait au clic (POST) — cf. `effacement-par-le-candidat.ts`.
 *
 * Le jeton ne porte que l'identifiant de la candidature, signé avec une
 * finalité propre (`signEffacementCandidatureToken`) : il ne vaut ni
 * opposition au vivier, ni export RGPD. Aucune donnée personnelle dans l'URL.
 */

import { SITE_URL } from "@/lib/site-url";
import { signEffacementCandidatureToken } from "@/server/vivier/token";

/** Chemin public de la page (identique en fr et en, cf. `routing.ts`). */
export const CHEMIN_SUPPRESSION_CANDIDATURE = "/candidature/supprimer";

/** L'URL complète, ou `null` si le jeton ne peut pas être signé (secret absent). */
export async function lienSuppressionCandidature(applicationId: string): Promise<string | null> {
  try {
    const jeton = await signEffacementCandidatureToken(applicationId);
    return `${SITE_URL}/fr${CHEMIN_SUPPRESSION_CANDIDATURE}?token=${encodeURIComponent(jeton)}`;
  } catch {
    // Sans lien, l'e-mail part quand même : la notice et contact@ restent.
    return null;
  }
}
