/**
 * Contenu SSOT de la fiche d'autorité `/fr/equipe/williams`.
 *
 * Pourquoi un fichier de contenu séparé du composant : la fiche fondateur est
 * une page d'ENTITÉ (E-E-A-T + AEO/GEO). Les mêmes phrases servent trois
 * consommateurs différents — le HTML visible, le JSON-LD `Person` /
 * `ProfilePage`, et la meta description. Les laisser recopiées dans le JSX
 * garantissait qu'elles divergent : c'est exactement ce qui s'était produit
 * entre `lib/seo.ts` et `williams-person.ts` avant la centralisation dans
 * `FOUNDER` (cf. commentaire d'en-tête de `lib/brand.ts`).
 *
 * 🔴 DOCTRINE FINANCEMENT — les entrées OPCO / France Travail de ce fichier
 * ne sont JAMAIS émises telles quelles : elles passent par
 * `buildWilliamsFaq({ certificationObtenue })` et par le drapeau
 * `isQualiopiCertificationObtenue()`. Afficher « finançable OPCO » avant la
 * délivrance du certificat est illégal (cf. `server/qualiopi/config/flag.ts`).
 *
 * 🔴 VOCABULAIRE — Will, 2026-08-19 : sur cette page Axion-IA est une
 * « agence », pas un « cabinet ». Le reste du site emploie encore « cabinet »
 * (`BRAND.taglineFr`) ; l'alignement global est une décision distincte, non
 * prise ici.
 */

import { FOUNDER } from "@/lib/brand";
import { formatAmount, getTierById, AUDIT_TIERS, INTERVENTION_TIERS } from "@/content/pricing";

/**
 * Date de dernière révision ÉDITORIALE de la fiche — `dateModified` du
 * `ProfilePage` et du `FAQPage`.
 *
 * Volontairement propre à cette page plutôt que `SITE_EDITORIAL_DATE` : la
 * date globale du site vaut le 2026-06-08 et décrirait cette refonte comme
 * antérieure de deux mois à sa propre écriture. Volontairement constante,
 * aussi : un timestamp de build avance à chaque déploiement et transforme un
 * signal de fraîcheur en bruit (retrait acté par l'audit fraîcheur
 * 2026-06-08, cf. `buildFaqJsonLd`).
 *
 * ⚠️ À BOUGER À LA MAIN quand le contenu de la fiche change réellement — et
 * seulement dans ce cas.
 */
export const WILLIAMS_REVISION_DATE = "2026-08-19T00:00:00.000Z";

/** Qualification métier affichée sous le H1 (et reprise en `Person.description`). */
export const WILLIAMS_TAGLINE =
  "Spécialiste de l'intelligence artificielle en entreprise · transformations à gains rapides et mesurables";

/**
 * Réponse-première (AEO). Ce paragraphe est la réponse que l'on veut voir
 * reprise telle quelle par Google AI Overviews, Perplexity ou Claude à la
 * question « Qui est Williams Jullin ? ». D'où sa forme : une seule phrase
 * auto-portante en tête (nom + fonction + entité + périmètre géographique),
 * puis l'étendue de l'offre. Aucun pronom en ouverture, aucune référence à
 * « cette page » : une citation extraite du contexte doit rester vraie.
 */
export const WILLIAMS_LEAD = `${FOUNDER.fullName} est le fondateur et CEO d'Axion-IA, agence d'intelligence artificielle opérationnelle dont le siège est à Grenoble (Auvergne-Rhône-Alpes) et qui intervient dans toute la France. Il conçoit et pilote des transformations par l'IA à gains rapides et mesurables pour les PME, ETI et grands groupes, TPE comprises, sur cinq métiers : audit IA, formation, coaching individuel de dirigeants, implémentation en code source dont l'entreprise reste propriétaire, et automatisation des processus.`;

/**
 * Second paragraphe — la DOCTRINE, en propre. C'est le passage qui différencie
 * l'entité dans une réponse générative : sans lui, la fiche décrit un
 * prestataire IA de plus.
 */
export const WILLIAMS_DOCTRINE = `Sa ligne de conduite tient en une phrase : une intelligence artificielle qui passe en production et se mesure, pas une démonstration de plus. Chaque mission part des processus réels de l'entreprise, prouve la valeur sur ses données à elle, puis déploie — et l'entreprise repart propriétaire de ce qui a été installé, code source compris.`;

