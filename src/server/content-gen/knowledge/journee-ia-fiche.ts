/**
 * Fiche de connaissances « Journée IA » pour le générateur de contenu.
 *
 * Source unique des faits que les consignes de génération donnent au modèle quand le sujet
 * touche la Journée IA. Le texte est CONSTRUIT à partir de `src/content/journee-ia-commun.ts`
 * (délai, multiple de la garantie, phrases de garantie) et de `pricing.ts` (prix) : aucun
 * chiffre n'est écrit ici, donc la fiche suit les constantes.
 *
 * Deux blocs : les FAITS (`construireFicheJourneeIA`) et les INTERDITS (`INTERDITS_JOURNEE_IA`).
 * Les interdits sont énoncés à part : la fiche elle-même n'en contient aucun
 * (`trouveInterdits(fiche)` rend `[]`, verrouillé par le test).
 */

import {
  CONDITION_GARANTIE,
  DELAI_RAPPORT_JOURS_OUVRES,
  GARANTIE_PHRASE,
  JETON_PRIX,
  MULTIPLE_GARANTIE,
  remplacerJetons,
  seuilGarantieEur,
} from "@/content/journee-ia-commun";
import { JOURNEE_IA_TIER } from "@/content/pricing";
import { JETON_PRIX_JOURNEE_IA } from "../brand/consigne-prix";

export interface InterditJourneeIA {
  /** Ce que la consigne montre au modèle. */
  readonly libelle: string;
  /** Motif sur texte normalisé (minuscules, sans accents, espaces simples). */
  readonly motif: RegExp;
}

const SEUIL_GARANTIE_CHIFFRES = String(seuilGarantieEur());
const SEUIL_GARANTIE_TEXTE = SEUIL_GARANTIE_CHIFFRES.replace(/\B(?=(\d{3})+$)/g, "\u202f");

/** Ce que le modèle ne doit jamais écrire à propos de la Journée IA. */
export const INTERDITS_JOURNEE_IA: readonly InterditJourneeIA[] = [
  { libelle: "« Grenoble »", motif: /grenobl/ },
  { libelle: "frais de déplacement", motif: /frais de deplacement|frais kilometriques/ },
  {
    libelle: "toute mention du déplacement (« déplacement inclus », offert, pris en charge)",
    motif:
      /deplacements? (?:\w+ ){0,2}(?:inclus|compris|offerts?|pris en charge|gratuits?)|inclut le deplacement/,
  },
  {
    libelle: "tout prix barré ou prix « avant »",
    motif: /\bbarre|prix initial|anciennement|prix promotionnel|remise de \d/,
  },
  { libelle: "« 5 fois »", motif: /\b5 ?fois\b|\bcinq fois\b|\b5 ?x\b|\bx ?5\b|\b5 ?×|quintuple/ },
  {
    // Le seuil de la garantie en euros (multiple × prix) : jamais cité, seulement « N fois ».
    libelle: `« ${SEUIL_GARANTIE_TEXTE} € » (seuil de la garantie en euros)`,
    motif: new RegExp(
      `(?<!\\d)${SEUIL_GARANTIE_CHIFFRES.replace(/(\d)(?=(\d{3})+$)/g, "$1[ .,]?")}(?!\\d)`,
    ),
  },
  { libelle: "« aucun gain garanti »", motif: /aucun gain (?:n est |est )?(?:jamais )?garanti/ },
  {
    libelle: "des gains garantis ou promis à l'avance",
    motif:
      /(?:gains?|economies|resultats?|roi|retour sur investissement) (?:sont |est )?(?:garantis?|promis|assures?)|garantie? de gains?|garantissons? (?:des |les )?(?:gains|economies|resultats)/,
  },
  {
    libelle: "réservation ou paiement en ligne direct",
    motif:
      /(?:reserv\w*|pay\w*|regl\w*|achet\w*|command\w*) (?:[a-z]+ ){0,4}en ligne|(?:paiement|reservation|achat) en ligne|(?:reserv\w*|pay\w*) directement|carte bancaire/,
  },
  { libelle: "tout acompte", motif: /acompte|arrhes/ },
  {
    libelle: "toute condition d'annulation",
    motif: /annulation|annul(?:er|ez|e|ee|es)\b|retractation|report de la journee/,
  },
];

function normaliser(texte: string): string {
  return texte
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, " ")
    .replace(/[\s  ]+/g, " ");
}

/** Libellés des interdits présents dans un texte (`[]` si aucun). */
export function trouveInterdits(texte: string): string[] {
  const n = normaliser(texte);
  return INTERDITS_JOURNEE_IA.filter((i) => i.motif.test(n)).map((i) => i.libelle);
}

/** Les faits, construits depuis les constantes. */
export function construireFicheJourneeIA(): string {
  const prix = remplacerJetons(JETON_PRIX);
  return [
    "FICHE JOURNÉE IA — faits à respecter à la lettre :",
    "- Format : une seule journée en présentiel, dans les locaux de l'entreprise, partout en France.",
    "- Audience : TPE et PME qui partent de zéro, sans prérequis.",
    `- Prix : prix unique, un seul montant jamais comparé à un autre. À écrire par le jeton \`${JETON_PRIX_JOURNEE_IA}\` (résolu au rendu en « ${prix} »), jamais recopié en chiffres.`,
    `- Rapport : remis sous ${DELAI_RAPPORT_JOURS_OUVRES} jours ouvrés après la journée.`,
    `- Garantie : si les gains identifiés dans le rapport n'atteignent pas ${MULTIPLE_GARANTIE} fois le prix HT de la journée, le client est remboursé sur demande écrite. Les gains identifiés sont une estimation du rapport, jamais une promesse. À citer en « ${MULTIPLE_GARANTIE} fois le prix HT », sans montant en euros.`,
    `- ${CONDITION_GARANTIE} Citer cette condition chaque fois que la garantie est citée.`,
    "- Pour le paiement, la réservation et les modalités contractuelles : renvoyer aux CGV et au rendez-vous avec l'équipe.",
  ].join("\n");
}

