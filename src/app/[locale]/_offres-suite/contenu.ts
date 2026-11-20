// Contenu des pages des quatre offres de la suite (GEO V2-05 / V2-06). Texte seulement : la
// définition vient de `@/content/offres-suite` (identique à llms.txt). Aucun montant, aucun chiffre
// de résultat, aucun témoignage. Chaque ligne ci-dessous reprend l'audit F du plan GEO.

import {
  OFFRES_SUITE,
  PHRASE_SUR_DEVIS,
  offreSuite,
  type CleOffreSuite,
} from "@/content/offres-suite";

export interface PageOffreSuite {
  readonly cle: CleOffreSuite;
  readonly path: string;
  readonly nom: string;
  readonly definition: string;
  readonly titre: string;
  readonly descriptionMeta: string;
  readonly h1: string;
  readonly surtitre: string;
  readonly pourQui: string;
  readonly deroule: readonly string[];
  readonly livrables: readonly string[];
  readonly duree: string;
  readonly faq: readonly { id: string; question: string; reponse: string }[];
}

const DEVIS_FAQ = (nom: string) => ({
  id: "faq-devis",
  question: `Comment obtenir un devis pour le ${nom} ?`,
  reponse: `${PHRASE_SUR_DEVIS} Vous réservez ce Diagnostic IA en ligne, nous faisons le point sur votre situation, puis nous vous envoyons un devis écrit.`,
});

function base(cle: CleOffreSuite) {
  const o = offreSuite(cle);
  return { cle: o.cle, path: o.path, nom: o.nom, definition: o.definition };
}