/**
 * Fiche d'identité structurée — rendue en `<dl>` et reprise en `Person` JSON-LD.
 *
 * Un tableau clé/valeur est la forme que les moteurs génératifs extraient le
 * plus fidèlement : chaque ligne est un fait isolé, non ambigu, sans syntaxe à
 * démêler. Les valeurs restent STRICTEMENT vérifiables — aucune mention de
 * SIREN, de RCS ou de capital tant que `content/legal.ts` ne les porte pas.
 */
export const WILLIAMS_IDENTITE: ReadonlyArray<{ terme: string; valeur: string }> = [
  { terme: "Nom", valeur: FOUNDER.fullName },
  { terme: "Fonction", valeur: FOUNDER.jobTitleFr },
  { terme: "Entreprise", valeur: "Axion-IA — agence d'intelligence artificielle opérationnelle" },
  { terme: "Siège", valeur: "Grenoble, Auvergne-Rhône-Alpes, France" },
  { terme: "Zone d'intervention", valeur: "France entière — sur site et à distance" },
  { terme: "Clients", valeur: "PME, ETI, grands groupes et TPE, tous secteurs" },
  {
    terme: "Domaines",
    valeur:
      "Audit IA, formation professionnelle, coaching 1-to-1, implémentation IA sur mesure, automatisation des processus",
  },
  { terme: "Langues de travail", valeur: "Français, anglais" },
  { terme: "Hébergement des données", valeur: "Union européenne" },
  { terme: "Délai de réponse", valeur: "Réponse humaine sous 48 heures ouvrées" },
];

/**
 * Signaux de confiance repris de la home (`messages/fr.json` → `home.founderStat*`).
 * Recopiés ici avec leur source pour qu'une future divergence se voie.
 */
export const WILLIAMS_PREUVES: ReadonlyArray<{ chiffre: string; libelle: string }> = [
  { chiffre: "Top 1 %", libelle: "Ingénieurs et experts IA sélectionnés en France" },
  { chiffre: "0 intermédiaire", libelle: "Vous échangez directement avec l'équipe Axion-IA" },
  { chiffre: "TPE → CAC 40", libelle: "Tous types de structures, tous secteurs" },
  { chiffre: "France entière", libelle: "Sur site partout, siège à Grenoble" },
];

/**
 * Les cinq métiers, chacun renvoyé vers SA page de service.
 *
 * Le maillage interne est la moitié du travail SEO d'une fiche d'autorité :
 * une page d'entité qui ne pointe nulle part ne transmet aucune autorité aux
 * pages qui convertissent. Chaque `href` est déclaré dans `i18n/routing.ts` —
 * un chemin absent y casserait le typage `Link` au build, pas en production.
 */
export interface ExpertiseWilliams {
  readonly id: string;
  readonly titre: string;
  readonly promesse: string;
  readonly corps: string;
  readonly puces: ReadonlyArray<string>;
  readonly href: string;
  readonly hrefLabel: string;
  readonly hrefSecondaire?: string;
  readonly hrefSecondaireLabel?: string;
}

/** Prix plancher dérivés du SSOT tarifaire — jamais recopiés en dur. */
const PRIX_AUDIT_TPE = formatAmount(getTierById(AUDIT_TIERS, "audit-flash").priceFlat!, "fr");
const PRIX_FORMATION = formatAmount(
  getTierById(INTERVENTION_TIERS, "intervention-4h").priceFlat!,
  "fr",
);