/**
 * Faits de RÉFÉRENCE pour le juge de fidélité (relecture, pas rédaction) : même source
 * unique que `construireFicheJourneeIA`, sans consigne de rédaction ni jeton. Lève si une
 * donnée est illisible (le contrôle échoue alors fermé : relecture humaine).
 * Zone / acompte : formulés d'après les pages et les CGV (`legal.ts`, art. 47.6 ; le déplacement est un sujet interdit,
 * décision du dirigeant) ; le siège étant réellement à Grenoble, on ne l'écrit pas « pas à Grenoble ».
 */
export function faitsJourneeIAPourRelecture(): string {
  if (JOURNEE_IA_TIER.priceFlat == null) {
    throw new Error("prix de la Journée IA illisible (priceFlat absent)");
  }
  seuilGarantieEur();
  const prix = remplacerJetons(JETON_PRIX);
  if (!/\d/.test(prix)) throw new Error("prix de la Journée IA non affichable");
  if (!Number.isInteger(MULTIPLE_GARANTIE) || MULTIPLE_GARANTIE <= 0) {
    throw new Error("multiple de la garantie illisible");
  }
  if (!GARANTIE_PHRASE.includes(`${MULTIPLE_GARANTIE} fois`)) {
    throw new Error("phrase de garantie incohérente avec le multiple");
  }
  const texte = [
    "FAITS DU SITE SUR LA JOURNÉE IA (source unique ; ne s'appliquent qu'aux passages de l'article qui parlent de la Journée IA, pas aux autres offres, formations ou au diagnostic en visio) :",
    `- Prix : ${prix}. Prix unique et SEUL prix public : tout autre montant, remise, prix barré ou « à partir de » est une contradiction.`,
    `- Garantie : ${GARANTIE_PHRASE} Elle porte sur les gains IDENTIFIÉS dans le rapport, jamais sur des gains obtenus. Aucun autre multiple que ${MULTIPLE_GARANTIE} fois le prix HT.`,
    `- ${CONDITION_GARANTIE} La présence du décideur est exigée pendant l'audit.`,
    `- Rapport remis sous ${DELAI_RAPPORT_JOURS_OUVRES} jours ouvrés après la journée.`,
    "- Format : une seule journée en présentiel, dans les locaux de l'entreprise (audit le matin, formation l'après-midi). La Journée IA elle-même n'est jamais à distance.",
    "- Zone : partout en France, outre-mer compris. Les pages n'annoncent aucune ville d'implantation comme base d'intervention : en annoncer une est une contradiction (citer le siège social tel qu'il figure aux mentions légales n'en est pas une).",
    "- Déplacement : sujet interdit. Un article ne mentionne jamais de frais de déplacement, d'hébergement ou de repas, quels qu'ils soient (gratuits, inclus, compris dans une région, facturés, en sus). Toute mention est une contradiction. Seule formule permise : « dans vos locaux, partout en France ».",
    "- Acompte : les pages renvoient aux CGV. Aucun montant, taux ou caractère systématique d'acompte n'est annoncé : en annoncer un est une contradiction. Selon les CGV (art. 47.6), l'acompte versé par un client professionnel ou une personne morale non professionnelle reste acquis en cas d'annulation par le client, quel que soit le délai ; la personne physique non professionnelle est remboursée. Un article qui promet un remboursement de l'acompte à un client professionnel est une contradiction.",
  ].join("\n");
  if (texte.includes("{{")) throw new Error("jeton non résolu dans les faits de l'offre");
  return texte;
}

/** Le sujet touche-t-il la Journée IA ? (« journée IA », « journées d'audit », « audit IA en une journée »…) */
export function sujetTouchelaJourneeIA(
  ...textes: ReadonlyArray<string | null | undefined>
): boolean {
  const n = normaliser(textes.filter(Boolean).join(" ")).replace(/[^a-z0-9]+/g, " ");
  return /\bjournees? (?:ia|audit|d audit|d ia|de l ia|intelligence artificielle)\b|\baudit ia en une journee\b/.test(
    n,
  );
}

/** Bloc de consigne (faits + interdits) à appendre au system prompt ; `""` hors sujet. */
export function consigneJourneeIA(...sujets: ReadonlyArray<string | null | undefined>): string {
  if (!sujetTouchelaJourneeIA(...sujets)) return "";
  return consigneJourneeIAForcee();
}

/** Même bloc, sans test du sujet : pour les générateurs dont la consigne cite toujours la Journée IA. */
export function consigneJourneeIAForcee(): string {
  const interdits = INTERDITS_JOURNEE_IA.map((i) => `  • ${i.libelle}`).join("\n");
  return `\n\n${construireFicheJourneeIA()}\nINTERDITS sur la Journée IA — ne jamais écrire :\n${interdits}\n(Conditions d'annulation, acompte et paiement : renvoyer aux CGV, sans les détailler.)`;
}
