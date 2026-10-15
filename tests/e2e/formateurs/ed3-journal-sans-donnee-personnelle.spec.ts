// @formateurs E-D3 (correction du 14/10) — Le journal d'activité ne porte
// aucune valeur personnelle (nom, prénom, e-mail, téléphone, adresse, IBAN).
//
// Une fiche vit par les vrais gestes de la console et de l'espace du formateur
// (dossier rempli, demande de changement d'adresse, pièce saisie, changement
// d'e-mail, activation, fin de collaboration, effacement RGPD) ; chaque ligne
// du journal écrite pendant ce temps pour cette fiche ou ces administrateurs
// est relue, et aucune valeur semée ne doit s'y trouver — ni rien qui
// ressemble à une adresse e-mail ou à un numéro de téléphone.

import { expect, test } from "@playwright/test";

import { prisma } from "../fixtures/formateurs/base";
import { executerScenarioSecurite } from "../fixtures/formateurs/securite-execution";

interface Observations {
  gestes: Record<string, string>;
  lignes: Array<{ action: string; targetType: string | null; changes: unknown }>;
  personnelles: Record<string, string>;
}

const RESSEMBLE_A_UN_EMAIL = /[^\s"@]+@[^\s"@]+\.[a-z]{2,}/i;
const RESSEMBLE_A_UN_TELEPHONE = /(?:\+33|\b0)[1-9](?:[ .-]?\d{2}){4}\b/;

test.describe("@formateurs E-D3 — journal d'activité sans donnée personnelle", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(240_000);

  let o: Observations;

  test.beforeAll(async () => {
    test.setTimeout(240_000);
    o = await executerScenarioSecurite<Observations>("ed3-journal-sans-donnee-personnelle", {});
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("témoin : les gestes ont bien eu lieu, et le journal les a suivis", () => {
    expect(JSON.parse(o.gestes["dossier_vous"] ?? "null")).toEqual({ ok: true });
    expect(o.gestes["demande_adresse"]).toContain("issue=demande");
    expect(JSON.parse(o.gestes["changer_email"] ?? "{}")).toHaveProperty("data");
    expect(JSON.parse(o.gestes["activer"] ?? "{}")).toHaveProperty("data");
    expect(JSON.parse(o.gestes["rgpd"] ?? "{}")).toMatchObject({ ok: true });
    const actions = o.lignes.map((l) => l.action);
    for (const a of [
      "qualiopi.formateur.changement_demande",
      "qualiopi.trainer_document.create",
      "qualiopi.trainer.update",
      "qualiopi.trainer.activation",
      "qualiopi.trainer.fin_collaboration_decidee",
      "qualiopi.trainer.rgpd_effacement",
    ]) {
      expect(actions, a).toContain(a);
    }
  });

  test("aucune valeur semée n'apparaît dans le journal", () => {
    for (const l of o.lignes) {
      const texte = JSON.stringify(l.changes);
      for (const [quoi, valeur] of Object.entries(o.personnelles)) {
        expect(texte, `${l.action} contient ${quoi}`).not.toContain(valeur);
      }
    }
  });

  test("rien qui ressemble à un e-mail ou à un téléphone", () => {
    for (const l of o.lignes) {
      const texte = JSON.stringify(l.changes);
      expect(texte, l.action).not.toMatch(RESSEMBLE_A_UN_EMAIL);
      expect(texte, l.action).not.toMatch(RESSEMBLE_A_UN_TELEPHONE);
    }
  });
});
