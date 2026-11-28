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
  /** Sur-titre court au-dessus du H2 (« Formations »). */
  surTitre?: string;
  /** Le H2 formulé en question de dirigeant (tournure neutre, sans « il » ni « elle »). */
  question?: string;
  /** Réponse directe sous le H2 : 30 mots au plus, `{prenom}` remplacé, aucun domaine non renseigné. */
  reponse?: string;
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

/**
 * Carte « Vous êtes… » : le visiteur se reconnaît (tutoiement exclu, « vous »), gains qualitatifs
 * seulement : aucun chiffre, aucun montant. `icone` est une clé résolue par le composant.
 */
export interface CarteVousEtes {
  cle: string;
  titre: string;
  /** Ce que la situation coûte aujourd'hui (en mots, jamais en euros). */
  cout: string;
  /** Ce que l'on peut faire. */
  action: string;
  /** Ce que l'on y gagne (qualitatif). */
  gain: string;
  icone: string;
}

/** « Axion-IA et {prenom} interviennent-ils près de chez moi ? » : réponse directe de 40 à 60 mots. */
export interface PresenceModele {
  question: string;
  reponse: string;
}

/** Pour quelles entreprises : secteurs génériques seulement (`icone` = nom d'icône lucide, à résoudre par le composant ; les cartes « Vous êtes » portent des clés, pas des noms) (jamais de chiffre ni de montant). */
export interface PourQuiModele {
  question: string;
  secteurs: ReadonlyArray<{ libelle: string; icone: string }>;
  phrase?: string;
}

export interface ModeleCategorie {
  sections: ReadonlyArray<SectionModele>;
  /** 3 cartes « Vous êtes… » au plus ; vide : bloc non rendu. */
  vousEtes: ReadonlyArray<CarteVousEtes>;
  /** Question et réponse « intervient-on près de chez moi ? » (bloc « Partout en France »). */
  presence: PresenceModele;
  /** Pour quelles entreprises ; absent : bloc non rendu. */
  pourQui?: PourQuiModele;
  /** Chiffres que la catégorie a le droit de calculer, depuis des champs réellement remplis. */
  chiffresAutorises?: ReadonlyArray<"langues" | "publications" | "annee-arrivee" | "metiers">;
  /** Boutons d'action (hero et appel final). Vide : boutons par défaut de la fiche. */
  actions: ReadonlyArray<ActionModele>;
  /** 3 à 5 questions de dirigeant de PME. */
  faq: ReadonlyArray<QuestionModele>;
}

const PRESENCE_DIRECTION: PresenceModele = {
  question: "{prenom} et l'équipe d'Axion-IA interviennent-ils près de chez moi ?",
  reponse:
    "Oui. L'équipe d'Axion-IA, dont {prenom} fait partie, intervient sur place partout en France, outre-mer compris, et à distance. Le lieu de votre entreprise ne change rien à la méthode : un premier échange permet de choisir ensemble ce qui se fait chez vous et ce qui se fait par visioconférence.",
};

const VIDE: ModeleCategorie = {
  sections: [],
  vousEtes: [],
  presence: PRESENCE_DIRECTION,
  actions: [],
  faq: [],
};

