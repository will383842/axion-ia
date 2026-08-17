// @vitest-environment node
//
// Environnement `node` : lecture de fichiers du dépôt pour les vérifications
// de câblage.

/**
 * GEO-082 — l'historique de slugs était ÉCRIT pour tous les types et LU par un
 * seul.
 *
 * ## Le défaut
 *
 * `recordSlugChange` alimente `KnowledgeSlugHistory` à chaque renommage, quel
 * que soit le type. Mais une seule route publique consultait cet historique :
 * `/guides/[slug]`. Renommer une fiche ailleurs produisait donc un **404 sec**,
 * et le lien externe qui pointait dessus était perdu — alors que la donnée
 * permettant de le rattraper existait en base.
 *
 * ## Le second défaut, trouvé en corrigeant le premier
 *
 * `kbTypeToPublicPath` rendait `null` pour 21 des 28 types, au motif qu'ils
 * seraient « admin-only ». C'est faux : `/connaissances/[slug]` est la route KB
 * **générique**, elle sert n'importe quel type par son slug — les 507 URLs de
 * `sitemap-knowledge.xml` y pointent toutes. Ce qui décide de la publicité
 * d'une fiche, ce sont `audience` et `confidentiality`, jamais son type.
 *
 * ## Le troisième, qui aurait annulé le bénéfice
 *
 * `findRedirectFromHistory` ne vérifiait que `deletedAt`. Une fiche passée en
 * `audience: team`, dépubliée ou sous embargo produisait donc une **301 vers un
 * 404** — pire qu'un 404 direct : le moteur enregistre le saut, purge
 * l'ancienne URL, et n'obtient rien en échange.
 *
 * ## Ce que ce fichier NE couvre pas, et pourquoi
 *
 * `/cas-concrets/[slug]` et `/glossaire/[slug]` portent `dynamicParams = false`
 * — un slug inconnu n'atteint JAMAIS le code de la page, Next répond 404 au
 * niveau du routeur. Le rattrapage y est impossible à ce niveau ; il devrait
 * vivre dans `proxy.ts`. Ce choix (`anti soft-404 SSG`) est délibéré et
 * documenté dans ces fichiers : on ne le renverse pas au passage. Le test le
 * CONSTATE pour que la limite reste visible.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { kbTypeToPublicPath } from "../slug-history";

const RACINE = process.cwd();
const lire = (r: string): string => readFileSync(path.join(RACINE, r), "utf8");

describe("GEO-082 — tout type public a un chemin, aucun n'est orphelin", () => {
  it("les types à route dédiée gardent leur chemin", () => {
    expect(kbTypeToPublicPath("guide", "fr", "x")).toBe("/fr/guides/x");
    expect(kbTypeToPublicPath("article", "fr", "x")).toBe("/fr/blog/x");
    expect(kbTypeToPublicPath("faq", "fr", "x")).toBe("/fr/faq/x");
    expect(kbTypeToPublicPath("glossary_term", "fr", "x")).toBe("/fr/glossaire/x");
    expect(kbTypeToPublicPath("case_study", "fr", "x")).toBe("/fr/cas-concrets/x");
  });

  it("🔴 les types SANS route dédiée retombent sur la route KB générique", () => {
    // Avant : `null` — donc aucune redirection possible, 404 sec au renommage.
    // Ces types sont pourtant servis, et déclarés au sitemap.
    for (const t of [
      "comparison",
      "automation_recipe",
      "tool_review",
      "industry_use_case",
      "implementation_playbook",
      "prompt_pattern",
      "secteur_brief",
      "metier_brief",
      "competence_boost",
    ] as const) {
      expect(kbTypeToPublicPath(t, "fr", "x"), `${t} ne doit pas être orphelin`).toBe(
        "/fr/connaissances/x",
      );
    }
  });

  it("aucun type ne rend `null`", () => {
    // La garde de fond : si quelqu'un rajoute un type à l'enum sans y penser,
    // il hérite de la route générique au lieu de disparaître en silence.
    const types = ["doctrine", "adr", "sop", "tool_card", "dept_brief"] as const;
    for (const t of types) {
      expect(kbTypeToPublicPath(t, "fr", "x")).not.toBeNull();
    }
  });
});

describe("🔴 une 301 ne doit jamais mener à un 404", () => {
  it("la cible est vérifiée avec le prédicat anti-fuite SSOT", () => {
    const src = lire("src/lib/knowledge/slug-history.ts");
    // On réutilise `publicEntryFilter` — le recopier, c'est le laisser diverger.
    expect(src).toContain("publicEntryFilter");
    expect(
      src,
      "sans re-vérification, une fiche passée en `team` produirait une 301 vers un 404",
    ).toMatch(/findFirst\(\{\s*where:\s*\{\s*id:\s*hit\.entry\.id,\s*\.\.\.publicEntryFilter/);
  });
});

describe("le rattrapage est câblé là où un slug inconnu atteint la page", () => {
  const CABLEES = [
    "src/app/[locale]/guides/[slug]/page.tsx",
    "src/app/[locale]/connaissances/[slug]/page.tsx",
    "src/app/[locale]/faq/[slug]/page.tsx",
  ];

  it.each(CABLEES)("%s consulte l'historique avant de rendre un 404", (f) => {
    const src = lire(f);
    expect(src).toContain("findRedirectFromHistory");
    expect(src).toContain("permanentRedirect");
  });

  it("la route KB générique interroge SANS type — elle ne peut pas le deviner", () => {
    // Elle sert toutes les familles : exiger un type ici obligerait à en
    // inventer un, et le rattrapage manquerait toutes les autres.
    const src = lire("src/app/[locale]/connaissances/[slug]/page.tsx");
    const appel = src.slice(src.indexOf("findRedirectFromHistory({"));
    expect(appel.slice(0, 200)).not.toContain("oldType");
  });

  it("⚠️ les routes à `dynamicParams = false` restent hors de portée — c'est constaté, pas oublié", () => {
    // Un slug inconnu n'y atteint jamais le code : Next répond 404 au routeur.
    // Le rattrapage devrait vivre dans `proxy.ts`. Si quelqu'un passe un jour
    // l'une d'elles en `dynamicParams = true`, ce test rougit et rappelle
    // qu'il faut alors y câbler l'historique.
    for (const f of [
      "src/app/[locale]/cas-concrets/[slug]/page.tsx",
      "src/app/[locale]/glossaire/[slug]/page.tsx",
    ]) {
      const src = lire(f);
      const horsPortee = /dynamicParams\s*=\s*false/.test(src);
      const cablee = src.includes("findRedirectFromHistory");
      expect(
        horsPortee || cablee,
        `${f} accepte désormais les slugs inconnus : y câbler findRedirectFromHistory`,
      ).toBe(true);
    }
  });
});
