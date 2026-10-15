// @formateurs E-D6 (correction du 14/10) — « Vérifier et contresigner » refuse
// un dossier qui n'a pas été envoyé par le formateur.
//
// Contrôle clé : un dossier « en cours de saisie » ou « à compléter » est
// refusé, avec le motif dit en clair, et rien n'est écrit (fiche inactive,
// contrat toujours partiel). Témoin : un dossier « à vérifier » ne reçoit PAS
// ce motif (il est refusé pour ses autres manques).
//
// ÉCARTS consignés (le code de main fait foi) :
//   · la règle (`dossierAContresigner`) refuse « en cours » et « à compléter »,
//     mais laisse passer « vérifié » (reprise, contrat ré-émis) et une fiche
//     sans dossier en ligne (créée en console) — choix écrit dans le code ;
//   · l'écran exige `activation_auto`, que la console refuse d'allumer (préalable
//     `contrat_auto` non lisible) : en production il est FERMÉ. Le banc le
//     constate, puis pose la ligne directement pour éprouver la règle.

import { expect, test } from "@playwright/test";

import { prisma } from "../fixtures/formateurs/base";
import { executerScenarioSecurite } from "../fixtures/formateurs/securite-execution";

const MOTIF =
  "Pour contresigner, il manque : un dossier envoyé par le formateur (il est encore en cours de saisie, ou un complément lui a été demandé).";

interface Observations {
  consoleActivationAuto: { ok: boolean; error?: string };
  ecranFerme: { ok: boolean; error?: string };
  reponses: Record<string, { ok: boolean; error?: string }>;
  apres: Array<{ id: string; actif: boolean; dossierStatut: string }>;
  contrats: Array<{ statutSignature: string }>;
}

test.describe("@formateurs E-D6 — contresigner exige un dossier envoyé", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(240_000);

  let o: Observations;

  test.beforeAll(async () => {
    test.setTimeout(240_000);
    o = await executerScenarioSecurite<Observations>("ed6-contresigner-hors-a-verifier", {});
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("ÉCART constaté : l'écran est fermé, la console ne sait pas l'ouvrir", () => {
    expect(o.consoleActivationAuto.ok).toBe(false);
    expect(o.ecranFerme).toEqual({
      ok: false,
      error: "Cet écran n'est pas encore ouvert (interrupteur « Activation automatique » coupé).",
    });
  });

  test("« en cours » et « à compléter » : refusés avec le motif", () => {
    expect(o.reponses["en_cours"]).toEqual({ ok: false, error: MOTIF });
    expect(o.reponses["a_completer"]).toEqual({ ok: false, error: MOTIF });
  });

  test("témoin « à vérifier » : pas ce motif-là", () => {
    expect(o.reponses["a_verifier"]?.ok).toBe(false);
    expect(o.reponses["a_verifier"]?.error).not.toContain("un dossier envoyé par le formateur");
  });

  test("rien n'est écrit", () => {
    expect(o.apres.every((t) => !t.actif)).toBe(true);
    expect(o.contrats.map((c) => c.statutSignature)).toEqual([
      "partielle",
      "partielle",
      "partielle",
    ]);
  });
});