export const MODELES: Readonly<Record<Categorie, ModeleCategorie>> = {
  // Direction : fiche de Williams et persona IA inchangées.
  direction: VIDE,

  "specialiste-ia": {
    sections: [
      {
        id: "formations",
        titre: "Les formations et accompagnements animés par {prenom}",
        surTitre: "Formations",
        question: "Quelles formations anime {prenom} ?",
        reponse:
          "{prenom} est spécialiste IA dans l'équipe Axion-IA : formation et accompagnement d'équipes d'entreprise à l'usage concret de l'IA dans leur métier.",
        paragraphes: [
          "{prenom} intervient au sein de l'équipe Axion-IA pour former et accompagner des équipes d'entreprise à l'usage concret de l'IA.",
          "Le contenu et le format se décident ensemble, à partir de votre activité et de vos usages réels, après un premier échange.",
        ],
      },
      {
        id: "metiers-secteurs",
        titre: "Les métiers et secteurs que {prenom} connaît",
        surTitre: "Métiers",
        question: "Quels métiers et secteurs connaît {prenom} ?",
        paragraphes: ["Les domaines de compétence que {prenom} a renseignés :"],
        exigeDonnees: "competences",
      },
    ],
    vousEtes: [
      {
        cle: "equipe-debordee",
        titre: "Vous dirigez une équipe qui perd du temps sur les tâches répétitives",
        cout: "Rédaction, devis et relances absorbent des journées entières.",
        action: "Faire former l'équipe à l'IA appliquée à son propre métier.",
        gain: "Des tâches courantes plus rapides et une équipe plus à l'aise avec l'outil.",
        icone: "temps",
      },
      {
        cle: "formation-oubliee",
        titre: "Vous voulez former sans imposer un outil de plus",
        cout: "Une formation théorique que personne n'applique dès le lundi suivant.",
        action: "Construire le contenu à partir de vos cas réels, avec vos équipes.",
        gain: "Des pratiques qui restent dans le quotidien du travail.",
        icone: "equipe",
      },
      {
        cle: "premier-pas",
        titre: "Votre entreprise n'a encore aucun usage de l'IA",
        cout: "L'hésitation retarde le démarrage, faute de savoir par où commencer.",
        action: "Réserver un Diagnostic IA avant de décider d'une formation.",
        gain: "Un point de départ clair et un choix en connaissance de cause.",
        icone: "projet",
      },
    ],
    presence: {
      question: "{prenom} et l'équipe d'Axion-IA interviennent-ils près de chez moi ?",
      reponse:
        "Oui, dans toute la France, outre-mer compris. Les formations et accompagnements se tiennent dans vos locaux, ou à distance lorsque le sujet s'y prête. Le lieu, le format et les dates se décident ensemble lors d'un premier échange avec l'équipe d'Axion-IA, quelle que soit la région de votre entreprise.",
    },
    chiffresAutorises: ["langues", "annee-arrivee", "publications"],
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
        surTitre: "Réalisations",
        question: "Que construit {prenom} pour les entreprises ?",
        reponse:
          "{prenom} conçoit, avec l'équipe Axion-IA, des outils et automatisations sur mesure, à partir d'un besoin métier précis de l'entreprise.",
        paragraphes: [
          "{prenom} conçoit et met en place, avec l'équipe Axion-IA, des outils et des automatisations sur mesure pour des entreprises, à partir d'un besoin métier précis.",
          "Chaque projet commence par comprendre votre fonctionnement actuel, pour ne construire que ce qui sert vraiment à vos équipes.",
        ],
      },
      {
        id: "technologies",
        titre: "Technologies et méthodes de {prenom}",
        surTitre: "Technologies",
        question: "Avec quelles technologies travaille {prenom} ?",
        paragraphes: ["Les technologies et méthodes que {prenom} a renseignées :"],
        exigeDonnees: "competences",
      },
      {
        id: "securite",
        titre: "Sécurité et confidentialité des données",
        surTitre: "Données",
        question: "Comment les données sont-elles protégées pendant un projet ?",
        reponse:
          "Les données de l'entreprise ne servent qu'au projet concerné, avec un accès limité aux personnes de l'équipe qui en ont besoin, dans le cadre du RGPD.",
        paragraphes: [
          "Les données de votre entreprise ne sont utilisées que pour le projet qui les concerne, et seules les personnes de l'équipe qui en ont besoin y accèdent.",
          "Le cadre de protection des données personnelles (RGPD) s'applique à chaque projet.",
        ],
        lien: { href: "/rgpd", libelle: "Lire notre page sur les données personnelles" },
      },
    ],
    vousEtes: [
      {
        cle: "double-saisie",
        titre: "Vous recopiez des données d'un outil à l'autre",
        cout: "Les mêmes informations sont saisies deux fois, avec des erreurs à la clé.",
        action: "Relier vos outils par une automatisation construite pour votre fonctionnement.",
        gain: "Moins de saisie répétée et des données fiables d'un outil à l'autre.",
        icone: "outils",
      },
      {
        cle: "logiciel-inadapte",
        titre: "Votre logiciel actuel ne colle pas à votre métier",
        cout: "Vos équipes contournent l'outil avec des tableurs et des messages.",
        action: "Décrire le besoin, puis construire seulement ce qui sert vraiment.",
        gain: "Un outil que les équipes utilisent parce qu'il suit leur façon de travailler.",
        icone: "projet",
      },
      {
        cle: "donnees-sensibles",
        titre: "Vous vous demandez où vont vos données",
        cout: "L'inquiétude sur la confidentialité freine les projets avant leur début.",
        action: "Poser la question dès le premier échange et lire la page sur les données.",
        gain: "Un cadre clair sur l'usage et l'accès aux données de l'entreprise.",
        icone: "donnees",
      },
    ],
    presence: {
      question: "{prenom} et l'équipe d'Axion-IA interviennent-ils près de chez moi ?",
      reponse:
        "Oui. Les projets se conduisent à distance, avec des points réguliers par visioconférence, et sur place partout en France, outre-mer compris, lorsque la situation l'exige : installation, formation des utilisateurs, atelier avec les équipes. Un premier échange avec Axion-IA permet de choisir ce qui convient à votre entreprise.",
    },
    chiffresAutorises: ["langues", "annee-arrivee", "publications"],
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
        surTitre: "Rôle",
        question: "Quel est le rôle de {prenom} auprès des entreprises ?",
        reponse:
          "{prenom} met des dirigeants en relation avec l'équipe Axion-IA et présente la Journée IA ; la suite est assurée par Axion-IA.",
        paragraphes: [
          "{prenom} fait partie du réseau d'apporteurs d'affaires d'Axion-IA. Son rôle est de vous présenter Axion-IA lorsque l'IA peut aider votre entreprise.",
          "{prenom} ne vend pas, ne conseille pas à la place d'Axion-IA et ne remet pas de devis : ce travail est celui d'Axion-IA.",
        ],
      },
      {
        id: "contacte",
        titre: "Vous avez été contacté par {prenom} ?",
        surTitre: "Un message reçu",
        question: "Que faire après un message de {prenom} ?",
        reponse:
          "{prenom} fait partie du réseau d'Axion-IA et vous présente Axion-IA ; le devis est toujours établi par Axion-IA, que vous pouvez joindre directement.",
        paragraphes: [
          "{prenom} fait partie du réseau d'Axion-IA et vous présente Axion-IA. Vous n'avez rien à régler à {prenom} : le devis est toujours établi par Axion-IA.",
          "En cas de doute, contactez Axion-IA directement : nous vous répondons.",
        ],
        lien: { href: "/contact", libelle: "Contacter Axion-IA" },
      },
      {
        id: "devenir",
        titre: "Devenir apporteur d'affaires",
        surTitre: "Réseau",
        question: "Comment devenir apporteur d'affaires d'Axion-IA ?",
        reponse:
          "Axion-IA recrute des apporteurs d'affaires indépendants dans toute la France ; la page dédiée présente le rôle et la façon de candidater.",
        paragraphes: [
          "Vous connaissez des dirigeants que l'IA pourrait aider ? Axion-IA recrute des apporteurs d'affaires dans toute la France.",
        ],
        lien: {
          href: "/devenir-commercial-ia",
          libelle: "Devenir apporteur d'affaires indépendant",
        },
      },
    ],
    vousEtes: [
      {
        cle: "dirigeant-curieux",
        titre: "Vous dirigez une entreprise et l'IA vous intrigue",
        cout: "Le sujet reste en attente, faute de temps pour s'y pencher.",
        action: "Échanger avec Axion-IA lors d'un Diagnostic IA.",
        gain: "Une vision concrète de ce que l'IA peut faire dans votre entreprise.",
        icone: "temps",
      },
      {
        cle: "message-recu",
        titre: "Vous avez reçu un message de {prenom}",
        cout: "Un doute sur la personne qui écrit et sur ce qui vous est proposé.",
        action: "Écrire directement à Axion-IA pour poser la question, sans intermédiaire.",
        gain: "Une réponse claire de l'équipe, et la liberté de décider.",
        icone: "lien",
      },
      {
        cle: "dirigeants-connus",
        titre: "Vous connaissez des dirigeants que l'IA pourrait aider",
        cout: "Vous n'avez pas toujours les mots pour leur en parler.",
        action: "Les présenter à Axion-IA, qui prend ensuite la suite.",
        gain: "Un service rendu à votre entourage professionnel.",
        icone: "reseau",
      },
    ],
    presence: {
      question: "{prenom} et l'équipe d'Axion-IA interviennent-ils près de chez moi ?",
      reponse:
        "Axion-IA intervient sur place partout en France, outre-mer compris, et à distance. {prenom} vous met en relation avec l'équipe, qui réalise elle-même les interventions : il suffit d'indiquer votre région lors du premier échange pour convenir du lieu et du format qui conviennent à votre entreprise.",
    },
    pourQui: {
      question: "Quelles entreprises peuvent être présentées à Axion-IA par {prenom} ?",
      secteurs: [
        { libelle: "BTP et artisanat", icone: "HardHat" },
        { libelle: "Commerce et distribution", icone: "Store" },
        { libelle: "Santé et médico-social", icone: "Stethoscope" },
        { libelle: "Cabinets comptables et juridiques", icone: "Scale" },
        { libelle: "Services aux entreprises", icone: "Handshake" },
      ],
      phrase:
        "Toute TPE ou PME peut être présentée, quel que soit son secteur : Axion-IA part de ses tâches réelles.",
    },
    chiffresAutorises: ["langues"],
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
        question: "Quel est le lien entre {prenom} et Axion-IA ?",
        answer:
          "Mise en relation seulement : {prenom} fait partie du réseau d'apporteurs d'affaires d'Axion-IA et n'est pas salarié d'Axion-IA. Le devis est établi par Axion-IA.",
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
        answer: "Contactez Axion-IA directement par la page contact : nous vous répondons.",
      },
    ],
  },

  partenaire: {
    sections: [
      {
        id: "apporte",
        titre: "Ce que {prenom} apporte aux missions Axion-IA",
        surTitre: "Apport",
        question: "Que propose {prenom} avec Axion-IA ?",
        reponse:
          "{prenom} est partenaire d'Axion-IA : une expertise complémentaire que l'équipe mobilise lorsqu'une mission la demande.",
        paragraphes: [
          "{prenom} est partenaire d'Axion-IA : une expertise complémentaire que l'équipe mobilise lorsqu'une mission la demande.",
        ],
      },
      {
        id: "travail",
        titre: "Comment {prenom} travaille avec l'équipe",
        surTitre: "Collaboration",
        question: "Comment travailler avec {prenom} et l'équipe d'Axion-IA ?",
        reponse:
          "{prenom} intervient en lien avec l'équipe Axion-IA, qui reste votre interlocuteur et coordonne la mission du début à la fin.",
        paragraphes: [
          "{prenom} intervient en lien avec l'équipe Axion-IA, qui reste votre interlocuteur et coordonne la mission du début à la fin.",
        ],
      },
    ],
    vousEtes: [
      {
        cle: "expertise-complementaire",
        titre: "Votre projet demande une expertise complémentaire",
        cout: "Un seul profil ne couvre pas tout le besoin, et la mission traîne.",
        action: "Décrire la mission : Axion-IA mobilise le bon partenaire.",
        gain: "Une expertise adaptée, sans multiplier vos interlocuteurs.",
        icone: "equipe",
      },
      {
        cle: "interlocuteur-unique",
        titre: "Vous voulez un seul interlocuteur du début à la fin",
        cout: "Coordonner plusieurs intervenants vous prend du temps.",
        action: "Passer par Axion-IA, qui coordonne et reste votre contact.",
        gain: "Une mission suivie de bout en bout, sans relais à gérer.",
        icone: "lien",
      },
      {
        cle: "premier-echange",
        titre: "Vous ne savez pas à qui vous adresser",
        cout: "Le besoin reste flou et la décision se repousse.",
        action: "Écrire à Axion-IA pour cadrer la demande lors d'un premier échange.",
        gain: "Un besoin clarifié et la bonne personne pour y répondre.",
        icone: "projet",
      },
    ],
    presence: {
      question: "{prenom} et l'équipe d'Axion-IA interviennent-ils près de chez moi ?",
      reponse:
        "Les missions se coordonnent depuis Axion-IA, qui intervient partout en France, outre-mer compris, sur place et à distance. Selon la mission, {prenom} participe en visioconférence ou sur place. Le premier échange permet de préciser la région de votre entreprise et de choisir le format qui convient.",
    },
    chiffresAutorises: ["langues"],
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
