import { describe, expect, it, vi } from "vitest";

import { MODELES_RAPPORT, ModeleRefuse } from "../../modeles";
import { creerFournisseurAnthropic, ErreurAnthropic, ErreurClesEpuisees } from "../anthropic";

const APPEL = {
  system: "s",
  user: "u",
  modele: MODELES_RAPPORT.execution,
  recherche: false,
};

const ok = (corps: unknown) => new Response(JSON.stringify(corps), { status: 200 });
const err = (statut: number, texte = "") => new Response(texte, { status: statut });
const bon = {
  content: [
    { type: "text", text: "Bonjour " },
    { type: "server_tool_use", name: "web_search" },
    { type: "web_search_tool_result" },
    { type: "server_tool_use", name: "web_search" },
    { type: "text", text: "monde" },
  ],
  usage: { input_tokens: 10, output_tokens: 5 },
};

describe("fournisseur Anthropic", () => {
  it("concatène les blocs texte, compte les recherches et active l'outil", async () => {
    const f = vi.fn().mockImplementation(async () => ok(bon));
    const r = await creerFournisseurAnthropic({ cles: ["k1"], fetchImpl: f })({
      ...APPEL,
      recherche: true,
    });
    expect(r).toEqual({
      texte: "Bonjour monde",
      jetonsEntree: 10,
      jetonsSortie: 5,
      nbRecherches: 2,
    });
    const corps = JSON.parse(f.mock.calls[0]![1].body as string);
    expect(corps.tools[0]).toMatchObject({ name: "web_search", max_uses: 8 });
  });

  it("n'active pas la recherche quand elle n'est pas demandée", async () => {
    const f = vi.fn().mockImplementation(async () => ok(bon));
    await creerFournisseurAnthropic({ cles: ["k1"], fetchImpl: f })(APPEL);
    expect(JSON.parse(f.mock.calls[0]![1].body as string).tools).toBeUndefined();
  });

  it("refuse Haiku avant tout appel réseau", async () => {
    const f = vi.fn();
    const p = creerFournisseurAnthropic({ cles: ["k1"], fetchImpl: f });
    await expect(p({ ...APPEL, modele: "claude-haiku-4-5-20251001" })).rejects.toBeInstanceOf(
      ModeleRefuse,
    );
    expect(f).not.toHaveBeenCalled();
  });

  it("passe à la clé suivante sur crédits épuisés puis 401, et écarte les clés mortes", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(err(400, "Your credit balance is too low"))
      .mockResolvedValueOnce(err(401))
      .mockImplementation(async () => ok(bon));
    const p = creerFournisseurAnthropic({ cles: ["k1", "k2", "k3"], fetchImpl: f });
    await p(APPEL);
    expect(f.mock.calls.map((c) => c[1].headers["x-api-key"])).toEqual(["k1", "k2", "k3"]);
    await p(APPEL);
    expect(f.mock.calls[3]![1].headers["x-api-key"]).toBe("k3");
  });

  it("passe à la clé suivante sur 429 persistant", async () => {
    const f = vi.fn(async (_u: unknown, i?: RequestInit) =>
      (i?.headers as Record<string, string>)["x-api-key"] === "k1" ? err(429) : ok(bon),
    );
    await creerFournisseurAnthropic({ cles: ["k1", "k2"], fetchImpl: f, attenteMs: 0 })(APPEL);
    expect(f).toHaveBeenCalledTimes(4); // 1 + 2 réessais sur k1, puis k2
  });

  it("réessaie 2 fois sur 5xx puis réussit, ou lève après épuisement des réessais", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(err(503))
      .mockResolvedValueOnce(err(500))
      .mockImplementation(async () => ok(bon));
    await creerFournisseurAnthropic({ cles: ["k1"], fetchImpl: f, attenteMs: 0 })(APPEL);
    expect(f).toHaveBeenCalledTimes(3);

    const g = vi.fn().mockImplementation(async () => err(500, "boom"));
    await expect(
      creerFournisseurAnthropic({ cles: ["k1", "k2"], fetchImpl: g, attenteMs: 0 })(APPEL),
    ).rejects.toBeInstanceOf(ErreurAnthropic);
    expect(g).toHaveBeenCalledTimes(3);
  });

  it("lève ErreurClesEpuisees quand toutes les clés échouent, ou qu'il n'y en a aucune", async () => {
    const f = vi.fn().mockImplementation(async () => err(401));
    const p = creerFournisseurAnthropic({ cles: ["k1", "k2"], fetchImpl: f });
    await expect(p(APPEL)).rejects.toThrow(ErreurClesEpuisees);
    await expect(p(APPEL)).rejects.toThrow(/inutilisables/);
    await expect(creerFournisseurAnthropic({ cles: [], fetchImpl: f })(APPEL)).rejects.toThrow(
      ErreurClesEpuisees,
    );
  });

  it("ne réessaie pas une erreur 400 ordinaire", async () => {
    const f = vi.fn().mockImplementation(async () => err(400, "invalid request"));
    await expect(
      creerFournisseurAnthropic({ cles: ["k1", "k2"], fetchImpl: f })(APPEL),
    ).rejects.toBeInstanceOf(ErreurAnthropic);
    expect(f).toHaveBeenCalledTimes(1);
  });
});
