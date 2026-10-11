/**
 * Formateurs indépendants — ÉCRITURE de la présentation de la méthode payée
 * (lot L12i), dans la transaction de l'appelant. La règle vit dans
 * `presentation-methode.ts` (pure), le montant dans `argent/calcul-mission.ts`.
 *
 * Ce qui est écrit, une fois :
 *   - un relevé « hors mission » (`origine = passage_mission`, sans session), « à
 *     valider », au régime de TVA de la fiche FIGÉ sur le relevé, échéance = date
 *     de la présentation + 30 jours ;
 *   - une ligne `presentation_methode` de 17 500 centimes ;
 *   - une entrée de journal (cible : l'UUID du relevé).
 *
 * Rien n'est validé ni payé ici : la validation, l'autofacture et « Virement
 * fait » restent des gestes humains, par les chemins existants.
 *
 * 🔴 DEUX PRÉALABLES DE SCHÉMA, relus à chaque appel (refus net sinon) :
 *   - M-D : tant que l'unique historique (formateur, année, mois) est en base,
 *     le relevé hors mission ne peut pas coexister avec le relevé mensuel du mois ;
 *   - le CHECK historique `ck_fee_line_une_seule_prestation` exige une prestation
 *     (session, coaching, booking ou audit) sur CHAQUE ligne : une ligne de
 *     présentation n'en a aucune. Tant qu'il n'admet pas la ligne de
 *     présentation, l'écriture est refusée — jamais tentée.
 *
 * Sans `server-only` : rien n'empêche un passage du worker de l'appeler un jour.
 */

import type { TvaRegimeHonoraires } from "@/server/qualiopi/remuneration/calcul";
import { prendreVerrousRemuneration } from "@/server/qualiopi/remuneration/verrou-remuneration";
import { journaliser } from "@/server/journal/journaliser";

import { jourParis } from "../argent/dates";
import { uniqueHistoriqueRetire, type LecteurPassage } from "./lecture-passage";
import { instantDuJour } from "./passage-mission-base";
import { verdictPresentationMethode, type MotifRefusPresentation } from "./presentation-methode";

/** Le client de transaction (forme Prisma). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tx = any;

export type IssuePresentation =
  | { readonly issue: "ecrite"; readonly statementId: string; readonly totalTtcCents: number }
  | {
      readonly issue: "refuse";
      readonly motif:
        | MotifRefusPresentation
        | "introuvable"
        /** M-D non fait : l'unique historique (formateur, mois) refuserait le relevé. */
        | "contract_non_fait"
        /** Le CHECK historique refuserait une ligne sans prestation. */
        | "schema_hors_mission_absent"
        /** Un relevé hors mission vivant existe déjà ce mois-ci (anomalie). */
        | "releve_hors_mission_existant";
    };

/**
 * Le CHECK `ck_fee_line_une_seule_prestation` admet-il une ligne de présentation
 * sans prestation ? Oui s'il n'existe plus, ou si sa définition nomme
 * `presentation_methode` (l'élargissement attendu par L12i). Sinon : non.
 */
export async function ligneHorsMissionPermise(db: LecteurPassage): Promise<boolean> {
  const r = await db.$queryRawUnsafe<Array<{ def: string }>>(
    `SELECT pg_get_constraintdef(c.oid) AS def
       FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
      WHERE t.relname = 'trainer_fee_lines' AND c.conname = 'ck_fee_line_une_seule_prestation'`,
  );
  if (r.length === 0) return true;
  return r.every((x) => x.def.includes("presentation_methode"));
}

export interface DemandePresentation {
  readonly trainerId: string;
  /** « Présentation faite le … » (jour civil saisi). */
  readonly jour: string;
  /** Dernière signature du contrat-cadre intégralement signé, ou `null`. */
  readonly contratSigneLe: Date | null;
  readonly maintenant: Date;
  readonly userId: string;
}

