/**
 * `ipVisiteurOuNull` — la variante des appelants qui HACHENT l'IP.
 *
 * `hashIp(null)` rend `null` ; `hashIp("unknown")` rendrait une empreinte
 * réelle, la même pour tous les visiteurs sans IP. Les preuves de signature
 * Qualiopi porteraient alors une fausse empreinte, et la limite « par IP » de
 * l'émargement deviendrait commune à tous ces visiteurs.
 *
 * Joué en `NODE_ENV=production`, comme `ip-client-derriere-cloudflare.spec.ts`.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

type Module = typeof import("../client-ip-core");
let m: Module;

beforeAll(async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.resetModules();
  m = await import("../client-ip-core");
});
afterAll(() => {
  vi.unstubAllEnvs();
});

describe("ipVisiteurOuNull", () => {
  it("aucun en-tête → null, jamais la chaîne « unknown »", () => {
    expect(m.ipVisiteurOuNull(new Headers())).toBeNull();
    expect(m.ipDepuisEntetes(new Headers())).toBe("unknown"); // témoin : la variante diffère bien
  });

  it("derrière Cloudflare → le visiteur", () => {
    const h = new Headers({ "x-real-ip": "162.159.122.108", "cf-connecting-ip": "37.65.10.24" });
    expect(m.ipVisiteurOuNull(h)).toBe("37.65.10.24");
  });

  it("🔴 `cf-connecting-ip` forgé en contournant Cloudflare → l'adresse de connexion", () => {
    const h = new Headers({ "x-real-ip": "203.0.113.5", "cf-connecting-ip": "1.2.3.4" });
    expect(m.ipVisiteurOuNull(h)).toBe("203.0.113.5");
  });

  it("🔴 `cf-connecting-ip` SEUL (aucune adresse de connexion) → null, pas l'en-tête", () => {
    // C'est la forme exacte que les preuves de signature croyaient sans condition.
    expect(m.ipVisiteurOuNull(new Headers({ "cf-connecting-ip": "1.2.3.4" }))).toBeNull();
  });
});
