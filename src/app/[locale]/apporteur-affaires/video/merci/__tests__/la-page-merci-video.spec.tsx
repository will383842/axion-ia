/**
 * La page de merci de la page VSL apporteurs : DYNAMIQUE (lit
 * `CALENDLY_APPORTEUR_URL` à l'exécution), le lien Calendly est dans le HTML
 * SANS JavaScript, le calendrier intégré ne charge rien avant le clic, les UTM
 * d'arrivée suivent.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const { env, cookie } = vi.hoisted(() => ({
  env: { CALENDLY_APPORTEUR_URL: undefined as string | undefined },
  cookie: { valeur: undefined as string | undefined },
}));

vi.mock("@/env", () => ({ env }));
vi.mock("@/lib/site-url", () => ({ SITE_URL: "https://axion-ia.com" }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (nom: string) =>
      nom === "axion_utm" && cookie.valeur ? { value: cookie.valeur } : undefined,
  }),
}));
vi.mock("next-intl/server", () => ({ setRequestLocale: () => undefined }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children?: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import Page, { dynamic, generateMetadata } from "../page";
import { serializeUtmCookie } from "@/lib/utm";
import { URL_CALENDLY_APPORTEUR_PAR_DEFAUT } from "@/server/calendly/type-rendez-vous";

async function rendre(sp: Record<string, string | string[] | undefined> = {}): Promise<string> {
  return renderToStaticMarkup(
    await Page({ params: Promise.resolve({ locale: "fr" }), searchParams: Promise.resolve(sp) }),
  );
}

function texte(h: string): string {
  return h
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ");
}

function lienDuBouton(h: string): URL {
  const m = /<a href="([^"]+)"[^>]*data-cta="vsl-merci-creneau"/.exec(h);
  if (!m?.[1]) throw new Error("bouton « Choisir mon créneau » introuvable");
  return new URL(m[1].replace(/&amp;/g, "&"));
}

beforeEach(() => {
  env.CALENDLY_APPORTEUR_URL = undefined;
  cookie.valeur = undefined;
});

describe("la page de merci des apporteurs", () => {
  it("est DYNAMIQUE (la variable d'exécution ne doit pas être figée au build) et noindex", async () => {
    expect(dynamic).toBe("force-dynamic");
    const m = await generateMetadata({
      params: Promise.resolve({ locale: "fr" }),
      searchParams: Promise.resolve({}),
    });
    expect(m.robots).toMatchObject({ index: false });
  });

  it("le gros bouton « Choisir mon créneau » est un LIEN Calendly présent dans le HTML sans JavaScript", async () => {
    const h = await rendre();
    expect(texte(h)).toContain("Choisir mon créneau");
    const lien = lienDuBouton(h);
    expect(lien.origin + lien.pathname).toBe(URL_CALENDLY_APPORTEUR_PAR_DEFAUT);
    expect(lien.searchParams.get("utm_content")).toBe("vsl-apporteur");
    expect(h).toMatch(/data-cta="vsl-merci-creneau"/);
    expect(h).toContain('rel="noopener noreferrer"');
  });

  it("lit CALENDLY_APPORTEUR_URL à l'exécution ; une valeur invalide retombe sur le défaut", async () => {
    env.CALENDLY_APPORTEUR_URL = "https://calendly.com/axion-ia/mon-autre-lien";
    expect(lienDuBouton(await rendre()).pathname).toBe("/axion-ia/mon-autre-lien");
    env.CALENDLY_APPORTEUR_URL = "https://pirate.example/calendly.com/x";
    expect(lienDuBouton(await rendre()).hostname).toBe("calendly.com");
    env.CALENDLY_APPORTEUR_URL = "pas une adresse";
    expect(lienDuBouton(await rendre()).pathname).toBe(
      new URL(URL_CALENDLY_APPORTEUR_PAR_DEFAUT).pathname,
    );
  });

  it("reprend les UTM d'arrivée (adresse, sinon cookie) dans le lien Calendly", async () => {
    const depuisAdresse = lienDuBouton(
      await rendre({
        utm_source: "facebook",
        utm_medium: "paid",
        utm_campaign: "apporteurs-vsl-2026-10",
      }),
    );
    expect(depuisAdresse.searchParams.get("utm_source")).toBe("facebook");
    expect(depuisAdresse.searchParams.get("utm_campaign")).toBe("apporteurs-vsl-2026-10");

    cookie.valeur = serializeUtmCookie({ utm_source: "instagram", utm_campaign: "depuis-cookie" });
    const depuisCookie = lienDuBouton(await rendre());
    expect(depuisCookie.searchParams.get("utm_source")).toBe("instagram");
    expect(depuisCookie.searchParams.get("utm_campaign")).toBe("depuis-cookie");
  });

  it("le calendrier intégré ne charge RIEN avant le clic (aucun widget, aucun script Calendly)", async () => {
    const h = await rendre();
    expect(h).not.toContain("calendly-inline-widget");
    expect(h).not.toContain("data-url=");
    expect(h).not.toContain("assets.calendly.com");
    expect(h).not.toContain("<iframe");
    expect(texte(h)).toContain("Afficher le calendrier");
  });

  it("porte la ligne e-mail de secours, le kit, et aucun numéro de téléphone ni délai chiffré", async () => {
    const t = texte(await rendre());
    expect(t).toContain("Vous recevez aussi le lien par e-mail");
    expect(t).toContain("Répondez à l'e-mail de confirmation");
    expect(t).toContain("Le catalogue des prestations");
    expect(t).toMatch(/15 minutes/);
    expect(t).not.toMatch(/(?:\+33|0)\s?[1-9](?:[\s.-]?\d{2}){4}/);
    expect(t).not.toMatch(/sous\s+\d+\s?h|qualiopi|parrain/i);
  });
});
