/** Garde-fou (fiche L10) : la demande de contresignature ne parle d'aucun financeur. */
import { describe, expect, it } from "vitest";
import { renderEmailTemplate } from "./index";

const INTERDIT = /financeur|funding|opco|qualiopi|prise en charge/i;

describe("formateur-contresignature — rien sur le financement", () => {
  for (const locale of ["fr", "en"] as const) {
    for (const dernierRappel of [false, true]) {
      it(`${locale} · dernierRappel=${dernierRappel}`, async () => {
        const r = await renderEmailTemplate("formateur-contresignature", locale, {
          formateurPrenomNom: "Camille Dupont",
          titreFormation: "IA pour bien commencer",
          numeroSession: "AXI-SESS-2026-042",
          demiJournees: ["mercredi 16 septembre 2026 — matin"],
          lienEspace: "https://axion-ia.com/fr/espace-formateur/sessions/abc#emargement",
          rangRappel: dernierRappel ? 2 : 0,
          dernierRappel,
        });
        for (const texte of [r.subject, r.text, r.html]) expect(texte).not.toMatch(INTERDIT);
        expect(r.text).toMatch(/en plus de celle des stagiaires/);
      });
    }
  }
});
