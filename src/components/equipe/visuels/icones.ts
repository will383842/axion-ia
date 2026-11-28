import {
  Award,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  Circle,
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

/** Clés d'icône des lignes d'identité et des chiffres (déclarée ici par le lot R2a ; reprise en R2c1/R2d). */
export type CleIcone =
  | "personne"
  | "fonction"
  | "entreprise"
  | "resultat"
  | "cible"
  | "services"
  | "zone"
  | "experience"
  | "methode"
  | "donnees"
  | "contact"
  | "langues"
  | "competences"
  | "lieu";

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

/** Icône d'une clé ; clé absente ou inconnue : cercle neutre. */
export function iconeDe(cle?: string): LucideIcon {
  if (cle && Object.prototype.hasOwnProperty.call(ICONES_FICHE, cle)) {
    return ICONES_FICHE[cle as CleIcone];
  }
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
