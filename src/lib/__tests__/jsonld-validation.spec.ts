/**
 * Validation JSON-LD en CI (refonte 2026-06-22) — remplace le stub
 * `scripts/check-schema.ts` (qui ne validait RIEN depuis « Sprint 0 »).
 *
 * Exerce les factories JSON-LD avec des entrées d'exemple et vérifie
 * structurellement chaque sortie :
 *  - présence de `@context = https://schema.org` (ou `@graph`) + `@type` ;
 *  - aucune valeur string ne contient « undefined » / « null » / « ${ »
 *    (= interpolation cassée, ex. un @id `…/equipe/undefined#person`) ;
 *  - tout champ `@id` / `url` est une URL absolue (http) ou un chemin (`/…`).
 *
 * Garde-fou contre les schemas cassés silencieux (l'@id orphelin de Williams,
 * un FAQPage mal formé, une URL malformée…) — ce que ne détectait aucun test.
 */

import { describe, it, expect } from "vitest";
import {
  buildArticleJsonLd,
  buildBlogPostingJsonLd,
  buildNewsArticleJsonLd,
  buildHowToJsonLd,
  buildQAPageJsonLd,
} from "@/lib/seo-content-gen-factories";
import {
  buildFaqJsonLd,
  buildPersonJsonLd,
  // Homonyme de la factory content-gen importée au-dessus : ce sont DEUX fonctions
  // distinctes, et c'est celle-ci — la générique de `lib/seo` — qui signait chaque article
  // d'un `Person` anonyme.
  buildArticleJsonLd as buildArticleJsonLdGenerique,
} from "@/lib/seo";
import { FOUNDER, FOUNDER_PERSON_ID } from "@/lib/brand";
import { buildPersonWilliamsJsonLd } from "@/lib/seo/williams-person";

/** Collecte récursive des anomalies de structure dans un nœud JSON-LD. */
function findIssues(node: unknown, path = "$"): string[] {
  const issues: string[] = [];
  if (typeof node === "string") {
    if (/\bundefined\b/.test(node)) issues.push(`${path}: contient "undefined" → ${node}`);
    if (node.includes("${")) issues.push(`${path}: interpolation non résolue → ${node}`);
    return issues;
  }
  if (Array.isArray(node)) {
    node.forEach((v, i) => issues.push(...findIssues(v, `${path}[${i}]`)));
    return issues;
  }
  if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) {
      if ((k === "@id" || k === "url") && typeof v === "string") {
        if (!/^(https?:\/\/|\/)/.test(v)) issues.push(`${path}.${k}: URL/@id malformé → "${v}"`);
      }
      issues.push(...findIssues(v, `${path}.${k}`));
    }
  }
  return issues;
}

function expectValidJsonLd(label: string, jsonld: Record<string, unknown>): void {
  const hasContext = jsonld["@context"] === "https://schema.org";
  const hasGraph = Array.isArray(jsonld["@graph"]);
  expect(hasContext || hasGraph, `${label}: @context ou @graph manquant`).toBe(true);
  expect(jsonld["@type"] ?? hasGraph, `${label}: @type manquant`).toBeTruthy();
  const issues = findIssues(jsonld);
  expect(issues, `${label}:\n${issues.join("\n")}`).toEqual([]);
}

const D = new Date("2026-06-22T00:00:00.000Z");
const articleInput = {
  title: "Audit IA pour les PME industrielles",
  description: "Comment cadrer un audit IA en PME industrielle.",
  slug: "audit-ia-pme-industrielles",
  locale: "fr" as const,
  publishedAt: D,
  updatedAt: D,
  urlSegment: "blog" as const,
};

