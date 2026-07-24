/**
 * Tests — normalisation des schémas num/bool du registre Qualiopi.
 *
 * Module pur (pas de Prisma) : on teste directement les schémas Zod des clés.
 * Contrat : une valeur exploitable est convertie (chaînes de formulaire, virgule
 * décimale), une valeur inutilisable (bool sur clé number, chaîne vide, null…)
 * ÉCHOUE au parse → getQualiopiConfig retombe alors sur le défaut du registre.
 */

import { describe, it, expect } from "vitest";
import { QUALIOPI_CONFIG_REGISTRY } from "./registry";

const numSchema = QUALIOPI_CONFIG_REGISTRY["cpf_reste_a_charge"].schema;
const boolSchema = QUALIOPI_CONFIG_REGISTRY["afest_perimetre_certifie"].schema;

describe("registre Qualiopi — clés numériques (z.preprocess)", () => {
  it("accepte un vrai nombre fini", () => {
    const r = numSchema.safeParse(40);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toBe(40);
  });

  it("normalise une chaîne numérique de formulaire", () => {
    const r = numSchema.safeParse("40");
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toBe(40);
  });

  it("normalise une chaîne à virgule décimale (103,2 → 103.2)", () => {
    const r = numSchema.safeParse("103,2");
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toBe(103.2);
  });

  it("échoue sur un booléen (ancienne valeur mal typée) → défaut côté lecture", () => {
    expect(numSchema.safeParse(false).success).toBe(false);
    expect(numSchema.safeParse(true).success).toBe(false);
  });

  it("échoue sur une chaîne vide (n'est PAS coercée en 0)", () => {
    expect(numSchema.safeParse("").success).toBe(false);
    expect(numSchema.safeParse("   ").success).toBe(false);
  });

  it("échoue sur null, NaN et une chaîne non numérique", () => {
    expect(numSchema.safeParse(null).success).toBe(false);
    expect(numSchema.safeParse(Number.NaN).success).toBe(false);
    expect(numSchema.safeParse("abc").success).toBe(false);
  });
});

describe("registre Qualiopi — clés booléennes (z.preprocess)", () => {
  it("accepte un vrai booléen", () => {
    const t = boolSchema.safeParse(true);
    const f = boolSchema.safeParse(false);
    expect(t.success && t.data).toBe(true);
    expect(f.success && f.data).toBe(false);
  });

  it("normalise les chaînes/1/0 de formulaire", () => {
    for (const v of ["true", "1", 1]) {
      const r = boolSchema.safeParse(v);
      expect(r.success).toBe(true);
      if (r.success) expect(r.data).toBe(true);
    }
    for (const v of ["false", "0", 0]) {
      const r = boolSchema.safeParse(v);
      expect(r.success).toBe(true);
      if (r.success) expect(r.data).toBe(false);
    }
  });

  it("échoue sur une chaîne vide ou une valeur inconnue → défaut côté lecture", () => {
    expect(boolSchema.safeParse("").success).toBe(false);
    expect(boolSchema.safeParse("oui").success).toBe(false);
    expect(boolSchema.safeParse(null).success).toBe(false);
  });
});

describe("registre Qualiopi — clés string (z.string().trim())", () => {
  const emailSchema = QUALIOPI_CONFIG_REGISTRY["referent_handicap_email"].schema;

  it("supprime les espaces de bord (une valeur « ␣contact@… » casserait un mailto)", () => {
    const r = emailSchema.safeParse(" contact@axion-ia.com ");
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toBe("contact@axion-ia.com");
  });

  it("préserve le contenu interne (trim = bords seuls)", () => {
    const r = emailSchema.safeParse("a b c");
    expect(r.success && r.data).toBe("a b c");
  });

  it("une valeur uniquement blanche devient vide (téléphone non publié → masqué)", () => {
    const r = emailSchema.safeParse("   ");
    expect(r.success && r.data).toBe("");
  });
});
