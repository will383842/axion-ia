/**
 * Modèle propre à chaque catégorie de collaborateur (module PUR : textes seulement).
 *
 * Ajouter une catégorie = une entrée dans `MODELES` + ses textes ; aucun composant à toucher.
 * `{prenom}` est remplacé par le PRÉNOM SEUL du collaborateur (jamais un nom de famille).
 *
 * Règles de contenu : aucun montant, taux ou commission ; aucune promesse sur ce qu'Axion-IA
 * contrôle chez une personne ; les réponses propres à la personne passent avant ces réponses modèles.
 */
import type { Categorie } from "./types";

export interface ActionModele {
  libelle: string;
  href: string;
  variante: "primaire" | "secondaire";
}

export interface SectionModele {
  id: string;
  /** H2 ; `{prenom}` remplacé. */
  titre: string;
  paragraphes: ReadonlyArray<string>;
  lien?: { href: string; libelle: string };
  /**
   * Si posé, la section n'est rendue que si la fiche porte ces données (et les liste).
   * Sans donnée : aucune section, jamais de titre vide.
   */
  exigeDonnees?: "competences";
}

export interface QuestionModele {
  id: string;
  question: string;
  answer: string;
}

export interface ModeleCategorie {
  sections: ReadonlyArray<SectionModele>;
  /** Boutons d'action (hero et appel final). Vide : boutons par défaut de la fiche. */
  actions: ReadonlyArray<ActionModele>;
  /** 3 à 5 questions de dirigeant de PME. */
  faq: ReadonlyArray<QuestionModele>;
}

const VIDE: ModeleCategorie = { sections: [], actions: [], faq: [] };

