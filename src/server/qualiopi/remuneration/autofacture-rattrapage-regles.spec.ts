/**
 * Quand l'échec du rattrapage des autofactures mérite une alerte.
 *
 * Le seuil et la fenêtre sont les deux bornes qui empêchent l'alerte de crier
 * sur un passage raté isolé — et de rester levée sur un échec corrigé.
 */

import { describe, expect, it } from "vitest";

import {
  FENETRE_ECHECS_RATTRAPAGE_MS,
  SEUIL_ECHECS_RATTRAPAGE,
  echecRepeteRattrapage,
} from "./autofacture-rattrapage-regles";

const NOW = new Date("2026-09-15T12:00:00.000Z");
const ID = "st-1";
const ilYa = (min: number) => new Date(NOW.getTime() - min * 60_000);

describe("echecRepeteRattrapage", () => {
  it("les bornes sont celles qu'annonce l'alerte : 2 échecs en 24 h", () => {
    expect(SEUIL_ECHECS_RATTRAPAGE).toBe(2);
    expect(FENETRE_ECHECS_RATTRAPAGE_MS).toBe(24 * 60 * 60_000);
  });

  it("🔑 un seul échec : pas d'alerte", () => {
    expect(
      echecRepeteRattrapage([{ targetId: ID, createdAt: ilYa(5), changes: {} }], ID, NOW),
    ).toBeNull();
  });

  it("🔴 deux échecs dans la fenêtre : alerte, avec le DERNIER motif", () => {
    const r = echecRepeteRattrapage(
      [
        { targetId: ID, createdAt: ilYa(125), changes: { code: "technique", motif: "ancien" } },
        {
          targetId: ID,
          createdAt: ilYa(5),
          changes: { code: "montant_incoherent", motif: "récent" },
        },
      ],
      ID,
      NOW,
    );
    expect(r).toEqual({
      nombre: 2,
      dernierAt: ilYa(5),
      code: "montant_incoherent",
      motif: "récent",
    });
  });

  it("🔑 un échec HORS fenêtre ne compte pas — un relevé corrigé ne reste pas signalé", () => {
    expect(
      echecRepeteRattrapage(
        [
          { targetId: ID, createdAt: ilYa(24 * 60 + 1), changes: {} },
          { targetId: ID, createdAt: ilYa(5), changes: {} },
        ],
        ID,
        NOW,
      ),
    ).toBeNull();
  });

  it("les échecs d'un AUTRE relevé ne comptent pas", () => {
    expect(
      echecRepeteRattrapage(
        [
          { targetId: "autre", createdAt: ilYa(5), changes: {} },
          { targetId: ID, createdAt: ilYa(10), changes: {} },
        ],
        ID,
        NOW,
      ),
    ).toBeNull();
  });

  it("un journal mal formé ne lève pas : code et motif inconnus rendus `null`", () => {
    const r = echecRepeteRattrapage(
      [
        { targetId: ID, createdAt: ilYa(5), changes: null },
        { targetId: ID, createdAt: ilYa(6), changes: { code: "inconnu", motif: 42 } },
      ],
      ID,
      NOW,
    );
    expect(r).toMatchObject({ nombre: 2, code: null, motif: null });
  });
});
