// ============================================================================
// CATALOGUE FORMATIONS — SSOT des 21 formations intra-entreprise + 1 séminaire.
//
// Refonte 2026-07-19 (décision Will) : le catalogue est réorganisé en
// 3 CATÉGORIES — offres générales (4), offres par métier (9), offres par
// secteur d'activité (8) — qui REMPLACENT l'axe durée et l'axe gamme comme axes
// de navigation. La durée reste un badge par carte. Le séminaire est conservé
// À PART (rubrique dédiée, hors catégories). Prix PUBLICS fixes par groupe
// (2 à 15 participants), dérivés de `FORMATION_PRICE_MATRIX` (pricing.ts) via
// (catégorie × durée) — jamais de prix en dur ici.
//
// Contenu 100 % FRANÇAIS (EN désactivé 301→FR ; `slugEn` = mapping de route
// uniquement, pas de contenu EN). Sources du contenu :
// `Downloads/Fiches_Formations_Axion-IA.md` (fiches commerciales) +
// `Downloads/Programmes_Qualiopi_Axion-IA.md` (programmes réglementaires).
//
// Le SEO de chaque page (h1/metaTitle/metaDescription/termes/faqs) vit ICI →
// la page dérive. Le déroulé minute-par-minute complet (kit pédagogique
// Qualiopi) relève de la DB (Formation Engine) ; ici = programme public.
//
// ⚠️ Aucun claim Qualiopi/OPCO dans ce fichier : les mentions de financement
// passent par les composants auto-gatés `OF_PUBLIC_DISCLOSURE_ENABLED`.
// ============================================================================

import type { FormationCategorie, FormationDuree, FormationGamme } from "../pricing";
import { getFormationBrackets, getFormationEntryPrice, getFormationPrice } from "../pricing";
import type { FormationBracket } from "../pricing";
import type { ModalitePedagogique } from "./modalites";

export interface FormationV2Faq {
  question: string;
  reponse: string;
}

export interface FormationCasUsage {
  texteFr: string;
  /** Petite image d'illustration (Unsplash → crédit obligatoire). */
  imageSrc?: string;
  imageCredit?: { name: string; url: string };
}

export interface FormationProgrammeStep {
  /** Repère de temps (« 35' », « Pause », « Matin »). Optionnel. */
  temps?: string;
  titre: string;
  /**
   * Nature pédagogique de la séquence.
   *
   * 🔴 Ajouté le 2026-08-06. Sans lui, le ratio de pratique déclaré au
   * programme Qualiopi n'était pas calculable : il était écrit en dur à 70 %
   * pour les 22 formations, sans que personne ne l'ait vérifié — les minutages
   * réels donnaient 41 à 62 %. `pratique` et `verification` sont les seuls
   * types comptés comme du temps où le participant produit (cf.
   * `server/qualiopi/formations/ratio-pratique.ts`).
   */
  type?: FormationStepType;
}

/**
 * Les cinq blocs du Standard de contenu pédagogique, plus deux types de
 * service : `cadre` pour les règles et limites — qui doivent précéder l'atelier
 * qu'elles protègent — et `pause` pour le temps de face-à-face non pédagogique.
 */
export type FormationStepType =
  "objectif" | "demonstration" | "pratique" | "verification" | "synthese" | "cadre" | "pause";

export interface FormationProgrammeSection {
  /** Ex. « Module 1 — … », « Jour 1 — … ». */
  titreFr: string;
  steps: ReadonlyArray<FormationProgrammeStep>;
}

export interface FormationV2 {
  /** Identifiant stable = slug FR (clé d'URL + lookup). */
  id: string;
  slugFr: string;
  /** Slug EN — mapping de route uniquement (pas de contenu EN). */
  slugEn: string;
  /** Numéro d'ordre source (catalogue 1-21 ; séminaire : 22). */
  numero: number;
  /**
   * Gamme historique — conservée pour les défauts visuels/outils
   * (catalog-v2-facts.ts) et la colonne `OffreSite.gamme` des offres archivées.
   * Toutes les formations de la refonte 2026-07 sont `ia-standard`.
   */
  gamme: FormationGamme;
  /**
   * Catégorie du catalogue (axe de navigation principal, refonte 2026-07-19).
   * `undefined` pour le séminaire (rubrique à part, hors catégories).
   */
  categorie?: FormationCategorie;
  /** Libellé de l'axe (« RH », « Santé »…) — badges et regroupements listing. */
  axeLabelFr?: string;
  duree: FormationDuree;
  /** Formation sans prix affiché (« Sur devis ») — court-circuite la matrice. */
  surDevis?: boolean;
  /** Séminaire (rubrique dédiée, présentiel, jusqu'à 50 pers). */
  seminaire?: boolean;
  /** « À LA UNE ». */
  featured?: boolean;
  /** Formation 2 jours scindable en 2 × 1 jour (affichage badge + FAQ). */
  scindable?: boolean;
  /** Pré-requis explicite (sinon aucun). */
  prerequisFr?: string;
  // ---- Identité / accroche ----
  titreFr: string;
  /** Sous-titre bénéfice (le « > » des fiches commerciales). */
  accrocheFr: string;
  // ---- SEO (FR) ----
  h1Fr: string;
  metaTitleFr: string;
  metaDescriptionFr: string;
  termesSemantiquesFr: ReadonlyArray<string>;
  // ---- Contenu ----
  publicViseFr: string;
  /** « À l'issue, le participant est capable de » (objectifs pédagogiques). */
  objectifsFr: ReadonlyArray<string>;
  beneficeDirigeantFr: string;
  /** « Concrètement : … » (ordre de grandeur illustratif, pas un engagement). */
  equationTempsFr: string;
  programme: ReadonlyArray<FormationProgrammeSection>;
  faqs: ReadonlyArray<FormationV2Faq>;
  // ---- Modalités & pratique (défauts centralisés dans catalog-v2-facts.ts) ----
  /** Format. Défaut = présentiel + distanciel possible. Surcharge si différent. */
  modalites?: ReadonlyArray<ModalitePedagogique>;
  /** Matériel requis. Défaut = « un ordinateur avec connexion internet ». */
  materielFr?: string;
  /** Effectif du groupe. Défaut = « Jusqu'à 15 participants ». */
  effectifFr?: string;
  /** Outils réellement pratiqués (phrase complète, rendue en FAQ). */
  outilsFr?: string;
  /** Délai d'accès (indicateur 1). Défaut centralisé dans catalog-v2-facts.ts. */
  delaiAccesFr?: string;
  /** Méthodes pédagogiques (indicateur 1). Défaut centralisé. */
  methodesFr?: string;
  /** Modalités d'évaluation (indicateur 1). Défaut centralisé. */
  modalitesEvaluationFr?: string;
  /** Accessibilité handicap (indicateur 1). Défaut centralisé. */
  accessibiliteHandicapFr?: string;
  // ---- Contenu enrichi (optionnel — fallback template si absent) ----
  /** Cas d'usage concrets (« ce que vos équipes en retirent »). Fallback = objectifs. */
  casUsageFr?: ReadonlyArray<FormationCasUsage>;
  /** Avant / après la formation (transformation concrète). */
  avantApresFr?: { avant: string; apres: string };
  /** Résultats concrets & mesurables (ex. { valeur: "1 à 2 h", label: "gagnées / jour" }). */
  resultatsFr?: ReadonlyArray<{ valeur: string; label: string }>;
  /** Image spécifique (sinon fallback par gamme, cf. catalog-v2-facts.ts). */
  imageSrc?: string;
  imageAltFr?: string;
  /** Crédit photographe si l'image est une photo Unsplash (CGU §6). */
  imageCredit?: { name: string; url: string };
}

// ============================================================================
// OFFRES GÉNÉRALES (4)
// ============================================================================

const BIEN_COMMENCER_4H: FormationV2 = {
  id: "ia-pour-bien-commencer",
  slugFr: "ia-pour-bien-commencer",
  slugEn: "ai-for-getting-started",
  numero: 1,
  gamme: "ia-standard",
  categorie: "generale",
  duree: "4h",
  featured: true,
  titreFr: "IA pour bien commencer",
  accrocheFr:
    "Prenez une longueur d'avance sur l'IA en une demi-journée — comprendre l'IA et l'utiliser dès aujourd'hui",
  h1Fr: "Formation IA pour bien commencer : comprendre l'IA et l'utiliser dès aujourd'hui (4 heures)",
  metaTitleFr: "Formation IA pour bien commencer — 4h",
  metaDescriptionFr:
    "Formation IA d'initiation en entreprise, 4 h, sans prérequis : comprendre l'IA, choisir le bon outil et l'utiliser dès aujourd'hui. 1 200 € HT par groupe.",
  termesSemantiquesFr: [
    "formation IA débutant",
    "initiation intelligence artificielle entreprise",
    "comprendre l'IA",
    "ChatGPT Claude Gemini",
    "formation IA 4 heures",
    "premiers pas IA",
  ],
  publicViseFr:
    "Tout collaborateur, toutes fonctions : de ceux qui n'ont jamais ouvert un outil d'IA à ceux qui en entendent parler partout sans savoir par où commencer. En 4 heures, l'équipe passe de « on en entend parler partout » à « je sais m'en servir » — une immersion dense et concrète, sans jargon, pour lever les blocages.",
  casUsageFr: [
    { texteFr: "Une vision claire de ce que l'IA peut — et ne peut pas — faire pour son poste" },
    {
      texteFr: "Les meilleurs outils du moment (ChatGPT, Claude, Gemini) et lequel utiliser quand",
    },
    {
      texteFr:
        "Les premières techniques pour obtenir des résultats utiles, pas des réponses génériques",
    },
    { texteFr: "Des cas d'usage directement applicables à son poste, dès le lendemain" },
  ],
  objectifsFr: [
    "Décrire ce qu'est une IA générative, ce qu'elle fait bien et ses limites",
    "Identifier l'outil adapté (ChatGPT, Claude, Gemini) selon la tâche",
    "Formuler une demande structurée (méthode AXION) donnant un résultat exploitable",
    "Réaliser une tâche courante de son poste à l'aide de l'IA",
    "Appliquer les règles de confidentialité : identifier les données à ne pas soumettre",
  ],
  beneficeDirigeantFr:
    "En une demi-journée, toute l'équipe a fait ses premiers pas : chacun connaît les bons outils, sait les utiliser sur une tâche réelle de son quotidien et repart avec les bons réflexes de confidentialité — sans désorganiser votre activité.",
  equationTempsFr:
    "4 h d'immersion → ce qui prenait une demi-heure — rédiger un e-mail délicat, résumer un long document — peut souvent se faire en quelques minutes.",
  avantApresFr: {
    avant: "L'IA paraît complexe, réservée aux experts, un peu inquiétante.",
    apres:
      "Chacun a fait ses premiers pas, connaît les bons outils et sait les utiliser sur une tâche réelle de son quotidien.",
  },
  materielFr:
    "Ordinateur portable et connexion internet ; accès aux outils IA préparé avec vous en amont si besoin",
  programme: [
    {
      titreFr: "Module 1 — Ce que l'IA sait faire, et ce qu'on ne lui confie jamais",
      steps: [
        {
          temps: "3'",
          type: "objectif",
          titre:
            "Objectif du module : en sortant, vous décrivez en une phrase ce qu'une IA générative peut faire sur votre poste, vous citez trois informations que vous ne lui donnerez jamais, et vous savez que la même question posée avec un mot différent peut donner une réponse orientée",
        },
        {
          temps: "12'",
          type: "demonstration",
          titre:
            "La machine ne sait pas, elle prédit — démonstration avant / après par le formateur, les deux DEMANDES affichées en entier à l'écran, sur l'outil unique de la demi-journée. Trame fournie dans le kit : (1) demande nue « Rédige un message pour annoncer un changement d'organisation », (2) même demande enrichie du contexte ; puis le geste du biais — on change UN SEUL mot de la demande (« Rédige le portrait d'un chef d'équipe efficace » → « d'une cheffe d'équipe efficace ») et la salle constate que la réponse change de camp. Aucune expertise métier requise : les deux couples de demandes sont écrits mot pour mot dans le guide d'animation",
        },
        {
          temps: "12'",
          type: "cadre",
          titre:
            "Avant de toucher au moindre fichier : les trois régimes d'usage des données (compte grand public, offre entreprise avec engagement de non-réutilisation, environnement validé par votre entreprise), la liste de ce qui ne sort jamais, et pourquoi retirer le nom ne rend pas un document anonyme — un dossier reste identifiable par le croisement de ses autres éléments. Mention du règlement européen sur l'IA : les contenus générés diffusés à des tiers relèvent d'une obligation d'information (voir alerte de relecture juridique)",
        },
        {
          temps: "30'",
          type: "pratique",
          titre:
            "Chasse à l'erreur et chasse au biais, chronométrée : chacun fait produire à l'IA un texte court sur son propre domaine, surligne ce qui est faux ou inventé et le compte ; puis relance la même demande en changeant un seul mot et note ce qui a bougé. C'est la salle qui corrige, pas le formateur — chacun est le seul expert de son sujet",
        },
        {
          temps: "10'",
          type: "verification",
          titre:
            "Vérification corrigée en salle : huit situations « je peux le soumettre / je ne peux pas » (liste fournie, corrigés fournis), plus deux questions sur ce qui s'est passé pendant la chasse au biais",
        },
        {
          temps: "5'",
          type: "synthese",
          titre:
            "Vos acquis : repérer une affirmation inventée · appliquer la liste de ce qui ne sort jamais · nommer le régime d'usage en vigueur chez vous",
        },
        { temps: "15'", type: "pause", titre: "Pause" },
      ],
    },
    {
      titreFr: "Module 2 — Formuler sa demande : la méthode AXION",
      steps: [
        {
          temps: "3'",
          type: "objectif",
          titre:
            "Objectif du module : en sortant, vous transformez une demande vague en demande structurée qui donne un texte utilisable dès le premier ou le deuxième essai",
        },
        {
          temps: "12'",
          type: "demonstration",
          titre:
            "Les cinq leviers AXION — Acteur (à qui l'IA doit ressembler), conteXte (ce qu'elle ignore de votre situation), Intention (ce que le texte doit produire chez le lecteur), Output (format, longueur, ton attendus), Normes (ce qui est interdit, obligatoire, ou à ne pas inventer) — démontrés avant / après sur un même besoin, les deux demandes affichées en entier",
        },
        {
          temps: "10'",
          type: "pratique",
          titre:
            "Déposer un document et travailler dessus : chacun dépose un fichier non sensible (PDF, export, photo d'une page) et demande à l'IA de le résumer. Les trois échecs typiques sont constatés en direct sur les machines de la salle : scan sans texte reconnu, fichier trop lourd, tableau qui se désaligne — et le contournement de chacun",
        },
        {
          temps: "30'",
          type: "pratique",
          titre:
            "Pratique chronométrée : chacun écrit sa demande AXION sur une tâche de son poste, la lance, la relance une fois en ajoutant une seule précision au lieu de tout recommencer, et conserve la version qui marche",
        },
        {
          temps: "12'",
          type: "verification",
          titre:
            "Vérification en binôme, grille des cinq leviers fournie : appliquée à la demande du voisin — quel levier manque, et qu'est-ce que ça change au résultat ? Restitution de trois binômes, corrigée en salle",
        },
        {
          temps: "5'",
          type: "synthese",
          titre:
            "Vos acquis : nommer les cinq leviers · réécrire une demande vague · relancer avec une précision au lieu de tout recommencer",
        },
      ],
    },
    {
      titreFr: "Module 3 — Trois usages à emporter, et par quoi je commence lundi",
      steps: [
        {
          temps: "3'",
          type: "objectif",
          titre:
            "Objectif du module : en sortant, vous repartez avec trois demandes écrites et testées, relançables telles quelles lundi matin, et vous savez ce que vous devez relire avant de diffuser quoi que ce soit",
        },
        {
          temps: "7'",
          type: "cadre",
          titre:
            "Avant de produire quoi que ce soit de diffusable : ce qui doit être relu systématiquement (chiffres, noms, dates, citations, tout ce qui engage), ce qu'on indique au destinataire quand un écrit lui est adressé et qu'il a été rédigé avec l'IA, et le principe qui tranche tous les cas — l'IA prépare, l'humain décide et signe. Rappel de la liste du module 1 : l'atelier qui suit se fait sur des tâches réelles, pas sur des données interdites",
        },
        {
          temps: "8'",
          type: "demonstration",
          titre:
            "Démonstration avant / après sur UNE seule tâche commune à tous les postes : l'e-mail difficile (annoncer un retard à un client). La demande AXION est affichée en entier et lue à voix haute, puis les deux sorties sont comparées ligne à ligne",
        },
        {
          temps: "40'",
          type: "pratique",
          titre:
            "Atelier chronométré : chacun traite deux vraies tâches de son poste en appliquant AXION et la règle de ce qui ne sort jamais, relance chaque demande au moins une fois, et retient les versions qui marchent — le formateur circule et ne corrige que la formulation de la demande, jamais le fond métier",
        },
        {
          temps: "15'",
          type: "verification",
          titre:
            "Évaluation des acquis corrigée en salle : quiz individuel de 10 questions (corrigé fourni), puis relecture par chacun de sa propre production à la grille fournie — exactitude, ton, structure, réutilisable tel quel — et note de ce qu'il doit encore corriger avant de s'en servir",
        },
        {
          temps: "5'",
          type: "pratique",
          titre:
            "Chacun met au propre sa troisième demande et remplit le verso de son feuillet : la tâche par laquelle je commence lundi, et la personne à qui je pose mes questions",
        },
        {
          temps: "3'",
          type: "synthese",
          titre:
            "Vos acquis : écrire une demande AXION sur une tâche de son poste · relancer plutôt que recommencer · relire et signaler avant de diffuser",
        },
      ],
    },
  ],
  faqs: [
    {
      question: "Faut-il un niveau en informatique ou en IA pour participer ?",
      reponse:
        "Aucun. La formation est conçue pour des débutants complets : chaque notion est expliquée sans jargon avant d'être mise en pratique. Les collaborateurs qui utilisent déjà l'IA occasionnellement y gagnent une méthode et des réflexes qu'ils n'ont pas.",
    },
    {
      question: "Présentiel ou distanciel ?",
      reponse:
        "Au choix : dans vos locaux, ou entièrement à distance, avec le même contenu et le même niveau d'interactivité. L'accès aux outils IA est préparé avec vous en amont si besoin.",
    },
    {
      question: "4 heures suffisent-elles vraiment ?",
      reponse:
        "Pour bien commencer, oui : le format condensé lève les blocages et donne à chacun des usages applicables dès le lendemain. Pour aller plus loin et pratiquer davantage sur les cas de chacun, la version journée complète ajoute autant de pratique que de théorie.",
    },
  ],
};

const BIEN_COMMENCER_JOURNEE: FormationV2 = {
  id: "ia-pour-bien-commencer-journee",
  slugFr: "ia-pour-bien-commencer-journee",
  slugEn: "ai-for-getting-started-full-day",
  numero: 2,
  gamme: "ia-standard",
  categorie: "generale",
  duree: "1j",
  titreFr: "IA pour bien commencer — journée complète",
  accrocheFr:
    "Donnez à vos équipes le temps de vraiment s'approprier l'IA — comprendre l'IA et l'utiliser dès aujourd'hui",
  h1Fr: "Formation IA pour bien commencer — journée complète : s'approprier l'IA sur ses propres tâches",
  metaTitleFr: "Formation IA pour bien commencer — 1 jour",
  metaDescriptionFr:
    "Formation IA d'initiation sur une journée : autant de pratique que de théorie, sur les cas réels de chaque participant. 1 900 € HT par groupe, sans prérequis.",
  termesSemantiquesFr: [
    "formation IA débutant 1 jour",
    "initiation IA entreprise",
    "s'approprier l'IA",
    "formation IA pratique",
    "ChatGPT Claude Gemini",
    "cas d'usage IA métier",
  ],
  publicViseFr:
    "Tout collaborateur, toutes fonctions. Le format d'une journée pour aller plus loin que la découverte : autant de pratique que de théorie, sur les cas d'usage réels de chaque participant. On ne repart pas avec des notes, mais avec des méthodes déjà testées sur son propre travail.",
  casUsageFr: [
    { texteFr: "Tout l'essentiel de la version condensée, avec le temps de le mettre en pratique" },
    { texteFr: "Des ateliers guidés sur les cas d'usage propres à chaque participant" },
    { texteFr: "Des techniques approfondies pour des résultats fiables et réutilisables" },
    {
      texteFr:
        "Un premier aperçu des usages avancés : traitement de documents, automatisation légère",
    },
  ],
  objectifsFr: [
    "Décrire ce qu'est une IA générative, ce qu'elle fait bien et ses limites",
    "Identifier l'outil adapté selon la tâche",
    "Formuler une demande structurée (méthode AXION) et l'itérer pour fiabiliser le résultat",
    "Réaliser plusieurs tâches de son poste à l'aide de l'IA",
    "Analyser un document : synthèse et points de vigilance",
    "Appliquer les règles de confidentialité et vérifier une production avant diffusion",
  ],
  beneficeDirigeantFr:
    "À la fin de la journée, chaque participant a testé plusieurs usages sur ses propres tâches et sait par où continuer seul — l'appropriation est faite pendant la formation, pas remise à plus tard.",
  equationTempsFr:
    "1 journée de pratique → chaque participant repart avec plusieurs usages déjà essayés sur ses propres tâches, plutôt qu'une simple démonstration.",
  avantApresFr: {
    avant: "L'IA paraît complexe, réservée aux experts, un peu inquiétante.",
    apres:
      "Chaque participant a testé plusieurs usages sur ses propres tâches et sait par où continuer seul.",
  },
  materielFr:
    "Ordinateur portable et connexion internet ; accès aux outils IA préparé avec vous en amont si besoin",
  programme: [
    {
      titreFr:
        "Matin — Module 1 : Le cadre avant les mains sur le clavier — ce que fait l'IA, où vont vos données, ce que la loi impose",
      steps: [
        {
          temps: "3'",
          type: "objectif",
          titre:
            "Objectif du module : en sortant, vous décrivez ce qu'une IA générative fait bien, et vous savez, AVANT chaque usage, où vont les informations que vous lui donnez et ce que vous n'avez pas le droit de lui confier",
        },
        {
          temps: "10'",
          type: "demonstration",
          titre:
            "Comment ça marche sans jargon, et pourquoi elle a l'air sûre d'elle quand elle invente — démonstration avant / après sur l'outil unique de la journée, les deux demandes affichées en entier à l'écran",
        },
        {
          temps: "12'",
          type: "cadre",
          titre:
            "Les trois régimes d'usage : compte grand public, offre entreprise avec engagement de non-réutilisation, environnement validé par votre entreprise — et les trois questions à poser pour savoir dans lequel vous êtes (grille fournie au formateur)",
        },
        {
          temps: "10'",
          type: "cadre",
          titre:
            "Ce qui ne sort jamais : la liste écrite, et pourquoi retirer le nom ne rend pas un document anonyme — démonstration de ré-identification à partir d'un compte rendu « anonymisé » préparé (pseudonymiser reste un traitement de données personnelles)",
        },
        {
          temps: "12'",
          type: "cadre",
          titre:
            "Ce que le règlement européen sur l'IA change pour vous : l'obligation faite à l'employeur de vous former, les usages interdits au travail (dont la reconnaissance des émotions des salariés), les usages classés à haut risque que cette journée n'autorise pas — trier des candidatures, noter ou surveiller des collègues — et l'obligation d'indiquer un contenu généré par IA. Trame de 6 diapositives fournie, aucune expertise juridique requise du formateur",
        },
        {
          temps: "8'",
          type: "demonstration",
          titre:
            "Le biais, vu en direct : la même demande rejouée en changeant UN SEUL mot (le prénom, le quartier, l'âge) et la réponse qui change de camp — les deux demandes et les deux réponses affichées en entier, côte à côte",
        },
        {
          temps: "40'",
          type: "pratique",
          titre:
            "Pratique chronométrée : chacun fait produire un texte sur son propre domaine, surligne ce qui est faux, le compte, redemande à l'IA de justifier chaque affirmation ; puis rejoue sa demande en changeant un seul mot et note ce qui bascule dans la réponse",
        },
        {
          temps: "10'",
          type: "verification",
          titre:
            "Vérification corrigée en salle : douze situations réelles à classer « ça part / ça ne part pas / ça ne part qu'en environnement validé » — jeu de cartes fourni avec le corrigé",
        },
        {
          temps: "5'",
          type: "synthese",
          titre:
            "Vos acquis : nommer le régime d'usage de mon poste · repérer une affirmation inventée et la faire justifier · appliquer la liste de ce qui ne sort jamais",
        },
        { temps: "15'", type: "pause", titre: "Pause" },
      ],
    },
    {
      titreFr:
        "Matin — Module 2 : Formuler et relancer jusqu'au résultat utilisable (méthode AXION)",
      steps: [
        {
          temps: "3'",
          type: "objectif",
          titre:
            "Objectif du module : en sortant, vous obtenez au premier ou au deuxième essai un texte que vous pouvez envoyer après relecture",
        },
        {
          temps: "15'",
          type: "demonstration",
          titre:
            "Les cinq leviers AXION — Acteur, conteXte, Intention, Output, Normes — démontrés avant / après sur un besoin apporté par la salle : la demande spontanée, puis la demande outillée, toutes deux affichées en entier",
        },
        {
          temps: "8'",
          type: "demonstration",
          titre:
            "Relancer plutôt que recommencer : les quatre relances qui débloquent — préciser la contrainte, donner un exemple de sortie attendue, imposer le format, faire critiquer sa propre réponse — les quatre formulations affichées en entier",
        },
        {
          temps: "40'",
          type: "pratique",
          titre:
            "Pratique chronométrée n°1 : chacun écrit sa demande AXION sur une tâche réelle de son poste, la lance, la relance deux fois avec deux relances différentes, conserve la version qui marche et note en une ligne ce qui l'a débloquée",
        },
        {
          temps: "20'",
          type: "pratique",
          titre:
            "Pratique chronométrée n°2, sans accompagnement au tableau : même méthode sur une seconde tâche, en autonomie — le formateur circule et ne répond qu'aux blocages",
        },
        {
          temps: "12'",
          type: "verification",
          titre:
            "Vérification croisée en binôme : le voisin rejoue votre demande telle qu'elle est écrite — obtient-il un résultat comparable, et les cinq leviers y sont-ils tous présents ? Chacun coche la grille des cinq leviers sur la demande de l'autre",
        },
        {
          temps: "5'",
          type: "synthese",
          titre:
            "Vos acquis : structurer une demande en cinq leviers · choisir la relance qui débloque plutôt que tout réécrire · reconnaître une demande qui ne marchera jamais",
        },
      ],
    },
    {
      titreFr:
        "Après-midi — Module 3 : Travailler sur ses documents, dicter, vérifier contre la source",
      steps: [
        {
          temps: "3'",
          type: "objectif",
          titre:
            "Objectif du module : en sortant, vous déposez un document dans l'outil, vous en tirez une synthèse que vous savez vérifier ligne à ligne, et vous produisez une note propre à partir d'une dictée",
        },
        {
          temps: "8'",
          type: "cadre",
          titre:
            "Avant de déposer quoi que ce soit : quels documents ont le droit d'entrer selon le régime d'usage identifié ce matin — relecture de la liste « ce qui ne sort jamais », appliquée cette fois aux pièces jointes, aux photos d'écran et aux exports de tableur",
        },
        {
          temps: "12'",
          type: "demonstration",
          titre:
            "Démonstration avant / après : le même document long résumé par une demande vague puis par une demande AXION, les deux affichées en entier — et les trois cas où le dépôt échoue en silence (scan sans texte reconnu, fichier trop lourd tronqué sans le dire, tableau qui se désaligne)",
        },
        {
          temps: "30'",
          type: "pratique",
          titre:
            "Pratique chronométrée : chacun dépose un document autorisé de son poste, en tire une synthèse, puis pose trois questions précises au document et note les réponses",
        },
        {
          temps: "20'",
          type: "pratique",
          titre:
            "Pratique chronométrée : dictée depuis le téléphone — deux minutes de dictée, transformation en note propre, puis second passage sur un compte rendu de réunion ; chacun repart avec deux notes produites sans clavier",
        },
        {
          temps: "15'",
          type: "verification",
          titre:
            "Vérification corrigée en salle : sur la synthèse du voisin, retrouver dans le document source chaque affirmation — combien tiennent, lesquelles ont été ajoutées par l'outil ; report du décompte sur la grille remise",
        },
        {
          temps: "5'",
          type: "synthese",
          titre:
            "Vos acquis : déposer un document autorisé et l'interroger · vérifier une synthèse contre sa source avant de la transmettre · produire un écrit à partir d'une dictée",
        },
        { temps: "15'", type: "pause", titre: "Pause" },
      ],
    },
    {
      titreFr:
        "Après-midi — Module 4 : Ce qui sort de vos mains — mon protocole de vérification et de diffusion",
      steps: [
        {
          temps: "3'",
          type: "objectif",
          titre:
            "Objectif du module : en sortant, vous disposez d'un protocole écrit, propre à votre poste, qui dit ce que vous confiez à l'IA et ce que vous vérifiez avant d'envoyer",
        },
        {
          temps: "8'",
          type: "demonstration",
          titre:
            "Démonstration avant / après : la même production relue « à l'œil » puis passée à la grille en cinq points (exactitude, ton, format, source, réutilisable tel quel) — les deux relectures affichées en entier ; ce qu'on indique au destinataire quand un écrit a été produit avec l'IA, et le principe qui tranche : l'IA prépare, l'humain décide et signe",
        },
        {
          temps: "30'",
          type: "pratique",
          titre:
            "Pratique chronométrée : chacun remplit son protocole de poste sur la trame fournie — son régime d'usage, sa liste « ce qui ne sort jamais » écrite sur ses propres dossiers, sa grille de relecture en cinq points calibrée sur ce qu'il a produit aujourd'hui, la mention au destinataire",
        },
        {
          temps: "12'",
          type: "verification",
          titre:
            "Évaluation des acquis : quiz individuel de 12 questions, corrigé en salle question par question",
        },
        {
          temps: "11'",
          type: "verification",
          titre:
            "Vérification par la production : chacun relit une de ses productions du jour à SA propre grille, note les points corrigés, et le voisin contrôle que la grille a bien été appliquée",
        },
        {
          temps: "15'",
          type: "pratique",
          titre:
            "Feuille de route écrite dans le protocole : les trois usages que je relance cette semaine et à quel moment, ce que je ne ferai pas, à qui je pose mes questions quand je bloque",
        },
        {
          temps: "5'",
          type: "synthese",
          titre:
            "Vos acquis : écrire ce que je confie à l'IA et ce que je ne lui confie pas · relire une production à une grille avant de l'envoyer · relancer trois usages seul dès lundi — et remise du protocole de poste",
        },
      ],
    },
  ],
  faqs: [
    {
      question: "Quelle différence avec la version condensée de 4 heures ?",
      reponse:
        "Le contenu essentiel est le même, mais la journée complète ajoute autant de pratique que de théorie : chaque participant travaille sur ses propres tâches en atelier guidé, approfondit les techniques de fiabilisation et découvre le traitement de documents et l'automatisation légère.",
    },
    {
      question: "Faut-il avoir déjà utilisé l'IA ?",
      reponse:
        "Non, aucun prérequis. La formation accueille aussi bien des débutants complets que des collaborateurs qui utilisent déjà l'IA sans méthode — chacun progresse sur ses propres cas.",
    },
    {
      question: "Présentiel ou distanciel ?",
      reponse:
        "Au choix : dans vos locaux, ou entièrement à distance, avec exactement le même contenu et le même niveau d'interactivité.",
    },
  ],
};

