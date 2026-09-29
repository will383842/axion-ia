// @vitest-environment node
/**
 * ⛔ La question « quelle entreprise ? » du formulaire Calendly a UNE règle.
 *
 * La carte « à venir » de l'onglet Rendez-vous, le rattachement proposé du
 * dossier client et la reprise de l'historique la lisent tous par
 * `admin-rendezvous/a-venir.ts`. Avec trois règles différentes, une question
 * « Nom de votre organisation » affichait une entreprise sur la carte, mais
 * le rattachement ne proposait rien et la reprise en faisait un fait
 * « autre » (réponse d'identité rangée comme une parole).
 *
 * Mutation qui fait rougir : rétablir dans `rencontre-calendly.ts` ou
 * `reprise-historique.ts` une regex propre → le test de lecture du code
 * rougit ; retirer « organisation » de `estQuestionEntreprise` → le premier
 * test rougit.
 * Contre-témoin : « Ville de l'entreprise » n'est pas le nom de l'entreprise.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  entrepriseDeclaree,
  entrepriseEtBesoin,
  reponsesFormulaire,
} from "@/features/admin-rendezvous/a-venir";
import { assurerRencontrePourCalendly } from "../rencontre-calendly";
import { reprendreHistoriqueCalendly, typeDeLaReponse } from "../reprise-historique";
import { CLE_TEST, dossierEnMemoire, fiche, rendezVousCalendly } from "./_dossier-en-memoire";

const CLE_INITIALE = process.env["PII_ENCRYPTION_KEY"];
beforeEach(() => {
  process.env["PII_ENCRYPTION_KEY"] = CLE_TEST;
});
afterEach(() => {
  if (CLE_INITIALE === undefined) delete process.env["PII_ENCRYPTION_KEY"];
  else process.env["PII_ENCRYPTION_KEY"] = CLE_INITIALE;
});

const CHARGE = {
  invitee: {
    questions_and_answers: [
      { question: "Ville de l'entreprise", answer: "Lyon" },
      { question: "Nom de votre organisation", answer: "Menuiserie Fictive" },
      { question: "Votre besoin", answer: "Former l'équipe" },
    ],
  },
};

describe("⛔ la question entreprise a une seule règle", () => {
  it("la carte, le rattachement et la reprise voient la même entreprise", async () => {
    // La carte « à venir ».
    expect(entrepriseEtBesoin(reponsesFormulaire(CHARGE)).entreprise).toBe("Menuiserie Fictive");
    // Le dossier client.
    expect(entrepriseDeclaree(CHARGE)).toEqual({ nom: "Menuiserie Fictive", ville: "Lyon" });
    // La reprise : l'identité n'est pas un fait.
    expect(typeDeLaReponse("Nom de votre organisation")).toBeNull();
    expect(typeDeLaReponse("Ville de l'entreprise")).toBeNull();
    expect(typeDeLaReponse("Votre besoin")).toBe("besoin");

    // Le rattachement proposé.
    const f = fiche({ raisonSociale: "Menuiserie Fictive SARL" });
    const ev = rendezVousCalendly({
      inviteeEmail: "quelquun.fictif@gmail.com",
      rawPayload: CHARGE,
    });
    const base = dossierEnMemoire({ client: [f], calendlyEvent: [ev] });
    await assurerRencontrePourCalendly(base.client as never, ev["id"] as string, {
      borne: new Date("2026-10-01T00:00:00Z"),
    });
    expect(base.tables["rencontre"]?.[0]?.["motifProposition"]).toBe("entreprise_declaree");
  });

  it("contre-témoin : la ville, placée AVANT le nom, n'est jamais prise pour l'entreprise", async () => {
    const ev = rendezVousCalendly({
      startTime: new Date("2026-09-10T08:00:00Z"),
      rawPayload: CHARGE,
    });
    const base = dossierEnMemoire({ calendlyEvent: [ev] });
    await reprendreHistoriqueCalendly(base.client as never, {
      appliquer: true,
      maintenant: new Date("2026-09-30T09:00:00Z"),
    });
    // Seul le besoin devient un fait.
    expect((base.tables["fait"] ?? []).map((x) => x["type"])).toEqual(["besoin"]);
  });

  it("aucune autre règle n'est écrite dans le dossier client (lecture du code)", () => {
    for (const fichier of [
      "src/features/dossier-client/rencontre-calendly.ts",
      "src/features/dossier-client/reprise-historique.ts",
      "src/features/dossier-client/queries-rencontres.ts",
    ]) {
      const src = readFileSync(join(process.cwd(), fichier), "utf8");
      expect(src, fichier).not.toMatch(/soci\[ée\]t\[ée\]|t\[ée\]l\[ée\]phone|\/ville\/i/);
      expect(src, fichier).not.toMatch(
        /["'](questions_and_answers|event_guests|event_memberships)["']/,
      );
    }
  });
});
