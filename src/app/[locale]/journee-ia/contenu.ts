// La Journée IA — TOUT le texte de la page, en un seul endroit.
//
// Source : la maquette validée `PAGE-FINIE-JOURNEE-IA.html` (09/11/2026, décisions 1 à 30
// de l'audit final et arbitrages du § 8). Les composants ne portent aucun texte visible, ils le
// reçoivent d'ici, et le test des mots interdits (`__tests__/contenu.spec.ts`) lit CE fichier.
//
// 🔑 Aucun montant n'est écrit. Quatre jetons sont remplacés par `remplacerJetons()`
// (`@/content/journee-ia-commun`) avec la valeur lue dans `pricing.ts` ou calculée :
//   {{PRIX}}  ·  {{GAIN_EXEMPLE}}  ·  {{TAUX_HORAIRE}}  ·  {{HEURES_EXEMPLE}}
//
// Les espaces insécables (U+202F avant « ? : ; ! », U+00A0 avant « h », « % », « n° ») et les
// apostrophes « ’ » sont ceux de la maquette : ne pas les « normaliser ».

import {
  CONDITION_GARANTIE,
  EN_BREF_JOURNEE_IA,
  GARANTIE,
  GARANTIE_PHRASE,
  JETON_PRIX,
  MENTION_DECLARATION_OF,
  RAPPORT_COMPLET,
} from "@/content/journee-ia-commun";

// Le jeton de prix et la garantie vivent dans le module commun (partagés avec l'accueil, le
// JSON-LD et llms*.txt) ; on les réexporte pour les importeurs actuels (`prix.ts`, les tests).
export { GARANTIE, JETON_PRIX };

/** Le seul libellé de bouton de la page (haut, déroulé, prix, appel final, barre mobile). */
export const LIBELLE_CTA = "Réserver un appel";

/** Titre de la page (55 caractères) : il porte la marque, donc il est rendu tel quel. */
export const TITRE = "La Journée IA : audit et formation IA en PME · Axion-IA";

/** Description de la page, de l'aperçu social et de `WebPage.description` (décision 19). */
export const DESCRIPTION_META =
  "La Journée IA dans vos locaux, partout en France : vos plus gros gains chiffrés, vos équipes formées. {{PRIX}}, garantie écrite sous condition.";

/** Texte alternatif de l'image d'aperçu (Open Graph et Twitter). */
export const OG_IMAGE_ALT =
  "La Journée IA d’Axion-IA : audit et formation IA dans vos locaux, {{PRIX}}";

/** Début de la promesse, mis en gras dans `GARANTIE_PHRASE`. */
export const DEBUT_PROMESSE = "nous vous remboursons";