const IA_POUR_LES_EQUIPES: FormationV2 = {
  id: "ia-pour-les-equipes",
  slugFr: "ia-pour-les-equipes",
  slugEn: "ai-for-teams",
  numero: 3,
  gamme: "ia-standard",
  categorie: "generale",
  duree: "1j",
  featured: true,
  titreFr: "IA pour les équipes",
  accrocheFr:
    "Et si vos équipes gagnaient du temps chaque jour ? Gagner du temps au quotidien grâce à l'IA",
  h1Fr: "Formation IA pour les équipes : gagner du temps au quotidien",
  metaTitleFr: "Formation IA pour les équipes — 1 jour",
  metaDescriptionFr:
    "Formation IA en entreprise, 1 jour : transformer des usages dispersés en pratique commune — rédaction, synthèse, prompts réutilisables. 1 900 € HT par groupe.",
  termesSemantiquesFr: [
    "formation IA équipe",
    "gagner du temps IA",
    "pratique IA commune",
    "prompts réutilisables",
    "formation IA entreprise 1 jour",
    "productivité IA",
  ],
  publicViseFr:
    "Collaborateurs de tous services qui utilisent déjà l'IA, mais chacun à sa façon, avec des résultats inégaux. Cette journée transforme des usages dispersés en une pratique commune, efficace et partagée — sur les vraies tâches de votre entreprise.",
  casUsageFr: [
    { texteFr: "Des techniques avancées pour obtenir exactement ce qu'on attend de l'IA" },
    { texteFr: "La rédaction, la synthèse et la recherche accélérées" },
    { texteFr: "Des prompts réutilisables, construits pendant la formation" },
    { texteFr: "Des ateliers sur les tâches réelles apportées par les participants" },
  ],
  objectifsFr: [
    "Formuler des demandes structurées avancées (méthode AXION) adaptées à ses tâches",
    "Accélérer la rédaction, la synthèse et la recherche d'informations à l'aide de l'IA",
    "Construire et réutiliser des prompts sur ses tâches récurrentes",
    "Vérifier et fiabiliser une production avant diffusion",
    "Appliquer les règles de confidentialité",
  ],
  beneficeDirigeantFr:
    "Une équipe qui partage les mêmes bons réflexes et gagne un temps mesurable sur ses tâches récurrentes — au lieu d'un usage au cas par cas, dépendant de la personne.",
  equationTempsFr:
    "1 journée → un compte-rendu de réunion mis au propre en quelques minutes plutôt qu'en fin de journée.",
  avantApresFr: {
    avant: "Un usage de l'IA au cas par cas, dépendant de la personne.",
    apres:
      "Une équipe qui partage les mêmes bons réflexes et gagne un temps mesurable sur ses tâches récurrentes.",
  },
  programme: [
    {
      titreFr: "Matin — Module 1 : le cadre commun avant de toucher à quoi que ce soit",
      steps: [
        {
          temps: "5'",
          type: "objectif",
          titre:
            "Ce que vous saurez faire à midi : nommer le régime d'usage de chacun de vos documents, appliquer la liste commune de l'équipe, et dire ce qui doit être signalé au destinataire",
        },
        {
          temps: "20'",
          type: "cadre",
          titre:
            "Où passent vos données : les trois régimes d'usage (compte grand public, offre entreprise avec engagement de non-réutilisation, environnement validé par votre informatique) — et pourquoi retirer un nom ne rend pas un document anonyme : ré-identification montrée en direct sur le fichier de suivi fourni",
        },
        {
          temps: "15'",
          type: "cadre",
          titre:
            "Les limites à connaître avant d'ouvrir l'outil : le biais montré en direct (un seul mot changé dans la demande, le résultat bascule — les deux demandes affichées en entier) ; ce que le règlement européen sur l'IA impose de signaler au destinataire et ce qui relève de la règle interne ; et ce qui reste une décision humaine",
        },
        {
          temps: "15'",
          type: "demonstration",
          titre:
            "Avant / après sur un cas apporté par la salle : la demande vague puis la demande travaillée, les deux affichées en entier, sur l'outil unique tenu toute la journée",
        },
        {
          temps: "15'",
          type: "pratique",
          titre:
            "Chacun réalise une tâche récurrente de sa semaine comme d'habitude, sans IA, en notant son temps et ses allers-retours — repère personnel de comparaison, gardé par le participant, jamais remis au client (l'écart mesuré peut être nul, c'est une information utile)",
        },
        {
          temps: "25'",
          type: "verification",
          titre:
            "Arbitrage collectif des dix situations fournies, tranchées une par une : ce qui peut sortir, ce qui ne sort qu'en régime entreprise, ce qui ne sort jamais — la liste de l'équipe est écrite au tableau et entre au livrable",
        },
        {
          temps: "5'",
          type: "synthese",
          titre:
            "Vos acquis : je nomme le régime d'usage de chacun de mes documents · j'applique la liste commune du service · je repère une demande qui introduit un biais",
        },
        { temps: "15'", type: "pause", titre: "Pause" },
      ],
    },
    {
      titreFr: "Matin — Module 2 : AXION poussé — contrainte, exemple de sortie, format imposé",
      steps: [
        {
          temps: "3'",
          type: "objectif",
          titre:
            "En sortant de ce module, vous obtenez un résultat au format exact attendu, sans passer dix minutes à le retoucher",
        },
        {
          temps: "15'",
          type: "demonstration",
          titre:
            "Les cinq leviers AXION — Acteur, conteXte, Intention, Output, Normes — poussés : contrainte chiffrée, exemple de sortie fourni, format imposé, critères de refus. Avant / après, les deux demandes affichées en entier, même outil",
        },
        {
          temps: "35'",
          type: "pratique",
          titre:
            "Chacun refait la tâche chronométrée du module 1 avec une demande AXION complète, et la retouche jusqu'à obtenir le format exact attendu — puis conserve la version qui marche",
        },
        {
          temps: "20'",
          type: "pratique",
          titre:
            "Deuxième tour : ajouter les critères de refus, faire critiquer la sortie par l'outil lui-même, puis corriger soi-même ce que la critique a laissé passer",
        },
        {
          temps: "17'",
          type: "verification",
          titre:
            "Contrôle croisé en binôme : le voisin rejoue votre demande sur son propre cas, sans le contexte de son auteur — ce qui ne tient pas est réécrit sur place. C'est le test d'une demande vraiment transmissible",
        },
        {
          temps: "5'",
          type: "synthese",
          titre:
            "Vos acquis : imposer un format · fournir un exemple de sortie · reconnaître une demande qui ne se transmet pas à un collègue",
        },
      ],
    },
    {
      titreFr: "Après-midi — Module 3 : passer d'un cas à toute une série",
      steps: [
        {
          temps: "3'",
          type: "objectif",
          titre:
            "En sortant de ce module, vous produisez une série de documents homogènes à partir d'un tableau, au lieu de les écrire un par un — et vous savez la contrôler",
        },
        {
          temps: "15'",
          type: "demonstration",
          titre:
            "Avant / après : le même document écrit une fois à la main, puis quinze fois à partir du tableau fourni — demande de série affichée en entier, et ce qui casse quand la série grandit",
        },
        {
          temps: "30'",
          type: "pratique",
          titre:
            "Chaque binôme produit une série de quinze documents à partir du tableau fourni (ou du sien s'il ne contient aucune donnée personnelle), en partant de la demande AXION de série pré-écrite du guide d'animation",
        },
        {
          temps: "22'",
          type: "pratique",
          titre:
            "Tableur assisté : les trois exercices fournis avec leur corrigé — faire écrire une formule, faire expliquer un croisement, décrire une structure de données — sans jamais coller les données elles-mêmes",
        },
        {
          temps: "25'",
          type: "verification",
          titre:
            "Contrôle par échantillon : trois exemplaires tirés au hasard (même format, mêmes mentions obligatoires), puis une erreur est glissée dans la série du binôme voisin — l'échantillon la retrouve-t-il ?",
        },
        {
          temps: "5'",
          type: "synthese",
          titre:
            "Vos acquis : produire une série homogène · contrôler par échantillon · repérer l'erreur qui se duplique quinze fois",
        },
        { temps: "15'", type: "pause", titre: "Pause" },
      ],
    },
    {
      titreFr: "Après-midi — Module 4 : écrire le mode d'emploi commun et la suite",
      steps: [
        {
          temps: "3'",
          type: "objectif",
          titre:
            "En sortant, le service dispose d'un mode d'emploi écrit que chacun a validé, et sait qui relit quoi",
        },
        {
          temps: "12'",
          type: "demonstration",
          titre:
            "Avant / après : la même demande envoyée seule, puis accompagnée des documents de référence du service et des consignes communes — les deux sorties comparées à l'écran, demandes affichées en entier",
        },
        {
          temps: "10'",
          type: "cadre",
          titre:
            "Les quatre points de contrôle avant qu'un document parte : tout chiffre, tout nom propre, toute date, tout engagement pris au nom de l'entreprise — et qui tranche quand il y a doute",
        },
        {
          temps: "35'",
          type: "pratique",
          titre:
            "L'équipe rédige son mode d'emploi commun : la liste « ce qui ne sort jamais » du matin, les trois demandes AXION éprouvées par un autre que leur auteur, la procédure de série et son contrôle par échantillon, et le tableau « qui relit quoi, qui tranche »",
        },
        {
          temps: "15'",
          type: "verification",
          titre:
            "Évaluation des acquis : quiz individuel de 10 questions corrigé en salle, puis relecture croisée d'une production du jour à la grille commune (exactitude, ton, format, réutilisable par un collègue)",
        },
        {
          temps: "15'",
          type: "pratique",
          titre:
            "Feuille de route inscrite au mode d'emploi : les trois usages que l'équipe tient la semaine prochaine, ce qu'elle ne fera pas, qui relance, et ce qui remonte à la direction",
        },
        {
          temps: "5'",
          type: "synthese",
          titre:
            "Vos acquis : appliquer la règle commune écrite · faire relire par la bonne personne · relancer un usage sans attendre une nouvelle formation",
        },
      ],
    },
  ],
  faqs: [
    {
      question: "Nos équipes utilisent déjà l'IA — que va leur apporter cette journée ?",
      reponse:
        "C'est précisément le public visé : des usages existent, mais dispersés et inégaux. La journée installe une pratique commune — mêmes méthodes, mêmes réflexes de fiabilité, prompts partagés — et chacun repart avec des gains mesurables sur ses tâches récurrentes.",
    },
    {
      question: "Sur quels outils travaille-t-on ?",
      reponse:
        "Sur les outils que vos équipes utilisent déjà ou que vous envisagez : ChatGPT, Claude, Gemini. La méthode enseignée est valable quel que soit l'outil.",
    },
    {
      question: "Présentiel ou distanciel ?",
      reponse:
        "Au choix : dans vos locaux ou à distance, avec le même contenu. Les ateliers portent dans les deux cas sur les tâches réelles apportées par les participants.",
    },
  ],
};

const IA_POUR_L_AUTOMATISATION: FormationV2 = {
  id: "ia-pour-l-automatisation",
  slugFr: "ia-pour-l-automatisation",
  slugEn: "ai-for-automation",
  numero: 4,
  gamme: "ia-standard",
  categorie: "generale",
  duree: "2j",
  scindable: true,
  featured: true,
  titreFr: "IA pour l'automatisation",
  accrocheFr:
    "Arrêtez de refaire chaque semaine les mêmes tâches à la main — vos premières automatisations concrètes",
  h1Fr: "Formation IA pour l'automatisation : vos premières automatisations concrètes (2 jours)",
  metaTitleFr: "Formation IA automatisation — 2 jours",
  metaDescriptionFr:
    "Formation automatisation IA, 2 jours scindables : repérer les tâches répétitives et bâtir une première automatisation sur un cas réel. 3 600 € HT par groupe.",
  termesSemantiquesFr: [
    "formation automatisation IA",
    "automatiser tâches répétitives",
    "premières automatisations",
    "processus automatisé entreprise",
    "formation IA 2 jours",
    "prototype automatisation",
  ],
  publicViseFr:
    "Référents IA, responsables opérationnels et volontaires motivés. Deux jours pour identifier ce qui vous fait perdre du temps et poser, ensemble, vos premières automatisations sur un cas réel de votre entreprise. Vous ne repartez pas avec une théorie, mais avec une première réalisation.",
  prerequisFr:
    "Aucun prérequis technique poussé. Une pratique régulière des outils bureautiques suffit ; aucune compétence en programmation n'est demandée.",
  casUsageFr: [
    { texteFr: "La capacité à repérer les tâches qui méritent d'être automatisées" },
    { texteFr: "La conception d'un premier processus automatisé simple" },
    { texteFr: "Un panorama des outils compatibles avec votre environnement" },
    { texteFr: "Une première réalisation, construite et testée sur un cas de votre activité" },
  ],
  objectifsFr: [
    "Identifier les tâches répétitives automatisables dans son activité",
    "Concevoir un processus automatisé simple assisté par l'IA",
    "Choisir un outil adapté à son environnement",
    "Construire et tester un premier prototype sur un cas réel",
    "Appliquer les règles de confidentialité et de fiabilité",
  ],
  beneficeDirigeantFr:
    "Une première automatisation en place à la fin des deux jours, et une méthode pour en repérer d'autres — les tâches refaites à la main chaque semaine commencent à disparaître.",
  equationTempsFr:
    "2 jours → une tâche répétée chaque semaine — un rapport à compiler, des données à trier — préparée une fois pour être reproduite ensuite.",
  avantApresFr: {
    avant: "Des tâches répétitives faites manuellement, semaine après semaine.",
    apres: "Une première automatisation en place et une méthode pour en repérer d'autres.",
  },
  materielFr:
    "Ordinateur portable, connexion internet, accès aux outils IA et aux données concernées par les cas pratiques",
  programme: [
    {
      titreFr: "Matin — Jour 1 : ce qu'on peut automatiser, et ce qu'on n'automatise jamais",
      steps: [
        {
          temps: "10'",
          type: "objectif",
          titre:
            "Objectif du matin : à midi, vous savez trier vos tâches répétitives et écarter celles que vous n'avez pas le droit d'automatiser",
        },
        {
          temps: "20'",
          type: "demonstration",
          titre:
            "Démonstration avant/après : la compilation hebdomadaire d'un tableau de suivi, d'abord à la main puis pilotée par l'IA — un seul outil à l'écran, prompt affiché en entier, c'est cet outil et lui seul pour les deux jours",
        },
        {
          temps: "20'",
          type: "cadre",
          titre:
            "Où passent vos données : les trois régimes d'usage (compte grand public, offre entreprise avec engagement de non-réutilisation, environnement validé par votre informatique) et le geste à faire avant de coller quoi que ce soit",
        },
        {
          temps: "20'",
          type: "pratique",
          titre:
            "Pratique : chacun situe le régime dans lequel il travaille réellement aujourd'hui, et écrit ce qu'il faudrait obtenir, de qui, pour passer au régime supérieur",
        },
        { temps: "15'", type: "pause", titre: "Pause" },
        {
          temps: "15'",
          type: "cadre",
          titre:
            "Pseudonymiser n'est pas anonymiser : ré-identification en direct d'un fichier de suivi « anonymisé » fourni dans le kit, et pourquoi un fichier dont on a retiré les noms reste un traitement de données personnelles au sens de l'art. 4(5) du RGPD — et un document sous clause de confidentialité reste confidentiel",
        },
        {
          temps: "20'",
          type: "cadre",
          titre:
            "Le test de qualification en 4 questions et les textes qui le fondent : données personnelles ? effet sur une personne ? décision sans relecture humaine (art. 22 du RGPD) ? suivi de l'activité de salariés (annexe III §4(b) du règlement européen sur l'IA, applicable depuis le 2 août 2026) ? — avec ce que chaque réponse déclenche : information des salariés, consultation du CSE (art. L.2312-8 II 4° du Code du travail), analyse d'impact (art. 35 du RGPD), ou arrêt pur et simple. Grille imprimée fournie",
        },
        {
          temps: "45'",
          type: "pratique",
          titre:
            "Pratique : chacun passe ses propres tâches répétitives au test des 4 questions et remplit la grille, une ligne par tâche, avec la conséquence tirée en clair",
        },
        {
          temps: "35'",
          type: "verification",
          titre:
            "Vérification : chaque table classe en feu vert / feu orange / feu rouge les six automatisations fournies dans le kit, puis justifie ; correction en plénière au corrigé écrit mot pour mot du guide d'animation — le formateur lit le corrigé, il ne tranche rien en direct",
        },
        {
          temps: "10'",
          type: "synthese",
          titre:
            "Synthèse : trois acquis formulés en actions, et remise de la fiche « feu vert / feu orange / feu rouge » qui fait règle pendant les deux jours",
        },
      ],
    },
    {
      titreFr: "Après-midi — Jour 1 : cartographier ses tâches et cadrer son cas",
      steps: [
        {
          temps: "10'",
          type: "objectif",
          titre:
            "Objectif de l'après-midi : sortir avec un cas écrit, cadré, et passé au feu vert du matin",
        },
        {
          temps: "20'",
          type: "demonstration",
          titre:
            "Démonstration avant/après : une fiche de cadrage bâclée (« automatiser le reporting ») puis la même cadrée entrée par entrée — prompt de description du processus affiché en entier, et ce que l'IA produit dans les deux cas",
        },
        {
          temps: "45'",
          type: "pratique",
          titre:
            "Pratique : chacun cartographie les tâches qu'il refait chaque semaine sur la trame fournie (volume, répétition, stabilité des règles, coût de l'erreur) et en retient trois candidates",
        },
        { temps: "15'", type: "pause", titre: "Pause" },
        {
          temps: "15'",
          type: "cadre",
          titre:
            "Avec quoi on va construire : les trois familles d'outils (assistant conversationnel, espace de travail persistant, chaînage entre applications) et la règle des ateliers de demain — on construit avec les deux premières, le chaînage entre applications reste en démonstration et n'est jamais monté en salle",
        },
        {
          temps: "20'",
          type: "pratique",
          titre:
            "Pratique : chacun confronte ses trois candidates à la fiche comparative fournie et retient l'outil de sa journée de demain, ou bascule sur le cas de repli commun pré-monté si aucun de ses cas n'est accessible",
        },
        {
          temps: "50'",
          type: "pratique",
          titre:
            "Pratique : rédiger la fiche de cadrage de son cas — entrée, étapes, sortie attendue, point de relecture humaine, qui relit, régime de données retenu, outil visé, couleur au feu tricolore",
        },
        {
          temps: "25'",
          type: "verification",
          titre:
            "Vérification : passage en binôme avec la grille de faille fournie — donnée personnelle oubliée, contrôle absent, sortie invérifiable, salarié suivi sans le savoir, règle instable ; chaque fiche repart annotée",
        },
        {
          temps: "10'",
          type: "synthese",
          titre:
            "Synthèse de la journée 1, ce que chacun rapporte demain (fichiers, accès, jeux d'entrées) et ce qui se passe si la seconde journée est reportée",
        },
      ],
    },
    {
      titreFr: "Matin — Jour 2 : construire le prototype",
      steps: [
        {
          temps: "10'",
          type: "objectif",
          titre:
            "Objectif du matin : à midi, votre automatisation tourne sur un vrai jeu d'entrées",
        },
        {
          temps: "25'",
          type: "demonstration",
          titre:
            "Démonstration avant/après : la même tâche montée de bout en bout devant la salle — l'instruction qui pilote l'automatisation écrite avec les cinq leviers AXION (Acteur, conteXte, Intention, Output, Normes), prompt affiché en entier, les deux essais ratés montrés et corrigés à l'écran",
        },
        {
          temps: "15'",
          type: "cadre",
          titre:
            "Alimenter l'automatisation : déposer un fichier, coller un export, photographier un document — et les trois raisons pour lesquelles ça échoue en salle (PDF scanné sans texte reconnu, fichier trop lourd, tableau qui se désaligne à la copie), avec le contournement de chacune",
        },
        {
          temps: "55'",
          type: "pratique",
          titre:
            "Pratique : construction guidée pas à pas du prototype, sur le cas cadré la veille — ou sur le cas de repli commun pré-monté fourni dans le kit pour qui bloque, afin que personne n'immobilise la salle",
        },
        { temps: "15'", type: "pause", titre: "Pause" },
        {
          temps: "45'",
          type: "pratique",
          titre:
            "Pratique : faire tourner son prototype sur trois jeux d'entrées différents, dont un volontairement bancal (ligne vide, date au mauvais format, colonne manquante), et consigner chaque écart dans le journal de tests",
        },
        {
          temps: "30'",
          type: "verification",
          titre:
            "Vérification : chasse à l'erreur — chacun surligne dans sa propre sortie ce qui est faux, inventé ou invérifiable, et compte ; les comptes sont mis en commun au tableau et la salle nomme les trois erreurs les plus fréquentes",
        },
        {
          temps: "15'",
          type: "synthese",
          titre:
            "Synthèse : ce qui a marché du premier coup, ce qui a demandé trois essais, ce qui ne passera jamais et pourquoi",
        },
      ],
    },
    {
      titreFr: "Après-midi — Jour 2 : fiabiliser, mettre en service, décider de la suite",
      steps: [
        {
          temps: "10'",
          type: "objectif",
          titre:
            "Objectif de l'après-midi : rendre votre automatisation reprenable par quelqu'un d'autre que vous",
        },
        {
          temps: "20'",
          type: "demonstration",
          titre:
            "Démonstration avant/après : la même automatisation sans point de relecture — la sortie fausse part au client — puis avec le contrôle qui l'intercepte ; l'instruction de contrôle affichée en entier",
        },
        {
          temps: "40'",
          type: "pratique",
          titre:
            "Pratique : poser les quatre contrôles sur son propre prototype à partir de la grille fournie — le point de relecture humaine, le comportement en cas de sortie anormale, le signal d'alerte, la trace de qui a validé quoi et quand",
        },
        { temps: "15'", type: "pause", titre: "Pause" },
        {
          temps: "35'",
          type: "pratique",
          titre:
            "Pratique : rédiger la fiche d'usage sur la trame fournie (à quoi ça sert, sur quelles données, qui relit, quand on l'arrête) et l'information due — salariés concernés, consultation du CSE au titre de l'art. L.2312-8 II 4° du Code du travail, et obligation de transparence de l'art. 50 du règlement européen sur l'IA, dont la trame rappelle le périmètre exact",
        },
        {
          temps: "25'",
          type: "verification",
          titre:
            "Vérification : test de reprise à blanc — le binôme fait tourner l'automatisation du voisin avec sa seule fiche d'usage, sans son auteur ; toute question posée à l'auteur est notée comme un manque à combler, puis la fiche est contresignée",
        },
        {
          temps: "25'",
          type: "verification",
          titre:
            "Évaluation des acquis : quiz individuel de validation (10 questions) et grille d'auto-évaluation du prototype (contrôle humain, traçabilité, régime de données, reprenabilité, couleur au feu tricolore) ; corrigé commenté en salle",
        },
        {
          temps: "25'",
          type: "pratique",
          titre:
            "Pratique : la feuille de route — chacun classe ses prochaines automatisations au feu tricolore, les met en ordre, nomme un porteur et une échéance pour chacune, et isole ce qui doit remonter à la direction ou au CSE avant d'être lancé",
        },
        {
          temps: "15'",
          type: "synthese",
          titre: "Synthèse des deux jours et remise du dossier d'exploitation",
        },
      ],
    },
  ],
  faqs: [
    {
      question: "Faut-il savoir coder pour participer ?",
      reponse:
        "Non. La formation ne demande aucun prérequis technique poussé : une pratique régulière des outils bureautiques suffit. Les automatisations sont construites de façon guidée, avec des outils accessibles.",
    },
    {
      question: "Peut-on scinder les 2 jours ?",
      reponse:
        "Oui, la formation est scindable en 2 sessions d'une journée — par exemple à une ou deux semaines d'intervalle, ce qui permet de tester entre les deux journées.",
    },
    {
      question: "Repart-on vraiment avec une automatisation qui fonctionne ?",
      reponse:
        "Oui : le jour 2 est consacré à la construction et au test d'un premier prototype sur un cas réel de votre activité. Vous repartez avec cette première réalisation et une méthode pour en repérer et construire d'autres.",
    },
  ],
};

// ============================================================================
// OFFRES PAR MÉTIER (9)
// ============================================================================

const IA_POUR_LES_RH: FormationV2 = {
  id: "ia-pour-les-rh",
  slugFr: "ia-pour-les-rh",
  slugEn: "ai-for-hr",
  numero: 5,
  gamme: "ia-standard",
  categorie: "metier",
  axeLabelFr: "RH",
  duree: "1j",
  titreFr: "IA pour les RH",
  accrocheFr:
    "Rendez du temps à vos RH pour ce qui compte vraiment : l'humain — simplifier le quotidien de toute la fonction",
  h1Fr: "Formation IA pour les RH : simplifier le quotidien de toute la fonction",
  metaTitleFr: "Formation IA pour les RH — 1 jour",
  metaDescriptionFr:
    "Formation IA pour les RH (1 jour, intra) : offres et fiches de poste, tri des candidatures, communication interne, réflexes RGPD. 1 900 € HT par groupe.",
  termesSemantiquesFr: [
    "formation IA RH",
    "IA recrutement",
    "rédaction offre d'emploi IA",
    "tri candidatures IA",
    "RGPD données RH",
    "formation IA ressources humaines",
  ],
  publicViseFr:
    "Chargés et responsables RH, recrutement et administration du personnel. Entre les offres à rédiger, les candidatures à trier et l'administratif qui s'accumule, les équipes RH courent après le temps : cette journée met l'IA au service de leur quotidien, pour alléger les tâches répétitives et se recentrer sur la relation.",
  casUsageFr: [
    { texteFr: "La rédaction d'offres et de fiches de poste en quelques minutes" },
    { texteFr: "Le tri et la présynthèse des candidatures" },
    { texteFr: "Des supports de communication interne prêts plus vite" },
    { texteFr: "Les bons réflexes RGPD sur les données RH" },
  ],
  objectifsFr: [
    "Rédiger offres et fiches de poste à l'aide de l'IA (méthode AXION)",
    "Trier et présynthétiser des candidatures",
    "Produire des supports de communication interne",
    "Appliquer les règles RGPD aux données RH",
    "Vérifier et fiabiliser une production avant diffusion",
  ],
  beneficeDirigeantFr:
    "Un temps RH redirigé vers les entretiens et l'accompagnement : les tâches répétitives sont largement allégées, la fonction se recentre sur l'humain.",
  equationTempsFr:
    "1 journée → une offre d'emploi rédigée en quelques minutes plutôt qu'en une demi-heure.",
  avantApresFr: {
    avant: "Des process RH chronophages, une charge administrative lourde.",
    apres:
      "Un temps redirigé vers les entretiens et l'accompagnement, des tâches répétitives largement allégées.",
  },
  programme: [
    {
      titreFr:
        "Matin · Module 1 — Le cadre avant les CV : ce qu'on a le droit de faire, avec quel outil",
      steps: [
        {
          temps: "10'",
          type: "objectif",
          titre:
            "Accueil, ce que chacun vient chercher (tour de table en une phrase, noté au tableau), et la règle qui tient toute la journée : l'IA prépare, l'humain décide — annonce du dossier de poste que chacun repartira avec",
        },
        {
          temps: "15'",
          type: "cadre",
          titre:
            "Les trois régimes d'usage des données RH (compte grand public, abonnement entreprise avec engagement de non-réutilisation, environnement validé par la DSI) : où passe vraiment un CV, un bulletin de paie, un dossier disciplinaire — et pourquoi retirer le nom ne suffit pas (ré-identification montrée en direct sur un CV du jeu fourni : commune + diplôme + employeur précédent). Pseudonymiser n'est pas anonymiser : le dossier reste une donnée personnelle et reste soumis au RGPD",
        },
        {
          temps: "20'",
          type: "demonstration",
          titre:
            "Démonstration avant/après DE BIAIS, avec UN SEUL outil et les deux prompts affichés en entier à l'écran : le même lot de trois candidatures du jeu fourni, d'abord avec un prompt neutre, puis avec un prompt orienté (« profil dynamique, capable de tenir le rythme, bonne intégration dans une équipe jeune »). Chacun parie par écrit sur le classement AVANT l'affichage, puis on compare les deux sorties ligne à ligne",
        },
        {
          temps: "15'",
          type: "cadre",
          titre:
            "Ce que le droit impose AVANT d'ouvrir un CV, en clair (fiche de synthèse remise, sources datées dans le kit formateur) : le candidat doit être informé préalablement des méthodes et techniques d'aide au recrutement utilisées (L.1221-8) ; le CSE doit être informé préalablement à leur utilisation (L.2312-38) ; on ne demande que ce qui a un lien direct et nécessaire avec l'emploi (L.1221-6) ; les critères de discrimination interdits (L.1132-1 — liste sourcée et datée fournie au formateur, à ne jamais citer de mémoire) et la façon dont un prompt les réintroduit sans le dire ; et la qualification du règlement européen sur l'IA : le tri, le filtrage et l'évaluation de candidatures sont classés à HAUT RISQUE (annexe III, point 4 a), obligations applicables depuis le 2 août 2026 — pourquoi la présynthèse sous grille imposée, sans classement ni score, reste en dehors de ce régime",
        },
        {
          temps: "25'",
          type: "pratique",
          titre:
            "Atelier chronométré en binôme, support fourni : réécrire trois demandes de tri irrecevables (fournies telles quelles : « classe-moi ces CV du meilleur au moins bon », « écarte ceux qui ont eu des trous dans leur parcours », « dis-moi lesquels s'intégreront le mieux ») en demandes défendables — pour chacune, nommer le critère interdit, le régime d'usage retenu et la trace de décision humaine à conserver",
        },
        {
          temps: "15'",
          type: "verification",
          titre:
            "Contrôle croisé : chaque binôme fait valider ses trois réécritures par un autre binôme sur la grille fournie (critère interdit repéré ? information due au candidat et au CSE ? trace de la décision humaine ? classement supprimé ?), puis corrigé projeté et écarts commentés en salle",
        },
        {
          temps: "5'",
          type: "synthese",
          titre:
            "Acquis du module, formulés comme des actions : je nomme le régime d'usage adapté à chaque document RH · je repère un critère interdit dans une demande avant de la lancer · j'informe le candidat et le CSE avant la première utilisation",
        },
        { temps: "15'", type: "pause", titre: "Pause" },
      ],
    },
    {
      titreFr:
        "Matin · Module 2 — Les écrits RH sans donnée personnelle : offres, fiches de poste, communication interne",
      steps: [
        {
          temps: "5'",
          type: "objectif",
          titre:
            "Ce que vous saurez faire en sortant de ce module — produire et décliner un écrit RH publiable — et pourquoi on commence par les écrits qui ne contiennent aucune donnée de candidat",
        },
        {
          temps: "15'",
          type: "demonstration",
          titre:
            "Démonstration avant/après avec UN SEUL outil, prompt affiché en entier : la méthode AXION (Acteur, conteXte, Intention, Output, Normes) appliquée à une offre d'emploi — d'abord la demande spontanée (« rédige une offre pour un comptable »), puis la même demande structurée par les cinq leviers, résultats comparés côte à côte",
        },
        {
          temps: "15'",
          type: "pratique",
          titre:
            "Les trois gestes qui débloquent tout, chacun les fait sur son propre poste, chronométré : déposer une fiche de poste en PDF · dicter deux minutes depuis son téléphone · photographier un tableau ou une note manuscrite. Les trois causes d'échec sont annoncées avant (scan sans texte reconnu, fichier trop lourd, tableau désaligné) et la parade de chacune est fournie",
        },
        {
          temps: "35'",
          type: "pratique",
          titre:
            "Atelier chronométré, au choix selon le quotidien de chacun (les trois consignes sont écrites et remises) : produire l'offre d'un poste réel puis la décliner en trois formats (annonce courte de multidiffusion, message d'approche, publication interne) · OU produire un support d'onboarding · OU produire une trame d'entretien professionnel. Le formateur passe, relance sur les cinq leviers AXION, ne rédige rien à la place",
        },
        {
          temps: "15'",
          type: "verification",
          titre:
            "Contrôle croisé en binôme sur la grille fournie : ce qu'une offre ne doit JAMAIS affirmer sans vérification dans le document source (convention collective applicable, durée de période d'essai, rémunération, avantages, statut cadre) · formulations discriminantes réintroduites par l'outil · ton et promesse. Chaque affirmation non sourcée est barrée, corrigé fourni",
        },
        {
          temps: "5'",
          type: "synthese",
          titre:
            "Acquis du module et premier versement au dossier de poste : je structure une demande d'écrit avec AXION · je fais entrer un document dans l'outil (dépôt, dictée, photo) · je barre toute affirmation que je n'ai pas vérifiée dans un document. Ce qui entre dans le dossier, et sous quel nom de fichier",
        },
      ],
    },
    {
      titreFr:
        "Après-midi · Module 3 — Candidatures et entretiens : présynthétiser, jamais classer",
      steps: [
        {
          temps: "5'",
          type: "objectif",
          titre:
            "Objectif du module : produire une présynthèse de candidature défendable, et savoir prouver après coup que la décision est restée humaine",
        },
        {
          temps: "15'",
          type: "demonstration",
          titre:
            "Démonstration avant/après avec UN SEUL outil, les deux prompts affichés en entier : la même candidature résumée « librement », puis sous une grille imposée — on surligne à l'écran ce que la version libre ajoute, ce qu'elle invente et ce qu'elle hiérarchise de son propre chef (et qui bascule dans le filtrage à haut risque vu au module 1)",
        },
        {
          temps: "15'",
          type: "pratique",
          titre:
            "Chacun construit sa grille de lecture à partir de la SEULE fiche de poste, sur la trame à trous fournie : critères retenus, ordre, formulation exacte, et champs volontairement absents (âge, photo, situation familiale, adresse, nationalité, état de santé, appartenance syndicale) inscrits en en-tête comme interdits",
        },
        {
          temps: "30'",
          type: "pratique",
          titre:
            "Atelier chronométré : présynthétiser les trois candidatures du jeu fourni sous SA propre grille, dans le régime d'usage conforme retenu au module 1 (aucun document réel de candidat n'est déposé), puis rédiger la réponse au candidat non retenu à partir de la trame fournie — le meilleur rapport gain/risque du métier : volume massif, aucune donnée sensible en jeu",
        },
        {
          temps: "20'",
          type: "pratique",
          titre:
            "Atelier chronométré sur trames PRÉ-RÉDIGÉES ET DATÉES, où seuls les champs variables sont à compléter (raison sociale, poste, outil utilisé, finalité, destinataire, durée de conservation, contact) : la mention d'information des candidats (L.1221-8) et la note d'information au CSE (L.2312-38). L'en-tête « Projet — à faire valider par votre conseil avant diffusion » reste apparent et n'est pas retirable. Le formateur n'arbitre aucune question juridique : la formule à employer est « je ne me prononce pas, notez la question, votre conseil tranchera »",
        },
        {
          temps: "15'",
          type: "verification",
          titre:
            "Contrôle croisé en binôme, grille fournie : repérer dans les productions de l'autre les informations sans lien direct avec l'emploi, les affirmations non vérifiables, tout reste de classement ou de score, et l'absence de trace de relecture humaine. Corrigé fourni, écarts relevés à l'oral",
        },
        {
          temps: "5'",
          type: "synthese",
          titre:
            "Acquis du module, formulés comme des actions : je présynthétise sous une grille que j'ai posée · je réponds à un candidat non retenu sans le formuler moi-même à chaque fois · je fais informer candidats et CSE avant la première utilisation",
        },
        { temps: "15'", type: "pause", titre: "Pause" },
      ],
    },
    {
      titreFr: "Après-midi · Module 4 — Droit social, fiabilité et ancrage",
      steps: [
        {
          temps: "5'",
          type: "objectif",
          titre:
            "Objectif du module : savoir à quel moment l'IA vous ment dans votre propre domaine — et repartir avec un dossier utilisable dès demain",
        },
        {
          temps: "10'",
          type: "demonstration",
          titre:
            "Démonstration avant/après avec UN SEUL outil, les deux prompts affichés en entier : la même question de droit social posée sans rien fournir (« quelle est la durée de préavis pour un cadre dans ma convention collective ? »), puis posée en fournissant à l'outil l'extrait de texte ouvert par le formateur — ce que la réponse gagne, et ce qu'elle cesse d'inventer",
        },
        {
          temps: "20'",
          type: "pratique",
          titre:
            "Chasse à l'erreur chronométrée, document fourni : une réponse de droit social produite par l'IA (convention collective, période d'essai, préavis, congés) contenant des erreurs plantées — chacun surligne ce qu'il croit faux, on compte les repérages à main levée, la salle corrige, corrigé détaillé fourni avec la source de chaque point",
        },
        {
          temps: "10'",
          type: "pratique",
          titre:
            "En binôme : écrire la règle qui en découle en une phrase applicable dans son propre service (l'IA n'est jamais la source d'une réponse de droit social : elle reformule un texte que vous lui fournissez, et vous citez la source que vous avez ouverte), plus la formule de refus à tenir devant un collègue : « je ne me prononce pas ». Les deux phrases sont lues à voix haute et versées au dossier",
        },
        {
          temps: "20'",
          type: "pratique",
          titre:
            "Assembler et nommer LE DOSSIER DE POSTE DÉFENDABLE : y ranger la fiche de poste, la grille de lecture avec ses champs interdits en en-tête, les trames d'écrits validées, la mention candidat, la note CSE, la règle de droit social — puis ouvrir le journal de relecture humaine (une ligne par production : qui a relu, quand, ce qui a été modifié) et le partager à la personne qui le tiendra à jour",
        },
        {
          temps: "15'",
          type: "verification",
          titre:
            "Évaluation des acquis : quiz individuel de validation (10 questions, corrigé en salle question par question) + auto-évaluation par chacun d'une production réelle du jour sur la grille de relecture (exactitude des affirmations, informations interdites, mentions dues, ton, réutilisabilité)",
        },
        {
          temps: "10'",
          type: "synthese",
          titre:
            "Acquis-actions et feuille de route : j'ouvre un dossier de poste AVANT toute utilisation de l'IA sur un recrutement · je fais informer le CSE avant la première utilisation · je consigne chaque relecture humaine au journal. Chacun nomme les trois usages qu'il installe la semaine suivante, qui les tient, et à quelle date la mention candidat et la note CSE partent chez le conseil",
        },
      ],
    },
  ],
  faqs: [
    {
      question: "L'IA va-t-elle décider à la place des RH ?",
      reponse:
        "Non, et c'est une règle posée dès le premier module : l'IA prépare (rédaction, tri préliminaire, synthèses), l'humain décide. Aucune décision de recrutement ou d'évaluation n'est déléguée à l'IA.",
    },
    {
      question: "Comment sont protégées les données des candidats et des salariés ?",
      reponse:
        "Un module entier est consacré aux règles RGPD appliquées aux données RH : ce qu'on ne soumet jamais à une IA, comment anonymiser, et comment travailler efficacement malgré ces contraintes.",
    },
    {
      question: "Faut-il déjà utiliser l'IA pour participer ?",
      reponse:
        "Non, aucun prérequis. La journée s'adresse à toute la fonction RH, du débutant complet à l'utilisateur occasionnel qui veut des méthodes fiables.",
    },
  ],
};

