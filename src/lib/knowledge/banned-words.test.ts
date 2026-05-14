/**
 * KB V4 — Tests banned words. Pure.
 */

import { describe, expect, it } from "vitest";
import { checkTranslationBannedWords } from "./banned-words";

describe("checkTranslationBannedWords", () => {
  it("retourne valid=true si aucun mot banni", () => {
    const r = checkTranslationBannedWords({
      title: "Module d'intervention IA",
      body: "Boost compétence équipe",
    });
    expect(r.valid).toBe(true);
  });

  it("détecte « formation » dans title", () => {
    const r = checkTranslationBannedWords({ title: "Formation IA pour entreprise" });
    expect(r.valid).toBe(false);
    expect(r.fieldViolations[0]!.field).toBe("title");
  });

  it("détecte « formations » pluriel dans body", () => {
    const r = checkTranslationBannedWords({ body: "Nos formations IA sont gratuites" });
    expect(r.valid).toBe(false);
  });

  it("détecte « former » (verbe) dans excerpt", () => {
    const r = checkTranslationBannedWords({ excerpt: "Nous allons former vos équipes" });
    expect(r.valid).toBe(false);
  });

  it("détecte « formateur » dans metaDescription", () => {
    const r = checkTranslationBannedWords({ metaDescription: "Un formateur expert vient" });
    expect(r.valid).toBe(false);
  });

  it("accepte « transformation » (faux positif évité)", () => {
    const r = checkTranslationBannedWords({
      title: "Transformation IA",
      body: "Une transformation digitale par l'IA",
    });
    expect(r.valid).toBe(true);
  });

  it("accepte « information » (faux positif évité)", () => {
    const r = checkTranslationBannedWords({ body: "Une information utile" });
    expect(r.valid).toBe(true);
  });

  it("bodyText prioritaire sur body si les 2 présents", () => {
    const r = checkTranslationBannedWords({
      body: "<p>HTML clean</p>",
      bodyText: "Formation toxique dans le plain text",
    });
    expect(r.valid).toBe(false);
  });

  it("retourne champ + snippet pour chaque violation", () => {
    const r = checkTranslationBannedWords({
      title: "Formation IA",
      excerpt: "Formations en groupe",
    });
    expect(r.fieldViolations).toHaveLength(2);
    expect(r.fieldViolations.map((v) => v.field).sort()).toEqual(["excerpt", "title"]);
  });
});