export const CONTENU = {
  accroche: {
    surtitre: "PME et TPE",
    titre: "La Journée IA\u202f: vos plus gros gains chiffrés, vos équipes formées.",
    // Mots mis en terracotta dans le titre.
    titreAccent: "vos équipes formées.",
    phrase:
      "Le matin, nous cartographions votre entreprise et faisons le point ensemble sur vos priorités\u202f: vos plus gros gains, chiffrés le jour même, ceux qui rapportent le plus et se mettent en place le plus vite. L’après-midi, nous formons vos équipes. Dans vos locaux, partout en France.",
    cta: LIBELLE_CTA,
    lienDecide: "Déjà décidé\u202f? Fixons la date ensemble",
    microTexte: "Diagnostic IA gratuit et facultatif · 45 minutes · en visio ou par téléphone · sans engagement",
    tuiles: [
      { valeur: JETON_PRIX, legende: "une fois, sans remise" },
      // Tuile mise en valeur (filet terracotta) : l’attestation remise à chaque personne formée.
      {
        valeur: "L’après-midi",
        legende: "formation + attestation par personne",
        attestation: true,
      },
      { valeur: "Sous 3 jours ouvrés", legende: "vos priorités, dans le rapport détaillé" },
      { valeur: "Garantie ×3", legende: "voir la condition →", ancre: "#garantie" },
    ],
    carteDesGains: {
      titre: "Votre entreprise, cartographiée",
      sousTitre:
        "Un exemple, pas le vôtre\u202f: vos chiffres sont relevés sur place avec vous, service par service.",
      lignes: [
        {
          libelle: "Ressaisies entre services",
          heures: "6\u00a0h",
          largeur: 100,
          plusGrosGain: "Plus gros gain",
        },
        { libelle: "Devis et relances", heures: "3\u00a0h", largeur: 50 },
        { libelle: "Comptes rendus", heures: "2\u00a0h", largeur: 33 },
        { libelle: "Réponses clients", heures: "1\u00a0h\u00a030", largeur: 25 },
      ],
      total: {
        phrase: "Ressaisies entre services\u202f: {{HEURES_EXEMPLE}} par semaine",
        montant: "{{GAIN_EXEMPLE}}",
        suite: "de temps payé par an",
      },
      prix: { avant: "La Journée IA\u202f:", montant: JETON_PRIX, apres: ", une fois." },
      // Le ruban de la carte des gains : audit le matin, formation l'après-midi, priorités le soir.
      ruban: {
        audit: "Audit",
        formation: "Formation",
        heures: ["9\u00a0h", "12\u00a0h", "13\u00a0h 30", "17\u00a0h 30"],
      },
      ariaLabelRuban:
        "Déroulé\u202f: audit de 9\u00a0h à 12\u00a0h, formation de 13\u00a0h 30 à 17\u00a0h 30, priorités dans le rapport détaillé remis sous 3 jours ouvrés",
    },
  },
  enBref: EN_BREF_JOURNEE_IA,
  pourQui: {
    surtitre: "Avant de réserver",
    titre: "Pour qui est la Journée IA\u202f?",
    titreOui: "C’est pour vous",
    titreNon: "Pas pour vous",
    pourVous: [
      "PME ou TPE, de 5 à 249 salariés",
      "Des heures perdues sur des tâches qui reviennent",
      "Chacun utilise l’IA dans son coin",
    ],
    pasPourVous: ["Un cours technique", "Une équipe indisponible ce jour-là"],
    lienAppel: "Pas sûr\u202f? Réserver un appel",
    titreExemples: "Exemples types, par secteur",
    exemples: [
      {
        secteur: "BTP et artisans",
        phrase: "Le devis tiré du chantier.",
        image: "btp_immobilier",
      },
      {
        secteur: "Commerce",
        phrase: "Questions clients triées, réponses prêtes.",
        image: "commerce_retail",
      },
      {
        secteur: "Santé et cabinets",
        phrase: "Les rappels de rendez-vous.",
        image: "sante_medecine",
      },
      {
        secteur: "Industrie et bureaux d’études",
        phrase: "La veille des appels d’offres.",
        image: "industrie_logistique",
      },
      {
        secteur: "Services et conseil",
        phrase: "Les comptes rendus rédigés.",
        image: "comptabilite_finance",
      },
    ],
    insee: {
      texte:
        "En 2025, 18\u00a0% des entreprises françaises de 10 salariés ou plus déclarent utiliser au moins une technologie d’IA, et 15\u00a0% de celles de 10 à 49 salariés. Source\u202f:",
      source: "Insee Première n°\u00a02120, juillet 2026",
      url: "https://www.insee.fr/fr/statistiques/9025878",
    },
  },
  deroule: {
    surtitre: "Le déroulé",
    titre: "Votre journée, heure par heure",
    etapes: [
      {
        icone: "fichier",
        jalons: [{ moment: "Avant", texte: "Un court questionnaire" }],
      },
      {
        icone: "audit",
        jalons: [{ moment: "9\u00a0h – 12\u00a0h", texte: "La cartographie, service par service" }],
      },
      {
        icone: "formation",
        jalons: [
          { moment: "13\u00a0h 30 – 17\u00a0h 30", texte: "La formation, sur vos dossiers" },
        ],
      },
      {
        icone: "plan",
        jalons: [
          { moment: "17\u00a0h 30", texte: "Vos 3 à 5 priorités, écrites dans le rapport détaillé remis sous 3 jours ouvrés" },
          { moment: "Sous 3 jours ouvrés", texte: "Le rapport complet" },
        ],
      },
    ],
  },
  recevez: {
    surtitre: "Compris dans le prix",
    titre: "Ce que vous recevez",
    elements: [
      // En premier et pleine largeur : l’attestation nominative de chaque personne formée.
      {
        icone: "dossier",
        titre: "Une attestation de formation par personne",
        texte: "Chaque participant repart avec une attestation de formation nominative et datée.",
        vedette: true,
      },
      { icone: "audit", titre: "La carte de vos services\u202f: où partent vos heures" },
      {
        icone: "calcul",
        titre:
          "Vos 3 à 5 plus gros gains, découverts le jour même et chiffrés en heures et en euros\u202f: ceux au meilleur retour sur investissement, les plus rapides à mettre en place",
      },
      { icone: "formation", titre: "Formation sur vos dossiers" },
      { icone: "regles", titre: "Vos règles d’usage de l’IA" },
      {
        icone: "plan",
        titre: "Plan d’action à 90 jours",
        delai: "Rapport complet sous 3 jours ouvrés",
      },
    ],
  },
  calcul: {
    surtitre: "Le calcul",
    titre: "Combien vous coûtent ces heures\u202f?",
    facteurs: ["{{HEURES_EXEMPLE}} par semaine", "45 semaines", "{{TAUX_HORAIRE}} de l’heure"],
    total: "{{GAIN_EXEMPLE}}",
    totalSuite: "de temps payé chaque année.",
    nuance: "Nous n’annonçons jamais un gain à l’avance.",
    lien: "Calculez le vôtre",
  },
  prix: {
    surtitre: "Un prix, une garantie",
    titre: "Combien coûte la Journée IA\u202f?",
    montant: JETON_PRIX,
    unite: "la journée",
    lignes: ["Dans vos locaux", "Sans remise", "Devis écrit, rien à payer en ligne"],
    ancre: "Dans cet exemple type, la journée coûte moins de deux mois de ces heures.",
    titreGarantie: "Pas 3 fois le prix en gains identifiés\u202f? Nous vous remboursons.",
    garantie: GARANTIE_PHRASE,
    condition: CONDITION_GARANTIE,
    rapport: RAPPORT_COMPLET,
    lienDecide: "Déjà décidé\u202f? Fixons la date ensemble",
    mention: MENTION_DECLARATION_OF,
  },
  aiAct: {
    surtitre: "Règlement européen",
    titre: "Que demande l’article 4 de l’AI Act\u202f?",
    cartes: [
      {
        icone: "fichier",
        titre: "L’article 4",
        texte:
          "L’article 4 du règlement européen sur l’IA, applicable depuis le 2 février 2025 et réécrit en juillet 2026, demande aux entreprises qui utilisent des systèmes d’IA de prendre des mesures pour soutenir la maîtrise de l’IA de leur personnel, sans fixer de niveau à garantir pour chacun.",
      },
      {
        icone: "formation",
        titre: "La journée",
        texte: "4 heures de formation, une mesure concrète au titre de l’article 4.",
      },
      {
        icone: "dossier",
        titre: "Une attestation par personne formée",
        texte:
          "Nominative et datée, remise à chaque participant\u00a0: la trace écrite d’une mesure prise au titre de l’article 4 de l’AI Act.",
        attestation: true,
      },
    ],
    source: {
      prefixe: "Source\u202f:",
      libelle: "Règlement (UE) 2024/1689, art. 4, modifié par le règlement (UE) 2026/1744",
      url: "https://eur-lex.europa.eu/eli/reg/2026/1744/oj",
    },
  },
  qui: {
    surtitre: "L’équipe",
    titre: "Qui est derrière la Journée IA\u202f?",
    phrase:
      "Les intervenants d’Axion-IA qui viennent chez vous sont nommés dans votre devis, avec leurs qualités.",
    citation:
      "«\u202fDans chaque entreprise, des heures se perdent sans bruit. Nous les trouvons, nous les chiffrons et nous les rendons à votre productivité, à votre rentabilité et à votre chiffre d’affaires. Nous en sommes sûrs au point de garantir la journée sur les gains identifiés.\u202f»",
    auteur: "Williams Jullin, fondateur d’Axion-IA",
    lien: "Le parcours de Williams Jullin",
    lienHref: "/equipe/williams",
    altPortrait: "Williams Jullin, fondateur d’Axion-IA",
  },
  faq: [
    {
      id: "faq-prix",
      question: "Combien coûte la Journée IA, et qu’est-ce qui est compris\u202f?",
      reponse:
        "{{PRIX}} la journée, dans vos locaux\u202f: un prix unique, sans remise. Il comprend l’audit, la formation, les attestations, le rapport et le plan d’action. Rien ne se paie en ligne\u202f: les modalités figurent dans votre devis.",
    },
    {
      id: "faq-audit-cout",
      question: "Combien coûte un audit IA pour une PME\u202f?",
      reponse:
        "Chez Axion-IA, l’audit commence par la Journée IA\u202f: un audit de 2 à 4\u00a0h selon la structuration de l’entreprise le matin, compris dans {{PRIX}} avec la formation de l’après-midi. Un audit plus poussé, sur plusieurs sites ou services, se fait sur devis.",
    },
    {
      id: "faq-garantie",
      question: "Et si l’audit trouve peu de gains\u202f?",
      reponse: `${GARANTIE_PHRASE} ${CONDITION_GARANTIE}`,
    },
    {
      id: "faq-preparer",
      question: "Que faut-il préparer\u202f?",
      reponse:
        "Presque rien\u202f: un court questionnaire avant la journée, et rien à installer. La date est fixée avec vous\u202f; les horaires sont indicatifs.",
    },
    {
      id: "faq-temps",
      question: "Combien de temps cela prend-il à nos équipes\u202f?",
      reponse:
        "Le matin, de 9\u00a0h à 12\u00a0h (13\u00a0h dans les plus grandes entreprises), chaque service nous reçoit à son tour, puis le total et les 3 à 5 tâches prioritaires sont validés avec vous. L’après-midi, de 13\u00a0h 30 à 17\u00a0h 30, les personnes formées travaillent 4 heures sur leurs propres dossiers.",
    },
    {
      id: "faq-rapport",
      question: "Quand recevons-nous le rapport\u202f?",
      reponse:
        "Vos priorités sont écrites dans le rapport détaillé remis sous 3 jours ouvrés, avec le plan d’action sur 90 jours\u00a0: ce délai nous permet de vérifier chaque chiffre.",
    },
    {
      id: "faq-personnes",
      liens: [{ href: "/formations", libelle: "Nos formations IA" }],
      question: "Combien de personnes peuvent être formées\u202f?",
      reponse:
        "Du dirigeant aux collaborateurs\u202f: jusqu’à 15 personnes. Pour d’autres équipes, ou pour des formations par métier, nous vous proposons une suite sur devis\u00a0: nos formations IA.",
    },
    {
      id: "faq-apres",
      liens: [
        { href: "/implementation", libelle: "L’implémentation IA" },
        { href: "/audit", libelle: "L’audit IA" },
      ],
      question: "Et après la journée\u202f?",
      reponse:
        "Rien ne vous oblige à continuer\u00a0: le plan d’action est à vous. Si vous souhaitez que nous mettions en place les automatisations, vous recevez un devis écrit et forfaitaire, sans heures qui tournent\u00a0: l’implémentation IA. Pour un audit plus poussé, sur plusieurs sites ou plusieurs services\u00a0: l’audit IA.",
    },
    {
      id: "faq-donnees",
      question: "Et nos données\u202f?",
      reponse:
        "Rien ne part sans votre accord. Pendant la formation, nous écrivons avec vous vos règles d’usage\u00a0: ce que l’on confie à l’IA, et ce que l’on ne lui confie jamais (données clients, informations confidentielles).",
    },
    {
      id: "faq-chatgpt",
      question: "Nous utilisons déjà ChatGPT\u00a0: qu’est-ce que la journée change\u202f?",
      reponse:
        "ChatGPT est utile, et chacun s’en sert à sa façon\u00a0: ni règles communes, ni chiffre sur vos tâches. La journée donne à vos équipes des règles communes et une méthode sur leurs propres tâches, et vous dit lesquelles valent la peine d’être automatisées, pour qu’elles se préparent sans que quelqu’un fasse tourner l’outil.",
    },
    {
      id: "faq-secteur",
      liens: [{ href: "/secteurs", libelle: "L’IA par secteur" }],
      question: "Est-ce que ça marche dans notre secteur\u202f?",
      reponse:
        "Nous intervenons dans tous les secteurs. Nous partons de vos tâches, pas d’un métier\u00a0: un atelier ne vit pas la même journée qu’un cabinet, et l’audit le montre dès le matin. Il y a toujours des heures à récupérer : l’audit les chiffre, et la garantie porte dessus. Voir l’IA par secteur.",
    },
    {
      id: "faq-connaitre",
      question: "Faut-il connaître l’IA\u202f?",
      reponse:
        "Non. Nous parlons de votre quotidien, pas de technique\u202f: la formation part des tâches de vos équipes, sur leurs propres dossiers. Ceux qui n’ont jamais utilisé l’IA démarrent à leur rythme\u202f; ceux qui l’utilisent déjà repartent avec une méthode et des règles communes. Aucun prérequis, aucun logiciel à apprendre avant la journée.",
    },
    {
      id: "faq-france",
      liens: [{ href: "/implantations", libelle: "Voir où nous intervenons" }],
      question: "Vous déplacez-vous partout en France\u202f?",
      reponse:
        "Oui. La Journée IA se déroule dans vos locaux, partout en France\u202f: l’audit du matin, service par service, puis la formation de l’après-midi sur vos propres dossiers. La date est fixée avec vous pendant l’appel de 45 minutes. Voir où nous intervenons.",
    },
  ],
  rendezVous: {
    surtitre: "Prochaine étape",
    titre: "45 minutes gratuites pour commencer",
    etapes: [
      "Diagnostic IA, 45 min\u202f: une première tâche chiffrée",
      "Journée IA, chez vous",
      "Mise en place, seulement si vous le décidez",
    ],
    plusieurs: "Vous décidez à plusieurs\u202f? Venez à plusieurs.",
    cta: LIBELLE_CTA,
    rassurances: [
      "Chaque semaine sans rien changer, ces heures repartent.",
      "En visio ou par téléphone · sans engagement",
    ],
  },
} as const;

/**
 * Textes visibles qui ne sont pas des « sections » : titre du « En bref », en-tête de la FAQ,
 * libellés d'accessibilité, date de mise à jour.
 * Gardés hors de `CONTENU` pour que celui-ci reste à onze sections, dans l'ordre de la page.
 */
export const TEXTES_ANNEXES = {
  enBrefTitre: "En bref",
  filAriane: "La Journée IA",
  ariaTuiles: "La Journée IA en chiffres",
  ariaExemples: "Exemples types par secteur",
  nouvelOnglet: " (nouvel onglet)",
  miseAJour: "Page mise à jour le",
  faqEntete: {
    surtitre: "Questions fréquentes",
    titre: "Vos questions sur la Journée IA",
    lienTous: "Toutes les questions sur l’IA en entreprise",
    lienTousHref: "/faq",
  },
} as const;