export const PAGES_OFFRES_SUITE: Readonly<Record<CleOffreSuite, PageOffreSuite>> = {
  "formation-ia-1-plus-30": {
    ...base("formation-ia-1-plus-30"),
    titre: "Formation IA 1+30 : une journée, 30 jours de suivi · Axion-IA",
    descriptionMeta:
      "Une journée de Formation IA sur les vrais dossiers de vos équipes, 30 jours d’accompagnement et un kit d’assistants IA par participant. Sur devis, après un Diagnostic IA gratuit.",
    h1: "Formation IA 1+30",
    surtitre: "Pour les équipes d’une PME",
    pourQui:
      "Pour les équipes de 2 à 15 personnes d’une PME qui veulent utiliser l’IA de la même façon, sur leurs vraies tâches. Les formations par métier et par secteur du catalogue en sont des variantes.",
    deroule: [
      "Avant la journée : un questionnaire, et chaque participant prépare trois tâches réelles, anonymisées.",
      "La journée, dans l’entreprise : chaque participant chronomètre une tâche réelle faite comme d’habitude, puis la refait avec son assistant. L’écart est noté sur sa fiche.",
      "Pendant 30 jours : une classe virtuelle d’une heure à J+15 et à J+30, et un canal pour poser vos questions.",
    ],
    livrables: [
      "Pour chaque participant, un kit de trois assistants ou modèles de consignes construits sur ses propres tâches.",
      "La charte d’usage de l’IA de l’entreprise et une attestation nominative.",
      "Le bilan de l’équipe, remis au dirigeant : temps avant et après, tâches à mettre en service.",
    ],
    duree:
      "Une journée en entreprise, puis 30 jours d’accompagnement. La date est fixée avec vous dans le devis.",
    faq: [
      {
        id: "faq-pour-qui",
        question: "Pour qui est la Formation IA 1+30 ?",
        reponse:
          "Pour les équipes de 2 à 15 personnes d’une PME. Elle part des tâches réelles des participants, quel que soit leur métier.",
      },
      {
        id: "faq-deroulement",
        question: "Comment se déroule la Formation IA 1+30 ?",
        reponse:
          "Une préparation avant la journée, une journée dans l’entreprise où chaque participant mesure le temps gagné sur une tâche réelle, puis 30 jours d’accompagnement avec deux classes virtuelles d’une heure et un canal de questions.",
      },
      {
        id: "faq-duree",
        question: "Combien de temps dure-t-elle ?",
        reponse: "Une journée sur place, suivie de 30 jours d’accompagnement.",
      },
      DEVIS_FAQ("Formation IA 1+30"),
    ],
  },
  "premier-gain-en-service": {
    ...base("premier-gain-en-service"),
    titre: "Premier gain en service : votre tâche prioritaire mise en place · Axion-IA",
    descriptionMeta:
      "La tâche prioritaire de votre Journée IA, mise en service par Axion-IA en 2 à 6 semaines, avec 30 jours de support. Sur devis, après un Diagnostic IA gratuit.",
    h1: "Premier gain en service",
    surtitre: "Après la Journée IA",
    pourQui:
      "Pour l’entreprise qui a fait sa Journée IA et veut que la tâche qui lui coûte le plus tourne chez elle, sans la mettre en place elle-même.",
    deroule: [
      "Point de départ : la priorité n°1 identifiée et chiffrée pendant la Journée IA.",
      "Mise en service par Axion-IA, en 2 à 6 semaines. Vous validez avant chaque envoi.",
      "Votre équipe est formée sur l’outil, puis 30 jours de support.",
    ],
    livrables: [
      "L’outil en service chez vous.",
      "Votre équipe formée dessus.",
      "30 jours de support.",
      "Le code et les accès vous appartiennent.",
    ],
    duree: "De 2 à 6 semaines pour la mise en service, puis 30 jours de support.",
    faq: [
      {
        id: "faq-pour-qui",
        question: "Pour qui est le Premier gain en service ?",
        reponse:
          "Pour une entreprise qui a fait sa Journée IA et veut la mise en service de la tâche prioritaire qui en est ressortie.",
      },
      {
        id: "faq-deroulement",
        question: "Comment se déroule la mise en service ?",
        reponse:
          "Axion-IA met l’outil en service chez vous en 2 à 6 semaines. Vous validez avant chaque envoi, votre équipe est formée, puis 30 jours de support s’ouvrent.",
      },
      {
        id: "faq-duree",
        question: "Le code m’appartient-il ?",
        reponse: "Oui : le code et les accès livrés vous appartiennent.",
      },
      DEVIS_FAQ("Premier gain en service"),
    ],
  },
  "programme-90-jours": {
    ...base("programme-90-jours"),
    titre: "Programme 90 jours : votre plan d’action réalisé pour vous · Axion-IA",
    descriptionMeta:
      "Le plan à 90 jours de votre Journée IA, exécuté par Axion-IA : gains mis en service, équipe formée, relevé chiffré avant et après. Sur devis, après un Diagnostic IA gratuit.",
    h1: "Programme 90 jours",
    surtitre: "Le plan que vous avez reçu, réalisé pour vous",
    pourQui:
      "Pour l’entreprise qui a reçu son plan d’action à l’issue de la Journée IA et veut qu’il soit exécuté de bout en bout par Axion-IA.",
    deroule: [
      "Point de départ : le plan d’action à 90 jours remis après la Journée IA.",
      "Axion-IA met en service les gains retenus et forme l’équipe concernée.",
      "À l’échéance des 90 jours, une Journée IA Dirigeant fait le bilan.",
    ],
    livrables: [
      "Les gains retenus dans le plan, mis en service.",
      "La Formation IA 1+30 de l’équipe concernée.",
      "Un relevé chiffré avant et après.",
    ],
    duree: "90 jours, à partir du plan remis après la Journée IA.",
    faq: [
      {
        id: "faq-pour-qui",
        question: "Pour qui est le Programme 90 jours ?",
        reponse:
          "Pour une entreprise qui a fait sa Journée IA et préfère confier l’exécution de son plan d’action à Axion-IA.",
      },
      {
        id: "faq-deroulement",
        question: "Comment se déroule le Programme 90 jours ?",
        reponse:
          "Axion-IA exécute le plan d’action issu de la Journée IA : mise en service des gains retenus, formation de l’équipe concernée, puis un bilan avec le dirigeant à l’échéance des 90 jours.",
      },
      {
        id: "faq-duree",
        question: "Combien de temps dure-t-il ?",
        reponse: "90 jours à partir du plan d’action remis après la Journée IA.",
      },
      DEVIS_FAQ("Programme 90 jours"),
    ],
  },
  "suivi-ia-mensuel": {
    ...base("suivi-ia-mensuel"),
    titre: "Suivi IA mensuel : une session par mois, vos outils maintenus · Axion-IA",
    descriptionMeta:
      "Une session par mois, la maintenance des outils livrés et un bilan trimestriel. Sur devis, après un Diagnostic IA gratuit.",
    h1: "Suivi IA mensuel",
    surtitre: "Pour continuer après la mise en service",
    pourQui:
      "Pour l’entreprise qui utilise déjà des outils IA mis en place avec Axion-IA et veut continuer à progresser, chaque mois, avec le même interlocuteur.",
    deroule: [
      "Chaque mois, une session avec vos équipes.",
      "La maintenance des outils déjà livrés.",
      "Chaque trimestre, un bilan chiffré des heures relevées.",
    ],
    livrables: [
      "Une session par mois.",
      "La maintenance des outils livrés.",
      "Un bilan trimestriel.",
    ],
    duree: "Un rythme mensuel. La durée de l’engagement et le préavis sont écrits dans le devis.",
    faq: [
      {
        id: "faq-pour-qui",
        question: "Pour qui est le Suivi IA mensuel ?",
        reponse:
          "Pour une entreprise qui utilise déjà des outils IA mis en place avec Axion-IA et veut un accompagnement régulier.",
      },
      {
        id: "faq-deroulement",
        question: "Comment se déroule le Suivi IA mensuel ?",
        reponse:
          "Une session par mois avec vos équipes, la maintenance des outils livrés, et un bilan trimestriel.",
      },
      {
        id: "faq-duree",
        question: "Quel engagement, quelle durée ?",
        reponse:
          "La durée de l’engagement et le préavis sont écrits dans le devis, après le Diagnostic IA gratuit de 45 minutes.",
      },
      DEVIS_FAQ("Suivi IA mensuel"),
    ],
  },
};

export const TOUTES_LES_PAGES = OFFRES_SUITE.map((o) => PAGES_OFFRES_SUITE[o.cle]);

export const TEXTES = {
  cta: "Réserver un Diagnostic IA",
  pourQui: "Pour qui",
  deroule: "Le déroulé",
  livrables: "Ce que vous recevez",
  duree: "Durée",
  prix: "Prix",
  liens: "Pour aller plus loin",
  lienJournee: "La Journée IA : audit et formation IA chez vous",
  lienDiagnostic: "Premier pas gratuit : un Diagnostic IA de 45 minutes",
  miseAJour: "Mis à jour le",
} as const;
