// @formateurs V2-A5 — RANG 2 APRÈS DÉSISTEMENT : le premier choix s'est désisté avant la
// formation, le deuxième l'anime. Qui est payé, et qui est relancé ?
//
// L'état de départ est celui que laisse le désistement (`desisterMission`,
// formateurs-independants/choix-formateur-service.ts ~l. 745-760) : la mission du premier
// passe `desistee` (son prix figé reste lisible), son affectation et son rôle de principal
// sont retirés. ÉCART : cet état est semé, pas produit par le geste (il exige les textes,
// la file du rang suivant et l'interrupteur `rang_suivant`, hors du sujet argent).
//
// (a) Journées SANS formateur désigné : le rang 2 est payé de ses deux journées, une fois ;
//     le désisté n'a rien, ni relevé, ni relance de feuilles, ni alerte.
//
// DÉFAUT V2-A-4 (test.fixme) — (b) journées DÉSIGNÉES au premier choix (`SessionJour.trainerId`,
// la co-animation ou un planning nominatif) : le désistement ne retire que l'affectation,
// jamais la désignation des journées (aucun code n'écrit `sessionJour.trainerId` hors de la
// console). Le rang 2, qui anime et contresigne, n'a alors AUCUNE journée « prévue »
// (`journeesDuFormateur`, argent/journees-du-formateur.ts ~l. 20) : le passage écarte ses
// signatures (`prevu_absent`, paiement/passage-mission.ts ~l. 220) et ne le paie jamais ;
// le désisté, lui, garde des journées prévues sans signature (sa mission `desistee` reste
// lue, paiement/passage-mission-base.ts ~l. 19) : F35 lui réclame des feuilles pour des
// journées qu'il n'a pas animées, puis les alertes internes J+10 et J+20.

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
import { BASCULE_V2A, contresignerJournee, passageV2a } from "../fixtures/formateurs/v2a-semis";

const TARIF_1 = 36_000;
const TARIF_2 = 39_000;
const F35 = "formateur-feuilles-manquantes";

async function apresDesistement(designees: boolean, jours: readonly [string, string]) {
  const r1 = await semerFormateur({ prenom: "Rodolphe", tarifJourneeHtCents: TARIF_1 });
  const r2 = await semerFormateur({ prenom: "Rosalie", tarifJourneeHtCents: TARIF_2 });
  const s = await semerSession({
    jours: jours.map((date) => (designees ? { date, trainerId: r1.id } : { date })),
    // Après le désistement : seul le rang 2 est affecté, et principal.
    formateurs: [r2.id],
    principal: r2.id,
    statut: "realisee",
  });
  const m1 = await semerMissionAcceptee({
    sessionId: s.id,
    trainerId: r1.id,
    tarifHtCents: TARIF_1,
  });
  await prisma.missionFormateur.update({
    where: { id: m1 },
    data: { statut: "desistee", desisteAt: new Date(`${jours[0]}T00:00:00Z`) } as never,
  });
  await semerMissionAcceptee({ sessionId: s.id, trainerId: r2.id, tarifHtCents: TARIF_2 });
  const lendemain = (n: number) => {
    const d = new Date(`${jours[1]}T07:15:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString();
  };
  const sorties = await jouer([
    ...contresignerJournee(s.id, r2, jours[0]),
    ...contresignerJournee(s.id, r2, jours[1]),
    passageV2a(lendemain(1), [s.id]),
    passageV2a(lendemain(2), [s.id]),
    // J+4 puis J+11 : F35 (texte validé le temps de l'étape) et l'alerte interne J+10.
    { etape: "suivi", maintenant: lendemain(4), bascule: BASCULE_V2A, textes: [F35] },
    { etape: "suivi", maintenant: lendemain(11), bascule: BASCULE_V2A, textes: [F35] },
  ]);
  for (const r of sorties.slice(0, 4)) expect(r).toMatchObject({ ok: true });
  return { r1, r2, s, passages: sorties.slice(4, 6) };
}

/** Ce que le désisté a reçu ou déclenché : F35, alertes de feuilles au journal. */
async function relancesDe(trainerId: string, email: string) {
  const [f35, alertes] = await Promise.all([
    prisma.emailLog.count({ where: { recipient: email, template: F35 } }),
    prisma.activityLog.count({
      where: { targetId: trainerId, action: { startsWith: "qualiopi.formateur.feuilles_alerte" } },
    }),
  ]);
  return { f35, alertes };
}

test.describe("@formateurs V2-A5 — rang 2 après désistement", () => {
  test.setTimeout(900_000);
  test.skip(HORS_BANC, "hors du job banc-formateurs : ni file ni puits SMTP");

  test("(a) journées sans désignation : le rang 2 payé une fois, le désisté ni payé ni relancé", async () => {
    await avecVerrouArgent(async () => {
      const { r1, r2, passages } = await apresDesistement(false, ["2040-12-10", "2040-12-11"]);
      expect(passages[0]).toMatchObject({ etat: "fait", ecrits: 1, anomalies: [] });
      expect(passages[1]).toMatchObject({ etat: "fait", ecrits: 0, dejaEcrits: 1 });
      expect((await relevesDe(r2.id)).map((r) => [r.statut, r.totalHtCents])).toEqual([
        ["a_valider", honorairesAnimationCents(4, TARIF_2)],
      ]);
      expect(await relevesDe(r1.id)).toEqual([]);
      expect(await relancesDe(r1.id, r1.email)).toEqual({ f35: 0, alertes: 0 });
    });
  });

  // DÉFAUT V2-A-4 — journées désignées au désisté : le rang 2 n'est jamais payé, le désisté est relancé.
  test.fixme("V2-A-4 : (b) journées désignées au désisté — le rang 2 est payé, le désisté n'est pas relancé", async () => {
    await avecVerrouArgent(async () => {
      const { r1, r2 } = await apresDesistement(true, ["2041-01-14", "2041-01-15"]);
      expect((await relevesDe(r2.id)).map((r) => [r.statut, r.totalHtCents])).toEqual([
        ["a_valider", honorairesAnimationCents(4, TARIF_2)],
      ]);
      expect(await relancesDe(r1.id, r1.email)).toEqual({ f35: 0, alertes: 0 });
    });
  });
});
