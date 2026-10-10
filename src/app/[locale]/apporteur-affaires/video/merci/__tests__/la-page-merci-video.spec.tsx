/**
 * La page « C'est noté » des apporteurs (2026-10-07, décision de Will : « le
 * parcours APPORTEUR doit avoir le même design que le parcours CLIENT »).
 *
 * Elle propose la réservation du SITE — les créneaux de `/fr/appel/apporteur`,
 * le formulaire `/fr/appel/reserver` — et plus jamais la page Calendly brute :
 *   · AUCUN lien vers calendly.com, quel que soit l'état (grille, repli, drapeau
 *     éteint) ;
 *   · chaque créneau porte le choix (`rdv=apporteur`), le bouton
 *     (`depuis=vsl-apporteur`), les UTM d'arrivée (adresse, sinon cookie) et le
 *     jeton `?j=` s'il est valide ;
 *   · DYNAMIQUE et noindex ; la page sans jeton fonctionne.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const { cookie, dispo, connue } = vi.hoisted(() => ({
  cookie: { valeur: undefined as string | undefined },
  dispo: { resultat: { ok: false, reason: "not_configured" } as unknown },
  connue: { ids: new Set<string>() },
}));

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
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
// « Déjà connu(e) » se déduit de la base (le jeton n'en dit rien) : doublé ici.
vi.mock("@/features/commercial-application/deja-connu-vsl", () => ({
  ligneDejaConnue: async (j: { lead: string; genre: string }) =>
    j.genre === "saisie" && connue.ids.has(j.lead) ? { id: j.lead } : null,
}));
vi.mock("@/server/calendly/availability", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/calendly/availability")>()),
  fetchAvailableSlots: async () => dispo.resultat,
}));

// `CalendlyInlineWidget` est un composant serveur ASYNCHRONE, que
// `renderToStaticMarkup` ne sait pas attendre : la page est rendue avec une
// marque à sa place, puis le VRAI composant est rendu avec les props reçues et
// remis à la place de la marque. Ce qui est vérifié est donc bien le HTML final.
const { props } = vi.hoisted(() => ({ props: [] as unknown[] }));
vi.mock("@/components/booking/CalendlyInlineWidget", () => ({
  CalendlyInlineWidget: (p: unknown) => {
    props.push(p);
    return <div data-marque-widget={props.length - 1} />;
  },
}));

import Page, { dynamic, generateMetadata } from "../page";
import { serializeUtmCookie } from "@/lib/utm";
import { creerJeton } from "@/features/commercial-application/jeton-lead";

const SLOT = "2030-03-04T09:00:00.000Z";
const AVEC_CRENEAUX = {
  ok: true,
  dureeMinutes: 15,
  days: [
    {
      dateKey: "2030-03-04",
      slots: [
        { startIso: SLOT, schedulingUrl: "https://calendly.com/axion-ia/echange-apporteur/x" },
      ],
    },
  ],
};

async function rendre(sp: Record<string, string | string[] | undefined> = {}): Promise<string> {
  props.length = 0;
  let h = renderToStaticMarkup(
    await Page({ params: Promise.resolve({ locale: "fr" }), searchParams: Promise.resolve(sp) }),
  );
  const { CalendlyInlineWidget } = await vi.importActual<
    typeof import("@/components/booking/CalendlyInlineWidget")
  >("@/components/booking/CalendlyInlineWidget");
  for (const [i, p] of props.entries()) {
    const widget = renderToStaticMarkup(
      await CalendlyInlineWidget(p as Parameters<typeof CalendlyInlineWidget>[0]),
    );
    h = h.replace(`<div data-marque-widget="${i}"></div>`, widget);
  }
  expect(h).not.toContain("data-marque-widget");
  return h;
}

function texte(h: string): string {
  return h
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ");
}

function hrefs(h: string): string[] {
  return [...h.matchAll(/href="([^"]+)"/g)].map((m) => (m[1] ?? "").replace(/&amp;/g, "&"));
}

function lienDuBouton(h: string): URL {
  const m = /<a href="([^"]+)"[^>]*data-cta="vsl-merci-creneau"/.exec(h);
  if (!m?.[1]) throw new Error("bouton « Choisir mon créneau » introuvable");
  return new URL(m[1].replace(/&amp;/g, "&"), "https://axion-ia.com");
}

function lienDuCreneau(h: string): URL {
  const m = /<a href="([^"]+)"[^>]*data-cta="appel_slot_pick"/.exec(h);
  if (!m?.[1]) throw new Error("aucun créneau dans la grille");
  return new URL(m[1].replace(/&amp;/g, "&"), "https://axion-ia.com");
}

/** Aucun lien, aucun texte, aucune iframe vers Calendly. */
function sansCalendly(h: string): void {
  expect(h.toLowerCase()).not.toContain("calendly.com");
  expect(h).not.toContain("<iframe");
  expect(texte(h)).not.toMatch(/calendly/i);
}

