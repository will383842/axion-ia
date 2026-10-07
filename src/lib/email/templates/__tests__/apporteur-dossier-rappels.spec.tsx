import { describe, expect, it } from "vitest";

import { renderEmailTemplate } from "../index";

const base = {
  contactName: "Claire Martin",
  dossierUrl: "https://axion-ia.com/apporteur/dossier/x/y",
};

describe("apporteur-dossier-lien : le rappel garde le sujet et le lien, change l'en-tête", () => {
  it("premier envoi : pas de mention de rappel", async () => {
    const r = await renderEmailTemplate("apporteur-dossier-lien", "fr", base);
    expect(r.html).not.toContain("rappel");
    expect(r.html).toContain("apporteur/dossier/x/y");
  });
  it("J+3 et J+7 : même sujet, même lien, texte de rappel, vouvoiement", async () => {
    const premier = await renderEmailTemplate("apporteur-dossier-lien", "fr", base);
    const j3 = await renderEmailTemplate("apporteur-dossier-lien", "fr", { ...base, rappel: 1 });
    const j7 = await renderEmailTemplate("apporteur-dossier-lien", "fr", { ...base, rappel: 2 });
    expect(j3.subject).toBe(premier.subject);
    expect(j7.subject).toBe(premier.subject);
    expect(j3.html).toContain("Petit rappel");
    expect(j7.html).toContain("Dernier rappel");
    expect(j3.html).toContain("apporteur/dossier/x/y");
    expect(j7.html).toContain("apporteur/dossier/x/y");
  });
});
