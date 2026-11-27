// Faits communs de `llms.txt` et `llms-full.txt`. Dossier privé `_llms` (non routé) : il lit la
// navigation (`components/nav`) et le slogan de l'accueil, ce que `src/content` ne peut pas.
//
// Refonte du 20/11/2026 (audit `geo/llms/AUDIT-ET-PLAN-LLMS-TXT.md`) : les deux fichiers
// s'ouvrent sur le MÊME en-tête, produit ici une seule fois — la présentation officielle en
// citation, le slogan de l'accueil, puis la liste des faits clés (qui, pour qui, où, prix,
// premier pas, contact). Un moteur de réponse qui recoupe deux sources officielles divergentes
// n'en cite aucune : chaque fait partagé vit donc ICI, et les deux routes l'importent.
//
// 🔑 Règle de vérité : un fait n'entre ici que s'il se prouve dans le code.
//  - Présentation : `DESCRIPTION_ENTITE_FR`, jamais recopiée.
//  - Prix : le seul montant public (la Journée IA) est lu dans `pricing.ts` par son jeton.
//  - Rendez-vous gratuit et tailles d'entreprise : lus dans `OFFRE_JOURNEE_IA`.
//  - Hébergement : Hetzner, dans l'Union européenne. Le centre de données varie selon les
//    sources du dépôt : la ville n'est donc PAS publiée.
//  - Langue EN : lue au rendu dans `EN_LOCALE_ENABLED`, par le même prédicat que le proxy qui
//    émet les 301 (`isEnLocaleDisabled`).
//
// ⛔ Rien ici sur le déplacement, les frais ou le moment du paiement (décisions en cours chez le
// dirigeant), ni aucune consigne adressée aux IA.

import { CONTENU as ACCUEIL } from "@/app/[locale]/_accueil/contenu";
import { PRESTATIONS_NAV } from "@/components/nav/prestations-nav";
import { DESCRIPTION_ENTITE_FR, remplacerJetons } from "@/content/journee-ia-commun";
import { EFFECTIF_CIBLE, OFFRE_JOURNEE_IA } from "@/content/offre";
import { FOUNDER } from "@/lib/brand";
import { isEnLocaleDisabled } from "@/lib/i18n/en-to-fr-redirect";
import { COORDONNEES_PUBLIQUES } from "@/lib/identite-legale-ssot";

/**
 * Date de la dernière mise à jour des deux fichiers (`AAAA-MM-JJ`). À régler À LA MAIN dans
 * toute PR qui change un texte servi par `llms.txt` ou `llms-full.txt`. Volontairement sans
 * test « moins de N jours » : il rougirait tout seul un jour, sans faute de personne.
 */
export const DATE_MISE_A_JOUR_LLMS = "2026-11-20";

/** « 20/11/2026 » */
export function dateFr(iso: string): string {
  return iso.split("-").reverse().join("/");
}

/** Le slogan de l'accueil, lu dans son contenu (jamais recopié). */
export const SLOGAN_LLMS = `${ACCUEIL.heros.titrePartie1} ${ACCUEIL.heros.titreEm}`;

/**
 * Libellé public du module « sites web » : celui de l'en-tête. Le nom officiel
 * (`SERVICE_BY_ID.sitesWeb.officialFr`) porte « SaaS », mot que la charte proscrit
 * dans les textes publics ; on lit donc le libellé déjà validé pour la navigation.
 */
export const LIBELLE_SITES_WEB_FR =
  PRESTATIONS_NAV.find((p) => p.id === "sitesWeb")?.labelFr ?? "Sites web IA";

/** La phrase d'accroche d'une prestation, telle que l'en-tête du site l'affiche. */
export function accrocheNav(id: (typeof PRESTATIONS_NAV)[number]["id"]): string {
  const entree = PRESTATIONS_NAV.find((p) => p.id === id);
  if (!entree) throw new Error(`Prestation absente de la navigation : ${id}`);
  return entree.descriptionFr;
}

/** Hébergement : seul le fait prouvé (prestataire + Union européenne). */
export const HEBERGEMENT_LLMS = "Hetzner, dans l’Union européenne";

/** Facturation et engagement. */
export const FACTURATION_LLMS =
  "Facturation en euros, régime de TVA de l’Union européenne, virement SEPA ou SWIFT.";

/** Langues servies, lues au rendu (même prédicat que le proxy des 301). */
export function languesLlms(): string {
  return isEnLocaleDisabled() ? "français" : "français (version de référence) et anglais";
}

/** Vrai quand la version anglaise est servie (plan du site des images EN). */
export function anglaisServi(): boolean {
  return !isEnLocaleDisabled();
}

/** Accessibilité : l'objectif, et le fait qu'aucun audit n'a encore eu lieu. */
export const ACCESSIBILITE_LLMS = "objectif WCAG 2.2 AA, pas encore audité.";

/** Le rendez-vous gratuit, en une ligne : « gratuit, 45 minutes, en visio ou par téléphone, sans engagement ». */
export function rendezVousLlms(): string {
  const rdv = OFFRE_JOURNEE_IA.rendezVous;
  return `gratuit, ${rdv.dureeMinutes} minutes, en visio ou par téléphone, sans engagement`;
}

/** L'adresse absolue de la fiche du fondateur, sur le domaine servi. */
export function ficheFondateurLlms(siteUrl: string): string {
  return `${siteUrl}/${FOUNDER.pageLocale}${FOUNDER.pagePath}`;
}