const IA_POUR_LE_MARKETING: FormationV2 = {
  id: "ia-pour-le-marketing",
  slugFr: "ia-pour-le-marketing",
  slugEn: "ai-for-marketing",
  numero: 6,
  gamme: "ia-standard",
  categorie: "metier",
  axeLabelFr: "Marketing / Communication",
  duree: "1j",
  titreFr: "IA pour le marketing",
  accrocheFr:
    "Produisez plus de contenu, sans épuiser vos équipes — gagner en efficacité sur l'ensemble des missions",
  h1Fr: "Formation IA pour le marketing : gagner en efficacité sur l'ensemble des missions",
  metaTitleFr: "Formation IA pour le marketing — 1 jour",
  metaDescriptionFr:
    "Formation IA marketing (1 jour, intra) : génération de contenus, déclinaison multi-formats, analyse de campagnes, veille concurrentielle. 1 900 € HT par groupe.",
  termesSemantiquesFr: [
    "formation IA marketing",
    "génération de contenu IA",
    "IA communication",
    "déclinaison multi-formats",
    "analyse campagne IA",
    "veille concurrentielle IA",
  ],
  publicViseFr:
    "Chargés et responsables marketing, communication et contenu. La pression du contenu ne redescend jamais — posts, newsletters, campagnes : cette journée donne à l'équipe les moyens de produire plus vite, en interne, sans sacrifier la qualité ni exploser le budget.",
  casUsageFr: [
    { texteFr: "La génération de contenus : posts, newsletters, visuels" },
    { texteFr: "La déclinaison d'un message sur tous les formats" },
    { texteFr: "L'analyse de campagnes assistée par l'IA" },
    { texteFr: "Une veille concurrentielle plus rapide" },
  ],
  objectifsFr: [
    "Générer des contenus (posts, newsletters, visuels) à l'aide de l'IA",
    "Décliner un message sur plusieurs formats",
    "Analyser des résultats de campagne avec l'appui de l'IA",
    "Mener une veille concurrentielle assistée",
    "Vérifier et fiabiliser une production avant diffusion",
  ],
  beneficeDirigeantFr:
    "Une production de contenu interne accélérée et plus de campagnes testées à budget constant — sans dépendre systématiquement de prestataires.",
  equationTempsFr:
    "1 journée → une série de posts déclinée en quelques minutes à partir d'une seule idée de départ.",
  avantApresFr: {
    avant: "Une production de contenu lente, souvent dépendante de prestataires.",
    apres: "Une production interne accélérée et plus de campagnes testées à budget constant.",
  },
  programme: [
    {
      titreFr: "Matin — Le cadre, la voix de la marque, et le trimestre planifié",
      steps: [
        {
          temps: "10'",
          type: "objectif",
          titre:
            "Module 1 · Ouverture et résultat visé : chacun nomme ce qu'il produit chaque semaine (posts, newsletters, pages) et ce qu'il veut avoir en main ce soir — un dossier de marque écrit et douze semaines planifiées. Règle du jour posée : l'IA fait le premier jet, la marque reste la vôtre.",
        },
        {
          temps: "20'",
          type: "cadre",
          titre:
            "Module 1 · Les trois régimes d'usage — compte grand public, offre entreprise avec engagement de non-réutilisation, environnement validé : où passent un brief, un fichier client, un plan de lancement sous embargo. Démonstration de ré-identification menée par le formateur sur le jeu de contacts fictif du kit : retirer le nom ne rend pas le fichier anonyme, le code postal, la tranche d'âge et la fonction suffisent à retrouver la personne — pseudonymiser n'est pas anonymiser, et le fichier reste soumis au RGPD.",
        },
        {
          temps: "15'",
          type: "cadre",
          titre:
            "Module 1 · Ce qu'on n'a pas le droit de publier, posé AVANT de produire : faux avis et faux témoignages de consommateurs (code de la consommation, art. L.121-4), allégations invérifiables et allégations environnementales, mention due sur un contenu généré diffusé au public (règlement (UE) 2024/1689 sur l'IA, art. 50), consentement préalable avant une newsletter adressée à des particuliers (code des postes et des communications électroniques, art. L.34-5). Fiche récapitulative d'une page remise au kit.",
        },
        {
          temps: "15'",
          type: "demonstration",
          titre:
            "Module 1 · Démonstration avant / après, UN SEUL outil, prompt affiché en entier à l'écran : le même post écrit sans contexte, puis avec la méthode AXION — Acteur, conteXte, Intention, Output, Normes. On lit les deux résultats à voix haute et la salle dit ce qui a changé.",
        },
        {
          temps: "30'",
          type: "pratique",
          titre:
            "Module 1 · Atelier chronométré : constituer le dossier de marque sur la trame fournie — ton (trois adjectifs et trois contre-exemples), cibles et personas, interdits de langage, trois exemples de contenus déjà validés — puis le tester immédiatement en relançant une publication réelle avec ce dossier en contexte. Le formateur anime la trame, la salle apporte la voix.",
        },
        {
          temps: "10'",
          type: "verification",
          titre:
            "Module 1 · Contrôle croisé en binôme sur la grille fournie : le post produit tient-il le ton déclaré, la promesse est-elle vérifiable, la mention de contenu généré est-elle due ? Puis chaque binôme relance le même brief avec le persona du voisin et relève qui a disparu du texte — c'est le biais du brief, avant celui de l'outil.",
        },
        {
          temps: "5'",
          type: "synthese",
          titre:
            "Module 1 · Acquis, formulés en actions : je sais où je dépose et ce que je ne dépose jamais · je sais ce que je ne peux pas publier et ce que je dois mentionner · j'ai un dossier de marque écrit que je peux rouvrir lundi.",
        },
        { temps: "15'", type: "pause", titre: "Pause café" },
        {
          temps: "5'",
          type: "objectif",
          titre:
            "Module 2 · Objectif : passer d'un message unique à une série cohérente, et ne plus repartir de zéro chaque lundi.",
        },
        {
          temps: "15'",
          type: "demonstration",
          titre:
            "Module 2 · Démonstration avant / après, UN SEUL outil, prompt affiché en entier : déposer un brief en PDF et une fiche produit (et ce qui fait échouer le dépôt — scan sans texte reconnu, tableau qui se désaligne), puis décliner une idée en publication courte, newsletter, script vidéo et communiqué — en nommant ce qui se dégrade à chaque déclinaison.",
        },
        {
          temps: "30'",
          type: "pratique",
          titre:
            "Module 2 · Atelier chronométré 1 : chacun décline un message réel de l'entreprise sur trois formats, en repartant de son dossier de marque et non d'une consigne nue.",
        },
        {
          temps: "25'",
          type: "pratique",
          titre:
            "Module 2 · Atelier chronométré 2 : construire le calendrier éditorial du trimestre à partir du tableau de sujets fourni — douze semaines, un sujet et un format par semaine, et le nom de la personne qui tient chaque ligne.",
        },
        {
          temps: "10'",
          type: "verification",
          titre:
            "Module 2 · Contrôle croisé en binôme, grille fournie : respect du dossier de marque, promesse vérifiable, appel à l'action présent, mention de contenu généré si elle est due, et calendrier réellement tenable au vu des effectifs annoncés.",
        },
        {
          temps: "5'",
          type: "synthese",
          titre:
            "Module 2 · Acquis en actions et versement au livrable : je décline sans réécrire · je planifie mon trimestre en une séance — ce qui entre dès maintenant dans le dossier de marque.",
        },
      ],
    },
    {
      titreFr: "Après-midi — Image, résultats, visibilité de la marque, et ce qu'on diffuse",
      steps: [
        {
          temps: "5'",
          type: "objectif",
          titre:
            "Module 3 · Objectif : trois usages très attendus, trois périmètres honnêtes — et savoir dire à sa direction ce que l'IA ne fera pas.",
        },
        {
          temps: "10'",
          type: "cadre",
          titre:
            "Module 3 · Le cadre de l'image, posé avant d'en regarder une seule : à qui appartient ce qu'un outil produit selon ses conditions d'utilisation, ce qu'on ne fait jamais avec le visage ou la voix d'une personne identifiable (droit à l'image, code civil art. 9), et l'obligation de signaler une image ou une vidéo générée diffusée au public (règlement (UE) 2024/1689, art. 50).",
        },
        {
          temps: "10'",
          type: "demonstration",
          titre:
            "Module 3 · Revue commentée des quatre visuels pré-produits fournis dans le kit — aucun compte à ouvrir, aucun outil d'image à installer : ce qui tient (illustration d'ambiance, déclinaison de gabarit, recadrage, texte alternatif) et ce qui rate systématiquement (le texte dans l'image, la charte, le logo, le visuel de marque). Le périmètre est annoncé tel quel, sans promesse de génération de visuels.",
        },
        {
          temps: "10'",
          type: "demonstration",
          titre:
            "Module 3 · Résultats de campagne, démonstration avant / après, UN SEUL outil, prompt affiché en entier : l'IA commente, elle ne calcule pas. On décrit la structure de son tableau sans jamais coller l'export, on saisit à la main les quatre valeurs à commenter, et on montre ce qui se passe quand on lui demande un total.",
        },
        {
          temps: "30'",
          type: "pratique",
          titre:
            "Module 3 · Atelier chronométré : chacun rédige le commentaire de sa dernière campagne à partir de ses propres chiffres saisis à la main, puis fait proposer trois hypothèses de test à budget constant et tranche celle qu'il retient.",
        },
        {
          temps: "25'",
          type: "pratique",
          titre:
            "Module 3 · Atelier chronométré : vérifier en direct comment sa marque est décrite par un assistant IA, avec les trois questions fournies (qui est cette entreprise, que vend-elle, à qui la recommanderiez-vous), relever les erreurs et lister ce qui se corrige sur ses propres pages ; puis dégrossir une veille sur deux concurrents et marquer d'une croix tout ce qui reste à vérifier à la source.",
        },
        {
          temps: "10'",
          type: "verification",
          titre:
            "Module 3 · Contrôle croisé en binôme, grille fournie : aucun chiffre calculé par l'outil ne subsiste dans le commentaire, aucune donnée client n'a été déposée, chaque affirmation de veille porte la mention vérifiée ou à vérifier.",
        },
        {
          temps: "5'",
          type: "synthese",
          titre:
            "Module 3 · Acquis en actions : je connais le périmètre réel de l'image et je ne le survends pas · je commente un résultat sans exposer mes données · je sais comment ma marque est reprise et ce que je corrige sur mon site.",
        },
        { temps: "15'", type: "pause", titre: "Pause café" },
        {
          temps: "5'",
          type: "objectif",
          titre:
            "Module 4 · Objectif : ne plus rien diffuser sans savoir ce qui a été vérifié, et par qui.",
        },
        {
          temps: "5'",
          type: "demonstration",
          titre:
            "Module 4 · Micro-démonstration avant / après, UN SEUL outil, prompt affiché en entier : le même paragraphe sur votre marché produit sans contrainte, puis avec l'obligation de citer ses sources — et ce que devient le texte quand on exige la source.",
        },
        {
          temps: "25'",
          type: "pratique",
          titre:
            "Module 4 · Chasse à l'erreur chronométrée : on fait produire un texte sur le marché des participants, chacun surligne ce qui est faux ou invérifiable, on compte à voix haute — puis la salle en tire les quatre contrôles de sa propre grille de relecture avant diffusion.",
        },
        {
          temps: "10'",
          type: "cadre",
          titre:
            "Module 4 · Droits et mentions, en cinq réponses fournies au kit : ce qu'on peut réutiliser d'un texte trouvé en ligne, la citation d'un client et l'accord écrit qu'elle suppose, la propriété de ce que l'outil produit, la mention due sur un contenu généré diffusé au public, et le consentement préalable avant d'écrire à un fichier de particuliers.",
        },
        {
          temps: "10'",
          type: "pratique",
          titre:
            "Module 4 · Application immédiate : douze cas de diffusion fournis dans le kit (un avis client repris, une photo trouvée en ligne, un témoignage reformulé, une newsletter à un fichier acheté…) — chacun classe en « je publie » / « je publie avec mention » / « je ne publie pas », correction en salle avec le corrigé du formateur.",
        },
        {
          temps: "15'",
          type: "pratique",
          titre:
            "Module 4 · Montage du livrable : assembler en un document unique, daté et nominatif le dossier de marque, le calendrier du trimestre, les trames de déclinaison et la grille de relecture — et désigner qui le tient à jour et à quelle date il est revu.",
        },
        {
          temps: "15'",
          type: "verification",
          titre:
            "Module 4 · Évaluation des acquis : quiz individuel de validation (10 questions, corrigé en salle) puis auto-évaluation d'une production du jour sur la grille de relecture construite par la salle.",
        },
        {
          temps: "5'",
          type: "synthese",
          titre:
            "Module 4 · Feuille de route contenu, en actions : trois usages installés dès la semaine suivante, un responsable nommé par usage, une date de revue du calendrier éditorial.",
        },
      ],
    },
  ],
  faqs: [
    {
      question: "Le contenu généré ne va-t-il pas ressembler à celui de tout le monde ?",
      reponse:
        "C'est tout l'objet de la journée : on apprend à faire produire des contenus dans votre ton de marque, à partir de vos messages et de vos cibles — puis à les retravailler. L'IA accélère le premier jet ; la voix reste la vôtre.",
    },
    {
      question: "Travaille-t-on sur nos vraies campagnes ?",
      reponse:
        "Oui : les ateliers portent sur des messages et campagnes réels apportés par les participants — vous repartez avec des contenus et des trames directement réutilisables.",
    },
    {
      question: "Présentiel ou distanciel ?",
      reponse:
        "Au choix : dans vos locaux ou à distance, avec le même contenu et les mêmes ateliers pratiques.",
    },
  ],
};

const IA_POUR_LES_COMMERCIAUX: FormationV2 = {
  id: "ia-pour-les-commerciaux",
  slugFr: "ia-pour-les-commerciaux",
  slugEn: "ai-for-sales",
  numero: 7,
  gamme: "ia-standard",
  categorie: "metier",
  axeLabelFr: "Commercial / Vente",
  duree: "1j",
  titreFr: "IA pour les commerciaux",
  accrocheFr:
    "Plus de temps pour vendre, moins pour l'administratif — vendre plus, sur tous les fronts",
  h1Fr: "Formation IA pour les commerciaux : vendre plus, sur tous les fronts",
  metaTitleFr: "Formation IA pour les commerciaux — 1 jour",
  metaDescriptionFr:
    "Formation IA commerciale (1 jour, intra) : préparation de rendez-vous, propositions percutantes, relances, qualification de prospects. 1 900 € HT par groupe.",
  termesSemantiquesFr: [
    "formation IA commerciaux",
    "IA vente",
    "proposition commerciale IA",
    "préparation rendez-vous IA",
    "relance client IA",
    "qualification prospects IA",
  ],
  publicViseFr:
    "Commerciaux terrain et sédentaires, responsables commerciaux. Un bon commercial passe trop d'heures à préparer, rédiger et relancer : cette journée met l'IA au service de leur efficacité, pour libérer du temps de terrain et accélérer chaque étape du cycle de vente.",
  casUsageFr: [
    { texteFr: "La préparation de rendez-vous et d'argumentaires en un temps record" },
    { texteFr: "La rédaction de propositions commerciales percutantes" },
    { texteFr: "Des relances et un suivi client mieux tenus" },
    { texteFr: "La qualification de prospects assistée par l'IA" },
  ],
  objectifsFr: [
    "Préparer rendez-vous et argumentaires à l'aide de l'IA",
    "Rédiger des propositions commerciales structurées (méthode AXION)",
    "Rédiger relances et suivis client",
    "Qualifier des prospects avec l'appui de l'IA",
    "Appliquer les règles de confidentialité",
  ],
  beneficeDirigeantFr:
    "Plus d'heures consacrées au terrain et des propositions produites bien plus vite — le temps administratif cesse de grignoter le temps de vente.",
  equationTempsFr:
    "1 journée → une proposition commerciale mise en forme en quelques minutes à partir de vos notes.",
  avantApresFr: {
    avant: "Un temps administratif qui grignote le temps de vente.",
    apres: "Plus d'heures consacrées au terrain, des propositions produites bien plus vite.",
  },
  programme: [
    {
      titreFr:
        "Matin — Le cadre, la préparation du rendez-vous et le compte rendu dicté (modules 1 et 2)",
      steps: [
        {
          temps: "5'",
          type: "objectif",
          titre:
            "Module 1 — Objectif : repartir ce soir avec un kit de rendez-vous monté sur une affaire réelle de votre portefeuille, utilisable dès lundi matin",
        },
        {
          temps: "15'",
          type: "cadre",
          titre:
            "Deux confidentialités à ne pas confondre : le secret des affaires (prix négociés, marges, contrats, fichier client) d'un côté, les données personnelles d'un prospect de l'autre — ce qu'on a le droit de chercher, l'information qu'on lui doit quand on se renseigne sur lui sans le lui avoir demandé, son droit de s'opposer à la prospection sans avoir à se justifier ; et les trois régimes d'usage des outils (compte personnel, compte entreprise, outil intégré au système de l'entreprise)",
        },
        {
          temps: "5'",
          type: "cadre",
          titre:
            "Le règlement européen sur l'IA, côté commercial : dire à un interlocuteur qu'il échange avec une IA, ne jamais envoyer sous sa signature un écrit qu'on n'a pas relu — et la règle qui vaut pour toute la journée : aucun chiffre, aucun nom, aucune référence client n'entre dans un document sortant sans une source que vous avez ouverte vous-même",
        },
        {
          temps: "10'",
          type: "pratique",
          titre:
            "Tri chronométré, corrigé en salle : chacun classe dix éléments de son quotidien — prix négocié, fichier client, marge, contrat-cadre, remise exceptionnelle, notes manuscrites de rendez-vous, adresse mail d'un contact, plaquette publique du prospect, nom du dirigeant, compte rendu interne — en « jamais » / « avec précaution » / « librement », et repart avec sa liste rouge personnelle",
        },
        {
          temps: "20'",
          type: "demonstration",
          titre:
            "Démonstration avant / après, un seul outil, prompts affichés en entier : « parle-moi de cette entreprise », qui invente un dirigeant, un chiffre d'affaires et une actualité, face à une préparation construite à partir des seules sources que vous fournissez ; puis construction en direct du prompt AXION (Acteur, conteXte, Intention, Output, Normes) de préparation de rendez-vous",
        },
        {
          temps: "35'",
          type: "pratique",
          titre:
            "Atelier chronométré : chacun prépare un rendez-vous réel de sa semaine à partir des documents qu'il apporte — fiche de préparation, plan de découverte en questions ouvertes, hypothèses d'enjeux, liste de ce qui reste à vérifier (pièce 1 du kit)",
        },
        {
          temps: "10'",
          type: "verification",
          titre:
            "Contrôle croisé en binôme, grille fournie : on barre toute affirmation dont la source n'a pas été ouverte, on compte les lignes barrées, on identifie celles que l'IA a purement inventées",
        },
        { temps: "5'", type: "synthese", titre: "Acquis du module, formulés en trois actions" },
        { temps: "15'", type: "pause", titre: "Pause" },
        {
          temps: "5'",
          type: "objectif",
          titre:
            "Module 2 — Objectif : sortir du rendez-vous avec le compte rendu, le mail de suivi et les prochaines étapes déjà écrits",
        },
        {
          temps: "10'",
          type: "demonstration",
          titre:
            "Démonstration, un seul outil, prompt affiché en entier : trois minutes dictées depuis un téléphone dans la voiture → compte rendu structuré, mail de suivi au client, prochaines étapes datées ; et les trois raisons qui font échouer une dictée (bruit ambiant, noms propres, chiffres)",
        },
        {
          temps: "30'",
          type: "pratique",
          titre:
            "Atelier chronométré : chacun dicte le compte rendu d'un rendez-vous récent, produit les trois sorties, les corrige, puis rédige la relance à J+7 (pièce 2 du kit)",
        },
        {
          temps: "10'",
          type: "cadre",
          titre:
            "Qualifier sans profiler, et voir le biais à l'œuvre : bâtir des critères tirés du besoin et de l'affaire, jamais de la personne ; démonstration en direct du biais de sélection — deux jeux de critères appliqués au même pipeline produisent deux classements différents, donc deux tournées différentes et deux affaires perdues",
        },
        {
          temps: "20'",
          type: "pratique",
          titre:
            "Atelier chronométré : trier son pipeline de la semaine selon ses propres critères, puis écrire les relances correspondantes",
        },
        {
          temps: "10'",
          type: "verification",
          titre:
            "Contrôle croisé en binôme sur le tri : tout critère qui décrit la personne et non l'affaire est retiré et remplacé, puis on vérifie de combien de rangs le classement a bougé",
        },
        {
          temps: "5'",
          type: "synthese",
          titre: "Acquis du module en actions, et versement des pièces 1 et 2 au kit",
        },
      ],
    },
    {
      titreFr: "Après-midi — Objections, proposition commerciale et fiabilité (modules 3 et 4)",
      steps: [
        {
          temps: "5'",
          type: "objectif",
          titre:
            "Module 3 — Objectif : s'entraîner face à l'objection avant de la subir chez le client, et écrire une proposition qui ne promet rien d'intenable",
        },
        {
          temps: "20'",
          type: "demonstration",
          titre:
            "Démonstration, un seul outil, prompts affichés en entier : l'IA tient le rôle de l'acheteur difficile, puis relit votre proposition avec ses yeux — ce qu'elle fait bien, et le moment précis où elle devient complaisante et vous félicite au lieu de vous contredire",
        },
        {
          temps: "30'",
          type: "pratique",
          titre:
            "Atelier chronométré en binôme, trame de jeu de rôle fournie : l'IA joue l'acheteur, chacun traite trois objections récurrentes de son marché (le prix, le délai, le concurrent déjà en place) et rédige sa réponse type (pièce 3 du kit)",
        },
        {
          temps: "5'",
          type: "cadre",
          titre:
            "Ce qu'on ne chiffre jamais avec l'IA : remise, délai d'exécution, pénalité, engagement de résultat — et les mentions qui restent contractuelles et se recopient depuis vos conditions de vente, jamais depuis un modèle proposé par l'outil",
        },
        {
          temps: "5'",
          type: "demonstration",
          titre:
            "Démonstration, un seul outil, trame et prompt affichés en entier : de vos notes à une proposition — structure du document, et angle selon l'interlocuteur (décideur, technique, achat)",
        },
        {
          temps: "30'",
          type: "pratique",
          titre:
            "Atelier chronométré : rédaction d'une proposition commerciale sur l'affaire réelle en cours travaillée le matin (pièce 4 du kit)",
        },
        {
          temps: "10'",
          type: "verification",
          titre:
            "Contrôle croisé en binôme, grille fournie : promesse tenable, aucun chiffre inventé, mentions contractuelles présentes, prochaine étape claire et datée",
        },
        { temps: "5'", type: "synthese", titre: "Acquis du module, formulés en trois actions" },
        { temps: "15'", type: "pause", titre: "Pause" },
        {
          temps: "5'",
          type: "objectif",
          titre:
            "Module 4 — Objectif : repérer soi-même, sur son propre marché, le moment où l'IA se trompe avec aplomb",
        },
        {
          temps: "5'",
          type: "demonstration",
          titre:
            "Démonstration, un seul outil, prompt affiché en entier : vérifier une affirmation en trente secondes — où l'on ouvre la source, ce qu'on garde, ce qu'on barre",
        },
        {
          temps: "25'",
          type: "pratique",
          titre:
            "Chasse à l'erreur chronométrée : une fiche prospect et un argumentaire produits par l'IA sur le secteur des participants (jeu de documents fourni au formateur) — chacun surligne ce qui est faux, on compte, la salle corrige et dit pourquoi c'est faux",
        },
        {
          temps: "20'",
          type: "pratique",
          titre:
            "Atelier : monter sa grille de relecture avant envoi à partir des erreurs que l'on vient de relever, puis la passer sur la proposition écrite en début d'après-midi et corriger ce qu'elle fait remonter (pièce 5 du kit — kit complété)",
        },
        {
          temps: "15'",
          type: "verification",
          titre:
            "Évaluation des acquis : quiz individuel de validation (10 questions) corrigé en salle, puis auto-évaluation d'une production du jour sur la grille de relecture",
        },
        {
          temps: "10'",
          type: "pratique",
          titre:
            "Feuille de route individuelle : trois usages à installer dès lundi, sur quelles affaires nommées, et ce que l'on regarde au bout d'un mois",
        },
        {
          temps: "5'",
          type: "synthese",
          titre: "Acquis de la journée en trois actions, et remise du kit de rendez-vous complet",
        },
      ],
    },
  ],
  faqs: [
    {
      question: "Est-ce adapté aux commerciaux terrain, pas très « outils » ?",
      reponse:
        "Oui : aucun prérequis technique, et les cas travaillés sont ceux du quotidien commercial — préparation de rendez-vous, propositions, relances. Chaque participant travaille sur ses propres affaires en cours.",
    },
    {
      question: "Nos données clients sont-elles en sécurité ?",
      reponse:
        "Un module est consacré à la confidentialité : données clients nominatives, prix négociés et contrats ne sont jamais soumis à l'IA. On apprend à travailler efficacement dans ce cadre.",
    },
    {
      question: "Peut-on former ensemble commerciaux sédentaires et terrain ?",
      reponse:
        "Oui, c'est même recommandé : les techniques sont communes et les ateliers s'adaptent aux cas de chacun — prospection, rendez-vous, propositions ou suivi.",
    },
  ],
};

const IA_POUR_LA_FINANCE: FormationV2 = {
  id: "ia-pour-la-finance",
  slugFr: "ia-pour-la-finance",
  slugEn: "ai-for-finance",
  numero: 8,
  gamme: "ia-standard",
  categorie: "metier",
  axeLabelFr: "Finance / Comptabilité",
  duree: "1j",
  titreFr: "IA pour la finance",
  accrocheFr:
    "Des chiffres plus fiables, produits plus vite — fiabiliser et accélérer le quotidien",
  h1Fr: "Formation IA pour la finance : fiabiliser et accélérer le quotidien",
  metaTitleFr: "Formation IA pour la finance — 1 jour",
  metaDescriptionFr:
    "Formation IA finance, 1 jour : analyse de documents financiers, rapprochements simples, rapports et tableaux de bord assistés par l'IA. 1 900 € HT par groupe.",
  termesSemantiquesFr: [
    "formation IA finance",
    "IA comptabilité",
    "analyse documents financiers IA",
    "reporting financier IA",
    "tableaux de bord IA",
    "contrôle de gestion IA",
  ],
  publicViseFr:
    "Comptables, contrôleurs de gestion, responsables administratifs et financiers. Analyses, contrôles, rapports : la finance manipule des volumes qui laissent peu de place à l'erreur et beaucoup de place à la lenteur — cette journée montre comment l'IA sécurise et accélère les tâches à faible valeur ajoutée.",
  casUsageFr: [
    { texteFr: "L'analyse et la synthèse de documents financiers" },
    { texteFr: "L'automatisation de rapprochements simples" },
    { texteFr: "L'aide à la rédaction de rapports et tableaux de bord" },
    { texteFr: "Des contrôles et vérifications assistés par l'IA" },
  ],
  objectifsFr: [
    "Analyser et synthétiser des documents financiers à l'aide de l'IA",
    "Automatiser des rapprochements simples",
    "Produire rapports et tableaux de bord assistés",
    "Contrôler et vérifier une production avant diffusion",
    "Appliquer les règles de confidentialité aux données financières",
  ],
  beneficeDirigeantFr:
    "Des contrôles plus rapides, des rapports produits plus vite et moins d'erreurs de saisie — la fonction finance gagne en fiabilité en gagnant du temps.",
  equationTempsFr:
    "1 journée → la synthèse d'un rapport de plusieurs pages ramenée à l'essentiel en quelques minutes.",
  avantApresFr: {
    avant: "Un traitement manuel de gros volumes, un risque d'erreur permanent.",
    apres:
      "Des contrôles plus rapides, des rapports produits plus vite, moins d'erreurs de saisie.",
  },
  programme: [
    {
      titreFr: "Matin — Le partage des rôles, puis le tableur assisté et les trames de contrôle",
      steps: [
        {
          temps: "10'",
          type: "objectif",
          titre:
            "Module 1 · Accueil et résultat attendu de la journée : ce soir, chacun sait déposer un document financier long et en tirer une synthèse fiable, obtenir une formule de tableur sans livrer ses données, et écrire autour du chiffre — les chiffres, eux, restent dans vos systèmes (comptabilité, ERP, tableur)",
        },
        {
          temps: "15'",
          type: "cadre",
          titre:
            "Module 1 · Les trois régimes d'usage et la liste rouge du service : fichier des écritures (FEC), balance nominative, salaires, coordonnées bancaires — et pourquoi retirer les noms ne suffit pas : démonstration de ré-identification d'un état de frais « anonymisé » (pseudonymiser n'est pas anonymiser)",
        },
        {
          temps: "10'",
          type: "cadre",
          titre:
            "Module 1 · Deux limites posées AVANT le premier atelier : un écart repéré ne désigne jamais une personne — c'est une décision individuelle automatisée au sens de l'art. 22 du RGPD, elle suppose l'information préalable des salariés et la consultation du comité social et économique, et elle reproduit les biais de l'historique qui l'alimente ; noter la solvabilité d'une personne physique est un usage à haut risque au sens de l'annexe III du règlement européen sur l'IA (règlement (UE) 2024/1689)",
        },
        {
          temps: "15'",
          type: "demonstration",
          titre:
            "Module 1 · Démonstration avant/après : la même demande d'analyse d'un document financier, d'abord sans cadre, puis avec la méthode AXION — Acteur, conteXte, Intention, Output, Normes — prompt affiché en entier à l'écran, un seul outil",
        },
        {
          temps: "15'",
          type: "pratique",
          titre:
            "Module 1 · Faites-la se tromper, chronométré : chacun demande à l'outil de lettrer deux extraits, de recalculer un total et de prévoir un atterrissage à partir des trois lignes fournies au kit — on relève les erreurs produites, on en tire la ligne de partage écrite au tableau",
        },
        {
          temps: "30'",
          type: "pratique",
          titre:
            "Module 1 · Atelier chronométré : chacun dépose un document financier long (rapport, liasse, note d'un commissaire aux comptes, contrat de prêt) après l'avoir qualifié dans son régime d'usage, et en tire une synthèse structurée plus trois questions à poser à son émetteur",
        },
        {
          temps: "10'",
          type: "verification",
          titre:
            "Module 1 · Contrôle croisé en binôme, grille fournie : le régime d'usage retenu était-il le bon, quelle affirmation de la synthèse n'est pas dans le document source, quel chiffre a été repris sans vérification",
        },
        {
          temps: "5'",
          type: "synthese",
          titre:
            "Module 1 · Acquis : je qualifie un document avant de l'ouvrir dans un outil · je sais ce que l'IA ne calculera pas · je synthétise un document long et je sais ce que je dois vérifier derrière",
        },
        { temps: "15'", type: "pause", titre: "Pause" },
        {
          temps: "5'",
          type: "objectif",
          titre:
            "Module 2 · Résultat attendu : obtenir une formule ou un croisement de tableur en décrivant seulement la structure de ses colonnes — les données ne sortent jamais du fichier",
        },
        {
          temps: "15'",
          type: "demonstration",
          titre:
            "Module 2 · Démonstration avant/après : une formule, un croisement et une mise en forme conditionnelle obtenus en décrivant uniquement les en-têtes de colonnes ; puis l'explication en clair d'une formule héritée que plus personne ne comprend — prompts affichés en entier",
        },
        {
          temps: "35'",
          type: "pratique",
          titre:
            "Module 2 · Atelier chronométré : chacun apporte un besoin de tableur réel (structure des colonnes seule, aucune donnée) et repart avec sa formule, son croisement ou sa procédure, testés sur le fichier et documentés en français dans le classeur",
        },
        {
          temps: "5'",
          type: "demonstration",
          titre:
            "Module 2 · Une trame de contrôle plutôt qu'un rapprochement : lecture commentée de la trame de clôture fournie au kit — l'IA écrit la liste des points à vérifier, c'est l'humain qui coche et qui signe",
        },
        {
          temps: "15'",
          type: "pratique",
          titre:
            "Module 2 · Atelier chronométré : produire sa propre trame de contrôle sur un processus réel (clôture, cut-off, état de frais), en recopiant en tête de trame la borne posée le matin — un écart signalé ne désigne jamais une personne",
        },
        {
          temps: "5'",
          type: "verification",
          titre:
            "Module 2 · Contrôle croisé en binôme : la trame de l'autre est-elle cochable par quelqu'un qui n'a pas assisté à la clôture, et sa borne est-elle bien écrite en tête",
        },
        {
          temps: "5'",
          type: "synthese",
          titre:
            "Module 2 · Acquis et versement au classeur : je décris une structure sans livrer de données · je fais expliquer une formule héritée · je produis une trame de contrôle que quelqu'un d'autre peut dérouler",
        },
      ],
    },
    {
      titreFr: "Après-midi — Écrire autour du chiffre, puis fiabilité et ancrage",
      steps: [
        {
          temps: "5'",
          type: "objectif",
          titre:
            "Module 3 · Résultat attendu : faire dire à ses indicateurs déjà calculés ce qu'ils veulent dire, pour le bon lecteur — direction, opérationnels, banque, associé",
        },
        {
          temps: "10'",
          type: "demonstration",
          titre:
            "Module 3 · Démonstration avant/après : d'un tableau de bord déjà calculé au commentaire de gestion, puis le même commentaire reformulé pour un second niveau de lecture — prompt affiché en entier",
        },
        {
          temps: "35'",
          type: "pratique",
          titre:
            "Module 3 · Atelier chronométré : chacun rédige le commentaire de son dernier reporting à partir de ses propres chiffres, saisis à la main dans le prompt, structure décrite — puis produit la version destinée à un second lecteur",
        },
        {
          temps: "10'",
          type: "cadre",
          titre:
            "Module 3 · Ce qu'on n'écrit jamais : les mentions dues d'une relance d'impayé (pénalités de retard, indemnité forfaitaire de recouvrement) que l'IA oublie ou invente et qu'on reprend de la trame du kit ; et l'interdiction de motiver une décision de crédit ou un encours client par un score produit par l'IA — rappel de l'annexe III du règlement européen sur l'IA",
        },
        {
          temps: "5'",
          type: "demonstration",
          titre:
            "Module 3 · Les trois écrits qui rapportent, trames fournies au kit : relance graduée à trois niveaux, note de synthèse au dirigeant, réponse à une demande du commissaire aux comptes — ce que chaque trame impose et ce qu'elle interdit",
        },
        {
          temps: "30'",
          type: "pratique",
          titre:
            "Module 3 · Atelier chronométré : chacun produit soit sa séquence de relance d'impayé à trois niveaux, soit sa note de synthèse au dirigeant, à partir de la trame fournie et de son propre dossier",
        },
        {
          temps: "10'",
          type: "verification",
          titre:
            "Module 3 · Contrôle croisé en binôme, grille fournie : aucun chiffre non vérifié, ton conforme au niveau de relance, mentions dues présentes, destinataire et niveau de lecture cohérents",
        },
        {
          temps: "5'",
          type: "synthese",
          titre:
            "Module 3 · Acquis et versement au classeur : j'écris le commentaire de mes indicateurs · j'adapte le niveau de lecture · je dispose d'une séquence de relance prête à l'emploi",
        },
        { temps: "15'", type: "pause", titre: "Pause" },
        {
          temps: "5'",
          type: "objectif",
          titre:
            "Module 4 · Résultat attendu : repérer seul, sans aide, le moment où l'IA se trompe sur un chiffre — et savoir quoi faire à ce moment-là",
        },
        {
          temps: "5'",
          type: "demonstration",
          titre:
            "Module 4 · Démonstration avant/après : le même calcul demandé deux fois de suite, deux réponses différentes — et le geste de relecture qui l'attrape en dix secondes",
        },
        {
          temps: "25'",
          type: "pratique",
          titre:
            "Module 4 · Chasse à l'erreur chronométrée, corrigé fourni au kit : une note financière et un calcul produits par l'IA contenant quatre erreurs de chiffre et deux affirmations non sourcées — chacun surligne, on compte, on compare au corrigé, on en tire la règle de relecture du service",
        },
        {
          temps: "30'",
          type: "pratique",
          titre:
            "Module 4 · Atelier chronométré : monter son classeur de clôture assistée — trames de contrôle, formules documentées, trame de commentaire, séquence de relance, liste rouge du service, glossaire maison — rangé et nommé pour être rouvert à la prochaine clôture",
        },
        {
          temps: "15'",
          type: "verification",
          titre:
            "Module 4 · Évaluation des acquis : quiz individuel de validation (10 questions) corrigé en salle, puis auto-évaluation d'une production du jour sur la grille de relecture du classeur",
        },
        {
          temps: "5'",
          type: "synthese",
          titre:
            "Module 4 · Feuille de route : trois usages à installer avant la prochaine clôture, qui les tient, et ce qu'on vérifie au bout d'un mois",
        },
      ],
    },
  ],
  faqs: [
    {
      question: "L'IA va-t-elle manipuler nos chiffres ?",
      reponse:
        "Non : les chiffres restent dans vos systèmes (ERP, comptabilité, tableur). L'IA travaille sur tout ce qui les entoure — analyses, synthèses, commentaires, contrôles — et tout chiffre produit est vérifié par un humain avant diffusion.",
    },
    {
      question: "Comment est traitée la confidentialité des données financières ?",
      reponse:
        "C'est un fil rouge de la journée : données financières sensibles et informations nominatives ne sont jamais soumises à l'IA. On travaille sur des données factices ou anonymisées pendant les ateliers.",
    },
    {
      question: "Est-ce adapté à un service comptable de PME ?",
      reponse:
        "Oui : la journée s'adresse aussi bien aux services comptables et financiers internes de PME qu'aux équipes de contrôle de gestion — les ateliers portent sur vos documents et rapports réels.",
    },
  ],
};