beforeEach(() => {
  cookie.valeur = undefined;
  dispo.resultat = { ok: false, reason: "not_configured" };
  vi.stubEnv("RESERVATION_DIRECTE_ACTIVE", "true");
  vi.stubEnv("CALENDLY_API_TOKEN", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("la page de merci des apporteurs — réservation du site", () => {
  it("est DYNAMIQUE (variables d'exécution) et noindex", async () => {
    expect(dynamic).toBe("force-dynamic");
    const m = await generateMetadata({
      params: Promise.resolve({ locale: "fr" }),
      searchParams: Promise.resolve({}),
    });
    expect(m.robots).toMatchObject({ index: false });
  });

  it("montre la grille de créneaux du site ; chaque créneau mène au formulaire maison de l'échange apporteur", async () => {
    dispo.resultat = AVEC_CRENEAUX;
    const h = await rendre();
    const lien = lienDuCreneau(h);
    expect(lien.origin).toBe("https://axion-ia.com");
    expect(lien.pathname).toBe("/fr/appel/reserver");
    expect(lien.searchParams.get("debut")).toBe(SLOT);
    expect(lien.searchParams.get("rdv")).toBe("apporteur");
    expect(lien.searchParams.get("depuis")).toBe("vsl-apporteur");
    sansCalendly(h);
  });

  it("porte le jeton ?j= VALIDE jusqu'au formulaire (préremplissage), jamais un jeton trafiqué", async () => {
    dispo.resultat = AVEC_CRENEAUX;
    const jeton = creerJeton({ lead: "lead-1", suspect: false });
    expect(lienDuCreneau(await rendre({ j: jeton })).searchParams.get("j")).toBe(jeton);
    expect(lienDuCreneau(await rendre({ j: `${jeton}x` })).searchParams.get("j")).toBeNull();
    expect(lienDuCreneau(await rendre()).searchParams.get("j")).toBeNull();
  });

  it("reprend les UTM d'arrivée (adresse, sinon cookie) dans les créneaux", async () => {
    dispo.resultat = AVEC_CRENEAUX;
    const depuisAdresse = lienDuCreneau(
      await rendre({
        utm_source: "facebook",
        utm_medium: "paid",
        utm_campaign: "apporteurs-vsl-2026-10",
      }),
    );
    expect(depuisAdresse.searchParams.get("utm_source")).toBe("facebook");
    expect(depuisAdresse.searchParams.get("utm_medium")).toBe("paid");
    expect(depuisAdresse.searchParams.get("utm_campaign")).toBe("apporteurs-vsl-2026-10");

    cookie.valeur = serializeUtmCookie({ utm_source: "instagram", utm_campaign: "depuis-cookie" });
    const depuisCookie = lienDuCreneau(await rendre());
    expect(depuisCookie.searchParams.get("utm_source")).toBe("instagram");
    expect(depuisCookie.searchParams.get("utm_campaign")).toBe("depuis-cookie");
  });

  it("créneaux illisibles : le bouton mène à la page de réservation du site, sans Calendly", async () => {
    const h = await rendre({ utm_source: "facebook", utm_campaign: "c1" });
    expect(texte(h)).toContain("Choisir mon créneau");
    const lien = lienDuBouton(h);
    expect(lien.pathname).toBe("/fr/appel/apporteur");
    expect(lien.searchParams.get("depuis")).toBe("vsl-apporteur");
    expect(lien.searchParams.get("utm_source")).toBe("facebook");
    expect(lien.searchParams.get("utm_campaign")).toBe("c1");
    sansCalendly(h);
  });

  it("réservation directe éteinte : aucune grille (ses créneaux iraient chez Calendly), le bouton du site", async () => {
    vi.stubEnv("RESERVATION_DIRECTE_ACTIVE", "");
    dispo.resultat = AVEC_CRENEAUX;
    const h = await rendre();
    expect(h).not.toContain('data-cta="appel_slot_pick"');
    expect(lienDuBouton(h).pathname).toBe("/fr/appel/apporteur");
    sansCalendly(h);
  });

  it("🔒 aucun lien de la page ne sort vers calendly.com, quel que soit l'état", async () => {
    for (const etat of [AVEC_CRENEAUX, { ok: false, reason: "api_error" }]) {
      dispo.resultat = etat;
      for (const h of [
        await rendre(),
        await rendre({ j: creerJeton({ lead: "l", suspect: false }) }),
      ]) {
        for (const href of hrefs(h)) expect(href).not.toMatch(/calendly\.com/i);
      }
    }
  });

  it("porte la ligne e-mail de secours, le kit, et aucun numéro de téléphone ni délai chiffré", async () => {
    const t = texte(await rendre());
    // B1 part 15 min après le formulaire, et SEULEMENT sans réservation : la page
    // ne promet plus un e-mail « tout de suite ».
    expect(t).toContain("Si vous ne réservez pas maintenant, le lien vous est envoyé par e-mail");
    expect(t).toContain("Répondez à notre e-mail");
    expect(t).toContain("Le catalogue des prestations");
    expect(t).toMatch(/15 minutes/);
    expect(t).not.toMatch(/(?:\+33|0)\s?[1-9](?:[\s.-]?\d{2}){4}/);
    expect(t).not.toMatch(/sous\s+\d+\s?h|qualiopi|parrain/i);
  });

  it("P2 — personne DÉJÀ CONNUE : aucun e-mail promis, le calendrier reste là", async () => {
    connue.ids = new Set(["fiche-connue"]);
    try {
      const jeton = creerJeton({ lead: "fiche-connue", suspect: false });
      const t = texte(await rendre({ j: jeton }));
      expect(t).toContain("C'est noté.");
      expect(t).toContain("Choisissez votre créneau ci-dessous.");
      expect(t).not.toMatch(/par e-mail|e-mail de confirmation/);
      expect(t).toContain("Choisir mon créneau");
      // Un lead ordinaire garde le texte d'origine.
      const t2 = texte(await rendre({ j: creerJeton({ lead: "lead-1", suspect: false }) }));
      expect(t2).toContain("Choisissez maintenant le créneau de 15 minutes qui vous convient.");
      expect(t2).toContain("le lien vous est envoyé par e-mail");
    } finally {
      connue.ids = new Set();
    }
  });
});
