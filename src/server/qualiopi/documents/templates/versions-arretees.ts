/**
 * Versions de gabarit ARRÊTÉES par la direction, en avance sur la version
 * émise par défaut (lot L7a, chantier formateurs indépendants).
 *
 * ## Pourquoi un registre à part
 *
 * `GABARIT_VERSIONS` dit quelle version le chemin d'émission ACTUEL produit.
 * Le contrat-cadre v3 est arrêté, mais il ne doit rien changer à ce qui part
 * aujourd'hui : les organismes continuent de recevoir la v2 tant que le lot
 * d'émission n'est pas allumé. La v3 vit donc ici :
 *
 *  · elle est RENDABLE — l'exemplaire signé d'une pièce v3 se rejoue avec son
 *    propre composant (`exemplaire-signe.ts`), jamais avec la v2 ;
 *  · elle est ÉMETTABLE sur demande explicite de l'émetteur
 *    (`versionGabaritAEcrire`), et seulement parce qu'elle figure ici ;
 *  · une version qui n'est ni courante, ni archivée, ni arrêtée reste refusée.
 *
 * 🔴 Règle d'émission (plan, §5 « précautions ») : aucun contrat ni aucune
 * lettre d'un formateur indépendant sans version arrêtée. Le jour où une
 * version arrêtée devient la version par défaut, elle quitte ce registre pour
 * `GABARIT_VERSIONS`, et l'ancienne part dans `archives/`.
 */

import type { ComposantPiece } from "./archives";
import { ContratCadrePdf } from "./contrat-cadre";
import { GABARIT_VERSIONS, typeGabarit, type TypeGabaritSignable } from "./gabarit-versions";

export interface VersionArretee {
  /** Date d'arrêt par la direction (AAAA-MM-JJ). */
  readonly arreteeLe: string;
  /** Fichier source, relatif à `templates/`. */
  readonly fichier: string;
  readonly Composant: ComposantPiece;
}

export const VERSIONS_ARRETEES: Readonly<
  Partial<Record<TypeGabaritSignable, Readonly<Record<number, VersionArretee>>>>
> = {
  contrat_sous_traitance: {
    3: {
      arreteeLe: "2026-10-10",
      fichier: "contrat-cadre.tsx",
      Composant: ContratCadrePdf as unknown as ComposantPiece,
    },
  },
};

/** Vrai si cette version de ce type de pièce a été arrêtée en avance. */
export function versionArretee(type: string, version: number): boolean {
  const gabarit = typeGabarit(type);
  if (gabarit === null) return false;
  return VERSIONS_ARRETEES[gabarit]?.[version] !== undefined;
}

/** Plus haute version arrêtée de ce type, ou `null` s'il n'y en a aucune. */
export function derniereVersionArretee(type: string): number | null {
  const gabarit = typeGabarit(type);
  if (gabarit === null) return null;
  const versions = Object.keys(VERSIONS_ARRETEES[gabarit] ?? {}).map(Number);
  return versions.length === 0 ? null : Math.max(...versions);
}

/** Composant d'une version arrêtée, ou `null`. */
export function composantVersionArretee(
  type: TypeGabaritSignable,
  version: number,
): ComposantPiece | null {
  return VERSIONS_ARRETEES[type]?.[version]?.Composant ?? null;
}

/**
 * Version à inscrire dans l'instantané d'une pièce qu'on émet.
 *
 * Sans demande, la version courante — comportement d'avant ce registre, à
 * l'identique. Une demande n'est acceptée que pour la version courante ou une
 * version ARRÊTÉE : sinon l'émission échoue, plutôt que de sceller une pièce
 * dont l'exemplaire signé ne pourrait pas être rejoué.
 */
export function versionGabaritAEcrire(type: string, demandee?: number): number | null {
  const gabarit = typeGabarit(type);
  if (gabarit === null) return null;
  const courante = GABARIT_VERSIONS[gabarit];
  if (demandee === undefined || demandee === courante) return courante;
  if (versionArretee(type, demandee)) return demandee;
  throw new Error(
    `[gabarit] La version ${String(demandee)} de « ${type} » n'est ni la version courante ` +
      `(${courante}) ni une version arrêtée : émission refusée.`,
  );
}
