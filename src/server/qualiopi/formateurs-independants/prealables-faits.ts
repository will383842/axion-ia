/**
 * Formateurs indépendants — les FAITS lisibles qu'exigent certains préalables
 * d'allumage (`interrupteurs.ts`, sorte `fait`). Lot B, M4.
 *
 * `version_contrat_arretee` : une version du contrat-cadre figure au registre des
 * versions arrêtées par la direction (`versions-arretees.ts`). C'est la version que
 * le dossier en ligne crée et fait signer (`contrat-dans-le-dossier.ts`). Lecture
 * synchrone d'un registre écrit dans le code : rien en base.
 *
 * `canal_changement_compte_en_service` (préalable de `passage_paiement`, plan §8.10
 * n° 12) : le formateur peut changer de compte bancaire depuis son espace, sans impasse
 * ni fraude possible. Lu dans les RÉGLAGES (`faitsDepuisReglages`) :
 *   - `formateurs.changement_coordonnees` allumé (le canal du lot E) ;
 *   - `formateurs.dossier_en_ligne` allumé (le RIB du nouveau compte s'y dépose) ;
 *   - `formateurs.textes_valides` allumé ET F43 et F44 validés sur leur texte actuel :
 *     sans F43 parti à l'adresse connue, aucun IBAN n'est validable (C4).
 * Absent ou illisible = non établi (refus).
 */

import { etatsTextesDepuisLignes } from "@/server/email/textes-valides-etats";
import { estTexteValide } from "@/server/email/textes-valides";
import { derniereVersionArretee } from "@/server/qualiopi/documents/templates/versions-arretees";

import {
  etatsDepuisLignes,
  etatsSignatureDepuisLignes,
  type FaitsPrealables,
} from "./interrupteurs";

export function lireFaitsPrealables(): { readonly version_contrat_arretee: boolean } {
  let version: number | null = null;
  try {
    version = derniereVersionArretee("contrat_sous_traitance");
  } catch {
    version = null;
  }
  return { version_contrat_arretee: version !== null };
}

/** Les deux textes du canal : l'avis de demande (F43) et la confirmation (F44). */
export const GABARITS_CANAL_CHANGEMENT_COMPTE = [
  "formateur-iban-changement",
  "formateur-iban-valide",
] as const;

/**
 * Les faits lus dans les lignes `settings` : `formateurs.*`, `signature.*` et
 * `textes_valides.*` (n'importe quel ordre, les autres ignorées). Pur.
 */
export function faitsDepuisReglages(lignes: ReadonlyArray<{ key: string; value: unknown }>): {
  readonly canal_changement_compte_en_service: boolean;
} {
  const etats = etatsDepuisLignes(lignes);
  const signature = etatsSignatureDepuisLignes(lignes);
  const { valides } = etatsTextesDepuisLignes(lignes);
  const canal =
    signature.changement_coordonnees &&
    etats.dossier_en_ligne === true &&
    etats.textes_valides === true &&
    GABARITS_CANAL_CHANGEMENT_COMPTE.every((g) => estTexteValide(valides, g));
  return { canal_changement_compte_en_service: canal };
}

/** Tous les faits : ceux du code et ceux des réglages lus. */
export function faitsPrealables(
  lignes: ReadonlyArray<{ key: string; value: unknown }>,
): Required<FaitsPrealables> {
  return { ...lireFaitsPrealables(), ...faitsDepuisReglages(lignes) };
}
