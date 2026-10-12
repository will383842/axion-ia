/**
 * Lot G2 — ce que la CONSOLE montre du bilan de fin de formation d'une session : pour
 * chaque formateur indépendant qui l'a animée, l'état du bilan et le MOTIF EXACT qui
 * retient son paiement (« il manque le bilan de fin de formation »…), lu par la même règle
 * que le passage (`formationCompleteSurLaSession`).
 *
 * `null` : interrupteur `formateurs.bilan_fin_formation` éteint — rien n'est montré, rien
 * n'est lu au-delà de lui.
 */

import { prisma } from "@/lib/prisma";
import { formateursDeLaSession } from "@/server/qualiopi/appreciations/formateurs-de-la-session";

import { jourDeColonneDate } from "../argent/dates";
import { interrupteurAllume } from "../interrupteur-allume";
import {
  formationCompleteSurLaSession,
  LIBELLE_MOTIF_FORMATION_INCOMPLETE,
  type VerdictFormationComplete,
} from "../paiement/formation-complete";
import { lireAllumageBilan } from "./allumage";
import { bilanExige, derniereJourneeDe } from "./regles";

export interface LigneBilanConsole {
  readonly trainerId: string;
  readonly nom: string;
  readonly termineAt: Date | null;
  readonly avisDonne: boolean;
  readonly payerQuandMeme: { readonly at: Date; readonly motif: string | null } | null;
  /** Le paiement attend-il le bilan ? (session finie après l'allumage) */
  readonly exige: boolean;
  readonly verdict: VerdictFormationComplete;
  /** Le motif en clair, ou `null` si la formation est complète pour ce formateur. */
  readonly motif: string | null;
}

export async function lireBilansConsole(sessionId: string): Promise<LigneBilanConsole[] | null> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return null;
  if (!(await interrupteurAllume("bilan_fin_formation"))) return null;
  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: {
      formateurPrincipalId: true,
      sessionFormateurs: { select: { trainerId: true } },
      jours: { select: { date: true, heureDebut: true, heureFin: true, trainerId: true } },
    },
  });
  if (session === null) return null;
  const formateurs = await prisma.trainer.findMany({
    where: {
      id: { in: formateursDeLaSession(session) },
      statut: "sous_traitant",
      organismeSousTraitantId: null,
    },
    orderBy: [{ nom: "asc" }, { prenom: "asc" }],
    select: { id: true, nom: true, prenom: true, statut: true, organismeSousTraitantId: true },
  });
  if (formateurs.length === 0) return [];
  const ids = formateurs.map((f) => f.id);
  const [signatures, bilans, allumeLe] = await Promise.all([
    prisma.emargementContresignature.findMany({
      where: { sessionId, revokedAt: null, trainerId: { in: ids } },
      select: { trainerId: true, date: true, demiJournee: true },
    }),
    prisma.bilanFinFormation.findMany({
      where: { sessionId, trainerId: { in: ids } },
      select: {
        trainerId: true,
        termineAt: true,
        appreciationId: true,
        payerQuandMemeAt: true,
        payerQuandMemeMotif: true,
      },
    }),
    lireAllumageBilan(prisma),
  ]);
  const derniere = derniereJourneeDe(session.jours);
  return formateurs.map((t) => {
    const b = bilans.find((x) => x.trainerId === t.id);
    const affecte = session.sessionFormateurs.some((sf) => sf.trainerId === t.id);
    const exige =
      derniere !== null && bilanExige({ ...t, allumeLe, derniereJournee: derniere.jour });
    const verdict = formationCompleteSurLaSession({
      journeesPrevues: session.jours
        .filter((j) => j.trainerId === t.id || (j.trainerId === null && affecte))
        .map((j) => ({
          jour: jourDeColonneDate(j.date),
          heureDebut: j.heureDebut,
          heureFin: j.heureFin,
        })),
      contresignatures: signatures
        .filter((s) => s.trainerId === t.id)
        .map((s) => ({ jour: jourDeColonneDate(s.date), demiJournee: s.demiJournee })),
      // Même valeur que le passage tant que la condition du financeur n'est pas lisible.
      conditionFinanceurEnAttente: false,
      bilan: exige
        ? { termine: b?.termineAt != null, payerQuandMeme: b?.payerQuandMemeAt != null }
        : null,
    });
    return {
      trainerId: t.id,
      nom: `${t.prenom} ${t.nom}`,
      termineAt: b?.termineAt ?? null,
      avisDonne: b?.appreciationId != null,
      payerQuandMeme:
        b?.payerQuandMemeAt != null
          ? { at: b.payerQuandMemeAt, motif: b.payerQuandMemeMotif ?? null }
          : null,
      exige,
      verdict,
      motif: verdict.raison === null ? null : LIBELLE_MOTIF_FORMATION_INCOMPLETE[verdict.raison],
    };
  });
}
