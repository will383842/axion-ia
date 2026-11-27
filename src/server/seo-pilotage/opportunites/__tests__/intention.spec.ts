import { describe, expect, it } from "vitest";
import { classerIntention, normaliserSansTri } from "../intention";

describe("normaliserSansTri", () => {
  it("retire les accents sans trier les mots", () => {
    expect(normaliserSansTri("C’est quoi l'IA générative ?")).toBe("c est quoi l ia generative");
  });
});

describe("intention", () => {
  it("« tarif formation IA Lyon » : transactionnelle avec drapeau local", () => {
    const r = classerIntention("tarif formation IA Lyon");
    expect(r.intention).toBe("transactionnelle");
    expect(r.drapeaux.local).toBe(true);
  });
  it("formation IA Lyon : locale", () => {
    expect(classerIntention("formation ia lyon").intention).toBe("locale");
  });
  it("marque : navigationnelle, avant tout", () => {
    expect(classerIntention("axion ia tarif").intention).toBe("navigationnelle");
  });
  it("commerciale", () => {
    expect(classerIntention("meilleur outil ia pme").intention).toBe("commerciale");
    expect(classerIntention("avis formation chatgpt").intention).toBe("commerciale");
  });
  it("informationnelle + drapeaux question et définition", () => {
    const r = classerIntention("c'est quoi un agent ia");
    expect(r.intention).toBe("informationnelle");
    expect(r.drapeaux.question).toBe(true);
    expect(r.drapeaux.definition).toBe(true);
  });
  it("texte non trié : « comment automatiser » reste une question", () => {
    expect(classerIntention("comment automatiser ses factures").drapeaux.question).toBe(true);
  });
  it("liste", () => {
    expect(classerIntention("10 outils ia pour les rh").drapeaux.liste).toBe(true);
  });
  it("inconnue", () => {
    expect(classerIntention("n8n").intention).toBe("inconnue");
  });
  it("homonymes : « nice » adjectif n'est pas la ville, « à nice » l'est", () => {
    expect(classerIntention("nice tool ia").drapeaux.local).toBe(false);
    expect(classerIntention("formation ia à nice").drapeaux.local).toBe(true);
    expect(classerIntention("les tours de passe-passe ia").drapeaux.local).toBe(false);
  });
  it("ville en plusieurs mots", () => {
    expect(classerIntention("formation ia saint etienne").intention).toBe("locale");
  });
  it("villes injectées", () => {
    expect(
      classerIntention("formation ia quimper", { villes: new Set(["quimper"]) }).intention,
    ).toBe("locale");
  });
  it("voice_search, ai_overview, featured_snippet ne sont pas des intentions", () => {
    const r = classerIntention("comment faire") as unknown as Record<string, unknown>;
    expect(Object.values(r)).not.toContain("voice_search");
  });
});
