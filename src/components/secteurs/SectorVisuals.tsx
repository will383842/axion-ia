/**
 * Visuels sectoriels — piliers `/secteurs/[secteur]`.
 *
 * Server Components purs (zéro JS client) → budget Web Vitals 2026 préservé
 * (First Load JS ≤ 75 KB, CLS = 0). Photo héro Unsplash locale (1600×1000,
 * dimensions fixes → pas de décalage) + badge emblème (icône lucide déjà bundle)
 * + crédit photographe obligatoire (CGU Unsplash §9, cf. `sector-photos.ts`).
 *
 * `SECTOR_ICON` est clé sur `ClientSectorSlug` (SSOT `content/sectors.ts`),
 * `SERVICE_ICON` sur `ServiceDef.slug` (SSOT `content/knowledge/services.ts`).
 */

import Image from "next/image";
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
import type { SectorPhotoCredit } from "@/content/secteurs/sector-photos";

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

export interface SectorHeroMediaProps {
  readonly slug: ClientSectorSlug;
  readonly src: string;
  readonly alt: string;
  readonly width: number;
  readonly height: number;
  readonly credit: SectorPhotoCredit;
}

/**
 * Média du héro (slot `media` de `Section`) : photo sectorielle Unsplash locale
 * + badge emblème (coin haut-gauche) + crédit photographe (CGU §9). Image en
 * `priority` (candidate LCP du héro), ratio fixe 16/10 → CLS 0.
 */
export function SectorHeroMedia({ slug, src, alt, width, height, credit }: SectorHeroMediaProps) {
  const Icon = SECTOR_ICON[slug];
  return (
    <figure className="m-0">
      <div className="ring-border-strong/30 shadow-card relative overflow-hidden rounded-3xl ring-1">
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          priority
          sizes="(max-width: 1024px) 100vw, 48vw"
          className="aspect-[16/10] h-auto w-full object-cover"
        />
        <span className="bg-bg/85 ring-border-strong/30 absolute top-4 left-4 flex h-12 w-12 items-center justify-center rounded-xl ring-1 backdrop-blur">
          {Icon ? (
            <Icon className="text-terracotta h-6 w-6" strokeWidth={1.5} aria-hidden="true" />
          ) : null}
        </span>
      </div>
      <figcaption className="text-fg-muted mt-2 text-[11px]">
        Photo :{" "}
        <a
          href={credit.photographerUrl}
          target="_blank"
          rel="nofollow noopener"
          className="hover:text-fg underline-offset-2 hover:underline"
        >
          {credit.photographer}
        </a>{" "}
        /{" "}
        <a
          href={credit.photoUrl}
          target="_blank"
          rel="nofollow noopener"
          className="hover:text-fg underline-offset-2 hover:underline"
        >
          Unsplash
        </a>
      </figcaption>
    </figure>
  );
}
