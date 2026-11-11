// L'offre d'Axion-IA, en source unique : La Journée IA et le rendez-vous gratuit qui y mène.
//
// Ce fichier rassemble les FAITS de l'offre (prix, déroulé, cible, durée du rendez-vous,
// mention de l'article 4, garantie) pour que les textes publics, les prompts de génération,
// le chatbot et les e-mails les IMPORTENT au lieu de les recopier. Le test
// `src/content/__tests__/offre-source-unique.spec.ts` rougit si un texte diverge.
//
// 🔑 Rien n'est réinventé ici :
//   · le prix est LU dans `pricing.ts` (`JOURNEE_IA_TIER`) — aucun montant écrit, ce fichier
//     est balayé par `no-hardcoded-prices.spec.ts` ;
//   · la garantie et sa condition sont celles de `journee-ia-commun.ts`, mot pour mot. Elles
//     restent un BROUILLON tant que les CGV ne sont pas signées (PR #1861) : ne rien affirmer
//     de neuf à partir de ce fichier.
//
// ⚠️ `journee-ia-commun.ts` ne doit jamais importer ce fichier (sens unique, pas de cycle).

import { CONDITION_GARANTIE, GARANTIE_PHRASE, RAPPORT_COMPLET } from "@/content/journee-ia-commun";
import { JOURNEE_IA_TIER, formatTierPrice } from "@/content/pricing";

/** Le rendez-vous gratuit, UNIQUE, qui ouvre toute relation (décision de Williams, 08/11/2026). */
export interface RendezVousGratuit {
  readonly nom: "Diagnostic IA gratuit";
  readonly dureeMinutes: 45;
  readonly gratuit: true;
  readonly sansEngagement: true;
  readonly formats: readonly ["visio", "téléphone"];
}

/** La cible : les PME et TPE, bornes d'effectif incluses. */
export interface CibleOffre {
  readonly libelle: "PME et TPE";
  readonly effectifMin: 5;
  readonly effectifMax: 249;
}

/** Le déroulé de la journée, dans les locaux de l'entreprise. */
export interface DerouleJournee {
  readonly lieu: "dans les locaux de l’entreprise, partout en France";
  readonly matin: "audit";
  readonly apresMidi: "formation";
  readonly heuresFormationApresMidi: 4;
  readonly rapportJoursOuvres: 3;
  readonly planActionJours: 90;
}

export interface OffreJourneeIa {
  readonly nom: "La Journée IA";
  /** Le montant HT, LU dans `pricing.ts` : seul prix affiché au public. */
  readonly prixHtEur: number;
  readonly deroule: DerouleJournee;
  readonly cible: CibleOffre;
  readonly rendezVous: RendezVousGratuit;
  /**
   * Mention PRUDENTE de l'article 4 du règlement européen sur l'IA. Le texte dit que les
   * entreprises « prennent des mesures pour favoriser » la maîtrise de l'IA : jamais
   * « obligation de former ».
   */
  readonly mentionArticle4: string;
  /** La garantie, mot pour mot depuis `journee-ia-commun.ts` (brouillon, cf. en-tête). */
  readonly garantie: {
    readonly phrase: string;
    readonly condition: string;
    readonly brouillon: true;
  };
  readonly rapport: string;
}

export const OFFRE_JOURNEE_IA: OffreJourneeIa = {
  nom: "La Journée IA",
  prixHtEur: JOURNEE_IA_TIER.priceFlat ?? Number.NaN,
  deroule: {
    lieu: "dans les locaux de l’entreprise, partout en France",
    matin: "audit",
    apresMidi: "formation",
    heuresFormationApresMidi: 4,
    rapportJoursOuvres: 3,
    planActionJours: 90,
  },
  cible: { libelle: "PME et TPE", effectifMin: 5, effectifMax: 249 },
  rendezVous: {
    nom: "Diagnostic IA gratuit",
    dureeMinutes: 45,
    gratuit: true,
    sansEngagement: true,
    formats: ["visio", "téléphone"],
  },
  mentionArticle4:
    "L’article 4 du règlement européen sur l’IA prévoit que les entreprises qui utilisent des systèmes d’IA prennent des mesures pour favoriser la maîtrise de l’IA de leur personnel.",
  garantie: { phrase: GARANTIE_PHRASE, condition: CONDITION_GARANTIE, brouillon: true },
  rapport: RAPPORT_COMPLET,
} as const;

/** « 1 490 € HT » (ou « 1 490 € excl. VAT ») — formaté par `pricing.ts`, jamais écrit à la main. */
export function prixJourneeIa(locale: "fr" | "en" = "fr"): string {
  return formatTierPrice(JOURNEE_IA_TIER, locale);
}

/** « 45 minutes » */
export const DUREE_RDV = `${OFFRE_JOURNEE_IA.rendezVous.dureeMinutes} minutes`;

/** « 45 min » */
export const DUREE_RDV_COURTE = `${OFFRE_JOURNEE_IA.rendezVous.dureeMinutes} min`;

/** « de 5 à 249 salariés » */
export const EFFECTIF_CIBLE = `de ${OFFRE_JOURNEE_IA.cible.effectifMin} à ${OFFRE_JOURNEE_IA.cible.effectifMax} salariés`;

/** « Diagnostic IA gratuit · 45 minutes · en visio ou par téléphone · sans engagement » */
export const MICRO_TEXTE_RDV = `${OFFRE_JOURNEE_IA.rendezVous.nom} · ${DUREE_RDV} · en visio ou par téléphone · sans engagement`;
