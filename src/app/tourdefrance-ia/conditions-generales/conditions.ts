// Tour de France IA — le texte des conditions générales (2026-10-27).
//
// Base fournie par le propriétaire, reprise avec les SEULES adaptations listées
// dans la PR (à valider par le propriétaire avant toute publicité) : « demande » au
// lieu d'« inscription » et de « candidature », l'article 2 rendu cohérent avec
// l'article 3 (volontariat des salariés), l'article 4 étendu aux entreprises non
// retenues, le seul tarif Tour (490 € HT) — le tarif hors Tour renvoie aux
// conditions générales de vente d'AXION IA —, la déduction plafonnée, le
// remboursement en cas de report d'une ville, le dîner facultatif et non compris,
// la mention « Journée offerte par Axion-IA dans le cadre du Tour », le lien en
// `rel="sponsored"`, l'article sur l'AI Act sans promesse de conformité, la
// version applicable et la juridiction du siège social.
//
// Ce fichier est HORS de la garde des mots interdits de la landing : c'est ici, et
// seulement ici, que vivent les montants, « filmée » et le détail juridique.
// `__tests__/les-conditions-generales.spec.ts` garde ses propres interdits.

/** La version affichée sous le titre (date ISO de la dernière modification). */
export const VERSION_CG = "2026-10-27";

export const TITRE_CG =
  "Conditions générales du Tour de France de l’IA en entreprise — AXION IA SAS";

export const META_CG = {
  titre: "Conditions générales du Tour de France IA",
  description:
    "Sélection, contrepartie, tarif Tour, organisation de la journée et confidentialité : les conditions générales du Tour de France IA d’Axion-IA.",
} as const;

/** Les libellés de la page (en-tête, sommaire, version). */
export const LIBELLES_CG = {
  retour: "Retour au Tour",
  sommaire: "Sommaire",
  version: "Version du",
  article: "Article",
  mentions: "Mentions légales",
} as const;

/** Un paragraphe, ou une liste numérotée (`liste`) introduite par le paragraphe qui la précède. */
export type Bloc = string | { liste: readonly string[] };

export type Article = { numero: number; titre: string; blocs: readonly Bloc[] };

