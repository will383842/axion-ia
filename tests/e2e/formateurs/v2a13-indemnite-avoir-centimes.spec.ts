// @formateurs V2-A13 — ANNULATION, INDEMNITÉ, AVOIR : au centime, TVA comprise, jamais un
// montant négatif à payer.
//
// Formateur ASSUJETTI à la TVA (20 %), tarif impair de 333,33 €/j.
//   · Indemnité : session annulée par Axion à moins de 72 h, trois demi-journées
//     annulées non signées (le matin du lundi est signé) → 50 % de ⌊3 × 33 333 / 2⌋ =
//     249,99 € HT, et la TVA de 20 % FACTURÉE dessus (50,00 €).
//   · Avoir : une pièce de mission émise (trois demi-journées) est annulée par avoir : il
//     porte l'OPPOSÉ exact de la pièce, ligne par ligne, HT, TVA et TTC ; plus rien n'est
//     dû, et aucune ligne négative n'apparaît dans « Virements à faire ».
//
// ÉCARTS : comme E-C2 et E-C3 — l'indemnité n'est pas écrite tant que M-D n'est pas fait
// (son aperçu est contre-calculé) ; l'avoir est émis dans une transaction ANNULÉE où
// l'index historique est retiré (M-D simulé), et le banc lit ce qu'elle a écrit avant
// l'annulation.

import { expect, test } from "@playwright/test";

import { prisma } from "../fixtures/formateurs/base";
import { HORS_BANC } from "../fixtures/formateurs/argent-commun";
import {
  aParis,
  honorairesAnimationCents,
  indemniteAnnulationCents,
  ttcCents,
} from "../fixtures/formateurs/argent-contre-calcul";
import { jouer, jouerUne } from "../fixtures/formateurs/argent-execution";
import { poserIban, IBAN_A } from "../fixtures/formateurs/argent-parcours";
import {
  relevesDe,
  semerFormateur,
  semerMissionAcceptee,
  semerSession,
} from "../fixtures/formateurs/argent-semis";
import { avecVerrouArgent } from "../fixtures/formateurs/argent-verrou";
import { contresignerJournee, passageV2a } from "../fixtures/formateurs/v2a-semis";

const TARIF = 33_333;
const ASSUJETTI = "assujetti_20" as const;
/** `moteur-mission.ts` : la mission fermée alors que sa lettre est signée (décision attendue). */
const MOTIF_FERMEE_LETTRE_SIGNEE =
  "Mission fermée alors que la lettre est signée : Will décide (annuler avec motif, ou constater).";

/** Un indépendant assujetti : l'autofacture exige son numéro de TVA intracommunautaire. */
async function assujetti(prenom: string) {
  const f = await semerFormateur({ prenom, regimeTva: ASSUJETTI, tarifJourneeHtCents: TARIF });
  await prisma.trainer.update({
    where: { id: f.id },
    data: { numeroTvaIntracom: "FR32987654324" },
  });
  return f;
}

/** Fiches closes en fin de test : leurs sessions annulées ne doivent plus rien réclamer. */
const aClore: string[] = [];
async function clore(): Promise<void> {
  await prisma.trainer.updateMany({
    where: { id: { in: aClore.splice(0) } },
    data: { finCollaborationAt: new Date(), finCollaborationMotif: "initiative_axion" },
  });
}

