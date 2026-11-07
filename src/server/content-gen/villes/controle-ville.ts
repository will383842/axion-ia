/**
 * Pages ville : contrôle de doctrine et décision d'approbation automatique.
 *
 * Audit blog/RAG du 24/10/2026, option B de Will : on GARDE toutes les pages
 * ville. Deux trous sont comblés ici, sans rien retirer :
 *  1. les textes de ville produits par les générateurs n'étaient jamais passés
 *     au contrôle de doctrine (Qualiopi, CPF, faux partenariats, Grenoble…) ;
 *  2. une ville dont les données économiques viennent de la mémoire du modèle
 *     (source « claude-knowledge:wikipedia-pretraining ») était approuvée sur un
 *     simple score de qualité. Elle part désormais en relecture humaine.
 *
 * Module PUR (aucun accès base, aucun réseau) : il réutilise le module des
 * interdits `@/lib/contenu/interdits-publication` et ne recrée aucun motif.
 * Il ne publie ni ne supprime rien : il rend un verdict, l'appelant décide.
 */

import {
  detecterInterditsSurface,
  raisonInterdit,
  type InterditSurface,
  type OptionsInterdits,
} from "@/lib/contenu/interdits-publication";
import type { VilleEconomicData } from "@/content/villes/economic-data/types";

/**
 * Source portée par les données économiques tirées de la mémoire du modèle
 * (générateur `landing-ville-economic-data`). Les ~40 villes à données écrites à
 * la main (`src/content/villes/economic-data/*.ts`) citent, elles, une source
 * vérifiable (INSEE, INAO, sites officiels).
 */
export const SOURCE_DONNEES_MEMOIRE_MODELE = "claude-knowledge:wikipedia-pretraining" as const;

/** Préfixe de `reviewedBy` posé par le générateur de données économiques. */
export const REVIEWED_BY_GENERATEUR_LLM = "llm-generator:landing-ville-economic-data";

/**
 * Options strictes par défaut : OPCO et France Travail restent interdits (contrat
 * légal de `server/qualiopi/config/financing.ts`). Trop strict = relecture
 * humaine en plus, jamais une publication de trop.
 */
export const OPTIONS_INTERDITS_VILLE: OptionsInterdits = {
  actualite: false,
  financementPublicAutorise: false,
};

/** Forme minimale de la copie hub d'une ville (sous-ensemble de `VilleHubCopyOutput`). */
export interface CopieVillePourControle {
  readonly pitchFr: string;
  readonly directAnswerFr: string;
  readonly ecosystemFr: string;
  readonly distancesFr: string;
  readonly topSectorsNaf: ReadonlyArray<string>;
  readonly servicesContext: {
    readonly audit: { readonly fr: string };
    readonly interventions: { readonly fr: string };
    readonly implementation: { readonly fr: string };
    readonly unAUn: { readonly fr: string };
  };
  readonly faqGeolocalisee: ReadonlyArray<{ readonly q: string; readonly a: string }>;
}

/** Aplatit la copie hub en champs nommés, pour contrôler chaque texte publié. */
export function champsCopieVille(copie: CopieVillePourControle): Record<string, string> {
  const champs: Record<string, string> = {
    pitchFr: copie.pitchFr,
    directAnswerFr: copie.directAnswerFr,
    ecosystemFr: copie.ecosystemFr,
    distancesFr: copie.distancesFr,
    "servicesContext.audit": copie.servicesContext.audit.fr,
    "servicesContext.interventions": copie.servicesContext.interventions.fr,
    "servicesContext.implementation": copie.servicesContext.implementation.fr,
    "servicesContext.unAUn": copie.servicesContext.unAUn.fr,
  };
  copie.topSectorsNaf.forEach((s, i) => {
    champs[`topSectorsNaf[${i}]`] = s;
  });
  copie.faqGeolocalisee.forEach((f, i) => {
    champs[`faq[${i}].q`] = f.q;
    champs[`faq[${i}].a`] = f.a;
  });
  return champs;
}

/** Champs nommés `prefixe[0]`, `prefixe[1]`… pour une liste de textes. */
export function champsIndexes(
  prefixe: string,
  valeurs: ReadonlyArray<string>,
): Record<string, string> {
  const champs: Record<string, string> = {};
  valeurs.forEach((v, i) => {
    champs[`${prefixe}[${i}]`] = v;
  });
  return champs;
}

/**
 * Fautes dures de doctrine sur des textes de ville, champ par champ. Une liste
 * non vide = l'objet ne doit JAMAIS être approuvé automatiquement.
 */
export function fautesDoctrineVille(
  champs: Record<string, string | undefined>,
  opts: OptionsInterdits = OPTIONS_INTERDITS_VILLE,
): InterditSurface[] {
  return detecterInterditsSurface(champs, opts);
}

/** Une ligne lisible par faute, pour les notes de relecture et les journaux. */
export function resumerFautesDoctrine(fautes: ReadonlyArray<InterditSurface>): string[] {
  return fautes.map((f) => `${f.champ} : ${f.code} (${raisonInterdit(f.code)}) « ${f.extrait} »`);
}

/**
 * Ces données économiques viennent-elles de la mémoire du modèle (non vérifiées
 * une à une) ? Vrai si la fiche a été produite par le générateur, ou si la
 * source d'une de ses entrées est celle de la mémoire du modèle.
 */
export function donneesEconomiquesDeLaMemoire(eco: VilleEconomicData | undefined): boolean {
  if (!eco) return false;
  if (eco.reviewedBy.startsWith(REVIEWED_BY_GENERATEUR_LLM)) return true;
  const sources: ReadonlyArray<string | undefined> = [
    eco.topSectorsNaf?.[0]?.source,
    eco.statsInsee?.source,
  ];
  return sources.some((s) => s === SOURCE_DONNEES_MEMOIRE_MODELE);
}

export interface EntreeDecisionApprobation {
  readonly qualityScore: number;
  readonly seuil: number;
  readonly donneesDeLaMemoire: boolean;
  readonly nbFautesDoctrine: number;
}

export interface DecisionApprobation {
  readonly approuver: boolean;
  /** Raison lisible, écrite dans `reviewNotes` et dans les journaux. */
  readonly motif: string;
}

/**
 * Décide si une copie de ville peut être approuvée automatiquement.
 * Ordre : doctrine (faute dure), puis données de la mémoire du modèle, puis score.
 * Les villes à données écrites à la main gardent leur circuit (score) si la
 * doctrine passe.
 */
export function decisionApprobationAuto(e: EntreeDecisionApprobation): DecisionApprobation {
  if (e.nbFautesDoctrine > 0) {
    return {
      approuver: false,
      motif: `${e.nbFautesDoctrine} faute(s) de doctrine : relecture humaine obligatoire.`,
    };
  }
  if (e.donneesDeLaMemoire) {
    return {
      approuver: false,
      motif:
        "Données locales issues de la mémoire du modèle (non vérifiées) : relecture humaine obligatoire, jamais d'approbation sur simple score.",
    };
  }
  if (e.qualityScore < e.seuil) {
    return {
      approuver: false,
      motif: `Score ${e.qualityScore} inférieur au seuil ${e.seuil} : relecture humaine.`,
    };
  }
  return {
    approuver: true,
    motif: `Approuvé automatiquement (score ${e.qualityScore} >= ${e.seuil}, doctrine sans faute, données écrites à la main).`,
  };
}
