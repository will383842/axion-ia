/**
 * Tests — validation SIRET (F5).
 *
 * Module PUR : aucune dépendance DB / next / zod.
 *
 * ⚠️ Les espaces insécables sont écrits en ÉCHAPPEMENT (` `, ` `) et
 * non en littéral : un caractère invisible dans un test est indistinguable d'un
 * espace normal à la relecture, et se perd au premier copier-coller.
 */

import { describe, it, expect } from "vitest";
import { checkSiretFormat, luhnValid, normalizeSiret } from "./siret";

describe("luhnValid — caractérisation", () => {
  it("🔴 ACCEPTE 00000000000000 : c'est pourquoi le garde-fou repdigit existe", () => {
    // Ne pas « simplifier » ce test : il fige la raison d'être de REPDIGIT et
    // empêche un futur refactor de le supprimer comme redondant avec Luhn.
    expect(luhnValid("00000000000000")).toBe(true);
  });

  it("accepte le SIRET canonique INSEE 73282932000074", () => {
    expect(luhnValid("73282932000074")).toBe(true);
  });

  it("refuse 12345678901234", () => {
    expect(luhnValid("12345678901234")).toBe(false);
  });

  it("refuse le SIRET La Poste 35600000009075 (d'où la règle de substitution)", () => {
    expect(luhnValid("35600000009075")).toBe(false);
  });
});

describe("normalizeSiret", () => {
  it("retire espaces, espaces insécables, points et tirets", () => {
    expect(normalizeSiret("732 829 320 00074")).toBe("73282932000074");
    expect(normalizeSiret("732 829 320 00074")).toBe("73282932000074");
    expect(normalizeSiret("732 829 320 00074")).toBe("73282932000074");
    expect(normalizeSiret("732.829.320.00074")).toBe("73282932000074");
    expect(normalizeSiret("732-829-320-00074")).toBe("73282932000074");
    expect(normalizeSiret("732‑829‑320‑00074")).toBe("73282932000074");
  });
});

describe("checkSiretFormat", () => {
  it("🔴 refuse 00000000000000 avec le code placeholder (cas reproduit en prod)", () => {
    const r = checkSiretFormat("00000000000000");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toBe("placeholder");
  });

  it("refuse 11111111111111 en placeholder, pas en clé (message actionnable)", () => {
    const r = checkSiretFormat("11111111111111");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toBe("placeholder");
  });

  it("accepte le SIRET canonique INSEE", () => {
    expect(checkSiretFormat("73282932000074")).toEqual({ ok: true, value: "73282932000074" });
  });

  it("accepte et normalise la forme espacée imprimée sur un Kbis", () => {
    expect(checkSiretFormat("732 829 320 00074")).toEqual({ ok: true, value: "73282932000074" });
    expect(checkSiretFormat("732 829 320 00074")).toEqual({
      ok: true,
      value: "73282932000074",
    });
    expect(checkSiretFormat("732.829.320.00074")).toEqual({ ok: true, value: "73282932000074" });
  });

  it("accepte le SIRET La Poste 35600000009075 (exception INSEE somme % 5)", () => {
    expect(checkSiretFormat("35600000009075").ok).toBe(true);
  });

  it("l'exception La Poste n'est pas un passe-droit sur le préfixe 356000000", () => {
    const r = checkSiretFormat("35600000009076");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toBe("cle");
  });

  it("refuse un SIREN (9 chiffres) avec un message qui explique SIREN vs SIRET", () => {
    const r = checkSiretFormat("732829320");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toBe("longueur");
    expect(r.message).toContain("SIREN");
  });

  it("refuse un n° de TVA intracommunautaire collé dans le champ SIRET", () => {
    const r = checkSiretFormat("FR12345678901");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toBe("non_numerique");
  });
});
