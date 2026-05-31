/**
 * AuditAudience — « À qui s'adressent les audits » : une card par taille
 * d'entreprise (Server Component).
 *
 * Refonte 2026-05-31 (Will) — section visuelle en cards cliquables, placée
 * après le bandeau contact. Réutilise la SSOT `AUDIT_BY_SIZE` (labels, badges
 * tier+prix via helpers pricing, chemins tier) ; les descriptions de card sont
 * courtes et SANS prix en prose (le prix vit dans le badge SSOT → price-gate
 * OK). Emphase TPE/PME (feedback Will 2026-05-27).
 *
 * Zéro JS. FR canonique — EN = miroir (locale 301→FR, règle Will 2026-05-16).
 */

import type { ReactNode } from "react";
import { Sparkles, Building, Building2, Network, ArrowRight, type LucideIcon } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { Link } from "@/i18n/navigation";
import { AUDIT_BY_SIZE, type AuditSizeSegment } from "@/content/audit-taxonomy";

const ICONS: Record<string, LucideIcon> = {
  Sparkles,
  Building,
  Building2,
  Network,
};

// Libellés de card (TPE élargie aux artisans/commerçants — demande Will) +
// accroches courtes sans prix (le prix est porté par le badge SSOT).
const CARD_COPY: Record<
  AuditSizeSegment,
  { labelFr: string; labelEn: string; descFr: string; descEn: string }
> = {
  tpe: {
    labelFr: "TPE, artisans & commerçants",
    labelEn: "Small businesses, artisans & retailers",
    descFr:
      "Peu de temps, pas de DSI : on cible 1 ou 2 automatisations qui vous libèrent des heures, vite.",
    descEn: "Little time, no IT team: we target 1 or 2 automations that free up hours, fast.",
  },
  pme: {
    labelFr: "PME",
    labelEn: "SME",
    descFr:
      "Vous grandissez, les process craquent : on priorise les chantiers IA service par service.",
    descEn:
      "You're growing and processes strain: we prioritise AI projects department by department.",
  },
  eti: {
    labelFr: "ETI",
    labelEn: "Mid-cap",
    descFr: "Multi-sites, multi-métiers : audit transverse et gouvernance IA conforme à l'AI Act.",
    descEn: "Multi-site, multi-business: a transverse audit and AI Act-compliant governance.",
  },
  "grande-entreprise": {
    labelFr: "Grande entreprise",
    labelEn: "Enterprise",
    descFr:
      "Échelle groupe, conformité, souveraineté : audit profond et livrables prêts pour le board.",
    descEn: "Group scale, compliance, sovereignty: a deep audit and board-ready deliverables.",
  },
};

export interface AuditAudienceProps {
  readonly isFr: boolean;
}

export function AuditAudience({ isFr }: AuditAudienceProps): ReactNode {
  return (
    <Section
      tone="canvas"
      eyebrow={isFr ? "À qui ça s'adresse" : "Who it's for"}
      title={isFr ? "Un audit pour chaque" : "An audit for every"}
      titleEm={isFr ? "taille d'entreprise" : "company size"}
      titleTail="."
      description={
        isFr
          ? "De l'artisan à la grande entreprise, on calibre l'audit à votre taille, votre budget et vos enjeux. TPE et PME en premier — c'est là que l'IA change le quotidien le plus vite."
          : "From the local artisan to the large group, we calibrate the audit to your size, budget and stakes. Small businesses and SMEs first — that's where AI changes daily work the fastest."
      }
    >
      <ul className="grid list-none gap-5 p-0 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
        {AUDIT_BY_SIZE.map((seg) => {
          const Icon = ICONS[seg.iconName] ?? Sparkles;
          const copy = CARD_COPY[seg.id];
          return (
            <li key={seg.id}>
              <Link
                href={(isFr ? seg.pathFr : seg.pathEn) as never}
                data-cta-tracking="audit_audience_size"
                data-source-segment={seg.id}
                className="group bg-paper border-border shadow-subtle hover:border-terracotta/50 hover:shadow-card focus-visible:ring-terracotta flex h-full flex-col rounded-2xl border p-6 transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                <span className="bg-terracotta-soft text-terracotta-deep mb-4 flex h-12 w-12 items-center justify-center rounded-xl">
                  <Icon aria-hidden="true" className="h-6 w-6" strokeWidth={1.75} />
                </span>
                <h3 className="text-fg text-[16px] leading-snug font-semibold tracking-tight">
                  {isFr ? copy.labelFr : copy.labelEn}
                </h3>
                <p className="text-fg-soft mt-2 flex-1 text-[13.5px] leading-relaxed">
                  {isFr ? copy.descFr : copy.descEn}
                </p>
                <span className="border-terracotta/30 bg-terracotta-soft/40 text-terracotta-deep mt-4 inline-flex w-fit items-center rounded-full border px-3 py-1 text-[12px] font-semibold">
                  {isFr ? seg.badgeFr : seg.badgeEn}
                </span>
                <span className="text-terracotta-deep mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold">
                  {isFr ? "Voir cet audit" : "See this audit"}
                  <ArrowRight
                    aria-hidden="true"
                    className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                  />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
