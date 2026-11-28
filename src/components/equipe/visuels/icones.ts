import {
  Award,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  Circle,
  Factory,
  Handshake,
  HardHat,
  HeartHandshake,
  House,
  Scale,
  Stethoscope,
  Store,
  Truck,
  UtensilsCrossed,
  Languages,
  Layers,
  ListChecks,
  MapPin,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { CleIcone } from "@/lib/equipe/contenu";

export type { CleIcone };

export const ICONES_FICHE: Record<CleIcone, LucideIcon> = {
  personne: UserRound,
  fonction: BriefcaseBusiness,
  entreprise: Building2,
  resultat: TrendingUp,
  cible: Users,
  services: Layers,
  zone: MapPin,
  experience: Award,
  methode: ListChecks,
  donnees: ShieldCheck,
  contact: CalendarClock,
  langues: Languages,
  competences: Sparkles,
  lieu: MapPin,
};

/**
 * Noms lucide (`pourQui.secteurs[].icone`, `HardHat`…) et clés de métier des cartes « Vous êtes »
 * (`btp`, `commerce`…) : la MÊME table sert aux deux, `iconeDe` les résout avec les `CleIcone`.
 */
export const ICONES_NOMMEES: Readonly<Record<string, LucideIcon>> = {
  HardHat,
  Store,
  Factory,
  Truck,
  Stethoscope,
  Scale,
  House,
  UtensilsCrossed,
  Handshake,
  HeartHandshake,
  UserRound,
  Users,
  Building2,
  BriefcaseBusiness,
  btp: HardHat,
  commerce: Store,
  industrie: Factory,
  transport: Truck,
  cabinet: Scale,
  immobilier: House,
  restauration: UtensilsCrossed,
  services: Handshake,
};

const possede = (table: object, cle: string): boolean =>
  Object.prototype.hasOwnProperty.call(table, cle);

/** Icône d'une clé (`CleIcone`), d'un nom lucide ou d'une clé de métier ; inconnue : cercle neutre. */
export function iconeDe(cle?: string): LucideIcon {
  if (cle && possede(ICONES_FICHE, cle)) return ICONES_FICHE[cle as CleIcone];
  if (cle && possede(ICONES_NOMMEES, cle)) return ICONES_NOMMEES[cle] ?? Circle;
  return Circle;
}

/** Fond clair de la pastille d'icône, par jeton de catégorie (table fixe, appliquée en `style`). */
export const FOND_ICONE: Readonly<Record<string, string>> = {
  terracotta: "terracotta-soft",
  ochre: "ochre-soft",
  sage: "sage-soft",
  plum: "plum-soft",
  mocha: "sand",
};
