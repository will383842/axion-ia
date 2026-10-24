/**
 * Lot L8a (audit blog/RAG 24/10/2026) : garde-fous sur le texte des prompts des générateurs.
 *
 * Détection au niveau du code source (comme persona-coverage.spec.ts) : on ne lance
 * aucun appel de modèle. Le bloc de positionnement lui-même est testé dans
 * brand/__tests__/positionnement.spec.ts : ici on vérifie seulement que chaque
 * générateur qui le reçoit donne aussi l'angle d'entrée, et que les consignes
 * contradictoires (exemples chiffrés, « 2 statistiques », étiquette TPE/PME) ont disparu.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { appliquerEchecsSections } from "../echecs-sections";
import { detecterInterdits } from "@/lib/contenu/interdits-publication";

const DIR = resolve(__dirname, "..");

const AVEC_ANGLE = [
  "barometer-insight.ts",
  "blog-article.ts",
  "blog-from-keywords.ts",
  "blog-from-rss.ts",
  "blog-from-title.ts",
  "comparison.ts",
  "faq-standalone.ts",
  "guide-pilier.ts",
  "qa-derived.ts",
  "v7-phase8-shared.ts",
] as const;

function source(fichier: string): string {
  return readFileSync(resolve(DIR, fichier), "utf8");
}

describe("L8a : prompts des générateurs", () => {
  it.each(AVEC_ANGLE)("%s donne l'angle d'entrée et la section de chiffres vérifiés", (f) => {
    const s = source(f);
    expect(s).toContain("consigneAngle(input.jobId)");
    expect(s).toContain("sectionChiffresVerifies()");
  });

  it.each(AVEC_ANGLE)("%s n'a plus d'exemple chiffré ni d'exigence de statistiques", (f) => {
    const s = source(f);
    expect(s).not.toContain("+40 %");
    expect(s).not.toContain(">90/100<");
    expect(s).not.toMatch(/au moins 2 statistiques/i);
    expect(s).not.toMatch(/AU MOINS 1 chiffre-clé/);
  });

  it.each(AVEC_ANGLE)("%s ne demande jamais l'étiquette TPE/PME ni « formation BANNI »", (f) => {
    const s = source(f);
    expect(s).not.toContain("formation BANNI");
    // Les seules occurrences permises sont celles qui l'INTERDISENT (« pas d'étiquette »).
    const sansInterdiction = s.replace(/pas d'étiquette « TPE\/PME »/g, "");
    expect(
      detecterInterdits(sansInterdiction, {
        actualite: false,
        financementPublicAutorise: false,
      }).filter((v) => v.code === "etiquette-tpe-pme"),
    ).toEqual([]);
  });

  it("les générateurs de blog ne proposent plus de sujet par défaut « formation intelligence artificielle »", () => {
    expect(source("blog-article.ts")).not.toContain("formation intelligence artificielle");
    expect(source("blog-article.ts")).toContain("déploiement de l'IA");
  });

  it("guide-pilier ne publie plus de texte « Section indisponible »", () => {
    const s = source("guide-pilier.ts");
    expect(s).not.toContain("<em>Section indisponible");
  });

  it("guide-pilier : une section en échec plafonne la qualité et force la relecture (tier_3)", () => {
    const un = appliquerEchecsSections(95, 1, 60);
    expect(un.forcerRelecture).toBe(true);
    expect(un.qualityScore).toBeLessThan(60);
    expect(appliquerEchecsSections(95, 0, 60)).toEqual({
      qualityScore: 95,
      forcerRelecture: false,
    });
    expect(appliquerEchecsSections(30, 9, 60).qualityScore).toBe(0);
    expect(source("guide-pilier.ts")).toContain("!apresEchecs.forcerRelecture");
  });

  it("blog-from-rss : l'angle d'entrée ne vise que le paragraphe d'impact, l'intro reste factuelle", () => {
    const s = source("blog-from-rss.ts");
    expect(s).toContain(
      "Pour le paragraphe final sur l'impact uniquement, ${consigneAngle(input.jobId)}",
    );
    expect(s).toContain("L'introduction reste centrée sur l'information elle-même.");
  });

  it("v7-phase8-shared ne conseille plus de citer OPCO / France Travail", () => {
    const s = source("v7-phase8-shared.ts");
    expect(s).not.toMatch(/cite UNIQUEMENT : les OPCO/);
  });

  it("le marqueur du bloc n'est pas recopié dans les générateurs (pas de doublon)", () => {
    for (const f of AVEC_ANGLE) {
      expect(source(f)).not.toContain("POSITIONNEMENT AXION-IA");
    }
  });
});
