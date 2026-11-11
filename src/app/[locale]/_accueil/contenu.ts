// Les textes de l'accueil `/fr`, section par section (français seul).
//
// Source : la maquette validée `PAGE-FINIE-ACCUEIL.html`. Les apostrophes « ’ » et
// les espaces insécables (U+202F avant « : ; ? », U+00A0 dans « 4 h ») sont ceux
// de la maquette : ne pas les « normaliser ».
//
// 🔑 Aucun montant n'est écrit ici (ce fichier est balayé par
// `no-hardcoded-prices.spec.ts` et par `accueil-journee-ia.spec.ts`). Les montants
// sont des jetons — `{{PRIX}}`, `{{GAIN_EXEMPLE}}`, `{{TAUX_HORAIRE}}`,
// `{{HEURES_EXEMPLE}}` — que `remplacerJetons()` résout depuis `pricing.ts` et
// `EXEMPLE_TYPE`.
//
// Les trois libellés de bouton « Je réserve un appel », « Réserver un appel » et
// « Échanger 45 min — sans engagement » ne sont PAS ici : ils restent écrits dans
// `page.tsx`, parce que `chaque-porte-dit-d-ou-l-on-vient.spec.ts` les y cherche.

import {
  CONDITION_GARANTIE,
  EXEMPLE_TYPE,
  EN_BREF_ACCUEIL,
  GARANTIE_PHRASE,
  MENTION_DECLARATION_OF,
} from "@/content/journee-ia-commun";
import { EFFECTIF_CIBLE, MICRO_TEXTE_RDV } from "@/content/offre";

/** Titre de la page : porte la marque, donc rendu tel quel (`title.absolute`). */
export const TITRE = "Axion-IA · Audit, formation et automatisation IA pour PME";

/** Meta description (le prix est un jeton ; ≤ `META_DESCRIPTION_MAX` une fois résolue). */
export const DESCRIPTION_META =
  "Par où commencer avec l’IA ? En une journée chez vous, partout en France : vos plus gros gains chiffrés, vos équipes formées. {{PRIX}}.";

/** Sous-ligne de la carte d'aperçu `/api/og`. */
export const OG_EYEBROW = "Partenaire IA des PME et TPE";

/** Texte alternatif de la carte d'aperçu : ce qu'elle montre réellement. */
export const OG_IMAGE_ALT = `${TITRE} · ${OG_EYEBROW}`;

/** Coupure de la garantie : ce qui précède reste en texte courant, ce qui suit passe en gras. */
const COUPURE_GARANTIE = "nous vous remboursons";
const POINT_DE_COUPURE = GARANTIE_PHRASE.indexOf(COUPURE_GARANTIE);
if (POINT_DE_COUPURE < 0) {
  throw new Error("GARANTIE_PHRASE ne contient plus « nous vous remboursons ».");
}

/** Texte alternatif d'une tuile secteur : le même que celui du manifeste d'images (`page-images.ts`). */
const ALT = (libelle: string) =>
  `Illustration du secteur « ${libelle} », l'un des secteurs d'activité accompagnés par Axion-IA.`;

