import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl/server", () => ({ setRequestLocale: () => undefined }));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: () => undefined }),
  Link: () => null,
}));
vi.mock("@/components/nav/Breadcrumbs", () => ({ Breadcrumbs: () => null }));
vi.mock("@/lib/prisma", () => ({ prisma: new Proxy({}, { get: () => () => [] }) }));

import { buildBarometreJsonLd } from "../jsonld";
import * as donnees from "../donnees";
import {
  BAROMETRE_PATH,
  BAROMETRE_DATE_OUVERTURE,
  barometreEstPublic,
  CHIFFRES_CLES,
  SOURCES,
  VARIABLES_MESUREES,
} from "../donnees";
import sitemap from "@/app/sitemap";
import { generateMetadata } from "@/app/[locale]/ressources/barometre-ia-tpe-pme-2027/page";

const JSONLD = path.join(process.cwd(), "src/content/barometre-2027/jsonld.ts");
const PAGE = path.join(
  process.cwd(),
  "src/app/[locale]/ressources/barometre-ia-tpe-pme-2027/page.tsx",
);

describe("Baromètre 2027 IA TPE/PME", () => {
  it("porte les 5 chiffres clés, phrases autonomes", () => {
    expect(CHIFFRES_CLES).toHaveLength(5);
    expect(CHIFFRES_CLES.map((c) => c.valeur)).toEqual([
      "40 %",
      "38 % et 53 %",
      "18,16 %",
      "34 %",
      "68 %",
    ]);
    for (const c of CHIFFRES_CLES) expect(c.phrase).toMatch(/\d/);
  });

  it("JSON-LD Article + Dataset valides et sérialisables", () => {
    const { article, dataset } = buildBarometreJsonLd("fr");
    expect(JSON.parse(JSON.stringify(article))["@type"]).toBe("Article");
    const d = JSON.parse(JSON.stringify(dataset));
    expect(d["@type"]).toBe("Dataset");
    expect(d.creator).toMatchObject({ "@type": "Organization", name: "Axion-IA" });
    expect(d.datePublished).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(d.variableMeasured).toHaveLength(VARIABLES_MESUREES.length);
    expect(d.citation).toHaveLength(SOURCES.length);
    expect(d.url).toContain(BAROMETRE_PATH);
    expect(d.spatialCoverage).toEqual(["France", "Union européenne"]);
    expect(d.isBasedOn.map((s: { "@type": string }) => s["@type"])).toEqual(
      SOURCES.map((s) => s.type),
    );
  });

  it("JSON-LD : auteur = l'organisation, ni aggregateRating ni review", () => {
    const { article, dataset } = buildBarometreJsonLd("fr");
    const brut = JSON.stringify([article, dataset]);
    expect(brut).not.toMatch(/aggregateRating|"review"|"Review"/);
    expect(article.author).toEqual({ "@id": expect.stringMatching(/\/#organization$/) });
    expect(JSON.stringify(article.author)).not.toContain("Person");
  });

  it("aucun terme interdit dans le module de données ni dans la page", () => {
    const interdit =
      /Grenoble|Qualiopi|financement|brouillon|€|gain garanti|questionnaire|témoign/i;
    expect(JSON.stringify(donnees)).not.toMatch(interdit);
    expect(readFileSync(PAGE, "utf8")).not.toMatch(interdit);
    expect(readFileSync(JSONLD, "utf8")).not.toMatch(interdit);
    expect(JSON.stringify(buildBarometreJsonLd("fr"))).not.toMatch(interdit);
  });

  it("ouverture : 28 novembre 2026 00:00 heure de Paris, avant = faux, après = vrai", () => {
    expect(Date.parse(BAROMETRE_DATE_OUVERTURE)).toBe(Date.parse("2026-11-27T23:00:00Z"));
    expect(barometreEstPublic(new Date("2026-11-27T22:59:59.999Z"))).toBe(false);
    expect(barometreEstPublic(new Date("2026-11-27T23:00:00.000Z"))).toBe(true);
    expect(barometreEstPublic(new Date("2027-03-01T12:00:00Z"))).toBe(true);
  });

  it("avant l'ouverture : hors sitemap ; après : présent", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date("2026-11-27T22:00:00Z"));
      const avant = await sitemap({ id: Promise.resolve("pages") });
      expect(avant.filter((e) => e.url.includes("barometre-ia-tpe-pme-2027"))).toEqual([]);
      vi.setSystemTime(new Date("2026-11-28T00:30:00+01:00"));
      const apres = await sitemap({ id: Promise.resolve("pages") });
      expect(apres.some((e) => e.url.includes("barometre-ia-tpe-pme-2027"))).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("metadata : noindex avant l'ouverture, indexable après ; hreflang fr + x-default seulement", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    let meta;
    try {
      vi.setSystemTime(new Date("2026-11-27T22:00:00Z"));
      meta = await generateMetadata({ params: Promise.resolve({ locale: "fr" }) });
      expect(meta.robots).toMatchObject({ index: false });
      vi.setSystemTime(new Date("2026-11-28T00:30:00+01:00"));
      const apres = await generateMetadata({ params: Promise.resolve({ locale: "fr" }) });
      expect(apres.robots).not.toMatchObject({ index: false });
    } finally {
      vi.useRealTimers();
    }
    const langs = meta.alternates?.languages ?? {};
    expect(Object.keys(langs).sort()).toEqual(["fr", "x-default"]);
  });
});