const IA_POUR_LE_JURIDIQUE: FormationV2 = {
  id: "ia-pour-le-juridique",
  slugFr: "ia-pour-le-juridique",
  slugEn: "ai-for-legal",
  numero: 9,
  gamme: "ia-standard",
  categorie: "metier",
  axeLabelFr: "Juridique",
  duree: "1j",
  titreFr: "IA pour le juridique",
  accrocheFr:
    "Traitez vos dossiers plus vite, sans rien laisser passer — sécuriser et accélérer le traitement des dossiers",
  h1Fr: "Formation IA pour le juridique : sécuriser et accélérer le traitement des dossiers",
  metaTitleFr: "Formation IA pour le juridique — 1 jour",
  metaDescriptionFr:
    "Formation IA juridique (1 jour, intra) : synthèse de contrats, repérage de clauses à risque, documents types, veille réglementaire. 1 900 € HT par groupe.",
  termesSemantiquesFr: [
    "formation IA juridique",
    "analyse contrat IA",
    "clauses à risque IA",
    "IA juriste entreprise",
    "veille réglementaire IA",
    "synthèse contrat IA",
  ],
  publicViseFr:
    "Juristes, responsables administratifs et dirigeants qui gèrent le juridique. Relire un contrat, repérer une clause à risque, rédiger un courrier type : autant de tâches précises et chronophages — cette journée montre comment l'IA fait gagner du temps tout en renforçant la vigilance sur les points sensibles.",
  casUsageFr: [
    { texteFr: "L'analyse et la synthèse de contrats" },
    { texteFr: "Le repérage de clauses à risque" },
    { texteFr: "La rédaction de courriers et de documents types" },
    { texteFr: "Une veille réglementaire assistée (sans remplacer le conseil juridique)" },
  ],
  objectifsFr: [
    "Synthétiser un contrat à l'aide de l'IA",
    "Repérer des clauses à risque pour préparer sa relecture",
    "Rédiger courriers et documents types",
    "Mener une veille réglementaire assistée",
    "Appliquer les règles de confidentialité (sans substituer le conseil juridique)",
  ],
  beneficeDirigeantFr:
    "Des dossiers traités plus vite et des points de vigilance repérés plus tôt — la rigueur juridique reste humaine, mais elle est mieux outillée.",
  equationTempsFr:
    "1 journée → la synthèse d'un contrat de plusieurs pages obtenue en quelques minutes pour préparer sa relecture.",
  avantApresFr: {
    avant: "Une relecture et une rédaction chronophages, des risques parfois mal identifiés.",
    apres: "Des dossiers traités plus vite, des points de vigilance repérés plus tôt.",
  },
  programme: [
    {
      titreFr: "Matin · Module 1 — Ce qu'on a le droit de soumettre, et à quel outil",
      steps: [
        {
          temps: "5'",
          type: "objectif",
          titre:
            "Objectif du module : qualifier tout document AVANT de l'ouvrir dans un outil, et savoir dire non",
        },
        {
          temps: "10'",
          type: "cadre",
          titre:
            "La règle du métier et la formule de refus assumée (« cette question relève du conseil, je ne la traite pas avec l'outil ») ; les trois régimes d'usage : compte grand public, offre entreprise avec engagement contractuel de non-réutilisation, environnement validé par votre DSI",
        },
        {
          temps: "20'",
          type: "cadre",
          titre:
            "Deux verrous à ne pas confondre : (1) les données personnelles — pseudonymiser n'est pas anonymiser, démonstration de ré-identification à partir de trois champs d'un contrat ; (2) la clause de confidentialité, que l'anonymisation ne lève PAS — l'éditeur de l'outil reste un tiers tant qu'aucun engagement contractuel ne le lie",
        },
        {
          temps: "15'",
          type: "demonstration",
          titre:
            "Avant / après sur un texte que vous fournissez : la même demande sans cadre, puis avec la méthode AXION — Acteur, conteXte, Intention, Output, Normes — prompt affiché en entier, un seul outil",
        },
        {
          temps: "15'",
          type: "pratique",
          titre:
            "Atelier éclair chronométré sur extraits fournis : dans les conditions d'utilisation de trois outils, surligner les quatre clauses qui décident du régime d'usage (réutilisation des contenus, sous-traitance de données, localisation, durée de conservation) et conclure le régime de chacun",
        },
        {
          temps: "25'",
          type: "pratique",
          titre:
            "Atelier chronométré en binôme, grille de qualification fournie : classer cinq documents du quotidien (NDA reçu, CGV, contrat client, courrier de mise en demeure, note interne) en soumissible tel quel / soumissible après traitement / jamais soumissible, et justifier chaque réponse par écrit",
        },
        {
          temps: "10'",
          type: "verification",
          titre:
            "Contrôle croisé entre binômes sur le corrigé fourni : les cinq qualifications attendues, leur justification, et les deux pièges du jeu (le NDA qui interdit la communication à tout tiers, la note interne nominative)",
        },
        {
          temps: "5'",
          type: "synthese",
          titre:
            "Acquis du module en trois actions : je qualifie avant d'ouvrir · je lis des conditions d'utilisation comme un contrat · je sais ce que l'anonymisation ne règle pas",
        },
        { temps: "15'", type: "pause", titre: "Pause — 15 minutes" },
      ],
    },
    {
      titreFr: "Matin · Module 2 — Lire et synthétiser un contrat sous sa propre grille",
      steps: [
        {
          temps: "5'",
          type: "objectif",
          titre:
            "Objectif du module : produire une synthèse de contrat qui PRÉPARE votre relecture, jamais qui la remplace",
        },
        {
          temps: "10'",
          type: "demonstration",
          titre:
            "Déposer un fichier : contrat scanné, PDF de cent pages, annexes et pièces jointes — les trois causes d'échec du dépôt (scan sans texte reconnu, document tronqué en silence, tableau désaligné) et comment les traiter — un seul outil",
        },
        {
          temps: "15'",
          type: "demonstration",
          titre:
            "Avant / après : synthèse libre face à synthèse sous grille imposée — prompt affiché en entier, un seul outil ; puis la borne écrite sur la comparaison de versions : l'IA oriente la relecture, l'exhaustivité reste au comparateur du traitement de texte",
        },
        {
          temps: "10'",
          type: "cadre",
          titre:
            "Garde-fou posé AVANT l'atelier : ce que l'IA invente et ce vers quoi elle penche — article inexistant, décision plausible mais introuvable, synthèse qui lisse systématiquement en faveur de la partie qui a rédigé ; règle du service : une référence n'existe que si vous l'avez ouverte à la source",
        },
        {
          temps: "15'",
          type: "pratique",
          titre:
            "Chacun construit SA grille de points de vigilance à partir de sa position type — liste de référence fournie à ordonner, pondérer et compléter : responsabilité, clause limitative de responsabilité, résiliation, pénalités, exclusivité, force majeure, prescription, sous-traitance de données",
        },
        {
          temps: "35'",
          type: "pratique",
          titre:
            "Atelier chronométré : chacun applique sa grille à un contrat du jeu fourni — ou à un document dont il maîtrise le régime de confidentialité — et produit la synthèse plus la liste des questions à poser",
        },
        {
          temps: "10'",
          type: "verification",
          titre:
            "Contrôle croisé en binôme sur grille de relecture fournie : clause manquée, affirmation non sourcée, point que la synthèse a lissé, question qui n'a pas été posée",
        },
        {
          temps: "5'",
          type: "synthese",
          titre:
            "Acquis du module en trois actions : j'impose ma grille au lieu de subir la synthèse · je vérifie chaque référence à la source · je renvoie l'exhaustivité au comparateur",
        },
      ],
    },
    {
      titreFr: "Après-midi · Module 3 — Documents types, et ce que la direction va vous demander",
      steps: [
        {
          temps: "5'",
          type: "objectif",
          titre:
            "Objectif du module : produire ce qui se réutilise, et savoir répondre à la question que la direction va poser — « qu'a-t-on le droit de faire avec l'IA ? »",
        },
        {
          temps: "15'",
          type: "cadre",
          titre:
            "Le règlement européen sur l'IA, références en main : obligation de littératie IA des équipes (article 4, applicable depuis février 2025), obligations de transparence sur les contenus générés (article 50), et pourquoi un service juridique d'entreprise ne relève PAS de l'annexe III §8, réservée aux autorités judiciaires — le formateur donne les références et le texte, il n'arbitre pas : la salle qualifie, le service juridique tranche",
        },
        {
          temps: "20'",
          type: "pratique",
          titre:
            "Atelier chronométré : produire un document type réutilisable du quotidien à partir de sa propre trame — mise en demeure, courrier de résiliation, réponse à réclamation, ou réponse à un NDA reçu",
        },
        {
          temps: "10'",
          type: "demonstration",
          titre:
            "Pourquoi on ne fait pas de veille avec un outil généraliste : le même article demandé de mémoire, puis le texte fourni au modèle — l'écart montré à l'écran, les deux prompts affichés en entier, un seul outil",
        },
        {
          temps: "10'",
          type: "pratique",
          titre:
            "Atelier chronométré : interroger et reformuler un texte réglementaire que VOUS fournissez (le seul geste tenable), puis écrire la phrase de refus pour toute demande qui sort de ce cadre",
        },
        {
          temps: "20'",
          type: "pratique",
          titre:
            "Atelier chronométré sur trois articles types PRÉ-RÉDIGÉS et fournis : les adapter au vocabulaire de votre entreprise — ce qui est permis, ce qui est interdit, qui tranche en cas de doute — puis cocher dans la liste fournie ce qu'il reste à faire pour rendre la charte opposable (consultation des représentants du personnel, dépôt, information des salariés) ; le formateur n'arbitre aucune formulation",
        },
        {
          temps: "10'",
          type: "verification",
          titre:
            "Contrôle croisé en binôme sur grille fournie : un article non applicable en l'état, une interdiction non vérifiable, une décision sans décideur nommé, une action d'opposabilité oubliée",
        },
        {
          temps: "5'",
          type: "synthese",
          titre:
            "Acquis du module en trois actions : je produis un document type réutilisable · je ne fais de veille que sur un texte que j'ai fourni · je sais quelles références citer quand la direction demande le fondement",
        },
        { temps: "15'", type: "pause", titre: "Pause — 15 minutes" },
      ],
    },
    {
      titreFr: "Après-midi · Module 4 — Hallucinations, limites, et mise en service",
      steps: [
        {
          temps: "5'",
          type: "objectif",
          titre:
            "Objectif du module : reconnaître une référence inventée AVANT qu'elle ne sorte du service",
        },
        {
          temps: "10'",
          type: "demonstration",
          titre:
            "Comment naît une référence inventée : la même question posée deux fois, avec puis sans le texte fourni — les deux prompts affichés en entier, un seul outil, la variable modifiée surlignée",
        },
        {
          temps: "25'",
          type: "pratique",
          titre:
            "Chasse à l'hallucination juridique, chronométrée : un texte fourni contenant trois références fausses et deux approximations — chacun surligne, on compte, corrigé fourni et discuté",
        },
        {
          temps: "10'",
          type: "verification",
          titre:
            "Correction en salle et règle exercée : chacun réécrit une des cinq erreurs en formulation vérifiable et nomme la source qu'il aurait dû ouvrir — le périmètre du conseil ne se délègue pas, et l'IA n'est jamais l'auteur d'une position du service",
        },
        {
          temps: "15'",
          type: "pratique",
          titre:
            "Atelier chronométré : assembler son dossier de cadrage IA — grille de qualification, grille de vigilance, document type produit, articles de charte adaptés, grille de relecture — et rédiger la note d'une page destinée à la direction",
        },
        {
          temps: "15'",
          type: "verification",
          titre:
            "Évaluation des acquis : quiz individuel de validation (10 questions) corrigé en salle, puis auto-évaluation d'une production du jour sur la grille de relecture",
        },
        {
          temps: "5'",
          type: "synthese",
          titre:
            "Acquis-actions de la journée : trois usages à installer dès la semaine suivante, et les deux sujets à remonter à la direction (régime d'usage à trancher, charte à faire adopter)",
        },
      ],
    },
  ],
  faqs: [
    {
      question: "L'IA peut-elle donner un avis juridique fiable ?",
      reponse:
        "Non, et la formation le pose clairement : l'IA prépare le travail (synthèses, repérage de clauses, premiers jets), mais l'analyse juridique et le conseil restent humains. On apprend aussi à repérer ses erreurs typiques — références inventées, approximations.",
    },
    {
      question: "Peut-on soumettre nos contrats réels à l'IA ?",
      reponse:
        "Les ateliers se font sur des documents anonymisés ou factices. La journée consacre un module entier à la confidentialité : ce qui peut être soumis, ce qui ne le peut jamais, et comment anonymiser efficacement.",
    },
    {
      question: "Est-ce utile sans juriste dédié dans l'entreprise ?",
      reponse:
        "Oui : la formation s'adresse aussi aux responsables administratifs et aux dirigeants qui gèrent le juridique au quotidien — elle aide à traiter plus vite les dossiers courants et à mieux repérer quand consulter un avocat.",
    },
  ],
};

const IA_POUR_LA_PRODUCTION: FormationV2 = {
  id: "ia-pour-la-production",
  slugFr: "ia-pour-la-production",
  slugEn: "ai-for-operations",
  numero: 10,
  gamme: "ia-standard",
  categorie: "metier",
  axeLabelFr: "Production / Opérations",
  duree: "2j",
  scindable: true,
  titreFr: "IA pour la production",
  accrocheFr:
    "Un suivi de production plus fiable, moins de paperasse — optimiser l'ensemble des opérations",
  h1Fr: "Formation IA pour la production : optimiser l'ensemble des opérations (2 jours)",
  metaTitleFr: "Formation IA pour la production — 2 jours",
  metaDescriptionFr:
    "Formation IA production, 2 jours scindables : suivi et reporting, planification, documentation qualité, automatisations de suivi. 3 600 € HT par groupe.",
  termesSemantiquesFr: [
    "formation IA production",
    "IA opérations",
    "reporting production IA",
    "documentation qualité IA",
    "planification IA",
    "automatisation suivi production",
  ],
  publicViseFr:
    "Responsables de production, chefs d'atelier, agents de maîtrise. Le reporting, la planification et la documentation qualité prennent un temps précieux sur le terrain : ces deux jours mettent l'IA au service de vos opérations, jusqu'aux premiers cas d'automatisation.",
  prerequisFr:
    "Aucun prérequis technique poussé. Une pratique régulière des outils bureautiques suffit.",
  casUsageFr: [
    { texteFr: "Le suivi et le reporting de production assistés par l'IA" },
    { texteFr: "L'aide à la planification" },
    { texteFr: "La documentation qualité et des procédures facilitée" },
    { texteFr: "Les premiers cas d'automatisation sur des tâches de suivi ou de contrôle" },
  ],
  objectifsFr: [
    "Produire suivi et reporting de production à l'aide de l'IA",
    "Utiliser l'IA en appui à la planification",
    "Rédiger documentation qualité et procédures",
    "Identifier et prototyper une première automatisation de suivi",
    "Appliquer les règles de confidentialité",
  ],
  beneficeDirigeantFr:
    "Un suivi plus fiable, une documentation tenue à jour plus facilement et des décisions plus rapides — le terrain récupère le temps que prenait la paperasse.",
  equationTempsFr:
    "2 jours → un compte-rendu de production mis en forme en quelques minutes à partir de quelques notes.",
  avantApresFr: {
    avant: "Un reporting manuel, des procédures rarement à jour.",
    apres:
      "Un suivi plus fiable, une documentation tenue à jour plus facilement, des décisions plus rapides.",
  },
  materielFr:
    "Ordinateur portable, connexion internet, accès aux outils IA et aux données de production concernées",
  programme: [
    {
      titreFr:
        "Matin J1 — Le socle : ce qui se pratique à l'atelier, et ce qui ne sort jamais de l'entreprise",
      steps: [
        {
          temps: "10'",
          type: "objectif",
          titre:
            "Objectif du matin : à midi, chacun a écrit la liste rouge de son atelier et produit une consigne de poste qui la respecte — tour de table minuté, chacun nomme l'écrit qu'il veut avoir réglé ce soir",
        },
        {
          temps: "20'",
          type: "cadre",
          titre:
            "Les trois régimes d'usage : compte grand public, offre entreprise avec engagement de non-réutilisation, environnement validé par votre DSI — et le geste « je regarde où passent mes données avant de coller »",
        },
        {
          temps: "15'",
          type: "cadre",
          titre:
            "Ce qui ne sort jamais de l'atelier : plans, prix de revient, données clients, données nominatives de salariés — et pourquoi retirer un nom ne suffit pas : pseudonymiser n'est pas anonymiser, un compte rendu d'équipe reste ré-identifiable",
        },
        {
          temps: "25'",
          type: "pratique",
          titre:
            "Pratique : chacun écrit la liste rouge de SON atelier sur la trame fournie (colonne « jamais » / colonne « à neutraliser » / colonne « libre »), puis confrontation en binôme et arbitrage des cas litigieux en salle",
        },
        { temps: "15'", type: "pause", titre: "Pause" },
        {
          temps: "20'",
          type: "demonstration",
          titre:
            "Démonstration avant / après : un compte rendu de prise de poste rédigé à la main, puis le même avec l'IA — un seul outil, consigne affichée en entier à l'écran, y compris ce qui a raté au premier essai",
        },
        {
          temps: "15'",
          type: "demonstration",
          titre:
            "La méthode AXION en 5 leviers — Acteur, conteXte, Intention, Output, Normes — démontrée levier par levier sur une consigne de poste, consigne affichée en entier",
        },
        {
          temps: "30'",
          type: "pratique",
          titre:
            "Pratique 1 : chacun rédige avec AXION la consigne de poste réelle de son atelier, en respectant sa propre liste rouge",
        },
        {
          temps: "25'",
          type: "pratique",
          titre:
            "Pratique 2 : échange des consignes en binôme, retour sur la grille d'auto-évaluation fournie, puis chacun reprend sa consigne",
        },
        {
          temps: "25'",
          type: "verification",
          titre:
            "Vérification corrigée en salle : 5 questions sur les régimes d'usage et la liste rouge, puis passage de trois consignes produites au vidéoprojecteur avec la grille (destinataire nommé, contexte suffisant, format attendu, contrainte de sécurité)",
        },
        {
          temps: "10'",
          type: "synthese",
          titre:
            "Synthèse : les deux gestes que j'applique dès cet après-midi, écrits sur ma fiche de route personnelle",
        },
      ],
    },
    {
      titreFr: "Après-midi J1 — Les écrits du terrain : compte rendu de poste et mode opératoire",
      steps: [
        {
          temps: "5'",
          type: "objectif",
          titre:
            "Objectif de l'après-midi : à 17 h, chacun a dans son classeur un compte rendu de poste et un mode opératoire de son atelier, produits et relus en séance",
        },
        {
          temps: "20'",
          type: "demonstration",
          titre:
            "Déposer, dicter, photographier — démonstration avant / après : trois minutes dictées après le point de production deviennent un compte rendu, des décisions et des points à relancer (consigne affichée en entier), puis ce qui fait échouer l'exercice : scan sans texte reconnu, photo de tableau désalignée, dictée sans nommer les postes",
        },
        {
          temps: "40'",
          type: "pratique",
          titre:
            "Pratique 1 : chacun dicte son point de production ou sa prise de poste et produit le compte rendu — téléphone accepté, on travaille debout comme au poste",
        },
        {
          temps: "15'",
          type: "verification",
          titre:
            "Vérification corrigée en salle : trois comptes rendus passés à la grille fournie (faits / décisions / à relancer), et repérage collectif de ce que la machine a ajouté et que personne n'a dit",
        },
        { temps: "15'", type: "pause", titre: "Pause" },
        {
          temps: "15'",
          type: "demonstration",
          titre:
            "Démonstration avant / après : du geste raconté au mode opératoire structuré sur une opération d'atelier — trame fournie, consigne affichée en entier",
        },
        {
          temps: "40'",
          type: "pratique",
          titre:
            "Pratique 2 : chacun produit le mode opératoire d'une opération réelle de son atelier à partir de la trame fournie",
        },
        {
          temps: "20'",
          type: "pratique",
          titre:
            "Pratique 3 : relecture croisée en binôme sur la grille fournie (exactitude, ordre des étapes, points de sécurité, réutilisabilité), puis reprise du mode opératoire par son auteur",
        },
        {
          temps: "5'",
          type: "cadre",
          titre:
            "Règle posée avant l'exercice suivant : toute consigne à portée sécurité repart au visa du responsable HSE avant affichage — ce que l'IA prépare, ce qui ne s'affiche jamais sans visa",
        },
        {
          temps: "20'",
          type: "pratique",
          titre:
            "Pratique 4 : traduire et simplifier — chacun reprend sa consigne en langage clair, puis dans la langue parlée par son équipe, et marque l'emplacement du visa HSE",
        },
        {
          temps: "10'",
          type: "verification",
          titre:
            "Vérification corrigée en salle : 5 questions sur les entrées de matière et la règle du visa",
        },
        {
          temps: "5'",
          type: "synthese",
          titre: "Synthèse du jour 1 : les deux écrits que je sais produire seul demain matin",
        },
      ],
    },
    {
      titreFr:
        "Matin J2 — Fiabiliser ce qui sort : chasse à l'erreur, documents de sécurité, commentaire d'indicateurs",
      steps: [
        {
          temps: "5'",
          type: "objectif",
          titre:
            "Objectif du matin : à midi, chacun a compté les erreurs de la machine sur son propre process et préparé un document de sécurité prêt au visa HSE",
        },
        {
          temps: "30'",
          type: "pratique",
          titre:
            "Pratique 1 — la chasse à l'erreur : on fait produire un texte sur VOTRE process, chacun surligne au feutre ce qui est faux sur sa propre impression, et on compte",
        },
        {
          temps: "15'",
          type: "verification",
          titre:
            "Vérification corrigée en salle : mise en commun et construction du tableau des erreurs types (référence inventée, étape sautée, chiffre plausible et faux, consigne de sécurité adoucie) — ce que chacun change dans sa relecture",
        },
        {
          temps: "10'",
          type: "cadre",
          titre:
            "Cadrage procédural des documents obligatoires : ce que l'IA prépare, ce que le responsable HSE valide, ce qui ne s'affiche jamais sans visa — les trames pré-rédigées (causerie, analyse d'aléa, fiche de non-conformité et action corrective) sont fournies au kit, le formateur n'arbitre aucune question de réglementation HSE et renvoie au responsable HSE du client",
        },
        {
          temps: "10'",
          type: "demonstration",
          titre:
            "Démonstration avant / après sur une causerie sécurité à partir de la trame fournie — consigne affichée en entier, un seul outil",
        },
        { temps: "15'", type: "pause", titre: "Pause" },
        {
          temps: "45'",
          type: "pratique",
          titre:
            "Pratique 2 : chacun prépare un document réel de son atelier à partir de la trame fournie — causerie sécurité, analyse d'un aléa, ou fiche de non-conformité et action corrective",
        },
        {
          temps: "20'",
          type: "pratique",
          titre:
            "Pratique 3 : relecture croisée en binôme sur la grille, puis reprise et marquage de l'emplacement du visa HSE avant classement",
        },
        {
          temps: "10'",
          type: "cadre",
          titre:
            "On ne fait jamais calculer l'IA : le chiffre vient de votre système, l'IA n'écrit que le commentaire autour — pourquoi un modèle de langage produit un TRS plausible et faux, et le geste de recopier le chiffre depuis la source",
        },
        {
          temps: "35'",
          type: "pratique",
          titre:
            "Pratique 4 : à partir d'indicateurs déjà calculés (TRS, rebuts, plan de charge — jeu fourni pour ceux qui n'ont pas les leurs), chacun rédige le commentaire du mois de son atelier et vérifie chaque chiffre contre sa source",
        },
        {
          temps: "10'",
          type: "verification",
          titre:
            "Vérification corrigée en salle : 5 questions sur les erreurs types et la règle du calcul",
        },
        {
          temps: "5'",
          type: "synthese",
          titre: "Synthèse : les trois documents que je ne repousserai plus",
        },
      ],
    },
    {
      titreFr:
        "Après-midi J2 — Automatiser un relevé d'atelier, jamais un jugement sur une personne",
      steps: [
        {
          temps: "5'",
          type: "objectif",
          titre:
            "Objectif de l'après-midi : à 17 h, chacun a qualifié son cas d'automatisation et fait tourner un suivi hebdomadaire sur son propre relevé d'atelier",
        },
        {
          temps: "20'",
          type: "cadre",
          titre:
            "Ce qu'on n'automatise jamais sur une personne : suivre les cadences, les temps par poste ou les rebuts par opérateur relève du suivi de la performance et du comportement des travailleurs — usage à haut risque au sens de l'annexe III, point 4 b) du règlement européen sur l'IA. Information préalable des salariés concernés et de leurs représentants (art. 26, §7 du règlement), information individuelle préalable (art. L.1222-4 du code du travail) et consultation du CSE avant mise en œuvre (art. L.2312-38). Où naissent les biais : un indicateur qui pénalise systématiquement l'équipe de nuit, les postes formateurs, ou les opérateurs en reprise",
        },
        {
          temps: "10'",
          type: "cadre",
          titre:
            "Le test de qualification en 4 questions, à passer avant tout prototype : y a-t-il des données personnelles ? un effet sur une personne ? une obligation de sécurité engagée ? une décision prise sans relecture humaine ? — une seule réponse « oui » stoppe le prototype et renvoie à la direction et au CSE",
        },
        {
          temps: "20'",
          type: "pratique",
          titre:
            "Pratique 1 : chacun passe son idée d'automatisation au test des 4 questions, écrit son verdict sur la fiche fournie, et les cas litigieux sont arbitrés en salle",
        },
        {
          temps: "15'",
          type: "demonstration",
          titre:
            "Démonstration avant / après : un relevé d'atelier brut (colonnes en vrac, dates hétérogènes) devient un suivi hebdomadaire lisible — un seul outil, consigne affichée en entier",
        },
        { temps: "15'", type: "pause", titre: "Pause" },
        {
          temps: "45'",
          type: "pratique",
          titre:
            "Pratique 2 : chacun construit le suivi hebdomadaire de son propre relevé d'atelier — uniquement sur un cas qui a passé le test des 4 questions",
        },
        {
          temps: "25'",
          type: "pratique",
          titre:
            "Pratique 3 — fiabiliser : chacun fait tourner son jeu d'essai, y glisse un cas limite (ligne vide, unité changée, semaine à 4 jours), écrit le signal à émettre quand le résultat est douteux et sa procédure de retour arrière",
        },
        {
          temps: "25'",
          type: "verification",
          titre:
            "Évaluation des acquis corrigée en salle : quiz individuel de 10 questions, puis évaluation de la production d'atelier sur la grille fournie (exactitude, sécurité, structure, réutilisabilité)",
        },
        {
          temps: "20'",
          type: "pratique",
          titre:
            "Pratique 4 : chacun assemble et nomme son classeur de bord d'atelier — liste rouge, consigne, compte rendu, mode opératoire, document visé, commentaire d'indicateurs, suivi hebdomadaire et procédure de retour arrière — et note où il le range pour le rouvrir lundi",
        },
        {
          temps: "10'",
          type: "synthese",
          titre:
            "Synthèse et feuille de route : trois usages et une automatisation à installer, un porteur et une échéance par ligne",
        },
      ],
    },
  ],
  faqs: [
    {
      question: "Pourquoi 2 jours pour la production ?",
      reponse:
        "Le jour 1 couvre les écrits du métier (reporting, planification, documentation qualité) ; le jour 2 va jusqu'aux premiers cas d'automatisation de suivi, construits et testés en séance. La formation est scindable en 2×1 jour.",
    },
    {
      question:
        "Nos équipes terrain ne sont pas des habituées des outils numériques — est-ce un problème ?",
      reponse:
        "Non : aucun prérequis technique poussé. Chaque notion est démontrée puis pratiquée immédiatement sur les tâches réelles des participants, avec un accompagnement pas à pas.",
    },
    {
      question: "L'IA va-t-elle piloter notre production ?",
      reponse:
        "Non : vos systèmes de production restent maîtres des données et des décisions. L'IA travaille sur ce qui les entoure — comptes-rendus, documentation, analyses, suivi — là où partent des heures chaque semaine.",
    },
  ],
};

const IA_POUR_LES_ACHATS: FormationV2 = {
  id: "ia-pour-les-achats",
  slugFr: "ia-pour-les-achats",
  slugEn: "ai-for-procurement",
  numero: 11,
  gamme: "ia-standard",
  categorie: "metier",
  axeLabelFr: "Achats / Logistique",
  duree: "1j",
  titreFr: "IA pour les achats",
  accrocheFr: "Décidez plus vite, achetez mieux — optimiser achats et logistique au quotidien",
  h1Fr: "Formation IA pour les achats : optimiser achats et logistique au quotidien",
  metaTitleFr: "Formation IA pour les achats — 1 jour",
  metaDescriptionFr:
    "Formation IA achats et logistique (1 jour, intra) : analyse de devis, cahiers des charges, suivi de commandes, anticipation des ruptures. 1 900 € HT par groupe.",
  termesSemantiquesFr: [
    "formation IA achats",
    "IA logistique",
    "analyse devis IA",
    "cahier des charges IA",
    "comparatif fournisseurs IA",
    "suivi commandes IA",
  ],
  publicViseFr:
    "Acheteurs, responsables logistique et approvisionnement. Comparer des devis, rédiger un cahier des charges, suivre les commandes : le quotidien des achats est fait de tâches précises et répétitives — cette journée montre comment l'IA les accélère pour vous laisser le temps de la négociation.",
  casUsageFr: [
    { texteFr: "L'analyse de devis et les comparatifs fournisseurs" },
    { texteFr: "La rédaction de cahiers des charges" },
    { texteFr: "Le suivi des commandes et les relances" },
    { texteFr: "L'anticipation des ruptures assistée par l'IA" },
  ],
  objectifsFr: [
    "Analyser devis et comparatifs fournisseurs à l'aide de l'IA",
    "Rédiger un cahier des charges",
    "Produire suivi de commandes et relances",
    "Anticiper les ruptures avec l'appui de l'IA",
    "Appliquer les règles de confidentialité",
  ],
  beneficeDirigeantFr:
    "Des décisions d'achat plus rapides et un meilleur suivi des commandes en cours — l'équipe garde son énergie pour la négociation.",
  equationTempsFr:
    "1 journée → un comparatif de plusieurs devis résumé en quelques minutes pour éclairer la décision.",
  avantApresFr: {
    avant: "Des comparatifs longs à produire, un suivi dispersé.",
    apres: "Des décisions d'achat plus rapides, un meilleur suivi des commandes en cours.",
  },
  programme: [
    {
      titreFr: "Matin — Cadre d'usage et comparaison de devis (modules 1 et 2)",
      steps: [
        {
          temps: "5'",
          type: "objectif",
          titre:
            "M1 · Objectif du module : à la fin, chacun sait ce qu'il peut coller, ce qu'il ne colle jamais, et repart avec son devis de travail prêt — chacun nomme en une phrase le cas qu'il veut avoir traité ce soir",
        },
        {
          temps: "15'",
          type: "demonstration",
          titre:
            "M1 · Démonstration avant / après sur un devis : la comparaison faite à la main, puis la même avec l'IA — un seul outil, la consigne affichée en entier à l'écran ; ce qu'elle aligne (postes, écarts, questions à poser) et ce qu'elle ne calcule pas (totaux, stocks, prévisions)",
        },
        {
          temps: "15'",
          type: "cadre",
          titre:
            "M1 · Les trois régimes d'usage et le geste « où passent mes données » : compte grand public, offre entreprise avec engagement écrit de non-réutilisation, environnement validé par la DSI — où lire la clause, en trois clics, sur chacun",
        },
        {
          temps: "10'",
          type: "pratique",
          titre:
            "M1 · Pratique : chacun ouvre l'outil sur son poste, retrouve sous quel régime il travaille et où est écrit (ou absent) l'engagement de non-réutilisation, et note la réponse en tête de son dossier — tour de salle rapide sur les écarts",
        },
        {
          temps: "20'",
          type: "cadre",
          titre:
            "M1 · Ce qui ne sort jamais, et pourquoi retirer un nom ne suffit pas : tarifs négociés, contrats, coût de revient (secret des affaires, art. L.151-1 du code de commerce) ; un devis reste couvert par sa clause de confidentialité même sans le nom du fournisseur ; un devis d'artisan, d'indépendant ou d'auto-entrepreneur porte des données personnelles — pseudonymiser n'est pas anonymiser. Ce qu'impose le règlement européen sur l'IA (UE 2024/1689) à un service achats : former ses utilisateurs (art. 4), dire ce qui a été écrit avec l'IA, et ne jamais laisser une machine classer seule un fournisseur personne physique (RGPD art. 22) — la décision reste signée par un acheteur",
        },
        {
          temps: "25'",
          type: "pratique",
          titre:
            "M1 · Pratique : chacun écrit la liste rouge de son service sur la trame à trois colonnes du kit (jamais / seulement en offre entreprise / libre), la fait relire par son voisin qui doit y trouver un oubli, puis prépare son devis de travail exploitable — c'est la matière de tous les ateliers de la journée",
        },
        {
          temps: "10'",
          type: "verification",
          titre:
            "M1 · Vérification corrigée en salle : 5 cas concrets projetés (« je colle / je ne colle pas / je reformule »), chacun répond par écrit, correction et vote à main levée sur les deux cas qui divisent",
        },
        {
          temps: "5'",
          type: "synthese",
          titre:
            "M1 · Synthèse : les deux gestes que je fais avant chaque copier-coller, et la phrase que je dis au collègue qui veut coller un contrat fournisseur",
        },
        {
          temps: "15'",
          type: "pause",
          titre: "Pause café — 15 minutes, comptées dans le face-à-face",
        },
        {
          temps: "5'",
          type: "objectif",
          titre:
            "M2 · Objectif du module : à la fin, chacun a produit un comparatif de trois devis réels, avec ses propres critères, ses totaux recalculés à la main et ses questions à reposer à chaque fournisseur",
        },
        {
          temps: "15'",
          type: "pratique",
          titre:
            "M2 · Pratique : déposer ses trois devis (PDF, scan, tableau) et repérer immédiatement ce qui fait échouer l'exercice — scan sans texte reconnu, tableau qui se désaligne, page manquante. Test de contrôle fourni : faire recopier trois montants tirés au hasard et les confronter au document d'origine",
        },
        {
          temps: "15'",
          type: "demonstration",
          titre:
            "M2 · Démonstration de biais : le même lot de devis comparé avec deux grilles différentes donne deux classements différents — les deux consignes sont affichées en entier, côte à côte. Ce qu'il faut en retenir : la grille de comparaison vient de vous, l'IA ne fait qu'appliquer la vôtre, y compris quand elle est mauvaise",
        },
        {
          temps: "35'",
          type: "pratique",
          titre:
            "M2 · Atelier : comparatif réel sur ses trois devis de travail — critères posés et pondérés (coût complet, délai, incoterm, pénalité de retard, garanties, panel existant), postes alignés, totaux recalculés à la main, questions à reposer à chaque fournisseur",
        },
        {
          temps: "10'",
          type: "pratique",
          titre:
            "M2 · Pratique : du besoin flou à la consultation — chacun transforme deux lignes de besoin réel en trame de consultation structurée à partir du modèle du kit (objet, périmètre, critères de choix, pièces à fournir, délai de réponse)",
        },
        {
          temps: "5'",
          type: "verification",
          titre:
            "M2 · Vérification : échange de comparatifs en binôme — trouver en cinq minutes une erreur de total et un critère manquant chez son voisin ; correction en salle sur les deux cas les plus fréquents",
        },
        {
          temps: "5'",
          type: "synthese",
          titre:
            "M2 · Synthèse : ce que je ne délègue jamais dans un comparatif (les critères, les totaux, la décision), et l'ordre dans lequel je m'y prends la prochaine fois",
        },
      ],
    },
    {
      titreFr: "Après-midi — Relances, litiges, négociation et arbitrage (modules 3 et 4)",
      steps: [
        {
          temps: "5'",
          type: "objectif",
          titre:
            "M3 · Objectif du module : à la fin, chacun a écrit sa séquence de relance à trois niveaux, un courrier de réserve confronté au modèle du kit, et tenu un face-à-face avec un fournisseur qui refuse",
        },
        {
          temps: "15'",
          type: "demonstration",
          titre:
            "M3 · Démonstration avant / après : d'un fil d'e-mails embrouillé sur une commande en retard à une relance calibrée sur la relation — un seul outil, la consigne affichée en entier, y compris la partie qui décrit le ton et ce qu'il ne faut pas écrire",
        },
        {
          temps: "30'",
          type: "pratique",
          titre:
            "M3 · Atelier 1 : chacun écrit ses trois niveaux de relance sur un dossier réel (rappel courtois, relance ferme, escalade au responsable), puis la version anglaise du niveau 2 pour un fournisseur étranger — aucune donnée de la liste rouge n'entre dans l'exercice",
        },
        {
          temps: "10'",
          type: "cadre",
          titre:
            "M3 · Le cadre du litige à réception, lu à la trame du kit : réserve, non-conformité, mise en demeure — ce qu'on écrit et ce qu'on n'écrit jamais (pas de chiffrage de préjudice, pas de résiliation annoncée, pas de reconnaissance de responsabilité). Attention au vocabulaire : une pénalité de retard de livraison est une clause de VOTRE contrat, rien n'est automatique ; à ne pas confondre avec les pénalités de retard de paiement, dues de plein droit entre professionnels (art. L.441-10 du code de commerce)",
        },
        {
          temps: "20'",
          type: "pratique",
          titre:
            "M3 · Pratique : chacun rédige son courrier de réserve à réception sur un cas réel, puis le compare phrase à phrase aux trois modèles validés fournis dans le kit (réserve à réception, retard de livraison, non-conformité) et surligne ses trois écarts — le modèle du kit fait foi et ne se modifie pas en séance ; toute question de fond est notée pour le juriste du client",
        },
        {
          temps: "25'",
          type: "pratique",
          titre:
            "M3 · Atelier 2 : jeu de rôle — l'IA joue le fournisseur qui refuse (scénario, posture et trois objections fournis clés en main dans le kit). Chacun prépare ses réponses, sa limite basse et son plan B, puis passe cinq minutes devant son binôme, grille d'observation en main",
        },
        {
          temps: "10'",
          type: "verification",
          titre:
            "M3 · Vérification corrigée en salle : trois relances anonymes projetées — dire laquelle engage l'entreprise plus que nécessaire, laquelle sera ignorée, et pourquoi ; correction argumentée",
        },
        {
          temps: "5'",
          type: "synthese",
          titre:
            "M3 · Synthèse : les deux écrits que je produirai désormais en dix minutes, et celui que je ferai toujours relire avant envoi",
        },
        {
          temps: "15'",
          type: "pause",
          titre: "Pause café — 15 minutes, comptées dans le face-à-face",
        },
        {
          temps: "5'",
          type: "objectif",
          titre:
            "M4 · Objectif du module : à la fin, chacun sait faire tomber une note de marché inventée et repart avec son dossier d'arbitrage fournisseur prêt à être envoyé au décideur",
        },
        {
          temps: "10'",
          type: "demonstration",
          titre:
            "M4 · Démonstration avant / après : la note d'arbitrage d'une page, d'abord telle qu'on l'écrit à la main aujourd'hui, puis produite à partir du comparatif du matin — consigne affichée en entier, sources du comparatif attachées",
        },
        {
          temps: "20'",
          type: "pratique",
          titre:
            "M4 · Chasse à l'erreur : on fait produire une note de marché sur votre famille d'achat, chacun surligne ce qui est faux et on compte à voix haute — fournisseur inventé, référence inventée, prix plausible mais faux. Règle de vérification retenue : toute donnée chiffrée ou tout nom cité doit se retrouver dans une source à vous, sinon il disparaît",
        },
        {
          temps: "15'",
          type: "pratique",
          titre:
            "M4 · Pratique : chacun rédige sa note d'arbitrage d'une page à partir de son propre comparatif (recommandation, deux risques, une question ouverte) et la classe dans son dossier d'arbitrage fournisseur",
        },
        {
          temps: "15'",
          type: "verification",
          titre:
            "M4 · Évaluation des acquis : quiz individuel de 10 questions corrigé en salle, puis évaluation croisée du dossier d'arbitrage sur la grille du kit (critères posés, totaux recalculés, questions au fournisseur, liste rouge respectée, aucune donnée interdite soumise)",
        },
        {
          temps: "10'",
          type: "synthese",
          titre:
            "M4 · Feuille de route et clôture : trois usages installés dans le service dès la semaine suivante, un responsable et une date pour chacun, écrits en dernière page du dossier",
        },
      ],
    },
  ],
  faqs: [
    {
      question: "L'IA va-t-elle calculer nos stocks ou nos prévisions ?",
      reponse:
        "Non : les chiffres restent dans vos systèmes (ERP, WMS, tableur). L'IA excelle sur tout ce qui entoure les flux — comparatifs, cahiers des charges, relances, synthèses — là où part une grande partie du temps du service.",
    },
    {
      question: "Comment garantir la confidentialité des données fournisseurs ?",
      reponse:
        "Tarifs négociés, contrats et données fournisseurs nominatives ne sont jamais soumis à l'IA : les ateliers utilisent des documents anonymisés, et la règle est posée dès le premier module.",
    },
    {
      question: "Est-ce adapté à une petite équipe achats de PME ?",
      reponse:
        "Oui : la journée est conçue pour des équipes de toutes tailles, y compris quand une même personne cumule achats et logistique — les ateliers portent sur vos cas réels.",
    },
  ],
};

