// Lot I0b-3 — la CSP de la route de lecture plein écran, posée À L'IDENTIQUE par la
// route et par le proxy (la documentation Next ne dit pas qui l'emporte).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildCspHeader, isLectureEmailPath } from "../csp";
import { cspCorpsEmail } from "../email/apercu-lecteur";

afterEach(() => vi.unstubAllEnvs());

describe("buildCspHeader({ lectureEmail: true })", () => {
  const csp = buildCspHeader({ nonce: "N", strict: true, lectureEmail: true });

  it("commence par sandbox, sans aucun allow-", () => {
    expect(csp.startsWith("sandbox;")).toBe(true);
    expect(csp).not.toContain("allow-");
  });

  it("n'a aucune directive script-src : rien ne s'exécute (default-src 'none')", () => {
    expect(csp).not.toContain("script-src");
    expect(csp).toContain("default-src 'none'");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).not.toContain("nonce-");
  });

  it("img-src est data: + cspCorpsEmail(), liste unique", () => {
    expect(csp).toContain(`img-src data: ${cspCorpsEmail()};`);
  });

  it("verrouille le reste", () => {
    expect(csp).toContain("style-src 'unsafe-inline'");
    expect(csp).toContain("base-uri 'none'");
    expect(csp).toContain("form-action 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("est identique quels que soient le nonce et le mode strict", () => {
    expect(buildCspHeader({ nonce: "AUTRE", strict: false, lectureEmail: true })).toBe(csp);
  });
});

describe("isLectureEmailPath (indépendant du préfixe d'administration)", () => {
  const UUID = "11111111-1111-4111-8111-111111111111";

  it("vrai pour la lecture d'un e-mail, quel que soit le segment", () => {
    for (const seg of ["admin-x7k2n9", "zzz", "a.c"]) {
      expect(isLectureEmailPath(`/fr/${seg}/emails/lecture/envoye/${UUID}`)).toBe(true);
      expect(isLectureEmailPath(`/en/${seg}/emails/lecture/gabarit/submission-reply/`)).toBe(true);
    }
  });

  it("faux pour le reste", () => {
    expect(isLectureEmailPath("/fr/p/emails/gabarits/x")).toBe(false);
    expect(isLectureEmailPath("/fr/p/emails/lecture")).toBe(false);
    expect(isLectureEmailPath("/fr/p/emails/lecture/envoye")).toBe(false);
    expect(isLectureEmailPath(`/fr/p/emails/lecture/envoye/${UUID}/x`)).toBe(false);
    expect(isLectureEmailPath(`/de/p/emails/lecture/envoye/${UUID}`)).toBe(false);
    expect(isLectureEmailPath(`/emails/lecture/envoye/${UUID}`)).toBe(false);
    expect(isLectureEmailPath("/fr/about")).toBe(false);
  });
});

describe("la CSP d'une page publique et d'une page console ne bouge pas (valeurs figées)", () => {
  const PUBLIQUE =
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://plausible.axion-ia.com https://www.clarity.ms https://*.clarity.ms https://snap.licdn.com https://connect.facebook.net https://assets.calendly.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https:; font-src 'self' data: https://fonts.gstatic.com; media-src 'self'; connect-src 'self' https://challenges.cloudflare.com https://plausible.axion-ia.com https://api.telegram.org https://*.ingest.sentry.io https://*.ingest.de.sentry.io https://*.ingest.us.sentry.io https://www.clarity.ms https://*.clarity.ms https://snap.licdn.com https://px.ads.linkedin.com https://www.facebook.com https://calendly.com https://*.calendly.com https://*.r2.cloudflarestorage.com; frame-src 'self' https://challenges.cloudflare.com https://plausible.axion-ia.com https://calendly.com https://*.calendly.com; frame-ancestors 'none'; form-action 'self'; base-uri 'self'; object-src 'none'; upgrade-insecure-requests";
  const CONSOLE =
    "default-src 'self'; script-src 'self' 'nonce-N' 'strict-dynamic' 'sha256-vy7BO95SqCwcPVAwxQTU/zWpSiYL9C1CWCCb1LB+ni4=' https://challenges.cloudflare.com https://plausible.axion-ia.com https://www.clarity.ms https://*.clarity.ms https://snap.licdn.com https://connect.facebook.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https:; font-src 'self' data: https://fonts.gstatic.com; media-src 'self'; connect-src 'self' https://challenges.cloudflare.com https://plausible.axion-ia.com https://api.telegram.org https://*.ingest.sentry.io https://*.ingest.de.sentry.io https://*.ingest.us.sentry.io https://www.clarity.ms https://*.clarity.ms https://snap.licdn.com https://px.ads.linkedin.com https://www.facebook.com https://calendly.com https://*.calendly.com https://*.r2.cloudflarestorage.com; frame-src 'self' https://challenges.cloudflare.com https://plausible.axion-ia.com https://calendly.com https://*.calendly.com; frame-ancestors 'none'; form-action 'self'; base-uri 'self'; object-src 'none'; upgrade-insecure-requests";

  it("page publique (souple)", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("STRIPE_ENABLED", "");
    expect(buildCspHeader({ nonce: "N", strict: false })).toBe(PUBLIQUE);
    expect(buildCspHeader({ nonce: "N", strict: false, lectureEmail: false })).toBe(PUBLIQUE);
  });

  it("page console (stricte)", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("STRIPE_ENABLED", "");
    expect(buildCspHeader({ nonce: "N", strict: true })).toBe(CONSOLE);
    expect(buildCspHeader({ nonce: "N", strict: true, lectureEmail: false })).toBe(CONSOLE);
  });
});

describe("garde de câblage du proxy", () => {
  const src = readFileSync(join(process.cwd(), "src/proxy.ts"), "utf8");

  it("proxy.ts appelle isLectureEmailPath( et passe lectureEmail à buildCspHeader", () => {
    expect(src).toContain("isLectureEmailPath(");
    expect(src).toMatch(/buildCspHeader\(\{[^}]*lectureEmail[^}]*\}\)/);
  });
});
