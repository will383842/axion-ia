/**
 * Lecteur du suivi PERSONNE PAR PERSONNE (2026-10-27) — CÔTÉ BASE, LECTURE SEULE.
 *
 * Lit les réponses, les brouillons et (interrupteur allumé) les ouvertures d'un ou plusieurs
 * questionnaires envoyés, les déchiffre EN MÉMOIRE pour les compter et lire l'identité déclarée,
 * puis rend `suivreParPersonne(...)`. Rien du contenu n'est gardé dans la sortie, rien n'est
 * journalisé, aucune ligne n'est écrite ni supprimée. Les réponses mises à l'écart ne sont pas
 * déchiffrées.
 */

import { dechiffrerParole } from "@/lib/chiffrer-parole";
import { prisma } from "@/lib/prisma";
import { codeDirigeantPreauditValide } from "@/server/visio/questionnaire-en-ligne/jeton";
import type { PrismaClient } from "../../../prisma/generated/client";

import { suiviActif } from "./ouvertures";
import { suivreParPersonne, type EntreeOuverture, type SuiviParPersonne } from "./personnes";
import { squeletteDuHtml, type Squelette } from "./squelette";

type BasePersonnes = Pick<
  PrismaClient,
  | "questionnaireAvantAudit"
  | "questionnaireAvantAuditEnvoi"
  | "questionnaireAvantAuditBrouillon"
  | "questionnaireAvantAuditOuverture"
>;

/** Ce qui permet à la fiche de dire « tout est gardé, tout est lisible » (sans rien montrer). */
export interface ControleConservation {
  readonly reponses: number;
  readonly ecartees: number;
  readonly illisibles: number;
  readonly brouillons: number;
}

export interface SuiviLu {
  readonly suivi: SuiviParPersonne;
  readonly controle: ControleConservation;
  /** Le lien reçoit des réponses jusqu'à cette date (`null` : pas de limite connue). */
  readonly expireLe: Date | null;
}

// Cache du squelette : seulement pour un questionnaire déjà ENVOYÉ (son HTML ne change plus).
const CACHE_MAX = 50;
const cacheSquelettes = new Map<string, Squelette | null>();

/** Vide le cache (tests). */
export function viderLeCacheDuSquelette(): void {
  cacheSquelettes.clear();
}

function retenir(id: string, sq: Squelette | null): void {
  if (cacheSquelettes.size >= CACHE_MAX) {
    const premier = cacheSquelettes.keys().next();
    if (premier.done !== true) cacheSquelettes.delete(premier.value);
  }
  cacheSquelettes.set(id, sq);
}

const estTableAbsente = (e: unknown): boolean => {
  const code = (e as { code?: unknown } | null)?.code;
  return code === "P2021" || code === "P2022";
};

function objetDe(texte: string): Record<string, unknown> | null {
  try {
    const v: unknown = JSON.parse(texte);
    return typeof v === "object" && v !== null && !Array.isArray(v)
      ? (v as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** Déchiffre puis lit en JSON ; `null` si la clé manque ou si le texte est illisible. */
function lireChiffre(valeur: string): Record<string, unknown> | null {
  try {
    return objetDe(dechiffrerParole(valeur));
  } catch {
    return null;
  }
}

export async function lireSuiviParPersonne(
  ids: ReadonlyArray<string>,
  base: BasePersonnes = prisma,
): Promise<ReadonlyMap<string, SuiviLu>> {
  const sortie = new Map<string, SuiviLu>();
  if (ids.length === 0) return sortie;
  const liste = [...ids];

  const qs = await base.questionnaireAvantAudit.findMany({
    where: { id: { in: liste } },
    select: { id: true, luLe: true, expireLe: true, envoyeLe: true },
  });
  const sansSquelette = qs
    .filter((q) => !(q.envoyeLe !== null && cacheSquelettes.has(q.id)))
    .map((q) => q.id);
  const htmls =
    sansSquelette.length === 0
      ? []
      : await base.questionnaireAvantAudit.findMany({
          where: { id: { in: sansSquelette } },
          select: { id: true, html: true, envoyeLe: true },
        });
  const squelettes = new Map<string, Squelette | null>();
  for (const q of qs) {
    if (q.envoyeLe !== null && cacheSquelettes.has(q.id)) {
      squelettes.set(q.id, cacheSquelettes.get(q.id) ?? null);
    }
  }
  for (const h of htmls) {
    const sq = squeletteDuHtml(h.html);
    squelettes.set(h.id, sq);
    if (h.envoyeLe !== null) retenir(h.id, sq);
  }

  const [envois, brouillons] = await Promise.all([
    base.questionnaireAvantAuditEnvoi.findMany({
      where: { questionnaireId: { in: liste } },
      select: {
        id: true,
        questionnaireId: true,
        mode: true,
        membre: true,
        recuLe: true,
        ecarteLe: true,
        donnees: true,
      },
    }),
    base.questionnaireAvantAuditBrouillon.findMany({
      where: { questionnaireId: { in: liste } },
      select: {
        id: true,
        questionnaireId: true,
        mode: true,
        membre: true,
        majLe: true,
        donnees: true,
      },
    }),
  ]);

  // Les ouvertures ont leur interrupteur ET leur propre panne (table pas encore migrée).
  let ouvertures: Array<EntreeOuverture & { questionnaireId: string }> | null = null;
  if (suiviActif()) {
    try {
      ouvertures = await base.questionnaireAvantAuditOuverture.findMany({
        where: { questionnaireId: { in: liste } },
        select: {
          questionnaireId: true,
          mode: true,
          membre: true,
          premiereOuverture: true,
          derniereOuverture: true,
          nombre: true,
          derniereEtapeAtteinte: true,
        },
      });
    } catch (e) {
      if (!estTableAbsente(e)) throw e;
      ouvertures = null;
    }
  }

  for (const q of qs) {
    let illisibles = 0;
    let ecartees = 0;
    const mesEnvois = envois.filter((x) => x.questionnaireId === q.id);
    const reponses = mesEnvois.map((x) => {
      const ecartee = x.ecarteLe !== null;
      let charge: Record<string, unknown> | null = null;
      if (ecartee) ecartees++;
      else {
        charge = lireChiffre(x.donnees);
        if (charge === null) illisibles++;
      }
      return {
        id: x.id,
        mode: x.mode,
        membreColonne: x.membre,
        recuLe: x.recuLe,
        ecartee,
        charge,
      };
    });
    const mesBrouillons = brouillons.filter((x) => x.questionnaireId === q.id);
    const brouillonsLus = mesBrouillons.map((b) => ({
      id: b.id,
      mode: b.mode,
      membre: b.membre,
      majLe: b.majLe,
      instantane: lireChiffre(b.donnees),
    }));
    // Un brouillon illisible déclenche aussi l'alerte de conservation, comme dans l'export.
    illisibles += brouillonsLus.filter((b) => b.instantane === null).length;
    const suivi = suivreParPersonne({
      reponses,
      brouillons: brouillonsLus,
      ouvertures: ouvertures === null ? null : ouvertures.filter((o) => o.questionnaireId === q.id),
      estCodeDirigeant: (m) => codeDirigeantPreauditValide(q.id, m),
      squelette: squelettes.get(q.id) ?? null,
      luLe: q.luLe,
    });
    sortie.set(q.id, {
      suivi,
      controle: {
        reponses: mesEnvois.length,
        ecartees,
        illisibles,
        brouillons: mesBrouillons.length,
      },
      expireLe: q.expireLe,
    });
  }
  return sortie;
}
