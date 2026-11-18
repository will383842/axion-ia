// @vitest-environment node
/**
 * Lot I0b-3, correction après audit (constats 1 et 2) : une VRAIE `NextRequest` passe par
 * `poserEnTetesDeSecurite` (la fonction du proxy qui pose les en-têtes). Sous Next 16.3.1
 * ce sont ces en-têtes qui l'emportent sur ceux de la route.
 */
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth", () => ({ default: () => ({ auth: (h: unknown) => h }) }));
vi.mock("next-intl/middleware", () => ({ default: () => () => undefined }));

import { poserEnTetesDeSecurite } from "@/proxy";
import { cspCorpsEmail } from "@/lib/email/apercu-lecteur";

afterEach(() => vi.unstubAllEnvs());

const ID = "11111111-1111-4111-8111-111111111111";
const SANDBOX = `sandbox; default-src 'none'; img-src data: ${cspCorpsEmail()}; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`;

function entetes(chemin: string): Headers {
  const res = new Response(null);
  poserEnTetesDeSecurite(new NextRequest(`https://axion-ia.com${chemin}`), res, "NONCE");
  return res.headers;
}

describe("poserEnTetesDeSecurite sur la lecture plein écran", () => {
  it.each([
    ["bon préfixe", "/fr/pfx-test/emails/lecture/envoye/" + ID],
    ["MAUVAIS préfixe", "/fr/zzz/emails/lecture/envoye/" + ID],
    ["barre finale", "/fr/zzz/emails/lecture/envoye/" + ID + "/"],
    ["locale en, gabarit", "/en/pfx-test/emails/lecture/gabarit/submission-reply"],
  ])("%s : CSP sandbox exacte, no-referrer", (_nom, chemin) => {
    vi.stubEnv("ADMIN_URL_PREFIX", "pfx-test");
    const h = entetes(chemin);
    const csp = h.get("Content-Security-Policy") ?? "";
    expect(csp).toBe(SANDBOX);
    expect(csp).not.toContain("allow-scripts");
    expect(csp).not.toContain("allow-same-origin");
    expect(h.get("Referrer-Policy")).toBe("no-referrer");
    expect(h.get("X-Frame-Options")).toBe("DENY");
  });

  it("une page publique garde la CSP publique et strict-origin-when-cross-origin", () => {
    const h = entetes("/fr/a-propos");
    expect(h.get("Content-Security-Policy")).toContain("'unsafe-eval'");
    expect(h.get("Content-Security-Policy")).not.toContain("sandbox");
    expect(h.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });

  it("une page de la console voisine garde la CSP console", () => {
    vi.stubEnv("ADMIN_URL_PREFIX", "pfx-test");
    const h = entetes("/fr/pfx-test/emails/gabarits");
    expect(h.get("Content-Security-Policy")).toContain("'nonce-NONCE'");
    expect(h.get("Content-Security-Policy")).not.toContain("sandbox");
    expect(h.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });

  it("variantes de chemin : celles qui ne ressemblent pas à la route n'obtiennent pas sandbox", () => {
    for (const c of [
      "/zzz/emails/lecture/envoye/" + ID, // sans locale : next-intl redirige, la route n'est pas atteinte
      "/FR/zzz/emails/lecture/envoye/" + ID, // majuscules : next-intl redirige vers /fr/FR/…
      "//fr/zzz/emails/lecture/envoye/" + ID, // double barre
      "/fr/zzz/emails/lecture/envoye%2F" + ID, // %2F : un seul segment, la route reçoit une source inconnue
    ]) {
      expect(entetes(c).get("Content-Security-Policy")).not.toContain("sandbox;");
    }
  });
});
