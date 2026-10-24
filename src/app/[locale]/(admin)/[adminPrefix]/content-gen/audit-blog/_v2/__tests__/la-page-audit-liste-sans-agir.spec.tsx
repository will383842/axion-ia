/**
 * La page d'audit de l'existant liste, et n'agit que sur clic.
 *
 * Deux sens : les catégories à décision (Grenoble, articles courts, avis signés)
 * n'ont AUCUN bouton ; les catégories à geste réversible en ont un par ligne,
 * jamais un bouton « tout archiver ». Le rendu ne doit appeler aucune action.
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";

const { demoteMock, archiveMock } = vi.hoisted(() => ({
  demoteMock: vi.fn(async () => undefined),
  archiveMock: vi.fn(async () => undefined),
}));

vi.mock("@/server/actions/content-gen/article", () => ({
  demoteArticle: demoteMock,
  archiveArticle: archiveMock,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { AuditBlogV2 } from "../AuditBlogV2";
import { auditerArticles, type EntreeAudit } from "@/server/content-gen/audit-blog-existant";
import type { AuditBlogCharge } from "@/server/content-gen/lecture-audit-blog";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function entree(id: string, s: Partial<EntreeAudit>): EntreeAudit {
  return {
    id,
    slug: `article-${id}`,
    titre: `Titre ${id}`,
    indexationTier: "tier_1_indexable",
    isNews: false,
    templateVariant: null,
    qualityScore: 80,
    campagneNom: null,
    expertNom: null,
    expertTexte: null,
    mots: 900,
    surface: { corps: "Texte sain." },
    ...s,
  };
}

function charge(entrees: EntreeAudit[]): AuditBlogCharge {
  return {
    resultat: auditerArticles(entrees, { financementPublicAutorise: false }),
    totalPublies: entrees.length,
    trafic: new Map([["g1", { clics: 3, impressions: 120, position: 14 }]]),
    gscDisponible: true,
    fenetreJours: 90,
  };
}

describe("AuditBlogV2", () => {
  it("n'appelle aucune action au rendu", () => {
    render(
      <AuditBlogV2
        adminPrefix="console"
        audit={charge([entree("q1", { surface: { corps: "Certifié Qualiopi." } })])}
      />,
    );
    expect(demoteMock).not.toHaveBeenCalled();
    expect(archiveMock).not.toHaveBeenCalled();
  });

  it("propose « Archiver » sur un article Qualiopi, ligne par ligne", () => {
    render(
      <AuditBlogV2
        adminPrefix="console"
        audit={charge([
          entree("q1", { surface: { corps: "Certifié Qualiopi." } }),
          entree("q2", { surface: { corps: "Éligible au CPF." } }),
        ])}
      />,
    );
    expect(screen.getAllByRole("button", { name: "Archiver" })).toHaveLength(2);
  });

  it("ne met aucun bouton sur Grenoble, ni sur les articles courts", () => {
    render(
      <AuditBlogV2
        adminPrefix="console"
        audit={charge([
          entree("g1", { surface: { titre: "L'IA à Grenoble", corps: "Texte." }, mots: 900 }),
          entree("c1", { mots: 100 }),
        ])}
      />,
    );
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.getAllByText(/Aucun geste/).length).toBeGreaterThanOrEqual(2);
  });

  it("montre le trafic Search Console des pages Grenoble", () => {
    render(
      <AuditBlogV2
        adminPrefix="console"
        audit={charge([entree("g1", { surface: { titre: "L'IA à Grenoble", corps: "Texte." } })])}
      />,
    );
    expect(screen.getByText(/3 clics · 120 impr\./)).toBeInTheDocument();
  });

  it("n'offre pas « Retirer de Google » sur un article déjà non indexé", () => {
    render(
      <AuditBlogV2
        adminPrefix="console"
        audit={charge([
          entree("p1", {
            surface: { corps: "Satisfaction garantie." },
            indexationTier: "tier_2_noindex_follow",
          }),
        ])}
      />,
    );
    expect(screen.queryByRole("button", { name: "Retirer de Google" })).toBeNull();
    expect(screen.getByText("Déjà hors de Google")).toBeInTheDocument();
  });

  it("dit qu'il n'y a rien quand une catégorie est vide", () => {
    render(<AuditBlogV2 adminPrefix="console" audit={charge([entree("ok", {})])} />);
    const vides = screen.getAllByText("Aucun article dans cette catégorie.");
    expect(vides.length).toBeGreaterThan(0);
    expect(within(document.body).queryAllByRole("button")).toHaveLength(0);
  });
});
