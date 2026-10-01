/**
 * ⛔ Le client OpenAI du circuit utilise le `fetch` natif de Node (réponses
 * longues), qui REFUSE un corps en flux sans `duplex: "half"`. Sans lui, tout
 * envoi d'audio échouait en production (essai réel du 01/10) ; les autres
 * tests simulent OpenAI et ne pouvaient pas le voir.
 *
 * Mutation qui rougit : retirer `duplex` de `fetchNatifAvecCorps`, ou rendre
 * `fetch: globalThis.fetch` au constructeur.
 */
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchNatifAvecCorps } from "../client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("le fetch natif envoie l'audio en duplex", () => {
  it("un appel avec un corps part en duplex « half »", async () => {
    const vu = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", vu);
    await fetchNatifAvecCorps("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      body: "x",
    } as never);
    expect(vu.mock.calls[0]?.[1]).toMatchObject({ method: "POST", body: "x", duplex: "half" });
  });

  it("contre-témoin : un appel sans corps part tel quel", async () => {
    const vu = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", vu);
    await fetchNatifAvecCorps("https://api.openai.com/v1/models", { method: "GET" } as never);
    expect(vu.mock.calls[0]?.[1]).toEqual({ method: "GET" });
  });

  it("le client du circuit le prend, jamais globalThis.fetch nu", () => {
    const src = readFileSync("src/server/visio/openai/client.ts", "utf8");
    expect(src).toContain("fetch: fetchNatifAvecCorps");
    expect(src).not.toContain("fetch: globalThis.fetch");
  });
});
