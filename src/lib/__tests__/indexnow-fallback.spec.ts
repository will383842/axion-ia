// Cascade d'endpoints IndexNow — garde contre le retour au mono-endpoint.
//
// Contexte : `api.indexnow.org` renvoie 403 `UserForbiddedToAccessSite` pour
// axion-ia.com (back-end Microsoft). Avec un seul endpoint, TOUTES les
// soumissions échouaient — et en silence, le step CI se terminant en succès.
import { describe, it, expect, vi, afterEach } from "vitest";
import { submitToIndexNow } from "../indexnow";

const HOST = "axion-ia.com";
// Valeur volontairement en toutes lettres et à faible entropie : une chaîne
// hexadécimale de 32 caractères, même bidon, est signalée comme secret par
// gitleaks (règle `generic-api-key`). Le format exact n'importe pas ici — la
// fonction ne valide pas la clé, elle la recopie dans le corps de requête.
const KEY = "cle-de-test-indexnow-non-secrete";
const URLS = ["https://axion-ia.com/fr/carrieres"];

/** Réponse minimale suffisante pour `submitToIndexNow` (res.ok / status / text). */
function reply(status: number, body = ""): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 403 ? "Forbidden" : "OK",
    text: () => Promise.resolve(body),
  } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("submitToIndexNow — cascade d'endpoints", () => {
  it("s'arrête au premier endpoint qui accepte (1 seul appel réseau)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply(200));
    vi.stubGlobal("fetch", fetchMock);

    const r = await submitToIndexNow(HOST, KEY, URLS);

    expect(r.accepted).toBe("https://api.indexnow.org/indexnow");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("bascule sur Yandex quand l'agrégateur renvoie le 403 Microsoft", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(reply(403, '{"errorCode":"UserForbiddedToAccessSite"}'))
      .mockResolvedValueOnce(reply(202));
    vi.stubGlobal("fetch", fetchMock);

    const r = await submitToIndexNow(HOST, KEY, URLS);

    expect(r.accepted).toBe("https://yandex.com/indexnow");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // Le refus doit rester TRAÇABLE même quand la soumission finit par passer :
    // c'est le seul signal qui dit que Bing, lui, ne reçoit rien.
    expect(r.attempts[0]).toContain("403");
    expect(r.attempts[0]).toContain("UserForbiddedToAccessSite");
  });

  it("une erreur réseau ne stoppe pas la cascade", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("ECONNRESET"))
      .mockResolvedValueOnce(reply(202));
    vi.stubGlobal("fetch", fetchMock);

    const r = await submitToIndexNow(HOST, KEY, URLS);

    expect(r.accepted).toBe("https://yandex.com/indexnow");
    expect(r.attempts[0]).toContain("ECONNRESET");
  });

  it("tous en échec → accepted null et UNE trace par endpoint essayé", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply(403, "nope"));
    vi.stubGlobal("fetch", fetchMock);

    const r = await submitToIndexNow(HOST, KEY, URLS);

    expect(r.accepted).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(r.attempts).toHaveLength(3);
    expect(r.attempts.every((a) => a.includes("403"))).toBe(true);
  });

  it("ne throw jamais — une publication ne doit pas casser parce qu'IndexNow est down", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));
    await expect(submitToIndexNow(HOST, KEY, URLS)).resolves.toMatchObject({ accepted: null });
  });

  it("envoie le keyLocation canonique `/{key}.txt` et le champ `urlList`", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply(200));
    vi.stubGlobal("fetch", fetchMock);

    await submitToIndexNow(HOST, KEY, URLS);

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({
      host: HOST,
      key: KEY,
      keyLocation: `https://${HOST}/${KEY}.txt`,
      urlList: URLS,
    });
  });
});
