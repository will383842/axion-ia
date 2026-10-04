// @vitest-environment node
/**
 * Lot A9 — le relevé INSEE lit le SIREN par `sirenDuClient` : une fiche qui
 * n'a qu'un SIRET (14 chiffres) est relevée sur les 9 premiers.
 *
 * Mutation qui fait rougir : relire `fiche.siren` seul dans
 * `rafraichirEffectifInsee`.
 * Contre-témoin : ni SIREN ni SIRET valide → « sans_siren », aucun appel.
 */

import { describe, expect, it, vi } from "vitest";

import { rafraichirEffectifInsee } from "../effectif-insee";

const CLIENT_ID = "00000000-0000-4000-8000-000000000c12";

function base(fiche: { siren: string | null; siret: string | null }) {
  return {
    client: {
      findUnique: vi.fn(async () => ({
        ...fiche,
        type: "entreprise",
        effectif: null,
        effectifSource: null,
      })),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
  };
}

describe("relevé INSEE d'une fiche qui n'a que son SIRET", () => {
  it("interroge l'annuaire sur les 9 premiers chiffres du SIRET", async () => {
    const db = base({ siren: null, siret: "90143483700018" });
    const urls: string[] = [];
    const r = await rafraichirEffectifInsee(db as never, CLIENT_ID, {
      fetch: async (url: string) => {
        urls.push(url);
        return new Response(
          JSON.stringify({
            results: [{ siren: "901434837", nom_complet: "SCI", tranche_effectif_salarie: "01" }],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
    });
    expect(r.statut).toBe("pose");
    expect(urls.join(" ")).toContain("901434837");
  });

  it("contre-témoin : SIRET à la clé fausse → sans_siren, aucun appel", async () => {
    const db = base({ siren: null, siret: "90143483700019" });
    const fetch = vi.fn();
    const r = await rafraichirEffectifInsee(db as never, CLIENT_ID, { fetch });
    expect(r.statut).toBe("sans_siren");
    expect(fetch).not.toHaveBeenCalled();
  });
});
