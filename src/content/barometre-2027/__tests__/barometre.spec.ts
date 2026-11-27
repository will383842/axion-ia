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
  BAROMETRE_PUBLIC,
  CHIFFRES_CLES,
  SOURCES,
  VARIABLES_MESUREES,
} from "../donnees";
import sitemap from "@/app/sitemap";
import { generateMetadata } from "@/app/[locale]/ressources/barometre-ia-tpe-pme-2027/page";

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
  });

  it("BAROMETRE_PUBLIC vaut false : hors sitemap (aucune locale)", async () => {
    expect(BAROMETRE_PUBLIC).toBe(false);
    const entrees = await sitemap({ id: Promise.resolve("pages") });
    expect(entrees.filter((e) => e.url.includes("barometre-ia-tpe-pme-2027"))).toEqual([]);
  });

  it("metadata : noindex et hreflang fr + x-default seulement", async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ locale: "fr" }) });
    expect(meta.robots).toMatchObject({ index: false });
    const langs = meta.alternates?.languages ?? {};
    expect(Object.keys(langs).sort()).toEqual(["fr", "x-default"]);
  });
});
