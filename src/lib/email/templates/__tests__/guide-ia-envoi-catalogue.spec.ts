// @vitest-environment node
//
// PR-S2b — gabarit « Votre guide » : la branche catalogue (scénarios 15 et 16).
// La branche ne s'ouvre que si guideTitre ET guideCode sont sûrs ; sinon le rendu est celui du guide-ia,
// octet pour octet (les références complètes sont dans `guide-ia-octet-pour-octet.spec.ts`).
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderEmailTemplate } from "@/lib/email/templates";

const D = "d".repeat(64);
const BASE = { downloadToken: D };
const CATALOGUE = { ...BASE, guideCode: "gde-essai-01", guideTitre: "Le plan en 90 jours" };

beforeEach(() => vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://axion-ia.com"));
afterEach(() => vi.unstubAllEnvs());

describe("gabarit guide-ia-envoi — branche catalogue", () => {
  it("15. FR et EN : titre du guide dans le sujet et le corps, aucune promesse du guide-ia", async () => {
    const fr = await renderEmailTemplate("guide-ia-envoi", "fr", CATALOGUE);
    expect(fr.subject).toBe("Votre guide : Le plan en 90 jours");
    expect(fr.html).toContain("Voici le guide que vous avez demandé");
    expect(fr.html).toContain("Le plan en 90 jours");
    expect(fr.html).toContain("Télécharger le guide (PDF)");
    expect(fr.html).toContain(`/api/guide-ia/telecharger?t=${D}`);
    for (const interdit of ["page 5", "40 pages", "IA entreprise", "coûts réels"]) {
      expect(fr.html).not.toContain(interdit);
      expect(fr.text).not.toContain(interdit);
    }
    const en = await renderEmailTemplate("guide-ia-envoi", "en", CATALOGUE);
    expect(en.subject).toBe("Your guide: Le plan en 90 jours");
    expect(en.html).toContain("(in French)");
    expect(en.html).not.toContain("page 5");
    expect(en.html).not.toContain("40 pages");
  });

  it("15bis. le titre est échappé (aucune balise du titre ne passe dans le HTML)", async () => {
    const r = await renderEmailTemplate("guide-ia-envoi", "fr", {
      ...CATALOGUE,
      guideTitre: "Plan <b>gras</b> & co",
    });
    expect(r.html).not.toContain("<b>gras</b>");
    expect(r.html).toContain("&lt;b&gt;gras&lt;/b&gt;");
  });

  it("16. charge incomplète ou piégée : rendu identique au guide-ia (sujet, HTML, texte)", async () => {
    const ref = await renderEmailTemplate("guide-ia-envoi", "fr", BASE);
    expect(ref.subject).toBe("Votre guide IA entreprise (PDF, 40 pages)");
    const piegees: Record<string, unknown>[] = [
      { ...BASE, guideTitre: "Le plan en 90 jours" },
      { ...BASE, guideCode: "gde-essai-01" },
      { ...BASE, guideCode: "guide-ia", guideTitre: "Le plan en 90 jours" },
      { ...BASE, guideCode: "gde-ab", guideTitre: "Le plan en 90 jours" },
      { ...BASE, guideCode: "GDE-essai-01", guideTitre: "Le plan en 90 jours" },
      { ...BASE, guideCode: "gde-essai-01", guideTitre: "Abc\r\nBcc: x" },
      { ...BASE, guideCode: "gde-essai-01", guideTitre: 42 },
      { ...BASE, guideCode: ["gde-essai-01"], guideTitre: "Le plan en 90 jours" },
    ];
    for (const p of piegees) {
      const r = await renderEmailTemplate("guide-ia-envoi", "fr", p);
      expect(r.subject).toBe(ref.subject);
      expect(r.html).toBe(ref.html);
      expect(r.text).toBe(ref.text);
    }
  });
});