test.describe("@formateurs V2-A13 — indemnité et avoir au centime", () => {
  test.setTimeout(600_000);
  test.skip(HORS_BANC, "hors du job banc-formateurs : ni file ni puits SMTP");

  test("indemnité d'annulation : 50 % des demi-journées non signées, TVA facturée, au centime", async () => {
    await avecVerrouArgent(async () => {
      try {
        const f = await assujetti("Isaure");
        aClore.push(f.id);
        const s = await semerSession({
          jours: ["2041-08-13", "2041-08-14"].map((date) => ({ date, trainerId: f.id })),
          formateurs: [f.id],
          statut: "en_cours",
        });
        const missionId = await semerMissionAcceptee({
          sessionId: s.id,
          trainerId: f.id,
          tarifHtCents: TARIF,
          regimeTva: ASSUJETTI,
          lettreBlocageMotif: MOTIF_FERMEE_LETTRE_SIGNEE,
        });
        const [sig] = await jouer([
          {
            etape: "contresigner",
            sessionId: s.id,
            trainerId: f.id,
            date: "2041-08-13",
            demiJournee: "matin",
            nomConfirme: f.nomComplet,
            maintenant: aParis("2041-08-13", "12:05").toISOString(),
          },
        ]);
        expect(sig).toMatchObject({ ok: true });
        await prisma.trainingSession.update({ where: { id: s.id }, data: { statut: "annulee" } });
        const decision = await jouerUne<{
          montantHtCents: number;
          totalTtcCents: number;
          issue: string;
        }>({
          etape: "indemnite",
          missionId,
          annuleeA: aParis("2041-08-13", "12:30").toISOString(),
          parAxion: true,
        });
        const ht = indemniteAnnulationCents(3, TARIF);
        expect(ht).toBe(24_999);
        expect(decision).toMatchObject({
          montantHtCents: ht,
          totalTtcCents: ttcCents(ht, ASSUJETTI),
        });
        expect(decision.totalTtcCents).toBe(29_999);
        expect(decision.totalTtcCents).toBeGreaterThan(decision.montantHtCents);
      } finally {
        await clore();
      }
    });
  });

  test("avoir d'une pièce émise : l'opposé exact (HT, TVA, TTC, lignes), plus rien de dû, rien de négatif à virer", async () => {
    await avecVerrouArgent(async () => {
      const f = await assujetti("Anatole");
      await poserIban(f.id, IBAN_A);
      const s = await semerSession({
        jours: [
          { date: "2041-08-20", trainerId: f.id },
          { date: "2041-08-21", trainerId: f.id, heureDebut: "09:00", heureFin: "12:30" },
        ],
        formateurs: [f.id],
        statut: "realisee",
      });
      await semerMissionAcceptee({
        sessionId: s.id,
        trainerId: f.id,
        tarifHtCents: TARIF,
        regimeTva: ASSUJETTI,
      });
      const ecrit = await jouer([
        ...contresignerJournee(s.id, f, "2041-08-20"),
        ...contresignerJournee(s.id, f, "2041-08-21", ["matin"]),
        passageV2a("2041-08-22T07:15:00Z", [s.id]),
      ]);
      expect(ecrit[3]).toMatchObject({ etat: "fait", ecrits: 1 });
      const [releve] = await relevesDe(f.id);
      const ht = honorairesAnimationCents(3, TARIF);
      expect([releve!.totalHtCents, releve!.totalTtcCents]).toEqual([ht, ttcCents(ht, ASSUJETTI)]);
      expect([ht, ttcCents(ht, ASSUJETTI)]).toEqual([49_999, 59_999]);

      const [emis, observe] = (await jouer([
        { etape: "valider-et-emettre", statementId: releve!.id },
        {
          etape: "correction",
          geste: "avoir",
          statementId: releve!.id,
          maintenant: "2041-09-01T09:00:00Z",
          retraitMd: "simule",
          mois: {
            trainerId: f.id,
            sessionId: s.id,
            tarifJourneeHtCents: TARIF,
            contresignatures: [
              { jour: "2041-08-20", demiJournee: "matin" },
              { jour: "2041-08-20", demiJournee: "apres_midi" },
              { jour: "2041-08-21", demiJournee: "matin" },
            ],
          },
        },
      ])) as [
        { emission: { data?: { numero: string } } },
        {
          correction: { issue: string };
          releves: Array<{
            id: string;
            statut: string;
            avoirDeId: string | null;
            totalHtCents: number;
            totalTtcCents: number;
            feeLines: Array<{ statut: string; montantHtCents: number }>;
          }>;
        },
      ];
      expect(emis.emission.data?.numero).toMatch(/\S/);
      expect(observe.correction.issue).toBe("avoir_emis");
      const piece = observe.releves.find((r) => r.id === releve!.id)!;
      const avoir = observe.releves.find((r) => r.avoirDeId === releve!.id)!;
      expect([avoir.totalHtCents, avoir.totalTtcCents]).toEqual([
        -piece.totalHtCents,
        -piece.totalTtcCents,
      ]);
      expect(avoir.totalTtcCents - avoir.totalHtCents).toBe(
        -(piece.totalTtcCents - piece.totalHtCents),
      );
      expect(avoir.feeLines.map((l) => l.montantHtCents).sort()).toEqual(
        piece.feeLines.map((l) => -l.montantHtCents).sort(),
      );
      // Plus rien de dû : la pièce et ses lignes sont annulées, l'avoir n'est pas « à payer ».
      expect(piece.statut).toBe("annule");
      expect(piece.feeLines.every((l) => l.statut === "annule")).toBe(true);

      // « Virements à faire » ne montre jamais un montant négatif (l'avoir est un crédit).
      const vue = await jouerUne<Array<{ montantCents: number }>>({
        etape: "virements",
        maintenant: "2041-09-02T08:00:00Z",
        ids: observe.releves.map((r) => r.id),
      });
      expect(vue.every((v) => v.montantCents > 0)).toBe(true);
    });
  });
});
