/**
 * ⛔ LE RATTRAPAGE DU SIREN EST IDEMPOTENT (chantier visio, PR 2).
 *
 * `scripts/visio/deriver-siren.ts` sera lancé en production, à la main, puis
 * peut-être relancé. Trois promesses, chacune vérifiée ici sur une base en
 * mémoire :
 *   · essai à blanc par défaut : RIEN n'est écrit sans `--appliquer` ;
 *   · un second lancement réel ne change plus rien ;
 *   · un SIREN présent qui contredit le SIRET n'est JAMAIS écrasé.
 *
 * Mutation qui fait rougir : retirer la condition « SIREN vide » de la requête
 * d'écriture, ou ne plus sauter les SIREN contradictoires.
 */

import { describe, expect, it } from "vitest";
import { deriverSiren, type BaseClientsSiren } from "../../../scripts/visio/deriver-siren";

type Fiche = { id: string; siret: string | null; siren: string | null };

function baseEnMemoire(fiches: Fiche[]): BaseClientsSiren & { lignes: Fiche[]; ecritures: number } {
  const lignes = fiches.map((f) => ({ ...f }));
  const base = {
    lignes,
    ecritures: 0,
    client: {
      async findMany() {
        return lignes
          .filter((l) => l.siret !== null)
          .map((l) => ({ ...l }))
          .sort((a, b) => a.id.localeCompare(b.id));
      },
      async updateMany(args: {
        where: { id: string; OR: Array<{ siren: null } | { siren: "" }> };
        data: { siren: string };
      }) {
        const vides = new Set(args.where.OR.map((c) => c.siren));
        let count = 0;
        for (const l of lignes) {
          if (l.id === args.where.id && vides.has(l.siren as null | "")) {
            l.siren = args.data.siren;
            count += 1;
          }
        }
        base.ecritures += count;
        return { count };
      },
    },
  };
  return base;
}

const FICHES: Fiche[] = [
  { id: "a", siret: "73282932000074", siren: null },
  { id: "b", siret: "73282932000074", siren: "" },
  { id: "c", siret: "73282932000074", siren: "732829320" },
  // SIREN à clé valide, mais d'une autre entreprise : contradictoire.
  { id: "d", siret: "73282932000074", siren: "552100554" },
  { id: "e", siret: "00000000000000", siren: null },
  { id: "f", siret: null, siren: null },
];

describe("le rattrapage du SIREN est idempotent", () => {
  it("essai à blanc : compte, mais n'écrit rien", async () => {
    const base = baseEnMemoire(FICHES);
    const bilan = await deriverSiren(base, { appliquer: false });
    expect(bilan).toEqual({
      examinees: 5,
      dejaJustes: 1,
      aCompleter: 2,
      completees: 0,
      contradictoires: 1,
      siretInvalides: 1,
    });
    expect(base.ecritures).toBe(0);
  });

  it("premier lancement réel : complète les fiches sans SIREN", async () => {
    const base = baseEnMemoire(FICHES);
    const bilan = await deriverSiren(base, { appliquer: true });
    expect(bilan.completees).toBe(2);
    expect(base.lignes.find((l) => l.id === "a")?.siren).toBe("732829320");
    expect(base.lignes.find((l) => l.id === "b")?.siren).toBe("732829320");
  });

  it("second lancement réel : plus rien à écrire", async () => {
    const base = baseEnMemoire(FICHES);
    await deriverSiren(base, { appliquer: true });
    const ecrituresApresPremier = base.ecritures;
    const second = await deriverSiren(base, { appliquer: true });
    expect(second.aCompleter).toBe(0);
    expect(second.completees).toBe(0);
    expect(second.dejaJustes).toBe(3);
    expect(base.ecritures).toBe(ecrituresApresPremier);
  });

  it("un SIREN contraire au SIRET n'est jamais écrasé", async () => {
    const base = baseEnMemoire(FICHES);
    await deriverSiren(base, { appliquer: true });
    expect(base.lignes.find((l) => l.id === "d")?.siren).toBe("552100554");
  });

  it("rien n'est dérivé d'un SIRET de remplissage", async () => {
    const base = baseEnMemoire(FICHES);
    await deriverSiren(base, { appliquer: true });
    expect(base.lignes.find((l) => l.id === "e")?.siren).toBeNull();
  });
});
