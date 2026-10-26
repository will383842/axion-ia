/**
 * Ouvertures et avancée du questionnaire avant audit, CÔTÉ BASE (2026-10-27).
 *
 *   · `noterOuverture` : le SEUL écrivain de `questionnaires_avant_audit_ouvertures` (route
 *     `…/ouverture`, appelée par la balise de la page). Une ligne par personne ; le compte suit
 *     `prochaineOuverture` (30 min = une ouverture). Concurrence : mise à jour CONDITIONNELLE sur
 *     l'état lu (deux onglets en même temps ne comptent pas deux fois), trois essais au plus ;
 *   · `lireSuiviDesQuestionnaires` : ce que la console affiche. Les brouillons sont déchiffrés pour
 *     COMPTER les réponses remplies, jamais rendus ni journalisés ici ;
 *   · `lireBrouillonPourConsole` : le contenu d'UN brouillon, appelé par la seule action
 *     super-administrateur (`actions-suivi-ouvertures.ts`), qui trace l'accès.
 * Rien n'est jamais supprimé ; aucune ligne d'une autre table n'est modifiée.
 */

import { dechiffrerParole } from "@/lib/chiffrer-parole";
import { prisma } from "@/lib/prisma";
import type { PrismaClient } from "../../../prisma/generated/client";

import { libellesDuHtml } from "./libelles";
import {
  avanceeDuBrouillon,
  champsDuBrouillon,
  prochaineOuverture,
  type ChampLu,
  type PersonneOuverture,
  type SuiviOuvertures,
} from "./ouvertures";

type BaseOuvertures = Pick<
  PrismaClient,
  | "questionnaireAvantAuditOuverture"
  | "questionnaireAvantAuditBrouillon"
  | "questionnaireAvantAudit"
>;

export type ResultatOuverture = "nouvelle" | "meme" | "conflit";

export async function noterOuverture(
  questionnaireId: string,
  p: PersonneOuverture,
  etape: number,
  maintenant: Date = new Date(),
  base: BaseOuvertures = prisma,
): Promise<ResultatOuverture> {
  const cle = {
    questionnaireId_mode_membre: { questionnaireId, mode: p.mode, membre: p.membre },
  };
  for (let essai = 0; essai < 3; essai++) {
    const existant = await base.questionnaireAvantAuditOuverture.findUnique({
      where: cle,
      select: { id: true, nombre: true, derniereOuverture: true, derniereEtapeAtteinte: true },
    });
    if (existant === null) {
      const n = prochaineOuverture(null, etape, maintenant);
      const cree = await base.questionnaireAvantAuditOuverture.createMany({
        data: [
          {
            questionnaireId,
            mode: p.mode,
            membre: p.membre,
            premiereOuverture: maintenant,
            derniereOuverture: n.derniereOuverture,
            nombre: n.nombre,
            derniereEtapeAtteinte: n.derniereEtapeAtteinte,
          },
        ],
        skipDuplicates: true,
      });
      if (cree.count === 1) return "nouvelle";
      continue; // créée par un autre onglet entre-temps : on relit
    }
    const n = prochaineOuverture(existant, etape, maintenant);
    const maj = await base.questionnaireAvantAuditOuverture.updateMany({
      where: {
        id: existant.id,
        nombre: existant.nombre,
        derniereOuverture: existant.derniereOuverture,
      },
      data: {
        nombre: n.nombre,
        derniereOuverture: n.derniereOuverture,
        derniereEtapeAtteinte: n.derniereEtapeAtteinte,
      },
    });
    if (maj.count === 1) return n.nouvelle ? "nouvelle" : "meme";
  }
  return "conflit";
}

/** Les champs déclarés dans le HTML déposé : le « sur combien » de l'avancée. */
function questionsDuHtml(html: string): ReadonlySet<string> {
  return new Set(libellesDuHtml(html).normal.keys());
}

/**
 * Ouvertures et brouillons des questionnaires donnés. Un brouillon illisible garde sa ligne
 * (avancée `null`) : on ne le fait pas disparaître.
 */
export async function lireSuiviDesQuestionnaires(
  ids: ReadonlyArray<string>,
  base: BaseOuvertures = prisma,
): Promise<ReadonlyMap<string, SuiviOuvertures>> {
  const out = new Map<string, SuiviOuvertures>();
  if (ids.length === 0) return out;
  const [ouvertures, brouillons] = await Promise.all([
    base.questionnaireAvantAuditOuverture.findMany({
      where: { questionnaireId: { in: [...ids] } },
      select: {
        questionnaireId: true,
        mode: true,
        membre: true,
        premiereOuverture: true,
        derniereOuverture: true,
        nombre: true,
        derniereEtapeAtteinte: true,
      },
    }),
    base.questionnaireAvantAuditBrouillon.findMany({
      where: { questionnaireId: { in: [...ids] } },
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
  const avecBrouillon = [...new Set(brouillons.map((b) => b.questionnaireId))];
  const htmls =
    avecBrouillon.length === 0
      ? []
      : await base.questionnaireAvantAudit.findMany({
          where: { id: { in: avecBrouillon } },
          select: { id: true, html: true },
        });
  const questions = new Map(htmls.map((h) => [h.id, questionsDuHtml(h.html)]));
  for (const id of ids) {
    out.set(id, {
      ouvertures: ouvertures
        .filter((o) => o.questionnaireId === id)
        .map(({ questionnaireId: _q, ...o }) => o),
      brouillons: brouillons
        .filter((b) => b.questionnaireId === id)
        .map((b) => {
          let avancee: ReturnType<typeof avanceeDuBrouillon> = null;
          try {
            avancee = avanceeDuBrouillon(
              dechiffrerParole(b.donnees),
              questions.get(id) ?? new Set(),
            );
          } catch {
            avancee = null; // clé absente ou valeur illisible : jamais de texte de remplacement
          }
          return { id: b.id, mode: b.mode, membre: b.membre, majLe: b.majLe, avancee };
        }),
    });
  }
  return out;
}

export interface BrouillonLu {
  readonly questionnaireId: string;
  readonly mode: string;
  readonly membre: string;
  readonly majLe: Date;
  readonly champs: ReadonlyArray<ChampLu>;
}

/** Le contenu d'UN brouillon, déchiffré, avec les questions en français ; `null` si illisible. */
export async function lireBrouillonPourConsole(
  brouillonId: string,
  base: BaseOuvertures = prisma,
): Promise<BrouillonLu | null> {
  const b = await base.questionnaireAvantAuditBrouillon.findUnique({
    where: { id: brouillonId },
    select: {
      questionnaireId: true,
      mode: true,
      membre: true,
      majLe: true,
      donnees: true,
      questionnaire: { select: { html: true } },
    },
  });
  if (b === null) return null;
  let champs: ReadonlyArray<ChampLu> | null;
  try {
    champs = champsDuBrouillon(
      dechiffrerParole(b.donnees),
      libellesDuHtml(b.questionnaire.html),
      b.mode,
    );
  } catch {
    return null;
  }
  if (champs === null) return null;
  return {
    questionnaireId: b.questionnaireId,
    mode: b.mode,
    membre: b.membre,
    majLe: b.majLe,
    champs,
  };
}
