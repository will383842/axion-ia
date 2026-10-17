// @vitest-environment node

/**
 * CHANTIER QNC, L00 — LES INTERRUPTEURS `qualiopi.<lot>.actif` À TROIS VALEURS.
 *
 * Logique pure : clé absente ou illisible = éteint ; `essai` n'agit que sur le
 * banc d'essai ; une bascule écrit le réglage ET sa ligne de journal dans la
 * même transaction, et pas de bascule sans trace. La preuve contre la vraie
 * base (colonnes typées, fonction SQL qui lit pareil) est en Gate D.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import {
  basculerInterrupteurQualiopi,
  cleInterrupteurQualiopi,
  estActifPour,
  etatDepuisValeur,
  lireInterrupteurQualiopi,
  valeurDepuisEtat,
  type EtatInterrupteur,
} from "../interrupteurs";

describe("clé et valeur d'un interrupteur", () => {
  it("la clé est `qualiopi.<lot>.actif`", () => {
    expect(cleInterrupteurQualiopi("l03")).toBe("qualiopi.l03.actif");
  });

  it("un lot mal formé lève (une faute de frappe n'invente pas de clé)", () => {
    for (const lot of ["", "L03", "l03.actif", "l 03", "x".repeat(41)]) {
      expect(() => cleInterrupteurQualiopi(lot), lot).toThrow(/lot invalide/);
    }
  });

  it("clé absente, valeur inconnue ou mal formée : éteint", () => {
    for (const v of [
      undefined,
      null,
      true,
      "actif",
      ["actif"],
      {},
      { etat: "on" },
      { actif: true },
    ]) {
      expect(etatDepuisValeur(v), JSON.stringify(v)).toBe("eteint");
    }
  });

  it("les trois valeurs se relisent telles qu'écrites", () => {
    for (const e of ["eteint", "essai", "actif"] as const) {
      expect(etatDepuisValeur(valeurDepuisEtat(e))).toBe(e);
    }
  });
});

describe("à qui le lot s'applique", () => {
  const test = { estTestInterne: true };
  const reelle = { estTestInterne: false };

  it("éteint : rien ne change, pour personne", () => {
    expect([
      estActifPour("eteint", test),
      estActifPour("eteint", reelle),
      estActifPour("eteint", null),
    ]).toEqual([false, false, false]);
  });

  it("essai : seulement le banc d'essai (et jamais sans cible)", () => {
    expect([
      estActifPour("essai", test),
      estActifPour("essai", reelle),
      estActifPour("essai", null),
    ]).toEqual([true, false, false]);
  });

  it("actif : tout le monde", () => {
    expect([
      estActifPour("actif", test),
      estActifPour("actif", reelle),
      estActifPour("actif", null),
    ]).toEqual([true, true, true]);
  });
});

describe("lecture", () => {
  it("une base qui lève, ou rend null (build stub.invalid), vaut éteint", async () => {
    const leve = { setting: { findUnique: vi.fn().mockRejectedValue(new Error("P2021")) } };
    const vide = { setting: { findUnique: vi.fn().mockResolvedValue(null) } };
    expect(await lireInterrupteurQualiopi("l03", leve as never)).toBe("eteint");
    expect(await lireInterrupteurQualiopi("l03", vide as never)).toBe("eteint");
  });

  it("lit la clé du lot", async () => {
    const findUnique = vi.fn().mockResolvedValue({ value: { etat: "essai" } });
    expect(await lireInterrupteurQualiopi("l03", { setting: { findUnique } } as never)).toBe(
      "essai",
    );
    expect(findUnique).toHaveBeenCalledWith({
      where: { key: cleInterrupteurQualiopi("l03") },
      select: { value: true },
    });
  });
});

describe("bascule", () => {
  function faux(valeurAvant: unknown, journalLeve = false) {
    const ordre: string[] = [];
    const tx = {
      $executeRaw: vi.fn(async () => {
        ordre.push("verrou");
        return 1;
      }),
      setting: {
        findUnique: vi.fn(async () => {
          ordre.push("lecture");
          return valeurAvant === undefined ? null : { value: valeurAvant };
        }),
        upsert: vi.fn(async () => {
          ordre.push("reglage");
          return {};
        }),
      },
      activityLog: {
        create: vi.fn(async (_args: { data: Record<string, unknown> }) => {
          ordre.push("journal");
          if (journalLeve) throw new Error("journal refusé");
          return {};
        }),
      },
    };
    const client = { $transaction: <T>(fn: (t: typeof tx) => Promise<T>) => fn(tx) };
    return { tx, client, ordre };
  }

  it("écrit le réglage et sa ligne de journal (qui, avant, après), verrou d'abord", async () => {
    const { tx, client, ordre } = faux(undefined);
    const r = await basculerInterrupteurQualiopi(
      { lot: "l03", etat: "essai", adminUserId: "00000000-0000-4000-8000-000000000001" },
      client as never,
    );
    expect(r).toEqual({ cle: "qualiopi.l03.actif", avant: "eteint", apres: "essai" });
    expect(ordre).toEqual(["verrou", "lecture", "reglage", "journal"]);
    expect(tx.setting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: cleInterrupteurQualiopi("l03") },
        update: { value: { etat: "essai" }, updatedBy: "00000000-0000-4000-8000-000000000001" },
      }),
    );
    expect(tx.activityLog.create.mock.calls[0]?.[0]?.data).toMatchObject({
      adminUserId: "00000000-0000-4000-8000-000000000001",
      action: "qualiopi.interrupteur_bascule",
      targetType: "setting",
      targetId: null,
      changes: { cle: "qualiopi.l03.actif", avant: "eteint", apres: "essai" },
    });
  });

  it("l'« avant » est l'état relu dans la transaction", async () => {
    const { client } = faux({ etat: "actif" });
    const r = await basculerInterrupteurQualiopi(
      { lot: "l03", etat: "eteint", adminUserId: "00000000-0000-4000-8000-000000000001" },
      client as never,
    );
    expect(r.avant).toBe("actif");
  });

  it("sans trace, pas de bascule : un journal refusé fait échouer la transaction", async () => {
    const { client } = faux(undefined, true);
    await expect(
      basculerInterrupteurQualiopi(
        { lot: "l03", etat: "actif", adminUserId: "00000000-0000-4000-8000-000000000001" },
        client as never,
      ),
    ).rejects.toThrow(/journal refusé/);
  });

  it("un état hors des trois valeurs est refusé avant toute écriture", async () => {
    const { tx, client } = faux(undefined);
    await expect(
      basculerInterrupteurQualiopi(
        { lot: "l03", etat: "on" as EtatInterrupteur, adminUserId: "x" },
        client as never,
      ),
    ).rejects.toThrow(/état invalide/);
    expect(tx.setting.upsert).not.toHaveBeenCalled();
  });
});
