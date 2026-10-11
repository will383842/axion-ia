/**
 * Lot L2c (ADR 0066) — référentiel des communes : lecture de la réponse de
 * geo.api.gouv.fr (module pur) et passage mensuel (dépendances injectées).
 */

import { describe, expect, it, vi } from "vitest";

import {
  MINIMUM_COMMUNES_ATTENDUES,
  analyserCommunesGeo,
  departementDeCommune,
  referentielAJour,
} from "../communes-geo";
import {
  lireCorpsBorne,
  passerCommunesGeo,
  type DepsPassageCommunes,
} from "../communes-geo-passage";

const AJACCIO = {
  code: "2A004",
  nom: "Ajaccio",
  codesPostaux: ["20000", "20090"],
  centre: { type: "Point", coordinates: [8.7058, 41.9228] },
  codeDepartement: "2A",
  population: 73_000,
};
const POINTE_A_PITRE = {
  code: "97120",
  nom: "Pointe-à-Pitre",
  codesPostaux: ["97110"],
  centre: { type: "Point", coordinates: [-61.5331, 16.2411] },
  codeDepartement: "971",
  population: 15_000,
};

describe("analyserCommunesGeo", () => {
  it("lit [longitude, latitude] dans cet ordre — jamais l'inverse", () => {
    const { communes } = analyserCommunesGeo([AJACCIO]);
    expect(communes[0]).toMatchObject({ latitude: 41.9228, longitude: 8.7058 });
  });

  it("garde le département du référentiel (Corse 2A, DOM à 3 chiffres)", () => {
    const { communes } = analyserCommunesGeo([AJACCIO, POINTE_A_PITRE]);
    expect(communes.map((c) => c.departement)).toEqual(["2A", "971"]);
    expect(communes[0]).toMatchObject({
      codeInsee: "2A004",
      nom: "Ajaccio",
      codesPostaux: ["20000", "20090"],
      population: 73_000,
    });
  });

  it("écarte une ligne illisible sans faire tomber les autres", () => {
    const { communes, rejets } = analyserCommunesGeo([
      AJACCIO,
      { code: "123", nom: "X", centre: { coordinates: [1, 2] }, codeDepartement: "01" },
      { code: "01001", nom: "Sans centre", codeDepartement: "01" },
      {
        code: "01002",
        nom: "Hors bornes",
        centre: { coordinates: [200, 95] },
        codeDepartement: "01",
      },
      null,
    ]);
    expect(communes).toHaveLength(1);
    expect(rejets).toBe(4);
  });

  it("un code INSEE en double : le second est écarté (Postgres refuserait le paquet)", () => {
    const { communes, rejets } = analyserCommunesGeo([AJACCIO, { ...AJACCIO, nom: "Doublon" }]);
    expect(communes.map((c) => c.nom)).toEqual(["Ajaccio"]);
    expect(rejets).toBe(1);
  });

  it("une réponse qui n'est pas une liste ne rend rien", () => {
    expect(analyserCommunesGeo({ erreur: true })).toEqual({
      communes: [],
      rejets: 0,
      lisible: false,
    });
  });

  it("code postal mal formé : écarté du tableau, la commune reste", () => {
    const { communes } = analyserCommunesGeo([{ ...AJACCIO, codesPostaux: ["20000", "2A0", 5] }]);
    expect(communes[0]?.codesPostaux).toEqual(["20000"]);
  });
});

describe("departementDeCommune", () => {
  it.each([
    ["75108", "75"],
    ["2A004", "2A"],
    ["2B033", "2B"],
    ["97101", "971"],
    ["97611", "976"],
    ["01053", "01"],
  ])("%s → %s", (insee, dep) => {
    expect(departementDeCommune(insee)).toBe(dep);
  });

  it("code illisible → null", () => {
    expect(departementDeCommune("123")).toBeNull();
    expect(departementDeCommune("")).toBeNull();
  });
});

describe("referentielAJour", () => {
  const maintenant = new Date("2026-11-15T08:00:00Z");
  it("vide → à refaire", () => expect(referentielAJour(null, maintenant)).toBe(false));
  it("moins de 30 jours → à jour", () =>
    expect(referentielAJour(new Date("2026-10-20T08:00:00Z"), maintenant)).toBe(true));
  it("30 jours ou plus → à refaire", () =>
    expect(referentielAJour(new Date("2026-10-16T08:00:00Z"), maintenant)).toBe(false));
});

