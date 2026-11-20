// @vitest-environment node
/**
 * GEO V1-07 — quand le site signale une page publiée à Bing (IndexNow ou API de
 * soumission d'URL de Bing), un refus ou une erreur ne passe plus inaperçu :
 * journal structuré + alerte Telegram + repli sur l'autre porte.
 * Anti-bruit : une alerte au plus par heure et par (moteur, type d'erreur).
 * Aucune alerte au build (stubs, BULLMQ_DISABLED).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const magasinRedis = new Set<string>();
const sendTelegram = vi.fn(async (_m: { tag: string; body: string }) => true);

vi.mock("@/lib/telegram", () => ({
  sendTelegram: (m: { tag: string; body: string }) => sendTelegram(m),
}));
vi.mock("@/lib/redis", () => ({
  redis: {
    // SET cle 1 EX ttl NX : « OK » si posée, null si elle existait déjà.
    set: vi.fn(async (cle: string) => {
      if (magasinRedis.has(cle)) return null;
      magasinRedis.add(cle);
      return "OK";
    }),
  },
}));

import { signalerAuxMoteurs } from "@/lib/indexnow";
import { classerErreur, reinitialiserAntiBruit } from "@/lib/seo/signalement-moteurs";

const URLS = ["https://axion-ia.com/fr/blog/essai"];
const ENV = { ...process.env };

type Reponse = number | "timeout" | "reseau";
function simulerReseau(opts: { indexnow: Reponse; bing: Reponse }) {
  const appels: string[] = [];
  vi.stubGlobal("fetch", async (url: string) => {
    appels.push(url);
    const r = url.includes("ssl.bing.com") ? opts.bing : opts.indexnow;
    if (r === "timeout")
      throw Object.assign(new Error("The operation was aborted"), { name: "TimeoutError" });
    if (r === "reseau") throw new Error("ECONNRESET");
    return new Response(r < 300 ? "" : "refus", { status: r });
  });
  return appels;
}

let erreurs: unknown[][];
beforeEach(() => {
  magasinRedis.clear();
  reinitialiserAntiBruit();
  sendTelegram.mockClear();
  process.env["BING_WMT_API_KEY"] = "cle-de-test";
  delete process.env["BULLMQ_DISABLED"];
  delete process.env["NEXT_PHASE"];
  process.env["REDIS_URL"] = "redis://localhost:6379";
  erreurs = [];
  vi.spyOn(console, "error").mockImplementation((...a) => void erreurs.push(a));
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  process.env = { ...ENV };
});

describe("réponse 200/202 : rien", () => {
  it("ni journal d'erreur, ni alerte", async () => {
    simulerReseau({ indexnow: 202, bing: 200 });
    const rapport = await signalerAuxMoteurs("axion-ia.com", "k".repeat(32), URLS, "blog");
    expect(rapport.indexnow?.accepted).not.toBeNull();
    expect(erreurs).toEqual([]);
    expect(sendTelegram).not.toHaveBeenCalled();
  });
});

describe("classement des erreurs", () => {
  it("4xx, 5xx, timeout, réseau", () => {
    expect(classerErreur(403)).toBe("refus-4xx");
    expect(classerErreur(429)).toBe("refus-4xx");
    expect(classerErreur(503)).toBe("erreur-5xx");
    expect(classerErreur(null, Object.assign(new Error("x"), { name: "TimeoutError" }))).toBe(
      "timeout",
    );
    expect(classerErreur(null, Object.assign(new Error("x"), { name: "AbortError" }))).toBe(
      "timeout",
    );
    expect(classerErreur(null, new Error("ECONNRESET"))).toBe("reseau");
  });
});

describe("IndexNow refuse partout : journal + alerte + repli Bing", () => {
  it.each([
    ["403", 403, "refus-4xx"],
    ["500", 500, "erreur-5xx"],
  ] as const)("HTTP %s", async (_n, code, type) => {
    const appels = simulerReseau({ indexnow: code, bing: 200 });
    const rapport = await signalerAuxMoteurs("axion-ia.com", "k".repeat(32), URLS, "blog");
    expect(rapport.indexnow?.accepted).toBeNull();
    expect(appels.some((u) => u.includes("ssl.bing.com"))).toBe(true); // repli
    expect(rapport.bing?.submitted).toBe(1);
    // journal structuré : un objet JSON avec le moteur et le type
    const ligne = erreurs
      .flat()
      .find((x) => typeof x === "string" && x.includes('"signalement-moteur"'));
    expect(ligne).toBeTruthy();
    const j = JSON.parse(String(ligne).replace(/^[^{]*/, ""));
    expect(j).toMatchObject({ evenement: "signalement-moteur", moteur: "indexnow", type });
    expect(sendTelegram).toHaveBeenCalledTimes(1);
    expect(sendTelegram.mock.calls[0]![0].body).toContain(String(code));
  });

  it("timeout : alerte de type timeout", async () => {
    simulerReseau({ indexnow: "timeout", bing: 200 });
    await signalerAuxMoteurs("axion-ia.com", "k".repeat(32), URLS, "blog");
    expect(sendTelegram).toHaveBeenCalledTimes(1);
    expect(sendTelegram.mock.calls[0]![0].body).toMatch(/timeout/i);
  });
});

