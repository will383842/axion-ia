// @formateurs E29 — Un éditeur tente les gestes qui engagent : tout est refusé.
//
// Sous une session `editor` réelle, par les ACTIONS de la console : activer un
// indépendant (trois portes), ajouter puis valider une pièce de garde, valider
// ou approuver un texte `formateur-*` (et l'interrupteur des textes), cliquer
// « Retenu », créer la fiche depuis une candidature, changer l'e-mail d'un
// indépendant. Rien ne doit avoir bougé en base.
//
// Écart E29 (vérification n° 1) CORRIGÉ : AJOUTER une pièce de garde est refusé
// à l'éditeur, comme la valider (`createTrainerDocumentAction`, droit
// `habiliter_formateur`). La pièce que la validation éprouve est posée par le
// banc ; elle reste « en attente ».

import { expect, test } from "@playwright/test";

import { prisma } from "../fixtures/formateurs/base";
import { executerScenarioSecurite } from "../fixtures/formateurs/securite-execution";

const HAB =
  "Habiliter un formateur engage la qualité de l'action (ind. 21/22) : acte réservé à la direction ou au responsable qualité.";
const TEXTES = "Valider les textes des e-mails est réservé à la direction (super-admin).";

interface Observations {
  reponses: Record<string, unknown>;
  avant: { email: string };
  apres: { actif: boolean; email: string; accesVersion: number };
  pieceApres: Array<{ type: string; statutValidation: string }>;
  texteInchange: boolean;
  interrupteurTextes: unknown;
  fichesCreees: number;
}

test.describe("@formateurs E29 — l'éditeur est refusé partout", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(240_000);

  let o: Observations;

  test.beforeAll(async () => {
    test.setTimeout(240_000);
    o = await executerScenarioSecurite<Observations>("e29-editeur", {});
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("activer : refusé par les trois portes, la fiche reste inactive", () => {
    expect(o.reponses["activer_fiche"]).toEqual({ error: `Activation refusée : ${HAB}` });
    expect(o.reponses["activer_coaching"]).toEqual({
      ok: false,
      error: `Activation refusée : ${HAB}`,
    });
    expect(o.reponses["contresigner"]).toEqual({ leve: `forbidden: ${HAB}` });
    expect(o.apres.actif).toBe(false);
  });

  test("pièce de garde : ajout et validation refusés, la pièce reste « en attente »", () => {
    expect(o.reponses["valider_piece"]).toEqual({ leve: `forbidden: ${HAB}` });
    expect(o.reponses["ajouter_piece"]).toEqual({ error: `Ajout refusé : ${HAB}` });
    expect(o.pieceApres).toEqual([
      { type: "attestation_vigilance_urssaf", statutValidation: "en_attente" },
    ]);
  });

  test("textes formateur-* : ni validés, ni approuvés en bloc, ni interrupteur", () => {
    expect(o.reponses["valider_texte"]).toEqual({ ok: false, error: TEXTES });
    expect(o.reponses["valider_texte_formulaire"]).toEqual({ ok: false, error: TEXTES });
    expect(o.reponses["approuver_tous"]).toEqual({ ok: false, error: TEXTES });
    expect(o.reponses["interrupteur_textes"]).toEqual({ ok: false, error: TEXTES });
    expect(o.texteInchange).toBe(true);
  });

  test("« Retenu » et la fiche depuis la candidature : refusés", () => {
    expect(o.reponses["retenu"]).toEqual({
      etat: "erreur",
      message: "« Retenu » est réservé à l'administrateur : il ouvre la fiche formateur.",
    });
    expect(o.reponses["fiche_depuis_candidature"]).toMatchObject({
      ok: false,
      erreur: "non-autorise",
    });
  });

  test("changer l'e-mail d'un indépendant : refusé, rien n'a bougé", () => {
    expect(o.reponses["changer_email"]).toEqual({ error: `Changement d'adresse refusé : ${HAB}` });
    expect(o.apres).toEqual({ actif: false, email: o.avant.email, accesVersion: 0 });
    expect(o.fichesCreees).toBe(0);
  });
});
