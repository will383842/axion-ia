// @vitest-environment node
//
// Environnement `node` : le module lit `process.env` et appelle `fetch`.

/**
 * Verrou GEO-105 / GEO-106 — Bing n'était prévenu de rien
 * (audit GEO/AEO end-to-end du 2026-08-14, lot 16).
 *
 * ## Le défaut mesuré
 *
 * Quand le site publie, **seul Yandex est réellement prévenu**. La cascade
 * IndexNow vise trois endpoints, mais celui de Microsoft
 * (`api.indexnow.org`) répond **403 depuis le 2026-08-11** — cause racine côté
 * Microsoft, ticket ouvert, décision actée : on ne re-diagnostique pas.
 *
 * Or Bing alimente **Copilot** et le grounding de **ChatGPT Search**. Ne pas
 * l'avertir, c'est laisser hors du circuit le moteur qui nourrit deux des
 * moteurs de réponse qu'on cherche justement à atteindre.
 *
 * Un client Bing WMT existait, avec ses fonctions de **lecture**, sans aucun
 * appelant — et **sans fonction de soumission** : elle n'avait jamais été
 * écrite. C'est ce trou que le lot comble, par une voie directe
 * (`SubmitUrlBatch`) qui ne passe pas par l'agrégateur et n'est donc pas
 * concernée par le 403.
 *
 * ## Pourquoi un module séparé du client existant
 *
 * Le client de lecture vit dans une zone dédiée au générateur de contenu, que
 * `content-gen:isolation-check` (§ 4.1bis) interdit d'importer depuis `src/lib`.
 * L'importer ferait rougir la CI sur une règle d'architecture légitime.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { isBingSubmitReady, submitUrlsToBing } from "@/lib/seo/bing-wmt-submit";

const CLE = process.env["BING_WMT_API_KEY"];

afterEach(() => {
  vi.unstubAllGlobals();
  if (CLE === undefined) delete process.env["BING_WMT_API_KEY"];
  else process.env["BING_WMT_API_KEY"] = CLE;
});

describe("soumission Bing — absence de clé ≠ échec (GEO-106)", () => {
  beforeEach(() => {
    delete process.env["BING_WMT_API_KEY"];
  });

  it("sans clé, rien n'est envoyé et ce n'est PAS compté comme un échec", async () => {
    // 🔑 Confondre « non configuré » et « en panne » envoie chercher un
    // probleme reseau la ou il manque une variable d'environnement.
    const appels: string[] = [];
    vi.stubGlobal("fetch", (u: string) => {
      appels.push(u);
      return Promise.resolve(new Response("{}", { status: 200 }));
    });

    const r = await submitUrlsToBing(["https://axion-ia.com/fr/blog/x"]);
    expect(r.configured).toBe(false);
    expect(r.failed).toBe(0);
    expect(appels, "aucun appel reseau ne doit partir sans cle").toEqual([]);
  });

  it("`isBingSubmitReady` reflète l'absence de clé", () => {
    expect(isBingSubmitReady()).toBe(false);
    process.env["BING_WMT_API_KEY"] = "cle-de-test";
    expect(isBingSubmitReady()).toBe(true);
  });
});

describe("soumission Bing — le chemin nominal (GEO-105)", () => {
  beforeEach(() => {
    process.env["BING_WMT_API_KEY"] = "cle-de-test";
  });

  it("🔴 appelle bien `SubmitUrlBatch`, la voie qui contourne le 403 de l'agrégateur", async () => {
    let vue = "";
    let corps: unknown = null;
    vi.stubGlobal("fetch", (u: string, init?: RequestInit) => {
      vue = u;
      corps = JSON.parse(String(init?.body ?? "{}"));
      return Promise.resolve(new Response("{}", { status: 200 }));
    });

    const r = await submitUrlsToBing(["https://axion-ia.com/fr/blog/x"], "test");
    expect(vue).toContain("/SubmitUrlBatch");
    expect(
      vue,
      "l'endpoint IndexNow agrege repond 403 depuis le 2026-08-11 : la voie " +
        "directe est precisement ce qui rend ce correctif utile.",
    ).not.toContain("indexnow");
    expect(corps).toMatchObject({ urlList: ["https://axion-ia.com/fr/blog/x"] });
    expect(r).toEqual({ configured: true, submitted: 1, failed: 0 });
  });

  it("la clé passe en query, jamais dans le corps", async () => {
    let vue = "";
    let corps = "";
    vi.stubGlobal("fetch", (u: string, init?: RequestInit) => {
      vue = u;
      corps = String(init?.body ?? "");
      return Promise.resolve(new Response("{}", { status: 200 }));
    });
    await submitUrlsToBing(["https://axion-ia.com/fr"]);
    expect(vue).toContain("apikey=cle-de-test");
    expect(corps, "la cle ne doit pas se retrouver dans le corps journalisable").not.toContain(
      "cle-de-test",
    );
  });

  it("découpe en lots de 500 — au-delà, Bing rejette l'appel entier", async () => {
    const lots: number[] = [];
    vi.stubGlobal("fetch", (_u: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { urlList: string[] };
      lots.push(body.urlList.length);
      return Promise.resolve(new Response("{}", { status: 200 }));
    });

    const urls = Array.from({ length: 1200 }, (_, i) => `https://axion-ia.com/fr/p/${i}`);
    const r = await submitUrlsToBing(urls);
    expect(lots).toEqual([500, 500, 200]);
    expect(r.submitted).toBe(1200);
  });

  it("un refus HTTP est compté, jamais propagé en exception", async () => {
    // Fail-soft : une soumission ratee ne doit pas faire echouer une publication.
    vi.stubGlobal("fetch", () => Promise.resolve(new Response("quota exceeded", { status: 429 })));
    const r = await submitUrlsToBing(["https://axion-ia.com/fr"]);
    expect(r).toEqual({ configured: true, submitted: 0, failed: 1 });
  });

  it("une panne réseau est absorbée de la même façon", async () => {
    vi.stubGlobal("fetch", () => Promise.reject(new Error("ECONNRESET")));
    const r = await submitUrlsToBing(["https://axion-ia.com/fr"]);
    expect(r).toEqual({ configured: true, submitted: 0, failed: 1 });
  });

  it("une liste vide ne déclenche aucun appel", async () => {
    const appels: string[] = [];
    vi.stubGlobal("fetch", (u: string) => {
      appels.push(u);
      return Promise.resolve(new Response("{}", { status: 200 }));
    });
    const r = await submitUrlsToBing([]);
    expect(appels).toEqual([]);
    expect(r).toEqual({ configured: true, submitted: 0, failed: 0 });
  });
});