/** Les faits et le verdict, SANS rien écrire (l'aperçu du geste). */
export async function lireVerdictPresentation(tx: Tx, d: DemandePresentation) {
  const t: {
    statut: "salarie" | "sous_traitant" | "dirigeant";
    organismeSousTraitantId: string | null;
    regimeTvaHonoraires: TvaRegimeHonoraires | null;
  } | null = await tx.trainer.findUnique({
    where: { id: d.trainerId },
    select: { statut: true, organismeSousTraitantId: true, regimeTvaHonoraires: true },
  });
  if (t === null) return null;
  const deja: number = await tx.trainerFeeLine.count({
    where: { trainerId: d.trainerId, objet: "presentation_methode", statut: { not: "annule" } },
  });
  return verdictPresentationMethode({
    statut: t.statut,
    organismeSousTraitantId: t.organismeSousTraitantId,
    regimeTva: t.regimeTvaHonoraires,
    contratSigneLe: d.contratSigneLe ? jourParis(d.contratSigneLe) : null,
    jour: d.jour,
    aujourdhui: jourParis(d.maintenant),
    dejaPayee: deja > 0,
  });
}

/**
 * Écrit la présentation payée. À appeler dans une transaction : les verrous de
 * rémunération (période, puis formateur) sérialisent deux clics simultanés, et
 * l'index unique partiel `trainer_fee_lines_presentation_methode_unique` reste le
 * dernier rempart.
 */
export async function ecrirePresentationMethode(
  tx: Tx,
  d: DemandePresentation,
): Promise<IssuePresentation> {
  if (!(await uniqueHistoriqueRetire(tx))) return { issue: "refuse", motif: "contract_non_fait" };
  if (!(await ligneHorsMissionPermise(tx)))
    return { issue: "refuse", motif: "schema_hors_mission_absent" };

  // Verrous AVANT la lecture : un second clic attend, puis voit la première ligne.
  const mois = /^(\d{4})-(\d{2})-\d{2}$/.exec(d.jour);
  if (mois) {
    await prendreVerrousRemuneration(tx, {
      periodes: [{ year: Number(mois[1]), month: Number(mois[2]) }],
      trainerIds: [d.trainerId],
    });
  }
  const v = await lireVerdictPresentation(tx, d);
  if (v === null) return { issue: "refuse", motif: "introuvable" };
  if (!v.ok) return { issue: "refuse", motif: v.motif };

  // Un relevé hors mission ne porte que la présentation, et la règle vient de dire
  // qu'aucune présentation vivante n'existe : un relevé vivant ce mois-ci est une
  // anomalie, signalée plutôt que complétée.
  const existant: number = await tx.trainerStatement.count({
    where: {
      trainerId: d.trainerId,
      origine: "passage_mission",
      sessionId: null,
      avoirDeId: null,
      periodeYear: v.mois.year,
      periodeMonth: v.mois.month,
      statut: { not: "annule" },
    },
  });
  if (existant > 0) return { issue: "refuse", motif: "releve_hors_mission_existant" };
  const releve: { id: string } = await tx.trainerStatement.create({
    data: {
      trainerId: d.trainerId,
      periodeYear: v.mois.year,
      periodeMonth: v.mois.month,
      statut: "a_valider",
      origine: "passage_mission",
      sessionId: null,
      tvaRegime: v.regimeTva,
      totalHtCents: v.calcul.totalHtCents,
      tvaCents: v.calcul.tvaCents,
      totalTtcCents: v.calcul.totalTtcCents,
      echeanceAt: instantDuJour(v.calcul.echeance),
    },
    select: { id: true },
  });
  const ligne = v.calcul.lignes[0]!;
  await tx.trainerFeeLine.create({
    data: {
      trainerId: d.trainerId,
      prestationType: "formation_collective",
      model: "forfait_prestation",
      nature: "honoraire_du",
      montantHtCents: ligne.montantHtCents,
      statut: "calcule",
      periodeYear: v.mois.year,
      periodeMonth: v.mois.month,
      statementId: releve.id,
      origine: "passage_mission",
      objet: "presentation_methode",
      demiJournees: ligne.demiJournees ?? 1,
      motif: `Présentation de la méthode du ${d.jour}`,
      calculatedAt: d.maintenant,
    },
    select: { id: true },
  });
  await journaliser(
    tx,
    {
      action: "qualiopi.remuneration.presentation_methode_ecrite",
      targetType: "TrainerStatement",
      targetId: releve.id,
      changes: {
        trainerId: d.trainerId,
        jour: d.jour,
        montantHtCents: ligne.montantHtCents,
        echeance: v.calcul.echeance,
      },
      session: { userId: d.userId },
    },
    { exiger: true },
  );
  return { issue: "ecrite", statementId: releve.id, totalTtcCents: v.calcul.totalTtcCents };
}