/** Les faits clés, un par ligne : ce qu'une IA cherche pour filtrer (qui, pour qui, où, combien). */
export function faitsClesLlms(siteUrl: string): string[] {
  const rdv = OFFRE_JOURNEE_IA.rendezVous;
  return [
    `Nom : Axion-IA. Site officiel : ${siteUrl}. À ne pas confondre avec axionai.fr, site distinct, sans lien avec Axion-IA.`,
    `Fondateur et dirigeant : ${FOUNDER.fullName}.`,
    `Pour qui : les TPE et les PME. L’audit vaut pour les entreprises ${EFFECTIF_CIBLE} ; seule la formation de l’après-midi de la Journée IA est limitée : jusqu’à 15 personnes.`,
    "Où : partout en France, outre-mer compris, dans les locaux de l’entreprise.",
    "Prestations : audit, formation, implémentation, intégration aux logiciels existants, automatisation.",
    `Premier pas : le ${rdv.nom}, ${rendezVousLlms()}.`,
    `Prix : la Journée IA coûte ${remplacerJetons("{{PRIX}}")}, prix unique. C’est le seul prix publié ; les autres prestations sont sur devis écrit, fixé avant de commencer.`,
    FACTURATION_LLMS,
    `Langue : ${languesLlms()}. Hébergement : ${HEBERGEMENT_LLMS}.`,
    `Contact : ${COORDONNEES_PUBLIQUES.contactEmail}.`,
  ];
}

/**
 * L'en-tête commun aux deux fichiers, au caractère près : titre, présentation officielle en
 * citation, slogan, faits clés datés. La norme llms.txt n'impose que le titre ; la citation est
 * le résumé qu'une IA lit en premier.
 */
export function enteteLlms(siteUrl: string): string {
  return [
    "# Axion-IA",
    "",
    `> ${DESCRIPTION_ENTITE_FR}`,
    "",
    SLOGAN_LLMS,
    "",
    `Faits clés (mis à jour le ${dateFr(DATE_MISE_A_JOUR_LLMS)}) :`,
    "",
    ...faitsClesLlms(siteUrl).map((f) => `- ${f}`),
  ].join("\n");
}

/**
 * « Par où commencer » : le premier pas (le même dans tous les cas), puis les deux portes.
 * La Journée IA est l'offre phare, pas un passage obligé (décision du dirigeant, 20/11/2026).
 */
export function parOuCommencerLlms(siteUrl: string): string {
  const rdv = OFFRE_JOURNEE_IA.rendezVous;
  return [
    "## Par où commencer",
    "",
    `- [${rdv.nom}](${siteUrl}/fr/appel): le premier pas, dans tous les cas : un appel ${rendezVousLlms()}.`,
    `- [Accueil](${siteUrl}/fr): deux portes d’entrée. L’entreprise qui ne sait pas encore où l’IA lui ferait gagner du temps commence par la Journée IA. Certaines entreprises savent déjà où elles perdent du temps : elles prennent directement une formation, une automatisation ou une intégration. La Journée IA est l’offre phare, pas un passage obligé.`,
  ].join("\n");
}

/**
 * Passe une ligne de liste « - [titre](url) — texte » au format de la norme llms.txt,
 * « - [titre](url): texte ». Sert aux sections produites par d'autres modules (vidéos).
 */
export function auFormatNorme(markdown: string): string {
  return markdown.replace(/^(\s*- \[[^\]\n]+\]\([^)\s]+\)) — /gm, "$1: ");
}

/**
 * Les mots que la charte proscrit dans les textes publics, appliqués au texte SERVI par
 * `llms.txt` et `llms-full.txt` (hors ligne du Tour France IA, décision en attente). Lu aussi
 * par les tests des pages Cartographie et Prix d'un audit IA : ne pas l'élargir sans les relire.
 */
export const MOTS_INTERDITS_LLMS =
  /\bSaaS\b|no-code|conform|\bETI\b|financé|financement|certifi|qualiopi|\bCPF\b|\bOPCO\b|amende|offert|Grenoble|TPE\s?\/\s?PME/i;

/**
 * Ce qui ne paraît dans AUCUN des deux fichiers (décisions du dirigeant du 20/11/2026 et
 * erreurs relevées par l'audit, § 2.1) : aides à la formation, ville du siège ou du centre de
 * données, déplacement et frais, paiement, propriété du code, promesse de suivi après
 * la prestation, délais et livrables contradictoires, jargon interne, « brique par brique ».
 *
 * `llms-full.txt` rend des textes PARTAGÉS avec des pages du site (FAQ de `transversal.ts`,
 * glossaire) : une entrée qui porte un de ces motifs est écartée du fichier, sans toucher à sa
 * source (elle reste servie par sa page). Volontairement large : dans le doute, on retire.
 */
export const HORS_CANAL_LLMS = new RegExp(
  [
    "France Travail",
    "prise en charge",
    "financ[ée]",
    "Aucun gain garanti",
    "Francfort",
    "Frankfurt",
    "Nuremberg",
    "maintenance",
    "(?:échange|appel) de cadrage",
    "\\d\\s?(?:-|à)\\s?\\d+ semaines",
    "25-40 pages",
    "tier-1",
    "mission réelle",
    "grandes écoles",
    "brique par brique",
    "code source",
    "code custom",
    "propriétaire",
    "métropolitaine",
    "sans remise",
    "déplacement",
    "frais de",
    "en sus",
    "acompte",
    "paiement",
    "se paie",
    "\\bsuivi\\b",
    "\\bsupport\\b",
    "accompagn",
    "obligatoire",
    "témoignage",
    "cas clients?\\b",
  ].join("|"),
  "i",
);

/** Vrai si le texte peut être servi dans les deux fichiers. */
export function propreLlms(texte: string): boolean {
  return !MOTS_INTERDITS_LLMS.test(texte) && !HORS_CANAL_LLMS.test(texte);
}
