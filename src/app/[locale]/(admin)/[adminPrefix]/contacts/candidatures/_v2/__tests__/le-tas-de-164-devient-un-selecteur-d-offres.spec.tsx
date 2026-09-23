/**
 * L'ÉCRAN « CANDIDATURES » NE MÉLANGE PLUS DEUX SOURCES, ET PROPOSE UN VRAI
 * SÉLECTEUR D'OFFRE.
 *
 * ── Pourquoi ─────────────────────────────────────────────────────────────
 * Mesuré en production le 2026-09-23 :
 *   · 164 candidatures emploi / 34 offres, TOUTES au statut `new` — contre
 *     12 candidatures commerciales qui ont DÉJÀ leur propre onglet
 *     (`/contacts/commercial`). L'onglet « Apporteurs d'affaires » d'ici
 *     dupliquait EXACTEMENT ces 12 lignes, et la vue « Toutes » mélangeait au
 *     passage deux enums de statut différents.
 *   · « Monteur vidéo » était UNE offre sur 34 promue au rang d'onglet fixe.
 *
 * Ce test protège les DEUX retraits ET l'ajout : aucune des deux anciennes
 * portes ne doit reparaître, et le sélecteur d'offre doit porter le nombre de
 * candidatures de CHAQUE offre — pas seulement celle qui avait un onglet.
 */

import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// 🔑 Les deux SEULS points d'entrée réseau que cet arbre traverse
// (`FormulaireEnMasse` → `actions-en-masse` ; `ComposeurEnMasse` →
// `actions-reponse-en-masse`, qui importe `@/auth`). Les remplacer ÉVITE de
// suivre la chaîne jusqu'à NextAuth/Prisma pour un simple test de rendu —
// mêmes limites que `session.ts` : « pas un module réseau », donc jamais
// appelées ici, seulement RÉFÉRENCÉES par le formulaire.
vi.mock("@/features/admin-job-applications/actions-en-masse", () => ({
  changerStatutEnMasseAction: vi.fn(),
}));
vi.mock("@/features/admin-job-applications/actions-reponse-en-masse", () => ({
  repondreEnMasseAction: vi.fn(),
}));

import { ApplicationsV2 } from "../ApplicationsV2";
import type {
  JobApplicationListItem,
  OffreAvecCandidatures,
} from "@/features/admin-job-applications/reads";

const OFFRES: readonly OffreAvecCandidatures[] = [
  { id: "offre-redacteur", label: "Rédacteur web", count: 12 },
  { id: "offre-monteur", label: "Monteur vidéo", count: 4 },
  { id: "spontanee", label: "Candidature spontanée", count: 6 },
];

function item(id: string, offerId: string, offerTitleSnap: string): JobApplicationListItem {
  return {
    id,
    offerId,
    offerTitleSnap,
    contactName: "Camille Martin",
    contactEmail: "camille@exemple.invalid",
    status: "new",
    hasCv: true,
    needsAttention: false,
    submittedAt: new Date("2026-09-20T10:00:00Z"),
  };
}

const ITEMS: readonly JobApplicationListItem[] = [
  item("a1", "offre-redacteur", "Rédacteur web"),
  item("a2", "offre-monteur", "Monteur vidéo"),
];

function rendre(sp: Record<string, string | undefined> = {}) {
  return renderToStaticMarkup(
    <ApplicationsV2
      adminPrefix="console-abc123"
      searchParams={sp}
      offres={OFFRES}
      items={ITEMS}
      total={2}
      page={1}
      totalPages={1}
    />,
  );
}

describe("ApplicationsV2 — retrait des deux onglets, sélecteur d'offre", () => {
  it("ne montre plus l'onglet « Apporteurs d'affaires » ni un lien ?view=memo", () => {
    const html = rendre();
    expect(html).not.toContain("Apporteurs d'affaires");
    expect(html).not.toContain("view=memo");
  });

  it("ne montre plus l'onglet fixe « Monteur vidéo » (?view=monteur)", () => {
    const html = rendre();
    expect(html).not.toContain("view=monteur");
  });

  it("le sélecteur d'offre porte CHAQUE offre avec son nombre entre parenthèses", () => {
    const html = rendre();
    expect(html).toContain("Rédacteur web (12)");
    expect(html).toContain("Monteur vidéo (4)");
    expect(html).toContain("Candidature spontanée (6)");
    // Contre-témoin : le sélecteur existe bien et porte le total.
    expect(html).toContain('id="offerId"');
    expect(html).toContain("Toutes les offres (22)");
  });

  it("un seul vocabulaire de statut — jamais celui de la table Submission", () => {
    const html = rendre();
    expect(html).not.toContain("Qualification");
    expect(html).not.toContain("Négociation");
    expect(html).not.toContain("Convertie");
  });

  it("sans offre choisie : dit qu'elle est triée par offre", () => {
    const html = rendre();
    expect(html).toContain("Triée par offre");
  });

  it("une offre choisie : la mention de tri disparaît, le titre nomme l'offre", () => {
    const html = rendre({ offerId: "offre-redacteur" });
    expect(html).not.toContain("Triée par offre");
    expect(html).toContain("Candidatures — Rédacteur web");
  });
});
