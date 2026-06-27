// SSOT des FAITS partagés du coaching 1-to-1 (WS7).
//
// Le contenu 1-to-1 était décrit en triple : `un-a-un/page.tsx` (hub 2 formules),
// `booking-catalog.ts` (4 formats réservables) et `IndividualCoachingPage.tsx`
// (détail). Les PRIX sont déjà centralisés (`pricing.ts`) et les URLs/labels
// canoniques vivent dans `interventions-taxonomy.ts`. Mais chaque source
// RE-TAPAIT à la main les chemins (`hrefFr`/`hrefEn`) et la durée ISO — donc un
// changement de path dans la taxonomie laissait les liens 1-to-1 silencieusement
// périmés (lien cassé / hreflang divergent).
//
// Ce module ne réinvente rien : il NOMME les entités 1-to-1 et les RELIE à la
// taxonomie (famille / format) + au tier de prix, puis EXPOSE des résolveurs de
// chemins qui lisent la taxonomie. Les sources dérivent leurs hrefs d'ici au lieu
// de les taper. La copie marketing (taglines, features, bénéfices) reste dans
// chaque page (choix produit : variations par contexte).
//
// 100 % statique, importable côté serveur sans coût JS client (budget Web Vitals).

import type { Locale } from "@/i18n/routing";
import {
  type Family,
  INTERVENTION_FORMATS,
  getFamily,
  familyPath,
  formatPath,
} from "@/content/interventions-taxonomy";

/** Durée ISO 8601 canonique d'une journée 1-to-1 sur site (Schema.org). */
export const COACHING_1TO1_ISO_DURATION = "PT7H";

/**
 * Les 2 FORMULES de tête (vue hub `/un-a-un`) — équivalent des « paliers durée »
 * des collectives. Chacune pointe vers sa page FAMILLE de la taxonomie.
 */
export interface Coaching1to1Formule {
  /** Identifiant stable (clé de rendu / tests). */
  id: "dirigeant" | "membre-equipe";
  /** Famille taxonomie cible (source des chemins canoniques). */
  family: Extract<Family, "dirigeants" | "individuel">;
  /** Tier de prix (clé `pricing.ts`). */
  priceTierId: string;
}

export const COACHING_1TO1_FORMULES: ReadonlyArray<Coaching1to1Formule> = [
  { id: "dirigeant", family: "dirigeants", priceTierId: "intervention-dirigeant-vision" },
  { id: "membre-equipe", family: "individuel", priceTierId: "intervention-membre-equipe" },
];

/**
 * Les 4 FORMATS réservables (catalogue de réservation). Chaque format référence
 * le SLUG du format détaillé de la taxonomie dont il partage la page (les
 * variantes 2 jours réutilisent la page du format 1 jour) + son tier de prix.
 */
export interface Coaching1to1Format {
  /** Slug propre au catalogue de réservation. */
  slug: string;
  /** Slug du format taxonomie portant la page détail (source des chemins). */
  taxonomySlug: string;
  /** Tier de prix (clé `pricing.ts`). */
  priceTierId: string;
  durationDays: 1 | 2;
}

export const COACHING_1TO1_FORMATS: ReadonlyArray<Coaching1to1Format> = [
  {
    slug: "dirigeant-vision-strategique",
    taxonomySlug: "dirigeant-vision-strategique",
    priceTierId: "intervention-dirigeant-vision",
    durationDays: 1,
  },
  {
    slug: "dirigeant-vision-strategique-2j",
    taxonomySlug: "dirigeant-vision-strategique",
    priceTierId: "intervention-dirigeant-vision-2j",
    durationDays: 2,
  },
  {
    slug: "coaching-decouverte",
    taxonomySlug: "coaching-decouverte",
    priceTierId: "intervention-membre-equipe",
    durationDays: 1,
  },
  {
    slug: "coaching-optimisation-2j",
    taxonomySlug: "coaching-decouverte",
    priceTierId: "intervention-membre-equipe-2j",
    durationDays: 2,
  },
];

/** Chemin localisé d'une formule hub (via sa famille taxonomie). */
export function coachingFormulePath(id: Coaching1to1Formule["id"], locale: Locale): string {
  const formule = COACHING_1TO1_FORMULES.find((f) => f.id === id);
  if (!formule) throw new Error(`Formule 1-to-1 inconnue : ${id}`);
  return familyPath(getFamily(formule.family), locale);
}

/** Chemin localisé d'un format réservable (via le format taxonomie qu'il partage). */
export function coachingFormatPath(slug: string, locale: Locale): string {
  const fmt = COACHING_1TO1_FORMATS.find((f) => f.slug === slug);
  if (!fmt) throw new Error(`Format 1-to-1 inconnu : ${slug}`);
  const entry = INTERVENTION_FORMATS.find((e) => e.slug === fmt.taxonomySlug);
  if (!entry) throw new Error(`Format taxonomie introuvable : ${fmt.taxonomySlug}`);
  return formatPath(entry, locale);
}
