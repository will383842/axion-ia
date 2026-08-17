// Simulateur de gains v2 — LE QUESTIONNAIRE ADAPTATIF.
//
// ── Deux partis pris qui gouvernent tout ce fichier ───────────────────────
//
// 1. ON NE DEMANDE JAMAIS DE SAISIR UN NOMBRE. Chaque volume se répond par une
//    TRANCHE, en un seul appui. Un dirigeant ne sait pas s'il émet 34 ou 41
//    factures par mois — mais il sait, sans hésiter, que c'est « entre 20 et
//    50 ». La tranche est donc à la fois plus honnête et infiniment plus rapide
//    au pouce. Un champ numérique sur mobile ouvre un clavier, décale la mise
//    en page et fait abandonner : il n'y en a aucun dans ce simulateur.
//
// 2. « JE NE SAIS PAS » EST UNE RÉPONSE LÉGITIME, et elle est proposée partout.
//    Elle vaut « grandeur non mesurée » : la tâche correspondante est EXCLUE du
//    total, jamais estimée au jugé. Le rapport annonce alors moins que la
//    réalité — jamais plus — et il le dit explicitement. C'est la contrepartie
//    exacte de la promesse de sérieux.
//
// ── Longueur ──────────────────────────────────────────────────────────────
// 4 questions de cadrage, puis au plus `MAX_VOLUME_QUESTIONS_PER_FUNCTION` par
// fonction déclarée présente, plafonnées à `MAX_VOLUME_QUESTIONS` au total. Un
// artisan seul répond à 8 questions, un cabinet de 40 personnes à 16.

import type { BusinessFunction, VolumeKey } from "./types";

/** Une réponse possible à une question de volume. `value: null` = « je ne sais pas ». */
export interface VolumeChoice {
  readonly id: string;
  readonly labelFr: string;
  /** Valeur retenue pour le calcul (médiane de la tranche). `null` = non mesuré. */
  readonly value: number | null;
}

export interface VolumeQuestion {
  readonly volumeKey: VolumeKey;
  readonly fn: BusinessFunction;
  /** Formulée à la deuxième personne, sans jargon, réponse possible de tête. */
  readonly questionFr: string;
  /** Lève l'ambiguïté sur ce qu'on compte. Affichée sous la question. */
  readonly hintFr: string;
  /** Ordre au sein de la fonction. 1 = la plus discriminante, posée en premier. */
  readonly priority: number;
  readonly choices: readonly VolumeChoice[];
}

/** Au plus 2 questions de volume par fonction : au-delà, l'abandon grimpe. */
export const MAX_VOLUME_QUESTIONS_PER_FUNCTION = 2;

/** Plafond global, pour qu'un dirigeant cochant les 8 fonctions ne s'enlise pas. */
export const MAX_VOLUME_QUESTIONS = 12;

/** Fabrique une tranche « je ne sais pas » homogène. */
function unknown(): VolumeChoice {
  return { id: "nsp", labelFr: "Je ne sais pas", value: null };
}

