/** Inspection d'URL avec état (P5). Aucun réseau, aucun identifiant réel. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIG_ENV = { ...process.env };

function rep(status: number, body: unknown = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => "",
  };
}
const JETON = rep(200, { access_token: "AT", expires_in: 3600 });

beforeEach(() => {
  vi.resetModules();
  process.env = { ...ORIG_ENV };
  process.env["GSC_PROPERTY_URL"] = "sc-domain:exemple.test";
  process.env["GSC_OAUTH_CLIENT_ID"] = "id-factice";
  process.env["GSC_OAUTH_CLIENT_SECRET"] = "secret-factice";
  process.env["GSC_OAUTH_REFRESH_TOKEN"] = "refresh-factice";
});
afterEach(() => {
  process.env = ORIG_ENV;
});

async function appel(reponses: unknown[]) {
  vi.resetModules();
  const { gscInspecterUrlDetaille } = await import("../gsc-client");
  const f = vi.fn();
  for (const r of reponses) f.mockResolvedValueOnce(r);
  return gscInspecterUrlDetaille("https://axion-ia.com/fr", { fetchImpl: f as never });
}

describe("gscInspecterUrlDetaille", () => {
  it("identifiants absents : aucun appel réseau", async () => {
    delete process.env["GSC_OAUTH_REFRESH_TOKEN"];
    const { gscInspecterUrlDetaille } = await import("../gsc-client");
    const f = vi.fn();
    expect(
      await gscInspecterUrlDetaille("https://axion-ia.com/fr", { fetchImpl: f as never }),
    ).toEqual({
      etat: "identifiants_absents",
    });
    expect(f).not.toHaveBeenCalled();
  });

  it("ok : rend le résultat", async () => {
    const r = await appel([
      JETON,
      rep(200, { inspectionResult: { indexStatusResult: { verdict: "PASS" } } }),
    ]);
    expect(r.etat).toBe("ok");
    expect(r.resultat?.indexStatusResult?.verdict).toBe("PASS");
  });

  it("429 et 403 quotaExceeded : quota", async () => {
    expect((await appel([JETON, rep(429)])).etat).toBe("quota");
    expect(
      (await appel([JETON, rep(403, { error: { errors: [{ reason: "quotaExceeded" }] } })])).etat,
    ).toBe("quota");
  });

  it("autre 403, 500, réponse vide, panne réseau : erreur (jamais de levée)", async () => {
    expect(
      (await appel([JETON, rep(403, { error: { errors: [{ reason: "forbidden" }] } })])).etat,
    ).toBe("erreur");
    expect((await appel([JETON, rep(500)])).etat).toBe("erreur");
    expect((await appel([JETON, rep(200, {})])).etat).toBe("erreur");
    const { gscInspecterUrlDetaille } = await import("../gsc-client");
    const f = vi.fn().mockRejectedValue(new Error("réseau"));
    expect(
      (await gscInspecterUrlDetaille("https://axion-ia.com/fr", { fetchImpl: f as never })).etat,
    ).toBe("erreur");
  });
});
