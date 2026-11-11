/**
 * Verrou I2 (audit SEO indépendant du 2026-11-11) — une date PAR ROUTE, lue à
 * UNE source par le sitemap et par le JSON-LD.
 *
 * Le défaut mesuré : les 87 URL de `sitemap/pages.xml` portaient le même
 * `<lastmod>` (date de la famille `pages`), et le `dateModified` JSON-LD des
 * mêmes pages lisait une AUTRE constante (`SITE_EDITORIAL_DATE`, recopiée de
 * `EDITORIAL_BASELINE` « à garder en sync à la main »).
 *
 * Seul Prisma est mocké ; le reste du graphe de `app/sitemap.ts` est réel.
 */

import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    article: { findMany: vi.fn(async () => []), findFirst: vi.fn(async () => null) },
    category: { findMany: vi.fn(async () => []) },
    knowledgeEntry: { findMany: vi.fn(async () => []), count: vi.fn(async () => 0) },
  },
}));

import sitemap from "../sitemap";
import { ROUTE_FRESHNESS } from "@/generated/content-freshness";
import { DATE_MISE_A_JOUR_JOURNEE_IA } from "@/content/journee-ia-commun";
import { SITE_EDITORIAL_DATE, SITE_URL, buildWebPageJsonLd } from "@/lib/seo";
import {
  DATES_EDITORIALES,
  EDITORIAL_BASELINE_ISO,
  cleDeChemin,
  dateModifiedDeChemin,
  dateRoute,
} from "@/lib/seo/fraicheur";

const manifesteRempli = Object.keys(ROUTE_FRESHNESS).length > 0;

async function pagesXml() {
  return sitemap({ id: Promise.resolve("pages") });
}

describe("fraîcheur · une seule date figée", () => {
  it("SITE_EDITORIAL_DATE dérive de EDITORIAL_BASELINE_ISO (plus de copie à synchroniser)", () => {
    expect(SITE_EDITORIAL_DATE).toBe(EDITORIAL_BASELINE_ISO);
  });
});

describe("fraîcheur · registre par route", () => {
  it("une date affichée sur la page (registre éditorial) prime sur le manifeste git", () => {
    const attendu = new Date(DATE_MISE_A_JOUR_JOURNEE_IA).toISOString();
    expect(dateRoute("/")).toBe(attendu);
    expect(dateRoute("/journee-ia")).toBe(attendu);
    for (const iso of Object.values(DATES_EDITORIALES)) {
      expect(Number.isNaN(new Date(iso).getTime())).toBe(false);
    }
  });

  it("une route du manifeste rend SA date, pas celle de la famille", () => {
    const [cle, iso] = Object.entries(ROUTE_FRESHNESS).find(([k]) => !DATES_EDITORIALES[k]) ?? [];
    if (!cle || !iso) return; // manifeste vide (clone superficiel) : repli famille
    expect(dateRoute(cle)).toBe(new Date(iso).toISOString());
  });

  it("aucune date du manifeste n'est dans le futur", () => {
    const demain = Date.now() + 24 * 3600 * 1000;
    for (const [cle, iso] of Object.entries(ROUTE_FRESHNESS)) {
      expect(new Date(iso).getTime(), cle).toBeLessThan(demain);
    }
  });

  it("résout un chemin localisé vers la clé interne, et ignore les routes dynamiques", () => {
    expect(cleDeChemin("/", "fr")).toBe("/");
    expect(cleDeChemin("/a-propos", "fr")).toBe("/a-propos");
    expect(cleDeChemin("/a-propos/", "fr")).toBe("/a-propos");
    expect(cleDeChemin("/secteurs/btp", "fr")).toBeUndefined();
    expect(dateModifiedDeChemin("/blog/un-article", "fr")).toBeUndefined();
  });
});

describe("fraîcheur · le sitemap et le JSON-LD lisent la même source", () => {
  it("pages.xml : chaque URL porte la date de SA route", async () => {
    const entrees = await pagesXml();
    const aPropos = entrees.find((e) => e.url === `${SITE_URL}/fr/a-propos`);
    expect(aPropos).toBeDefined();
    expect(new Date(aPropos!.lastModified as Date).toISOString()).toBe(dateRoute("/a-propos"));
    const accueil = entrees.find((e) => e.url === `${SITE_URL}/fr`);
    expect(new Date(accueil!.lastModified as Date).toISOString()).toBe(dateRoute("/"));
  });

  it("pages.xml n'a plus un lastmod unique pour toutes ses URL", async () => {
    if (!manifesteRempli) return;
    const dates = new Set((await pagesXml()).map((e) => String(e.lastModified)));
    expect(dates.size).toBeGreaterThan(10);
  });

  // Le manifeste commité peut être en retard sur `routing.pathnames` : la CI de PR ne le
  // régénère pas (seul le déploiement le fait). On exige donc seulement une date valide
  // par URL, le repli sur la famille `pages` étant accepté pour une route nouvelle.
  it("toute URL de pages.xml porte une date ISO valide, jamais future", async () => {
    const invalides: string[] = [];
    const maintenant = Date.now() + 24 * 3600 * 1000;
    for (const e of await pagesXml()) {
      const t = new Date(e.lastModified as Date).getTime();
      if (Number.isNaN(t) || t > maintenant) invalides.push(e.url);
    }
    expect(invalides).toEqual([]);
  });

  it("buildWebPageJsonLd : dateModified par défaut = lastmod de la route", () => {
    const n = buildWebPageJsonLd({ locale: "fr", path: "/a-propos", name: "À propos" });
    expect(n.dateModified).toBe(dateRoute("/a-propos"));
  });

  it("buildWebPageJsonLd : une date passée explicitement est conservée", () => {
    const n = buildWebPageJsonLd({
      locale: "fr",
      path: "/a-propos",
      name: "À propos",
      dateModified: "2026-01-02",
    });
    expect(n.dateModified).toBe("2026-01-02");
  });

  it("buildWebPageJsonLd : jamais de dateModified antérieure à datePublished", () => {
    const n = buildWebPageJsonLd({
      locale: "fr",
      path: "/a-propos",
      name: "À propos",
      datePublished: "2099-01-01T00:00:00.000Z",
    });
    expect(n.dateModified).toBeUndefined();
  });

  it("buildWebPageJsonLd : route dynamique → pas de date inventée", () => {
    const n = buildWebPageJsonLd({ locale: "fr", path: "/secteurs/btp", name: "BTP" });
    expect(n.dateModified).toBeUndefined();
  });
});
