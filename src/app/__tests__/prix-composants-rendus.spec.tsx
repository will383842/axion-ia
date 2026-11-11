// R7 — ordre de Williams du 08/11/2026 : aucun montant en € au public, sauf la Journée IA
// (1 490 € HT). Complément RENDU de `prix-pages-publiques.spec.ts` : la garde statique lit
// le source, elle ne voit pas un montant qui voyage en props (un `priceFlatEur` de fiche,
// un nombre de la matrice formations passé à une carte). Ici on rend les composants clés
// en HTML statique et on cherche un montant dans le texte produit.
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { FORMATIONS_V2 } from "@/content/formations/catalog-v2";
import { INTERVENTION_DETAIL_CONFIGS } from "@/content/intervention-detail-configs";
import type { AuditTier } from "@/content/audit-taxonomy";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: unknown; children?: ReactNode }) => (
    <a href={typeof href === "string" ? href : "/"}>{children}</a>
  ),
}));
vi.mock("@/components/forms/UnifiedContactForm", () => ({ UnifiedContactForm: () => null }));
vi.mock("@/components/reviews/ServiceReviewsSection", () => ({
  ServiceReviewsSection: () => null,
}));
vi.mock("@/components/services/RelatedKnowledge", () => ({ RelatedKnowledge: () => null }));
vi.mock("@/components/services/audit/ClientLogosMarqueeBand", () => ({
  ClientLogosMarqueeBand: () => null,
}));
vi.mock("@/components/sections/ContactBand", () => ({ ContactBand: () => null }));
vi.mock("@/components/motion/FadeInOnView", () => ({
  FadeInOnView: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));
// Composant serveur ASYNCHRONE (rendu statique synchrone impossible) : hors sujet ici.
vi.mock("@/components/nav/Breadcrumbs", () => ({ Breadcrumbs: () => null }));

/** Un montant en euros : « 1 900 € », « 790 € HT », « 2 k€ », « €490 ». */
const MONTANT_EUR = /\d[\d\s  .,]*\s?k?€|€\s?\d/g;
const JOURNEE_IA = /1[\s  ]?490[\s  ]?€/g;

function texte(node: ReactNode): string {
  return renderToStaticMarkup(<>{node}</>)
    .replace(/<script[\s\S]*?<\/script>/g, " ") // JSON-LD : lot JSON-LD, hors de cette garde
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");
}

function montants(t: string): string[] {
  return t.replace(JOURNEE_IA, "").match(MONTANT_EUR) ?? [];
}

describe("R7 — composants publics rendus : aucun montant hors Journée IA", () => {
  it("PricingGridVille (grille des 5 services des pages villes)", async () => {
    const { PricingGridVille } = await import("@/components/sections/PricingGridVille");
    const t = texte(<PricingGridVille isFr villeNameFr="Lyon" loc="fr" />);
    expect(t).toContain("Sur devis");
    expect(montants(t)).toEqual([]);
  });

  it.each(["audit-cible", "audit-strategique-pme", "audit-strategique-eti"])(
    "AuditDetailPage %s",
    async (tier) => {
      const { AuditDetailPage } = await import("@/components/sections/AuditDetailPage");
      const t = texte(AuditDetailPage({ tier: tier as AuditTier, locale: "fr" }));
      expect(t).toContain("Sur devis");
      expect(montants(t)).toEqual([]);
    },
  );

  it("FormationFormatCard : chaque formation du catalogue", async () => {
    const { FormationFormatCard } = await import("@/components/formations/FormationFormatCard");
    const fautes: string[] = [];
    for (const f of FORMATIONS_V2) {
      const t = texte(<FormationFormatCard formation={f} locale="fr" />);
      for (const m of montants(t)) fautes.push(`${f.id}: ${m}`);
    }
    expect(fautes).toEqual([]);
  });

  it("FormationDetailPage : une fiche par catégorie", async () => {
    const { FormationDetailPage } = await import("@/components/formations/FormationDetailPage");
    const parCategorie = new Map(FORMATIONS_V2.map((f) => [f.categorie ?? "seminaire", f]));
    const fautes: string[] = [];
    for (const f of parCategorie.values()) {
      const t = texte(
        FormationDetailPage({
          formation: f,
          locale: "fr",
          referentHandicap: { nom: "", email: "handicap@example.invalid" },
          resultats: null,
        }),
      );
      for (const m of montants(t)) fautes.push(`${f.id}: ${m}`);
    }
    expect(fautes).toEqual([]);
  });

  it("InterventionDetailPage : chaque fiche 1-to-1 / intervention", async () => {
    const { InterventionDetailPage } = await import("@/components/sections/InterventionDetailPage");
    const fautes: string[] = [];
    for (const slug of Object.keys(INTERVENTION_DETAIL_CONFIGS)) {
      const t = texte(
        InterventionDetailPage({
          slug: slug as keyof typeof INTERVENTION_DETAIL_CONFIGS,
          locale: "fr",
        }),
      );
      for (const m of montants(t)) fautes.push(`${slug}: ${m}`);
    }
    expect(fautes).toEqual([]);
  });
});
