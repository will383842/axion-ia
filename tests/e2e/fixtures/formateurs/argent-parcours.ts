// Banc @formateurs, équipe ARGENT — le PARCOURS commun des scénarios de virement :
// une mission animée, contresignée, écrite par le passage, validée, autofacturée.
// Chaque étape est le code serveur réel (voir `argent-executer.ts`).

import { expect } from "@playwright/test";

import { prisma } from "./base";
import { BASCULE_2037 } from "./argent-commun";
import { jouer, jouerUne } from "./argent-execution";
import {
  relevesDe,
  semerFormateur,
  semerMissionAcceptee,
  semerSession,
  type FormateurSeme,
} from "./argent-semis";

/** IBAN d'exemple (clé de contrôle juste), jamais un compte réel. */
export const IBAN_A = "FR7630006000011234567890189";
export const IBAN_B = "FR1420041010050500013M02606";

/** Pose l'IBAN de la fiche, chiffré et empreinté par les fonctions du dépôt. */
export async function poserIban(trainerId: string, iban: string): Promise<string> {
  const r = await jouerUne<{ iban: string; empreinte: string | null }>({
    etape: "chiffrer-iban",
    trainerId,
    iban,
  });
  if (r.empreinte === null) throw new Error("empreinte d'IBAN nulle : secret absent");
  await prisma.trainer.update({
    where: { id: trainerId },
    data: { iban: r.iban, ibanEmpreinte: r.empreinte },
  });
  return r.empreinte;
}

export interface FactureEmise {
  readonly formateur: FormateurSeme;
  readonly sessionId: string;
  readonly statementId: string;
  readonly empreinte: string;
  readonly totalTtcCents: number;
  /** Jour (Paris) de l'échéance écrite sur la pièce. */
  readonly echeanceAt: Date;
  readonly numero: string;
}

/**
 * Deux journées animées (`jours`), 350 €/j : 700 € HT, facture émise.
 *
 * `emettre: false` : le relevé reste écrit et à valider (échéance provisoire), sans
 * autofacture. Pour les scénarios qui n'éprouvent que la GARDE du virement : chaque F36
 * consomme une place du bridage des e-mails (40 par heure pour tout le banc).
 */
export async function factureDeMissionEmise(o: {
  readonly prenom: string;
  readonly jours: readonly [string, string];
  readonly tarifHtCents?: number;
  readonly emettre?: boolean;
}): Promise<FactureEmise> {
  const tarif = o.tarifHtCents ?? 35_000;
  const formateur = await semerFormateur({ prenom: o.prenom, tarifJourneeHtCents: tarif });
  const empreinte = await poserIban(formateur.id, IBAN_A);
  const s = await semerSession({
    jours: o.jours.map((date) => ({ date, trainerId: formateur.id })),
    formateurs: [formateur.id],
    statut: "realisee",
  });
  await semerMissionAcceptee({ sessionId: s.id, trainerId: formateur.id, tarifHtCents: tarif });
  const lendemain = new Date(`${o.jours[1]}T07:15:00Z`);
  lendemain.setUTCDate(lendemain.getUTCDate() + 1);
  const sorties = await jouer([
    ...o.jours.flatMap((date) =>
      (["matin", "apres_midi"] as const).map((demiJournee) => ({
        etape: "contresigner" as const,
        sessionId: s.id,
        trainerId: formateur.id,
        date,
        demiJournee,
        nomConfirme: formateur.nomComplet,
        maintenant: `${date}T16:30:00Z`,
      })),
    ),
    {
      etape: "passage",
      maintenant: lendemain.toISOString(),
      dateBascule: BASCULE_2037,
      sessionIds: [s.id],
      retraitMd: "declare",
    },
  ]);
  expect(sorties[4]).toMatchObject({ etat: "fait", ecrits: 1 });
  const [r] = await relevesDe(formateur.id);
  if (o.emettre !== false) {
    const [emis] = (await jouer([{ etape: "valider-et-emettre", statementId: r!.id }])) as [
      { emission: { data?: { numero: string } } },
    ];
    expect(emis.emission.data?.numero).toMatch(/\S/);
  }
  const [f] = await relevesDe(formateur.id);
  expect(f!.statut).toBe(o.emettre === false ? "a_valider" : "facture_recue");
  return {
    formateur,
    sessionId: s.id,
    statementId: f!.id,
    empreinte,
    totalTtcCents: f!.totalTtcCents,
    echeanceAt: f!.echeanceAt!,
    numero: f!.numeroFacture ?? "",
  };
}

/**
 * L'effet exact du clic « Virements faits » (`transitionStatementAction`, `→ paye`) :
 * aucun service hors session. Écriture conditionnelle sur le statut lu, preuve du
 * compte payé (fin et empreinte de l'IBAN lus AU CLIC par la garde du dépôt).
 */
export async function marquerPaye(
  statementId: string,
  payeAt: Date,
  preuve: { ibanFin4: string; ibanEmpreinte: string },
): Promise<void> {
  const { count } = await prisma.trainerStatement.updateMany({
    where: { id: statementId, statut: "facture_recue" },
    data: {
      statut: "paye",
      payeAt,
      moyenPaiement: "virement",
      referenceVirement: "BANC-VIR",
      ...preuve,
    } as never,
  });
  if (count !== 1) throw new Error("marquerPaye : le relevé n'était pas « facture reçue »");
}