export const MODELES: Readonly<Record<Categorie, ModeleCategorie>> = {
  // Direction : fiche de Williams et persona IA inchangées.
  direction: VIDE,

  "specialiste-ia": {
    sections: [
      {
        id: "formations",
        titre: "Les formations et accompagnements animés par {prenom}",
        paragraphes: [
          "{prenom} intervient au sein de l'équipe Axion-IA pour former et accompagner des équipes d'entreprise à l'usage concret de l'IA.",
          "Le contenu et le format se décident ensemble, à partir de votre activité et de vos usages réels, après un premier échange.",
        ],
      },
      {
        id: "metiers-secteurs",
        titre: "Les métiers et secteurs que {prenom} connaît",
        paragraphes: ["Les domaines de compétence que {prenom} a renseignés :"],
        exigeDonnees: "competences",
      },
    ],
    actions: [
      { libelle: "Demander une formation", href: "/contact", variante: "primaire" },
      { libelle: "Réserver un Diagnostic IA", href: "/appel", variante: "secondaire" },
    ],
    faq: [
      {
        id: "role",
        question: "Que fait {prenom} au sein d'Axion-IA ?",
        answer:
          "{prenom} est spécialiste IA dans l'équipe Axion-IA : formations et accompagnements d'équipes d'entreprise à l'IA appliquée à leur métier.",
      },
      {
        id: "demander",
        question: "Comment demander une formation animée par {prenom} ?",
        answer:
          "Utilisez le bouton « Demander une formation » : Axion-IA reprend votre demande, en précise le besoin avec vous et organise l'intervention avec l'équipe.",
      },
      {
        id: "diagnostic",
        question: "Par où commencer si mon entreprise n'a encore aucun usage de l'IA ?",
        answer:
          "Par un Diagnostic IA : un échange pour repérer où l'IA peut aider concrètement votre entreprise, avant de décider d'une formation ou d'un projet.",
      },
    ],
  },

  developpeur: {
    sections: [
      {
        id: "construit",
        titre: "Ce que {prenom} construit pour les entreprises",
        paragraphes: [
          "{prenom} conçoit et met en place, avec l'équipe Axion-IA, des outils et des automatisations sur mesure pour des entreprises, à partir d'un besoin métier précis.",
          "Chaque projet commence par comprendre votre fonctionnement actuel, pour ne construire que ce qui sert vraiment à vos équipes.",
        ],
      },
      {
        id: "technologies",
        titre: "Technologies et méthodes de {prenom}",
        paragraphes: ["Les technologies et méthodes que {prenom} a renseignées :"],
        exigeDonnees: "competences",
      },
      {
        id: "securite",
        titre: "Sécurité et confidentialité des données",
        paragraphes: [
          "Les données de votre entreprise ne sont utilisées que pour le projet qui les concerne, et seules les personnes de l'équipe qui en ont besoin y accèdent.",
          "Le cadre de protection des données personnelles (RGPD) s'applique à chaque projet.",
        ],
        lien: { href: "/rgpd", libelle: "Lire notre page sur les données personnelles" },
      },
    ],
    actions: [{ libelle: "Parler d'un projet", href: "/contact", variante: "primaire" }],
    faq: [
      {
        id: "construit",
        question: "Que peut construire {prenom} pour mon entreprise ?",
        answer:
          "Des outils et automatisations sur mesure, partant d'un besoin précis de vos équipes. Le périmètre se définit avec vous lors d'un premier échange.",
      },
      {
        id: "donnees",
        question: "Mes données restent-elles confidentielles ?",
        answer:
          "Elles ne servent qu'au projet concerné, avec un accès limité aux personnes qui en ont besoin, dans le cadre du RGPD.",
      },
      {
        id: "demarrer",
        question: "Comment démarrer un projet avec {prenom} ?",
        answer:
          "Décrivez votre besoin via « Parler d'un projet » : Axion-IA vous répond et organise la suite avec l'équipe.",
      },
    ],
  },

  apporteur: {
    sections: [
      {
        id: "role",
        titre: "Le rôle de {prenom} : mettre en relation, pas vendre",
        paragraphes: [
          "{prenom} fait partie du réseau d'apporteurs d'affaires d'Axion-IA. Son rôle est de vous présenter Axion-IA lorsque l'IA peut aider votre entreprise.",
          "{prenom} ne vend pas, ne conseille pas à la place d'Axion-IA et ne remet pas de devis : ce travail est celui d'Axion-IA.",
        ],
      },
      {
        id: "contacte",
        titre: "Vous avez été contacté par {prenom} ?",
        paragraphes: [
          "{prenom} fait partie du réseau d'Axion-IA et vous présente Axion-IA. Vous n'avez rien à régler à {prenom} : le devis est toujours établi par Axion-IA.",
          "En cas de doute, contactez Axion-IA directement : nous vous répondons.",
        ],
        lien: { href: "/contact", libelle: "Contacter Axion-IA" },
      },
      {
        id: "devenir",
        titre: "Devenir apporteur d'affaires",
        paragraphes: [
          "Vous connaissez des dirigeants que l'IA pourrait aider ? Axion-IA recrute des apporteurs d'affaires dans toute la France.",
        ],
        lien: {
          href: "/devenir-commercial-ia",
          libelle: "Devenir apporteur d'affaires indépendant",
        },
      },
    ],
    actions: [
      {
        libelle: "Réserver un Diagnostic IA avec Axion-IA",
        href: "/appel",
        variante: "primaire",
      },
      { libelle: "Devenir apporteur", href: "/devenir-commercial-ia", variante: "secondaire" },
    ],
    faq: [
      {
        id: "salarie",
        question: "{prenom} est-il salarié d'Axion-IA ?",
        answer:
          "{prenom} fait partie du réseau d'apporteurs d'affaires d'Axion-IA : mise en relation seulement. Le devis est établi par Axion-IA.",
      },
      {
        id: "devis",
        question: "Qui établit le devis et assure la prestation ?",
        answer:
          "Axion-IA, toujours. L'apporteur présente Axion-IA ; il n'établit aucun devis et ne réalise pas la prestation.",
      },
      {
        id: "direct",
        question: "Puis-je contacter Axion-IA sans passer par {prenom} ?",
        answer:
          "Oui, à tout moment : réservez un Diagnostic IA ou écrivez-nous directement, sans intermédiaire.",
      },
      {
        id: "doute",
        question: "Un doute sur un message reçu : que faire ?",
        answer:
          "Contactez Axion-IA directement par la page contact. Nous vous confirmons si le message correspond bien à notre réseau.",
      },
    ],
  },

  partenaire: {
    sections: [
      {
        id: "apporte",
        titre: "Ce que {prenom} apporte aux missions Axion-IA",
        paragraphes: [
          "{prenom} est partenaire d'Axion-IA : une expertise complémentaire que l'équipe mobilise lorsqu'une mission la demande.",
        ],
      },
      {
        id: "travail",
        titre: "Comment {prenom} travaille avec l'équipe",
        paragraphes: [
          "{prenom} intervient en lien avec l'équipe Axion-IA, qui reste votre interlocuteur et coordonne la mission du début à la fin.",
        ],
      },
    ],
    actions: [{ libelle: "Contact", href: "/contact", variante: "primaire" }],
    faq: [
      {
        id: "role",
        question: "Qui est {prenom} pour Axion-IA ?",
        answer:
          "{prenom} est partenaire d'Axion-IA : une expertise complémentaire mobilisée sur certaines missions.",
      },
      {
        id: "interlocuteur",
        question: "Qui est mon interlocuteur sur une mission ?",
        answer: "Axion-IA : l'équipe coordonne la mission et reste votre contact.",
      },
      {
        id: "contacter",
        question: "Comment contacter {prenom} ?",
        answer: "Par la page contact d'Axion-IA, qui transmet et coordonne.",
      },
    ],
  },
};

export function remplirPrenom(texte: string, prenom: string): string {
  return texte.replaceAll("{prenom}", prenom);
}
