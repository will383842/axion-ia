// @vitest-environment node

/**
 * SANS VARIABLES D'ENVIRONNEMENT, RIEN NE S'ACTIVE — ET LE COMPARTIMENT DES
 * SAUVEGARDES EST REFUSÉ (ADR 0065, lot L4).
 *
 * La bibliothèque est éteinte par défaut : tant qu'une variable manque, chaque
 * fonction du dépôt rend « pas encore activée » AVANT de toucher la base ou le
 * stockage. Les deux sont ici des pièges qui lèvent : un seul appel ferait rougir.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { piege } = vi.hoisted(() => ({
  piege: (nom: string) =>
    vi.fn(() => {
      throw new Error(`appel interdit : ${nom}`);
    }),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: new Proxy(
    {},
    {
      get: (_c, table) =>
        new Proxy({}, { get: (_t, m) => piege(`prisma.${String(table)}.${String(m)}`) }),
    },
  ),
}));
vi.mock("@/lib/r2-storage", () => ({
  ouvrirEnvoiMorceauxR2: piege("ouvrirEnvoiMorceauxR2"),
  signerMorceauR2: piege("signerMorceauR2"),
  listerMorceauxR2: piege("listerMorceauxR2"),
  assemblerEnvoiR2: piege("assemblerEnvoiR2"),
  arreterEnvoiR2: piege("arreterEnvoiR2"),
  tailleObjetR2: piege("tailleObjetR2"),
  signerLectureR2: piege("signerLectureR2"),
  fluxObjetR2: piege("fluxObjetR2"),
}));
vi.mock("@/server/careers/clamav", () => ({ analyserFlux: piege("analyserFlux") }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));

import {
  COMPARTIMENTS_INTERDITS,
  configPartages,
  partagesActifs,
  raisonExtinction,
} from "../config";
import {
  abandonnerDepot,
  adresseTelechargement,
  ajouterLienExterne,
  archiverFichier,
  commencerDepot,
  reafficherFichier,
  relancerAnalysesPartagesEnAttente,
  reprendreDepot,
  signerMorceaux,
  terminerDepot,
} from "../depot";

const VARIABLES = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "R2_BUCKET_IMMUTABLE",
  "R2_PARTAGES_BUCKET_NAME",
  "R2_PARTAGES_ACCESS_KEY_ID",
  "R2_PARTAGES_SECRET_ACCESS_KEY",
  "PARTAGES_SECRET",
];
const sauvegarde: Record<string, string | undefined> = {};

const COMPLET = {
  R2_ACCOUNT_ID: "compte",
  R2_PARTAGES_BUCKET_NAME: "axion-ia-partages",
  R2_PARTAGES_ACCESS_KEY_ID: "cle",
  R2_PARTAGES_SECRET_ACCESS_KEY: "secret-cle",
  PARTAGES_SECRET: "x".repeat(32),
};

beforeEach(() => {
  for (const v of VARIABLES) {
    sauvegarde[v] = process.env[v];
    delete process.env[v];
  }
});
afterEach(() => {
  for (const v of VARIABLES) {
    if (sauvegarde[v] === undefined) delete process.env[v];
    else process.env[v] = sauvegarde[v];
  }
});

const ID = "11111111-1111-4111-8111-111111111111";
const AUTEUR = { id: "22222222-2222-4222-8222-222222222222", nom: "Will" };

describe("sans variables d'environnement, rien ne s'active", () => {
  it("l'interrupteur est éteint et dit pourquoi", () => {
    expect(partagesActifs({})).toBe(false);
    expect(configPartages({})).toBeNull();
    expect(raisonExtinction({})).toMatch(/compartiment/);
  });

  it("chaque variable manquante, à elle seule, éteint la bibliothèque", () => {
    expect(partagesActifs(COMPLET)).toBe(true);
    for (const cle of Object.keys(COMPLET)) {
      const env: Record<string, string> = { ...COMPLET };
      delete env[cle];
      expect(partagesActifs(env), cle).toBe(false);
    }
    expect(partagesActifs({ ...COMPLET, PARTAGES_SECRET: "trop-court" })).toBe(false);
  });

  it("les clés R2 GÉNÉRALES ne servent jamais de repli : il faut le jeton dédié (relecture sécurité)", () => {
    const sansJeton: Record<string, string> = {
      ...COMPLET,
      R2_ACCESS_KEY_ID: "cle-generale",
      R2_SECRET_ACCESS_KEY: "secret-general",
    };
    delete sansJeton.R2_PARTAGES_ACCESS_KEY_ID;
    delete sansJeton.R2_PARTAGES_SECRET_ACCESS_KEY;
    expect(partagesActifs(sansJeton)).toBe(false);
    expect(raisonExtinction(sansJeton)).toBe(
      "le jeton dédié au compartiment de la bibliothèque n'est pas encore réglé",
    );
    const moitie = { ...sansJeton, R2_PARTAGES_ACCESS_KEY_ID: "cle" };
    expect(partagesActifs(moitie)).toBe(false);
    expect(configPartages({ ...COMPLET, R2_ACCESS_KEY_ID: "cle-generale" })?.accessKeyId).toBe(
      "cle",
    );
  });

  it("aucune fonction du dépôt ne touche la base ni le stockage", async () => {
    const resultats = await Promise.all([
      commencerDepot({ nom: "a.cube", taille: 10, categorie: "lut" }, AUTEUR),
      signerMorceaux(ID, [1]),
      reprendreDepot(ID),
      terminerDepot(ID),
      abandonnerDepot(ID),
      ajouterLienExterne(
        { url: "https://drive.google.com/x", titre: "x", categorie: "rushs" },
        AUTEUR,
      ),
      archiverFichier(ID, AUTEUR),
      reafficherFichier(ID),
      adresseTelechargement(ID),
    ]);
    for (const r of resultats) {
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.erreur).toMatch(/pas encore activée/);
    }
    await expect(relancerAnalysesPartagesEnAttente()).resolves.toBeUndefined();
  });
});

describe("le compartiment des sauvegardes est refusé", () => {
  it("par son nom connu", () => {
    for (const b of COMPARTIMENTS_INTERDITS) {
      expect(partagesActifs({ ...COMPLET, R2_PARTAGES_BUCKET_NAME: b }), b).toBe(false);
      expect(raisonExtinction({ ...COMPLET, R2_PARTAGES_BUCKET_NAME: b })).toMatch(/sauvegardes/);
    }
  });

  it("par le nom configuré des sauvegardes, quel qu'il soit", () => {
    expect(
      partagesActifs({
        ...COMPLET,
        R2_BUCKET_NAME: "mes-sauvegardes",
        R2_PARTAGES_BUCKET_NAME: "mes-sauvegardes",
      }),
    ).toBe(false);
    expect(
      partagesActifs({
        ...COMPLET,
        R2_BUCKET_IMMUTABLE: "immuable",
        R2_PARTAGES_BUCKET_NAME: "immuable",
      }),
    ).toBe(false);
  });

  it("le dépôt ne s'ouvre pas sur le compartiment des sauvegardes", async () => {
    Object.assign(process.env, COMPLET, { R2_PARTAGES_BUCKET_NAME: "axion-ia-backups" });
    const r = await commencerDepot({ nom: "a.cube", taille: 10, categorie: "lut" }, AUTEUR);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreur).toMatch(/sauvegardes/);
  });
});
