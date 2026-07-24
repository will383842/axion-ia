/**
 * Tests — nettoyage générique du référentiel Formation/OffreSite (partie pure).
 *
 * Inclut le test de non-régression du trou réel constaté le 2026-07-24 : la
 * génération de formations remplacée le 2026-07-15 n'avait jamais été archivée
 * parce que la liste `REPLACED_AXION_SLUGS` ne la mentionnait pas.
 */

import { describe, it, expect } from "vitest";

import {
  currentCatalogSlugs,
  planCatalogueCleanup,
  type FormationCleanupRow,
  type OffreCleanupRow,
} from "./catalogue-cleanup";
import { FORMATIONS_V2 } from "../../../content/formations/catalog-v2";

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

let seq = 0;

function formation(over: Partial<FormationCleanupRow> = {}): FormationCleanupRow {
  seq += 1;
  return {
    id: `f-${seq}`,
    numero: `AXI-FORM-2026-${String(seq).padStart(3, "0")}`,
    slug: `slug-${seq}`,
    titre: `Formation ${seq}`,
    statut: "actif",
    estSurMesure: false,
    offreSiteId: `o-${seq}`,
    ...over,
  };
}

function offre(over: Partial<OffreCleanupRow> = {}): OffreCleanupRow {
  seq += 1;
  return {
    id: `o-${seq}`,
    code: `AXI-OFF-${String(seq).padStart(3, "0")}`,
    slug: `slug-${seq}`,
    titreFr: `Offre ${seq}`,
    actif: true,
    ...over,
  };
}

const CATALOGUE = new Set(["ia-pour-les-rh", "ia-pour-le-btp"]);

// ─────────────────────────────────────────────────────────────────────────────

describe("currentCatalogSlugs", () => {
  it("expose exactement les slugs du SSOT catalog-v2", () => {
    const slugs = currentCatalogSlugs();
    expect(slugs.size).toBe(FORMATIONS_V2.length);
    for (const f of FORMATIONS_V2) expect(slugs.has(f.slugFr)).toBe(true);
  });
});

describe("planCatalogueCleanup — formations", () => {
  it("archive une formation dont le slug n'est plus au catalogue", () => {
    const obsolete = formation({ slug: "ia-express" });
    const plan = planCatalogueCleanup({
      formations: [obsolete],
      offres: [],
      catalogSlugs: CATALOGUE,
    });
    expect(plan.formationsToArchive).toHaveLength(1);
    expect(plan.formationsToArchive[0]!.slug).toBe("ia-express");
  });

  it("laisse intacte une formation présente au catalogue", () => {
    const plan = planCatalogueCleanup({
      formations: [formation({ slug: "ia-pour-les-rh" })],
      offres: [],
      catalogSlugs: CATALOGUE,
    });
    expect(plan.formationsToArchive).toHaveLength(0);
  });

  it("épargne une formation sur-mesure hors catalogue et la signale", () => {
    const surMesure = formation({ slug: "client-acme-parcours", estSurMesure: true });
    const plan = planCatalogueCleanup({
      formations: [surMesure],
      offres: [],
      catalogSlugs: CATALOGUE,
    });
    expect(plan.formationsToArchive).toHaveLength(0);
    expect(plan.formationsSurMesureKept).toHaveLength(1);
  });

  it("ignore une formation déjà archivée (idempotence)", () => {
    const plan = planCatalogueCleanup({
      formations: [formation({ slug: "ia-express", statut: "archive" })],
      offres: [],
      catalogSlugs: CATALOGUE,
    });
    expect(plan.formationsToArchive).toHaveLength(0);
  });

  it("signale sans la réactiver une formation archivée revenue au catalogue", () => {
    const plan = planCatalogueCleanup({
      formations: [formation({ slug: "ia-pour-le-btp", statut: "archive" })],
      offres: [],
      catalogSlugs: CATALOGUE,
    });
    expect(plan.formationsToArchive).toHaveLength(0);
    expect(plan.formationsArchiveesRevenuesAuCatalogue).toHaveLength(1);
    expect(plan.formationsArchiveesRevenuesAuCatalogue[0]!.slug).toBe("ia-pour-le-btp");
  });
});

