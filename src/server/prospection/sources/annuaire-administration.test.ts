import { describe, it, expect } from "vitest";
import { annuaireLookup } from "./annuaire-administration";

function fakeFetch(payload: unknown, ok = true, status = 200) {
  return async () => ({ ok, status, json: async () => payload });
}

describe("annuaireLookup", () => {
  it("renvoie le meilleur contact public", async () => {
    const c = await annuaireLookup(
      { nom: "Mairie de Grenoble", commune: "Grenoble" },
      {
        fetchImpl: fakeFetch({
          total_count: 1,
          results: [
            {
              nom: "Mairie de Grenoble",
              adresse_courriel: "contact@grenoble.fr",
              telephone: "0476001122",
            },
          ],
        }),
      },
    );
    expect(c.email).toBe("contact@grenoble.fr");
    expect(c.telephone).toBe("0476001122");
  });

  it("aucun résultat → contact vide", async () => {
    const c = await annuaireLookup(
      { nom: "X" },
      { fetchImpl: fakeFetch({ total_count: 0, results: [] }) },
    );
    expect(c).toEqual({ email: null, telephone: null });
  });

  it("jette sur HTTP non-ok", async () => {
    await expect(
      annuaireLookup({ nom: "X" }, { fetchImpl: fakeFetch({}, false, 500) }),
    ).rejects.toThrow();
  });
});
