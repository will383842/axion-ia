/**
 * Formateurs indépendants — les FAITS lisibles qu'exigent certains préalables
 * d'allumage (`interrupteurs.ts`, sorte `fait`). Lot B, M4.
 *
 * `version_contrat_arretee` : une version du contrat-cadre figure au registre des
 * versions arrêtées par la direction (`versions-arretees.ts`). C'est la version que
 * le dossier en ligne crée et fait signer (`contrat-dans-le-dossier.ts`).
 *
 * Lecture synchrone d'un registre écrit dans le code : rien en base.
 */

import { derniereVersionArretee } from "@/server/qualiopi/documents/templates/versions-arretees";

import type { FaitsPrealables } from "./interrupteurs";

export function lireFaitsPrealables(): Required<FaitsPrealables> {
  let version: number | null = null;
  try {
    version = derniereVersionArretee("contrat_sous_traitance");
  } catch {
    version = null;
  }
  return { version_contrat_arretee: version !== null };
}
