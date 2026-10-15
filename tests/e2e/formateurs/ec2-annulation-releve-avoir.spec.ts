// @formateurs E-C2 — ANNULER un relevé de mission.
//
//   · relevé NON émis : l'annuler annule ses lignes ; le mois redevient calculable et le
//     passage suivant le réécrit — une fois, jamais payé deux fois (décision du
//     dirigeant) ;
//   · pièce ÉMISE (autofacture numérotée) : elle ne s'annule que par un AVOIR ; après
//     l'avoir, le passage ne réécrit pas le mois de lui-même (réémission = geste humain).
//
// ÉCARTS (rapport V1-C) :
//   · l'annulation directe n'a AUCUN service hors session : elle est écrite en ligne dans
//     `transitionStatementAction` (auth requise). Le banc écrit l'effet exact du clic —
//     relevé `annule` sous condition du statut lu et sans autofacture, lignes `annule`
//     (motif `autre`) — et éprouve ce qui compte pour l'argent : la réécriture par le
//     VRAI code d'écriture du passage. Le refus d'annuler directement une pièce émise
//     (même action) n'est pas atteignable par le banc ;
//   · M-D n'est pas en base : avec la base telle qu'elle est, un mois annulé ne peut PAS
//     être réécrit (l'unique historique garde la place) et l'avoir est refusé
//     (`contract_non_fait`) — constaté ici. La réécriture et l'avoir sont ensuite éprouvés
//     sous M-D SIMULÉ dans une transaction annulée, comme les tests d'intégration ;
//   · l'avoir n'a qu'un appelant, l'acceptation d'un désaccord du formateur : la console
//     n'a pas de geste « émettre un avoir » à l'initiative de l'organisme.

import { expect, test } from "@playwright/test";

import { prisma } from "../fixtures/formateurs/base";
import { BASCULE_2037, HORS_BANC } from "../fixtures/formateurs/argent-commun";
import { honorairesAnimationCents } from "../fixtures/formateurs/argent-contre-calcul";
import { jouer } from "../fixtures/formateurs/argent-execution";
import type { EtapeArgent } from "../fixtures/formateurs/argent-protocole";
import {
  lignesVivantes,
  relevesDe,
  semerFormateur,
  semerMissionAcceptee,
  semerSession,
} from "../fixtures/formateurs/argent-semis";
import { avecVerrouArgent } from "../fixtures/formateurs/argent-verrou";

const TARIF = 35_000;
const HT = honorairesAnimationCents(4, TARIF);
const JOURS = ["2038-02-15", "2038-02-16"] as const;
const DEMI = ["matin", "apres_midi"] as const;

function passage(maintenant: string, sessionId: string): EtapeArgent {
  return {
    etape: "passage",
    maintenant,
    dateBascule: BASCULE_2037,
    sessionIds: [sessionId],
    retraitMd: "declare",
  };
}

/** Un mois de mission complet et écrit par le passage : le relevé `a_valider`. */
async function moisEcrit() {
  const f = await semerFormateur({ prenom: "Clement" });
  const s = await semerSession({
    jours: JOURS.map((date) => ({ date, trainerId: f.id })),
    formateurs: [f.id],
    statut: "realisee",
  });
  await semerMissionAcceptee({ sessionId: s.id, trainerId: f.id, tarifHtCents: TARIF });
  const sorties = await jouer([
    ...JOURS.flatMap((date) =>
      DEMI.map((demiJournee) => ({
        etape: "contresigner" as const,
        sessionId: s.id,
        trainerId: f.id,
        date,
        demiJournee,
        nomConfirme: f.nomComplet,
        maintenant: `${date}T16:30:00Z`,
      })),
    ),
    passage("2038-02-17T07:15:00Z", s.id),
  ]);
  expect(sorties[4]).toMatchObject({ etat: "fait", ecrits: 1 });
  const [r] = await relevesDe(f.id);
  expect([r!.statut, r!.totalHtCents]).toEqual(["a_valider", HT]);
  const mois = {
    trainerId: f.id,
    sessionId: s.id,
    tarifJourneeHtCents: TARIF,
    contresignatures: JOURS.flatMap((jour) => DEMI.map((demiJournee) => ({ jour, demiJournee }))),
  };
  return { f, s, releve: r!, mois };
}

interface Observe {
  correction: unknown;
  reecritures: string[];
  releves: Array<{
    id: string;
    statut: string;
    avoirDeId: string | null;
    totalHtCents: number;
    feeLines: Array<{ statut: string; montantHtCents: number }>;
  }>;
}

/** Ce qui reste DÛ : relevés vivants (ni annulés, ni avoirs), lignes vivantes. */
function dettesVivantes(o: Observe): number {
  return o.releves
    .filter((r) => r.statut !== "annule" && r.avoirDeId === null)
    .flatMap((r) => r.feeLines.filter((l) => l.statut !== "annule"))
    .reduce((t, l) => t + l.montantHtCents, 0);
}

