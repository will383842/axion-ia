// Server Component — les 16 secteurs d'activité de la home.
//
// Refonte Will 2026-08-10 : c'était un nuage de pastilles grises `bg-sand`
// (« extrêmement vieillot ») — 16 étiquettes identiques, aucune hiérarchie,
// aucun repère visuel. Désormais une grille de tuiles : une icône Lucide par
// secteur, un accent couleur rotatif sur les 5 teintes de la charte, et un
// survol qui soulève la tuile. Scannable en un coup d'œil, et chaque secteur
// devient une entité visuelle distincte (bon pour l'AEO comme pour l'œil).
//
// L'ordre et les libellés restent pilotés par `SECTORS` (src/content/home-data.ts)
// — SSOT inchangée. Cette grille ne fait qu'y accrocher une icône et un accent.
//
// Composant serveur pur : les icônes sont rendues en HTML au build, 0 KB de JS
// client (aucune des 16 icônes n'entre dans le bundle).

import {
  Factory,
  ShoppingBag,
  HeartPulse,
  Landmark,
  Users,
  Truck,
  Building2,
  Briefcase,
  GraduationCap,
  Scale,
  HardHat,
  Wheat,
  Car,
  Hotel,
  Newspaper,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { FadeInOnView } from "@/components/motion/FadeInOnView";
import { ACCENT_CLASSES, type ServiceAccent } from "@/content/services-visual";
import { cn } from "@/lib/utils";

/**
 * Icône par secteur — clés = libellés exacts de `SECTORS`.
 *
 * ⚠️ Si un libellé change dans `src/content/home-data.ts`, la clé doit suivre.
 * Le rendu ne casse pas en cas de désynchro (fallback `Briefcase`), mais la
 * tuile perdrait son icône spécifique.
 */
const SECTOR_ICONS: Record<string, LucideIcon> = {
  Industrie: Factory,
  "Retail & e-commerce": ShoppingBag,
  "Santé & pharmacie": HeartPulse,
  "Finance & assurance": Landmark,
  "RH & recrutement": Users,
  "Logistique & transport": Truck,
  Immobilier: Building2,
  "Conseil & services": Briefcase,
  "Éducation & formation": GraduationCap,
  Juridique: Scale,
  "BTP & construction": HardHat,
  Agroalimentaire: Wheat,
  Automobile: Car,
  "Tourisme & hôtellerie": Hotel,
  "Médias & édition": Newspaper,
  Énergie: Zap,
};

/** Rotation d'accents sur les 5 teintes de la charte. */
const ACCENT_CYCLE: readonly ServiceAccent[] = [
  "terracotta",
  "primary",
  "sage",
  "ochre",
  "plum",
] as const;

export function SectorsGrid({ sectors }: { sectors: readonly string[] }) {
  return (
    // Paliers md → lg. (Historique : ces grilles avaient dû éviter `sm:` parce
    // que `--breakpoint-sm` manquait dans le `@theme` et que Tailwind v4 émettait
    // alors les règles `sm:` APRÈS `md:`/`lg:`. Le jeton a été déclaré le
    // 2026-08-10 dans globals.css — l'ordre est rétabli, `sm:` est de nouveau
    // utilisable partout.)
    <ul className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
      {sectors.map((sector, idx) => {
        const Icon = SECTOR_ICONS[sector] ?? Briefcase;
        const accent = ACCENT_CYCLE[idx % ACCENT_CYCLE.length] ?? "terracotta";
        const a = ACCENT_CLASSES[accent];

        return (
          <li key={sector}>
            <FadeInOnView delay={Math.min(idx, 8) * 30}>
              <div
                className={cn(
                  "bg-paper border-border group flex h-full items-center gap-3 rounded-2xl border p-4 transition-all duration-300",
                  "hover:shadow-subtle hover:-translate-y-0.5",
                  a.hoverBorder,
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors duration-300",
                    a.chip,
                    a.chipHover,
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
                </span>
                <span className="text-fg min-w-0 text-sm leading-tight font-semibold tracking-tight">
                  {sector}
                </span>
              </div>
            </FadeInOnView>
          </li>
        );
      })}
    </ul>
  );
}
