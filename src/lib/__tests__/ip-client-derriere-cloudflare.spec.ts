/**
 * 🔴 L'IP d'un visiteur n'est pas celle du relais Cloudflare qui le sert.
 *
 * Mesuré le 2026-09-25 : un envoi fait depuis 37.65.10.24 a été enregistré sous
 * 162.159.122.108 (Cloudflare). Toutes les limites « N envois par IP » comptaient
 * donc par relais, partagées entre visiteurs sans rapport.
 *
 * Et l'origine répond aussi EN DIRECT, sans Cloudflare : `cf-connecting-ip` est
 * forgeable par quiconque la contourne. Ces tests gardent les deux moitiés —
 * croire l'en-tête quand la connexion vient de Cloudflare, et seulement alors.
 *
 * Joués en `NODE_ENV=production` : hors production le module fait confiance à
 * tout, et un test en mode test ne mesurerait que cette confiance-là.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ headers: vi.fn() }));

type Module = typeof import("../client-ip");
let m: Module;

beforeAll(async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.resetModules();
  m = await import("../client-ip");
});
afterAll(() => {
  vi.unstubAllEnvs();
});

const entetes = (valeurs: Record<string, string>) => new Headers(valeurs);

describe("🔴 derrière Cloudflare, l'IP est celle du visiteur", () => {
  it("le cas mesuré en production : relais 162.159.122.108 → visiteur 37.65.10.24", () => {
    const h = entetes({
      "x-real-ip": "162.159.122.108",
      "x-forwarded-for": "162.159.122.108",
      "cf-connecting-ip": "37.65.10.24",
    });
    expect(m.ipDepuisEntetes(h)).toBe("37.65.10.24");
  });

  it("relais IPv6, visiteur IPv6", () => {
    const h = entetes({
      "x-real-ip": "2a06:98c0:3600::103",
      "cf-connecting-ip": "2001:db8::42",
    });
    expect(m.ipDepuisEntetes(h)).toBe("2001:db8::42");
  });

  it("deux visiteurs servis par le MÊME relais ne partagent plus la même IP", () => {
    const relais = "172.70.1.9";
    const a = m.ipDepuisEntetes(
      entetes({ "x-real-ip": relais, "cf-connecting-ip": "198.51.100.1" }),
    );
    const b = m.ipDepuisEntetes(
      entetes({ "x-real-ip": relais, "cf-connecting-ip": "198.51.100.2" }),
    );
    expect(a).not.toBe(b);
  });
});

describe("🔴 contourner Cloudflare ne permet pas de choisir son IP", () => {
  it("connexion directe + `cf-connecting-ip` forgé → l'adresse de connexion, pas l'en-tête", () => {
    const h = entetes({
      "x-real-ip": "203.0.113.5",
      "cf-connecting-ip": "1.2.3.4",
      "x-forwarded-for": "1.2.3.4",
    });
    expect(m.ipDepuisEntetes(h)).toBe("203.0.113.5");
  });

  it("relais Cloudflare mais `cf-connecting-ip` illisible → pas d'injection, le relais", () => {
    const h = entetes({ "x-real-ip": "162.158.1.1", "cf-connecting-ip": "<script>" });
    expect(m.ipDepuisEntetes(h)).toBe("162.158.1.1");
  });

  it("aucun en-tête → « unknown »", () => {
    expect(m.ipDepuisEntetes(entetes({}))).toBe("unknown");
  });
});

describe("le réseau interne garde son comportement", () => {
  it("proxy privé → premier `x-forwarded-for`, comme avant", () => {
    const h = entetes({ "x-real-ip": "10.0.1.7", "x-forwarded-for": "198.51.100.8, 10.0.1.7" });
    expect(m.ipDepuisEntetes(h)).toBe("198.51.100.8");
  });
});

describe("dansLaPlage — les bornes, là où un calcul faux se cache", () => {
  it.each([
    ["162.159.255.255", "162.158.0.0/15", true],
    ["162.160.0.0", "162.158.0.0/15", false],
    ["162.157.255.255", "162.158.0.0/15", false],
    ["2a06:98c7:ffff::1", "2a06:98c0::/29", true],
    ["2a06:98c8::", "2a06:98c0::/29", false],
    ["::1", "2400:cb00::/32", false],
    ["162.159.1.1", "2400:cb00::/32", false],
    ["300.1.1.1", "162.158.0.0/15", false],
    ["2400:cb00::1::2", "2400:cb00::/32", false],
    ["", "162.158.0.0/15", false],
  ])("%s dans %s → %s", (ip, plage, attendu) => {
    expect(m.dansLaPlage(ip, plage)).toBe(attendu);
  });

  it("chaque plage publiée contient sa propre adresse de réseau (aucune n'est mal saisie)", () => {
    for (const plage of m.CLOUDFLARE_RANGES) {
      expect(m.dansLaPlage(plage.split("/")[0]!, plage), plage).toBe(true);
    }
  });
});
