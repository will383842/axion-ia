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
 */

import type { ComposantPiece } from "@/server/qualiopi/documents/templates/archives";
import {
  VERSIONS_ARRETEES,
  type VersionArretee,
} from "@/server/qualiopi/documents/templates/versions-arretees";

import { VERSION_MINIMALE_CONTRAT_INDEPENDANT } from "./garde-activation-complete";
import type { FaitsPrealables } from "./interrupteurs";

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

export function lireFaitsPrealables(): Required<FaitsPrealables> {
  return { version_contrat_arretee: versionContratCadreEnVigueur() !== null };
}