export const ARTICLES: readonly Article[] = [
  {
    numero: 1,
    titre: "Sélection",
    blocs: [
      "La demande ne donne aucun droit automatique à une journée offerte. AXION IA sélectionne les entreprises après un échange en visio puis le remplissage d’un questionnaire, selon les critères suivants : l’acceptation du tournage, la taille et le secteur de l’entreprise, sa maturité et ses usages de l’IA, son potentiel d’automatisation, et la disponibilité du dirigeant ou d’un responsable.",
      "La sélection ne se fait ni par tirage au sort ni selon l’ordre d’arrivée des demandes. Une demande ne vaut pas sélection.",
    ],
  },
  {
    numero: 2,
    titre: "Conditions de la gratuité",
    blocs: [
      "La journée offerte est soumise à cinq conditions cumulatives :",
      {
        liste: [
          "d’abord le rendez-vous en visio ;",
          "puis le remplissage du questionnaire sur l’entreprise ;",
          "l’acceptation d’être filmée : le podcast avec le dirigeant ou un responsable, et les images de la journée (les interviews de salariés reposent sur leur seul volontariat, voir l’article 3) ;",
          "l’acceptation de la demande par AXION IA ;",
          "la disponibilité des places (5 par ville).",
        ],
      },
      "La sélection est confirmée par écrit ; une demande seule ne vaut pas sélection.",
    ],
  },
  {
    numero: 3,
    titre: "Tournage",
    blocs: [
      "La journée offerte est réservée aux entreprises qui acceptent le tournage et signent l’autorisation de droit à l’image. Le tournage comprend :",
      {
        liste: [
          "une interview filmée du dirigeant ou d’un responsable au format podcast (20 à 30 minutes environ, thèmes validés à l’avance) ;",
          "l’interview, si possible, d’au moins 3 salariés, uniquement s’ils sont volontaires, chacun signant sa propre autorisation ;",
          "des images de l’audit et de la journée.",
        ],
      },
      "Le refus ou le retrait d’un salarié n’a aucune conséquence, ni pour lui ni pour la gratuité.",
    ],
  },
  {
    numero: 4,
    titre: "Refus du tournage ou entreprise non retenue",
    blocs: [
      "Une entreprise qui ne souhaite pas être filmée, ou qui n’est pas retenue, peut bénéficier de la même journée au tarif de 490 € HT dans le cadre du Tour. Hors du Tour, les conditions générales de vente d’AXION IA s’appliquent.",
    ],
  },
  {
    numero: 5,
    titre: "Paiement des journées payantes",
    blocs: [
      "Les journées payantes (490 € HT) sont payables à 100 % d’avance, à la confirmation de la date. La date n’est réservée qu’après paiement.",
    ],
  },
  {
    numero: 6,
    titre: "Déduction",
    blocs: [
      "Les 490 € HT sont intégralement déduits de la première commande d’automatisation, d’intégration ou d’audit approfondi passée dans un délai de 6 mois après la journée. Fait foi la date de déclenchement de la commande, c’est-à-dire la signature du devis accompagnée du paiement de l’acompte, et non la date de livraison ni celle de la facture finale.",
      "La déduction s’applique sur la facture de solde, et non sur l’acompte, qui est dû en totalité. Elle est plafonnée au montant HT de la facture de solde, n’est pas cessible et ne s’applique qu’une seule fois par entreprise.",
      "Ces montants ne sont pas déductibles d’une formation en entreprise et ne sont jamais remboursés en argent, sauf dans les cas prévus aux articles 7 et 8.",
    ],
  },
  {
    numero: 7,
    titre: "Ouverture d’une ville",
    blocs: [
      "Une ville est ouverte à partir de 5 demandes. AXION IA se réserve le droit d’ouvrir une ville en dessous de ce seuil, ou de reporter une ville déjà annoncée.",
      "Si AXION IA reporte ou annule une ville annoncée, les sommes versées sont remboursées sous 14 jours ou la journée est reportée, au choix de l’entreprise.",
    ],
  },
  {
    numero: 8,
    titre: "Semaine du Tour, date et annulation",
    blocs: [
      "Le Tour de France de l’IA en entreprise se déroule sur une semaine complète dans chaque ville : une entreprise par jour, du lundi au vendredi, puis le dîner du vendredi soir. Le jour d’intervention est fixé par AXION IA en fonction de l’organisation de la semaine. L’entreprise peut indiquer ses contraintes lors de la visio, mais aucun report n’est possible en dehors de la semaine prévue.",
      "Journée offerte : en cas d’annulation, l’entreprise prévient AXION IA dès que possible ; sa place est alors attribuée à une autre entreprise, et elle perd son droit à la journée offerte.",
      "Journée payante : annulée au moins 14 jours avant, la journée est, au choix de l’entreprise, remboursée ou conservée sous forme de crédit ; annulée moins de 14 jours avant, elle n’est pas remboursée, mais la somme reste déductible, dans les mêmes conditions, d’une commande passée dans les 6 mois suivant la date prévue de la journée.",
    ],
  },
  {
    numero: 9,
    titre: "Organisation de la journée",
    blocs: [
      "L’entreprise assure la présence du dirigeant ou d’un responsable pendant l’audit du matin, une salle équipée, une connexion internet, et accueille 15 participants au maximum l’après-midi.",
    ],
  },
  {
    numero: 10,
    titre: "Repas de midi",
    blocs: [
      "Le repas de l’équipe AXION IA, pris avec l’entreprise, est à la charge de l’entreprise, pour 1 à 3 personnes selon la composition de l’équipe, communiquée au plus tard lors de la confirmation de la journée.",
    ],
  },
  {
    numero: 11,
    titre: "Dîner du vendredi soir",
    blocs: [
      "La présence de l’entreprise est vivement conseillée, sans être obligatoire, au dîner organisé le vendredi soir de la semaine du passage : un moment d’échange autour de l’IA qui réunit les entreprises du Tour, les dirigeants de la région et les acteurs économiques locaux qui souhaitent y participer.",
      "Ce dîner est facultatif et n’est pas compris dans la journée offerte. Chacun y paie sa part.",
    ],
  },
  {
    numero: 12,
    titre: "Visibilité",
    blocs: [
      "L’entreprise accepte d’apparaître sur le site d’AXION IA comme entreprise accompagnée lors du Tour de France IA (journée offerte), ainsi que dans le podcast, sur la chaîne YouTube et sur les réseaux sociaux d’AXION IA. Chaque diffusion mentionne : « Journée offerte par Axion-IA dans le cadre du Tour ».",
      "En retour, AXION IA crée et met en ligne elle-même une page dédiée à l’entreprise sur son site, avec un lien vers le site de l’entreprise : de la visibilité offerte, sans aucune démarche technique de sa part.",
    ],
  },
  {
    numero: 13,
    titre: "Lien entre les deux sites",
    blocs: [
      'AXION IA s’occupe de tout : elle met en place un lien du site de l’entreprise vers le sien (avec son accord et ses accès, ou en lui transmettant un texte prêt à publier). Ce lien porte l’attribut rel="sponsored" et reste en ligne au moins 12 mois.',
    ],
  },
  {
    numero: 14,
    titre: "Frais de déplacement",
    blocs: [
      "Inclus pendant le Tour de France de l’IA en entreprise, ils sont facturés en supplément pour toute intervention en dehors du Tour.",
    ],
  },
  {
    numero: 15,
    titre: "Confidentialité",
    blocs: [
      "Les informations découvertes pendant l’audit restent confidentielles. Aucun document, écran ou donnée sensible n’est filmé ou diffusé. Les données personnelles sont traitées dans le respect du RGPD.",
    ],
  },
  {
    numero: 16,
    titre: "Rapport d’audit",
    blocs: [
      "L’entreprise reçoit le rapport d’audit et ses recommandations, qu’elle utilise librement pour ses besoins internes. Les outils, méthodes et automatisations d’AXION IA restent la propriété d’AXION IA.",
    ],
  },
  {
    numero: 17,
    titre: "AI Act",
    blocs: [
      "La formation contribue aux mesures que l’entreprise peut prendre au titre de l’article 4 du règlement (UE) 2024/1689. Elle n’est ni une certification ni une garantie de conformité. Une attestation de fin de formation est remise à chaque participant.",
    ],
  },
  {
    numero: 18,
    titre: "Responsabilité",
    blocs: [
      "AXION IA formule des recommandations ; les décisions prises ensuite et leur mise en œuvre restent sous la responsabilité de l’entreprise.",
    ],
  },
  {
    numero: 19,
    titre: "Modification des conditions",
    blocs: [
      "AXION IA peut faire évoluer les présentes conditions. La version applicable est celle acceptée lors de la demande ; si elle change avant la confirmation écrite de la journée, la nouvelle version est soumise à l’entreprise, qui peut la refuser et retirer sa demande sans frais.",
    ],
  },
  {
    numero: 20,
    titre: "Droit applicable",
    blocs: [
      "Les présentes conditions sont soumises au droit français. En cas de litige, les parties recherchent d’abord un accord amiable pendant 30 jours. À défaut, le litige relève du tribunal de commerce du ressort du siège social d’AXION IA SAS (voir les mentions légales).",
    ],
  },
];

/** Tout le texte des conditions, à plat — pour les tests. */
export function toutLeTexteDesConditions(): string {
  return [
    TITRE_CG,
    META_CG.titre,
    META_CG.description,
    ...ARTICLES.flatMap((a) => [
      a.titre,
      ...a.blocs.flatMap((b) => (typeof b === "string" ? [b] : b.liste)),
    ]),
  ].join("\n");
}
