import { describe, expect, it } from "vitest";

import { estLotInterrupteurConnu } from "../socle/lots-interrupteurs";
import { formulesActives } from "./interrupteur-formules";

const client = (value: unknown) =>
  ({ setting: { findUnique: async () => (value === undefined ? null : { value }) } }) as never;

describe("formulesActives", () => {
  it("clé absente = éteint", async () => {
    expect(await formulesActives(client(undefined))).toBe(false);
  });
  it("éteint et essai (sans cible) = faux", async () => {
    expect(await formulesActives(client({ etat: "eteint" }))).toBe(false);
    expect(await formulesActives(client({ etat: "essai" }))).toBe(false);
  });
  it("essai + cible d'essai = vrai", async () => {
    expect(await formulesActives(client({ etat: "essai" }), { estTestInterne: true })).toBe(true);
  });
  it("actif = vrai", async () => {
    expect(await formulesActives(client({ etat: "actif" }))).toBe(true);
  });
  it("le lot est déclaré dans l'écran des interrupteurs", () => {
    expect(estLotInterrupteurConnu("devis_formules")).toBe(true);
  });
});
