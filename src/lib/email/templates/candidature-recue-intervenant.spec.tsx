/**
 * L14 — l'accusé de réception d'une candidature d'INTERVENANT décrit les vraies
 * étapes. Les autres candidatures, elles, reçoivent l'accusé d'avant, à l'octet
 * près (la réponse « poste pourvu » n'est pas ce gabarit et n'est pas touchée).
 */

import { describe, expect, it } from "vitest";

import { renderEmailTemplate } from "./index";

const BASE = { contactName: "Camille Dupont", offerTitle: "Formateur IA freelance" };

describe("candidature-recue — variante intervenant (L14)", () => {
  it("décrit les étapes, dont la formation obligatoire, et la mention Qualiopi", async () => {
    const r = await renderEmailTemplate("candidature-recue", "fr", {
      ...BASE,
      intervenant: true,
      freelance: true,
    });
    expect(r.subject).toBe("Bien reçu : votre candidature de formateur");
    // La phrase F0 validée est conservée pour un formateur indépendant.
    expect(r.text).toContain("missions de formateur IA indépendant");
    expect(r.text).toMatch(/entretien, noté/);
    expect(r.text).toMatch(/mise en situation d'animation, également notée/);
    expect(r.text).toMatch(/SIRET, déclaration d'activité et CV de moins de 24 mois/);
    expect(r.text).toMatch(/formation obligatoire à la méthode Axion-IA/);
    expect(r.text).toMatch(/observation de votre première mission/);
    expect(r.text).toMatch(/évaluation après chaque mission/);
    expect(r.text).not.toMatch(/Qualiopi|obtention/);
    expect(r.text).not.toMatch(/certifi[ée]e?\b/i);
  });

  it("un salarié ne se voit pas annoncer de SIRET", async () => {
    const r = await renderEmailTemplate("candidature-recue", "fr", { ...BASE, intervenant: true });
    expect(r.text).not.toMatch(/SIRET/);
    expect(r.text).toContain("Votre candidature d'intervenant est bien arrivée.");
    expect(r.text).toMatch(/CV de moins de 24 mois/);
  });

  it("sans la variante, l'accusé est celui d'avant (aucune étape, aucune mention)", async () => {
    const r = await renderEmailTemplate("candidature-recue", "fr", BASE);
    expect(r.subject).toBe("Votre candidature est bien arrivée");
    expect(r.text).not.toMatch(/Qualiopi|SIRET|entretien, noté/);
  });
});
