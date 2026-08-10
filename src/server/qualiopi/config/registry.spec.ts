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
// `afest_perimetre_certifie` servait d'exemplaire bool — clé supprimée le
// 2026-08-10 (1-to-1 = conseil, hors Qualiopi) → on teste sur `off29_applicable`.
const boolSchema = QUALIOPI_CONFIG_REGISTRY["off29_applicable"].schema;

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
  // Clé de texte libre : c'est elle qui doit démontrer le comportement générique
  // du `trim()`. Elle portait auparavant sur `referent_handicap_email`, devenue
  // une clé validée — un email n'est justement PAS du texte libre.
  const texteLibre = QUALIOPI_CONFIG_REGISTRY["referent_handicap_nom"].schema;

  it("supprime les espaces de bord", () => {
    const r = texteLibre.safeParse(" Williams Jullin ");
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toBe("Williams Jullin");
  });

  it("préserve le contenu interne (trim = bords seuls)", () => {
    const r = texteLibre.safeParse("a b c");
    expect(r.success && r.data).toBe("a b c");
  });

  it("une valeur uniquement blanche devient vide", () => {
    const r = texteLibre.safeParse("   ");
    expect(r.success && r.data).toBe("");
  });
});

// 🔴 Vérification E2E 2026-07-26. Relevé en PRODUCTION :
// `qualiopi.responsable_qualite_email` valait « Williams Jullin » — un NOM dans
// un champ email, accepté sans broncher. Les champs « nom » et « email » se
// suivent dans le formulaire ; rien ne les distinguait à l'enregistrement.
describe("registre Qualiopi — clés email", () => {
  const CLES_EMAIL = [
    "email_organisme",
    "dpo_contact_email",
    "referent_handicap_email",
    "responsable_qualite_email",
  ] as const;

  it("refuse un nom là où un email est attendu", () => {
    for (const cle of CLES_EMAIL) {
      const r = QUALIOPI_CONFIG_REGISTRY[cle].schema.safeParse("Williams Jullin");
      expect(r.success, `${cle} devrait refuser un nom`).toBe(false);
    }
  });

  it("accepte un email, espaces de bord retirés", () => {
    for (const cle of CLES_EMAIL) {
      const r = QUALIOPI_CONFIG_REGISTRY[cle].schema.safeParse(" contact@axion-ia.com ");
      expect(r.success).toBe(true);
      if (r.success) expect(r.data).toBe("contact@axion-ia.com");
    }
  });

  // Ces clés sont facultatives : refuser le vide empêcherait d'effacer une
  // valeur, et une valeur uniquement blanche doit valoir « non renseigné ».
  it("accepte le vide, et ramène une valeur blanche à vide", () => {
    for (const cle of CLES_EMAIL) {
      expect(QUALIOPI_CONFIG_REGISTRY[cle].schema.safeParse("").success).toBe(true);
      const r = QUALIOPI_CONFIG_REGISTRY[cle].schema.safeParse("   ");
      expect(r.success && r.data).toBe("");
    }
  });
});

describe("registre Qualiopi — clés téléphone", () => {
  // `qualiopi.responsable_qualite_telephone` portait « ␣+33755512345 » : l'espace
  // de tête survivait à la lecture comme à l'écriture.
  const CLES_TEL = [
    "telephone_organisme",
    "referent_handicap_telephone",
    "responsable_qualite_telephone",
  ] as const;

  it("retire l'espace de tête sans imposer de format", () => {
    for (const cle of CLES_TEL) {
      const r = QUALIOPI_CONFIG_REGISTRY[cle].schema.safeParse(" +33 7 55 51 23 45");
      expect(r.success).toBe(true);
      if (r.success) expect(r.data).toBe("+33 7 55 51 23 45");
    }
  });
});
