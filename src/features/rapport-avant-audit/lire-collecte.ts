/**
 * Lecture en base de la collecte du rapport avant audit (2026-11-02) — LECTURE SEULE.
 *
 * Réunit les questionnaires ENVOYÉS d'une fiche client (et des fiches qu'elle a absorbées), lit
 * leurs réponses déjà déchiffrées par `lireReponses` (qui n'ouvre jamais une réponse mise à
 * l'écart) et rend le dossier de `collecterReponses`. Aucune écriture, aucun journal ici : le
 * journal d'audit est tenu par l'action qui lance le rapport.
 */

import { prisma } from "@/lib/prisma";

import { fichesCouvertes, questionnairesDesFiches } from "../questionnaire-preaudit/de-la-fiche";
import { lireReponses } from "../questionnaire-preaudit/serveur";
import { collecterReponses, type CollecteReponses } from "./collecte";

export interface DossierCollecte {
  readonly clientId: string;
  /** Les fiches couvertes (la fiche et celles qu'elle a absorbées par fusion). */
  readonly fiches: ReadonlyArray<string>;
  readonly collecte: CollecteReponses;
}

/** Aucun questionnaire envoyé sur cette fiche : le rapport n'a rien à analyser. */
export class AucunQuestionnaireEnvoye extends Error {
  constructor() {
    super("Aucun questionnaire envoyé sur cette fiche.");
    this.name = "AucunQuestionnaireEnvoye";
  }
}

export async function lireCollecteDuClient(clientId: string): Promise<DossierCollecte> {
  const fiches = await fichesCouvertes(clientId);
  const qs = await prisma.questionnaireAvantAudit.findMany({
    // Un brouillon jamais envoyé n'a reçu aucune réponse.
    where: { ...questionnairesDesFiches(fiches), envoyeLe: { not: null } },
    select: { id: true, ref: true, envoyeLe: true, closLe: true, html: true },
    orderBy: [{ envoyeLe: "asc" }, { id: "asc" }],
  });
  if (qs.length === 0) throw new AucunQuestionnaireEnvoye();

  const questionnaires = await Promise.all(
    qs.map(async (q) => ({
      id: q.id,
      ref: q.ref,
      envoyeLe: q.envoyeLe,
      closLe: q.closLe,
      html: typeof q.html === "string" ? q.html : null,
      reponses: await lireReponses(q.id),
    })),
  );
  return { clientId, fiches, collecte: collecterReponses(questionnaires) };
}
