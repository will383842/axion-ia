/**
 * La fiche se crée même si l'annuaire des entreprises est en panne (plan
 * §3.17 point 4) : l'annuaire PROPOSE un SIREN, il n'est jamais sur le chemin
 * de la création.
 *
 *   · panne réseau, réponse 500, ou délai de 3 s dépassé : `rechercherSiren`
 *     rend « indisponible » et ne lève jamais ;
 *   · la porte de création n'importe pas l'annuaire : une fiche sans SIREN se
 *     crée (badge « SIREN à compléter » sur la fiche).
 *
 * Mutation qui fait rougir : laisser `rechercherSiren` propager l'erreur, ou
 * appeler l'annuaire depuis `porte-client.ts`.
 * Contre-témoin : une réponse correcte rend des propositions (SIREN valides
 * seulement), et le cache de 24 h évite un second appel.
 * Angle mort : le vrai service n'est pas appelé en test (réseau coupé en CI).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DELAI_ANNUAIRE_MS,
  rechercherSiren,
  viderCacheAnnuaire,
} from "@/features/dossier-client/recherche-entreprises";
import { creerOuRetrouverClient } from "../porte-client";
import { baseEnMemoire, commePrisma } from "./_base-en-memoire";

afterEach(() => {
  viderCacheAnnuaire();
  vi.useRealTimers();
});

describe("la fiche se crée même si l'annuaire est en panne", () => {
  it("panne réseau → indisponible, sans lever", async () => {
    const r = await rechercherSiren("Fictive", "Lyon", {
      fetch: () => Promise.reject(new Error("ECONNREFUSED")),
    });
    expect(r).toEqual({ ok: false, motif: "indisponible" });
  });

  it("réponse 500 → indisponible", async () => {
    const r = await rechercherSiren("Fictive", null, {
      fetch: async () => new Response("boom", { status: 500 }),
    });
    expect(r).toEqual({ ok: false, motif: "indisponible" });
  });

  it("au-delà de 3 s → abandon, indisponible", async () => {
    vi.useFakeTimers();
    const attente = rechercherSiren("Lente", null, {
      fetch: (_u, init) =>
        new Promise((_, rejeter) => {
          init?.signal?.addEventListener("abort", () => rejeter(new Error("abort")));
        }),
    });
    await vi.advanceTimersByTimeAsync(DELAI_ANNUAIRE_MS + 10);
    expect(await attente).toEqual({ ok: false, motif: "indisponible" });
    expect(DELAI_ANNUAIRE_MS).toBe(3000);
  });

  it("la porte de création ne dépend pas de l'annuaire", async () => {
    const source = readFileSync(
      join(process.cwd(), "src/server/qualiopi/crm/porte-client.ts"),
      "utf8",
    );
    expect(source).toContain("creerOuRetrouverClient");
    expect(source).not.toMatch(/recherche-entreprises|rechercherSiren/);
    const db = baseEnMemoire();
    const r = await creerOuRetrouverClient(
      commePrisma(db),
      { raisonSociale: "Fiche sans SIREN" },
      null,
      { parAdminId: null },
    );
    expect(r.statut).toBe("cree");
    expect(db.etat.clients[0]?.siren).toBeNull();
  });

  it("contre-témoin : une réponse correcte propose des SIREN, mise en cache 24 h", async () => {
    const appel = vi.fn(async () =>
      Response.json({
        results: [
          {
            siren: "732829320",
            nom_complet: "FICTIVE SAS",
            siege: { libelle_commune: "LYON", code_postal: "69001" },
          },
          { siren: "123", nom_complet: "SIREN INVALIDE" },
        ],
      }),
    );
    const r = await rechercherSiren("Fictive", "Lyon", { fetch: appel, maintenant: 1000 });
    expect(r).toEqual({
      ok: true,
      propositions: [
        { siren: "732829320", nom: "FICTIVE SAS", ville: "LYON", codePostal: "69001" },
      ],
    });
    await rechercherSiren("FICTIVE", "lyon", { fetch: appel, maintenant: 2000 });
    expect(appel).toHaveBeenCalledTimes(1);
  });
});
