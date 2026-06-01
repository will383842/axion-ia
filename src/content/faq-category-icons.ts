// FAQ — icône par catégorie (présentation, séparée de la SSOT data
// `faq-categories.ts` qui reste pure). Usage SERVER uniquement (pages
// `/faq/par-thematique` + template `[slug]`) : ne pas importer depuis un
// composant client, sous peine d'embarquer 8 icônes lucide dans le bundle
// client (budget Web Vitals — l'explorateur client garde son motif dot).
//
// Exposé sous forme de RECORD + fallback (et non d'un getter renvoyant un
// composant) : la règle `react-hooks/static-components` interdit d'appeler une
// fonction qui retourne un composant pendant le render. L'accès par propriété
// (`FAQ_CATEGORY_ICONS[slug]`) est le pattern accepté (cf. `FaqHeroSchema`).

import {
  Compass,
  GraduationCap,
  Cpu,
  ClipboardCheck,
  Receipt,
  Route,
  Globe,
  UserRound,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";

export const FAQ_CATEGORY_ICONS: Record<string, LucideIcon> = {
  general: Compass,
  interventions: GraduationCap,
  implementation: Cpu,
  audit: ClipboardCheck,
  pricing: Receipt,
  process: Route,
  "sites-web": Globe,
  "un-a-un": UserRound,
};

/** Icône neutre pour les slugs inconnus (legacy/KB). */
export const FAQ_CATEGORY_ICON_FALLBACK: LucideIcon = HelpCircle;
