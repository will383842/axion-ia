/**
 * Tests — champ Zod SIRET partagé (F5).
 *
 * Vérifie le contrat que les trois actions consomment : facultatif, normalisé,
 * jamais de chaîne vide écrite en base, effaçable via `.nullable()`.
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import { siretField } from "./siret-schema";

const schema = z.object({ siret: siretField.optional() });
const schemaEffacable = z.object({ siret: siretField.nullable().optional() });

describe("siretField", () => {
  it('une chaîne vide donne undefined, JAMAIS "" (anti CII schemeID 0009 vide)', () => {
    const r = schema.safeParse({ siret: "" });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.siret).toBeUndefined();
  });

  it("reste facultatif : l'absence de clé passe", () => {
    const r = schema.safeParse({});
    expect(r.success).toBe(true);
  });

  it("normalise la forme espacée à 14 caractères (colonne VarChar(14))", () => {
    const r = schema.safeParse({ siret: "732 829 320 00074" });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.siret).toBe("73282932000074");
  });

  it("rejette 00000000000000 et rattache l'erreur au champ siret", () => {
    const r = schema.safeParse({ siret: "00000000000000" });
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.error.issues[0]?.path).toEqual(["siret"]);
    expect(r.error.issues[0]?.message).toContain("SIRET");
  });

  it("rejette une clé de contrôle fausse", () => {
    expect(schema.safeParse({ siret: "12345678901234" }).success).toBe(false);
  });

  it("🔴 `null` est le SEUL chemin d'effacement (la chaîne vide ne l'est pas)", () => {
    // Distinction structurante : "" → undefined → « ne rien changer » ;
    // null → « remettre la colonne à NULL ». Sans `.nullable()`, un SIRET
    // erroné saisi une fois serait définitif.
    expect(schema.safeParse({ siret: null }).success).toBe(false);
    const r = schemaEffacable.safeParse({ siret: null });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.siret).toBeNull();
  });
});