describe("planCatalogueCleanup — non-régression du trou 2026-07-15", () => {
  it("attrape une génération entière que personne n'a listée en dur", () => {
    // Les 17 slugs de la génération remplacée le 2026-07-15 : jamais listés dans
    // REPLACED_AXION_SLUGS, donc restés `actif` en base pendant 9 jours.
    const gen1 = [
      "ia-express",
      "art-du-prompt",
      "ia-securite",
      "ia-conformite",
      "ia-fondamentaux",
      "ia-commercial",
      "ia-au-bureau",
      "ia-sur-le-terrain",
      "automatisations-decouverte",
      "ia-integration-metier",
      "ia-commercial-avance",
      "ia-transformation-equipe",
      "agents-automatisations",
      "agents-automatisations-avance",
      "claude-decouverte",
      "claude-createur",
      "claude-architecte",
    ].map((slug) => formation({ slug }));

    const actuelles = [...FORMATIONS_V2].map((f) => formation({ slug: f.slugFr }));

    const plan = planCatalogueCleanup({
      formations: [...gen1, ...actuelles],
      offres: [],
      catalogSlugs: currentCatalogSlugs(),
    });

    expect(plan.formationsToArchive).toHaveLength(17);
    expect(plan.formationsToArchive.map((f) => f.slug).sort()).toEqual(
      [...gen1.map((f) => f.slug)].sort(),
    );
  });
});

describe("planCatalogueCleanup — offres", () => {
  it("désactive une offre hors catalogue sans formation vivante", () => {
    const o = offre({ slug: "ia-express" });
    const plan = planCatalogueCleanup({ formations: [], offres: [o], catalogSlugs: CATALOGUE });
    expect(plan.offresToDeactivate).toHaveLength(1);
  });

  it("conserve une offre hors catalogue qui porte encore une formation sur-mesure", () => {
    const o = offre({ slug: "dirigeants" });
    const f = formation({ slug: "acme-dirigeants", estSurMesure: true, offreSiteId: o.id });
    const plan = planCatalogueCleanup({ formations: [f], offres: [o], catalogSlugs: CATALOGUE });
    expect(plan.offresToDeactivate).toHaveLength(0);
    expect(plan.offresKeptWithLiveFormation).toHaveLength(1);
  });

  it("désactive une offre dont la seule formation est archivée PAR CE PLAN", () => {
    const o = offre({ slug: "ia-express" });
    const f = formation({ slug: "ia-express", offreSiteId: o.id });
    const plan = planCatalogueCleanup({ formations: [f], offres: [o], catalogSlugs: CATALOGUE });
    expect(plan.formationsToArchive).toHaveLength(1);
    expect(plan.offresToDeactivate).toHaveLength(1);
  });

  it("ne touche pas une offre déjà inactive (idempotence)", () => {
    const plan = planCatalogueCleanup({
      formations: [],
      offres: [offre({ slug: "ia-express", actif: false })],
      catalogSlugs: CATALOGUE,
    });
    expect(plan.offresToDeactivate).toHaveLength(0);
  });

  it("ne touche pas une offre du catalogue courant", () => {
    const plan = planCatalogueCleanup({
      formations: [],
      offres: [offre({ slug: "ia-pour-les-rh" })],
      catalogSlugs: CATALOGUE,
    });
    expect(plan.offresToDeactivate).toHaveLength(0);
  });

  it("épargne les offres legacy quand includeLegacyOffres=false", () => {
    const legacy = offre({ slug: "essentielle" });
    const plan = planCatalogueCleanup({
      formations: [],
      offres: [legacy],
      catalogSlugs: CATALOGUE,
      includeLegacyOffres: false,
      legacyOffreIds: new Set([legacy.id]),
    });
    expect(plan.offresToDeactivate).toHaveLength(0);
  });
});
