import { describe, expect, it } from "vitest";

import { renderEmailTemplate } from "../index";

describe("accusé de réception — le lien de dépôt des montages (2026-09-29)", () => {
  it("🔴 métiers de l'image : le bouton « Déposer mes montages » mène à la page personnelle", async () => {
    const r = await renderEmailTemplate("candidature-recue", "fr", {
      contactName: "Léa",
      offerTitle: "Monteur vidéo freelance (F/H)",
      lienDepot: "https://axion-ia.com/fr/completer-ma-candidature?jeton=abc",
    });
    expect(r.html).toContain("Déposer mes montages");
    expect(r.html).toContain("completer-ma-candidature?jeton=abc");
    expect(r.text).toContain("1 à 3 de vos meilleurs montages");
  });

  it("autres postes : ni bouton ni paragraphe de dépôt", async () => {
    const r = await renderEmailTemplate("candidature-recue", "fr", {
      contactName: "Léa",
      offerTitle: "Data Scientist",
    });
    expect(r.html).not.toContain("Déposer mes montages");
    expect(r.text).not.toContain("montages");
  });
});
