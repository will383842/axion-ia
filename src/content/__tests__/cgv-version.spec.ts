/**
 * Cliquet de version des CGV (T9).
 *
 * `CGV_VERSION` est ENREGISTRÉE et scellée dans la preuve de signature d'un devis.
 * Si le texte des CGV change sans que la version bouge, la preuve affirmerait que le
 * client a accepté un texte qu'il n'a pas lu. Ce test lie donc l'empreinte du texte
 * français à la version : modifier l'un oblige à toucher l'autre, ici, en revue.
 */
import { createHash } from "node:crypto";
import { describe, it, expect } from "vitest";
import { getLegal } from "@/content/legal";
import { CGV_VERSION, CGV_VERSION_LIBELLE, CGV_VERSION_LIBELLE_EN } from "@/content/cgv-version";

/** Empreinte du texte FR pour la version courante. À mettre à jour AVEC CGV_VERSION. */
const EMPREINTE_TEXTE_FR = "X";
const VERSION_DE_L_EMPREINTE = "2026-11-05";

describe("cgv-version : source unique de la version des CGV", () => {
  it("la version est une date ISO, le libellé la reflète", () => {
    expect(CGV_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(CGV_VERSION.length).toBeLessThanOrEqual(40);
    expect(CGV_VERSION_LIBELLE.length).toBeGreaterThan(0);
    expect(CGV_VERSION_LIBELLE_EN.length).toBeGreaterThan(0);
  });

  it("cliquet : le texte FR des CGV n'a pas changé sans changement de version", () => {
    const texte = JSON.stringify(getLegal("conditions-generales").fr);
    const empreinte = createHash("sha256").update(texte, "utf8").digest("hex");
    // Si ce test casse : le texte a changé. Mettre à jour CGV_VERSION (+ libellés),
    // puis EMPREINTE_TEXTE_FR et VERSION_DE_L_EMPREINTE ensemble. Jamais l'empreinte seule.
    expect(CGV_VERSION).toBe(VERSION_DE_L_EMPREINTE);
    expect(empreinte).toBe(EMPREINTE_TEXTE_FR);
  });
});