describe("Bing refuse : journal + alerte + repli IndexNow", () => {
  it("HTTP 500 de Bing, IndexNow accepte", async () => {
    const appels = simulerReseau({ indexnow: 202, bing: 500 });
    const rapport = await signalerAuxMoteurs("axion-ia.com", "k".repeat(32), URLS, "blog");
    expect(appels.some((u) => u.includes("indexnow") || u.includes("yandex"))).toBe(true);
    expect(rapport.indexnow?.accepted).not.toBeNull();
    expect(sendTelegram).toHaveBeenCalledTimes(1);
    expect(sendTelegram.mock.calls[0]![0].body).toMatch(/bing/i);
  });

  it("Bing seul en échec (clé IndexNow absente) : l'alerte dit qu'aucun repli n'est configuré", async () => {
    simulerReseau({ indexnow: 202, bing: 403 });
    await signalerAuxMoteurs("axion-ia.com", undefined, URLS, "blog");
    expect(sendTelegram).toHaveBeenCalledTimes(1);
    expect(sendTelegram.mock.calls[0]![0].body).toMatch(/aucun repli/i);
  });
});

describe("anti-bruit : une alerte au plus par heure et par type", () => {
  it("deux échecs du même type : une seule alerte ; un autre type : une de plus", async () => {
    simulerReseau({ indexnow: 403, bing: 200 });
    await signalerAuxMoteurs("axion-ia.com", "k".repeat(32), URLS, "blog");
    await signalerAuxMoteurs("axion-ia.com", "k".repeat(32), URLS, "blog");
    expect(sendTelegram).toHaveBeenCalledTimes(1);
    simulerReseau({ indexnow: 500, bing: 200 });
    await signalerAuxMoteurs("axion-ia.com", "k".repeat(32), URLS, "blog");
    expect(sendTelegram).toHaveBeenCalledTimes(2);
    // le journal, lui, n'est jamais étouffé
    expect(
      erreurs.flat().filter((x) => typeof x === "string" && x.includes('"signalement-moteur"'))
        .length,
    ).toBe(3);
  });

  it("repli en mémoire si Redis est en panne : toujours une seule alerte", async () => {
    const { redis } = await import("@/lib/redis");
    vi.mocked(redis.set).mockRejectedValue(new Error("redis down"));
    simulerReseau({ indexnow: 403, bing: 200 });
    await signalerAuxMoteurs("axion-ia.com", "k".repeat(32), URLS, "blog");
    await signalerAuxMoteurs("axion-ia.com", "k".repeat(32), URLS, "blog");
    expect(sendTelegram).toHaveBeenCalledTimes(1);
  });
});

describe("aucune alerte au build", () => {
  it.each([
    ["BULLMQ_DISABLED", { BULLMQ_DISABLED: "true" }],
    ["Redis stub", { REDIS_URL: "redis://stub.invalid:6379" }],
    ["phase de build Next", { NEXT_PHASE: "phase-production-build" }],
  ])("%s : journal oui, alerte non", async (_n, env) => {
    Object.assign(process.env, env);
    simulerReseau({ indexnow: 403, bing: 500 });
    await signalerAuxMoteurs("axion-ia.com", "k".repeat(32), URLS, "blog");
    expect(sendTelegram).not.toHaveBeenCalled();
  });
});
