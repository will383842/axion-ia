// I2-3 — la charge et l'objet que l'approbation d'un e-mail de la file envoie au worker,
// extraits en deux fonctions pures pour que l'aperçu et l'envoi n'en aient qu'une.
import { describe, expect, it } from "vitest";
import { chargeApprouvee, objetApprouve } from "@/server/email/outbox-charge";

describe("chargeApprouvee", () => {
  it("ajoute le message personnalisé à la charge, sans toucher aux autres champs", () => {
    const base = { montant: 12, nom: "Société test" };
    expect(chargeApprouvee(base, "Bonjour, merci.")).toEqual({
      montant: 12,
      nom: "Société test",
      messagePersonnalise: "Bonjour, merci.",
    });
    expect(base).toEqual({ montant: 12, nom: "Société test" });
  });

  it("n'ajoute rien quand le message est absent ou vide", () => {
    expect(chargeApprouvee({ a: 1 }, undefined)).toEqual({ a: 1 });
    expect(chargeApprouvee({ a: 1 }, "")).toEqual({ a: 1 });
  });

  it("tolère une charge absente ou qui n'est pas un objet", () => {
    expect(chargeApprouvee(null, undefined)).toEqual({});
    expect(chargeApprouvee("x", "m")).toEqual({ messagePersonnalise: "m" });
  });
});

describe("objetApprouve", () => {
  it("rend l'objet saisi quand il diffère de celui de la file", () => {
    expect(objetApprouve("Nouvel objet", "Objet d'origine")).toBe("Nouvel objet");
  });

  it("rend undefined (le gabarit décide) quand l'objet est absent ou inchangé", () => {
    expect(objetApprouve(undefined, "Objet d'origine")).toBeUndefined();
    expect(objetApprouve("Objet d'origine", "Objet d'origine")).toBeUndefined();
  });
});