function deps(over: Partial<DepsPassageCommunes> = {}): DepsPassageCommunes {
  const beaucoup = Array.from({ length: MINIMUM_COMMUNES_ATTENDUES }, (_, i) => ({
    ...AJACCIO,
    code: String(10000 + i),
  }));
  return {
    envoiAllume: vi.fn(async () => true),
    derniereMaj: vi.fn(async () => null),
    telecharger: vi.fn(async () => beaucoup),
    ecrire: vi.fn(async (c) => c.length),
    ...over,
  };
}

describe("passerCommunesGeo", () => {
  const maintenant = new Date("2026-11-15T08:00:00Z");

  it("interrupteur absent ou coupé : aucun appel réseau, aucune écriture", async () => {
    const d = deps({ envoiAllume: vi.fn(async () => false) });
    expect(await passerCommunesGeo(maintenant, d)).toMatchObject({ etat: "coupe" });
    expect(d.telecharger).not.toHaveBeenCalled();
    expect(d.ecrire).not.toHaveBeenCalled();
  });

  it("référentiel de moins de 30 jours : rien", async () => {
    const d = deps({ derniereMaj: vi.fn(async () => new Date("2026-11-01T08:00:00Z")) });
    expect(await passerCommunesGeo(maintenant, d)).toMatchObject({ etat: "a_jour" });
    expect(d.telecharger).not.toHaveBeenCalled();
  });

  it("allumé et périmé : un seul téléchargement, puis écriture datée du passage", async () => {
    const d = deps();
    const bilan = await passerCommunesGeo(maintenant, d);
    expect(bilan).toMatchObject({ etat: "ecrit", ecrites: MINIMUM_COMMUNES_ATTENDUES });
    expect(d.telecharger).toHaveBeenCalledTimes(1);
    expect(d.ecrire).toHaveBeenCalledWith(expect.any(Array), maintenant);
  });

  it("réponse tronquée (moins que le minimum) : REFUS, rien n'est écrit", async () => {
    const d = deps({ telecharger: vi.fn(async () => [AJACCIO]) });
    expect(await passerCommunesGeo(maintenant, d)).toMatchObject({ etat: "refuse" });
    expect(d.ecrire).not.toHaveBeenCalled();
  });

  it("réseau en panne : bilan « echec », jamais d'exception", async () => {
    const d = deps({ telecharger: vi.fn(async () => Promise.reject(new Error("timeout"))) });
    expect(await passerCommunesGeo(maintenant, d)).toMatchObject({ etat: "echec" });
    expect(d.ecrire).not.toHaveBeenCalled();
  });
});

describe("le passage tourne dans le worker (tsx, hors de Next)", () => {
  it("aucun module du passage n'importe server-only, next/* ni next-auth", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const fichiers = [
      "src/server/qualiopi/formateurs-proches/communes-geo.ts",
      "src/server/qualiopi/formateurs-proches/communes-geo-passage.ts",
      "src/server/qualiopi/formateurs-proches/communes-geo-ecriture.ts",
      "src/server/qualiopi/formateurs-independants/interrupteurs-envoi.ts",
      "src/server/qualiopi/formateurs-independants/interrupteurs.ts",
    ];
    for (const f of fichiers) {
      const src = readFileSync(join(process.cwd(), f), "utf8");
      expect(src, f).not.toMatch(/["'](?:server-only|next\/[^"']*|next-auth)["']/);
      expect(src, f).not.toMatch(/^\s*["']use server["']/m);
    }
  });
});

describe("lireCorpsBorne", () => {
  it("lit un corps sous la limite", async () => {
    expect(await lireCorpsBorne(new Response("[1,2]"), 100)).toEqual([1, 2]);
  });
  it("refuse au-delà de la limite, annoncée ou reçue", async () => {
    await expect(
      lireCorpsBorne(new Response("[1]", { headers: { "content-length": "999" } }), 10),
    ).rejects.toThrow(/volumineuse/);
    await expect(lireCorpsBorne(new Response(JSON.stringify("x".repeat(50))), 10)).rejects.toThrow(
      /volumineuse/,
    );
  });
});