describe("jsonld-validation (gate schema CI)", () => {
  it("Article / BlogPosting / TechArticle", () => {
    expectValidJsonLd("Article", buildArticleJsonLd(articleInput));
    expectValidJsonLd("BlogPosting", buildBlogPostingJsonLd(articleInput));
  });

  it("NewsArticle", () => {
    expectValidJsonLd(
      "NewsArticle",
      buildNewsArticleJsonLd({
        title: "Nouvelle réglementation IA",
        description: "Ce qui change.",
        slug: "nouvelle-reglementation-ia",
        locale: "fr",
        publishedAt: D,
        updatedAt: D,
        wordCount: 800,
        urlSegment: "actualites",
      }),
    );
  });

  it("HowTo", () => {
    expectValidJsonLd(
      "HowTo",
      buildHowToJsonLd({
        name: "Déployer un RAG en 4 étapes",
        description: "Guide pratique.",
        slug: "guide-deployer-rag",
        locale: "fr",
        publishedAt: D,
        updatedAt: D,
        totalTimeMinutes: 30,
        steps: [
          { name: "Cadrer", text: "Définir le périmètre." },
          { name: "Indexer", text: "Vectoriser les documents." },
        ],
      }),
    );
  });

  it("QAPage", () => {
    expectValidJsonLd(
      "QAPage",
      buildQAPageJsonLd({
        question: "Qu'est-ce qu'un audit IA ?",
        answerHtml: "<p>Un diagnostic des opportunités IA d'une entreprise.</p>",
        slug: "qu-est-ce-qu-un-audit-ia",
        locale: "fr",
        publishedAt: D,
        dateModified: D,
      }),
    );
  });

  it("FAQPage", () => {
    expectValidJsonLd(
      "FAQPage",
      buildFaqJsonLd({
        items: [
          { question: "Combien de temps ?", answer: "Environ 2 semaines." },
          { question: "Pour qui ?", answer: "TPE, PME et ETI." },
        ],
      }),
    );
  });

  it("Person (Williams) — pas d'@id orphelin/cassé", () => {
    const p = buildPersonWilliamsJsonLd("fr");
    expectValidJsonLd("Person Williams", p);
    expect(String(p["@id"])).toMatch(/\/fr\/equipe\/williams#person$/);
  });

  /**
   * UNE personne, UN `@id` (2026-08-17).
   *
   * Le dépôt fabriquait quatre identifiants pour Williams : `/fr/equipe/williams#person`
   * (la fiche), `/{locale}/equipe/williams#person` (les `reviewedBy`, donc un second en EN),
   * `/a-propos#will` (les défauts de `buildPersonJsonLd` et `buildArticleJsonLd`), et rien
   * du tout sur l'auteur de chaque article — un `Person` anonyme par page. Un `@id` est un
   * NOM d'entité : quatre noms ne décrivent pas mieux une personne, ils la divisent en
   * quatre moitiés dont aucune ne fait autorité.
   */
  describe("une seule entité Person pour le fondateur", () => {
    /**
     * `buildOrganizationJsonLd` n'est pas exercé ici : plusieurs de ses paramètres ont pour
     * valeur par défaut une variable d'environnement SERVEUR, que cet environnement de test
     * refuse de lire. Son `founder["@id"]` dérive de la même constante — il ne peut pas
     * diverger sans que le typage casse.
     */
    it("la fiche et le Person par défaut citent le MÊME `@id`", () => {
      expect(buildPersonWilliamsJsonLd("fr")["@id"]).toBe(FOUNDER_PERSON_ID);
      expect(buildPersonJsonLd({ locale: "fr" })["@id"]).toBe(FOUNDER_PERSON_ID);
    });

    it("la locale ne fabrique plus un second `@id` — la fiche n'existe qu'en FR", () => {
      expect(buildPersonWilliamsJsonLd("en")["@id"]).toBe(FOUNDER_PERSON_ID);
      expect(buildPersonJsonLd({ locale: "en" })["@id"]).toBe(FOUNDER_PERSON_ID);
    });

    it("l'auteur d'un article signé du fondateur CITE l'entité au lieu de la redécrire", () => {
      const article = buildArticleJsonLdGenerique({
        locale: "fr",
        path: "/blog/exemple",
        headline: "Un titre",
        description: "Une description.",
        datePublished: "2026-08-17",
      }) as { author: { "@id"?: string; name: string; url: string } };
      expect(article.author["@id"]).toBe(FOUNDER_PERSON_ID);
      expect(article.author.name).toBe(FOUNDER.fullName);
      expect(article.author.url).not.toContain("#will");
    });

    it("le slug legacy `will` converge au lieu de continuer à diverger", () => {
      expect(buildPersonJsonLd({ locale: "fr", slug: "will" })["@id"]).toBe(FOUNDER_PERSON_ID);
    });

    /**
     * Le garde-fou qui compte : poser l'`@id` du fondateur sur quelqu'un d'autre
     * FUSIONNERAIT deux personnes, ce qui est pire que de n'en identifier aucune.
     */
    it("n'attribue JAMAIS l'`@id` du fondateur à un autre auteur", () => {
      const autre = buildPersonJsonLd({ locale: "fr", slug: "invite", name: "Autre Personne" });
      expect(autre).not.toHaveProperty("@id");
      const articleAutre = buildArticleJsonLdGenerique({
        locale: "fr",
        path: "/blog/invite",
        headline: "Un titre",
        description: "Une description.",
        datePublished: "2026-08-17",
        authorSlug: "invite",
        authorName: "Autre Personne",
      }) as { author: { "@id"?: string } };
      expect(articleAutre.author).not.toHaveProperty("@id");
    });
  });
});