const IA_POUR_LA_RELATION_CLIENT: FormationV2 = {
  id: "ia-pour-la-relation-client",
  slugFr: "ia-pour-la-relation-client",
  slugEn: "ai-for-customer-service",
  numero: 12,
  gamme: "ia-standard",
  categorie: "metier",
  axeLabelFr: "Support / Relation client",
  duree: "1j",
  titreFr: "IA pour la relation client",
  accrocheFr:
    "Répondez plus vite, sans jamais baisser en qualité — gagner en réactivité et en qualité",
  h1Fr: "Formation IA pour la relation client : gagner en réactivité et en qualité",
  metaTitleFr: "Formation IA relation client — 1 jour",
  metaDescriptionFr:
    "Formation IA relation client, 1 jour : réponses personnalisées, réclamations, synthèse des échanges, base de connaissances. 1 900 € HT par groupe.",
  termesSemantiquesFr: [
    "formation IA relation client",
    "IA service client",
    "réponse réclamation IA",
    "IA support client",
    "base de connaissances IA",
    "SAV IA",
  ],
  publicViseFr:
    "Conseillers clientèle, responsables support, SAV. Chaque minute compte dans la relation client, et la qualité ne doit jamais en pâtir : cette journée outille vos équipes pour répondre plus vite, plus juste, et de façon homogène quel que soit le conseiller.",
  casUsageFr: [
    { texteFr: "Des réponses types et personnalisées assistées par l'IA" },
    { texteFr: "Un traitement des réclamations facilité" },
    { texteFr: "La synthèse rapide des échanges clients" },
    { texteFr: "Une base de connaissances interne alimentée par l'IA" },
  ],
  objectifsFr: [
    "Rédiger des réponses types et personnalisées à l'aide de l'IA",
    "Traiter une réclamation avec l'appui de l'IA",
    "Synthétiser des échanges clients",
    "Contribuer à une base de connaissances interne",
    "Appliquer les règles de confidentialité",
  ],
  beneficeDirigeantFr:
    "Des réponses plus rapides et plus homogènes, une satisfaction client mieux suivie — la qualité ne dépend plus de la personne qui répond.",
  equationTempsFr:
    "1 journée → une réponse claire à une réclamation client préparée en quelques minutes, prête à être personnalisée.",
  avantApresFr: {
    avant: "Des délais de réponse longs, une qualité variable selon les personnes.",
    apres: "Des réponses plus rapides et plus homogènes, une satisfaction client mieux suivie.",
  },
  programme: [
    {
      titreFr: "Matin — Le cadre du ticket, puis les réponses (modules 1 et 2)",
      steps: [
        {
          temps: "10'",
          type: "objectif",
          titre:
            "Objectif du matin : « est-ce qu'on va nous remplacer ? » — ce que l'IA prend en charge, ce que le conseiller garde et valide, et ce que chacun saura produire avant midi (deux réponses types réutilisables et une réclamation traitée)",
        },
        {
          temps: "20'",
          type: "demonstration",
          titre:
            "Démonstration avant / après sur un ticket fourni au kit : la même demande client traitée sans IA, puis avec — un seul outil, la consigne affichée en entier",
        },
        {
          temps: "12'",
          type: "cadre",
          titre:
            "Les trois régimes d'usage : compte grand public, offre entreprise avec engagement de non-réutilisation, environnement validé par la direction — la seule question à se poser avant de coller un ticket",
        },
        {
          temps: "8'",
          type: "verification",
          titre:
            "Appliqué et corrigé en salle : chacun classe l'outil réellement utilisé par son équipe dans l'un des trois régimes et écrit ce qu'il a le droit d'y coller",
        },
        {
          temps: "15'",
          type: "cadre",
          titre:
            "La liste rouge : nom, adresse, numéro de dossier, pièce d'identité, moyen de paiement — et pourquoi retirer le nom ne suffit pas sur un historique de réclamation (pseudonymiser n'est pas anonymiser)",
        },
        {
          temps: "15'",
          type: "cadre",
          titre:
            "Ce qui part au client : le règlement européen sur l'IA impose d'informer le client qu'il échange avec un automate ; rien du dossier d'un client ne se publie dans une réponse visible de tous ; et le biais — repérer quand la réponse générée n'est pas la même selon le nom, la langue ou le ton du client (trois exemples fournis au kit)",
        },
        {
          temps: "25'",
          type: "pratique",
          titre:
            "Pratique : chacun neutralise trois demandes réelles (une simple, une réclamation, une hors périmètre) et constitue le jeu de travail de sa journée",
        },
        {
          temps: "10'",
          type: "verification",
          titre:
            "Vérification corrigée en salle (5 questions) : sur cinq extraits fournis, ce qui peut être collé, ce qui doit être neutralisé, ce qui ne sort jamais",
        },
        { temps: "15'", type: "pause", titre: "Pause café" },
        {
          temps: "5'",
          type: "objectif",
          titre:
            "Objectif du module 2 : produire une réponse type réutilisable et une réclamation traitée, l'une et l'autre validées par un pair sur grille",
        },
        {
          temps: "15'",
          type: "demonstration",
          titre:
            "La méthode AXION (Acteur, conteXte, Intention, Output, Normes) appliquée à une réclamation agressive — avant / après, consigne affichée en entier : le ton de la maison et les mentions obligatoires sont des Normes, pas une option",
        },
        {
          temps: "35'",
          type: "pratique",
          titre:
            "Atelier : chacun traite les trois demandes de son jeu de travail, puis contrôle croisé en binôme sur la grille fournie (exactitude, engagement pris, ton, réutilisabilité)",
        },
        {
          temps: "20'",
          type: "verification",
          titre:
            "La chasse à l'erreur, corrigée par la salle : repérer dans les réponses produites la garantie, le délai ou le geste commercial que personne n'a autorisés — on compte, chaque binôme annonce son score",
        },
        {
          temps: "5'",
          type: "synthese",
          titre: "Acquis du matin : les deux gestes que j'applique dès le prochain ticket",
        },
      ],
    },
    {
      titreFr:
        "Après-midi — Dossiers en cours, base de connaissances et ce qui part au client (modules 3 et 4)",
      steps: [
        {
          temps: "5'",
          type: "objectif",
          titre:
            "Objectif de l'après-midi : reprendre un dossier en cours en cinq minutes, transformer les réponses qui marchent en fiches opposables, et n'envoyer aucune réponse qui engage l'entreprise sans qu'on l'ait voulu",
        },
        {
          temps: "15'",
          type: "demonstration",
          titre:
            "Démonstration avant / après sur un historique fourni au kit : d'un fil de vingt échanges aux faits, aux engagements déjà pris et à la prochaine action",
        },
        {
          temps: "30'",
          type: "pratique",
          titre:
            "Atelier : chacun reprend un dossier en cours neutralisé et produit sa fiche de reprise ; le binôme vérifie qu'aucun engagement n'a été perdu ni inventé",
        },
        {
          temps: "25'",
          type: "pratique",
          titre:
            "Atelier — jeu de rôle : l'IA joue le client mécontent qui revient une troisième fois (trois scénarios et la trame d'escalade fournis au kit) ; chacun conduit l'échange et rédige l'escalade vers le niveau 2",
        },
        { temps: "15'", type: "pause", titre: "Pause café" },
        {
          temps: "20'",
          type: "pratique",
          titre:
            "Atelier : ce que disent 200 demandes — chacun regroupe un jeu de verbatims neutralisés (fourni au kit) en causes racines et écrit la note d'une page au responsable",
        },
        {
          temps: "10'",
          type: "cadre",
          titre:
            "Ce qui rend une fiche opposable : un motif et un seul, une réponse validée, une date de revue, un propriétaire nommé — et où la base vit, qui la maintient, qui la relit",
        },
        {
          temps: "30'",
          type: "pratique",
          titre:
            "Atelier : chacun rédige ses trois premières fiches de base de connaissances à partir de ses réponses du matin",
        },
        {
          temps: "10'",
          type: "verification",
          titre:
            "Vérification croisée : deux fiches par binôme passées à la grille (motif unique, réponse exacte, date de revue, propriétaire nommé)",
        },
        {
          temps: "10'",
          type: "demonstration",
          titre:
            "Relire avant d'envoyer : les quatre contrôles — le fait, l'engagement, le ton, les mentions — démontrés sur une réponse produite le matin",
        },
        {
          temps: "20'",
          type: "pratique",
          titre:
            "Atelier de clôture : chacun applique les quatre contrôles à ses fiches et à sa réponse la plus fréquente, et y pose la mention d'information du client posée le matin",
        },
        {
          temps: "15'",
          type: "verification",
          titre:
            "Évaluation des acquis : quiz individuel (10 questions) et notation sur grille de trois productions d'atelier (une réponse type, une réclamation, une fiche de base de connaissances)",
        },
        {
          temps: "5'",
          type: "synthese",
          titre:
            "Feuille de route et remise du référentiel : trois usages installés dans l'équipe la semaine suivante, un propriétaire nommé pour la base, où le référentiel est rangé et comment on y ajoute une fiche",
        },
      ],
    },
  ],
  faqs: [
    {
      question: "Les clients vont-ils recevoir des réponses « robot » ?",
      reponse:
        "Non : l'IA prépare une réponse structurée et documentée, que le conseiller personnalise et valide avant envoi. L'objectif est l'homogénéité et la rapidité — le ton humain reste, et la relecture est systématique.",
    },
    {
      question: "Comment sont protégées les données clients ?",
      reponse:
        "Les données clients nominatives ne sont jamais soumises à l'IA : la journée enseigne les réflexes d'anonymisation et les règles de confidentialité, appliqués dans tous les ateliers.",
    },
    {
      question: "Est-ce compatible avec notre outil de ticketing ?",
      reponse:
        "La formation est indépendante de l'outil : les méthodes s'appliquent quel que soit votre système (e-mail, ticketing, CRM). Les ateliers travaillent sur vos types de demandes réels.",
    },
  ],
};

const IA_POUR_L_IT: FormationV2 = {
  id: "ia-pour-l-it",
  slugFr: "ia-pour-l-it",
  slugEn: "ai-for-it",
  numero: 13,
  gamme: "ia-standard",
  categorie: "metier",
  axeLabelFr: "IT / Développement",
  duree: "2j",
  scindable: true,
  titreFr: "IA pour l'IT",
  accrocheFr: "Livrez plus vite, documentez enfin sans y penser — accélérer l'ensemble des projets",
  h1Fr: "Formation IA pour l'IT : accélérer l'ensemble des projets (2 jours)",
  metaTitleFr: "Formation IA pour l'IT — 2 jours",
  metaDescriptionFr:
    "Formation IA pour l'IT, 2 jours scindables : assistance au code, documentation, débogage, spécifications, automatisation de tâches IT. 3 600 € HT par groupe.",
  termesSemantiquesFr: [
    "formation IA développeurs",
    "IA assistance code",
    "documentation technique IA",
    "débogage IA",
    "IA DSI",
    "automatisation tâches IT",
  ],
  publicViseFr:
    "Développeurs, administrateurs systèmes, responsables IT. La dette technique et la documentation en retard pèsent sur chaque équipe IT : ces deux jours montrent comment l'IA accélère le développement et allège les tâches récurrentes, sans remplacer l'expertise de vos équipes.",
  prerequisFr:
    "Aisance en développement ou en administration système utile. Les exercices s'adaptent au niveau et à l'environnement technique des participants.",
  casUsageFr: [
    { texteFr: "L'assistance au code et à la documentation technique" },
    { texteFr: "Le débogage assisté par l'IA" },
    { texteFr: "La rédaction de spécifications facilitée" },
    { texteFr: "Les premiers cas d'automatisation de tâches IT récurrentes" },
  ],
  objectifsFr: [
    "Utiliser l'IA en assistance au code et à la documentation technique",
    "Déboguer avec l'appui de l'IA",
    "Rédiger des spécifications assistées",
    "Identifier et prototyper une automatisation de tâche IT récurrente",
    "Appliquer les règles de confidentialité",
  ],
  beneficeDirigeantFr:
    "Un développement plus rapide et une documentation tenue à jour plus facilement — l'équipe IT livre plus sans s'épuiser sur les tâches récurrentes.",
  equationTempsFr:
    "2 jours → la documentation d'une fonction rédigée en quelques minutes plutôt que repoussée à plus tard.",
  avantApresFr: {
    avant: "Une dette technique et une documentation qui prennent du retard.",
    apres: "Un développement plus rapide, une documentation tenue à jour plus facilement.",
  },
  materielFr:
    "Ordinateur portable, connexion internet, accès aux outils IA, environnement de développement habituel",
  programme: [
    {
      titreFr: "Matin J1 — Ce qui se soumet, avec quel outil, sous quelle licence",
      steps: [
        {
          temps: "5'",
          type: "objectif",
          titre:
            "Objectif du matin : à midi, chacun a écrit sa règle de soumission — quel extrait, sur quel outil, sous quel régime — et l'a éprouvée sur trois extraits pièges",
        },
        {
          temps: "20'",
          type: "demonstration",
          titre:
            "Avant / après sur UN SEUL outil : la même demande technique passée dans ses trois modes (chat, assistant intégré à l'éditeur, agent qui ouvre une branche) — prompt affiché en entier, sorties comparées côte à côte",
        },
        {
          temps: "20'",
          type: "cadre",
          titre:
            "Les trois régimes d'usage appliqués au code : compte personnel, licence entreprise (engagement de non-réutilisation, journalisation), instance hébergée — et la clause de sous-traitance de votre contrat client (grille des trois régimes fournie au kit)",
        },
        {
          temps: "20'",
          type: "pratique",
          titre:
            "Sur son propre outil, SANS RIEN SOUMETTRE : ouvrir les pages de paramètres, relever ce qui est journalisé, ce qui est retenu pour l'entraînement, ce qui est effaçable — et cocher son régime réel sur la grille",
        },
        {
          temps: "20'",
          type: "cadre",
          titre:
            "Ce qui ne part jamais (secrets, jetons, extractions de production, données clients, code sous exclusivité), pourquoi pseudonymiser ne suffit ni au regard du RGPD ni de la clause de confidentialité du contrat client — et à qui appartient la sortie : licence, contamination par du copyleft, titularité, cession client",
        },
        { temps: "15'", type: "pause", titre: "Pause" },
        {
          temps: "25'",
          type: "pratique",
          titre:
            "Le tri des cas limites : 12 situations fournies au kit (trace de production, fichier de configuration, extrait sous copyleft, ticket client nominatif…) ; chacun tranche « soumettable / à neutraliser d'abord / jamais », puis confrontation en binôme sur le corrigé fourni",
        },
        {
          temps: "45'",
          type: "pratique",
          titre:
            "Atelier bac à sable : chacun monte son environnement conforme (dépôt de test, extrait neutralisé de son vrai code, outil paramétré au régime retenu) et rédige les sections 1 et 2 de son runbook — règle de soumission, propriété des sorties",
        },
        {
          temps: "25'",
          type: "verification",
          titre:
            "Vérification corrigée en salle : chaque binôme applique la règle de l'autre à 3 extraits pièges fournis et relève ce qui passe à tort, puis 6 questions corrigées collectivement — chacun rectifie sa section 1",
        },
        {
          temps: "15'",
          type: "synthese",
          titre:
            "Synthèse : trois acquis formulés en actions, et la règle que chacun applique dès ce soir",
        },
      ],
    },
    {
      titreFr: "Après-midi J1 — Code, tests et débogage : accélérer sans signer n'importe quoi",
      steps: [
        {
          temps: "5'",
          type: "objectif",
          titre:
            "Objectif de l'après-midi : à 17 h, chacun a fait générer les tests d'une de ses fonctions et les a passés au vert, et a compté ce qu'une revue assistée signale à tort",
        },
        {
          temps: "25'",
          type: "demonstration",
          titre:
            "La méthode AXION appliquée à une demande technique (Acteur, conteXte, Intention, Output, Normes) : avant / après sur un fichier hérité, la même demande sans Normes puis avec — prompts affichés en entier, un seul outil",
        },
        {
          temps: "25'",
          type: "pratique",
          titre:
            "Atelier AXION : chacun réécrit deux de ses demandes techniques au format AXION, les passe à l'outil, et note par écrit ce que les Normes ont changé dans la sortie",
        },
        {
          temps: "45'",
          type: "pratique",
          titre:
            "Atelier tests : générer les tests d'une fonction existante, les exécuter, corriger jusqu'au vert — c'est le test qui corrige, pas le formateur (deux jeux de consignes fournis au kit : parcours développement, parcours exploitation)",
        },
        { temps: "15'", type: "pause", titre: "Pause" },
        {
          temps: "15'",
          type: "demonstration",
          titre:
            "Revue assistée sur un changement FOURNI AU KIT, porteur de trois défauts connus (une régression, un secret en clair, un cas limite non traité) : ce que l'IA voit vraiment, ce qu'elle invente — correction vérifiable sans lire le code d'aucun client",
        },
        {
          temps: "30'",
          type: "pratique",
          titre:
            "Atelier revue : chacun passe le changement du kit en revue assistée, relève les trois défauts et compte les alertes injustifiées — auto-corrigé sur le corrigé fourni, puis mise en commun des écarts",
        },
        {
          temps: "25'",
          type: "pratique",
          titre:
            "Atelier débogage : d'une trace d'erreur réelle — neutralisée selon la règle du matin — à trois hypothèses testables, chacune vérifiée dans l'environnement du participant ; « on ne colle jamais une trace de production telle quelle »",
        },
        {
          temps: "15'",
          type: "verification",
          titre:
            "Vérification corrigée en salle : 5 questions, puis chacun annonce l'hypothèse de débogage que l'IA a proposée et qui s'est révélée fausse — correction collective",
        },
        {
          temps: "10'",
          type: "synthese",
          titre:
            "Synthèse du jour 1 : trois acquis en actions, et le geste à essayer avant le jour 2",
        },
      ],
    },
    {
      titreFr: "Matin J2 — Les écrits de l'IT : vérifier, spécifier, documenter l'incident",
      steps: [
        {
          temps: "5'",
          type: "objectif",
          titre:
            "Objectif du matin : à midi, chacun a chiffré le taux d'erreur d'une production IA sur son propre environnement et transformé une demande floue en spécification testable",
        },
        {
          temps: "25'",
          type: "pratique",
          titre:
            "La chasse à l'erreur : on fait produire une procédure d'installation ou de migration sur VOTRE environnement ; chacun surligne ce qui est faux (version, option, chemin, commande inventée), compte, et verse le décompte en section 3 de son runbook",
        },
        {
          temps: "20'",
          type: "demonstration",
          titre:
            "Avant / après : une demande métier floue reçue par écrit, puis la même passée en spécification, critères d'acceptation et découpage en tickets — prompt affiché en entier",
        },
        {
          temps: "45'",
          type: "pratique",
          titre:
            "Atelier spécification : chacun transforme une vraie demande métier en spécification, critères d'acceptation et tickets ; relecture en binôme sur la grille fournie (testable, borné, hors périmètre explicite)",
        },
        { temps: "15'", type: "pause", titre: "Pause" },
        {
          temps: "15'",
          type: "demonstration",
          titre:
            "Avant / après sur les écrits d'astreinte : de notes brutes ou d'une dictée au runbook et au compte rendu d'incident exploitables — avec le passage de neutralisation appliqué avant tout collage",
        },
        {
          temps: "45'",
          type: "pratique",
          titre:
            "Atelier écrits d'astreinte : chacun produit un runbook d'astreinte ou un compte rendu d'incident réel à partir de ses notes brutes, relu en binôme sur la grille fournie (exactitude, réversibilité, ce qu'un collègue comprend à 3 h du matin)",
        },
        {
          temps: "25'",
          type: "verification",
          titre:
            "Vérification corrigée en salle : chaque binôme exécute le runbook de l'autre pas à pas et signale la première étape infaisable ; puis 5 questions corrigées collectivement",
        },
        {
          temps: "15'",
          type: "synthese",
          titre: "Synthèse : trois acquis en actions ; chacun verse ses sections 3 et 5 au runbook",
        },
      ],
    },
    {
      titreFr: "Après-midi J2 — Automatiser une tâche IT et gouverner l'usage",
      steps: [
        {
          temps: "5'",
          type: "objectif",
          titre:
            "Objectif de l'après-midi : à 17 h, chacun a qualifié deux tâches, éprouvé une automatisation avec sa procédure de retour arrière, et retenu les articles de charte qu'il soumettra à validation",
        },
        {
          temps: "20'",
          type: "cadre",
          titre:
            "AVANT tout prototype : ce qu'on n'automatise pas sans cadre — toute décision produisant un effet sur une personne (accès, sanction) et le SUIVI D'ACTIVITÉ D'UN SALARIÉ, classé usage à HAUT RISQUE par le règlement européen sur l'IA (annexe III, point 4, emploi et gestion des travailleurs) : biais du jeu de données, supervision humaine, information des personnes, analyse d'impact RGPD. Test de qualification en 4 questions et grille haut risque fournis au kit",
        },
        {
          temps: "25'",
          type: "pratique",
          titre:
            "Atelier de qualification : chacun passe deux tâches candidates au test des 4 questions et à la grille haut risque ; confrontation en binôme, puis classement au tableau — automatisable / à instruire (biais, analyse d'impact) / écarté — versé en section 4 du runbook",
        },
        {
          temps: "15'",
          type: "demonstration",
          titre:
            "Avant / après sur une tâche IT récurrente (tri de journaux, revue de dépendances, rapport hebdomadaire) : la tâche à la main, puis automatisée avec son jeu d'essai — prompt affiché en entier",
        },
        {
          temps: "50'",
          type: "pratique",
          titre:
            "Atelier automatisation IT : chacun construit et éprouve son automatisation — jeu d'essai, un cas limite volontairement faux, journal d'exécution, et la procédure de retour arrière écrite AVANT toute mise en service",
        },
        { temps: "15'", type: "pause", titre: "Pause" },
        {
          temps: "30'",
          type: "pratique",
          titre:
            "Atelier gouvernance — une SÉLECTION, pas un exposé : à partir de la charte-type et de la grille de déclenchement de l'information-consultation du CSE fournies au kit, chaque binôme retient les articles applicables à son entreprise (licence entreprise contre comptes personnels, usage clandestin, journalisation, filtrage, revue humaine obligatoire) et coche ce qui relève de la consultation — section 6 du runbook",
        },
        {
          temps: "30'",
          type: "verification",
          titre:
            "Évaluation des acquis : quiz individuel de 10 questions corrigé en salle, puis évaluation croisée des productions d'atelier sur grille (exactitude, sécurité, réversibilité, documentation, mention du haut risque le cas échéant)",
        },
        {
          temps: "20'",
          type: "synthese",
          titre:
            "Feuille de route et clôture du runbook : trois usages et une automatisation à installer, une règle d'usage à faire valider — un porteur et une échéance par ligne",
        },
      ],
    },
  ],
  faqs: [
    {
      question: "Quel niveau technique faut-il ?",
      reponse:
        "Une aisance en développement ou en administration système est utile : les exercices s'adaptent au niveau et à la stack des participants. Un profil IT généraliste (responsable IT, admin) y trouve autant que des développeurs.",
    },
    {
      question: "Notre code propriétaire est-il en sécurité ?",
      reponse:
        "La sécurité est traitée en profondeur au jour 2 : ce qui peut être soumis à l'IA, ce qui ne le peut jamais (secrets, données de production, code sensible), et comment configurer les outils en conséquence.",
    },
    {
      question: "Peut-on scinder les 2 jours ?",
      reponse:
        "Oui, la formation est scindable en 2 sessions d'une journée — utile pour tester les pratiques du jour 1 avant d'aborder l'automatisation au jour 2.",
    },
  ],
};

// ============================================================================
// OFFRES PAR SECTEUR D'ACTIVITÉ (8)
// ============================================================================

const IA_POUR_LA_SANTE: FormationV2 = {
  id: "ia-pour-la-sante",
  slugFr: "ia-pour-la-sante",
  slugEn: "ai-for-healthcare",
  numero: 14,
  gamme: "ia-standard",
  categorie: "secteur",
  axeLabelFr: "Santé",
  duree: "1j",
  titreFr: "IA pour la santé",
  accrocheFr:
    "Rendez du temps aux soignants en allégeant l'administratif — gagner en efficacité sur l'ensemble de l'activité",
  h1Fr: "Formation IA pour la santé : gagner en efficacité sur l'ensemble de l'activité",
  metaTitleFr: "Formation IA pour la santé — 1 jour",
  metaDescriptionFr:
    "Formation IA santé, 1 jour : comptes-rendus, courriers, gestion administrative et confidentialité stricte des données de santé. 2 200 € HT par groupe.",
  termesSemantiquesFr: [
    "formation IA santé",
    "IA établissement de santé",
    "compte-rendu médical IA",
    "IA administratif santé",
    "confidentialité données de santé",
    "formation IA cabinet clinique EHPAD",
  ],
  publicViseFr:
    "Personnel administratif et soignant non-médical, direction d'établissement — cabinet, clinique, EHPAD, structure médico-sociale. Comptes-rendus, courriers, gestion des rendez-vous : la charge administrative empiète sur le temps de soin ; cette journée montre comment l'IA soulage ces tâches, dans le respect strict de la confidentialité des données de santé.",
  casUsageFr: [
    { texteFr: "L'aide à la rédaction de comptes-rendus et de courriers" },
    { texteFr: "La gestion administrative et la prise de rendez-vous assistées" },
    { texteFr: "La synthèse rapide de documents" },
    { texteFr: "Les bons réflexes de confidentialité des données de santé" },
  ],
  objectifsFr: [
    "Rédiger comptes-rendus et courriers à l'aide de l'IA",
    "Utiliser l'IA en appui à la gestion administrative et aux rendez-vous",
    "Synthétiser des documents",
    "Appliquer strictement les règles de confidentialité des données de santé",
    "Vérifier une production avant diffusion",
  ],
  beneficeDirigeantFr:
    "Un temps administratif réduit et plus de disponibilité pour le cœur de métier — sans jamais compromettre la confidentialité des données de santé.",
  equationTempsFr:
    "1 journée → un compte-rendu mis en forme en quelques minutes à partir de notes dictées.",
  avantApresFr: {
    avant: "Une charge administrative qui empiète sur le temps de soin.",
    apres: "Un temps administratif réduit, plus de disponibilité pour le cœur de métier.",
  },
  programme: [
    {
      titreFr:
        "Matin · Module 1 — Ce que l'IA peut faire dans un établissement, et à quelles conditions",
      steps: [
        {
          temps: "5'",
          type: "objectif",
          titre:
            "Objectif du module : à la fin, vous classez n'importe quel écrit de votre poste en « je peux », « à condition de », « jamais » — et vous savez à qui remonte le doute",
        },
        {
          temps: "15'",
          type: "cadre",
          titre:
            "Les trois régimes d'usage des données : compte grand public, abonnement professionnel sans réutilisation des contenus, environnement hébergé certifié pour les données de santé validé par votre direction — le trajet réel de vos données et le contrat de sous-traitance qui doit exister",
        },
        {
          temps: "10'",
          type: "cadre",
          titre:
            "Ce qui est une donnée de santé : le contenu clinique, pas seulement le nom — et ce qu'engage le secret professionnel. Fiche écrite datée fournie au kit : le formateur lit la fiche et ne l'interprète pas. La borne du métier, noir sur blanc : ni diagnostic, ni orientation, ni triage, ni priorisation d'un accès aux soins — ces usages relèvent du règlement européen sur l'IA (systèmes à haut risque) et, pour l'aide au diagnostic, de la réglementation du dispositif médical ; la journée ne traite que les écrits administratifs",
        },
        {
          temps: "10'",
          type: "cadre",
          titre:
            "Les biais, avant de toucher au premier atelier : ce que l'IA reproduit dans un écrit (âge, sexe, origine, handicap, précarité), pourquoi c'est le point dur dès qu'un écrit sert une décision d'admission ou d'orientation, et les trois formulations à traquer — reprises telles quelles dans la grille de relecture utilisée toute la journée",
        },
        {
          temps: "10'",
          type: "demonstration",
          titre:
            "Démonstration avant / après sur un courrier de sortie FICTIF fourni, déjà neutralisé : le courrier écrit à la main, puis repris avec l'IA — prompt affiché en entier, un seul outil",
        },
        {
          temps: "15'",
          type: "pratique",
          titre:
            "Chacun ouvre les conditions d'utilisation du compte qu'il emploie déjà et remplit la fiche « le régime de mon poste » — production attendue : la fiche remplie, datée, avec le nom de la personne qui valide dans l'établissement",
        },
        {
          temps: "25'",
          type: "pratique",
          titre:
            "Chronométré : classer douze écrits de son quotidien (liste fournie, complétée par ses propres cas) dans les trois régimes, puis correction croisée en binôme, chacun devant justifier un classement contesté",
        },
        {
          temps: "10'",
          type: "verification",
          titre:
            "Correction en salle : les cas litigieux sont tranchés en plénière contre la fiche des trois régimes, chacun corrige son propre classement et note les deux cas qu'il avait faux",
        },
        {
          temps: "5'",
          type: "synthese",
          titre:
            "Acquis : je nomme le régime de mon poste, je connais ma ligne rouge, je sais à qui la question remonte",
        },
        { temps: "15'", type: "pause", titre: "Pause" },
      ],
    },
    {
      titreFr:
        "Matin · Module 2 — Neutraliser un cas, puis écrire vite ses courriers et ses transmissions",
      steps: [
        {
          temps: "5'",
          type: "objectif",
          titre:
            "Objectif du module : produire un courrier ou une note de transmission diffusable à partir d'un texte que vous avez rendu réellement non identifiant",
        },
        {
          temps: "10'",
          type: "demonstration",
          titre:
            "Démonstration : « j'ai retiré le nom, donc c'est anonyme » — on ré-identifie la personne en direct à partir du seul reste du texte — prompt affiché en entier, un seul outil",
        },
        {
          temps: "10'",
          type: "cadre",
          titre:
            "Pseudonymiser n'est pas anonymiser : les quatre traces qui trahissent (dates, lieu, entourage, singularité du cas), la technique de reformulation générique, et pourquoi un texte pseudonymisé reste une donnée personnelle soumise aux mêmes règles",
        },
        {
          temps: "10'",
          type: "pratique",
          titre:
            "Prise en main chronométrée : déposer un fichier, coller un export, dicter deux minutes depuis son téléphone — et les trois cas d'échec (document scanné sans texte reconnu, tableau désaligné, fichier trop lourd). Production attendue : un texte importé exploitable à l'écran",
        },
        {
          temps: "15'",
          type: "pratique",
          titre:
            "Neutraliser son propre cas : chacun réécrit un extrait réel jusqu'à ce que les quatre traces aient disparu ; contrôle par le binôme, fiche des quatre traces en main, avant toute soumission à l'outil",
        },
        {
          temps: "25'",
          type: "pratique",
          titre:
            "Atelier chronométré : produire un écrit réel de son poste — courrier à une famille, courrier à un confrère, note de transmission, réponse à une administration — à partir du cas qu'il vient de neutraliser",
        },
        {
          temps: "10'",
          type: "verification",
          titre:
            "Vérification croisée : grille fournie (exactitude, ton, mentions obligatoires, formulations biaisées, traces résiduelles) appliquée à la production du binôme — on compte à voix haute les traces qui restent",
        },
        {
          temps: "5'",
          type: "synthese",
          titre:
            "Acquis : je neutralise un cas avant de l'écrire, et je repère une trace résiduelle chez un collègue",
        },
      ],
    },
    {
      titreFr:
        "Après-midi · Module 3 — Les écrits qui font vivre l'établissement : qualité, projets, tutelle",
      steps: [
        {
          temps: "5'",
          type: "objectif",
          titre:
            "Objectif du module : produire en une séance un écrit de pilotage que vous repoussez habituellement — synthèse, rapport d'activité, réponse à une tutelle ou à un appel à projets",
        },
        {
          temps: "10'",
          type: "cadre",
          titre:
            "Ce que l'IA ne construit pas : roulements, remplacements, plannings de service, calculs d'effectif — un modèle de langage ne sait ni compter les repos ni respecter l'annualisation. Ce qu'on lui demande à la place : la consigne, le courrier d'explication, la note de cadrage",
        },
        {
          temps: "10'",
          type: "demonstration",
          titre:
            "Démonstration : un rapport de quarante pages devient une note d'une page pour la direction — prompt affiché en entier, un seul outil",
        },
        {
          temps: "15'",
          type: "pratique",
          titre:
            "Faire parler un document long au lieu de le lire : chacun charge son protocole, sa recommandation ou son cahier des charges d'appel à projets et pose trois questions — production attendue : trois réponses, chacune renvoyée à sa page d'origine dans le document",
        },
        {
          temps: "45'",
          type: "pratique",
          titre:
            "Atelier chronométré, au choix : synthèse d'un document apporté, trame de rapport d'activité, réponse à un appel à projets, note de projet personnalisé — consigne écrite et grille de rendu fournies pour chacun des quatre parcours",
        },
        {
          temps: "15'",
          type: "verification",
          titre:
            "Chasse à l'erreur : chacun surligne dans sa propre production ce que l'IA a inventé ou déformé, retourne au document source pour trancher, comptage collectif à voix haute — c'est la salle qui corrige, pas le formateur",
        },
        {
          temps: "5'",
          type: "synthese",
          titre:
            "Acquis : je fais parler un document long, et je ne signe jamais ce que je n'ai pas recoupé avec la source",
        },
        { temps: "15'", type: "pause", titre: "Pause" },
      ],
    },
    {
      titreFr: "Après-midi · Module 4 — Ancrer dans l'établissement sans se mettre en faute",
      steps: [
        {
          temps: "5'",
          type: "objectif",
          titre:
            "Objectif du module : repartir avec un manuel de procédures IA de votre service et trois usages datés, à faire viser par votre encadrement",
        },
        {
          temps: "10'",
          type: "demonstration",
          titre:
            "Démonstration : une fiche-procédure du service rédigée en direct à partir d'un besoin de la salle, avec sa liste de vérifications en en-tête — prompt affiché en entier, un seul outil",
        },
        {
          temps: "10'",
          type: "pratique",
          titre:
            "Retour sur ses propres demandes du jour : chacun relit l'historique de ses échanges avec l'outil, surligne ce qui n'aurait pas dû être collé, et le reporte en bas de sa fiche « le régime de mon poste »",
        },
        {
          temps: "10'",
          type: "cadre",
          titre:
            "Ce qu'il reste à faire pour que l'usage soit régulier : qui valide l'outil, inscription au registre des traitements, information des personnes concernées, renvoi au délégué à la protection des données. Formule de refus que le formateur applique et annonce : « je ne me prononce pas sur le secret partagé, votre référent protection des données tranche » — position écrite datée fournie au kit",
        },
        {
          temps: "20'",
          type: "pratique",
          titre:
            "Rédiger son manuel de procédures IA du service : trois fiches-procédures (courrier famille ou confrère, note de transmission, écrit de pilotage) portant chacune en en-tête sa liste de vérifications, plus la page « régimes, ligne rouge et à qui la question remonte »",
        },
        {
          temps: "20'",
          type: "verification",
          titre:
            "Validation des acquis : quiz individuel de 10 questions corrigé en salle question par question, puis passage de sa propre production du jour à la grille de critères — chacun note les points à reprendre sur sa fiche-procédure",
        },
        {
          temps: "10'",
          type: "pratique",
          titre:
            "Feuille de route individuelle : trois usages datés, un usage explicitement écarté et pourquoi, la personne qui valide avant de démarrer, la date de revue",
        },
        {
          temps: "5'",
          type: "synthese",
          titre:
            "Acquis et clôture : ce que je fais dès lundi, ce que je ne fais jamais faire à l'IA, à qui je pose la question",
        },
      ],
    },
  ],
  faqs: [
    {
      question: "Peut-on utiliser l'IA avec des données de patients ?",
      reponse:
        "Non, et c'est la règle absolue de la journée : aucune donnée de santé nominative n'est soumise à l'IA. On travaille sur données factices ou strictement anonymisées, et les réflexes d'anonymisation sont pratiqués dans chaque atelier.",
    },
    {
      question: "À qui s'adresse la formation dans un établissement de santé ?",
      reponse:
        "Au personnel administratif, au personnel soignant non-médical et à la direction — toutes les personnes dont la charge administrative empiète sur le temps consacré aux patients et aux résidents.",
    },
    {
      question: "Présentiel ou distanciel ?",
      reponse:
        "Au choix : dans votre établissement ou à distance, avec le même contenu et les mêmes ateliers.",
    },
  ],
};