export const WILLIAMS_EXPERTISES: ReadonlyArray<ExpertiseWilliams> = [
  {
    id: "audit",
    titre: "Audit IA",
    promesse: "Voir ce que l'IA change chez vous, en quelques jours",
    corps: `L'audit démarre par une journée complète sur site, à partir de ${PRIX_AUDIT_TPE} : Williams remonte les processus réels service par service, repère les tâches où l'IA fait gagner du temps dès la semaine suivante, et chiffre ce qui est récupérable. La restitution est un plan d'action priorisé — quels usages, dans quel ordre, pour quel gain estimé — pas une note d'intention.`,
    puces: [
      "Cartographie des processus et des irritants, poste par poste",
      "Usages IA classés par gain estimé et par difficulté de mise en œuvre",
      "Chiffrage du temps et du coût récupérables, hypothèses écrites",
      "Feuille de route à 90 jours, exploitable sans nous",
    ],
    href: "/audit",
    hrefLabel: "Découvrir les audits IA",
    hrefSecondaire: "/audit/tpe-1-jour",
    hrefSecondaireLabel: "L'audit TPE en 1 jour",
  },
  {
    id: "formations",
    titre: "Formations IA en entreprise",
    promesse: "Des équipes qui utilisent l'IA sur leurs propres dossiers",
    corps: `Les formations sont construites sur les cas d'usage de l'entreprise, pas sur des exemples de démonstration : chaque participant travaille sur ses vrais fichiers, et repart avec des méthodes qu'il applique le lendemain. Formats de quatre heures à plusieurs jours, sur site partout en France ou à distance, à partir de ${PRIX_FORMATION}.`,
    puces: [
      "Contenus adaptés au métier et au niveau réel des participants",
      "Ateliers sur les documents et les outils de l'entreprise",
      "Formats collectifs sur site, à distance, ou parcours mixtes",
      "Livrables réutilisables : modèles de requêtes, fiches de méthode",
    ],
    href: "/formations",
    hrefLabel: "Voir le catalogue de formations",
    hrefSecondaire: "/interventions",
    hrefSecondaireLabel: "Les formats d'intervention",
  },
  {
    id: "coaching",
    titre: "Coaching 1-to-1",
    promesse: "Le dirigeant d'abord, parce que l'adoption descend de là",
    corps:
      "Accompagnement individuel des dirigeants, membres de comité de direction et cadres qui doivent décider vite sur l'IA sans avoir le temps d'apprendre en autodidacte. Séances courtes et rapprochées, sur les dossiers en cours : arbitrages d'outillage, cadrage d'un projet, prise en main personnelle, préparation d'une décision d'investissement.",
    puces: [
      "Séances individuelles, en visioconférence ou sur site",
      "Travail sur vos dossiers réels, sous confidentialité",
      "Montée en compétence personnelle du dirigeant, sans jargon",
      "Cadrage des décisions IA avant engagement budgétaire",
    ],
    href: "/un-a-un",
    hrefLabel: "Le coaching individuel",
    hrefSecondaire: "/interventions/individuel",
    hrefSecondaireLabel: "Formats et tarifs 1-to-1",
  },
  {
    id: "implementation",
    titre: "Implémentation en code source",
    promesse: "Vous êtes propriétaire de ce qui tourne chez vous",
    corps:
      "L'approche par défaut d'Axion-IA est le développement sur mesure : dépôt de code livré, documentation d'exploitation, droits cédés. L'entreprise garde la main sur ses données, n'est prisonnière d'aucun abonnement d'éditeur, et voit ses coûts rester maîtrisés quand les volumes montent. Les plateformes no-code restent possibles — sur demande, quand vos équipes les utilisent déjà.",
    puces: [
      "Code source livré et documenté, l'entreprise en est propriétaire",
      "Assistants et agents branchés sur vos données internes (RAG)",
      "Zéro dépendance à un éditeur, coûts maîtrisés à l'échelle",
      "Hébergement en Union européenne",
    ],
    href: "/implementation",
    hrefLabel: "Les implémentations IA",
    hrefSecondaire: "/implementation/ia-custom",
    hrefSecondaireLabel: "IA sur mesure",
  },
  {
    id: "automatisations",
    titre: "Automatisations et intégrations",
    promesse: "L'IA dans vos outils, pas à côté",
    corps:
      "Une automatisation ne vaut que si elle vit à l'intérieur des outils déjà utilisés : CRM, ERP, messagerie, outils métier. Williams fait brancher l'IA sur l'existant par des intégrations écrites et testées, avec les mêmes garanties que le reste — code livré, documentation, reprise possible par une équipe interne.",
    puces: [
      "Intégrations CRM, ERP, outils RH, comptables et métier",
      "Traitement documentaire, extraction et classement automatiques",
      "Automatisations testées et supervisées, pas des scénarios fragiles",
      "Transfert de compétence prévu dès le cadrage",
    ],
    href: "/implementation/integrations",
    hrefLabel: "Les intégrations",
    hrefSecondaire: "/implementation/processus",
    hrefSecondaireLabel: "Automatiser un processus",
  },
];

