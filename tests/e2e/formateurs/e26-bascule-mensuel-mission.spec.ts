// @formateurs E26 — la BASCULE du relevé mensuel au paiement par mission (D = 01/10/2037).
//
//   · une formation commencée AVANT D est payée ENTIÈRE par le relevé mensuel de son
//     mois de début ;
//   · une formation commencée APRÈS D est payée par mission, jamais par le mensuel ;
//   · une formation À CHEVAL (28/09, 29/09, 05/10 ; 350 €/jour) est payée 1 050 €,
//     jamais 1 400 € — ni compte double, ni oubli.
//
// DÉFAUT V1-C-2 (test.fixme) : à cheval, si la mission a été ACCEPTÉE À PRIX FIGÉ (les
// conditions figées de la proposition), personne ne la paie. Le calcul mensuel l'écarte
// (`sansConditionsFigees` → anomalie `conditions_figees_hors_mission`,
// remuneration/statements.ts ~l. 342 → paiement/apres-bascule.ts ~l. 93) et le passage
// l'ignore (première journée avant D, paiement/passage-mission.ts ~l. 138).
//
// ÉCARTS : M-D déclaré par le banc pour le passage (voir E20) ; le calcul mensuel paie
// d'après la durée de la formation (`Formation.dureeHeures` / 7 × tarif), pas d'après
// les feuilles : le contre-calcul suit le contrat (3 journées = 21 h).

import { expect, test } from "@playwright/test";

import { prisma } from "../fixtures/formateurs/base";
import { BASCULE_2037, HORS_BANC, bascule } from "../fixtures/formateurs/argent-commun";
import { honorairesAnimationCents } from "../fixtures/formateurs/argent-contre-calcul";
import { jouer } from "../fixtures/formateurs/argent-execution";
import type { EtapeArgent } from "../fixtures/formateurs/argent-protocole";
import {
  lignesVivantes,
  relevesDe,
  semerFormateur,
  semerMissionAcceptee,
  semerSession,
  type FormateurSeme,
} from "../fixtures/formateurs/argent-semis";
import { avecVerrouArgent } from "../fixtures/formateurs/argent-verrou";
import { semerInterrupteurs } from "../fixtures/formateurs/interrupteurs";

const TARIF = 35_000;
const A_CHEVAL = ["2037-09-28", "2037-09-29", "2037-10-05"] as const;

async function formateurEtSession(prenom: string, jours: readonly string[]) {
  const f = await semerFormateur({ prenom, tarifJourneeHtCents: TARIF });
  const s = await semerSession({
    jours: jours.map((date) => ({ date, trainerId: f.id })),
    formateurs: [f.id],
    statut: "realisee",
  });
  return { f, s };
}

function signerTout(f: FormateurSeme, sessionId: string, jours: readonly string[]): EtapeArgent[] {
  return jours.flatMap((date) =>
    (["matin", "apres_midi"] as const).map((demiJournee) => ({
      etape: "contresigner" as const,
      sessionId,
      trainerId: f.id,
      date,
      demiJournee,
      nomConfirme: f.nomComplet,
      maintenant: `${date}T16:30:00Z`,
    })),
  );
}

const somme = (l: ReadonlyArray<{ montantHtCents: number }>) =>
  l.reduce((s, x) => s + x.montantHtCents, 0);