const IA_POUR_LE_BTP: FormationV2 = {
  id: "ia-pour-le-btp",
  slugFr: "ia-pour-le-btp",
  slugEn: "ai-for-construction",
  numero: 15,
  gamme: "ia-standard",
  categorie: "secteur",
  axeLabelFr: "BTP / Construction",
  duree: "1j",
  titreFr: "IA pour le BTP",
  accrocheFr:
    "Devis, chantiers, comptes-rendus : reprenez la main sur l'administratif — optimiser l'ensemble de son activité",
  h1Fr: "Formation IA pour le BTP : optimiser l'ensemble de son activité",
  metaTitleFr: "Formation IA pour le BTP — 1 jour",
  metaDescriptionFr:
    "Formation IA BTP (1 jour, intra) : devis, comptes-rendus de chantier, suivi de planning, réponses aux appels d'offres. 2 200 € HT par groupe.",
  termesSemantiquesFr: [
    "formation IA BTP",
    "IA construction",
    "devis BTP IA",
    "compte-rendu chantier IA",
    "appel d'offres IA",
    "IA conducteur de travaux",
  ],
  publicViseFr:
    "Conducteurs de travaux, chargés d'affaires, personnel administratif des entreprises du BTP. Sur un chantier, chaque heure passée sur la paperasse est une heure de perdue : cette journée montre comment l'IA accélère les devis, les comptes-rendus et le suivi, pour vous garder sur le terrain.",
  casUsageFr: [
    { texteFr: "La rédaction de devis et de comptes-rendus de chantier" },
    { texteFr: "Le suivi de planning facilité" },
    { texteFr: "L'aide à la réponse aux appels d'offres" },
    { texteFr: "La synthèse de documents techniques" },
  ],
  objectifsFr: [
    "Rédiger devis et comptes-rendus de chantier à l'aide de l'IA",
    "Utiliser l'IA en appui au suivi de planning",
    "Préparer une réponse à un appel d'offres",
    "Synthétiser des documents techniques",
    "Appliquer les règles de confidentialité",
  ],
  beneficeDirigeantFr:
    "Des documents produits plus vite et un meilleur suivi administratif des chantiers — les équipes restent sur le terrain, pas derrière un clavier.",
  equationTempsFr:
    "1 journée → un compte-rendu de chantier rédigé en quelques minutes depuis quelques notes prises sur place.",
  avantApresFr: {
    avant: "Des devis et comptes-rendus chronophages, un suivi de chantier dispersé.",
    apres: "Des documents produits plus vite, un meilleur suivi administratif des chantiers.",
  },
  programme: [
    {
      titreFr:
        "Matin · Module 1 — Ce que l'IA écrit sur un chantier, ce qu'elle ne chiffre jamais et ce qu'elle ne décide pas",
      steps: [
        {
          temps: "5'",
          type: "objectif",
          titre:
            "Objectif du module : à la fin, vous savez quels écrits du chantier passent par l'IA, lesquels lui sont interdits, et ce qui reste au logiciel de chiffrage",
        },
        {
          temps: "15'",
          type: "demonstration",
          titre:
            "Démonstration avant / après : trois notes prises sur le chantier deviennent un compte-rendu diffusable — le prompt affiché en entier, un seul outil, la version « sans IA » chronométrée d'abord",
        },
        {
          temps: "10'",
          type: "cadre",
          titre:
            "La règle de la journée : l'IA rédige le descriptif, elle ne chiffre pas. Prix de revient, marges, coefficients, bibliothèque de prix, contrats de sous-traitance et coordonnées clients ne sortent pas de l'entreprise — et retirer le nom ne suffit pas quand l'adresse du chantier reste",
        },
        {
          temps: "10'",
          type: "cadre",
          titre:
            "Les deux interdits, avant tout atelier : (a) l'IA ne produit jamais plan de prévention, PPSPS, analyse de risques ni consigne de sécurité ; (b) elle ne trie, ne classe ni ne note des candidats, des intérimaires ou des compagnons — gestion de la main-d'œuvre et composants de sécurité sont des usages classés à haut risque par le règlement européen sur l'IA. Démonstration de biais sur trace capturée fournie dans le kit : mêmes profils, deux noms, deux classements",
        },
        {
          temps: "10'",
          type: "pratique",
          titre:
            "Prise en main des gestes du terrain : dicter deux minutes depuis son téléphone, photographier un carnet ou un tableau, déposer un plan ou un PDF — et les trois cas où ça échoue (photo floue, plan scanné de travers, PDF image sans texte)",
        },
        {
          temps: "25'",
          type: "pratique",
          titre:
            "Pratique chronométrée : chacun transforme des notes réelles de son propre chantier en un compte-rendu structuré et diffusable",
        },
        {
          temps: "10'",
          type: "verification",
          titre:
            "Vérification en binôme, grille fournie : ce qui manque, ce que l'IA a inventé, ce qui n'aurait pas dû être collé — chaque relecteur dispose de 5 minutes minutées",
        },
        {
          temps: "5'",
          type: "synthese",
          titre:
            "Synthèse : je sais ce que je fais écrire, ce que je ne délègue pas, et ce qui ne sort pas de l'entreprise",
        },
        { temps: "15'", type: "pause", titre: "Pause" },
      ],
    },
    {
      titreFr: "Matin · Module 2 — Comptes-rendus, courriers de chantier et pièces qui engagent",
      steps: [
        {
          temps: "5'",
          type: "objectif",
          titre:
            "Objectif du module : produire un compte-rendu et un courrier de chantier qui tiennent juridiquement, sans y passer la soirée",
        },
        {
          temps: "15'",
          type: "demonstration",
          titre:
            "Démonstration : un constat de retard mal formulé et sa version qui protège l'entreprise — les mêmes faits, deux effets. Les deux textes sont fournis dans le kit",
        },
        {
          temps: "15'",
          type: "cadre",
          titre:
            "Les écrits qui engagent — listes fournies dans le kit formateur, à lire telles quelles : (a) réserves, constat de retard, ordre de service, relance de sous-traitant, demande d'avenant : ce que l'IA structure, ce que vous seul décidez ; (b) les mentions obligatoires du descriptif de devis bâtiment (identité et assurance de l'entreprise, garantie décennale, désignation des travaux, durée de validité, conditions). Le formateur ne modifie ni n'improvise ces listes en salle",
        },
        {
          temps: "50'",
          type: "pratique",
          titre:
            "Atelier chronométré : chacun produit deux pièces réelles de son chantier en cours — un compte-rendu et un courrier qui engage — sur les trames fournies",
        },
        {
          temps: "15'",
          type: "verification",
          titre:
            "Vérification : la grille fournie (faits vérifiables et leur source, dates, destinataires, mentions obligatoires, ton) appliquée à la production du binôme, correction reprise en salle",
        },
        {
          temps: "5'",
          type: "synthese",
          titre:
            "Synthèse : je transforme des notes en pièce diffusable, et je reconnais un courrier qui engage avant de l'envoyer",
        },
      ],
    },
    {
      titreFr:
        "Après-midi · Module 3 — Appels d'offres, pièces techniques et documents de sécurité",
      steps: [
        {
          temps: "5'",
          type: "objectif",
          titre:
            "Objectif du module : dégrossir un mémoire technique et faire parler une pièce technique, sans laisser passer une seule affirmation invérifiable",
        },
        {
          temps: "10'",
          type: "demonstration",
          titre:
            "Démonstration sur trace capturée fournie dans le kit (prompt + sortie complète) : un mémoire technique généré et les références qu'il a inventées — repérage collectif ligne à ligne. Relance en direct seulement en bonus, jamais comme support de la démonstration",
        },
        {
          temps: "12'",
          type: "cadre",
          titre:
            "Deux bornes, liste fournie dans le kit et non modifiable en salle : (a) en marché public une référence inventée est une fausse déclaration — effectifs, chantiers de référence, certifications, qualifications, attestations d'assurance : ce qui se vérifie pièce en main avant envoi ; (b) sécurité : l'IA reformule un document déjà validé (accueil chantier, quart d'heure sécurité), elle ne produit jamais l'analyse de risques",
        },
        {
          temps: "13'",
          type: "pratique",
          titre:
            "Prise en main guidée : chacun charge son CCTP, sa notice technique ou son règlement de consultation et pose trois questions, puis retrouve dans le document la phrase qui fonde chaque réponse",
        },
        {
          temps: "50'",
          type: "pratique",
          titre:
            "Atelier chronométré, au choix : trame de mémoire technique dégrossie, synthèse d'une pièce technique, note d'avancement aux intervenants, ou reformulation d'une causerie sécurité à partir d'un document déjà validé",
        },
        {
          temps: "10'",
          type: "verification",
          titre:
            "Vérification croisée : le binôme coche chaque affirmation chiffrée ou nominative ; tout ce qui n'est pas retrouvé dans les pièces de l'entreprise est barré à l'écran",
        },
        {
          temps: "5'",
          type: "synthese",
          titre:
            "Synthèse : rien ne part avant que chaque chiffre et chaque référence soit retrouvé dans mes documents",
        },
        { temps: "15'", type: "pause", titre: "Pause" },
      ],
    },
    {
      titreFr: "Après-midi · Module 4 — Le dossier « prêt à envoyer » et ce qu'on installe lundi",
      steps: [
        {
          temps: "5'",
          type: "objectif",
          titre:
            "Objectif du module : repartir avec trois pièces réelles finalisées, leur grille de contrôle avant envoi, et trois usages datés",
        },
        {
          temps: "10'",
          type: "demonstration",
          titre:
            "Démonstration : la grille de contrôle avant envoi appliquée en direct à une pièce proposée par la salle — quatre lignes barrées en cinq minutes",
        },
        {
          temps: "10'",
          type: "pratique",
          titre:
            "Retour sur la journée : chacun relit ses propres demandes du jour et surligne ce qui a failli sortir — prix de revient, marges, données clients, contrat de sous-traitance, nom d'un salarié",
        },
        {
          temps: "30'",
          type: "pratique",
          titre:
            "Construction du livrable : finaliser les trois pièces du chantier en cours et renseigner pour chacune sa grille de contrôle avant envoi (source de chaque fait, mentions obligatoires, ce qui ne sort pas, qui relit et signe)",
        },
        {
          temps: "20'",
          type: "verification",
          titre:
            "Validation des acquis : quiz individuel de 10 questions corrigé en salle, puis passage de sa propre production de la journée à la grille de critères fournie — reprise nominative des écarts",
        },
        {
          temps: "10'",
          type: "pratique",
          titre:
            "Feuille de route rédigée par chacun : trois usages datés, un usage explicitement écarté, la personne qui relit avant diffusion",
        },
        {
          temps: "5'",
          type: "synthese",
          titre:
            "Synthèse et clôture : ce que j'envoie dès demain, ce que je ne ferai jamais faire à l'IA",
        },
      ],
    },
  ],
  faqs: [
    {
      question: "Est-ce adapté à une petite entreprise du bâtiment ?",
      reponse:
        "Oui : la journée est conçue pour les entreprises de toutes tailles — de l'artisan avec un conducteur de travaux aux PME du BTP. Les ateliers portent sur vos chantiers et documents réels.",
    },
    {
      question: "Peut-on vraiment gagner du temps sur les appels d'offres ?",
      reponse:
        "Oui, notamment sur le mémoire technique : l'IA aide à structurer et dégrossir la rédaction à partir de vos références et méthodes. La relecture et la personnalisation restent humaines — c'est votre expertise qui gagne le marché.",
    },
    {
      question:
        "Nos équipes terrain ne sont pas à l'aise avec l'informatique — est-ce un problème ?",
      reponse:
        "Non : aucun prérequis, et les cas travaillés partent de ce qui existe déjà (notes, dictées, photos). Chaque notion est démontrée puis pratiquée avec un accompagnement pas à pas.",
    },
  ],
};

const IA_POUR_L_IMMOBILIER: FormationV2 = {
  id: "ia-pour-l-immobilier",
  slugFr: "ia-pour-l-immobilier",
  slugEn: "ai-for-real-estate",
  numero: 16,
  gamme: "ia-standard",
  categorie: "secteur",
  axeLabelFr: "Immobilier",
  duree: "1j",
  titreFr: "IA pour l'immobilier",
  accrocheFr:
    "Des annonces qui sortent plus vite, des prospects mieux suivis — gagner en efficacité sur l'ensemble de l'activité",
  h1Fr: "Formation IA pour l'immobilier : gagner en efficacité sur l'ensemble de l'activité",
  metaTitleFr: "Formation IA pour l'immobilier — 1 jour",
  metaDescriptionFr:
    "Formation IA immobilier, 1 jour : annonces et descriptifs de biens, estimations, réponses aux prospects, suivi des dossiers. 2 200 € HT par groupe.",
  termesSemantiquesFr: [
    "formation IA immobilier",
    "annonce immobilière IA",
    "IA agence immobilière",
    "estimation bien IA",
    "suivi prospects immobilier",
    "IA gestion locative",
  ],
  publicViseFr:
    "Agents immobiliers, gestionnaires, personnel administratif des agences et cabinets. Rédiger une annonce, estimer un bien, relancer un prospect : le métier est fait de tâches répétitives qui s'accumulent — cette journée met l'IA au service de votre réactivité commerciale.",
  casUsageFr: [
    { texteFr: "La rédaction d'annonces et de descriptifs de biens" },
    { texteFr: "L'aide à l'estimation et aux comparatifs de marché" },
    { texteFr: "Des réponses aux prospects plus rapides" },
    { texteFr: "Le suivi des dossiers de vente ou de location" },
  ],
  objectifsFr: [
    "Rédiger annonces et descriptifs de biens à l'aide de l'IA",
    "Utiliser l'IA en appui à l'estimation et aux comparatifs de marché",
    "Rédiger des réponses aux prospects",
    "Produire un suivi de dossiers de vente ou location",
    "Appliquer les règles de confidentialité",
  ],
  beneficeDirigeantFr:
    "Des annonces produites plus vite et un meilleur suivi des prospects et des dossiers en cours — la réactivité commerciale devient un avantage concurrentiel.",
  equationTempsFr:
    "1 journée → une annonce complète et attractive rédigée en quelques minutes à partir des caractéristiques du bien.",
  avantApresFr: {
    avant: "Une rédaction d'annonces et un suivi de dossiers chronophages.",
    apres:
      "Des annonces produites plus vite, un meilleur suivi des prospects et des dossiers en cours.",
  },
  programme: [
    {
      titreFr: "Matin · Module 1 — L'annonce qui vend et l'annonce qui expose",
      steps: [
        {
          temps: "5'",
          type: "objectif",
          titre:
            "Objectif du module : à la fin, vous produisez une annonce complète qui ne porte que ce que votre dossier prouve, et vous savez ce qu'elle doit obligatoirement mentionner",
        },
        {
          temps: "15'",
          type: "cadre",
          titre:
            "Les mentions qui engagent l'agence, et ce que l'IA invente. Première partie : DPE et GES, surface du lot, nombre de lots et montant moyen des charges de copropriété, honoraires et charge du paiement, statut du mandat — la trame conforme et sa liste de contrôle sont fournies dans le kit, le formateur ne les improvise ni ne les modifie. Seconde partie : ce que l'IA fabrique sans le dire — un diagnostic, une surface, une charge, un prix de marché local — et pourquoi une annonce inexacte est une pratique commerciale trompeuse",
        },
        {
          temps: "10'",
          type: "demonstration",
          titre:
            "Démonstration avant / après : les caractéristiques d'un bien deviennent une annonce complète — le prompt affiché en entier du début à la fin, un seul outil",
        },
        {
          temps: "15'",
          type: "pratique",
          titre:
            "Prise en main : chacun dépose le dossier de son bien (diagnostics, mandat, règlement de copropriété) et en fait ressortir les éléments de l'annonce, sans en ajouter un seul",
        },
        {
          temps: "35'",
          type: "pratique",
          titre:
            "Pratique chronométrée : chacun rédige l'annonce d'un bien réel de son portefeuille sur la trame conforme, puis la reprend une fois après première relecture",
        },
        {
          temps: "5'",
          type: "verification",
          titre:
            "Vérification : le binôme coche la liste des mentions obligatoires et barre tout élément que le dossier ne prouve pas",
        },
        {
          temps: "5'",
          type: "synthese",
          titre: "Synthèse : je produis vite, et je n'affirme rien que mon dossier ne prouve",
        },
        { temps: "15'", type: "pause", titre: "Pause" },
      ],
    },
    {
      titreFr: "Matin · Module 2 — Décliner, répondre, relancer : le rythme commercial",
      steps: [
        {
          temps: "5'",
          type: "objectif",
          titre:
            "Objectif du module : produire en une séance les déclinaisons d'un bien sur vos supports et vos trois réponses types aux prospects",
        },
        {
          temps: "15'",
          type: "demonstration",
          titre:
            "Démonstration : une annonce déclinée pour le portail, la vitrine, les réseaux sociaux et le dossier de présentation — le prompt affiché en entier, un seul outil, sans la réécrire quatre fois",
        },
        {
          temps: "10'",
          type: "cadre",
          titre:
            "Ce qu'on ne colle jamais : coordonnées de vos clients, mandats, offres reçues, situation financière d'un acquéreur. Et pourquoi retirer le nom ne suffit pas : avec l'adresse du bien et la date de visite, la personne reste identifiable — pseudonymiser n'est pas anonymiser, on reste dans le champ des données personnelles",
        },
        {
          temps: "10'",
          type: "pratique",
          titre:
            "Du un au cinquante : chacun produit une série de cinq déclinaisons homogènes à partir du tableau de biens fourni dans le kit, et compare les cinq résultats",
        },
        {
          temps: "45'",
          type: "pratique",
          titre:
            "Atelier chronométré : chacun décline son bien sur trois supports et rédige ses trois réponses types (premier contact, demande de visite, relance après visite)",
        },
        {
          temps: "15'",
          type: "verification",
          titre:
            "Vérification croisée sur grille fournie — mentions obligatoires, exactitude, ton, données de client — appliquée à la production du binôme",
        },
        {
          temps: "5'",
          type: "synthese",
          titre:
            "Synthèse : une annonce, trois supports, trois réponses prêtes — et rien qui sorte du dossier",
        },
      ],
    },
    {
      titreFr:
        "Après-midi · Module 3 — Gestion locative, copropriété et estimation : les écrits qui s'accumulent",
      steps: [
        {
          temps: "5'",
          type: "objectif",
          titre:
            "Objectif du module : produire un écrit de gestion (courrier, convocation, compte rendu, relance) ou un argumentaire d'estimation défendable — et reconnaître la demande qu'on refuse",
        },
        {
          temps: "10'",
          type: "cadre",
          titre:
            "La borne du métier : on ne sélectionne, ne classe ni ne note des candidats locataires avec l'IA. Les trois motifs sont fournis rédigés dans le kit — la discrimination au logement est pénalement sanctionnée ; la liste des pièces exigibles d'un candidat est limitative ; le RGPD interdit la décision entièrement automatisée produisant un effet sur une personne. Le règlement européen sur l'IA range le scoring de personnes parmi ses usages les plus encadrés ; le logement locatif privé n'y est pas nommé, mais les trois textes ci-dessus suffisent à l'interdire. Ce qu'on fait à la place : l'IA met en forme le dossier, l'humain choisit et motive",
        },
        {
          temps: "10'",
          type: "demonstration",
          titre:
            "Démonstration de biais : le même dossier soumis deux fois avec une variable de plus (adresse, âge, situation familiale, nature du contrat de travail) — l'avis rendu change à l'écran. Captures pré-testées fournies dans le kit au cas où le modèle ne biaise pas ce jour-là",
        },
        {
          temps: "10'",
          type: "demonstration",
          titre:
            "Démonstration : un procès-verbal d'assemblée générale reconstruit à partir de notes de séance",
        },
        {
          temps: "10'",
          type: "pratique",
          titre:
            "Prise en main guidée : chacun charge sa pièce (règlement de copropriété, bail, compte de charges) et lui pose trois questions",
        },
        {
          temps: "40'",
          type: "pratique",
          titre:
            "Atelier chronométré : chacun traite trois demandes tirées de la liste fournie — convocation et compte rendu d'assemblée, réponse à un copropriétaire, relance d'impayé, état des lieux mis au propre, argumentaire d'estimation bâti sur ses propres références de marché. Un cas piège est glissé dans la liste (« classe-moi ces trois dossiers de candidats locataires ») : il doit être reconnu et refusé par écrit",
        },
        {
          temps: "15'",
          type: "verification",
          titre:
            "Vérification — chasse à l'erreur puis correction collective : chacun surligne dans sa production ce que l'IA a affirmé sans preuve (prix, surface, échéance, texte de loi) ; puis on corrige en salle le cas piège et la phrase de refus à opposer",
        },
        {
          temps: "5'",
          type: "synthese",
          titre:
            "Synthèse : l'IA met en forme, les chiffres et le droit viennent de mes pièces — et le choix d'un locataire ne se délègue pas",
        },
        { temps: "15'", type: "pause", titre: "Pause" },
      ],
    },
    {
      titreFr: "Après-midi · Module 4 — Ancrer dans l'agence",
      steps: [
        {
          temps: "5'",
          type: "objectif",
          titre:
            "Objectif du module : repartir avec le dossier de trames vérifiées de l'agence et trois usages datés",
        },
        {
          temps: "10'",
          type: "demonstration",
          titre:
            "Démonstration : une trame vérifiée assemblée en direct à partir d'un besoin de la salle — le modèle de document, sa checklist avant diffusion, la liste des pièces sources dont les chiffres doivent provenir",
        },
        {
          temps: "10'",
          type: "pratique",
          titre:
            "Retour sur la journée : chacun relit ses propres demandes du jour et repère ce qui n'aurait pas dû être collé (données de clients, mandats, offres reçues)",
        },
        {
          temps: "35'",
          type: "pratique",
          titre:
            "Atelier : constituer le dossier de trames vérifiées de l'agence — trame d'annonce conforme, déclinaisons par support, réponses types prospects, écrits de gestion et de copropriété — chacune avec sa checklist avant diffusion, ses pièces sources et la phrase de refus des demandes hors périmètre",
        },
        {
          temps: "20'",
          type: "verification",
          titre:
            "Validation des acquis, corrigée en salle : quiz individuel (10 questions) puis passage de sa production de la journée à la grille de critères fournie",
        },
        {
          temps: "10'",
          type: "synthese",
          titre:
            "Synthèse et feuille de route : trois usages datés, un usage écarté, la personne qui relit avant publication — puis clôture",
        },
      ],
    },
  ],
  faqs: [
    {
      question: "L'IA peut-elle estimer un bien à notre place ?",
      reponse:
        "Non : l'estimation reste votre expertise. L'IA vous aide à structurer les comparatifs de marché, à rédiger l'argumentaire de prix et le dossier d'estimation — le jugement professionnel reste le vôtre.",
    },
    {
      question: "Les annonces générées respectent-elles la réglementation ?",
      reponse:
        "La formation intègre les règles du secteur (mentions obligatoires, loi Alur, DPE) dans les trames travaillées. La relecture finale reste humaine, comme pour tout écrit produit avec l'IA.",
    },
    {
      question: "Est-ce adapté à la gestion locative et au syndic ?",
      reponse:
        "Oui : les méthodes s'appliquent aux courriers de gestion, aux états des lieux commentés, aux réponses aux locataires et copropriétaires — les ateliers s'adaptent aux activités des participants.",
    },
  ],
};

const IA_POUR_LE_COMMERCE: FormationV2 = {
  id: "ia-pour-le-commerce",
  slugFr: "ia-pour-le-commerce",
  slugEn: "ai-for-retail",
  numero: 17,
  gamme: "ia-standard",
  categorie: "secteur",
  axeLabelFr: "Commerce / Retail",
  duree: "1j",
  titreFr: "IA pour le commerce",
  accrocheFr:
    "Fiches produits, avis clients, ventes : gagnez sur tous les tableaux — optimiser l'ensemble de son activité",
  h1Fr: "Formation IA pour le commerce : optimiser l'ensemble de son activité",
  metaTitleFr: "Formation IA pour le commerce — 1 jour",
  metaDescriptionFr:
    "Formation IA commerce et retail, 1 jour : fiches produits, réponses aux avis clients, analyse des ventes, supports en point de vente. 2 200 € HT par groupe.",
  termesSemantiquesFr: [
    "formation IA commerce",
    "IA retail",
    "fiche produit IA",
    "réponse avis clients IA",
    "IA e-commerce",
    "IA point de vente",
  ],
  publicViseFr:
    "Responsables de magasin, équipes vente et merchandising, commerce physique et e-commerce. Le commerce vit au rythme du contenu et de la relation client : cette journée montre comment l'IA accélère la production de fiches produits et le suivi des avis, pour vendre plus et mieux.",
  casUsageFr: [
    { texteFr: "La rédaction de fiches produits et de contenus e-commerce" },
    { texteFr: "Des réponses aux avis et messages clients facilitées" },
    { texteFr: "L'aide à l'analyse des ventes" },
    { texteFr: "Des supports de communication en point de vente" },
  ],
  objectifsFr: [
    "Rédiger fiches produits et contenus e-commerce à l'aide de l'IA",
    "Rédiger des réponses aux avis et messages clients",
    "Analyser des ventes avec l'appui de l'IA",
    "Produire des supports de communication en point de vente",
    "Appliquer les règles de confidentialité",
  ],
  beneficeDirigeantFr:
    "Une production de contenu accélérée et un meilleur suivi de la satisfaction client — les fiches sortent plus vite et les avis ne restent plus sans réponse.",
  equationTempsFr:
    "1 journée → une fiche produit complète rédigée en quelques minutes à partir de quelques caractéristiques.",
  avantApresFr: {
    avant: "Des fiches produits et contenus produits lentement, des avis traités au fil de l'eau.",
    apres: "Une production de contenu accélérée, un meilleur suivi de la satisfaction client.",
  },
  programme: [
    {
      titreFr: "Matin · Module 1 — Une fiche produit qui vend et qui n'invente rien",
      steps: [
        {
          temps: "5'",
          type: "objectif",
          titre:
            "Objectif du module : à la fin, vous produisez une fiche produit publiable et vous savez, ligne par ligne, ce qui doit être vérifié avant publication",
        },
        {
          temps: "15'",
          type: "demonstration",
          titre:
            "Démonstration avant / après : la même fiche écrite à la main, puis trois lignes de fiche technique fournisseur transformées en fiche produit complète — prompt affiché en entier, un seul outil",
        },
        {
          temps: "15'",
          type: "cadre",
          titre:
            "Ce qu'une fiche doit obligatoirement porter (caractéristiques essentielles, prix, disponibilité, garantie légale, conditions de retour) et les affirmations qui exposent (allégation de santé, allégation environnementale, caractéristique inventée) — fiche de référence fournie dans le kit formateur, lue telle quelle et jamais improvisée ; règle de la journée : aucune caractéristique publiée que la fiche technique du fournisseur ne prouve",
        },
        {
          temps: "15'",
          type: "pratique",
          titre:
            "Prise en main : chacun dépose une fiche technique fournisseur et en fait ressortir la fiche produit, sans rien ajouter",
        },
        {
          temps: "30'",
          type: "pratique",
          titre:
            "Pratique chronométrée : chacun rédige deux fiches complètes sur ses propres produits, dans le format de son canal de vente",
        },
        {
          temps: "10'",
          type: "verification",
          titre:
            "Vérification corrigée en salle : avec la grille fournie, le binôme barre chaque affirmation que la fiche technique ne prouve pas, puis on compte les barres à voix haute",
        },
        {
          temps: "5'",
          type: "synthese",
          titre: "Synthèse : je produis vite, et je ne publie que ce qui est prouvé",
        },
        { temps: "15'", type: "pause", titre: "Pause" },
      ],
    },
    {
      titreFr: "Matin · Module 2 — Du un au cinquante : produire en série et décliner",
      steps: [
        {
          temps: "5'",
          type: "objectif",
          titre:
            "Objectif du module : passer d'une fiche à une série homogène, et décliner un même produit sur tous vos supports sans le réécrire",
        },
        {
          temps: "15'",
          type: "cadre",
          titre:
            "Avant de produire en série : ce qu'on ne colle jamais (fichier clients, chiffre d'affaires, marges, conditions d'achat fournisseurs — retirer les noms d'un fichier client ne le fait pas sortir du RGPD), et ce que le modèle ajoute tout seul (formulations stéréotypées sur le genre, l'âge ou l'origine, qui se répliquent à l'identique sur les cinquante fiches) — liste rouge et exemples de biais fournis dans le kit formateur",
        },
        {
          temps: "15'",
          type: "demonstration",
          titre:
            "Démonstration : un tableau de vingt produits devient vingt fiches homogènes, puis un produit décliné site / place de marché / affiche de rayon — la trame, les colonnes et le prompt affichés en entier",
        },
        {
          temps: "40'",
          type: "pratique",
          titre:
            "Atelier chronométré : chacun produit une série à partir de son propre tableau produits, puis décline un produit sur trois supports dont un support de point de vente",
        },
        {
          temps: "20'",
          type: "verification",
          titre:
            "Vérification : contrôle par échantillonnage — le binôme tire trois fiches au hasard et vérifie prix, caractéristiques, mentions obligatoires et formulations stéréotypées ; si une fiche tombe, toute la série repasse",
        },
        {
          temps: "5'",
          type: "synthese",
          titre: "Synthèse : je sais produire une série ET la contrôler sans tout relire",
        },
      ],
    },
    {
      titreFr:
        "Après-midi · Module 3 — Avis clients, fiche d'établissement et écrire autour du chiffre",
      steps: [
        {
          temps: "5'",
          type: "objectif",
          titre:
            "Objectif du module : répondre publiquement à un avis difficile sans engager l'enseigne, et commenter vos chiffres sans jamais les livrer",
        },
        {
          temps: "10'",
          type: "cadre",
          titre:
            "L'interdit absolu : on ne fabrique jamais un avis, un témoignage ni une note, et on ne fait jamais écrire un avis par l'IA — c'est une pratique commerciale trompeuse sanctionnée (code de la consommation, article L.121-4) ; l'IA rend la fabrication trop facile pour laisser la règle implicite",
        },
        {
          temps: "10'",
          type: "cadre",
          titre:
            "Répondre en public sans en dire trop : ne jamais confirmer une commande, une visite, une adresse ni un élément personnel dans une réponse visible de tous ; et ce qu'il faut déclarer au client — un agent conversationnel doit se présenter comme une machine et un visuel de synthèse doit être identifiable (règlement européen sur l'IA, règlement (UE) 2024/1689, obligations de transparence de l'article 50)",
        },
        {
          temps: "10'",
          type: "demonstration",
          titre:
            "Démonstration : un avis à une étoile, deux réponses générées — celle qui aggrave et celle qui referme — prompts affichés en entier, différence commentée mot à mot",
        },
        {
          temps: "35'",
          type: "pratique",
          titre:
            "Atelier chronométré : chacun répond à trois avis réels de son enseigne (un positif, un négatif, un injustifié) sur ses avis produit et place de marché, puis complète une réponse type pour sa fiche d'établissement locale",
        },
        {
          temps: "10'",
          type: "verification",
          titre:
            "Vérification : relecture croisée sur la grille fournie — ce qui divulgue une donnée personnelle, ce qui promet un geste commercial, ce qui engage l'enseigne ; chaque réponse est déclarée publiable ou renvoyée",
        },
        {
          temps: "10'",
          type: "demonstration",
          titre:
            "Écrire autour du chiffre : démonstration de ce que l'IA sait faire (écrire la formule, expliquer un tableau croisé, rédiger le commentaire d'un résultat déjà calculé) et de ce qu'elle rate (calculer sur des données collées) — la même question posée deux fois donne deux totaux différents, montré en direct",
        },
        {
          temps: "10'",
          type: "pratique",
          titre:
            "Pratique : chacun fait écrire la formule ou le tableau croisé dont il a besoin en décrivant la structure de son tableau (noms de colonnes, type de valeurs), jamais son contenu, puis la teste sur son fichier",
        },
        {
          temps: "5'",
          type: "synthese",
          titre:
            "Synthèse : je réponds vite sans exposer le magasin, et je fais écrire autour du chiffre sans le sortir",
        },
        { temps: "15'", type: "pause", titre: "Pause" },
      ],
    },
    {
      titreFr: "Après-midi · Module 4 — Le manuel de publication de l'enseigne",
      steps: [
        {
          temps: "5'",
          type: "objectif",
          titre:
            "Objectif du module : repartir avec le manuel de publication de l'enseigne, utilisable dès le lendemain par un vendeur qui n'était pas en salle",
        },
        {
          temps: "10'",
          type: "demonstration",
          titre:
            "Démonstration : une trame de la journée transformée en consigne réutilisable — la même demande rejouée sur un autre produit doit rendre exactement le même format, sinon la trame n'est pas finie",
        },
        {
          temps: "10'",
          type: "pratique",
          titre:
            "Retour sur ses propres demandes : chacun relit l'historique de sa journée et repère ce qui n'aurait pas dû être collé (fichier clients, marges, conditions fournisseurs), puis réécrit une demande fautive",
        },
        {
          temps: "30'",
          type: "pratique",
          titre:
            "Atelier : assembler le manuel de publication — trame de fiche produit et sa checklist de contrôle, procédé de production en série et sa règle d'échantillonnage, réponses types aux avis produit et place de marché, trames de supports de rayon",
        },
        {
          temps: "20'",
          type: "verification",
          titre:
            "Validation des acquis : quiz individuel de 10 questions corrigé en salle, puis passage de sa propre production du jour à la grille de critères fournie (mentions obligatoires, caractéristiques prouvées, rien de personnel publié)",
        },
        {
          temps: "10'",
          type: "pratique",
          titre:
            "Feuille de route : trois usages datés, un usage explicitement écarté, et le nom de la personne qui relit avant publication — inscrits dans le manuel",
        },
        {
          temps: "5'",
          type: "synthese",
          titre:
            "Synthèse et clôture : ce que je publie seul, ce que je fais relire, ce que je ne fais pas faire à l'IA",
        },
      ],
    },
  ],
  faqs: [
    {
      question: "Est-ce adapté à un commerce physique sans e-commerce ?",
      reponse:
        "Oui : les ateliers s'adaptent — réponses aux avis Google, supports en point de vente, communication locale, analyse des ventes. Le e-commerce n'est qu'un des terrains d'application.",
    },
    {
      question: "Les fiches produits générées sont-elles bonnes pour le référencement ?",
      reponse:
        "La journée intègre les bonnes pratiques : structure, vocabulaire client, différenciation. L'IA accélère la production ; la relecture garantit la qualité et l'exactitude des caractéristiques.",
    },
    {
      question: "Combien de personnes du magasin peuvent participer ?",
      reponse:
        "Jusqu'à 15 participants par groupe, tous profils : responsables, vendeurs, merchandising. Le prix est par groupe, pas par personne.",
    },
  ],
};