test.describe("@formateurs E-C2 — annuler un relevé de mission", () => {
  test.setTimeout(2_400_000);
  test.skip(HORS_BANC, "hors du job banc-formateurs : ni file ni puits SMTP");

  test("relevé non émis annulé : lignes annulées, mois réécrit au passage suivant, une fois", async () => {
    await avecVerrouArgent(async () => {
      // ── M-D simulé : annuler, puis deux passages.
      const un = await moisEcrit();
      const [sousMd] = (await jouer([
        {
          etape: "correction",
          geste: "annuler",
          statementId: un.releve.id,
          maintenant: "2038-02-18T07:15:00Z",
          retraitMd: "simule",
          mois: un.mois,
        },
      ])) as [Observe];
      expect(sousMd.correction).toEqual({ annule: true });
      expect(sousMd.reecritures).toEqual(["ecrit", "deja_ecrit"]);
      const annule = sousMd.releves.find((r) => r.id === un.releve.id)!;
      expect(annule.statut).toBe("annule");
      expect(annule.feeLines.every((l) => l.statut === "annule")).toBe(true);
      const neuf = sousMd.releves.filter((r) => r.id !== un.releve.id);
      expect(neuf.map((r) => [r.statut, r.totalHtCents])).toEqual([["a_valider", HT]]);
      // Jamais deux fois : une seule dette vivante, au centime.
      expect(dettesVivantes(sousMd)).toBe(HT);

      // ── Base telle qu'elle est (index historique présent), annulation gardée : même
      // M-D déclaré, l'écriture du passage ne peut pas réécrire le mois (l'unique
      // historique garde la place du relevé annulé). L'erreur est comptée et remontée ;
      // rien n'est payé, rien deux fois — c'est M-D qui rendra le mois au passage.
      const deux = await moisEcrit();
      await prisma.$transaction(async (tx) => {
        const { count } = await tx.trainerStatement.updateMany({
          where: { id: deux.releve.id, statut: "a_valider", autofactureAt: null },
          data: { statut: "annule" },
        });
        expect(count).toBe(1);
        await tx.trainerFeeLine.updateMany({
          where: { statementId: deux.releve.id, statut: { not: "annule" } },
          data: { statut: "annule", annuleMotif: "autre" },
        });
      });
      const [bloque] = await jouer([passage("2038-02-18T07:15:00Z", deux.s.id)]);
      expect(bloque).toMatchObject({ etat: "fait", ecrits: 0, erreurs: 1 });
      expect(await lignesVivantes(deux.f.id, deux.s.id)).toEqual([]);
    });
  });

  test("pièce émise : seulement par avoir ; après l'avoir, aucune réécriture automatique", async () => {
    await avecVerrouArgent(async () => {
      const { f, releve, mois } = await moisEcrit();
      const correction = (retraitMd: "reel" | "simule", geste: "avoir") =>
        ({
          etape: "correction",
          geste,
          statementId: releve.id,
          maintenant: "2038-02-20T09:00:00Z",
          retraitMd,
          mois,
        }) as const;
      const [emis, sansMd, avoirSousMd] = (await jouer([
        { etape: "valider-et-emettre", statementId: releve.id },
        correction("reel", "avoir"),
        correction("simule", "avoir"),
      ])) as [{ emission: { data?: { numero: string } } }, Observe, Observe];
      expect(emis.emission.data?.numero).toMatch(/\S/);

      // Base telle qu'elle est : l'avoir est refusé, la pièce reste, rien n'est réécrit.
      expect(sansMd.correction).toEqual({ issue: "refuse", motif: "contract_non_fait" });
      expect(sansMd.reecritures).toEqual(["deja_ecrit", "deja_ecrit"]);

      // M-D simulé : l'avoir annule la pièce ET ses lignes, porte l'opposé au centime,
      // et le passage ne réécrit pas le mois (la réémission est un geste humain).
      expect((avoirSousMd.correction as { issue: string }).issue).toBe("avoir_emis");
      expect(avoirSousMd.reecritures).toEqual(["reemission_attendue", "reemission_attendue"]);
      const piece = avoirSousMd.releves.find((r) => r.id === releve.id)!;
      const avoir = avoirSousMd.releves.find((r) => r.avoirDeId === releve.id)!;
      expect(piece.statut).toBe("annule");
      expect(piece.feeLines.every((l) => l.statut === "annule")).toBe(true);
      expect(avoir.totalHtCents).toBe(-HT);
      expect(avoir.feeLines.reduce((t, l) => t + l.montantHtCents, 0)).toBe(-HT);
      expect(dettesVivantes(avoirSousMd)).toBe(0);

      // Les transactions simulées sont ANNULÉES : la base garde la pièce émise, intacte,
      // et l'index historique.
      const apres = await relevesDe(f.id);
      expect(apres.map((r) => [r.statut, r.totalHtCents, r.avoirDeId])).toEqual([
        ["facture_recue", HT, null],
      ]);
      const index = await prisma.$queryRawUnsafe<Array<{ n: number }>>(
        `SELECT count(*)::int AS n FROM pg_indexes WHERE indexname = 'statement_unique_trainer_periode'`,
      );
      expect(index[0]?.n).toBe(1);
    });
  });
});