export const CONTENU = {
  heros: {
    surtitre: "Pour les PME et les TPE, partout en France",
    // Les trois parties du h1 : IDENTIQUES aux clés `home.heroTitlePart1`,
    // `home.heroTitleEm` et `home.heroTitlePart2` de `src/messages/fr.json`
    // (verrouillé par `accueil-journee-ia.spec.ts`).
    titrePartie1: "On vous parle d’IA partout. Vous ne savez plus par où commencer.",
    titreEm: "Nous, si.",
    titrePartie2: "",
    sousTitre:
      "Commencez par la Journée IA, chez vous. Le matin, nous cartographions votre entreprise, faisons le point ensemble sur vos priorités et chiffrons vos plus gros gains le jour même, en heures et en euros\u202f: ceux qui rapportent le plus et se mettent en place le plus vite. L’après-midi, nous formons vos équipes.",
    lienJournee: "Découvrir la Journée IA · {{PRIX}}",
    reassurance: MICRO_TEXTE_RDV,
  },

  deuxFacons: {
    titre: "Deux façons de commencer avec l’IA",
    chapeauDebut: "Une journée chez vous",
    chapeauMilieu: ", ou ",
    chapeauFin: "45 minutes au téléphone",
    blocJournee: {
      surtitre: "Dans votre entreprise · partout en France",
      titre: "La Journée IA",
      accroche:
        "En une journée, vous savez par où commencer, chiffres à l’appui, et vos équipes sont formées.",
      tuiles: [
        {
          repere: "Le matin · un audit de 2 à 4 h selon la structuration de l’entreprise",
          texte:
            "Votre entreprise cartographiée service par service, le point fait ensemble sur vos priorités : les 3 à 5 tâches au meilleur retour sur investissement et les plus rapides à mettre en place, découvertes le jour même et chiffrées en heures et en euros.",
        },
        {
          repere: "L’après-midi · 4 h de formation",
          texte:
            "Vos équipes, sur leurs vrais dossiers. Une attestation de formation nominative par personne.",
        },
        {
          repere: "Sous 3 jours ouvrés · vos priorités",
          texte:
            "Vos priorités écrites dans le rapport détaillé remis sous 3 jours ouvrés, avec le plan d’action sur 90 jours.",
        },
      ],
      lignes: [
        "Une formation qui s’inscrit dans l’article 4 du règlement européen sur l’IA.",
        "Rien à installer, presque rien à préparer : un court questionnaire avant la journée.",
      ],
      exemple: `Exemple type : {{HEURES_EXEMPLE}} de relances par semaine, à {{TAUX_HORAIRE}} de l’heure, sur ${EXEMPLE_TYPE.semainesTravaillees} semaines travaillées, c’est {{GAIN_EXEMPLE}} de temps payé chaque année.`,
      exempleLien: "Calculez le vôtre →",
      prix: "{{PRIX}}",
      prixUnite: "la journée",
      prixCadre: "Sans remise. Devis écrit, rien à payer en ligne.",
      garantieTitre: "Garantie écrite « 3 fois le prix ».",
      garantieDebut: GARANTIE_PHRASE.slice(0, POINT_DE_COUPURE),
      garantieEngagement: GARANTIE_PHRASE.slice(POINT_DE_COUPURE),
      condition: CONDITION_GARANTIE,
      lienDetail: "Voir la Journée IA en détail",
      decideDebut: "Déjà décidé ?",
      decideLien: "Fixons la date ensemble",
      mention: MENTION_DECLARATION_OF,
    },
    blocAppel: {
      surtitre: "Pas encore sûr ? Une question ?",
      titre: "Réserver un appel",
      accroche: "Diagnostic IA gratuit et facultatif : 45 minutes, en visio ou par téléphone.",
      repartezAvec: "Vous repartez avec",
      repartez: [
        { fort: "une première tâche chiffrée", fin: " ;" },
        { fort: "une astuce à appliquer dès demain", fin: " ;" },
        { fort: "un récapitulatif écrit", fin: "." },
      ],
      franchise:
        "Si la Journée IA vous est utile, nous la datons ensemble. Sinon, nous vous le disons.",
      sousBouton: "Sans engagement · Vous préférez écrire ?",
      lienEcrire: "Nous écrire",
    },
  },

  enBref: {
    titre: "En bref",
    texte: EN_BREF_ACCUEIL,
    lienJournee: "La Journée IA en détail",
    lienDiagnostic: "Réserver le diagnostic gratuit",
  },

  miseEnPlace: {
    titre: "Des implémentations sur mesure",
    chapeau:
      "Après la journée, nous mettons en place ce qui rapporte le plus chez vous. L’IA prépare, vous validez. Sur devis écrit, au forfait, si vous le décidez.",
    etiquette: "Exemple type",
    cartes: [
      {
        titre: "Vos devis partent le jour même",
        texte:
          "L’IA prépare le devis à partir de vos modèles et de vos notes de visite. Vous relisez, il part.",
      },
      {
        titre: "Vos relances partent à la bonne date",
        texte:
          "Vous validez une fois le modèle et le calendrier. Ensuite, chaque relance part seule.",
      },
      {
        titre: "Vos e-mails arrivent triés",
        texte:
          "Le matin, commandes, devis et réclamations sont déjà rangés. Chacun reçoit ce qui le concerne.",
      },
    ],
    lienTout: "Voir tout ce que nous pouvons automatiser",
    prestations: [
      { id: "audit", libelle: "Audit IA" },
      { id: "formations", libelle: "Formations IA" },
      { id: "implementation", libelle: "Implémentation IA" },
      { id: "un-a-un", libelle: "Coaching IA" },
      { id: "sites-web-augmentes", libelle: "Sites web IA" },
    ],
  },

  williams: {
    titre: "On ne promet pas l’excellence. On la livre.",
    texte:
      "Nous partons de ce que vivent un dirigeant et ses équipes quand le temps manque, dans votre métier. Tout est écrit avant de commencer : le déroulé, ce que vous recevez, le prix.",
    citation:
      "« Dans chaque entreprise, des heures se perdent sans bruit. Nous les trouvons, nous les chiffrons et nous les rendons à votre productivité, à votre rentabilité et à votre chiffre d’affaires. Nous en sommes sûrs au point de garantir la journée sur les gains identifiés. »",
    signature: "Williams Jullin, fondateur d’Axion-IA",
    lien: "Voir le parcours de Williams Jullin",
    altPortrait: "Portrait de Williams Jullin, fondateur d’Axion-IA",
  },

  raisonsTitre: "Six raisons concrètes de nous choisir",
  // Dans l'ordre de la maquette ; `slot` = clé de `HOME_IMAGES`.
  raisons: [
    {
      titre: "Un seul interlocuteur.",
      texte: "Une même personne suit votre dossier, de l’audit à la mise en place.",
      slot: "why-04-meme-expert",
    },
    {
      titre: "Le gain chiffré avant la mise en place.",
      texte:
        "Chaque gain est calculé avec vos heures et écrit noir sur blanc, avant toute mise en place.",
      slot: "why-05-votre-rythme",
    },
    {
      titre: "Vos vrais dossiers.",
      texte: "Vos équipes apprennent sur leurs propres tâches, pas sur de la théorie.",
      slot: "why-01-aucun-intermediaire",
    },
    {
      titre: "Rien à installer.",
      texte: "Nous mettons en place pour vous. Aucun logiciel à apprendre le soir.",
      slot: "why-06-meme-exigence",
    },
    {
      titre: "Rien ne part sans votre accord.",
      texte: "L’IA prépare, vous validez avant chaque envoi chez un client.",
      slot: "why-02-cinq-metiers",
    },
    {
      titre: "Un prix unique.",
      texte: "{{PRIX}}, pour une TPE comme pour une PME.",
      slot: "why-03-couverture",
    },
  ],

  pmeTpe: {
    titre: "Nous accompagnons les PME et les TPE",
    chapeau: `Axion-IA aide les PME et les TPE françaises, ${EFFECTIF_CIBLE}, à commencer avec l’IA : une journée sur place pour cartographier l’entreprise, chiffrer ses plus gros gains et former les équipes, puis la mise en place.`,
    tpe: {
      titre: "TPE",
      accroche: "Le dirigeant fait tout, souvent le soir.",
      detail: "Nous commençons par ce qui vous prend le plus de temps.",
    },
    pme: {
      titre: "PME",
      accroche: "Plusieurs services, des équipes qui utilisent déjà l’IA chacune de leur côté.",
      detail:
        "Nous chiffrons service par service et formons vos équipes sur leurs propres dossiers.",
    },
    lienFormations: "La formation IA en entreprise, sur vos propres tâches",
    lienAudit: "L’audit IA pour PME et TPE",
  },

  secteurs: {
    titre: "Axion-IA intervient dans tous les secteurs d’activité",
    chapeau:
      "Chaque entreprise a ses propres problématiques. Nous partons des vôtres : ce qui prend du temps à vos équipes, ce qui vous coûte, ce qui bloque. Et nous parlons votre métier, avec vos mots et vos exemples.",
    // `slug` = clé de `SECTOR_PHOTO_CREDITS` (le fichier est `/illustrations/secteurs/<slug>.avif`).
    tuiles: [
      { libelle: "BTP et artisans", slug: "artisanat_services", alt: ALT("BTP et artisans") },
      {
        libelle: "Industrie et logistique",
        slug: "industrie_logistique",
        alt: ALT("Industrie et logistique"),
      },
      { libelle: "Commerce", slug: "commerce_retail", alt: ALT("Commerce") },
      {
        libelle: "Santé et médico-social",
        slug: "sante_medecine",
        alt: ALT("Santé et médico-social"),
      },
      {
        libelle: "Cabinets comptables et juridiques",
        slug: "juridique",
        alt: ALT("Cabinets comptables et juridiques"),
      },
      {
        libelle: "Hôtellerie et restauration",
        slug: "restauration_hotellerie",
        alt: ALT("Hôtellerie et restauration"),
      },
    ],
    aussiDebut: "Aussi :",
    aussi: [
      "Négoce et distribution",
      "Transport",
      "Immobilier",
      "Conseil et services",
      "Agroalimentaire",
      "Ressources humaines et recrutement",
    ],
    lienTous: "tous les secteurs",
  },

  france: {
    titre: "Axion-IA disponible partout en France",
    texte:
      "La Journée IA se passe dans vos locaux, où que vous soyez ; l’appel gratuit, en visio ou par téléphone.",
    lien: "Où nous intervenons, partout en France",
    ariaCarte: "Carte de France : Axion-IA intervient partout en France métropolitaine et en Corse",
  },

  faq: {
    titre: "Questions fréquentes",
    chapeau: "Ce que les dirigeants nous demandent avant de se lancer.",
    questions: [
      {
        id: "faq-prix",
        question: "Combien coûte la Journée IA ?",
        reponse:
          "{{PRIX}} la journée, dans vos locaux : un prix unique, sans remise. Rien ne se paie en ligne : le paiement est fixé dans votre devis, après un premier échange.",
      },
      {
        id: "faq-garantie",
        question: "Et si l’audit trouve peu de gains ?",
        reponse: `${GARANTIE_PHRASE} ${CONDITION_GARANTIE}`,
      },
      {
        id: "faq-commencer",
        question: "Par où commencer avec l’IA dans une PME ?",
        reponse:
          "Par vos tâches, pas par un outil. Axion-IA cartographie l’entreprise service par service, fait le point avec vous sur vos priorités et chiffre vos plus gros gains. Premier pas gratuit : un diagnostic de 45 minutes.",
      },
      {
        id: "faq-devis-relances",
        question: "Peut-on automatiser les devis et les relances avec l’IA ?",
        reponse:
          "Oui. L’IA prépare le devis à partir de vos modèles et de vos notes ; les relances partent à la date validée. Vous relisez avant chaque envoi. La Journée IA chiffre d’abord le temps en jeu chez vous.",
      },
      {
        id: "faq-chatgpt",
        question: "Nous avons déjà ChatGPT : qu’est-ce que ça change ?",
        reponse:
          "ChatGPT vous aide, à condition que quelqu’un le fasse tourner. Nous partons de vos tâches réelles et mettons en place des outils qui les préparent pour vous, chaque jour. Vous validez.",
      },
      {
        id: "faq-ai-act",
        question: "Et l’AI Act, ça nous concerne ?",
        reponse:
          "Oui, si votre entreprise utilise des systèmes d’IA. L’article 4 du règlement européen sur l’IA, applicable depuis le 2 février 2025 et réécrit en juillet 2026, demande aux entreprises de prendre des mesures pour soutenir la maîtrise de l’IA de leur personnel, sans fixer de niveau à garantir pour chacun. L’après-midi de formation s’inscrit dans cet article 4 : une attestation de formation par participant.",
      },
    ],
    liensDebut: "Pour aller plus loin :",
    source: {
      debut: "Source :",
      libelle: "Règlement (UE) 2024/1689, art. 4, modifié par le règlement (UE) 2026/1744",
      url: "https://eur-lex.europa.eu/eli/reg/2026/1744/oj",
      nouvelOnglet: " (nouvel onglet)",
    },
    liens: {
      aiAct: "L’AI Act et l’article 4, en détail",
      roi: "Estimez ce que vous perdez",
      guide: "Le guide gratuit pour bien démarrer avec l’IA",
      tarifs: "Tarifs",
      faq: "Toutes les questions",
    },
  },

  rendezVous: {
    titre: "Commençons par 45 minutes, gratuitement.",
    texte:
      "Vous nous parlez de ce qui prend du temps à vos équipes : une tâche, ou dix. En 45 minutes, nous voyons ensemble par où commencer. Le reste, nous le repérons pendant l’audit, chez vous. Chaque semaine sans rien changer, ces heures repartent.",
    reassurance: MICRO_TEXTE_RDV,
    ecrireDebut: "Vous préférez écrire ?",
    ecrireLien: "Nous écrire",
    miseAJour: "Page mise à jour le",
  },
} as const;

/** Les six questions affichées, au format attendu par le JSON-LD (jetons résolus). */
export type QuestionAccueil = (typeof CONTENU.faq.questions)[number];