const IA_POUR_L_HOTELLERIE_RESTAURATION: FormationV2 = {
  id: "ia-pour-l-hotellerie-restauration",
  slugFr: "ia-pour-l-hotellerie-restauration",
  slugEn: "ai-for-hospitality",
  numero: 18,
  gamme: "ia-standard",
  categorie: "secteur",
  axeLabelFr: "Hôtellerie-Restauration",
  duree: "1j",
  titreFr: "IA pour l'hôtellerie-restauration",
  accrocheFr:
    "Répondez à chaque client, sans y passer vos soirées — gagner en efficacité au quotidien",
  h1Fr: "Formation IA pour l'hôtellerie-restauration : gagner en efficacité au quotidien",
  metaTitleFr: "Formation IA hôtellerie-restauration — 1 jour",
  metaDescriptionFr:
    "Formation IA hôtellerie-restauration (1 jour, intra) : réponses aux avis, réservations, menus et supports, planification des équipes. 2 200 € HT par groupe.",
  termesSemantiquesFr: [
    "formation IA hôtellerie",
    "IA restauration",
    "réponse avis clients hôtel",
    "IA réservations",
    "menus IA",
    "IA CHR",
  ],
  publicViseFr:
    "Direction d'établissement, personnel administratif et d'accueil — hôtels, restaurants, établissements CHR. Avis en ligne, réservations, communication : la relation client ne s'arrête jamais ; cette journée montre comment l'IA vous aide à répondre plus vite et mieux, tout en soignant votre image.",
  casUsageFr: [
    { texteFr: "Des réponses aux avis et messages de réservation facilitées" },
    { texteFr: "La rédaction de menus et de supports de communication" },
    { texteFr: "L'aide à la planification des équipes" },
    { texteFr: "Un suivi administratif courant allégé" },
  ],
  objectifsFr: [
    "Rédiger des réponses aux avis et messages de réservation à l'aide de l'IA",
    "Rédiger menus et supports de communication",
    "Utiliser l'IA en appui à la planification des équipes",
    "Produire un suivi administratif courant",
    "Appliquer les règles de confidentialité",
  ],
  beneficeDirigeantFr:
    "Des réponses plus rapides et mieux soignées, des supports produits plus facilement — l'image de l'établissement est soignée sans y passer les soirées.",
  equationTempsFr:
    "1 journée → une réponse soignée à un avis client rédigée en moins d'une minute, prête à personnaliser.",
  avantApresFr: {
    avant:
      "Une gestion des avis et réservations chronophage, une communication produite dans l'urgence.",
    apres: "Des réponses plus rapides et mieux soignées, des supports produits plus facilement.",
  },
  programme: [
    {
      titreFr:
        "Matin · Module 1 — Ce que l'IA fait pour l'établissement, et ce qu'on ne lui confie jamais",
      steps: [
        {
          temps: "5'",
          type: "objectif",
          titre:
            "Le résultat visé : savoir dire, pour chaque pièce de l'établissement, si on la soumet à l'IA, sous quel compte, et ce qu'on en retire d'abord",
        },
        {
          temps: "15'",
          type: "demonstration",
          titre:
            "Démonstration avant/après sur un avis du kit — aucune pièce de l'établissement à ce stade : la réponse écrite à la main, puis la même par la méthode AXION (Acteur, conteXte, Intention, Output, Normes), prompt affiché en entier, un seul assistant",
        },
        {
          temps: "15'",
          type: "cadre",
          titre:
            "Les trois régimes d'usage et le cadre européen : compte personnel, offre entreprise avec engagement de non-réutilisation, environnement validé par l'établissement. Le règlement européen sur l'IA (règlement (UE) 2024/1689) impose d'informer le client quand une machine lui répond. RGPD : pseudonymiser n'est pas anonymiser — un avis dont on retire le nom se ré-identifie par la date du séjour et le numéro de chambre",
        },
        {
          temps: "35'",
          type: "pratique",
          titre:
            "Atelier « où passent mes données » : chaque table confronte ses propres pièces aux trois régimes, puis écrit la liste rouge de l'établissement — coordonnées et séjours des clients, fiches techniques et allergènes, mentions « fait maison » et origine, plannings nominatifs, identifiants de connexion",
        },
        {
          temps: "15'",
          type: "verification",
          titre:
            "Vérification corrigée en salle : dix pièces réelles projetées, chacun répond « je la soumets / je ne la soumets pas / sous quel compte », correction collective avec le corrigé du kit",
        },
        {
          temps: "5'",
          type: "synthese",
          titre:
            "Synthèse — trois acquis : je choisis mon compte avant d'écrire, je consulte la liste rouge avant de coller, je dis au client quand une machine lui répond",
        },
        { temps: "15'", type: "pause", titre: "Pause" },
      ],
    },
    {
      titreFr: "Matin · Module 2 — Avis en ligne, messages et demandes de réservation",
      steps: [
        {
          temps: "5'",
          type: "objectif",
          titre:
            "Le résultat visé : une réponse publique prête à publier, dans le ton de la maison, qui ne révèle rien du séjour",
        },
        {
          temps: "10'",
          type: "cadre",
          titre:
            "Ce qu'on ne publie jamais : aucun élément du séjour (dates, chambre, montant, régime alimentaire), aucun fait non vérifié admis, aucun salarié nommé ou mis en cause, aucun geste commercial annoncé en public. Et le contrôle de biais, à faire avant chaque publication : rejouer la même demande en changeant le nom et l'origine du client, comparer les deux réponses — exemple capturé dans le kit",
        },
        {
          temps: "15'",
          type: "demonstration",
          titre:
            "Démonstration avant/après sur l'avis négatif du kit : la réponse spontanée, puis la réponse conforme aux quatre interdits — prompt affiché en entier, un seul assistant",
        },
        {
          temps: "50'",
          type: "pratique",
          titre:
            "Atelier chronométré : chacun traite trois avis de son établissement (un positif, un négatif, un injuste) et deux messages de réservation (demande particulière, relance après réservation non honorée), à partir des trames du kit",
        },
        {
          temps: "20'",
          type: "verification",
          titre:
            "Contrôle croisé en binôme sur la grille fournie : rien du séjour, aucun fait admis, aucun salarié nommé, ton de la maison, publiable telle quelle — chaque texte revient corrigé à son auteur",
        },
        {
          temps: "5'",
          type: "synthese",
          titre:
            "Synthèse — deux acquis : je réponds sans jamais confirmer le séjour, je fais relire par un binôme avant publication",
        },
      ],
    },
    {
      titreFr: "Après-midi · Module 3 — Carte, supports et demandes de groupes",
      steps: [
        {
          temps: "5'",
          type: "objectif",
          titre:
            "Le résultat visé : une carte traduite ou une proposition de groupe prête à envoyer, dont chaque mention réglementée a été revalidée sur fiche technique",
        },
        {
          temps: "15'",
          type: "cadre",
          titre:
            "Ce qui est réglementé sur une carte, AVANT d'y toucher : les 14 allergènes à déclarer (règlement (UE) n° 1169/2011, annexe II), l'origine des viandes servies, la mention « fait maison », les appellations et labels protégés. Checklist du kit projetée puis remise. Règle posée : l'IA rédige, la fiche technique fait foi, rien de réglementé ne part sans double lecture",
        },
        {
          temps: "15'",
          type: "demonstration",
          titre:
            "Démonstration sur le jeu du kit : la fiche technique devient un descriptif de plat, puis sa version anglaise — dans la traduction fournie, la moutarde a disparu de la sauce et le gluten a changé de ligne ; les deux écarts sont déjà surlignés dans le corrigé, aucune compétence linguistique n'est requise du formateur",
        },
        {
          temps: "50'",
          type: "pratique",
          titre:
            "Atelier chronométré, au choix : traduire et adapter une partie de sa carte, ou monter une proposition de groupe complète — devis, message d'envoi, relance, réponses aux dix questions récurrentes des clients (liste fournie)",
        },
        { temps: "15'", type: "pause", titre: "Pause" },
        {
          temps: "25'",
          type: "verification",
          titre:
            "Revalidation croisée sur fiche technique avec la checklist du kit : allergènes, origine des viandes, « fait maison », appellations — chaque production est passée ligne à ligne par un binôme, écarts relevés et corrigés en salle",
        },
        {
          temps: "5'",
          type: "synthese",
          titre:
            "Synthèse — deux acquis : je ne diffuse aucune mention réglementée sans l'avoir relue sur la fiche technique, je fais valider la carte par la cuisine avant impression",
        },
      ],
    },
    {
      titreFr: "Après-midi · Module 4 — Fiabiliser, évaluer, installer",
      steps: [
        {
          temps: "5'",
          type: "objectif",
          titre:
            "Le résultat visé : repérer soi-même ce que l'IA vient d'inventer sur son propre établissement, et repartir avec un document utilisable dès le lendemain",
        },
        {
          temps: "10'",
          type: "demonstration",
          titre:
            "Démonstration : une présentation d'établissement produite par l'IA, cinq erreurs plantées et listées dans le corrigé du kit (capacité, horaires, label, prix, prestation inexistante) — les trois vérifications qui les font tomber",
        },
        {
          temps: "30'",
          type: "pratique",
          titre:
            "Chasse à l'erreur chronométrée : chacun fait produire une présentation de SON établissement, surligne ce qui est faux, compte, puis écrit les faits exacts dans sa fiche d'identité",
        },
        {
          temps: "25'",
          type: "verification",
          titre:
            "Quiz individuel de validation des acquis (10 questions), puis correction commentée question par question, chaque réponse renvoyant à la séquence qui traitait le point",
        },
        {
          temps: "10'",
          type: "synthese",
          titre:
            "Synthèse et feuille de route : on assemble la fiche d'identité IA de l'établissement, on nomme qui répond aux avis et sous quel délai, qui valide les mentions réglementées, et les trois usages installés dès la semaine suivante",
        },
      ],
    },
  ],
  faqs: [
    {
      question: "Les réponses aux avis ne vont-elles pas sembler artificielles ?",
      reponse:
        "Non : on apprend à faire produire des réponses dans le ton de votre établissement, personnalisées par le détail de l'avis, puis relues avant publication. L'objectif est de répondre à chaque client — vite et bien.",
    },
    {
      question: "Est-ce utile pour un petit restaurant indépendant ?",
      reponse:
        "Oui : c'est même là que le gain est le plus net — le gérant récupère les heures passées le soir sur les avis, les messages et la communication. Le prix est par groupe, l'équipe entière peut participer.",
    },
    {
      question: "Peut-on traduire nos menus et messages pour la clientèle étrangère ?",
      reponse:
        "Oui, c'est un des ateliers du module menus et communication : traduction et adaptation de vos cartes et messages types, avec relecture finale humaine.",
    },
  ],
};

const IA_POUR_L_INDUSTRIE: FormationV2 = {
  id: "ia-pour-l-industrie",
  slugFr: "ia-pour-l-industrie",
  slugEn: "ai-for-industry",
  numero: 19,
  gamme: "ia-standard",
  categorie: "secteur",
  axeLabelFr: "Industrie",
  duree: "2j",
  scindable: true,
  titreFr: "IA pour l'industrie",
  accrocheFr:
    "Qualité, maintenance, production : un pilotage plus net — optimiser l'ensemble de la production",
  h1Fr: "Formation IA pour l'industrie : optimiser l'ensemble de la production (2 jours)",
  metaTitleFr: "Formation IA pour l'industrie — 2 jours",
  metaDescriptionFr:
    "Formation IA industrie, 2 jours scindables : suivi qualité, reporting, documentation de maintenance, automatisation du suivi. 3 900 € HT par groupe.",
  termesSemantiquesFr: [
    "formation IA industrie",
    "IA usine",
    "reporting qualité IA",
    "documentation maintenance IA",
    "IA production industrielle",
    "automatisation suivi industriel",
  ],
  publicViseFr:
    "Responsables de production, qualité et maintenance des sites industriels. Le reporting qualité et la documentation de maintenance mobilisent un temps considérable : ces deux jours mettent l'IA au service de votre production, jusqu'aux premiers cas d'automatisation du suivi.",
  prerequisFr:
    "Aucun prérequis technique poussé. Une pratique régulière des outils bureautiques suffit.",
  casUsageFr: [
    { texteFr: "Le suivi qualité et le reporting assistés par l'IA" },
    { texteFr: "L'aide à la documentation de maintenance" },
    { texteFr: "La synthèse des données de production" },
    { texteFr: "Les premiers cas d'automatisation sur des tâches de suivi" },
  ],
  objectifsFr: [
    "Produire suivi qualité et reporting à l'aide de l'IA",
    "Rédiger de la documentation de maintenance",
    "Synthétiser des données de production",
    "Identifier et prototyper une première automatisation de suivi",
    "Appliquer les règles de confidentialité",
  ],
  beneficeDirigeantFr:
    "Un suivi plus structuré et une documentation qualité et maintenance tenue à jour plus facilement — le pilotage gagne en netteté, les équipes en temps.",
  equationTempsFr:
    "2 jours → un rapport qualité mis en forme en quelques minutes à partir des données du jour.",
  avantApresFr: {
    avant: "Un reporting qualité et une maintenance chronophages, des données dispersées.",
    apres:
      "Un suivi plus structuré, une documentation qualité et maintenance tenue à jour plus facilement.",
  },
  materielFr:
    "Ordinateur portable, connexion internet, accès aux outils IA et aux données de production concernées",
  programme: [
    {
      titreFr:
        "Matin J1 · Module 1 — Le système documentaire du site face à l'IA : ce qui sort, ce qui ne sort jamais",
      steps: [
        {
          temps: "5'",
          type: "objectif",
          titre:
            "Le résultat visé : savoir, devant n'importe quelle pièce du système documentaire du site, si on peut la déposer dans un assistant, dans quel environnement, ou pas du tout — et pouvoir le justifier devant un auditeur",
        },
        {
          temps: "15'",
          type: "cadre",
          titre:
            "Les trois régimes d'usage (compte grand public, offre entreprise avec engagement de non-réutilisation, environnement validé par la DSI) et les engagements qui s'ajoutent au RGPD sur un site industriel : accord de confidentialité du donneur d'ordre, secret des affaires, propriété des plans et nomenclatures — un document reste couvert par la clause même quand on en a retiré le nom du client",
        },
        {
          temps: "15'",
          type: "demonstration",
          titre:
            "Démonstration « pseudonymiser n'est pas anonymiser » : un rapport d'incident dont on a retiré le nom de l'opérateur, ré-identifié devant la salle en trois questions (équipe, poste de la ligne, date de l'arrêt) — un seul outil, prompt affiché en entier, script de relance fourni au formateur",
        },
        {
          temps: "35'",
          type: "pratique",
          titre:
            "Atelier chronométré : chaque table écrit la liste rouge du site sur la trame fournie (plans et nomenclatures, paramètres et gammes de fabrication, cahiers des charges clients sous accord, données nominatives d'opérateurs) puis classe quinze pièces réelles du système documentaire en trois colonnes selon le régime d'usage",
        },
        {
          temps: "20'",
          type: "verification",
          titre:
            "Vérification corrigée en salle : dix pièces tirées de la trame — « je la dépose, dans quel environnement, ou pas du tout » — chacun répond seul, correction collective, les écarts sont comptés",
        },
        {
          temps: "5'",
          type: "synthese",
          titre:
            "Synthèse : les trois phrases affichables au service qualité — ce qu'on dépose, où, et qui tranche en cas de doute",
        },
        { temps: "15'", type: "pause", titre: "Pause" },
      ],
    },
    {
      titreFr:
        "Matin J1 · Module 2 — Non-conformités et réclamations clients : de la note brute à la fiche exploitable",
      steps: [
        {
          temps: "5'",
          type: "objectif",
          titre:
            "Le résultat visé : une fiche de non-conformité complète — fait, analyse de cause, action corrective, preuve attendue — et la réponse client qui en découle, rédigées à partir de notes brutes",
        },
        {
          temps: "15'",
          type: "demonstration",
          titre:
            "Démonstration avant / après : la même non-conformité en trois lignes illisibles, puis en fiche exploitable et en réponse client structurée — méthode AXION (Acteur, conteXte, Intention, Output, Normes), prompt affiché en entier, un seul outil ; et les deux endroits où l'assistant a inventé une cause qui n'existe pas",
        },
        {
          temps: "50'",
          type: "pratique",
          titre:
            "Atelier chronométré : chacun traite une non-conformité interne et une réclamation client réelles, sur pièces préparées selon la règle du module 1 — sortie attendue : la fiche renseignée, la liste des questions à poser au producteur du défaut, et le projet de réponse au client",
        },
        {
          temps: "25'",
          type: "verification",
          titre:
            "Contrôle croisé en binôme sur la grille fournie : le fait est-il séparé de l'hypothèse ? l'action est-elle vérifiable et datée ? une cause a-t-elle été inventée ? tout chiffre repris est-il retrouvable dans la pièce source ? chaque binôme compte ses écarts et corrige",
        },
        {
          temps: "5'",
          type: "synthese",
          titre:
            "Synthèse : l'IA fait parler la note brute et tient la structure, le responsable qualité tranche la cause et signe la réponse",
        },
      ],
    },
    {
      titreFr:
        "Après-midi J1 · Module 3 — Maîtrise documentaire : mettre à jour une procédure sans casser sa traçabilité",
      steps: [
        {
          temps: "5'",
          type: "objectif",
          titre:
            "Le résultat visé : une procédure existante mise à jour, accompagnée de sa fiche d'évolution de version (ce qui change, pourquoi, qui est impacté, qui valide) — lisible par celui qui l'exécute",
        },
        {
          temps: "15'",
          type: "cadre",
          titre:
            "Avant de toucher au premier document : tout écrit à portée sécurité — mode opératoire, consigne de poste, plan de prévention, analyse de risques — est revalidé par le responsable HSE avant diffusion, et la validation laisse une trace datée dans le système documentaire. Ce qui n'a pas cette trace ne s'affiche pas et ne remplace pas la version en vigueur. La règle est écrite au tableau et reprise dans le livrable",
        },
        {
          temps: "15'",
          type: "demonstration",
          titre:
            "Démonstration avant / après : une procédure de contrôle réécrite par l'assistant — ce qu'il améliore (structure, ordre des étapes, langage) et les trois pièges observés en direct : la référence de norme inventée, l'étape de sécurité supprimée par souci de concision, l'indice de version perdu. Prompt affiché en entier, un seul outil",
        },
        {
          temps: "40'",
          type: "pratique",
          titre:
            "Atelier chronométré : chacun met à jour une procédure réelle de son site et produit sa fiche d'évolution de version sur la trame fournie, en marquant explicitement les paragraphes qui devront repasser par la HSE avant diffusion",
        },
        {
          temps: "20'",
          type: "verification",
          titre:
            "Vérification croisée en binôme sur la grille fournie : aucune étape de sécurité perdue entre l'ancienne et la nouvelle version, chaque référence normative citée retrouvée dans le document déposé, l'indice de version et le circuit de validation renseignés, les paragraphes à revalider identifiés — correction en salle",
        },
        {
          temps: "5'",
          type: "synthese",
          titre:
            "Synthèse : on met à jour un document maîtrisé, on ne le réécrit jamais sans tracer ce qui a changé ni qui l'a validé",
        },
        { temps: "15'", type: "pause", titre: "Pause" },
      ],
    },
    {
      titreFr:
        "Après-midi J1 · Module 4 — Questionnaires clients, audits fournisseurs et dossiers de qualification",
      steps: [
        {
          temps: "5'",
          type: "objectif",
          titre:
            "Le résultat visé : une réponse complète à un questionnaire client ou à un audit fournisseur, appuyée sur les documents du site et non sur la mémoire de celui qui répond",
        },
        {
          temps: "15'",
          type: "demonstration",
          titre:
            "Démonstration : les documents de référence du site déposés (manuel qualité, certificats, procédures), puis un questionnaire client traité question par question — et la phrase que l'assistant a affirmée sans qu'aucun document ne l'appuie. Prompt affiché en entier, un seul outil",
        },
        {
          temps: "45'",
          type: "pratique",
          titre:
            "Atelier chronométré : chacun répond à un questionnaire réel — questionnaire client, dossier de qualification, ou grille d'audit fournisseur adressée à un sous-traitant — et marque en face de chaque réponse la pièce qui la prouve",
        },
        {
          temps: "20'",
          type: "verification",
          titre:
            "Vérification aux sources en binôme : toute réponse sans pièce de preuve en face est barrée et transformée en question à poser en interne — on compte combien de réponses ne tenaient pas",
        },
        {
          temps: "10'",
          type: "synthese",
          titre:
            "Synthèse du jour 1 : trois acquis — je sais dire ce qui peut sortir du site, je sais transformer une note brute en fiche opposable, je ne réponds jamais à un client sans la pièce qui prouve",
        },
      ],
    },
    {
      titreFr: "Matin J2 · Module 5 — Préparer une certification ou un audit client",
      steps: [
        {
          temps: "5'",
          type: "objectif",
          titre:
            "Le résultat visé : le dossier d'audit dégrossi — écarts précédents repris, preuves attendues listées, revue d'écart et plan d'action daté",
        },
        {
          temps: "15'",
          type: "demonstration",
          titre:
            "Démonstration : un référentiel déposé puis interrogé exigence par exigence — et la référence d'exigence que l'assistant a inventée en chemin, retrouvée en trois secondes par recherche dans le document. Prompt affiché en entier, un seul outil",
        },
        {
          temps: "45'",
          type: "pratique",
          titre:
            "Atelier chronométré : chacun prépare la revue d'écart de son site à partir du référentiel réellement applicable (norme de système, exigence client, référentiel donneur d'ordre) et rédige le plan d'action correspondant — une ligne par écart, avec porteur, échéance et preuve attendue",
        },
        {
          temps: "25'",
          type: "verification",
          titre:
            "Vérification aux sources en binôme : chaque exigence citée doit être retrouvée dans le document déposé, sinon la phrase saute ; chaque chiffre repris doit venir d'un enregistrement du site, jamais d'un calcul de l'assistant — on compte les phrases supprimées",
        },
        {
          temps: "10'",
          type: "synthese",
          titre:
            "Synthèse : l'IA dégrossit le dossier et pose les bonnes questions, l'auditeur ne discute qu'avec des preuves",
        },
        { temps: "15'", type: "pause", titre: "Pause" },
      ],
    },
    {
      titreFr:
        "Matin J2 · Module 6 — Ce que l'IA ne décide jamais sur un site : les personnes, et la conformité produit",
      steps: [
        {
          temps: "5'",
          type: "objectif",
          titre:
            "Le résultat visé : savoir dire, devant un projet de suivi ou de contrôle automatisé, si l'on est encore sur de l'activité ou déjà sur l'évaluation d'une personne — et ce que cela déclenche avant toute mise en service",
        },
        {
          temps: "20'",
          type: "cadre",
          titre:
            "Le cadre, posé avant l'atelier : dès qu'un suivi porte sur des indicateurs individuels (cadences, rebuts par opérateur, temps par poste), on est sur le suivi et l'évaluation de la performance des travailleurs, usage classé à haut risque par le règlement européen sur l'IA — avec information préalable des salariés et consultation des représentants du personnel avant toute mise en service : qui la déclenche, à quel moment, avec quelle trace. Et la borne produit : la décision de libération de lot et la signature d'une déclaration de conformité restent celles d'une personne désignée, jamais d'un système",
        },
        {
          temps: "15'",
          type: "demonstration",
          titre:
            "Démonstration de biais : la même évaluation soumise deux fois avec une variable de plus (ancienneté, équipe, site d'origine) — l'avis rendu change à l'écran, sans qu'aucune donnée de performance n'ait bougé. Prompt affiché en entier, un seul outil, jeu de données fictif fourni dans le kit",
        },
        {
          temps: "35'",
          type: "pratique",
          titre:
            "Atelier chronométré : chaque table qualifie trois dispositifs réels du site (cadences par ligne, rebuts par opérateur, temps par poste, géolocalisation des engins, contrôle qualité par vision) avec la grille en quatre questions — y a-t-il des données personnelles, un effet sur une personne, une obligation de sécurité, une décision sans relecture ? — et tranche : agrégation, abandon, ou dossier d'information préalable à monter",
        },
        {
          temps: "15'",
          type: "verification",
          titre:
            "Vérification : correction collective des qualifications à la grille, table par table — les désaccords sont arbitrés en salle et la règle retenue est écrite",
        },
        {
          temps: "5'",
          type: "synthese",
          titre:
            "Synthèse : on assiste des écrits et des dossiers, jamais un jugement sur quelqu'un ni une décision de conformité produit",
        },
      ],
    },
    {
      titreFr: "Après-midi J2 · Module 7 — Écrire la procédure d'usage de l'IA du site",
      steps: [
        {
          temps: "5'",
          type: "objectif",
          titre:
            "Le résultat visé : la procédure d'usage de l'IA du site, rédigée, prête à être versée au manuel qualité et à être présentée à un auditeur",
        },
        {
          temps: "15'",
          type: "demonstration",
          titre:
            "Démonstration : une procédure d'usage type projetée et commentée point par point — périmètre autorisé, liste rouge, circuit de validation, traces conservées, conduite à tenir en cas de doute — et les trois endroits qu'un auditeur regarde en premier",
        },
        {
          temps: "45'",
          type: "pratique",
          titre:
            "Atelier chronométré : chacun rédige la procédure d'usage de l'IA de son site sur la trame fournie, en y reversant la liste rouge du module 1, la règle de revalidation HSE du module 3 et la grille de qualification du module 6",
        },
        {
          temps: "25'",
          type: "verification",
          titre:
            "Contrôle croisé en binôme sur la grille de relecture fournie : le périmètre est-il borné ? la liste rouge est-elle nommée ? qui valide est-il désigné par fonction et non par prénom ? les traces à conserver sont-elles listées ? la conduite en cas de doute est-elle écrite ? — correction et reprise immédiate",
        },
        {
          temps: "5'",
          type: "synthese",
          titre:
            "Synthèse : ce qui tient dans le temps, c'est une procédure datée et validée, pas une habitude individuelle",
        },
        { temps: "15'", type: "pause", titre: "Pause" },
      ],
    },
    {
      titreFr: "Après-midi J2 · Module 8 — Évaluation, revue des productions et feuille de route",
      steps: [
        {
          temps: "5'",
          type: "objectif",
          titre:
            "Le résultat visé : savoir ce qui est diffusable en l'état parmi ce qu'on a produit en deux jours, et par où commencer lundi",
        },
        {
          temps: "15'",
          type: "demonstration",
          titre:
            "Démonstration : la même demande passée trois fois de suite donne trois textes différents — pourquoi une production IA n'est jamais un enregistrement, et ce qu'il faut donc conserver côté site (le document validé et sa trace, pas la conversation)",
        },
        {
          temps: "20'",
          type: "verification",
          titre:
            "Quiz individuel de validation des acquis (10 questions couvrant les régimes d'usage, la liste rouge, la revalidation HSE, la vérification aux sources et la qualification des suivis) + correction commentée en salle",
        },
        {
          temps: "25'",
          type: "pratique",
          titre:
            "Revue des productions des deux jours à la grille de contrôle avant diffusion : chacun classe ses cinq documents en trois piles — diffusable en l'état, repasse par la qualité, repasse par la HSE — et note en face ce qui manque",
        },
        {
          temps: "25'",
          type: "pratique",
          titre:
            "Feuille de route du site : trois usages priorisés, un porteur et une échéance par ligne, ce qui doit passer devant la direction et devant les représentants du personnel avant tout déploiement — rédigée sur la trame fournie et lue à voix haute par chaque participant",
        },
        {
          temps: "10'",
          type: "synthese",
          titre:
            "Synthèse des deux jours : je sais ce qui sort du site et sous quel régime, je produis des documents opposables et non des brouillons, et j'ai une procédure écrite qui survivra à mon départ du service",
        },
      ],
    },
  ],
  faqs: [
    {
      question: "L'IA va-t-elle piloter nos machines ou notre GPAO ?",
      reponse:
        "Non : vos systèmes industriels (GPAO, GMAO, MES, supervision) restent maîtres des données et du pilotage. L'IA travaille sur ce qui les entoure — rapports, documentation, synthèses, suivi — là où partent des heures chaque semaine.",
    },
    {
      question: "Pourquoi 2 jours et un tarif différent des autres secteurs ?",
      reponse:
        "L'industrie cumule trois chantiers documentaires lourds (qualité, maintenance, production) et va jusqu'à l'automatisation du suivi, construite et testée au jour 2. Le format 2 jours est scindable en 2×1 jour.",
    },
    {
      question: "Nos procédés industriels sont confidentiels — comment est-ce géré ?",
      reponse:
        "Les procédés, paramètres et données clients ne sont jamais soumis à l'IA : les ateliers travaillent sur des données factices ou anonymisées, et les règles de confidentialité sont posées dès le premier module.",
    },
  ],
};

