import { describe, expect, it } from "vitest";

import { estLotInterrupteurConnu, LOTS_INTERRUPTEURS } from "../socle/lots-interrupteurs";
import { assistantDevisActif, LOT_DEVIS_ASSISTANT } from "./interrupteur-assistant";

const client = (value: unknown) =>
  ({ setting: { findUnique: async () => (value === undefined ? null : { value }) } }) as never;

describe("assistantDevisActif", () => {
  it("le lot s'appelle devis_assistant", () => {
    expect(LOT_DEVIS_ASSISTANT).toBe("devis_assistant");
  });
  it("clé absente = éteint", async () => {
    expect(await assistantDevisActif(client(undefined))).toBe(false);
  });
  it("éteint et essai (sans cible) = faux", async () => {
    expect(await assistantDevisActif(client({ etat: "eteint" }))).toBe(false);
    expect(await assistantDevisActif(client({ etat: "essai" }))).toBe(false);
  });
  it("essai + cible qui n'est pas un test interne = faux", async () => {
    expect(await assistantDevisActif(client({ etat: "essai" }), { estTestInterne: false })).toBe(
      false,
    );
  });
  it("essai + cible d'essai = vrai", async () => {
    expect(await assistantDevisActif(client({ etat: "essai" }), { estTestInterne: true })).toBe(
      true,
    );
  });
  it("actif = vrai", async () => {
    expect(await assistantDevisActif(client({ etat: "actif" }))).toBe(true);
  });
  it("le lot est déclaré dans l'écran des interrupteurs, avec libellé et description", () => {
    expect(estLotInterrupteurConnu("devis_assistant")).toBe(true);
    const ligne = LOTS_INTERRUPTEURS.find((l) => l.lot === "devis_assistant");
    expect(ligne?.libelle).toBeTruthy();
    expect(ligne?.description).toBeTruthy();
  });
});
