// @formateurs E36 — le RELEVÉ MENSUEL OUBLIÉ.
//
// Un freelance activé avant la bascule anime en novembre (régime mensuel : la bascule
// est au 01/12/2038). Le 1er décembre, personne ne lance le calcul du mois.
// Attendu : une ligne « Relevé du mois à lancer » pour lui, une alerte à J+5, jamais de
// validation automatique, jamais de double ligne quand le calcul est enfin lancé (deux
// fois, par mégarde).
//
// DÉFAUT V1-C-3 (test.fixme) : rien ne signale le calcul NON LANCÉ. Aucune ligne
// « Relevé du mois à lancer » n'existe dans le code ; le 1er du mois, `rappelsMensuels`
// (paiement/suivi-mission.ts ~l. 122) n'envoie qu'un Telegram générique (« lancez le
// calcul »), et l'alerte de J+5 (`alerteReleveNonValide`, paiement/releve-mensuel-auto.ts
// ~l. 39) ne compte que des relevés EXISTANTS non validés : quand personne n'a lancé le
// calcul, il n'y en a aucun, et elle se tait. Montant en jeu : les honoraires du mois
// (ici 700 €), payés en retard sans que personne ne le voie.

import { expect, test } from "@playwright/test";

import { prisma } from "../fixtures/formateurs/base";
import { HORS_BANC } from "../fixtures/formateurs/argent-commun";
import { honorairesAnimationCents } from "../fixtures/formateurs/argent-contre-calcul";
import { jouer } from "../fixtures/formateurs/argent-execution";
import { relevesDe, semerFormateur, semerSession } from "../fixtures/formateurs/argent-semis";
import { avecVerrouArgent } from "../fixtures/formateurs/argent-verrou";

const TARIF = 35_000;
const D = "2038-12-01";

/** Une année PROPRE à chaque test : l'alerte de J+5 lit tous les relevés du mois écoulé. */
async function freelanceDeNovembre(annee: number) {
  const f = await semerFormateur({
    prenom: "Ninon",
    tarifJourneeHtCents: TARIF,
    activationValideeAt: new Date(`${annee}-09-01T10:00:00Z`),
  });
  const s = await semerSession({
    jours: [
      { date: `${annee}-11-16`, trainerId: f.id },
      { date: `${annee}-11-17`, trainerId: f.id },
    ],
    formateurs: [f.id],
    statut: "realisee",
  });
  return { f, s };
}

test.describe("@formateurs E36 — relevé mensuel oublié", () => {
  test.setTimeout(2_400_000);
  test.skip(HORS_BANC, "hors du job banc-formateurs : ni file ni puits SMTP");

  test("lancé enfin, deux fois : un seul relevé, jamais validé seul, aucune double ligne", async () => {
    await avecVerrouArgent(async () => {
      const { f, s } = await freelanceDeNovembre(2038);
      const [j1, j6] = await jouer([
        { etape: "suivi", maintenant: "2038-12-01T07:15:00Z", bascule: D },
        { etape: "suivi", maintenant: "2038-12-06T07:15:00Z", bascule: D },
      ]);
      // Le suivi tourne (la bascule est passée) et rappelle le mois clos, le 1er.
      expect(j1).toMatchObject({ etat: "fait", rappelBrouillon: true });
      expect(j6).toMatchObject({ etat: "fait" });
      // Personne n'a lancé : aucun relevé n'existe, rien n'a été écrit seul.
      expect(await relevesDe(f.id)).toEqual([]);

      await jouer([
        { etape: "run-mensuel", year: 2038, month: 11, bascule: D },
        { etape: "run-mensuel", year: 2038, month: 11, bascule: D },
      ]);
      const releves = await relevesDe(f.id);
      const attendu = honorairesAnimationCents(4, TARIF);
      expect(releves.map((r) => [r.origine, r.periodeMonth, r.statut, r.totalHtCents])).toEqual([
        ["releve_mensuel", 11, "brouillon", attendu],
      ]);
      const lignes = await prisma.trainerFeeLine.findMany({
        where: { trainerId: f.id, sessionId: s.id, statut: { not: "annule" } },
        select: { montantHtCents: true },
      });
      expect(lignes.reduce((t, l) => t + l.montantHtCents, 0)).toBe(attendu);
    });
  });

  // DÉFAUT V1-C-3 — l'oubli du calcul mensuel n'est signalé à personne.
  test.fixme("V1-C-3 : à J+5, l'oubli du calcul de novembre est signalé", async () => {
    await avecVerrouArgent(async () => {
      await freelanceDeNovembre(2039);
      const [j6] = await jouer([
        { etape: "suivi", maintenant: "2039-12-06T07:15:00Z", bascule: "2039-12-01" },
      ]);
      expect((j6 as { alerteNonValides: number }).alerteNonValides).toBeGreaterThan(0);
    });
  });
});
