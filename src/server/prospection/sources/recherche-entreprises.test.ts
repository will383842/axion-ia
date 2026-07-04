import { describe, it, expect } from "vitest";
import { rechercheEntreprises, rechercheEntreprisesCount } from "./recherche-entreprises";

function fakeFetch(payload: unknown, ok = true, status = 200) {
  return async () => ({ ok, status, json: async () => payload });
}

describe("rechercheEntreprises", () => {
  it("parse une réponse valide", async () => {
    const r = await rechercheEntreprises(
      { departement: "38", activitePrincipale: "41.20A" },
      {
        fetchImpl: fakeFetch({
          total_results: 42,
          total_pages: 2,
          results: [{ siren: "123456789", nom_complet: "ACME" }],
        }),
      },
    );
    expect(r.total_results).toBe(42);
    expect(r.results?.[0]?.siren).toBe("123456789");
  });

  it("jette proprement si le schéma API a changé (total_results absent)", async () => {
    await expect(
      rechercheEntreprises({ departement: "38" }, { fetchImpl: fakeFetch({ hits: 5 }) }),
    ).rejects.toThrow();
  });

  it("jette sur HTTP non-ok", async () => {
    await expect(
      rechercheEntreprises({ departement: "38" }, { fetchImpl: fakeFetch({}, false, 429) }),
    ).rejects.toThrow(/429/);
  });
});

describe("rechercheEntreprisesCount", () => {
  it("renvoie total_results", async () => {
    const n = await rechercheEntreprisesCount(
      { departement: "38", activitePrincipale: "41.20A" },
      { fetchImpl: fakeFetch({ total_results: 128, results: [] }) },
    );
    expect(n).toBe(128);
  });
});
