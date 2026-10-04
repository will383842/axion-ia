/**
 * Alerte `subrogation_incompatible_regime` (lot OPCO A7c — manque n°5 de la
 * critique de complétude).
 *
 * Le contrôle du régime n'avait lieu qu'au moment où l'on POSE la subrogation
 * (`setFinancementSessionAction`). Une session subrogée AVANT le 1/10/2026, et
 * dont le régime calculé est désormais le remboursement de l'entreprise, n'était
 * jamais réexaminée : la facture partait à l'OPCO (`destinataire-facture.ts`) et
 * revenait rejetée.
 *
 * La règle relit le MÊME calcul que la page Financement (`entreeRegimeDepuisSession`
 * puis `regimePaiementOpco`) et lève, avant l'émission de la facture, sur toute
 * session subrogée non facturée dont le régime est `remboursement_entreprise`
 * sans que l'accord écrit confirme le paiement direct
 * (`subrogationConfirmeeParAccord`). Un régime `inconnu` ne lève rien : c'est un
 * avertissement de la page, jamais une alerte.
 *
 * Elle se referme d'elle-même quand la subrogation est retirée, l'accord écrit
 * coché, la donnée du client corrigée, ou la facture émise.
 *
 * Aucune donnée personnelle dans le texte : le numéro de session, l'OPCO et le
 * motif du régime suffisent.
 */

import { prisma } from "@/lib/prisma";
import { nomOpcoDuClient } from "@/server/qualiopi/financements/opco-referentiel";
import { regimePaiementOpco } from "@/server/qualiopi/financements/regime-paiement-opco";
import { entreeRegimeDepuisSession } from "@/server/qualiopi/financements/regime-paiement-session";
import { parisDateISO } from "@/server/qualiopi/presence/time";
import type { AlerteCandidate } from "./evaluateur";

const JOUR_MS = 24 * 60 * 60 * 1000;
/** Même fenêtre que `delai_facturation_opco` : trois ans, la prescription courante. */
const FENETRE_JOURS = 3 * 365;
const PLAFOND_SESSIONS = 500;
/**
 * Jour d'entrée en vigueur de la réforme (même date que `regime-paiement-opco.ts`).
 * Relecture A7c : une session qui commence AVANT, sans accord daté après, relève de
 * l'ancien régime — la subrogation y est légitime, l'alerte doit se taire.
 */
const DEBUT_REFORME = "2026-10-01";

type SessionLue = Parameters<typeof entreeRegimeDepuisSession>[0] & {
  id: string;
  numero: string;
  /** Début de la session ; absent (lecture partielle) → seule la date d'accord décide. */
  dateDebut?: Date | null;
};

/** Décision PURE : quelles sessions subrogées le régime ne permet plus. */
export function candidatsSubrogationIncompatibleRegime(
  sessions: SessionLue[],
  now: Date,
): AlerteCandidate[] {
  const alertes: AlerteCandidate[] = [];
  for (const s of sessions) {
    // `?? []` : une lecture partielle (harnais, select élargi plus tard) ne doit pas
    // faire lever toute la règle, ce qui suspendrait la résolution de ses alertes.
    const { entree, confirmeParAccord } = entreeRegimeDepuisSession({
      client: s.client ?? null,
      dossiersFinancement: s.dossiersFinancement ?? [],
    });
    if (confirmeParAccord) continue;
    // Relecture A7c : sans date d'accord, `regimePaiementOpco` descend à la règle
    // « ≥ 50 salariés » et classerait à tort le stock de sessions antérieures à la
    // réforme. On ne lève que si la session commence au plus tôt le 1/10/2026 (jour
    // de Paris) ou si l'accord est daté de ce jour ou après.
    const debutNouveauRegime = s.dateDebut != null && parisDateISO(s.dateDebut) >= DEBUT_REFORME;
    const accordNouveauRegime =
      entree.dateAccord != null && parisDateISO(entree.dateAccord) >= DEBUT_REFORME;
    if (!debutNouveauRegime && !accordNouveauRegime) continue;
    const { regime, motif } = regimePaiementOpco({ ...entree, aujourdhui: now });
    if (regime !== "remboursement_entreprise") continue;
    alertes.push({
      code: "subrogation_incompatible_regime",
      niveau: "critique",
      titre: "Subrogation OPCO incompatible avec le régime de paiement",
      message: `La session ${s.numero} est en subrogation (paiement direct par ${nomOpcoDuClient(s.client)}), alors que le régime de paiement depuis le 1er octobre 2026 est le remboursement de l'entreprise : ${motif}. Sans accord écrit de l'OPCO prévoyant le paiement direct, la facture adressée à l'OPCO sera rejetée. Sur la page Financement de la session, retirez la subrogation ou cochez « L'accord écrit de l'OPCO prévoit le paiement direct à l'organisme ».`,
      cibleType: "TrainingSession",
      cibleId: s.id,
    });
  }
  return alertes;
}

export async function regleSubrogationIncompatibleRegime(now: Date): Promise<AlerteCandidate[]> {
  const sessions = await prisma.trainingSession.findMany({
    where: {
      opcoSubrogation: true,
      statut: { in: ["planifiee", "en_cours", "realisee"] },
      dateFin: { gte: new Date(now.getTime() - FENETRE_JOURS * JOUR_MS) },
      // Non encore facturée : aucune facture émise (ni brouillon, ni annulée).
      facturesFormation: { none: { statut: { notIn: ["brouillon", "annulee"] } } },
    },
    orderBy: { dateDebut: "asc" },
    take: PLAFOND_SESSIONS,
    select: {
      id: true,
      numero: true,
      dateDebut: true,
      // Même lecture que `regimePaiementDeSession` : les deux champs OPCO,
      // l'effectif, et le dossier OPCO ouvert le plus récent.
      client: { select: { opco: true, opcoIdentifie: true, effectif: true } },
      dossiersFinancement: {
        where: { type: { in: ["opco", "mixte"] }, statut: { not: "clos" } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          type: true,
          accordAt: true,
          accordEcritLe: true,
          depotFaitLe: true,
          subrogationConfirmeeParAccord: true,
          payeurs: { select: { payeurType: true } },
        },
      },
    },
  });
  return candidatsSubrogationIncompatibleRegime(sessions, now);
}
