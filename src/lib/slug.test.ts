import { describe, it, expect } from "vitest";
import { slugify, isValidSlug } from "./slug";

describe("slugify (SSOT V-10 2026-05-22)", () => {
  it("normalise les accents français", () => {
    expect(slugify("Édition à Paris")).toBe("edition-a-paris");
    expect(slugify("Démarche IA — entreprise")).toBe("demarche-ia-entreprise");
  });

  it("lowercase tous les caractères", () => {
    expect(slugify("ABC DEF")).toBe("abc-def");
  });

  it("transforme les caractères non-alphanumériques en tirets", () => {
    expect(slugify("Hello, World! 2026")).toBe("hello-world-2026");
    expect(slugify("a/b\\c|d?e")).toBe("a-b-c-d-e");
  });

  it("supprime les tirets en début et fin", () => {
    expect(slugify("---abc---")).toBe("abc");
    expect(slugify("!!!hello!!!")).toBe("hello");
  });

  it("applique la longueur max par défaut (80)", () => {
    const long = "a".repeat(120);
    expect(slugify(long)).toHaveLength(80);
  });

  it("respecte maxLen custom", () => {
    expect(slugify("a".repeat(150), { maxLen: 50 })).toHaveLength(50);
    expect(slugify("a".repeat(50), { maxLen: 200 })).toHaveLength(50);
  });

  it("retourne le fallback si résultat vide", () => {
    expect(slugify("", { fallback: "default" })).toBe("default");
    expect(slugify("...", { fallback: "image" })).toBe("image");
  });

  it("retourne string vide si pas de fallback et input invalide", () => {
    expect(slugify("")).toBe("");
    expect(slugify("---")).toBe("");
  });

  it("retire les stopwords FR quand stripStopwords=true", () => {
    expect(slugify("Le guide complet du RGPD", { stripStopwords: true })).toBe(
      "guide-complet-rgpd",
    );
    expect(slugify("La méthode et le secret", { stripStopwords: true })).toBe("methode-secret");
  });

  it("conserve les stopwords par défaut (rétro-compat)", () => {
    expect(slugify("Le guide complet du RGPD")).toBe("le-guide-complet-du-rgpd");
  });

  it("strip HTML quand stripHtml=true (TOC generator)", () => {
    expect(slugify("<h2>Mon titre <strong>gras</strong></h2>", { stripHtml: true })).toBe(
      "mon-titre-gras",
    );
  });

  it("ne tronque pas en milieu de tiret (retrim après slice)", () => {
    const result = slugify("a".repeat(79) + "-truncated", { maxLen: 80 });
    expect(result.endsWith("-")).toBe(false);
  });

  it("cas réel : article SEO long-tail", () => {
    expect(slugify("Comment auditer une IA d'entreprise à Paris en 2026")).toBe(
      "comment-auditer-une-ia-d-entreprise-a-paris-en-2026",
    );
  });
});

describe("isValidSlug", () => {
  it("accepte les slugs valides", () => {
    expect(isValidSlug("hello-world")).toBe(true);
    expect(isValidSlug("a1-b2-c3")).toBe(true);
    expect(isValidSlug("simple")).toBe(true);
  });

  it("rejette les slugs invalides", () => {
    expect(isValidSlug("Hello-World")).toBe(false); // uppercase
    expect(isValidSlug("hello_world")).toBe(false); // underscore
    expect(isValidSlug("hello world")).toBe(false); // espace
    expect(isValidSlug("-hello")).toBe(false); // leading dash
    expect(isValidSlug("")).toBe(false);
  });

  it("respecte la longueur max", () => {
    expect(isValidSlug("a".repeat(100))).toBe(true);
    expect(isValidSlug("a".repeat(101))).toBe(false);
    expect(isValidSlug("a".repeat(180), { maxLen: 180 })).toBe(true);
  });
});
