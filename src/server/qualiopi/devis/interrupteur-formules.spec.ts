import { describe, expect, it, vi } from "vitest";

import type { EtatInterrupteur } from "../socle/interrupteurs";
import { estLotInterrupteurConnu } from "../socle/lots-interrupteurs";
import { formulesActives, formulesActivesPourEtat } from "./interrupteur-formules";

const reglage = (value: unknown) =>
  ({ setting: { findUnique: async () => (value === undefined ? null : { value }) } }) as never;

/** Un « tx » dont on espionne la lecture de la fiche d'essai. */
const base = (ficheClientId: string | null) => {
  const findUnique = vi.fn(async ({ where }: { where: { clientId: string } }) =>
    where.clientId === ficheClientId ? { clientId: where.clientId } : null,
  );
  return { tx: { clientTestInterne: { findUnique } } as never, findUnique };
};

const ETATS: EtatInterrupteur[] = ["eteint", "essai", "actif"];

describe("formulesActives — matrice 3 états × 4 cibles", () => {
  // [état, fiche d'essai, vrai client, client nul, console]
  const ATTENDU: Record<EtatInterrupteur, [boolean, boolean, boolean, boolean]> = {
    eteint: [false, false, false, false],
    essai: [true, false, false, true],
    actif: [true, true, true, true],
  };
  for (const etat of ETATS) {
    const [essai, vrai, nul, cons] = ATTENDU[etat];
    it(`état « ${etat} »`, async () => {
      const c = reglage({ etat });
      const { tx } = base("fiche-essai");
      expect(await formulesActives(c, { clientId: "fiche-essai", tx })).toBe(essai);
      expect(await formulesActives(c, { clientId: "vrai-client", tx })).toBe(vrai);
      expect(await formulesActives(c, { clientId: null, tx })).toBe(nul);
      expect(await formulesActives(c, { console: true })).toBe(cons);
    });
  }

  it("en « actif » et « eteint », la fiche d'essai n'est JAMAIS lue", async () => {
    for (const etat of ["actif", "eteint"] as const) {
      const { tx, findUnique } = base("fiche-essai");
      await formulesActives(reglage({ etat }), { clientId: "fiche-essai", tx });
      expect(findUnique).not.toHaveBeenCalled();
    }
  });

  it("en « essai », la fiche est lue une fois ; clientId nul ne lit rien", async () => {
    const a = base("x");
    await formulesActives(reglage({ etat: "essai" }), { clientId: "x", tx: a.tx });
    expect(a.findUnique).toHaveBeenCalledTimes(1);
    const b = base("x");
    await formulesActives(reglage({ etat: "essai" }), { clientId: null, tx: b.tx });
    expect(b.findUnique).not.toHaveBeenCalled();
  });

  it("erreur de lecture de la fiche = faux (échec fermé)", async () => {
    const tx = {
      clientTestInterne: {
        findUnique: async () => {
          throw new Error("base muette");
        },
      },
    } as never;
    expect(await formulesActives(reglage({ etat: "essai" }), { clientId: "x", tx })).toBe(false);
  });

  it("cible booléenne : essai suit estTestInterne", async () => {
    const c = reglage({ etat: "essai" });
    expect(await formulesActives(c, { estTestInterne: true })).toBe(true);
    expect(await formulesActives(c, { estTestInterne: false })).toBe(false);
  });

  it("clé absente ou valeur inconnue = éteint", async () => {
    expect(await formulesActives(reglage(undefined), { console: true })).toBe(false);
    expect(await formulesActives(reglage({ etat: "n'importe" }), { console: true })).toBe(false);
  });

  it("utilitaire pur", () => {
    expect(formulesActivesPourEtat("essai", true)).toBe(true);
    expect(formulesActivesPourEtat("essai", false)).toBe(false);
    expect(formulesActivesPourEtat("eteint", true)).toBe(false);
    expect(formulesActivesPourEtat("actif", false)).toBe(true);
  });

  it("le lot est déclaré dans l'écran des interrupteurs", () => {
    expect(estLotInterrupteurConnu("devis_formules")).toBe(true);
  });
});
