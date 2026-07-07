// SSOT VISUELLE des 5 services Axion-IA — icône + accent couleur.
//
// Pendant de `src/content/services.ts` (qui est la SSOT TEXTE : noms + hrefs).
// Ici vit tout ce qui est VISUEL et doit rester identique sur les centaines de
// pages qui affichent les 5 activités : une icône Lucide UNIQUE par service et
// SA couleur d'accent. Avant ce fichier, chaque page redéclarait ses propres
// icônes (3 jeux divergents : Cog vs Cpu vs ⚙️, Globe vs Code2 vs 🌐…) et ses
// propres couleurs. Une source unique = fin de la dérive.
//
// ⚠️ Fichier SÉPARÉ de services.ts À DESSEIN : il importe `lucide-react`. Les
// consommateurs TEXTE-ONLY (JSON-LD, llms.txt, sitemap, KB) importent
// `services.ts` et ne doivent PAS embarquer d'icônes dans leur bundle.
//
// Les classes Tailwind ci-dessous sont des littéraux COMPLETS à dessein : le
// JIT Tailwind v4 scanne le code source pour des chaînes de classes littérales.
// Une classe construite dynamiquement (`bg-${accent}-soft`) ne serait PAS
// générée. Ne jamais interpoler — toujours des chaînes entières.

import { GraduationCap, UserRound, Search, Cog, Globe, type LucideIcon } from "lucide-react";

import type { ServiceId } from "@/content/services";

/** Les 5 accents de la palette services (cf. tokens globals.css). */
export type ServiceAccent = "terracotta" | "ochre" | "primary" | "sage" | "plum";

export interface ServiceVisual {
  /** Icône Lucide unique du service — MÊME icône partout (accepte className, strokeWidth…). */
  Icon: LucideIcon;
  /** Accent couleur du service — donne le « pep par activité ». */
  accent: ServiceAccent;
}

/** Accès O(1) par id de service. Ordre canonique = celui de `SERVICES`. */
export const SERVICE_VISUAL: Record<ServiceId, ServiceVisual> = {
  formations: { Icon: GraduationCap, accent: "terracotta" },
  unAUn: { Icon: UserRound, accent: "ochre" },
  audit: { Icon: Search, accent: "primary" },
  implementation: { Icon: Cog, accent: "sage" },
  sitesWeb: { Icon: Globe, accent: "plum" },
};

/** Jeu de classes Tailwind (littéraux) porté par un accent. */
export interface AccentClasses {
  /** Puce d'icône au repos : fond soft + texte deep. */
  chip: string;
  /** Puce d'icône au survol de la carte : fond plein + texte ivoire. */
  chipHover: string;
  /** Liseré d'accent supérieur (barre pleine). */
  stripe: string;
  /** Bordure de carte au survol. */
  hoverBorder: string;
  /** Anneau focus-visible (a11y clavier). */
  ring: string;
  /** Texte d'accent (titre de puce / CTA « Découvrir »). */
  text: string;
  /** Teinte d'accent appliquée au survol (flèche/CTA) — littéral pour le JIT. */
  textHover: string;
  /** Fond teinté de la carte entière (variante showcase — « fond de couleur »). */
  surface: string;
  /** Puce d'icône PLEINE (fond accent + icône ivoire) — sur carte teintée. */
  chipSolid: string;
}

/** Classes littérales par accent — WCAG AA vérifié (deep sur paper ≥ 4.5:1). */
export const ACCENT_CLASSES: Record<ServiceAccent, AccentClasses> = {
  terracotta: {
    chip: "bg-terracotta-soft text-terracotta-deep",
    chipHover: "group-hover:bg-terracotta group-hover:text-paper",
    stripe: "bg-terracotta",
    hoverBorder: "hover:border-terracotta",
    ring: "focus-visible:ring-terracotta",
    text: "text-terracotta",
    textHover: "group-hover:text-terracotta",
    surface: "bg-terracotta-soft",
    chipSolid: "bg-terracotta text-paper",
  },
  ochre: {
    chip: "bg-ochre-soft text-ochre-deep",
    chipHover: "group-hover:bg-ochre group-hover:text-paper",
    stripe: "bg-ochre",
    hoverBorder: "hover:border-ochre",
    ring: "focus-visible:ring-ochre",
    text: "text-ochre-deep",
    textHover: "group-hover:text-ochre-deep",
    surface: "bg-ochre-soft",
    chipSolid: "bg-ochre text-paper",
  },
  primary: {
    chip: "bg-primary-soft text-primary",
    chipHover: "group-hover:bg-primary group-hover:text-paper",
    stripe: "bg-primary",
    hoverBorder: "hover:border-primary",
    ring: "focus-visible:ring-primary",
    text: "text-primary",
    textHover: "group-hover:text-primary",
    surface: "bg-primary-soft",
    chipSolid: "bg-primary text-paper",
  },
  sage: {
    chip: "bg-sage-soft text-sage",
    chipHover: "group-hover:bg-sage group-hover:text-paper",
    stripe: "bg-sage",
    hoverBorder: "hover:border-sage",
    ring: "focus-visible:ring-sage",
    text: "text-sage",
    textHover: "group-hover:text-sage",
    surface: "bg-sage-soft",
    chipSolid: "bg-sage text-paper",
  },
  plum: {
    chip: "bg-plum-soft text-plum-deep",
    chipHover: "group-hover:bg-plum group-hover:text-paper",
    stripe: "bg-plum",
    hoverBorder: "hover:border-plum",
    ring: "focus-visible:ring-plum",
    text: "text-plum-deep",
    textHover: "group-hover:text-plum-deep",
    surface: "bg-plum-soft",
    chipSolid: "bg-plum text-paper",
  },
};

/** Helper : accent + icône d'un service en un appel. */
export function serviceVisual(id: ServiceId): ServiceVisual {
  return SERVICE_VISUAL[id];
}
