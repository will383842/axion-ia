/**
 * Formateurs indépendants — les FAITS lisibles qu'exigent certains préalables
 * d'allumage (`interrupteurs.ts`, sorte `fait`). Lot B, M4.
 *
 * `version_contrat_arretee` : la VERSION EN VIGUEUR du contrat-cadre est lisible
 * (`versionContratCadreEnVigueur`). C'est la version que la préparation émet
 * (`versionContratAEmettre`) et que le dossier en ligne crée et fait signer
 * (`contrat-dans-le-dossier.ts`) : une seule source, le préalable et l'émission ne
 * peuvent pas diverger.
 *
 * Lecture synchrone d'un registre écrit dans le code : rien en base.
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
import type { ComposantPiece } from "@/server/qualiopi/documents/templates/archives";
import {
  VERSIONS_ARRETEES,
  type VersionArretee,
} from "@/server/qualiopi/documents/templates/versions-arretees";

import { VERSION_MINIMALE_CONTRAT_INDEPENDANT } from "./garde-activation-complete";
import {
  etatsDepuisLignes,
  etatsSignatureDepuisLignes,
  type FaitsPrealables,
} from "./interrupteurs";

/** La version du contrat-cadre en vigueur : son numéro, sa date d'arrêt et son texte. */
export interface VersionContratCadreEnVigueur {
  readonly version: number;
  /** Date d'arrêt par la direction (AAAA-MM-JJ). */
  readonly arreteeLe: string;
  /** Fichier source du texte, relatif à `templates/`. */
  readonly fichier: string;
  /** Le composant qui rend le texte de cette version. */
  readonly Composant: ComposantPiece;
}

function dateDArretLisible(d: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const t = new Date(`${d}T00:00:00Z`);
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === d;
}

/**
 * La plus haute version ARRÊTÉE du contrat-cadre, jamais sous la version minimale d'un
 * nouvel indépendant, avec une date d'arrêt lisible. `null` : aucune version en vigueur
 * (l'allumage de `contrat_auto` est refusé, aucun contrat n'est préparé).
 */
export function versionContratCadreEnVigueur(
  registre: Readonly<Record<number, VersionArretee>> = VERSIONS_ARRETEES.contrat_sous_traitance ??
    {},
): VersionContratCadreEnVigueur | null {
  let retenue: VersionContratCadreEnVigueur | null = null;
  try {
    for (const [cle, v] of Object.entries(registre)) {
      const version = Number(cle);
      if (!Number.isInteger(version) || version < VERSION_MINIMALE_CONTRAT_INDEPENDANT) continue;
      if (!v || !dateDArretLisible(v.arreteeLe) || typeof v.Composant !== "function") continue;
      if (retenue === null || version > retenue.version) {
        retenue = { version, arreteeLe: v.arreteeLe, fichier: v.fichier, Composant: v.Composant };
      }
    }
  } catch {
    return null;
  }
  return retenue;
}

const DATE_FR = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** « Contrat-cadre v4, arrêtée le 14 octobre 2026 », ou le motif d'absence. */
export function libelleVersionContratCadreEnVigueur(): string {
  const v = versionContratCadreEnVigueur();
  if (v === null) return "Aucune version du contrat-cadre n'est arrêtée.";
  return `Contrat-cadre v${v.version}, arrêtée le ${DATE_FR.format(new Date(`${v.arreteeLe}T00:00:00Z`))}.`;
}

/** Les faits lus dans le CODE (registre des versions arrêtées). */
export function lireFaitsPrealables(): { readonly version_contrat_arretee: boolean } {
  return { version_contrat_arretee: versionContratCadreEnVigueur() !== null };
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
