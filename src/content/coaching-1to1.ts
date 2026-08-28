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
// 2026-08-15 — le module porte aussi désormais les FAITS DE VALEUR : ce qui est
// remis au client, le déroulé réel et le suivi. Même raison que pour les chemins :
// ces éléments (45 min d'échange préalable, journée de 7 à 8 h, livrable écrit
// sous 7 jours, point à 30 jours) étaient RETAPÉS dans `un-a-un/page.tsx`,
// `IndividualCoachingPage.tsx`, `un-a-un-subpages.ts` et `booking-catalog.ts` —
// un délai modifié à un endroit laissait les autres périmés, sur des éléments
// qui engagent contractuellement. Ce sont des faits, pas de la copie : les
// pages peuvent les rendre avec leur propre habillage.
//
// ⚠️ Le 1-to-1 est une prestation de CONSEIL. Décision Will 2026-07-17 (conseil,
// non finançable) et sortie du périmètre AFEST le 2026-08-10. Ne JAMAIS décrire
// ces journées avec le vocabulaire d'une action de formation (objectifs
// pédagogiques, acquis, évaluation, prérequis, certification, financement OPCO
// ou France Travail) : `/un-a-un` déclare un `Service` et pas un `Course`
// précisément parce que les kits contractuels écrivent « ce n'est pas une action
// de formation ». Et aucune garantie de résultat : on décrit ce qui est REMIS,
// jamais ce qui sera obtenu (CGV = obligation de moyens).
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
  /** Ce qui est REMIS par écrit après la journée. Engage : figure au devis. */
  deliverable: string;
  /** Ce que la personne emporte de la journée elle-même (travail effectué, pas
   *  résultat promis). */
  takeaways: ReadonlyArray<string>;
  /** Suivi prévu après la remise du livrable, quand il y en a un. */
  followUp?: string;
}

export const COACHING_1TO1_FORMULES: ReadonlyArray<Coaching1to1Formule> = [
  {
    id: "dirigeant",
    family: "dirigeants",
    priceTierId: "intervention-dirigeant-vision",
    deliverable:
      "Note de cadrage stratégique remise sous 7 jours : le panorama IA de votre secteur, sourcé, et vos 5 à 10 leviers hiérarchisés par impact et par urgence.",
    takeaways: [
      "Le panorama IA de votre secteur, préparé en amont et discuté avec vous",
      "5 à 10 leviers hiérarchisés par impact et par urgence",
      "Des scénarios à 3 ans pour décider quoi lancer, et dans quel ordre",
      "Une revue de votre propre semaine : ce qui peut passer à l'IA, ce qui ne peut pas",
    ],
  },
  {
    id: "membre-equipe",
    family: "individuel",
    priceTierId: "intervention-membre-equipe",
    deliverable:
      "Cahier de prompts personnel et plan d'action remis sous 7 jours, construits sur les dossiers réellement travaillés pendant la journée.",
    takeaways: [
      "3 à 5 méthodes pratiquées sur vos vrais dossiers, utilisables dès le lendemain",
      "La cartographie de vos tâches répétitives, reprises une à une",
      "Vos prompts, testés sur vos cas et rangés pour être réutilisés",
    ],
    followUp: "Point de suivi à 30 jours : ce qui a été mis en place, ce qui coince encore.",
  },
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
  /** Ce que la SECONDE journée ajoute — formats 2 j uniquement. Sur un format
   *  1 j, le contenu de la journée est celui de la formule (cf. `takeaways`). */
  secondDayScope?: string;
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
    secondDayScope:
      "Cartographie complète de votre organisation, mises en situation sur vos propres dossiers et feuille de route d'optimisation (temps et coûts).",
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
    secondDayScope:
      "Cartographie détaillée du poste, irritants relevés un à un et plan d'automatisation personnalisé.",
  },
];

/**
 * DÉROULÉ réel d'une journée 1-to-1 — mêmes faits que la page publique
 * `/un-a-un`, le kit contractuel et le devis. À faire dériver d'ici plutôt que
 * de le retaper : ce sont des engagements (délais, durées), pas de l'accroche.
 */
export interface Coaching1to1Etape {
  /** Identifiant stable (clé de rendu). */
  id: string;
  title: string;
  detail: string;
}

export const COACHING_1TO1_DEROULE: ReadonlyArray<Coaching1to1Etape> = [
  {
    id: "preparation",
    title: "Préparation en amont",
    detail:
      "Étude de votre poste, de vos outils et de vos tâches récurrentes avant la date retenue. La journée arrive déjà calibrée sur votre métier.",
  },
  {
    id: "echange-prealable",
    title: "Échange préalable de 45 minutes",
    detail:
      "Un point court pour caler ce qu'on vise et les dossiers réels sur lesquels on travaillera le jour J.",
  },
  {
    id: "journee",
    title: "Journée en tête-à-tête, 7 à 8 h",
    detail:
      "Une personne, un expert Axion-IA, sur site, à distance ou en hybride selon votre préférence. On travaille sur vos vrais dossiers ; rien n'est conservé.",
  },
  {
    id: "livrable",
    title: "Livrable écrit sous 7 jours",
    detail:
      "Note de cadrage stratégique pour un dirigeant, cahier de prompts et plan d'action pour un collaborateur. Écrit, nominatif, réutilisable sans nous.",
  },
  {
    id: "suivi",
    title: "Point de suivi à 30 jours",
    detail:
      "Prévu pour le coaching collaborateur : on regarde ce qui a été mis en place et ce qui coince encore.",
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
