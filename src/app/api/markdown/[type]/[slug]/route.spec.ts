/**
 * Tests — `/api/markdown/[type]/[slug]` (audit GEO/AEO 2026-08-15, LOT 4).
 *
 * Findings couverts : GEO-038 (`glossaire` et `centre-aide` annoncés en
 * `<link rel="alternate" type="text/markdown">` et répondant 404) et GEO-039
 * (`cas-concrets` répondant 200 avec un corps VIDE — pire qu'un 404, un moteur
 * de réponse en conclut que la page n'a rien à dire).
 *
 * La garde ci-dessous ferme la CLASSE entière, pas les trois cas :
 * elle relit les pages publiques, en extrait les types réellement annoncés aux
 * crawlers, puis vérifie que chacun est servi. Déclarer demain un
 * `<link rel="alternate">` vers un type non enregistré fera rougir ce fichier.
 *
 * Les trois types adossés à la base (blog / actualites / guides) ne peuvent pas
 * rendre un corps sans DB : pour eux la garde vérifie l'enregistrement du type
 * (la route ne répond pas « Unknown content type »), et le contenu est couvert
 * par la route elle-même en production. Les quatre types adossés à un SSOT
 * fichier sont, eux, vérifiés de bout en bout : 200 + corps substantiel.
 */

import { describe, it, expect, vi, beforeAll } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

vi.mock("@/lib/seo", () => ({
  SITE_URL: "https://axion-ia.com",
  SITE_EDITORIAL_DATE: "2026-06-08T00:00:00.000Z",
}));

// Aucune DB en test : le mock rend `null` / `[]` pour toutes les lectures, ce
// qui suffit — les types vérifiés de bout en bout lisent des SSOT fichiers.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    articleTranslation: { findFirst: async () => null },
    caseStudyTranslation: { findFirst: async () => null },
    helpArticleTranslation: { findFirst: async () => null },
    fAQ: { findFirst: async () => null, findMany: async () => [] },
    knowledgeEntry: { findMany: async () => [] },
  },
}));

import { GET } from "./route";
import { listGlossaryTermSlugs } from "@/content/glossary-extension";
import { getAllSlugs as getAllCaseSlugs } from "@/content/case-studies";
import { FAQ_GLOBAL, HELP_ARTICLES } from "@/content/transversal";

/** Appelle la route comme le ferait Next, avec ses `params` asynchrones. */
async function fetchMarkdown(type: string, slug: string): Promise<Response> {
  const url = `https://axion-ia.com/api/markdown/${type}/${slug}`;
  return GET(new Request(url) as never, { params: Promise.resolve({ type, slug }) });
}

/**
 * Relit les pages publiques et retourne les types annoncés aux crawlers via
 * `<link rel="alternate" type="text/markdown" href="/api/markdown/<type>/…">`.
 * C'est la source de vérité de la promesse faite aux moteurs : ce qui est
 * annoncé ici DOIT être servi par la route.
 */
function typesAnnoncesParLesPages(): string[] {
  const racine = path.resolve(process.cwd(), "src/app/[locale]");
  const entrees = readdirSync(racine, { recursive: true, encoding: "utf8" });
  const types = new Set<string>();
  for (const rel of entrees) {
    if (!rel.endsWith(".tsx")) continue;
    const source = readFileSync(path.join(racine, rel), "utf8");
    // On ne retient que les déclarations `rel="alternate"` markdown, pas les
    // simples mentions d'URL en prose ou en commentaire.
    for (const bloc of source.matchAll(/<link[^>]*rel="alternate"[^>]*>/g)) {
      if (!bloc[0].includes('type="text/markdown"')) continue;
      const href = bloc[0].match(/\/api\/markdown\/([a-z0-9-]+)\//);
      const type = href?.[1];
      if (type) types.add(type);
    }
  }
  return [...types].sort();
}

/**
 * Types dont le contenu vient d'un SSOT fichier → vérifiables sans DB.
 *
 * Le `?? ""` n'est pas un adoucissement : un SSOT vide rend un slug vide, et
 * l'assertion `toBeTruthy()` du test rougit alors en le disant. Sans lui, c'est
 * `noUncheckedIndexedAccess` qui refuserait le fichier au typecheck.
 */
const SLUGS_SANS_DB: Record<string, () => string> = {
  glossaire: () => listGlossaryTermSlugs()[0] ?? "",
  "cas-concrets": () => getAllCaseSlugs()[0] ?? "",
  "centre-aide": () => HELP_ARTICLES[0]?.slug ?? "",
  faq: () => FAQ_GLOBAL[0]?.id ?? "",
};

let annonces: string[] = [];
beforeAll(() => {
  annonces = typesAnnoncesParLesPages();
});

describe("/api/markdown — tout type annoncé aux crawlers est enregistré", () => {
  it("relit bien les pages publiques (garde anti-test-vide)", () => {
    // Un scan qui ne trouve rien rendrait tous les tests suivants verts sans
    // rien vérifier. C'est le mode d'échec n°1 de ce genre de garde.
    expect(annonces.length).toBeGreaterThanOrEqual(5);
    expect(annonces).toContain("glossaire");
    expect(annonces).toContain("centre-aide");
    expect(annonces).toContain("cas-concrets");
  });

  it("n'annonce aucun type que la route refuse (« Unknown content type »)", async () => {
    for (const type of annonces) {
      const res = await fetchMarkdown(type, "slug-inexistant-pour-le-test");
      const corps = await res.text();
      expect(corps, `le type « ${type} » est annoncé aux crawlers mais non enregistré`).not.toMatch(
        /Unknown content type/,
      );
    }
  });
});

describe("/api/markdown — les types adossés à un SSOT fichier servent un vrai corps", () => {
  for (const [type, slugDe] of Object.entries(SLUGS_SANS_DB)) {
    it(`${type} : 200 avec un corps substantiel`, async () => {
      const slug = slugDe();
      expect(slug, `aucun slug de test pour ${type}`).toBeTruthy();
      const res = await fetchMarkdown(type, slug);
      expect(res.status, `/api/markdown/${type}/${slug} doit répondre 200`).toBe(200);
      const corps = await res.text();

      // GEO-039 : un 200 dont le corps se réduit au titre et au pied de page
      // est PIRE qu'un 404 — le moteur conclut que la fiche est vide.
      // On isole donc le contenu entre le titre et le séparateur de pied.
      const contenu = (corps.split("\n---\n")[0] ?? "").split("\n").slice(1).join("\n").trim();
      expect(contenu.length, `corps vide servi pour ${type}/${slug}`).toBeGreaterThan(80);
    });
  }

  it("ne sert JAMAIS de token de prix brut aux moteurs de réponse", async () => {
    for (const [type, slugDe] of Object.entries(SLUGS_SANS_DB)) {
      const res = await fetchMarkdown(type, slugDe());
      expect(await res.text(), `${type} sert un gabarit non résolu`).not.toContain("{{price:");
    }
  });
});

describe("/api/markdown — les types inconnus restent en 404", () => {
  it("refuse un type non enregistré", async () => {
    const res = await fetchMarkdown("recettes-de-cuisine", "quiche");
    expect(res.status).toBe(404);
    expect(await res.text()).toMatch(/Unknown content type/);
  });
});
