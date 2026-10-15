// @formateurs V2-A11 — « PAYER QUAND MÊME » le bilan de fin de formation.
//
// Le geste de l'administrateur lève l'attente du bilan pour UN formateur indépendant en
// nom propre, qui doit ce bilan (il anime la dernière journée), avec un motif. Il ne
// s'applique à personne d'autre : ni à un salarié, ni à l'intervenant d'un organisme, ni
// à un co-formateur qui n'anime pas la dernière journée (il n'attend rien) — sinon le
// geste laisserait une trace de « paiement forcé » sur une personne qui n'est pas payée
// par mission, ou que rien ne retenait.
//
// Session de juillet 2041 : B (indépendant) anime le 9, A (indépendant) le 10, dernière
// journée ; un salarié et l'intervenant d'un organisme sont aussi affectés.

import { expect, test } from "@playwright/test";

import { prisma } from "../fixtures/formateurs/base";
import { HORS_BANC } from "../fixtures/formateurs/argent-commun";
import { honorairesAnimationCents } from "../fixtures/formateurs/argent-contre-calcul";
import { jouer } from "../fixtures/formateurs/argent-execution";
import {
  relevesDe,
  semerFormateur,
  semerMissionAcceptee,
  semerSession,
} from "../fixtures/formateurs/argent-semis";
import { avecVerrouArgent } from "../fixtures/formateurs/argent-verrou";
import { jouerV2a } from "../fixtures/formateurs/v2a-execution";
import type { EtapeV2a } from "../fixtures/formateurs/v2a-protocole";
import { contresignerJournee, passageV2a, semerOrganisme } from "../fixtures/formateurs/v2a-semis";

const TARIF = 35_000;
const BILAN_ALLUME_LE = "2041-06-01T00:00:00.000Z";
const MOTIF = "Stagiaires partis avant la fin : évaluation finale impossible.";

test.describe("@formateurs V2-A11 — payer quand même", () => {
  test.setTimeout(600_000);
  test.skip(HORS_BANC, "hors du job banc-formateurs : ni file ni puits SMTP");

  test("refusé à qui ne doit pas de bilan ; motif obligatoire ; une fois ; lève l'attente du seul dernier mois", async () => {
    await avecVerrouArgent(async () => {
      const a = await semerFormateur({ prenom: "Achille", tarifJourneeHtCents: TARIF });
      const b = await semerFormateur({ prenom: "Berenice", tarifJourneeHtCents: TARIF });
      const salarie = await semerFormateur({ prenom: "Simone" });
      await prisma.trainer.update({ where: { id: salarie.id }, data: { statut: "salarie" } });
      const intervenant = await semerFormateur({ prenom: "Igor" });
      const o = await semerOrganisme();
      await prisma.trainer.update({
        where: { id: intervenant.id },
        data: { organismeSousTraitantId: o.id },
      });
      const s = await semerSession({
        jours: [
          { date: "2041-07-09", trainerId: b.id },
          { date: "2041-07-10", trainerId: a.id },
        ],
        formateurs: [a.id, b.id, salarie.id, intervenant.id],
        principal: a.id,
        statut: "realisee",
      });
      for (const f of [a, b])
        await semerMissionAcceptee({ sessionId: s.id, trainerId: f.id, tarifHtCents: TARIF });

      const p = (m: string) => passageV2a(m, [s.id], { bilanAllumeLe: BILAN_ALLUME_LE });
      const avant = await jouer([
        ...contresignerJournee(s.id, b, "2041-07-09"),
        ...contresignerJournee(s.id, a, "2041-07-10"),
        p("2041-07-11T07:15:00Z"),
      ]);
      // B ne remet pas le bilan : payé sur ses feuilles ; A attend son bilan.
      expect(avant[4]).toMatchObject({ etat: "fait", ecrits: 1, enAttente: 1 });

      const geste = (trainerId: string, motif = MOTIF): EtapeV2a => ({
        etape: "payer-quand-meme",
        bilanAllumeLe: BILAN_ALLUME_LE,
        sessionId: s.id,
        trainerId,
        motif,
        maintenant: "2041-07-25T09:00:00Z",
      });
      const issues = await jouerV2a([
        geste(salarie.id),
        geste(intervenant.id),
        geste(b.id),
        geste(a.id, "   bref   "),
        geste(a.id),
        geste(a.id),
      ]);
      expect(issues).toEqual([
        "non_concerne",
        "non_concerne",
        "non_concerne",
        "motif_invalide",
        "ok",
        "deja_fait",
      ]);
      // Aucune trace de « paiement forcé » pour qui n'était pas concerné.
      const lignes = await prisma.bilanFinFormation.findMany({
        where: { sessionId: s.id, payerQuandMemeAt: { not: null } },
        select: { trainerId: true, payerQuandMemeMotif: true },
      });
      expect(lignes).toEqual([{ trainerId: a.id, payerQuandMemeMotif: MOTIF }]);

      // L'attente levée : le dernier mois de A est écrit au passage suivant, une fois.
      const apres = await jouer([p("2041-07-26T07:15:00Z"), p("2041-07-27T07:15:00Z")]);
      expect(apres[0]).toMatchObject({ etat: "fait", ecrits: 1, enAttente: 0 });
      expect(apres[1]).toMatchObject({ etat: "fait", ecrits: 0, dejaEcrits: 2 });
      for (const f of [a, b])
        expect((await relevesDe(f.id)).map((r) => [r.statut, r.totalHtCents])).toEqual([
          ["a_valider", honorairesAnimationCents(2, TARIF)],
        ]);
      for (const f of [salarie, intervenant]) expect(await relevesDe(f.id)).toEqual([]);
    });
  });
});
