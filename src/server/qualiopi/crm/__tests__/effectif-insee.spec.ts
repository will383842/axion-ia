// @vitest-environment node
/**
 * Lot OPCO A7d — l'effectif relevé à l'INSEE (tranche de l'unité légale).
 *
 * Témoins :
 *   · tranche INSEE → BORNE BASSE (11 « 10 à 19 » → 10 ; 12 → 20 ; 21 → 50) ;
 *   · une SAISIE n'est jamais écrasée ;
 *   · un relevé INSEE antérieur est rafraîchi ;
 *   · annuaire en panne / délai dépassé → rien d'écrit, aucune exception ;
 *   · le relevé est daté du jour civil de PARIS.
 */

import { describe, expect, it, vi } from "vitest";

import { rechercherTrancheEffectif } from "@/features/dossier-client/recherche-entreprises";
import {
  borneBasseTranche,
  effectifInseeAEcrire,
  rafraichirEffectifInsee,
  TRANCHES_EFFECTIF_INSEE,
} from "../effectif-insee";

const SIREN = "552100554";
const CLIENT_ID = "00000000-0000-4000-8000-000000000c11";

function reponseAnnuaire(tranche: string | null, siren = SIREN): Response {
  return new Response(
    JSON.stringify({
      results: [{ siren, nom_complet: "ACME", tranche_effectif_salarie: tranche }],
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

function baseEnMemoire(fiche: {
  siren: string | null;
  type?: "entreprise" | "particulier";
  effectif: number | null;
  effectifSource: "saisie" | "insee" | null;
}) {
  const etat = {
    ...fiche,
    type: fiche.type ?? "entreprise",
    effectifReleveLe: null as Date | null,
  };
  const db = {
    client: {
      findUnique: vi.fn(async () => ({ ...etat })),
      updateMany: vi.fn(
        async (args: {
          where: { id: string; OR: Array<Record<string, unknown>> };
          data: { effectif: number; effectifSource: "insee"; effectifReleveLe: Date };
        }) => {
          const garde = args.where.OR.some((c) =>
            Object.entries(c).every(([k, v]) => (etat as Record<string, unknown>)[k] === v),
          );
          if (!garde) return { count: 0 };
          Object.assign(etat, args.data);
          return { count: 1 };
        },
      ),
    },
  };
  return { db, etat };
}

describe("table des tranches INSEE → borne basse", () => {
  it("chaque code officiel rend la borne basse de sa tranche", () => {
    expect(borneBasseTranche("NN")).toBe(0);
    expect(borneBasseTranche("00")).toBe(0);
    expect(borneBasseTranche("01")).toBe(1);
    expect(borneBasseTranche("02")).toBe(3);
    expect(borneBasseTranche("03")).toBe(6);
    expect(borneBasseTranche("11")).toBe(10);
    expect(borneBasseTranche("12")).toBe(20);
    expect(borneBasseTranche("21")).toBe(50);
    expect(borneBasseTranche("22")).toBe(100);
    expect(borneBasseTranche("31")).toBe(200);
    expect(borneBasseTranche("32")).toBe(250);
    expect(borneBasseTranche("41")).toBe(500);
    expect(borneBasseTranche("42")).toBe(1000);
    expect(borneBasseTranche("51")).toBe(2000);
    expect(borneBasseTranche("52")).toBe(5000);
    expect(borneBasseTranche("53")).toBe(10000);
    expect(Object.keys(TRANCHES_EFFECTIF_INSEE)).toHaveLength(16);
  });

  it("un code hors table n'est pas deviné", () => {
    expect(borneBasseTranche("13")).toBeNull();
    expect(borneBasseTranche("")).toBeNull();
    expect(borneBasseTranche(null)).toBeNull();
  });

  it("la borne basse ne franchit jamais le seuil de 50 à tort", () => {
    // « 20 à 49 » reste sous 50 ; « 50 à 99 » est au moins 50.
    expect(borneBasseTranche("12")!).toBeLessThan(50);
    expect(borneBasseTranche("21")!).toBeGreaterThanOrEqual(50);
    // « 10 à 19 » est au moins 11 ? Non : 10 — reste sous le seuil de 11, cf. en-tête du module.
    expect(borneBasseTranche("11")!).toBeLessThan(11);
  });
});

describe("effectifInseeAEcrire — la saisie prime", () => {
  const maintenant = new Date("2026-10-04T22:30:00Z"); // 5 octobre à Paris
  it("effectif vide → posé, source insee, relevé au jour de Paris", () => {
    expect(effectifInseeAEcrire({ effectif: null, effectifSource: null }, 10, maintenant)).toEqual({
      effectif: 10,
      effectifSource: "insee",
      effectifReleveLe: new Date("2026-10-05T00:00:00.000Z"),
    });
  });
  it("relevé INSEE antérieur → rafraîchi", () => {
    expect(
      effectifInseeAEcrire({ effectif: 3, effectifSource: "insee" }, 20, maintenant)?.effectif,
    ).toBe(20);
  });
  it("saisie → jamais écrasée", () => {
    expect(effectifInseeAEcrire({ effectif: 12, effectifSource: "saisie" }, 50, maintenant)).toBe(
      null,
    );
  });
  it("effectif sans source (historique) → traité comme une saisie", () => {
    expect(effectifInseeAEcrire({ effectif: 12, effectifSource: null }, 50, maintenant)).toBe(null);
  });
});

describe("rechercherTrancheEffectif — l'annuaire", () => {
  it("lit la tranche du SIREN demandé", async () => {
    const f = vi.fn(async (_url: string) => reponseAnnuaire("11"));
    expect(await rechercherTrancheEffectif(SIREN, { fetch: f })).toEqual({
      ok: true,
      tranche: "11",
    });
    expect(String(f.mock.calls[0]![0])).toContain(`q=${SIREN}`);
  });
  it("une autre entreprise en tête de réponse n'est pas prise", async () => {
    const f = vi.fn(async () => reponseAnnuaire("53", "732829320"));
    expect(await rechercherTrancheEffectif(SIREN, { fetch: f })).toEqual({
      ok: true,
      tranche: null,
    });
  });
  it("panne réseau → null, jamais d'exception", async () => {
    const f = vi.fn(async () => {
      throw new Error("ECONNRESET");
    });
    expect(await rechercherTrancheEffectif(SIREN, { fetch: f })).toEqual({ ok: false });
  });
  it("réponse 503 → null", async () => {
    const f = vi.fn(async () => new Response("", { status: 503 }));
    expect(await rechercherTrancheEffectif(SIREN, { fetch: f })).toEqual({ ok: false });
  });
  it("SIREN invalide → aucun appel réseau", async () => {
    const f = vi.fn(async () => reponseAnnuaire("11"));
    expect(await rechercherTrancheEffectif("123", { fetch: f })).toEqual({ ok: false });
    expect(f).not.toHaveBeenCalled();
  });
});

describe("rafraichirEffectifInsee — de bout en bout", () => {
  const maintenant = new Date("2026-10-04T10:00:00Z");

  it("tranche 11 sur une fiche sans effectif → 10, source insee", async () => {
    const { db, etat } = baseEnMemoire({ siren: SIREN, effectif: null, effectifSource: null });
    const r = await rafraichirEffectifInsee(db as never, CLIENT_ID, {
      fetch: async () => reponseAnnuaire("11"),
      maintenant,
    });
    expect(r).toEqual({ statut: "pose", effectif: 10, tranche: "11" });
    expect(etat.effectif).toBe(10);
    expect(etat.effectifSource).toBe("insee");
    expect(etat.effectifReleveLe).toEqual(new Date("2026-10-04T00:00:00.000Z"));
  });

  it("saisie en base → conservée, aucun appel réseau", async () => {
    const { db, etat } = baseEnMemoire({ siren: SIREN, effectif: 42, effectifSource: "saisie" });
    const f = vi.fn(async () => reponseAnnuaire("21"));
    const r = await rafraichirEffectifInsee(db as never, CLIENT_ID, { fetch: f, maintenant });
    expect(r.statut).toBe("saisie_conservee");
    expect(f).not.toHaveBeenCalled();
    expect(etat.effectif).toBe(42);
    expect(db.client.updateMany).not.toHaveBeenCalled();
  });

  it("saisie posée PENDANT l'appel → la garde d'écriture la protège", async () => {
    const { db, etat } = baseEnMemoire({ siren: SIREN, effectif: null, effectifSource: null });
    const r = await rafraichirEffectifInsee(db as never, CLIENT_ID, {
      fetch: async () => {
        etat.effectif = 30;
        etat.effectifSource = "saisie";
        return reponseAnnuaire("11");
      },
      maintenant,
    });
    expect(r.statut).toBe("saisie_conservee");
    expect(etat.effectif).toBe(30);
  });

  it("annuaire en panne → rien d'écrit, statut indisponible", async () => {
    const { db, etat } = baseEnMemoire({ siren: SIREN, effectif: null, effectifSource: null });
    const r = await rafraichirEffectifInsee(db as never, CLIENT_ID, {
      fetch: async () => {
        throw new Error("timeout");
      },
      maintenant,
    });
    expect(r.statut).toBe("indisponible");
    expect(etat.effectif).toBeNull();
  });

  it("fiche sans SIREN → aucun appel", async () => {
    const { db } = baseEnMemoire({ siren: null, effectif: null, effectifSource: null });
    const f = vi.fn(async () => reponseAnnuaire("11"));
    const r = await rafraichirEffectifInsee(db as never, CLIENT_ID, { fetch: f, maintenant });
    expect(r.statut).toBe("sans_siren");
    expect(f).not.toHaveBeenCalled();
  });

  it("particulier → aucun appel", async () => {
    const { db } = baseEnMemoire({
      siren: SIREN,
      type: "particulier",
      effectif: null,
      effectifSource: null,
    });
    const f = vi.fn(async () => reponseAnnuaire("11"));
    const r = await rafraichirEffectifInsee(db as never, CLIENT_ID, { fetch: f, maintenant });
    expect(r.statut).toBe("sans_siren");
    expect(f).not.toHaveBeenCalled();
  });

  it("tranche absente de la réponse → rien d'écrit", async () => {
    const { db, etat } = baseEnMemoire({ siren: SIREN, effectif: null, effectifSource: null });
    const r = await rafraichirEffectifInsee(db as never, CLIENT_ID, {
      fetch: async () => reponseAnnuaire(null),
      maintenant,
    });
    expect(r.statut).toBe("tranche_inconnue");
    expect(etat.effectif).toBeNull();
  });
});