const IA_POUR_LE_TRANSPORT_LOGISTIQUE: FormationV2 = {
  id: "ia-pour-le-transport-logistique",
  slugFr: "ia-pour-le-transport-logistique",
  slugEn: "ai-for-transport-logistics",
  numero: 20,
  gamme: "ia-standard",
  categorie: "secteur",
  axeLabelFr: "Transport / Logistique",
  duree: "1j",
  titreFr: "IA pour le transport et la logistique",
  accrocheFr:
    "Des tournées mieux préparées, des documents produits en un instant — optimiser l'ensemble de l'activité",
  h1Fr: "Formation IA pour le transport et la logistique : optimiser l'ensemble de l'activité",
  metaTitleFr: "Formation IA transport et logistique — 1 jour",
  metaDescriptionFr:
    "Formation IA transport et logistique, 1 jour : planification de tournées, reporting, documents de transport, communication clients. 2 200 € HT par groupe.",
  termesSemantiquesFr: [
    "formation IA transport",
    "IA logistique",
    "planification tournées IA",
    "documents de transport IA",
    "IA exploitation transport",
    "reporting logistique IA",
  ],
  publicViseFr:
    "Exploitants, responsables logistique, personnel administratif des entreprises de transport et de logistique. Planification, suivi, documents de transport : le quotidien de l'exploitation est dense — cette journée montre comment l'IA fluidifie ces tâches pour gagner en réactivité.",
  casUsageFr: [
    { texteFr: "L'aide à la planification de tournées" },
    { texteFr: "Le suivi et le reporting d'activité" },
    { texteFr: "La rédaction de documents de transport" },
    { texteFr: "La communication avec clients et sous-traitants assistée par l'IA" },
  ],
  objectifsFr: [
    "Utiliser l'IA en appui à la planification de tournées",
    "Produire suivi et reporting d'activité",
    "Rédiger des documents de transport",
    "Rédiger la communication avec clients et sous-traitants",
    "Appliquer les règles de confidentialité",
  ],
  beneficeDirigeantFr:
    "Une planification facilitée et des documents produits plus rapidement — l'exploitation gagne en réactivité sur toute la chaîne.",
  equationTempsFr:
    "1 journée → un document de transport rempli en quelques minutes à partir des informations de la commande.",
  avantApresFr: {
    avant: "Une planification et un suivi manuels, des documents produits lentement.",
    apres: "Une planification facilitée, des documents et un reporting produits plus rapidement.",
  },
  programme: [
    {
      titreFr: "Matin · L'exploitation et l'IA : ce qui peut sortir, ce qui ne sort jamais",
      steps: [
        {
          temps: "5'",
          type: "objectif",
          titre:
            "Le résultat visé : devant n'importe quelle pièce de l'exploitation, savoir si on peut la déposer dans un assistant, et dans quel environnement",
        },
        {
          temps: "15'",
          type: "demonstration",
          titre:
            "Avant / après : un appel de conducteur noté à la volée devient une consigne de livraison claire — méthode AXION (Acteur, conteXte, Intention, Output, Normes), prompt affiché en entier, un seul assistant",
        },
        {
          temps: "15'",
          type: "demonstration",
          titre:
            "« Retirer le nom n'anonymise pas » : un dossier de litige privé de ses identifiants, ré-identifié devant la salle en trois questions (date, lieu de livraison, nature de la marchandise) — le dossier reste une donnée personnelle",
        },
        {
          temps: "15'",
          type: "cadre",
          titre:
            "Les trois régimes d'usage — compte personnel, offre entreprise avec engagement de non-réutilisation, environnement validé par la direction : ce que chacun autorise avant de déposer un ordre de transport, un contrat client ou un dossier de litige",
        },
        {
          temps: "20'",
          type: "pratique",
          titre:
            "Atelier : la salle écrit la liste rouge de l'exploitation — tarifs et taux d'affrètement, contrats clients, données personnelles et positions des conducteurs, pièces touchant un contentieux en cours",
        },
        {
          temps: "10'",
          type: "verification",
          titre:
            "Vérification corrigée en salle : dix pièces de l'exploitation fournies dans le kit — « je la dépose, dans quel environnement, ou pas du tout »",
        },
        {
          temps: "5'",
          type: "synthese",
          titre:
            "Acquis : je classe chaque pièce avant de la déposer ; je traite un dossier privé de son nom comme une donnée personnelle",
        },
        { temps: "15'", type: "pause", titre: "Pause" },
      ],
    },
    {
      titreFr: "Matin · Litiges, réserves et réclamations clients",
      steps: [
        {
          temps: "5'",
          type: "objectif",
          titre:
            "Le résultat visé : un courrier de réserve ou de litige qui expose les faits datés sans admettre de responsabilité",
        },
        {
          temps: "15'",
          type: "demonstration",
          titre:
            "Avant / après : la même avarie traitée en courrier improvisé puis en courrier structuré — prompt affiché en entier, un seul assistant, et la liste de ce qu'on ne concède jamais par écrit",
        },
        {
          temps: "45'",
          type: "pratique",
          titre:
            "Atelier chronométré : chacun traite deux dossiers — une réserve à la livraison, un retard réclamé par le client — sur pièces reconstituées à partir du kit lorsque le dossier réel ne peut pas sortir du service",
        },
        {
          temps: "20'",
          type: "verification",
          titre:
            "Contrôle croisé en binôme avec la grille fournie : les faits sont-ils datés ? une responsabilité est-elle admise ? chaque délai et chaque réserve cités se retrouvent-ils au contrat type, ou l'assistant les a-t-il inventés ?",
        },
        {
          temps: "10'",
          type: "pratique",
          titre:
            "Reprise : chacun corrige son courrier d'après la grille et le verse à son classeur d'exploitation",
        },
        {
          temps: "5'",
          type: "synthese",
          titre:
            "Acquis : l'assistant rédige, l'exploitant tranche, le contrat fait foi ; tout délai cité est retrouvé au contrat ou supprimé",
        },
      ],
    },
    {
      titreFr: "Après-midi · Consignes de tournée, documents et affrètement",
      steps: [
        {
          temps: "5'",
          type: "objectif",
          titre:
            "Le résultat visé : produire les consignes et les courriers qui accompagnent une tournée, sans jamais laisser l'assistant construire la tournée",
        },
        {
          temps: "20'",
          type: "cadre",
          titre:
            "Chasse à l'erreur en direct : on interroge l'assistant sur les temps de conduite et de repos, la salle surligne ce qui est faux (fiche de référence dans le kit du formateur) — d'où les deux bornes de la journée : toute tournée est vérifiée au regard de la réglementation sociale avant diffusion, et les documents réglementés (lettre de voiture, déclaration de matières dangereuses) restent hors du périmètre de la génération assistée",
        },
        {
          temps: "15'",
          type: "demonstration",
          titre:
            "Une commande client devient instructions au conducteur, message au client et courrier d'accompagnement : trois sorties, une seule demande, prompt affiché en entier",
        },
        {
          temps: "40'",
          type: "pratique",
          titre:
            "Atelier chronométré : chacun produit les consignes de sa tournée du lendemain, puis une demande d'affrètement et sa relance sous-traitant",
        },
        {
          temps: "15'",
          type: "verification",
          titre:
            "Vérification croisée avec la checklist fournie : heures, adresses, contraintes de quai, mentions contractuelles, temps de conduite — tout chiffre non retrouvé dans la commande est surligné puis corrigé",
        },
        {
          temps: "5'",
          type: "synthese",
          titre:
            "Acquis : le TMS ordonnance, l'assistant rédige ; rien ne part au conducteur sans contrôle des temps de conduite",
        },
        { temps: "15'", type: "pause", titre: "Pause" },
      ],
    },
    {
      titreFr: "Après-midi · Suivi d'activité, personnes et classeur d'exploitation",
      steps: [
        {
          temps: "5'",
          type: "objectif",
          titre:
            "Le résultat visé : rédiger le commentaire du reporting d'exploitation à partir d'indicateurs déjà calculés par vos outils, sans jamais noter quelqu'un",
        },
        {
          temps: "15'",
          type: "cadre",
          titre:
            "Ce qu'on n'automatise jamais sur une personne : suivi individuel des conducteurs, géolocalisation, notation de la performance — le suivi et l'évaluation de la performance des travailleurs sont classés à haut risque par le règlement européen sur l'IA ; information préalable des salariés et consultation des représentants du personnel avant toute mise en service",
        },
        {
          temps: "10'",
          type: "demonstration",
          titre:
            "Le biais rendu visible : le même tableau d'aléas commenté deux fois par l'assistant, avec puis sans les noms des conducteurs — le ton change et la faute se déplace",
        },
        {
          temps: "25'",
          type: "pratique",
          titre:
            "Atelier chronométré : chacun rédige la synthèse d'exploitation de sa semaine (taux de service, aléas, litiges) en version direction puis en version équipe",
        },
        {
          temps: "20'",
          type: "pratique",
          titre:
            "Atelier : assemblage du classeur d'exploitation — les écrits produits dans la journée, la grille de contrôle avant diffusion et la liste rouge, réunis en un document unique diffusable au service",
        },
        {
          temps: "15'",
          type: "verification",
          titre:
            "Quiz individuel de validation des acquis (10 questions) + correction commentée en salle",
        },
        {
          temps: "10'",
          type: "pratique",
          titre:
            "Feuille de route écrite par chaque participant : trois usages priorisés, qui les porte, ce qui doit passer devant la direction et les représentants du personnel avant mise en service",
        },
        {
          temps: "5'",
          type: "synthese",
          titre:
            "Acquis : l'assistant commente des indicateurs déjà calculés ; aucune personne n'est notée, et rien ne se met en service sans information préalable",
        },
      ],
    },
  ],
  faqs: [
    {
      question: "L'IA va-t-elle optimiser nos tournées à la place du TMS ?",
      reponse:
        "Non : l'optimisation reste dans vos outils métiers. L'IA aide à préparer, arbitrer et communiquer autour de la planification — consignes, synthèses, réponses aux aléas — là où l'exploitation perd du temps chaque jour.",
    },
    {
      question: "Est-ce adapté à une PME de transport avec une petite équipe d'exploitation ?",
      reponse:
        "Oui : la journée est conçue pour des équipes de toutes tailles, et les ateliers portent sur vos documents et situations réels — litiges, relances, reporting, documents de transport.",
    },
    {
      question: "Présentiel ou distanciel ?",
      reponse:
        "Au choix : dans vos locaux ou à distance, avec le même contenu et les mêmes ateliers pratiques.",
    },
  ],
};

const IA_POUR_LA_BANQUE_ASSURANCE: FormationV2 = {
  id: "ia-pour-la-banque-assurance",
  slugFr: "ia-pour-la-banque-assurance",
  slugEn: "ai-for-banking-insurance",
  numero: 21,
  gamme: "ia-standard",
  categorie: "secteur",
  axeLabelFr: "Banque / Assurance",
  duree: "1j",
  titreFr: "IA pour la banque et l'assurance",
  accrocheFr:
    "Traitez chaque dossier plus vite, répondez à chaque client plus tôt — sécuriser et accélérer le quotidien",
  h1Fr: "Formation IA pour la banque et l'assurance : sécuriser et accélérer le quotidien",
  metaTitleFr: "Formation IA banque et assurance — 1 jour",
  metaDescriptionFr:
    "Formation IA banque et assurance, 1 jour : synthèse de dossiers clients, courriers et propositions, confidentialité stricte des données. 2 200 € HT par groupe.",
  termesSemantiquesFr: [
    "formation IA banque",
    "IA assurance",
    "synthèse dossier client IA",
    "IA conseiller clientèle",
    "confidentialité données financières",
    "IA courtage",
  ],
  publicViseFr:
    "Conseillers clientèle, gestionnaires de contrats, personnel administratif — banques, assurances, mutuelles, courtiers. La gestion de dossiers et la relation client demandent rigueur et rapidité : cette journée montre comment l'IA accélère le traitement tout en respectant la confidentialité des données financières.",
  casUsageFr: [
    { texteFr: "La synthèse rapide de dossiers clients" },
    { texteFr: "L'aide à la rédaction de courriers et de propositions" },
    { texteFr: "Des réponses aux questions courantes facilitées" },
    { texteFr: "Les bons réflexes de confidentialité des données financières" },
  ],
  objectifsFr: [
    "Synthétiser un dossier client à l'aide de l'IA",
    "Rédiger courriers et propositions",
    "Rédiger des réponses aux questions courantes",
    "Appliquer strictement les règles de confidentialité des données financières",
    "Vérifier une production avant diffusion",
  ],
  beneficeDirigeantFr:
    "Des dossiers traités plus vite et des réponses aux clients plus réactives — la rigueur du secteur est préservée, la lenteur ne l'est pas.",
  equationTempsFr:
    "1 journée → la synthèse d'un dossier client obtenue en quelques minutes pour préparer un rendez-vous.",
  avantApresFr: {
    avant: "Un traitement de dossiers chronophage, des réponses parfois lentes.",
    apres: "Des dossiers traités plus vite, des réponses aux clients plus réactives.",
  },
  programme: [
    {
      titreFr:
        "Matin · Module 1 — Le cadre d'abord : dans quel environnement chaque pièce a le droit d'être traitée",
      steps: [
        {
          temps: "5'",
          type: "objectif",
          titre:
            "Le résultat visé : savoir, devant n'importe quelle pièce d'un dossier, dans quel environnement on a le droit de la traiter — ou pas du tout",
        },
        {
          temps: "15'",
          type: "cadre",
          titre:
            "Les trois régimes d'usage : compte grand public, offre entreprise avec engagement de non-réutilisation, environnement validé par la conformité — ce que chacun autorise, ce qu'aucun n'autorise, et les quatre questions à poser à sa DSI (fiche remise imprimée)",
        },
        {
          temps: "25'",
          type: "pratique",
          titre:
            "Tri chronométré : vingt pièces de dossier (fournies) réparties par chaque table entre les trois régimes ou « pas du tout » — grille de tri et corrigé du formateur fournis",
        },
        {
          temps: "15'",
          type: "demonstration",
          titre:
            "Pseudonymiser n'est pas anonymiser : un dossier privé de son nom, ré-identifié devant la salle en trois questions — les prompts affichés en entier, un seul outil",
        },
        {
          temps: "5'",
          type: "cadre",
          titre:
            "La liste rouge de référence du métier, remise imprimée : identité et coordonnées, données de santé et questionnaire médical, encours et incidents de paiement, éléments de sinistre corporel — et l'interdiction absolue de laisser sortir quoi que ce soit qui touche à une déclaration de soupçon",
        },
        {
          temps: "20'",
          type: "pratique",
          titre:
            "Chaque table confronte la liste rouge de référence à ses propres pièces : ajoute ce qui lui manque, barre ce qui ne la concerne pas, nomme son cas litigieux → page 1 du protocole",
        },
        {
          temps: "15'",
          type: "verification",
          titre:
            "Dix pièces projetées, réponse individuelle écrite : « je la traite, dans quel environnement, ou pas du tout » — correction collective sur le corrigé du formateur",
        },
        {
          temps: "5'",
          type: "synthese",
          titre:
            "Deux acquis-actions : je qualifie la pièce avant d'ouvrir l'outil ; je pose lundi les quatre questions à ma DSI",
        },
        { temps: "15'", type: "pause", titre: "Pause" },
      ],
    },
    {
      titreFr: "Matin · Module 2 — Ce que l'IA ne touche jamais dans ce métier",
      steps: [
        {
          temps: "5'",
          type: "objectif",
          titre:
            "Le résultat visé : reconnaître les décisions qui ne se délèguent pas, et savoir ce qu'on doit au client quand un outil est intervenu dans son dossier",
        },
        {
          temps: "15'",
          type: "cadre",
          titre:
            "La frontière posée : octroi et notation de crédit, tarification et sélection des risques en santé et prévoyance — usages classés à haut risque par le règlement européen sur l'IA, hors du périmètre de cette journée et de vos outils du quotidien ; et le droit du client à être informé et à obtenir une intervention humaine",
        },
        {
          temps: "20'",
          type: "demonstration",
          titre:
            "Démonstration de biais : le même dossier soumis deux fois, une seule variable de plus (âge, adresse, situation familiale) — les deux prompts affichés en entier côte à côte, un seul outil, la variable ajoutée surlignée, et l'avis rendu qui change à l'écran",
        },
        {
          temps: "25'",
          type: "pratique",
          titre:
            "Chaque participant passe trois de ses propres dossiers au test de qualification en quatre questions (grille fournie) : est-ce une décision sur une personne ? produit-elle un effet ? qui la signe ? qu'en saura le client ? → page 2 du protocole",
        },
        {
          temps: "25'",
          type: "pratique",
          titre:
            "Atelier chronométré par table : écrire les trois phrases de l'établissement — ce qu'on dit au client, qui décide, ce qu'on trace — et la formule de renvoi à la conformité quand le doute persiste (« je ne me prononce pas, notre service conformité tranche »)",
        },
        {
          temps: "10'",
          type: "verification",
          titre:
            "Huit situations projetées, réponse individuelle : « dans le périmètre / hors périmètre / à faire trancher par la conformité » — correction collective",
        },
        {
          temps: "5'",
          type: "synthese",
          titre:
            "Deux acquis-actions : l'IA prépare, l'humain décide et signe ; toute décision doit rester justifiable un an plus tard",
        },
      ],
    },
    {
      titreFr: "Après-midi · Module 3 — Sinistres, dossiers et documents contractuels",
      steps: [
        {
          temps: "5'",
          type: "objectif",
          titre:
            "Le résultat visé : la synthèse d'un dossier et le courrier qui l'accompagne, prêts pour un rendez-vous, produits dans le régime d'usage identifié au module 1",
        },
        {
          temps: "15'",
          type: "demonstration",
          titre:
            "Des conditions générales déposées puis interrogées garantie par garantie, franchise et exclusion comprises — le prompt affiché en entier, un seul outil — et la clause que l'outil a inventée, retrouvée en direct",
        },
        {
          temps: "50'",
          type: "pratique",
          titre:
            "Atelier chronométré : chacun traite un cas complet sur dossier reconstitué fourni — déclaration de sinistre ou reprise d'historique — jusqu'au courrier d'acceptation ou de refus motivé",
        },
        {
          temps: "20'",
          type: "verification",
          titre:
            "Vérification aux sources en binômes croisés : chaque garantie, chaque franchise, chaque délai cité doit être retrouvé dans le document déposé, sinon la phrase saute — aucun contenu réglementaire produit de mémoire",
        },
        {
          temps: "5'",
          type: "synthese",
          titre:
            "Deux acquis-actions : l'IA structure, le gestionnaire signe ; je ne laisse passer aucune référence contractuelle non retrouvée à la source",
        },
        { temps: "15'", type: "pause", titre: "Pause" },
      ],
    },
    {
      titreFr: "Après-midi · Module 4 — Réponses aux clients, traçabilité et protocole du service",
      steps: [
        {
          temps: "5'",
          type: "objectif",
          titre:
            "Le résultat visé : des réponses homogènes aux questions récurrentes, tracées, qui ne tiennent jamais lieu de conseil",
        },
        {
          temps: "10'",
          type: "cadre",
          titre:
            "La règle, posée avant l'atelier : toute réponse qui touche une garantie, un tarif ou une décision passe par une validation nommée et laisse une trace — c'est ce qui rend le devoir de conseil justifiable a posteriori",
        },
        {
          temps: "10'",
          type: "demonstration",
          titre:
            "Une réponse type produite à l'écran puis sa ligne de trace écrite dans la foulée (qui a demandé, quel outil, qui a validé, quand) — le prompt affiché en entier, un seul outil",
        },
        {
          temps: "30'",
          type: "pratique",
          titre:
            "Atelier chronométré : chacun produit trois réponses types de son service, chacune portant en en-tête ses champs interdits, sa mention de validation humaine et sa ligne de trace → page 3 du protocole",
        },
        {
          temps: "15'",
          type: "verification",
          titre:
            "Quiz individuel de validation des acquis (10 questions) + correction commentée en salle",
        },
        {
          temps: "10'",
          type: "pratique",
          titre:
            "Chacun écrit sa feuille de route : trois usages priorisés, l'environnement à faire valider par la conformité, ce qui remonte à la direction avant tout déploiement → page 4 du protocole",
        },
        {
          temps: "5'",
          type: "synthese",
          titre:
            "Trois acquis-actions : je qualifie avant d'ouvrir l'outil ; je vérifie toute référence contractuelle à la source ; je trace toute réponse qui engage l'établissement",
        },
      ],
    },
  ],
  faqs: [
    {
      question: "Peut-on soumettre des dossiers clients réels à l'IA ?",
      reponse:
        "Non : aucune donnée client nominative n'est soumise à l'IA. La formation enseigne le travail sur données factices ou anonymisées et les réflexes du secteur — c'est la règle posée dès le premier module et appliquée dans tous les ateliers.",
    },
    {
      question: "Est-ce compatible avec nos obligations de conformité ?",
      reponse:
        "La journée est construite pour le cadre du secteur : secret professionnel, RGPD, validation humaine systématique avant diffusion. L'IA prépare le travail ; les décisions et le conseil restent humains et conformes à vos procédures.",
    },
    {
      question: "Est-ce adapté aux courtiers et petites structures ?",
      reponse:
        "Oui : conseillers, gestionnaires et courtiers y trouvent les mêmes gains — synthèses de dossiers, courriers, réponses types — avec des ateliers adaptés à la taille et aux outils de la structure.",
    },
  ],
};
const SEMINAIRE_IA_ENTREPRISE: FormationV2 = {
  id: "seminaire-ia-toute-l-entreprise-1j",
  slugFr: "seminaire-ia-toute-l-entreprise-1j",
  slugEn: "ai-seminar-whole-company-1d",
  numero: 22,
  gamme: "ia-standard",
  duree: "1j",
  surDevis: true,
  // Programme : « Jusqu'à 50 participants, en tables de 6 à 8 ».
  effectifFr: "Jusqu’à 50 participants, en tables de 6 à 8",
  // Le séminaire ne demande AUCUN matériel individuel : le formateur démontre,
  // et seul le téléphone personnel sert au sondage et aux QCM.
  materielFr:
    "Aucun matériel à prévoir : les démonstrations sont pilotées par le formateur. Chaque participant utilise son téléphone personnel pour le sondage en direct et les QCM",
  outilsFr:
    "Le séminaire est démonstratif : le formateur pilote ChatGPT, Claude et Gemini en direct. Les participants ne créent aucun compte — ils travaillent par table, sur leurs propres cas d’usage.",
  seminaire: true,
  titreFr: "Séminaire IA — Mettre toute l'entreprise au diapason",
  accrocheFr:
    "Une journée en présentiel pour cadrer les usages de l'IA et fédérer toutes vos équipes — jusqu'à 50 participants",
  h1Fr: "Séminaire IA en entreprise — fédérer toutes vos équipes en une journée",
  metaTitleFr: "Séminaire IA en entreprise — toute l'équipe",
  metaDescriptionFr:
    "Séminaire IA d'une journée en présentiel, jusqu'à 50 personnes : cadrer les usages, partager la méthode AXION et fédérer toutes vos équipes.",
  termesSemantiquesFr: [
    "séminaire IA entreprise",
    "journée IA toute l'entreprise",
    "fédérer les équipes IA",
    "méthode AXION",
    "cartographie des usages IA",
    "feuille de route IA collective",
  ],
  publicViseFr:
    "L'entreprise entière ou un site complet, réunis le même jour : tous services, tous métiers, tous niveaux de maîtrise de l'IA. C'est précisément ce mélange qui fait la valeur de la journée — ceux qui n'ont jamais essayé et ceux qui utilisent déjà l'IA au quotidien. Jusqu'à 50 participants, en tables de 6 à 8.",
  prerequisFr:
    "Aucun prérequis technique ni expérience de l'IA. Aucun compte à créer, aucun logiciel à installer : le séminaire est conçu pour qu'on y participe sans préparation. Chaque participant utilise son téléphone personnel pour le sondage et les QCM (évaluation individuelle et nominative) ; un ordinateur ou un téléphone par table suffit pour les temps collectifs.",
  casUsageFr: [
    {
      texteFr: "Donner un socle commun IA à tous les services, en une journée",
      imageSrc: "/illustrations/formations/fiches/seminaire-ia-toute-l-entreprise-1j/cas-1.webp",
      imageCredit: {
        name: "Product School",
        url: "https://unsplash.com/@productschool?utm_source=axion-ia&utm_medium=referral",
      },
    },
    {
      texteFr: "Faire émerger les usages IA déjà présents dans l'entreprise",
      imageSrc: "/illustrations/formations/fiches/seminaire-ia-toute-l-entreprise-1j/cas-2.webp",
      imageCredit: {
        name: "FORTYTWO",
        url: "https://unsplash.com/@byfortytwo?utm_source=axion-ia&utm_medium=referral",
      },
    },
    {
      texteFr: "Partager une méthode commune pour bien s'exprimer face à l'IA",
      imageSrc: "/illustrations/formations/fiches/seminaire-ia-toute-l-entreprise-1j/cas-3.webp",
      imageCredit: {
        name: "Alexandre Pellaes",
        url: "https://unsplash.com/@apellaes?utm_source=axion-ia&utm_medium=referral",
      },
    },
    {
      texteFr: "Repartir avec des règles communes et des engagements par service",
      imageSrc: "/illustrations/formations/fiches/seminaire-ia-toute-l-entreprise-1j/cas-4.webp",
      imageCredit: {
        name: "krakenimages",
        url: "https://unsplash.com/@krakenimages?utm_source=axion-ia&utm_medium=referral",
      },
    },
  ],
  objectifsFr: [
    "Comprendre le fonctionnement, les apports et les risques de l'IA générative, et disposer d'un socle commun de vocabulaire",
    "Identifier les règles de sécurité et de confidentialité applicables à leurs usages, et le cadre légal qui s'impose à l'entreprise",
    "Structurer une demande à l'IA grâce à la méthode AXION, partagée par tous",
    "Situer les usages de l'IA déjà présents dans l'entreprise, service par service",
    "Repérer les cas d'usage à fort potentiel dans leur propre périmètre",
    "S'accorder sur des règles communes et des engagements concrets pour la suite",
  ],
  beneficeDirigeantFr:
    "En une journée, toute l'entreprise partage un socle commun, rend visibles les usages IA déjà présents, et repart avec des règles et des engagements concrets par service — un vrai point de départ pour votre politique IA.",
  equationTempsFr:
    "1 journée réunissant toute l'entreprise → un socle commun, une cartographie réelle des usages, et une feuille de route collective formalisée le jour même.",
  modalites: ["presentiel"],
  programme: [
    {
      titreFr: "Matin — Socle commun, garde-fous, et photographie réelle des usages",
      steps: [
        {
          temps: "10'",
          type: "cadre",
          titre:
            "Ouverture par la direction : l'engagement écrit de non-usage disciplinaire est lu, signé et projeté, puis remis à chaque table — rien de ce qui sera déclaré aujourd'hui ne servira à sanctionner qui que ce soit. Sans cette signature, le sondage de la fin de matinée n'a pas lieu",
        },
        {
          temps: "5'",
          type: "objectif",
          titre:
            "Ce que chacun saura faire à 17 h 30 : les six acquis de la journée affichés au mur, cochés au fil des séquences — nommer ce qu'on ne soumet jamais, écrire une demande qui marche sans son auteur, situer les usages de son service, transposer une astuce, écrire trois engagements",
        },
        {
          temps: "20'",
          type: "demonstration",
          titre:
            "Avant/après sur une tâche que tout le monde fait (rédiger le compte rendu d'une réunion à partir de notes) : d'abord sans IA, puis avec — un seul outil, tenu toute la journée, prompt affiché en entier à l'écran ; une phrase dit que les autres assistants font la même chose et qu'on ne change pas d'onglet aujourd'hui",
        },
        {
          temps: "15'",
          type: "demonstration",
          titre:
            "Les trois risques montrés et non racontés : une réponse fausse mais parfaitement crédible sur un sujet que la salle connaît ; un biais qui apparaît quand on change un seul mot du prompt (la salle parie sur le résultat avant l'affichage) ; une donnée collée dans un outil grand public qu'on ne peut plus reprendre",
        },
        {
          temps: "15'",
          type: "cadre",
          titre:
            "Le cadre en trois obligations de l'employeur, énoncées en clair : informer et consulter le comité social et économique ; dire qu'un contenu a été produit par IA quand il part à un tiers (obligations de transparence du règlement européen sur l'IA, art. 50) ; former ses équipes (art. 4). Puis la liste écrite des usages mis hors jeu pour la journée entière — recrutement, évaluation des salariés, toute décision portant sur une personne (annexe III, usages à haut risque) : ils ne seront ni déclarés, ni pratiqués, ni retenus en feuille de route",
        },
        {
          temps: "25'",
          type: "pratique",
          titre:
            "Tri par table sur les douze cartes fournies : « ça peut sortir » / « ça ne sort jamais » / « ça ne se soumet pas du tout, c'est une décision sur une personne ». Chaque table écrit ensuite sa règle commune en une seule phrase sur la première page du classeur",
        },
        {
          temps: "15'",
          type: "verification",
          titre:
            "Correction croisée en plénière : chaque table défend deux cartes contestées, l'arbitrage se fait sur la grille de correction fournie (donnée personnelle / donnée client / donnée de santé / décision sur une personne), la règle commune de l'entreprise est écrite au tableau devant tout le monde",
        },
        {
          temps: "5'",
          type: "synthese",
          titre:
            "Les trois règles que tout le monde repart en connaissant, recopiées par chaque table sur sa page du classeur et cochées au mur",
        },
        { temps: "15'", type: "pause", titre: "Pause" },
        {
          temps: "5'",
          type: "objectif",
          titre:
            "Objectif de la séquence : à la fin, chaque service sait nommer ses trois tâches les plus lourdes, le temps qu'elles lui coûtent, et les usages IA déjà en place chez lui — y compris ceux que personne n'a validés",
        },
        {
          temps: "5'",
          type: "cadre",
          titre:
            "Comment ce sondage est protégé : réponses agrégées par service, aucun service de moins de cinq réponses n'est affiché, rien de nominatif, aucune reprise individuelle — rappel de l'engagement signé à 9 h et de ce qui sera fait du résultat",
        },
        {
          temps: "15'",
          type: "pratique",
          titre:
            "Sondage en direct, chacun répond depuis le terminal fourni ou son téléphone au choix : quels usages, pour quelles tâches, à quelle fréquence — les usages mis hors jeu le matin ne figurent pas dans le questionnaire",
        },
        {
          temps: "10'",
          type: "demonstration",
          titre:
            "Lecture commentée du résultat agrégé, service par service : ce que la direction découvre presque toujours, et pourquoi on ne cherche jamais qui a répondu quoi",
        },
        {
          temps: "30'",
          type: "pratique",
          titre:
            "Travail par table sur la trame fournie (une page par service) : lister les tâches lourdes, estimer le temps qu'elles prennent chaque semaine, noter les usages IA déjà en place — c'est la table qui écrit, jamais un individu, et aucun nom n'est porté sur la fiche",
        },
        {
          temps: "15'",
          type: "verification",
          titre:
            "Restitution croisée : chaque table lit la fiche d'une autre table et signale ce qui manque ou ce qui relève d'un usage mis hors jeu le matin ; corrigé en direct sur la fiche, par son auteur",
        },
        {
          temps: "5'",
          type: "synthese",
          titre:
            "La photographie réelle de l'entreprise, une page par service, versée au classeur de bord — deux acquis cochés au mur",
        },
      ],
    },
    {
      titreFr: "Après-midi — Méthode AXION, astuces transposées, règles et engagements",
      steps: [
        {
          temps: "5'",
          type: "objectif",
          titre:
            "Objectif de l'après-midi : chaque table repart avec deux demandes écrites aux cinq leviers, testées, qui produisent le même résultat entre les mains d'un collègue qui ne les a pas écrites",
        },
        {
          temps: "20'",
          type: "demonstration",
          titre:
            "Les cinq leviers AXION (Acteur, conteXte, Intention, Output, Normes) puis démonstration avant/après sur un cas apporté par la salle : la même demande, d'abord vague, puis passée aux cinq leviers — les deux prompts affichés en entier, les deux résultats comparés côte à côte à l'écran",
        },
        {
          temps: "35'",
          type: "pratique",
          titre:
            "Atelier chronométré par table, fiche mémo AXION en main : écrire une demande sur une tâche réelle du service, l'essayer sur le poste de la table, la corriger jusqu'à ce que le résultat soit utilisable tel quel — le formateur circule et minute, il n'écrit à la place de personne",
        },
        {
          temps: "20'",
          type: "verification",
          titre:
            "Vérification croisée : chaque table exécute la demande d'une autre table, sans son auteur. Si le résultat change, on note sur la grille fournie quel levier manquait (Acteur, conteXte, Intention, Output, Normes) et on le rend à l'auteur par écrit",
        },
        {
          temps: "20'",
          type: "pratique",
          titre:
            "Deuxième passe chronométrée : chaque table corrige sa première demande avec les remarques reçues, puis en écrit une seconde, cette fois sur une tâche d'un autre service que le sien",
        },
        {
          temps: "5'",
          type: "synthese",
          titre:
            "Ce qui fait qu'une demande marche sans son auteur : les deux leviers le plus souvent oubliés dans cette salle, relevés sur les grilles et affichés",
        },
        { temps: "15'", type: "pause", titre: "Pause" },
        {
          temps: "10'",
          type: "demonstration",
          titre:
            "Concours d'astuces : chaque table présente sa meilleure trouvaille en quatre-vingt-dix secondes chronométrées, sans commentaire ni débat — on écoute, on ne trie pas encore",
        },
        {
          temps: "10'",
          type: "cadre",
          titre:
            "Le filtre est annoncé avant de généraliser : lecture de la liste écrite des astuces à écarter — celles qui font sortir une donnée client, une donnée de salarié ou une donnée de santé, et celles qui touchent une décision sur une personne. Le formateur applique cette liste telle qu'elle est écrite ; il n'arbitre pas en séance. Tout cas douteux est noté au tableau et renvoyé au conseil de l'entreprise, sans réponse improvisée",
        },
        {
          temps: "25'",
          type: "pratique",
          titre:
            "Réécriture par table sur la grille des six familles de tâches transverses fournie (écrire, résumer, trier, reformuler, préparer une réunion, chercher dans ses propres documents) : chaque table prend l'astuce d'un autre service, la range dans sa famille, la transpose à son propre quotidien, l'essaie et écrit la version diffusable — la généralisation est faite par les tables, pas par le formateur",
        },
        {
          temps: "10'",
          type: "verification",
          titre:
            "Chaque table rejoue devant la salle l'astuce qu'elle a transposée : soit elle fonctionne telle qu'elle est écrite, soit on note au tableau ce qui manquait pour qu'elle fonctionne ailleurs",
        },
        {
          temps: "15'",
          type: "pratique",
          titre:
            "Chaque service écrit ses trois engagements concrets sur la page « engagements » du classeur et les annonce devant les autres — la hiérarchisation reprend la liste des usages mis hors jeu le matin, qui n'entrent pas dans la feuille de route",
        },
        {
          temps: "5'",
          type: "cadre",
          titre:
            "Ce qu'il reste à faire pour que ces règles s'appliquent vraiment : c'est la direction de l'entreprise, et non le formateur, qui annonce son calendrier — information et consultation du CSE, information des salariés, examen par son propre conseil du rattachement de la charte au règlement intérieur. Axion-IA ne délivre aucun conseil juridique, et le dit à la salle",
        },
        {
          temps: "10'",
          type: "verification",
          titre:
            "Évaluation individuelle des acquis : dix questions sur terminal fourni ou téléphone personnel au choix, corrigées et commentées en salle question par question, résultat agrégé affiché, aucun résultat nominatif communiqué à l'employeur",
        },
        {
          temps: "5'",
          type: "synthese",
          titre:
            "Bilan : les six acquis cochés au mur, le référent IA désigné devant tout le monde, et le classeur de bord remis table par table",
        },
      ],
    },
  ],
  faqs: [
    {
      question: "Est-ce une formation ou une conférence ?",
      reponse:
        "Ni l'un ni l'autre. Ce n'est pas une formation déguisée (à 50 personnes, pas d'accompagnement individuel écran par écran — ce sont nos formations en groupe de 15 qui font ça), et ce n'est pas une conférence (plus de la moitié de la journée est du travail collectif par table). Le séminaire pose un socle commun et prépare les formations, il ne les remplace pas.",
    },
    {
      question: "Pourquoi le présentiel uniquement ?",
      reponse:
        "Un séminaire dont l'objet est de fédérer les équipes n'a pas de sens à distance : le travail par table, les restitutions, les échanges entre services ne survivent pas à 50 personnes en salles virtuelles. Si le présentiel n'est pas possible, nos formations en groupe de 15 se dispensent aussi bien à distance.",
    },
    {
      question: "Combien de participants et quelle organisation de salle ?",
      reponse:
        "Jusqu'à 50 participants, en tables de 6 à 8 personnes, de préférence en mélangeant les services. Il faut un vidéoprojecteur ou grand écran, une sonorisation adaptée, un paperboard par table et une connexion internet couvrant la salle (pour le sondage et les QCM depuis les téléphones).",
    },
  ],
};

export const FORMATIONS_V2: ReadonlyArray<FormationV2> = [
  // Offres générales (4)
  BIEN_COMMENCER_4H,
  BIEN_COMMENCER_JOURNEE,
  IA_POUR_LES_EQUIPES,
  IA_POUR_L_AUTOMATISATION,
  // Offres par métier (9)
  IA_POUR_LES_RH,
  IA_POUR_LE_MARKETING,
  IA_POUR_LES_COMMERCIAUX,
  IA_POUR_LA_FINANCE,
  IA_POUR_LE_JURIDIQUE,
  IA_POUR_LA_PRODUCTION,
  IA_POUR_LES_ACHATS,
  IA_POUR_LA_RELATION_CLIENT,
  IA_POUR_L_IT,
  // Offres par secteur d'activité (8)
  IA_POUR_LA_SANTE,
  IA_POUR_LE_BTP,
  IA_POUR_L_IMMOBILIER,
  IA_POUR_LE_COMMERCE,
  IA_POUR_L_HOTELLERIE_RESTAURATION,
  IA_POUR_L_INDUSTRIE,
  IA_POUR_LE_TRANSPORT_LOGISTIQUE,
  IA_POUR_LA_BANQUE_ASSURANCE,
  // Séminaire — rubrique à part (hors catégories)
  SEMINAIRE_IA_ENTREPRISE,
];

/** Formations « classiques » (exclut les séminaires) pour l'affichage catalogue. */
export function getFormationsV2(): ReadonlyArray<FormationV2> {
  return FORMATIONS_V2.filter((f) => !f.seminaire);
}

/** Séminaires (rubrique dédiée). */
export function getSeminairesV2(): ReadonlyArray<FormationV2> {
  return FORMATIONS_V2.filter((f) => f.seminaire);
}

/** Formation par id/slug (FR ou EN). */
export function getFormationV2(idOrSlug: string): FormationV2 | undefined {
  return FORMATIONS_V2.find(
    (f) => f.id === idOrSlug || f.slugFr === idOrSlug || f.slugEn === idOrSlug,
  );
}

/** Formations d'une catégorie (générale / métier / secteur), dans l'ordre catalogue. */
export function getFormationsV2ByCategorie(
  categorie: FormationCategorie,
): ReadonlyArray<FormationV2> {
  return FORMATIONS_V2.filter((f) => f.categorie === categorie);
}

/** Formations d'une durée. */
export function getFormationsV2ByDuree(duree: FormationDuree): ReadonlyArray<FormationV2> {
  return FORMATIONS_V2.filter((f) => f.duree === duree);
}

/** Tranches d'effectif d'une formation (dérivées de la matrice prix). */
export function getFormationV2Brackets(f: FormationV2): ReadonlyArray<FormationBracket> {
  if (f.surDevis || !f.categorie) return [];
  return getFormationBrackets(f.categorie, f.duree);
}

/** Prix d'une formation (prix fixe par groupe — dérivé de la matrice prix). */
export function getFormationV2Price(
  f: FormationV2,
  _bracket?: FormationBracket,
): number | undefined {
  if (f.surDevis || !f.categorie) return undefined;
  return getFormationPrice(f.categorie, f.duree);
}

/** Prix d'entrée d'une formation — tranche unique : le prix affiché lui-même. */
export function getFormationV2EntryPrice(f: FormationV2): number | undefined {
  if (f.surDevis || !f.categorie) return undefined;
  return getFormationEntryPrice(f.categorie, f.duree);
}
