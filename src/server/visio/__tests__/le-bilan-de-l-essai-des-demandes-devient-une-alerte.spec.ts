// @vitest-environment node
/**
 * Le bilan de l'essai à blanc de la fiche des demandes devient UNE alerte lisible par jour
 * (nombres seulement). Mode `true` ou coupé : aucune alerte. Une panne d'alerte ne bloque rien.
 */

import { describe, expect, it, vi } from "vitest";

import { dossierEnMemoire } from "@/features/dossier-client/__tests__/_dossier-en-memoire";
import type { BilanFichesDemande } from "@/features/dossier-client/fiche-demande";

const etat = vi.hoisted(() => ({ bilan: null as unknown }));
vi.mock("@/features/dossier-client/fiche-demande", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/dossier-client/fiche-demande")>()),
  assurerLesFichesDemande: async () => etat.bilan,
}));

import { passerBalayage } from "../balayage";

const MAINTENANT = new Date("2026-10-08T14:00:00Z");
const CODE = "visio.fiche_demande_bilan_essai";

function bilan(sur: Partial<BilanFichesDemande>): BilanFichesDemande {
  return {
    mode: "essai",
    creees: 0,
    liees: 0,
    doutes: 0,
    plantees: 0,
    creeraient: 0,
    lieraient: 0,
    doublons: [],
    colonneAbsente: false,
    refusAbandonnes: 0,
    dateManquante: false,
    ...sur,
  };
}

async function passer(b: BilanFichesDemande, creerAlerte: (...i: never[]) => Promise<unknown>) {
  etat.bilan = b;
  const base = dossierEnMemoire();
  return passerBalayage(base.client as never, {
    maintenant: MAINTENANT,
    notifier: vi.fn() as never,
    creerAlerte: creerAlerte as never,
  });
}

describe("le bilan de l'essai des demandes devient une alerte", () => {
  it("le mode essai crée l'alerte, avec les bons nombres et le jour de Paris pour cible", async () => {
    const creer = vi.fn(async (_a: { code: string }) => null);
    await passer(bilan({ creeraient: 3, lieraient: 2, doutes: 1, colonneAbsente: true }), creer);
    const appels = (creer.mock.calls as unknown as Array<[Record<string, unknown>]>).filter(
      ([a]) => a["code"] === CODE,
    );
    expect(appels).toHaveLength(1);
    const a = appels[0]![0];
    expect(a["message"]).toBe(
      "Essai à blanc des fiches des demandes : créerait 3, lierait 2, douterait 1, planterait 0 ; " +
        "colonne absente oui ; date d'activation manquante non",
    );
    expect(a["cibleId"]).toBe("2026-10-08");
  });

  it("essai sans rien à dire : pas d'alerte", async () => {
    const creer = vi.fn(async (_a: { code: string }) => null);
    await passer(bilan({}), creer);
    expect(creer.mock.calls.some(([a]) => a.code === CODE)).toBe(false);
  });

  it("mode true ou coupé : pas d'alerte", async () => {
    for (const mode of ["actif", "coupe"] as const) {
      const creer = vi.fn(async (_a: { code: string }) => null);
      await passer(bilan({ mode, creeraient: 5, dateManquante: true }), creer);
      expect(creer.mock.calls.some(([a]) => a.code === CODE)).toBe(false);
    }
  });

  it("une panne de création d'alerte n'empêche pas le reste du balayage", async () => {
    const creer = vi.fn(async (a: { code: string }) => {
      if (a.code === CODE) throw new Error("base indisponible");
      return null;
    });
    const r = await passer(bilan({ creeraient: 1 }), creer as never);
    expect(r.etapesEnEchec).toEqual([]);
    expect(r.couverture).not.toBeNull();
  });
});
