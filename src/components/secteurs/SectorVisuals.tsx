/**
 * Visuels sectoriels — piliers `/secteurs/[secteur]`.
 *
 * Server Components purs (zéro JS client) → budget Web Vitals 2026 préservé
 * (First Load JS ≤ 75 KB, CLS = 0). Emblèmes = icônes `lucide-react` déjà dans
 * le bundle (SVG stroke, `currentColor`, theme-aware). Aucun fichier image, donc
 * aucun requête réseau ni décalage de layout.
 *
 * ⚠️ `SECTOR_ICON` est clé sur `ClientSectorSlug` (SSOT `content/sectors.ts`),
 * `SERVICE_ICON` sur `ServiceDef.slug` (SSOT `content/knowledge/services.ts`).
 * Quand les 10 photos métier `/illustrations/secteurs/{slug}.avif` existeront,
 * le panneau emblème du héro pourra être remplacé par un `<Image>` sans toucher
 * au reste de la page (le slot `media` de `Section` reste identique).
 */

import type { LucideIcon } from "lucide-react";
import {
  Calculator,
  HardHat,
  UtensilsCrossed,
  Stethoscope,
  Scale,
  ShoppingBag,
  Factory,
  Wrench,
  Users,
  Landmark,
  Target,
  Sparkles,
  GraduationCap,
  MessageSquare,
  Globe,
} from "lucide-react";

import type { ClientSectorSlug } from "@/content/sectors";

/** Emblème par secteur client (= `ClientSectorSlug`). */
export const SECTOR_ICON: Record<ClientSectorSlug, LucideIcon> = {
  comptabilite_finance: Calculator,
  btp_immobilier: HardHat,
  restauration_hotellerie: UtensilsCrossed,
  sante_medecine: Stethoscope,
  juridique: Scale,
  commerce_retail: ShoppingBag,
  industrie_logistique: Factory,
  artisanat_services: Wrench,
  rh_recrutement: Users,
  collectivites_public: Landmark,
};

/** Icône par service Axion-IA (= `ServiceDef.slug`). */
export const SERVICE_ICON: Record<string, LucideIcon> = {
  audit: Target,
  implementation: Sparkles,
  "interventions-formations": GraduationCap,
  "un-a-un": MessageSquare,
  "sites-web-augmentes": Globe,
};

export interface SectorHeroPanelProps {
  readonly slug: ClientSectorSlug;
  readonly label: string;
  /** Mots du lexique métier affichés en chips (décoratif, `aria-hidden`). */
  readonly chips: readonly string[];
}

/**
 * Panneau emblème rendu à droite du h1 (slot `media` de `Section`). Carte teintée
 * `sand` + anneaux décoratifs + grand emblème sectoriel + chips lexique métier.
 * Distinct par secteur, crawlable-agnostique, zéro décalage (dimensions fixes).
 */
export function SectorHeroPanel({ slug, label, chips }: SectorHeroPanelProps) {
  const Icon = SECTOR_ICON[slug];
  return (
    <div className="bg-sand ring-border-strong/40 relative overflow-hidden rounded-3xl p-8 shadow-card ring-1 sm:p-10">
      <svg
        aria-hidden="true"
        viewBox="0 0 400 400"
        className="pointer-events-none absolute -top-16 -right-16 h-64 w-64 opacity-50"
      >
        <circle cx="200" cy="200" r="150" fill="none" stroke="var(--color-terracotta)" strokeOpacity="0.16" />
        <circle
          cx="200"
          cy="200"
          r="105"
          fill="none"
          stroke="var(--color-terracotta)"
          strokeOpacity="0.12"
          strokeDasharray="3 7"
        />
      </svg>
      <div className="relative flex flex-col items-center gap-6 text-center">
        <span className="bg-bg/80 ring-border-strong/30 flex h-24 w-24 items-center justify-center rounded-2xl ring-1">
          {Icon ? (
            <Icon className="text-terracotta h-12 w-12" strokeWidth={1.4} aria-hidden="true" />
          ) : null}
        </span>
        <p className="text-fg text-lg font-semibold" style={{ fontFamily: "var(--font-serif)" }}>
          {label}
        </p>
        {chips.length > 0 ? (
          <ul className="flex flex-wrap justify-center gap-2" aria-hidden="true">
            {chips.map((c) => (
              <li
                key={c}
                className="bg-bg/70 text-fg-soft ring-border rounded-full px-3 py-1 text-xs font-medium ring-1"
              >
                {c}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
