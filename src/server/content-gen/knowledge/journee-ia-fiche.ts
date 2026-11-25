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
  { libelle: "« Grenoble »", motif: /grenoble/ },
  { libelle: "frais de déplacement", motif: /frais de deplacement/ },
  { libelle: "« déplacement inclus »", motif: /deplacement inclus/ },
  { libelle: "tout prix barré ou prix « avant »", motif: /prix barre|prix initial|au lieu de/ },
  { libelle: "« 5 fois »", motif: /\b5 fois\b|\bcinq fois\b/ },
  {
    // Le seuil de la garantie en euros (multiple × prix) : jamais cité, seulement « N fois ».
    libelle: `« ${SEUIL_GARANTIE_TEXTE} € » (seuil de la garantie en euros)`,
    motif: new RegExp(
      `(?<!\\d)${SEUIL_GARANTIE_CHIFFRES.replace(/(\d)(?=(\d{3})+$)/g, "$1 ?")}(?!\\d)`,
    ),
  },
  { libelle: "« aucun gain garanti »", motif: /aucun gain garanti/ },
  {
    libelle: "des gains garantis ou promis à l'avance",
    motif: /gains? (?:sont |est )?(?:garantis?|promis)|garantie? de gains?|resultats? garantis?/,
  },
  {
    libelle: "réservation ou paiement en ligne direct",
    motif:
      /(?:reserv\w*|pay\w*|regl\w*|achet\w*) (?:\w+ ){0,3}en ligne|paiement en ligne|reservation en ligne/,
  },
  { libelle: "tout acompte", motif: /acompte/ },
  { libelle: "toute condition d'annulation", motif: /annulation|annuler/ },
];

function normaliser(texte: string): string {
  return texte
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
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
    "- Audience : TPE et PME qui partent de zéro ; aucun prérequis, aucun outil à acheter avant.",
    `- Prix : ${prix}, prix unique, un seul montant jamais comparé à un autre. Citable tel quel ou par le jeton \`${JETON_PRIX_JOURNEE_IA}\`.`,
    `- Rapport : remis sous ${DELAI_RAPPORT_JOURS_OUVRES} jours ouvrés après la journée (gains chiffrés, tâches à automatiser classées par rentabilité, plan d'action sur 90 jours).`,
    `- Garantie : ${GARANTIE_PHRASE} Les gains identifiés sont une estimation du rapport, jamais une promesse. Elle porte sur un multiple de ${MULTIPLE_GARANTIE} fois le prix HT, à citer en « ${MULTIPLE_GARANTIE} fois le prix HT », sans montant en euros.`,
    `- ${CONDITION_GARANTIE} Citer cette condition chaque fois que la garantie est citée.`,
    "- Pour le paiement, la réservation et les modalités contractuelles : renvoyer aux CGV et au rendez-vous avec l'équipe.",
  ].join("\n");
}

/** Le sujet touche-t-il la Journée IA ? (« journée IA », « journée d'audit IA », « La Journée IA »…) */
export function sujetTouchelaJourneeIA(
  ...textes: ReadonlyArray<string | null | undefined>
): boolean {
  const n = normaliser(textes.filter(Boolean).join(" ")).replace(/[^a-z0-9]+/g, " ");
  return /\bjournee (?:ia|audit|d audit)\b|\bjournee d (?:audit|ia)\b/.test(n);
}

/** Bloc de consigne (faits + interdits) à appendre au system prompt ; `""` hors sujet. */
export function consigneJourneeIA(...sujets: ReadonlyArray<string | null | undefined>): string {
  if (!sujetTouchelaJourneeIA(...sujets)) return "";
  const interdits = INTERDITS_JOURNEE_IA.map((i) => `  • ${i.libelle}`).join("\n");
  return `\n\n${construireFicheJourneeIA()}\nINTERDITS sur la Journée IA — ne jamais écrire :\n${interdits}\n(Conditions d'annulation, acompte et paiement : renvoyer aux CGV, sans les détailler.)`;
}
