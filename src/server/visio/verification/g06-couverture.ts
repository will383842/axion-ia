/**
 * G6 — COUVERTURE COHÉRENTE (`compte-rendu-et-extraction.md` §4.2).
 *
 * Après la vérification des faits (V1) :
 *   · une rubrique « abordée » dont aucun fait n'a survécu redevient
 *     « non abordée », avec la mention « faits rejetés à la vérification » ;
 *   · une rubrique « non abordée » ne liste aucun fait ;
 *   · chaque référence citée existe, a survécu, et appartient à la rubrique
 *     (selon `TYPES_DE_FAITS`).
 *
 * Correction AUTOMATIQUE et tracée : le compte rendu dit ce que la vérification
 * a laissé, pas ce que l'IA avait annoncé.
 *
 * Module PUR.
 */

import type { FaitType } from "../../../../prisma/generated/client";
import { RUBRIQUES_COUVERTURE, rubriqueDuType, type RubriqueCouverture } from "../schemas/communs";

export type StatutRubrique = "aborde" | "evoque_sans_precision" | "non_aborde";

export interface RubriqueCouverte {
  readonly statut: StatutRubrique;
  readonly faits_refs: readonly string[];
  readonly remarque: string | null;
}

export type Couverture = Readonly<Record<RubriqueCouverture, RubriqueCouverte>>;

export const MENTION_FAITS_REJETES = "faits rejetés à la vérification";

export function corrigerCouverture(
  couverture: Couverture,
  faitsRetenus: ReadonlyMap<string, FaitType>,
): { readonly couverture: Couverture; readonly corrections: number } {
  let corrections = 0;
  const sortie = {} as Record<RubriqueCouverture, RubriqueCouverte>;
  for (const r of RUBRIQUES_COUVERTURE) {
    const origine = couverture[r];
    const refs = origine.faits_refs.filter((ref) => {
      const type = faitsRetenus.get(ref);
      return type !== undefined && rubriqueDuType(type) === r;
    });
    // Un fait retenu de cette rubrique que l'IA a oublié de citer la rend abordée.
    for (const [ref, type] of faitsRetenus) {
      if (rubriqueDuType(type) === r && !refs.includes(ref)) refs.push(ref);
    }
    let statut: StatutRubrique = origine.statut;
    let remarque = origine.remarque;
    if (refs.length === 0 && statut === "aborde") {
      statut = "non_aborde";
      remarque = MENTION_FAITS_REJETES;
    } else if (refs.length > 0 && statut !== "aborde") {
      statut = "aborde";
    }
    if (statut !== origine.statut || refs.length !== origine.faits_refs.length) corrections += 1;
    sortie[r] = { statut, faits_refs: refs, remarque };
  }
  return { couverture: sortie, corrections };
}

/** Couverture déduite des seuls faits (réécriture sans l'état de l'extraction). */
export function couvertureDesFaits(faits: ReadonlyMap<string, FaitType>): Couverture {
  const vide = Object.fromEntries(
    RUBRIQUES_COUVERTURE.map((r) => [r, { statut: "non_aborde", faits_refs: [], remarque: null }]),
  ) as unknown as Couverture;
  return corrigerCouverture(vide, faits).couverture;
}
