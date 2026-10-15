// @formateurs E19 — Accord par téléphone (« accord hors outil » consigné en console)
// → le formateur reçoit sa convocation à J-7 et son rappel à J-1.
//
// Les deux passages (`formation-crons.formateur-convocation-j7` et
// `…-rappel-j1`) sélectionnent par ÉTAT, contre l'heure RÉELLE (le code ne prend
// pas d'instant en paramètre) : les sessions du scénario sont donc placées dans
// leurs fenêtres réelles — S1 dans 5 jours (fenêtre J-7 : 7,5 jours), S2 demain
// (fenêtre J-1 : 36 heures). Le banc appelle le gestionnaire même du worker.
//
// Règle anti-doublon du code : une fois le rappel J-1 parti, la convocation J-7
// ne part plus pour la même affectation (deux « infos pratiques » le même jour ne
// renseignent qu'une fois).

import { expect, test } from "@playwright/test";

import { prisma } from "../fixtures/formateurs/base";
import {
  creerFormateurPret,
  creerSession,
  envoisVers,
} from "../fixtures/formateurs/missions-donnees";
import { choisir, derniereMission, M, type Resultat } from "../fixtures/formateurs/missions-gestes";
import { ATTENTE_FILE, cadreScenario } from "../fixtures/formateurs/missions-scenario";

const sc = cadreScenario("e19");
const CRONS = "@/server/queue/workers/qualiopi-formation-crons-worker";
const MOTIF = "Accord donné par téléphone le matin même, confirmé de vive voix (banc).";

async function accordParTelephone(sessionId: string, trainerId: string): Promise<string> {
  const { pilote, monde } = sc;
  const c = await choisir(pilote, monde, sessionId, [{ trainerId }]);
  expect(c, JSON.stringify(c)).toEqual({
    data: expect.objectContaining({ missionProposee: true }),
  });
  const r = await pilote.appeler<Resultat<{ missionId: string }>>(
    M.mission,
    "consignerAccordHorsOutilAction",
    [{ sessionId, trainerId, motif: MOTIF }],
    sc.console(),
  );
  expect(r, JSON.stringify(r)).toEqual({
    data: expect.objectContaining({ missionId: expect.any(String) }),
  });
  return (r as { data: { missionId: string } }).data.missionId;
}

function passage(type: "formateur-convocation-j7" | "formateur-rappel-j1") {
  return sc.pilote.appeler(CRONS, "formationCronsHandler", [
    { type: `formation-crons.${type}`, tick: Date.now() },
  ]);
}

async function traces(sessionId: string, trainerId: string) {
  return prisma.sessionFormateur.findUniqueOrThrow({
    where: { sessionId_trainerId: { sessionId, trainerId } },
    select: { convocationJ7EnvoyeeAt: true, rappelJ1EnvoyeAt: true },
  });
}

test.describe("@formateurs E19 — accord par téléphone, convocation J-7, rappel J-1", () => {
  test.setTimeout(240_000);

  test("l'accord hors outil vaut accord : J-7 puis J-1 partent, une fois chacun", async () => {
    const { monde } = sc;
    const a = await creerFormateurPret(monde, { prenom: "Noemie" });
    const s1 = await creerSession(monde, { dansJours: 5 });
    const s2 = await creerSession(monde, { dansJours: 1 });
    const m1 = await accordParTelephone(s1.id, a.id);
    const m2 = await accordParTelephone(s2.id, a.id);
    for (const id of [m1, m2]) {
      const m = await prisma.missionFormateur.findUniqueOrThrow({
        where: { id },
        select: { statut: true, accordHorsOutilMotif: true, accordHorsOutilParId: true },
      });
      expect(m).toEqual({
        statut: "accord_hors_outil",
        accordHorsOutilMotif: MOTIF,
        accordHorsOutilParId: monde.admin.id,
      });
    }
    expect((await derniereMission(s1.id, a.id)).id).toBe(m1);

    // J-1 d'abord (S2 est demain), puis J-7 (S1 est dans 5 jours) — deux fois chacun.
    await passage("formateur-rappel-j1");
    await passage("formateur-rappel-j1");
    await passage("formateur-convocation-j7");
    await passage("formateur-convocation-j7");

    const t1 = await traces(s1.id, a.id);
    const t2 = await traces(s2.id, a.id);
    expect(t1.convocationJ7EnvoyeeAt).not.toBeNull();
    expect(t1.rappelJ1EnvoyeAt).toBeNull(); // S1 est hors de la fenêtre J-1
    expect(t2.rappelJ1EnvoyeAt).not.toBeNull();
    expect(t2.convocationJ7EnvoyeeAt).toBeNull(); // le rappel est parti : pas de doublon

    await expect
      .poll(
        async () => (await envoisVers(a.email, "formateur-convocation-j7")).length,
        ATTENTE_FILE,
      )
      .toBe(1);
    expect(await envoisVers(a.email, "formateur-rappel-j1")).toHaveLength(1);
  });
});