export const VOLUME_QUESTIONS: readonly VolumeQuestion[] = [
  // ═══════════════════════════════════════════════════════════════════════
  // ADMINISTRATIF
  // ═══════════════════════════════════════════════════════════════════════
  {
    volumeKey: "factures_emises_mois",
    fn: "administratif",
    questionFr: "Combien de factures émettez-vous par mois ?",
    hintFr: "Toutes les factures clients, quel que soit le montant.",
    priority: 1,
    choices: [
      { id: "a", labelFr: "Moins de 10", value: 5 },
      { id: "b", labelFr: "10 à 30", value: 20 },
      { id: "c", labelFr: "30 à 80", value: 55 },
      { id: "d", labelFr: "80 à 200", value: 140 },
      { id: "e", labelFr: "Plus de 200", value: 320 },
      unknown(),
    ],
  },
  {
    volumeKey: "emails_traites_jour",
    fn: "administratif",
    questionFr: "Combien d'e-mails traitez-vous par jour, dans l'entreprise ?",
    hintFr: "Ceux auxquels quelqu'un doit vraiment répondre ou donner suite.",
    priority: 2,
    choices: [
      { id: "a", labelFr: "Moins de 20", value: 12 },
      { id: "b", labelFr: "20 à 50", value: 35 },
      { id: "c", labelFr: "50 à 120", value: 85 },
      { id: "d", labelFr: "120 à 300", value: 200 },
      { id: "e", labelFr: "Plus de 300", value: 450 },
      unknown(),
    ],
  },
  {
    volumeKey: "saisie_documents_mois",
    fn: "administratif",
    questionFr: "Combien de documents saisissez-vous ou classez-vous à la main, par mois ?",
    hintFr: "Factures fournisseurs, bons de livraison, attestations, courriers.",
    priority: 3,
    choices: [
      { id: "a", labelFr: "Moins de 20", value: 10 },
      { id: "b", labelFr: "20 à 60", value: 40 },
      { id: "c", labelFr: "60 à 150", value: 100 },
      { id: "d", labelFr: "Plus de 150", value: 250 },
      unknown(),
    ],
  },
  {
    volumeKey: "rdv_planifies_semaine",
    fn: "administratif",
    questionFr: "Combien de rendez-vous calez-vous par semaine ?",
    hintFr: "On compte les allers-retours pour trouver un créneau, pas le rendez-vous lui-même.",
    priority: 4,
    choices: [
      { id: "a", labelFr: "Moins de 5", value: 3 },
      { id: "b", labelFr: "5 à 15", value: 10 },
      { id: "c", labelFr: "15 à 40", value: 27 },
      { id: "d", labelFr: "Plus de 40", value: 60 },
      unknown(),
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // COMMERCIAL
  // ═══════════════════════════════════════════════════════════════════════
  {
    volumeKey: "devis_emis_semaine",
    fn: "commercial",
    questionFr: "Combien de devis sortez-vous par semaine ?",
    hintFr: "Tous les devis envoyés, acceptés ou non.",
    priority: 1,
    choices: [
      { id: "a", labelFr: "Moins de 3", value: 1.5 },
      { id: "b", labelFr: "3 à 10", value: 6 },
      { id: "c", labelFr: "10 à 25", value: 17 },
      { id: "d", labelFr: "Plus de 25", value: 40 },
      unknown(),
    ],
  },
  {
    volumeKey: "prospects_qualifies_mois",
    fn: "commercial",
    questionFr: "Combien de demandes entrantes recevez-vous par mois ?",
    hintFr: "Formulaire, téléphone, bouche-à-oreille : tout ce qui demande à être qualifié.",
    priority: 2,
    choices: [
      { id: "a", labelFr: "Moins de 10", value: 5 },
      { id: "b", labelFr: "10 à 30", value: 20 },
      { id: "c", labelFr: "30 à 100", value: 60 },
      { id: "d", labelFr: "Plus de 100", value: 160 },
      unknown(),
    ],
  },
  {
    volumeKey: "propositions_longues_mois",
    fn: "commercial",
    questionFr: "Combien de propositions commerciales détaillées produisez-vous par mois ?",
    hintFr: "Les dossiers de plusieurs pages, pas les devis d'une ligne.",
    priority: 3,
    choices: [
      { id: "a", labelFr: "Aucune", value: 0 },
      { id: "b", labelFr: "1 à 3", value: 2 },
      { id: "c", labelFr: "4 à 10", value: 7 },
      { id: "d", labelFr: "Plus de 10", value: 16 },
      unknown(),
    ],
  },
  {
    volumeKey: "relances_commerciales_mois",
    fn: "commercial",
    questionFr: "Combien de relances commerciales écrivez-vous par mois ?",
    hintFr: "Hors relance de devis, qui est comptée séparément.",
    priority: 4,
    choices: [
      { id: "a", labelFr: "Moins de 10", value: 5 },
      { id: "b", labelFr: "10 à 40", value: 25 },
      { id: "c", labelFr: "40 à 120", value: 75 },
      { id: "d", labelFr: "Plus de 120", value: 200 },
      unknown(),
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // RELATION CLIENT
  // ═══════════════════════════════════════════════════════════════════════
  {
    volumeKey: "appels_entrants_jour",
    fn: "relation_client",
    questionFr: "Combien d'appels entrants recevez-vous par jour ?",
    hintFr: "Sur l'ensemble de l'entreprise.",
    priority: 1,
    choices: [
      { id: "a", labelFr: "Moins de 10", value: 5 },
      { id: "b", labelFr: "10 à 30", value: 20 },
      { id: "c", labelFr: "30 à 80", value: 55 },
      { id: "d", labelFr: "Plus de 80", value: 120 },
      unknown(),
    ],
  },
  {
    volumeKey: "demandes_ecrites_jour",
    fn: "relation_client",
    questionFr: "Combien de demandes écrites de clients recevez-vous par jour ?",
    hintFr: "Messages, formulaires, réseaux sociaux.",
    priority: 2,
    choices: [
      { id: "a", labelFr: "Moins de 5", value: 3 },
      { id: "b", labelFr: "5 à 20", value: 12 },
      { id: "c", labelFr: "20 à 60", value: 40 },
      { id: "d", labelFr: "Plus de 60", value: 90 },
      unknown(),
    ],
  },
  {
    volumeKey: "reclamations_mois",
    fn: "relation_client",
    questionFr: "Combien de réclamations traitez-vous par mois ?",
    hintFr: "Les sujets qui demandent d'ouvrir un dossier et de remonter l'historique.",
    priority: 3,
    choices: [
      { id: "a", labelFr: "Moins de 3", value: 1.5 },
      { id: "b", labelFr: "3 à 10", value: 6 },
      { id: "c", labelFr: "10 à 40", value: 25 },
      { id: "d", labelFr: "Plus de 40", value: 60 },
      unknown(),
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // PRODUCTION ET MÉTIER
  // ═══════════════════════════════════════════════════════════════════════
  {
    volumeKey: "comptes_rendus_semaine",
    fn: "production",
    questionFr: "Combien de comptes-rendus rédigez-vous par semaine ?",
    hintFr: "Réunions, visites, appels importants, points de chantier.",
    priority: 1,
    choices: [
      { id: "a", labelFr: "Moins de 3", value: 1.5 },
      { id: "b", labelFr: "3 à 10", value: 6 },
      { id: "c", labelFr: "10 à 30", value: 20 },
      { id: "d", labelFr: "Plus de 30", value: 45 },
      unknown(),
    ],
  },
  {
    volumeKey: "recherches_documentaires_semaine",
    fn: "production",
    questionFr: "Combien de fois par semaine cherchez-vous une information dans vos documents ?",
    hintFr: "Une clause, un devis passé, une procédure, l'historique d'un client.",
    priority: 2,
    choices: [
      { id: "a", labelFr: "Moins de 5", value: 3 },
      { id: "b", labelFr: "5 à 20", value: 12 },
      { id: "c", labelFr: "20 à 60", value: 40 },
      { id: "d", labelFr: "Plus de 60", value: 90 },
      unknown(),
    ],
  },
  {
    volumeKey: "documents_rediges_semaine",
    fn: "production",
    questionFr: "Combien de documents métier rédigez-vous par semaine ?",
    hintFr: "Rapports, dossiers, courriers, notes techniques.",
    priority: 3,
    choices: [
      { id: "a", labelFr: "Moins de 3", value: 1.5 },
      { id: "b", labelFr: "3 à 10", value: 6 },
      { id: "c", labelFr: "10 à 25", value: 17 },
      { id: "d", labelFr: "Plus de 25", value: 40 },
      unknown(),
    ],
  },
  {
    volumeKey: "controles_conformite_mois",
    fn: "production",
    questionFr: "Combien de dossiers contrôlez-vous par mois ?",
    hintFr: "Vérification des pièces, des dates, de la conformité avant validation.",
    priority: 4,
    choices: [
      { id: "a", labelFr: "Moins de 10", value: 5 },
      { id: "b", labelFr: "10 à 40", value: 25 },
      { id: "c", labelFr: "40 à 120", value: 75 },
      { id: "d", labelFr: "Plus de 120", value: 200 },
      unknown(),
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // MARKETING
  // ═══════════════════════════════════════════════════════════════════════
  {
    volumeKey: "publications_mois",
    fn: "marketing",
    questionFr: "Combien de publications produisez-vous par mois ?",
    hintFr: "Réseaux sociaux, newsletters, actualités du site.",
    priority: 1,
    choices: [
      { id: "a", labelFr: "Aucune", value: 0 },
      { id: "b", labelFr: "1 à 4", value: 2.5 },
      { id: "c", labelFr: "5 à 15", value: 10 },
      { id: "d", labelFr: "Plus de 15", value: 25 },
      unknown(),
    ],
  },
  {
    volumeKey: "articles_rediges_mois",
    fn: "marketing",
    questionFr: "Combien d'articles de fond rédigez-vous par mois ?",
    hintFr: "Les contenus longs : blog, guides, dossiers.",
    priority: 2,
    choices: [
      { id: "a", labelFr: "Aucun", value: 0 },
      { id: "b", labelFr: "1 à 2", value: 1.5 },
      { id: "c", labelFr: "3 à 8", value: 5 },
      { id: "d", labelFr: "Plus de 8", value: 12 },
      unknown(),
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // RESSOURCES HUMAINES
  // ═══════════════════════════════════════════════════════════════════════
  {
    volumeKey: "candidatures_recues_mois",
    fn: "rh",
    questionFr: "Combien de candidatures recevez-vous par mois ?",
    hintFr: "Spontanées comprises.",
    priority: 1,
    choices: [
      { id: "a", labelFr: "Moins de 5", value: 2.5 },
      { id: "b", labelFr: "5 à 20", value: 12 },
      { id: "c", labelFr: "20 à 80", value: 50 },
      { id: "d", labelFr: "Plus de 80", value: 150 },
      unknown(),
    ],
  },
  {
    volumeKey: "entretiens_menes_mois",
    fn: "rh",
    questionFr: "Combien d'entretiens menez-vous par mois ?",
    hintFr: "Recrutement, entretiens annuels, points individuels.",
    priority: 2,
    choices: [
      { id: "a", labelFr: "Moins de 3", value: 1.5 },
      { id: "b", labelFr: "3 à 10", value: 6 },
      { id: "c", labelFr: "10 à 30", value: 20 },
      { id: "d", labelFr: "Plus de 30", value: 45 },
      unknown(),
    ],
  },
  {
    volumeKey: "onboardings_an",
    fn: "rh",
    questionFr: "Combien de personnes intégrez-vous par an ?",
    hintFr: "Embauches, alternants, stagiaires, intérimaires de longue durée.",
    priority: 3,
    choices: [
      { id: "a", labelFr: "Aucune", value: 0 },
      { id: "b", labelFr: "1 à 3", value: 2 },
      { id: "c", labelFr: "4 à 12", value: 8 },
      { id: "d", labelFr: "Plus de 12", value: 25 },
      unknown(),
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // FINANCE ET PILOTAGE
  // ═══════════════════════════════════════════════════════════════════════
  {
    volumeKey: "reportings_produits_mois",
    fn: "finance",
    questionFr: "Combien de rapports ou tableaux de bord produisez-vous par mois ?",
    hintFr: "Ceux qu'il faut refaire à chaque période.",
    priority: 1,
    choices: [
      { id: "a", labelFr: "Aucun", value: 0 },
      { id: "b", labelFr: "1 à 3", value: 2 },
      { id: "c", labelFr: "4 à 10", value: 7 },
      { id: "d", labelFr: "Plus de 10", value: 18 },
      unknown(),
    ],
  },
  {
    volumeKey: "rapprochements_mois",
    fn: "finance",
    questionFr: "Combien de rapprochements faites-vous par mois ?",
    hintFr: "Écritures et justificatifs, relevés bancaires, notes de frais.",
    priority: 2,
    choices: [
      { id: "a", labelFr: "Moins de 20", value: 10 },
      { id: "b", labelFr: "20 à 80", value: 50 },
      { id: "c", labelFr: "80 à 250", value: 160 },
      { id: "d", labelFr: "Plus de 250", value: 400 },
      unknown(),
    ],
  },
] as const;

/**
 * Les questions rattachées à une fonction, les plus discriminantes d'abord.
 * La fonction `direction` n'a volontairement AUCUNE question de volume : son
 * temps se mesure à travers les comptes-rendus et les reportings, déjà comptés
 * ailleurs. La compter deux fois gonflerait le résultat.
 */
export function questionsForFunction(fn: BusinessFunction): readonly VolumeQuestion[] {
  return VOLUME_QUESTIONS.filter((q) => q.fn === fn).sort((a, b) => a.priority - b.priority);
}

/**
 * Construit la liste ordonnée des questions de volume à poser, à partir des
 * fonctions déclarées présentes.
 *
 * Ordre : on prend d'abord la question la plus discriminante de CHAQUE fonction
 * (tour 1), puis la deuxième de chaque fonction (tour 2). Ainsi, un dirigeant
 * qui abandonne à mi-parcours a quand même couvert toutes ses fonctions — un
 * rapport large et grossier vaut mieux qu'un rapport profond et borgne.
 */
export function selectVolumeQuestions(
  functions: readonly BusinessFunction[],
): readonly VolumeQuestion[] {
  const selected: VolumeQuestion[] = [];

  for (let round = 0; round < MAX_VOLUME_QUESTIONS_PER_FUNCTION; round += 1) {
    for (const fn of functions) {
      if (selected.length >= MAX_VOLUME_QUESTIONS) return selected;
      const q = questionsForFunction(fn)[round];
      if (q) selected.push(q);
    }
  }
  return selected;
}
