// @vitest-environment node
//
// Garde du report acté : GUIDES_RESEAU_ENABLED ne s'allume pas avant le lot « demande
// d'effacement reçue en message privé ». Ce test fige le défaut sûr : éteint.
import { describe, it, expect, afterEach } from "vitest";
import { guidesReseauActifs } from "../config";

const AVANT = process.env.GUIDES_RESEAU_ENABLED;
afterEach(() => {
  if (AVANT === undefined) delete process.env.GUIDES_RESEAU_ENABLED;
  else process.env.GUIDES_RESEAU_ENABLED = AVANT;
});

describe("GUIDES_RESEAU_ENABLED", () => {
  it("éteint par défaut (variable absente)", () => {
    delete process.env.GUIDES_RESEAU_ENABLED;
    expect(guidesReseauActifs()).toBe(false);
  });

  it.each(["", "1", "TRUE", "yes", "false"])("« %s » n'allume rien", (v) => {
    process.env.GUIDES_RESEAU_ENABLED = v;
    expect(guidesReseauActifs()).toBe(false);
  });

  it("seul « true » exact allume", () => {
    process.env.GUIDES_RESEAU_ENABLED = "true";
    expect(guidesReseauActifs()).toBe(true);
  });
});
