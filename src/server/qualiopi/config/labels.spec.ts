/**
 * Tests — dictionnaire de libellés humains de la config Qualiopi.
 *
 * Audit UX 2026-08-01 : la page /qualiopi/config affichait la clé technique
 * brute comme seul libellé pour 57 des 58 réglages. Ce test structurel prouve
 * que TOUTE clé du registre a un libellé explicite dans `labels.ts` — et
 * échouera si une clé future est ajoutée au registre sans être traduite ici
 * (le repli `resolveQualiopiConfigLabel` existe pour ne pas planter en prod,
 * mais ne doit jamais devenir la norme silencieuse).
 */

import { describe, it, expect } from "vitest";
import { QUALIOPI_CONFIG_REGISTRY, type QualiopiConfigKey } from "./registry";
import { QUALIOPI_CONFIG_LABELS, resolveQualiopiConfigLabel } from "./labels";

describe("QUALIOPI_CONFIG_LABELS — couverture exhaustive du registre", () => {
  const keys = Object.keys(QUALIOPI_CONFIG_REGISTRY) as QualiopiConfigKey[];

  it("chaque clé du registre a un libellé explicite (58/58, pas de repli)", () => {
    const manquantes = keys.filter((k) => !QUALIOPI_CONFIG_LABELS[k]);
    expect(manquantes, `clés sans libellé : ${manquantes.join(", ")}`).toEqual([]);
  });

  it("aucun libellé n'est vide ou identique à la clé brute", () => {
    for (const k of keys) {
      const label = QUALIOPI_CONFIG_LABELS[k];
      expect(label.trim().length, `libellé vide pour ${k}`).toBeGreaterThan(0);
      expect(label, `libellé identique à la clé pour ${k}`).not.toBe(k);
    }
  });

  it("resolveQualiopiConfigLabel ne retombe jamais sur le repli pour une clé connue", () => {
    for (const k of keys) {
      const { isFallback } = resolveQualiopiConfigLabel(k);
      expect(isFallback, `repli déclenché pour ${k}`).toBe(false);
    }
  });

  it("le repli formate proprement une clé hypothétique absente du dictionnaire", () => {
    const { label, isFallback } = resolveQualiopiConfigLabel(
      "cle_qui_nexiste_pas_encore" as QualiopiConfigKey,
    );
    expect(isFallback).toBe(true);
    expect(label).toBe("Cle Qui Nexiste Pas Encore");
  });
});