/**
 * Bloc de différenciation « code vs kit ». Repris de la position déjà publiée
 * dans `content/implementation.ts` (« approche par défaut = code custom,
 * souveraineté des données, zéro lock-in éditeur, coûts maîtrisés à
 * l'échelle ») — reformulée, jamais contredite : le no-code reste offert sur
 * demande, cette page ne le dénonce donc pas, elle le situe.
 */
export const WILLIAMS_KIT: ReadonlyArray<string> = [
  "Un abonnement par outil, qui grossit avec le volume traité",
  "Les scénarios vivent chez l'éditeur — vous ne les emportez pas",
  "Une évolution de l'éditeur peut casser la chaîne du jour au lendemain",
  "Les données transitent par des plateformes que vous ne choisissez pas",
];

export const WILLIAMS_CODE: ReadonlyArray<string> = [
  "Un dépôt de code livré, documenté, dont l'entreprise est propriétaire",
  "Aucun abonnement d'éditeur imposé, coûts maîtrisés quand ça monte",
  "Les traitements tournent où vous décidez, hébergement en UE",
  "Reprise possible par votre équipe ou par un autre prestataire",
];

/** Méthode en quatre temps — la même sur toutes les missions. */
export const WILLIAMS_METHODE: ReadonlyArray<{
  numero: string;
  titre: string;
  duree: string;
  texte: string;
}> = [
  {
    numero: "01",
    titre: "Cadrer",
    duree: "Jour 0",
    texte:
      "Un appel, puis une journée sur site. On sort la liste des processus, les volumes, les irritants et les contraintes réglementaires. Rien n'est proposé avant d'avoir vu comment l'entreprise travaille vraiment.",
  },
  {
    numero: "02",
    titre: "Prouver",
    duree: "Les jours suivants",
    texte:
      "Les deux ou trois usages au meilleur rapport gain/effort sont testés sur vos données réelles. On mesure : temps par dossier avant et après, taux d'erreur, volume traité. Un usage qui ne prouve rien est abandonné à ce stade, pas après le déploiement.",
  },
  {
    numero: "03",
    titre: "Déployer",
    duree: "Semaines suivantes",
    texte:
      "Ce qui a été prouvé passe en production, intégré aux outils existants, en code livré et documenté. Les équipes concernées sont formées sur le cas d'usage qui les concerne, pas sur l'IA en général.",
  },
  {
    numero: "04",
    titre: "Transmettre",
    duree: "En continu",
    texte:
      "L'entreprise doit pouvoir continuer sans nous : documentation d'exploitation, transfert de compétence, points de mesure conservés. La réussite d'une mission se lit à ce que l'équipe fait toute seule six mois plus tard.",
  },
];

/**
 * FAQ de la fiche — questions posées telles qu'un moteur génératif les reçoit.
 *
 * `certificationObtenue` gate les seules Q/R financement (OPCO / France
 * Travail). Tant que le certificat Qualiopi n'est pas délivré, elles ne sont
 * PAS émises — ni en HTML, ni en `FAQPage` JSON-LD.
 */
