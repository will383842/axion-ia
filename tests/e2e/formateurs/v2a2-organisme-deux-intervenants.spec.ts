// @formateurs V2-A2 — ORGANISME SOUS-TRAITANT à deux intervenants.
//
// Un organisme facture pour ses intervenants (décision 88 : UN relevé par organisme,
// session et mois, `calculerReleveOrganisme`). Deux intervenants de cet organisme animent
// chacun une journée d'une session d'avril 2040, chacun avec une mission acceptée à prix
// figé (le choix en cartes le permet : E31), et contresignent leur journée.
// Attendu : rien n'est payé en leur nom propre — le paiement va à l'organisme, sur une
// pièce, pour les deux journées (et jamais à la fois à l'organisme et aux intervenants).
//
// DÉFAUT V2-A-2 (test.fixme) : le passage écrit UN relevé de mission par intervenant, à
// SON nom (`organismeSousTraitantId` vide) — `lireCandidats` retient toute
// contresignature d'un `sous_traitant` sans regarder l'organisme
// (paiement/passage-mission-base.ts ~l. 83), et l'écriture pose le relevé au nom du
// formateur (~l. 337). Deux relevés « à valider », payables chacun à une personne qui
// n'est pas le créancier, alors que l'organisme facture les mêmes journées.

import { expect, test } from "@playwright/test";

import { prisma } from "../fixtures/formateurs/base";
import { HORS_BANC } from "../fixtures/formateurs/argent-commun";
import { jouer } from "../fixtures/formateurs/argent-execution";
import {
  semerFormateur,
  semerMissionAcceptee,
  semerSession,
} from "../fixtures/formateurs/argent-semis";
import { avecVerrouArgent } from "../fixtures/formateurs/argent-verrou";
import { contresignerJournee, passageV2a, semerOrganisme } from "../fixtures/formateurs/v2a-semis";

const TARIF = 40_000;

test.describe("@formateurs V2-A2 — organisme à deux intervenants", () => {
  test.setTimeout(600_000);
  test.skip(HORS_BANC, "hors du job banc-formateurs : ni file ni puits SMTP");

  // DÉFAUT V2-A-2 — chaque intervenant reçoit un relevé de mission à son nom.
  test.fixme("V2-A-2 : aucun relevé au nom propre d'un intervenant d'organisme", async () => {
    await avecVerrouArgent(async () => {
      const o = await semerOrganisme();
      const i1 = await semerFormateur({ prenom: "Irene", tarifJourneeHtCents: TARIF });
      const i2 = await semerFormateur({ prenom: "Isidore", tarifJourneeHtCents: TARIF });
      await prisma.trainer.updateMany({
        where: { id: { in: [i1.id, i2.id] } },
        data: { organismeSousTraitantId: o.id },
      });
      const s = await semerSession({
        jours: [
          { date: "2040-04-09", trainerId: i1.id },
          { date: "2040-04-10", trainerId: i2.id },
        ],
        formateurs: [i1.id, i2.id],
        principal: i1.id,
        statut: "realisee",
      });
      for (const f of [i1, i2])
        await semerMissionAcceptee({ sessionId: s.id, trainerId: f.id, tarifHtCents: TARIF });
      const sorties = await jouer([
        ...contresignerJournee(s.id, i1, "2040-04-09"),
        ...contresignerJournee(s.id, i2, "2040-04-10"),
        passageV2a("2040-04-11T07:15:00Z", [s.id]),
      ]);
      for (const r of sorties.slice(0, 4)) expect(r).toMatchObject({ ok: true });

      const auNomPropre = await prisma.trainerStatement.findMany({
        where: { trainerId: { in: [i1.id, i2.id] }, organismeSousTraitantId: null },
        select: { id: true, totalHtCents: true },
      });
      expect(auNomPropre).toEqual([]);
      // Ce qui est dû pour les deux journées l'est une fois, à l'organisme.
      const lignes = await prisma.trainerFeeLine.findMany({
        where: { sessionId: s.id, statut: { not: "annule" } },
        select: { montantHtCents: true, statement: { select: { organismeSousTraitantId: true } } },
      });
      expect(lignes.every((l) => l.statement?.organismeSousTraitantId === o.id)).toBe(true);
      expect(lignes.reduce((t, l) => t + l.montantHtCents, 0)).toBeLessThanOrEqual(2 * TARIF);
    });
  });
});
