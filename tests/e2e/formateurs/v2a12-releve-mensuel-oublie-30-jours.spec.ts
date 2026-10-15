// @formateurs V2-A12 — le RELEVÉ MENSUEL OUBLIÉ plus de 30 jours.
//
// Un freelance encore au régime mensuel (bascule au 01/10/2041) anime les 16 et 17
// septembre 2041. Personne ne lance le calcul de septembre. Le suivi quotidien le dit à
// J+5 (V1-C-3). Puis octobre passe, toujours sans calcul : le 6 novembre, septembre n'est
// toujours pas calculé — rien n'est payé, et le délai légal de paiement court.
// Attendu : l'oubli reste signalé tant que le mois n'est pas calculé, pas seulement le
// mois qui suit.
//
// DÉFAUT V2-A-8 (test.fixme) : les deux alertes du suivi (« calcul non lancé » et
// « relevé non validé ») ne regardent que le MOIS ÉCOULÉ (`moisEcoule`, paiement/
// suivi-mission.ts ~l. 135 et ~l. 152) : dès le 1er du mois suivant, un mois oublié
// sort de toute surveillance, en silence — au moment même où il dépasse 30 jours.

import { expect, test } from "@playwright/test";

import { HORS_BANC } from "../fixtures/formateurs/argent-commun";
import { jouer } from "../fixtures/formateurs/argent-execution";
import { relevesDe, semerFormateur, semerSession } from "../fixtures/formateurs/argent-semis";
import { avecVerrouArgent } from "../fixtures/formateurs/argent-verrou";

const D = "2041-10-01";

interface Suivi {
  etat: string;
  relevesNonLances: number;
  alerteNonValides: number;
}

async function freelanceDeSeptembre() {
  const f = await semerFormateur({
    prenom: "Oriane",
    tarifJourneeHtCents: 35_000,
    activationValideeAt: new Date("2041-06-01T10:00:00Z"),
  });
  await semerSession({
    jours: [
      { date: "2041-09-16", trainerId: f.id },
      { date: "2041-09-17", trainerId: f.id },
    ],
    formateurs: [f.id],
    statut: "realisee",
  });
  return f;
}

test.describe("@formateurs V2-A12 — relevé mensuel oublié plus de 30 jours", () => {
  test.setTimeout(600_000);
  test.skip(HORS_BANC, "hors du job banc-formateurs : ni file ni puits SMTP");

  test("à J+5, l'oubli du calcul de septembre est signalé ; rien n'est calculé seul", async () => {
    await avecVerrouArgent(async () => {
      const f = await freelanceDeSeptembre();
      const [j5] = (await jouer([
        { etape: "suivi", maintenant: "2041-10-06T07:15:00Z", bascule: D },
      ])) as [Suivi];
      expect(j5.etat).toBe("fait");
      expect(j5.relevesNonLances).toBeGreaterThanOrEqual(1);
      expect(await relevesDe(f.id)).toEqual([]);
    });
  });

  // DÉFAUT V2-A-8 — passé le mois suivant, le mois oublié n'est plus signalé.
  test.fixme("V2-A-8 : le 6 novembre, septembre toujours pas calculé est encore signalé", async () => {
    await avecVerrouArgent(async () => {
      const f = await freelanceDeSeptembre();
      const [j36] = (await jouer([
        { etape: "suivi", maintenant: "2041-11-06T07:15:00Z", bascule: D },
      ])) as [Suivi];
      expect(j36.etat).toBe("fait");
      expect(await relevesDe(f.id)).toEqual([]);
      expect(j36.relevesNonLances).toBeGreaterThanOrEqual(1);
    });
  });
});
