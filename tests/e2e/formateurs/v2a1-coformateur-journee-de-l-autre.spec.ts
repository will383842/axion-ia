// @formateurs V2-A1 — DOUBLE PAIEMENT en co-animation : un co-formateur contresigne
// AUSSI la journée désignée à l'autre (le même mois).
//
// Session de deux journées en mars 2040 : le 12 désigné à A, le 13 désigné à B, chacun à
// 350 €/j, prix figé sur sa mission. Les deux sont membres de la session : l'espace du
// formateur ne vérifie que l'appartenance à la session (`contresignerDemiJourneeAction`),
// pas la journée désignée. A contresigne le 12 ET le 13 ; B contresigne le 13.
// Attendu : chacun payé de SES journées — 350 € à A, 350 € à B, 700 € pour deux journées.
//
// DÉFAUT V2-A-1 (corrigé, ex-test.fixme) : le passage paie à A TOUTES ses demi-journées signées du mois
// (`calculerReleveDuMois(mois…)` sur les signées, paiement/passage-mission.ts ~l. 260),
// y compris celles de la journée désignée à B : 700 € à A, 350 € à B, la journée du 13
// payée deux fois. Seul un mois SANS journée prévue est écarté (`prevu_absent`) ; dans un
// mois qui en compte une, le surplus n'est qu'une anomalie « écart » affichée sur un
// relevé à valider.

import { expect, test } from "@playwright/test";

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
import { contresignerJournee, passageV2a } from "../fixtures/formateurs/v2a-semis";

const TARIF = 35_000;

async function coAnimation() {
  const a = await semerFormateur({ prenom: "Aurele", tarifJourneeHtCents: TARIF });
  const b = await semerFormateur({ prenom: "Blandine", tarifJourneeHtCents: TARIF });
  const s = await semerSession({
    jours: [
      { date: "2040-03-12", trainerId: a.id },
      { date: "2040-03-13", trainerId: b.id },
    ],
    formateurs: [a.id, b.id],
    principal: a.id,
    statut: "realisee",
  });
  for (const f of [a, b])
    await semerMissionAcceptee({ sessionId: s.id, trainerId: f.id, tarifHtCents: TARIF });
  const sorties = await jouer([
    ...contresignerJournee(s.id, a, "2040-03-12"),
    // A contresigne aussi la journée désignée à B (il est membre de la session).
    ...contresignerJournee(s.id, a, "2040-03-13"),
    ...contresignerJournee(s.id, b, "2040-03-13"),
    passageV2a("2040-03-14T07:15:00Z", [s.id]),
    passageV2a("2040-03-15T07:15:00Z", [s.id]),
  ]);
  // V2-A-1 corrigé : A ne peut plus contresigner la journée désignée à B (refus, rien
  // d'écrit) ; ses propres signatures et celles de B passent.
  for (const i of [0, 1, 4, 5]) expect(sorties[i]).toMatchObject({ ok: true });
  for (const i of [2, 3])
    expect(sorties[i]).toMatchObject({ ok: false, raison: "journee_d_un_autre" });
  return { a, b, s, passages: sorties.slice(6) };
}

test.describe("@formateurs V2-A1 — co-formateur qui signe la journée de l'autre", () => {
  test.setTimeout(600_000);
  test.skip(HORS_BANC, "hors du job banc-formateurs : ni file ni puits SMTP");

  test("B est payé de SA journée, une fois ; un second passage n'écrit rien", async () => {
    await avecVerrouArgent(async () => {
      const { b, passages } = await coAnimation();
      expect(passages[0]).toMatchObject({ etat: "fait", ecrits: 2, erreurs: 0 });
      expect(passages[1]).toMatchObject({ etat: "fait", ecrits: 0, dejaEcrits: 2, erreurs: 0 });
      const releves = await relevesDe(b.id);
      expect(releves.map((r) => [r.statut, r.totalHtCents])).toEqual([
        ["a_valider", honorairesAnimationCents(2, TARIF)],
      ]);
    });
  });

  // DÉFAUT V2-A-1 — la journée désignée à B est aussi payée à A.
  test("V2-A-1 : A n'est payé que de SA journée (la journée de B n'est pas payée deux fois)", async () => {
    await avecVerrouArgent(async () => {
      const { a, b } = await coAnimation();
      const [ra] = await relevesDe(a.id);
      const [rb] = await relevesDe(b.id);
      expect(ra!.totalHtCents).toBe(honorairesAnimationCents(2, TARIF));
      // Deux journées animées, deux journées payées : jamais trois.
      expect(ra!.totalHtCents + rb!.totalHtCents).toBe(honorairesAnimationCents(4, TARIF));
    });
  });
});
