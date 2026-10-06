import { describe, expect, it, vi } from "vitest";

import { attenteAvantReessai, lireEntrepriseParSiren } from "../annuaire";
import { sirenValide } from "../regles";

// Un SIREN de test calculé (Luhn valide) : aucun numéro en dur dans src/.
const SIREN = (() => {
  for (let n = 100000000; n < 100001000; n++) if (sirenValide(String(n))) return String(n);
  throw new Error("aucun SIREN de test");
})();

const reponse429 = (retryAfter = "4") =>
  new Response("Too Many Requests.", { status: 429, headers: { "retry-after": retryAfter } });
const reponseOk = () =>
  new Response(
    JSON.stringify({
      results: [
        {
          siren: SIREN,
          nom_complet: "ENTREPRISE D'ESSAI",
          siege: { adresse: "1 rue de l'Essai 75001 PARIS", activite_principale: "62.01Z" },
          nature_juridique: "5710",
          etat_administratif: "A",
        },
      ],
    }),
    { status: 200 },
  );

describe("registre : le 429 (limite de débit par adresse) ne fait plus échouer la recherche", () => {
  it("attend le Retry-After puis réessaie, et rend l'entreprise", async () => {
    const f = vi.fn().mockResolvedValueOnce(reponse429()).mockResolvedValueOnce(reponseOk());
    const attendre = vi.fn().mockResolvedValue(undefined);
    const r = await lireEntrepriseParSiren(SIREN, { fetch: f, attendre });
    expect(r.ok).toBe(true);
    expect(f).toHaveBeenCalledTimes(2);
    expect(attendre).toHaveBeenCalledWith(4000);
  });
  it("abandonne proprement après trois refus : « indisponible », jamais une exception", async () => {
    const f = vi.fn().mockImplementation(async () => reponse429("1"));
    const r = await lireEntrepriseParSiren(SIREN, { fetch: f, attendre: async () => undefined });
    expect(r).toEqual({ ok: false, raison: "indisponible" });
    expect(f).toHaveBeenCalledTimes(3);
  });
  it("une autre erreur (500) n'est pas réessayée", async () => {
    const f = vi.fn().mockResolvedValue(new Response("x", { status: 500 }));
    const r = await lireEntrepriseParSiren(SIREN, { fetch: f, attendre: async () => undefined });
    expect(r).toEqual({ ok: false, raison: "indisponible" });
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("l'attente est bornée", () => {
    expect(attenteAvantReessai("4")).toBe(4000);
    expect(attenteAvantReessai("120")).toBe(5000);
    expect(attenteAvantReessai(null)).toBe(1000);
    expect(attenteAvantReessai("abc")).toBe(1000);
  });
});