test.describe("@formateurs E26 — bascule du mensuel au paiement par mission", () => {
  test.setTimeout(2_400_000);
  test.skip(HORS_BANC, "hors du job banc-formateurs : ni file ni puits SMTP");

  test("avant D : mensuel entier ; après D : par mission ; à cheval : 1 050 €, jamais 1 400 €", async () => {
    await avecVerrouArgent(async () => {
      const restaurer = await semerInterrupteurs({
        ...bascule(BASCULE_2037),
        "formateurs.bilan_fin_formation": { actif: false },
      });
      try {
        const avant = await formateurEtSession("Paul", ["2037-09-14", "2037-09-15"]);
        const apres = await formateurEtSession("Quentin", ["2037-10-19", "2037-10-20"]);
        const cheval = await formateurEtSession("Rose", A_CHEVAL);
        // Seule la formation d'après D a une mission à prix figé (proposition « cartes »).
        await semerMissionAcceptee({
          sessionId: apres.s.id,
          trainerId: apres.f.id,
          tarifHtCents: TARIF,
        });
        const sessions = [avant.s.id, apres.s.id, cheval.s.id];
        const sorties = await jouer([
          ...signerTout(avant.f, avant.s.id, ["2037-09-14", "2037-09-15"]),
          ...signerTout(apres.f, apres.s.id, ["2037-10-19", "2037-10-20"]),
          ...signerTout(cheval.f, cheval.s.id, A_CHEVAL),
          {
            etape: "passage",
            maintenant: "2037-10-21T06:15:00Z",
            dateBascule: BASCULE_2037,
            sessionIds: sessions,
            retraitMd: "declare",
          },
          { etape: "run-mensuel", year: 2037, month: 9 },
          { etape: "run-mensuel", year: 2037, month: 10 },
          // Un second tour de chaque moteur ne change rien.
          {
            etape: "passage",
            maintenant: "2037-10-22T06:15:00Z",
            dateBascule: BASCULE_2037,
            sessionIds: sessions,
            retraitMd: "declare",
          },
          { etape: "run-mensuel", year: 2037, month: 9 },
          { etape: "run-mensuel", year: 2037, month: 10 },
        ]);
        expect(sorties.slice(0, 14).every((s) => (s as { ok: boolean }).ok)).toBe(true);
        expect(sorties[14]).toMatchObject({ etat: "fait", ecrits: 1, conflits: 0, erreurs: 0 });
        expect(sorties[17]).toMatchObject({ etat: "fait", ecrits: 0, dejaEcrits: 1 });

        // Contre-calcul : 2 journées = 700 €, 3 journées = 1 050 €.
        const deuxJours = honorairesAnimationCents(4, TARIF);
        const troisJours = honorairesAnimationCents(6, TARIF);
        expect([deuxJours, troisJours]).toEqual([70_000, 105_000]);

        // Avant D : le relevé MENSUEL de septembre, entier ; rien par mission.
        const rAvant = await relevesDe(avant.f.id);
        expect(rAvant.map((r) => [r.origine, r.periodeMonth, r.totalHtCents])).toEqual([
          ["releve_mensuel", 9, deuxJours],
        ]);
        expect(rAvant[0]!.statut).toBe("brouillon"); // jamais validé seul

        // Après D : par mission, jamais par le mensuel.
        const lApres = await lignesVivantes(apres.f.id, apres.s.id);
        expect(lApres.map((l) => l.origine)).toEqual(["passage_mission"]);
        expect(somme(lApres)).toBe(deuxJours);
        expect(
          await prisma.trainerStatement.count({
            where: { trainerId: apres.f.id, origine: "releve_mensuel" },
          }),
        ).toBe(0);

        // À cheval : 1 050 € par le mensuel de septembre, jamais 1 400 €.
        const lCheval = await lignesVivantes(cheval.f.id, cheval.s.id);
        expect(somme(lCheval)).toBe(troisJours);
        expect(new Set(lCheval.map((l) => l.origine))).toEqual(new Set(["releve_mensuel"]));
        const rCheval = await relevesDe(cheval.f.id);
        expect(rCheval.map((r) => [r.origine, r.periodeMonth, r.totalHtCents])).toEqual([
          ["releve_mensuel", 9, troisJours],
        ]);
      } finally {
        await restaurer();
      }
    });
  });

  // DÉFAUT V1-C-2 — la formation à cheval dont la mission a été acceptée à prix figé
  // n'est payée par AUCUN des deux moteurs (1 050 € en jeu dans cet exemple).
  test.fixme("V1-C-2 : à cheval avec une mission acceptée à prix figé, 1 050 € sont payés", async () => {
    await avecVerrouArgent(async () => {
      const restaurer = await semerInterrupteurs({
        ...bascule(BASCULE_2037),
        "formateurs.bilan_fin_formation": { actif: false },
      });
      try {
        const { f, s } = await formateurEtSession("Sacha", A_CHEVAL);
        await semerMissionAcceptee({ sessionId: s.id, trainerId: f.id, tarifHtCents: TARIF });
        await jouer([
          ...signerTout(f, s.id, A_CHEVAL),
          {
            etape: "passage",
            maintenant: "2037-10-07T06:15:00Z",
            dateBascule: BASCULE_2037,
            sessionIds: [s.id],
            retraitMd: "declare",
          },
          { etape: "run-mensuel", year: 2037, month: 9 },
          { etape: "run-mensuel", year: 2037, month: 10 },
        ]);
        expect(somme(await lignesVivantes(f.id, s.id))).toBe(honorairesAnimationCents(6, TARIF));
      } finally {
        await restaurer();
      }
    });
  });
});