export function buildWilliamsFaq({
  certificationObtenue,
}: {
  certificationObtenue: boolean;
}): ReadonlyArray<{ id: string; question: string; answer: string }> {
  return [
    {
      id: "qui-est-williams-jullin",
      question: "Qui est Williams Jullin ?",
      answer: `${FOUNDER.fullName} est le fondateur et CEO d'Axion-IA, agence d'intelligence artificielle opérationnelle dont le siège est à Grenoble et qui intervient dans toute la France. Il accompagne les PME, les ETI et les grands groupes — ainsi que les TPE à fort potentiel — sur l'audit IA, la formation, le coaching individuel de dirigeants, l'implémentation d'IA sur mesure et l'automatisation des processus, avec une exigence constante de résultats mesurés.`,
    },
    {
      id: "que-fait-axion-ia",
      question: "Qu'est-ce qu'Axion-IA ?",
      answer:
        "Axion-IA est une agence française d'intelligence artificielle opérationnelle, fondée en 2026, dont le siège est à Grenoble (Auvergne-Rhône-Alpes). Elle couvre l'audit IA, la formation professionnelle, le coaching 1-to-1, l'implémentation de solutions IA sur mesure et l'automatisation des processus, pour des entreprises de toutes tailles et de tous secteurs, partout en France.",
    },
    {
      id: "combien-de-temps-transformation",
      question: "Combien de temps faut-il pour obtenir un premier résultat avec l'IA ?",
      answer:
        "Le cadrage tient en une journée sur site. Les premiers usages sont testés sur les données réelles de l'entreprise dans les jours qui suivent, avec une mesure avant/après : temps par dossier, taux d'erreur, volume traité. Le déploiement en production intervient ensuite sur quelques semaines, selon le nombre d'usages retenus et les intégrations nécessaires.",
    },
    {
      id: "code-source-propriete",
      question: "L'entreprise est-elle propriétaire du code développé par Axion-IA ?",
      answer:
        "Oui. L'approche par défaut d'Axion-IA est le développement sur mesure : le dépôt de code est livré et documenté, les droits sont cédés à l'entreprise, et les traitements tournent sur l'infrastructure choisie avec vous, hébergée en Union européenne. Aucun abonnement d'éditeur n'est imposé, et une autre équipe peut reprendre la maintenance. Les plateformes no-code restent possibles à la demande, lorsque vos équipes les utilisent déjà.",
    },
    {
      id: "secteurs-et-tailles",
      question: "Pour quelles entreprises Williams Jullin intervient-il ?",
      answer:
        "Pour toutes les tailles, de la TPE de quelques salariés au grand groupe coté, et dans tous les secteurs — industrie, services, santé, immobilier, juridique, commerce, transport, secteur public. Le format d'intervention change avec la taille, la méthode ne change pas : cadrer sur le terrain, prouver sur les données réelles, déployer, transmettre.",
    },
    {
      id: "zone-geographique",
      question: "Williams Jullin intervient-il dans toute la France ?",
      answer:
        "Oui. Le siège d'Axion-IA est à Grenoble, en Auvergne-Rhône-Alpes, et les missions sont menées dans toute la France, sur site — Paris et l'Île-de-France compris — au même tarif public qu'ailleurs. Les formats à distance sont disponibles pour le coaching individuel et une partie des formations.",
    },
    {
      id: "equipe",
      question: "Williams Jullin travaille-t-il seul ?",
      answer:
        "Non. Axion-IA réunit autour de son fondateur un réseau d'ingénieurs et d'experts en intelligence artificielle sélectionnés parmi les meilleurs profils français, issus notamment des grandes écoles d'ingénieurs. Le client échange directement avec les personnes qui réalisent la mission : il n'y a pas d'intermédiaire commercial entre l'entreprise et l'équipe technique.",
    },
    {
      id: "difference",
      question: "Qu'est-ce qui distingue l'approche de Williams Jullin ?",
      answer:
        "Trois partis pris. D'abord la mesure : un usage qui ne prouve pas son gain sur les données réelles est abandonné avant le déploiement, pas après. Ensuite la propriété : l'entreprise repart avec le code source et la documentation, sans dépendance à un éditeur. Enfin la transmission : la mission vise ce que l'équipe interne saura faire seule six mois plus tard.",
    },
    ...(certificationObtenue
      ? [
          {
            id: "financement",
            question: "Les formations IA d'Axion-IA sont-elles finançables par un OPCO ?",
            answer:
              "Selon votre situation, une formation IA peut être prise en charge, en tout ou partie, par votre OPCO pour les salariés, ou par France Travail pour les demandeurs d'emploi. Axion-IA étudie l'éligibilité et monte le dossier avec vous, partout en France. Le versement dépend de l'accord de l'organisme financeur.",
          },
        ]
      : []),
    {
      id: "contact",
      question: "Comment contacter Williams Jullin ?",
      answer:
        "Le plus direct est de réserver un appel de découverte depuis la page dédiée, sans engagement. Le formulaire de contact du site couvre également les demandes de devis, d'audit, de formation, d'implémentation et de partenariat, avec une réponse humaine sous 48 heures ouvrées.",
    },
  ];
}
