/**
 * CLIQUET — chaque fiche formation publique porte une rubrique explicite
 * « Reconnaissance de la formation » (indicateur 1, décret n° 2026-728).
 *
 * ## Pourquoi
 *
 * Le référentiel en vigueur le 1er novembre 2026 ajoute à l'indicateur 1 le
 * « type de reconnaissance de la formation délivrée », et interdit toute
 * mention « de nature à induire le public en erreur ». Jusqu'au 02/10/2026,
 * l'information n'était qu'implicite, dans les modalités d'évaluation : aucune
 * rubrique ne disait que les formations sont NON CERTIFIANTES (analyse
 * d'écarts du 02/10, B2).
 *
 * ## Ce que ce fichier garde
 *
 *  1. Sur CHAQUE fiche du catalogue, l'arbre rendu par `FormationDetailPage`
 *     contient le libellé et le texte, en toutes lettres (écrits ICI, pas
 *     relus dans la constante : sinon la garde approuverait n'importe quoi).
 *  2. Le texte n'est vrai que si aucune formation ne prépare une
 *     certification : aucune fiche ne doit parler de RNCP, de répertoire
 *     spécifique, ni se dire « certifiante ». Si cela change un jour, ce test
 *     rougit AVANT qu'une fiche affiche « non certifiante » à tort.
 *
 * ⚠️ On ne rend pas la page (elle contient des composants serveur
 * asynchrones) : on lit l'arbre d'éléments qu'elle RETOURNE, où les rubriques
 * réglementaires sont écrites en ligne (`indicateurRows.map`).
 */

import { describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactNode } from "react";

// Composants jamais exécutés ici (on lit l'arbre, on ne rend pas) : remplacés
// pour ne pas charger la navigation next-intl, Prisma ni les formulaires.
vi.mock("@/i18n/navigation", () => ({ Link: () => null }));
vi.mock("@/components/reviews/ServiceReviewsSection", () => ({
  ServiceReviewsSection: () => null,
}));
vi.mock("@/components/forms/UnifiedContactForm", () => ({ UnifiedContactForm: () => null }));
vi.mock("@/components/services/RelatedKnowledge", () => ({ RelatedKnowledge: () => null }));

import { FormationDetailPage } from "@/components/formations/FormationDetailPage";
import { FORMATIONS_V2 } from "@/content/formations/catalog-v2";

const RECONNAISSANCE =
  "Attestation de fin de formation (article L.6313-7 du code du travail). Formation non certifiante : elle ne prépare ni à un titre RNCP ni à une certification du répertoire spécifique, et n'ouvre pas de droit à une poursuite d'études.";

/** Toutes les chaînes de l'arbre d'éléments, sans exécuter les composants. */
function textes(noeud: unknown, acc: string[] = []): string[] {
  if (noeud === null || noeud === undefined || typeof noeud === "boolean") return acc;
  if (typeof noeud === "string" || typeof noeud === "number") {
    acc.push(String(noeud));
    return acc;
  }
  if (Array.isArray(noeud)) {
    for (const n of noeud) textes(n, acc);
    return acc;
  }
  if (isValidElement(noeud)) {
    const props = noeud.props as Record<string, unknown>;
    for (const [cle, valeur] of Object.entries(props)) {
      if (cle === "children" || isValidElement(valeur) || typeof valeur === "string") {
        textes(valeur, acc);
      }
    }
  }
  return acc;
}

function arbre(slug: string): string[] {
  const f = FORMATIONS_V2.find((x) => x.slugFr === slug)!;
  const rendu = FormationDetailPage({
    formation: f,
    locale: "fr",
    referentHandicap: { nom: "Camille Exemple", email: "referent@example.com" },
  }) as ReactNode;
  return textes(rendu);
}

describe("indicateur 1 — type de reconnaissance sur chaque fiche", () => {
  it("le catalogue n'est pas vide (sinon la boucle suivante ne vérifierait rien)", () => {
    expect(FORMATIONS_V2.length).toBeGreaterThanOrEqual(20);
  });

  it.each(FORMATIONS_V2.map((f) => [f.slugFr]))(
    "%s : rubrique « Reconnaissance de la formation » et son texte",
    (slug) => {
      const t = arbre(slug);
      expect(t).toContain("Reconnaissance de la formation");
      expect(t).toContain(RECONNAISSANCE);
    },
  );

  it("le texte « non certifiante » reste vrai : aucune fiche ne cite RNCP, RS ni ne se dit certifiante", () => {
    const fautives = FORMATIONS_V2.filter((f) => {
      const brut = JSON.stringify(f);
      return /RNCP|r[ée]pertoire sp[ée]cifique|\bcode RS\b|formation certifiante|certification professionnelle/i.test(
        brut,
      );
    }).map((f) => f.slugFr);
    expect(
      fautives,
      "une fiche parle d'une certification RNCP/RS : la rubrique « Formation non certifiante » serait FAUSSE pour elle",
    ).toEqual([]);
  });
});
