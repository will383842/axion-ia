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

  it("le compteur usage.server_tool_use.web_search_requests prime sur le décompte des blocs", async () => {
    const f = vi
      .fn()
      .mockImplementation(async () =>
        ok({ ...bon, usage: { ...bon.usage, server_tool_use: { web_search_requests: 7 } } }),
      );
    const r = await creerFournisseurAnthropic({ cles: ["k1"], fetchImpl: f })(APPEL);
    expect(r.nbRecherches).toBe(7);
  });

  it("traite une erreur réseau comme un 5xx : 2 réessais sur la même clé puis ErreurAnthropic", async () => {
    const f = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    await expect(
      creerFournisseurAnthropic({ cles: ["k1", "k2"], fetchImpl: f, attenteMs: 0 })(APPEL),
    ).rejects.toBeInstanceOf(ErreurAnthropic);
    expect(f).toHaveBeenCalledTimes(3);
    expect(f.mock.calls.every((c) => c[1].headers["x-api-key"] === "k1")).toBe(true);
    expect(f.mock.calls[0]![1].signal).toBeInstanceOf(AbortSignal);

    const g = vi
      .fn()
      .mockRejectedValueOnce(new Error("coupure"))
      .mockImplementation(async () => ok(bon));
    await creerFournisseurAnthropic({ cles: ["k1"], fetchImpl: g, attenteMs: 0 })(APPEL);
    expect(g).toHaveBeenCalledTimes(2);
  });

  it("lève « réponse illisible » sur un JSON invalide ou une forme inattendue", async () => {
    const mal = vi
      .fn()
      .mockImplementation(async () => new Response("pas du json", { status: 200 }));
    await expect(
      creerFournisseurAnthropic({ cles: ["k1"], fetchImpl: mal })(APPEL),
    ).rejects.toThrow(/réponse illisible/);
    const forme = vi.fn().mockImplementation(async () => ok({ foo: 1 }));
    await expect(
      creerFournisseurAnthropic({ cles: ["k1"], fetchImpl: forme })(APPEL),
    ).rejects.toBeInstanceOf(ErreurAnthropic);
  });

  it("pause_turn : relance avec le tour assistant et cumule jetons et recherches", async () => {
    const pause1 = {
      content: [
        { type: "server_tool_use", name: "web_search" },
        { type: "text", text: "A" },
      ],
      stop_reason: "pause_turn",
      usage: { input_tokens: 10, output_tokens: 5 },
    };
    const fin = {
      content: [{ type: "text", text: "B" }],
      stop_reason: "end_turn",
      usage: { input_tokens: 20, output_tokens: 7, server_tool_use: { web_search_requests: 2 } },
    };
    const f = vi.fn().mockResolvedValueOnce(ok(pause1)).mockResolvedValueOnce(ok(fin));
    const r = await creerFournisseurAnthropic({ cles: ["k1"], fetchImpl: f })(APPEL);
    expect(r).toEqual({ texte: "AB", jetonsEntree: 30, jetonsSortie: 12, nbRecherches: 3 });
    const corps2 = JSON.parse(f.mock.calls[1]![1].body as string);
    expect(corps2.messages).toHaveLength(2);
    expect(corps2.messages[1]).toEqual({ role: "assistant", content: pause1.content });

    const toujours = vi.fn().mockImplementation(async () => ok(pause1));
    await expect(
      creerFournisseurAnthropic({ cles: ["k1"], fetchImpl: toujours })(APPEL),
    ).rejects.toThrow(/pause_turn/);
    expect(toujours).toHaveBeenCalledTimes(3); // 1 appel + 2 relances
  });

  it("lève une erreur explicite sur max_tokens et refusal", async () => {
    for (const [arret, motif] of [
      ["max_tokens", /tronquée/],
      ["refusal", /refusée/],
    ] as const) {
      const f = vi.fn().mockImplementation(async () => ok({ content: [], stop_reason: arret }));
      await expect(
        creerFournisseurAnthropic({ cles: ["k1"], fetchImpl: f })(APPEL),
      ).rejects.toThrow(motif);
    }
  });

  it("n'écarte la clé sur 400 que pour un motif de crédits ou de facturation", async () => {
    const f = vi.fn().mockImplementation(async () => err(400, "credits must be positive"));
    await expect(
      creerFournisseurAnthropic({ cles: ["k1", "k2"], fetchImpl: f })(APPEL),
    ).rejects.toBeInstanceOf(ErreurAnthropic);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("429 : attend retry-after plafonné à 30 s (délais simulés)", async () => {
    vi.useFakeTimers();
    try {
      const f = vi
        .fn()
        .mockResolvedValueOnce(new Response("", { status: 429, headers: { "retry-after": "3" } }))
        .mockResolvedValueOnce(new Response("", { status: 429, headers: { "retry-after": "999" } }))
        .mockImplementation(async () => ok(bon));
      const p = creerFournisseurAnthropic({ cles: ["k1"], fetchImpl: f, attenteMs: 10 })(APPEL);
      await vi.advanceTimersByTimeAsync(2_999);
      expect(f).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(f).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(29_999);
      expect(f).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(1);
      await expect(p).resolves.toMatchObject({ texte: "Bonjour monde" });
      expect(f).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it("ne réessaie pas une erreur 400 ordinaire", async () => {
    const f = vi.fn().mockImplementation(async () => err(400, "invalid request"));
    await expect(
      creerFournisseurAnthropic({ cles: ["k1", "k2"], fetchImpl: f })(APPEL),
    ).rejects.toBeInstanceOf(ErreurAnthropic);
    expect(f).toHaveBeenCalledTimes(1);
  });
});
