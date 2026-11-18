// La page `/desabonnement` lit le jeton dans le COOKIE, jamais dans l'URL (plan « jeton
// op2 », J2) ; elle reconnaît une opposition `op1` comme `op2` (J1).

import { beforeEach, describe, expect, it, vi } from "vitest";

let cookieValue: string | undefined;
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (nom: string) =>
      nom === "__Host-axion-desinscription" && cookieValue !== undefined
        ? { name: nom, value: cookieValue }
        : undefined,
  }),
}));
vi.mock("next-intl/server", () => ({ setRequestLocale: () => {} }));
vi.mock("@/lib/seo", () => ({ buildProductMetadata: async () => ({}) }));
vi.mock("@/components/layout/Section", () => ({ Section: () => null }));
vi.mock("@/components/layout/Container", () => ({ Container: () => null }));
vi.mock("@/components/marketing/Cta", () => ({ Cta: () => null }));
vi.mock("@/components/nav/Breadcrumbs", () => ({ Breadcrumbs: () => null }));

import DesabonnementPage from "../page";

async function rendre(searchParams: Record<string, string>) {
  const el = await DesabonnementPage({
    params: Promise.resolve({ locale: "fr" }),
    searchParams: Promise.resolve(searchParams),
  });
  return JSON.stringify(el);
}

beforeEach(() => {
  cookieValue = undefined;
});

describe("page /desabonnement", () => {
  it("🔴 avec searchParams.token et sans cookie : la valeur n'apparaît nulle part, 'lien requis'", async () => {
    const html = await rendre({ token: "op2.k1.SECRETDANSLURL" });
    expect(html).not.toContain("SECRETDANSLURL");
    expect(html).toContain("Cette page nécessite un lien de désabonnement");
    expect(html).not.toContain('"action":"/api/unsubscribe"');
  });

  it("avec le cookie : le bouton est là, SANS champ caché portant le jeton", async () => {
    cookieValue = "op2.k1.VALEURCOOKIE";
    const html = await rendre({});
    expect(html).toContain('"action":"/api/unsubscribe"');
    expect(html).not.toContain("VALEURCOOKIE");
    expect(html).not.toContain('"type":"hidden"');
  });

  it("un op2 affiche « l'arrêt des sollicitations commerciales »", async () => {
    cookieValue = "op2.k1.abcdef";
    expect(await rendre({})).toContain("l'arrêt des sollicitations commerciales");
  });

  it("un op1 aussi ; un jeton de newsletter affiche « le désabonnement »", async () => {
    cookieValue = "op1.abc.def";
    expect(await rendre({})).toContain("l'arrêt des sollicitations commerciales");
    cookieValue = "jeton-newsletter-opaque";
    const html = await rendre({});
    expect(html).toContain("le désabonnement");
    expect(html).not.toContain("l'arrêt des sollicitations commerciales");
  });

  it("après un résultat (status=ok), pas de bouton même si un cookie traîne", async () => {
    cookieValue = "op2.k1.abcdef";
    const html = await rendre({ status: "ok", already: "0" });
    expect(html).not.toContain('"action":"/api/unsubscribe"');
  });
});
