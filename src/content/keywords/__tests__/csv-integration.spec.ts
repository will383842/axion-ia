/**
 * Intégration CSV formation + sites/saas (2026-06-02).
 *  - validité des seeds (validateAllSeeds = 0 invalide)
 *  - garde-fou anti-cannibalisation : PONCTUEL≠RECURRENT, AUGMENTATION≠NATIVE
 *  - axes formationFormat / siteProjectType peuplés
 *  - aucune collision keyword entre les nouveaux fichiers et le reste du corpus
 */
import { describe, it, expect } from "vitest";
import { ALL_KEYWORD_SEEDS, BY_FORMATION_FORMAT, BY_SITE_PROJECT_TYPE } from "../master";
import { validateAllSeeds } from "../validate";
import { KW_FORMATION_CLUSTERS_V2 } from "../g2m-formation-clusters";
import { KW_SITES_SAAS_CLUSTERS } from "../g3h-sites-saas-clusters";
import { KW_UN_A_UN_V2 } from "../g6m-un-a-un-clusters";

const NEW_SEEDS = [...KW_FORMATION_CLUSTERS_V2, ...KW_SITES_SAAS_CLUSTERS, ...KW_UN_A_UN_V2];
const norm = (k: string) => k.trim().toLowerCase();

describe("CSV integration — validité", () => {
  it("g2m-formation-clusters : 0 seed invalide", () => {
    const r = validateAllSeeds(KW_FORMATION_CLUSTERS_V2);
    if (r.invalid > 0) console.error(JSON.stringify(r.errors, null, 2));
    expect(r.invalid).toBe(0);
  });

  it("g3h-sites-saas-clusters : 0 seed invalide", () => {
    const r = validateAllSeeds(KW_SITES_SAAS_CLUSTERS);
    if (r.invalid > 0) console.error(JSON.stringify(r.errors, null, 2));
    expect(r.invalid).toBe(0);
  });

  it("g6m-un-a-un-clusters : 0 seed invalide", () => {
    const r = validateAllSeeds(KW_UN_A_UN_V2);
    if (r.invalid > 0) console.error(JSON.stringify(r.errors, null, 2));
    expect(r.invalid).toBe(0);
  });

  it("volume minimal par fichier", () => {
    expect(KW_FORMATION_CLUSTERS_V2.length).toBeGreaterThanOrEqual(55);
    expect(KW_SITES_SAAS_CLUSTERS.length).toBeGreaterThanOrEqual(55);
    expect(KW_UN_A_UN_V2.length).toBeGreaterThanOrEqual(40);
  });
});

describe("CSV integration — anti-cannibalisation URL", () => {
  it("PONCTUEL et RECURRENT ne partagent aucune urlCible", () => {
    const ponctuel = new Set(BY_FORMATION_FORMAT("ponctuel").map((s) => s.urlCible));
    const recurrent = BY_FORMATION_FORMAT("recurrent").map((s) => s.urlCible);
    const overlap = recurrent.filter((u) => ponctuel.has(u));
    expect(overlap, `overlap: ${overlap.join(", ")}`).toEqual([]);
  });

  it("AUGMENTATION et NATIVE ne partagent aucune urlCible", () => {
    const aug = new Set(BY_SITE_PROJECT_TYPE("augmentation").map((s) => s.urlCible));
    const nat = BY_SITE_PROJECT_TYPE("native").map((s) => s.urlCible);
    const overlap = nat.filter((u) => aug.has(u));
    expect(overlap, `overlap: ${overlap.join(", ")}`).toEqual([]);
  });
});

describe("CSV integration — axes peuplés", () => {
  it("formationFormat couvre ses 3 valeurs", () => {
    expect(BY_FORMATION_FORMAT("ponctuel").length).toBeGreaterThan(0);
    expect(BY_FORMATION_FORMAT("recurrent").length).toBeGreaterThan(0);
    expect(BY_FORMATION_FORMAT("transverse").length).toBeGreaterThan(0);
  });

  it("siteProjectType couvre ses 3 valeurs", () => {
    expect(BY_SITE_PROJECT_TYPE("augmentation").length).toBeGreaterThan(0);
    expect(BY_SITE_PROJECT_TYPE("native").length).toBeGreaterThan(0);
    expect(BY_SITE_PROJECT_TYPE("transverse").length).toBeGreaterThan(0);
  });
});

describe("CSV integration — pas de collision keyword", () => {
  it("les nouveaux fichiers n'ont aucun doublon interne", () => {
    const seen = new Map<string, number>();
    for (const s of NEW_SEEDS) seen.set(norm(s.keyword), (seen.get(norm(s.keyword)) ?? 0) + 1);
    const dups = [...seen.entries()].filter(([, n]) => n > 1).map(([k]) => k);
    expect(dups, `doublons internes: ${dups.join(" | ")}`).toEqual([]);
  });

  it("aucun keyword des nouveaux fichiers ne collisionne avec un seed pré-existant", () => {
    const newKeys = new Set(NEW_SEEDS.map((s) => norm(s.keyword)));
    // Reconstruit le corpus pré-existant = ALL moins les nouveaux (par référence).
    const newSet = new Set(NEW_SEEDS);
    const existing = ALL_KEYWORD_SEEDS.filter((s) => !newSet.has(s));
    const collisions = [...new Set(existing.map((s) => norm(s.keyword)))].filter((k) =>
      newKeys.has(k),
    );
    expect(collisions, `collisions: ${collisions.join(" | ")}`).toEqual([]);
  });
});
