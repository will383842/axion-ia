// Transversal content — about, FAQ, blog fixtures, help (Sprint 9).
// Replaced by Prisma in Sprint 15 for blog/help articles.

import {
  AUDIT_TIERS,
  IMPLEMENTATION_TIERS,
  INTERVENTION_TIERS,
  MAINTENANCE_TIERS,
  formatAmount,
  formatPrice,
  getEntryLabel,
  getTierById,
} from "@/content/pricing";
import { slugify } from "@/lib/slug";
import { FOUNDER } from "@/lib/brand";

// Helpers locaux pour dériver les phrases FAQ multilingues à partir du SSOT
// pricing. Aucun prix hardcodé : si Will modifie un tier, ces phrases se
// mettent à jour automatiquement au build/start.
const auditFlashTier = getTierById(AUDIT_TIERS, "audit-flash");
const auditCibleTier = getTierById(AUDIT_TIERS, "audit-cible");
const auditPmeTier = getTierById(AUDIT_TIERS, "audit-strategique-pme");
const auditEtiTier = getTierById(AUDIT_TIERS, "audit-strategique-eti");
const maintenanceStandard = getTierById(MAINTENANCE_TIERS, "maintenance-standard");

// `modulesAnswerFr()` a été retirée le 2026-08-12 : la réponse FR de
// `les-3-modules-axion-ia` est passée en texte rédigé porteur de jetons
// `{{price:…}}`. Les prix restent donc dérivés du SSOT — ils sont résolus au
// rendu au lieu de l'être à l'évaluation du module — et la fiche gagne les
// champs riches que le reste du corpus a reçus. L'équivalent EN ci-dessous est
// conservé : le bloc `en` n'a pas été réécrit.
function modulesAnswerEn(): string {
  const interventionsEntry = getEntryLabel(INTERVENTION_TIERS, "en", { compact: false });
  const flash = formatAmount(auditFlashTier.priceFlat!, "en", { compact: true });
  // Targeted / SME / Mid-cap are all « from €1,900 · on request » (Will
  // 2026-06-03, upper bounds removed) → entry price « from X », not a range
  // (the former range rendered « NaN », priceMax being absent).
  const cibleFrom = formatAmount(auditCibleTier.priceMin!, "en", { compact: true });
  const pmeFrom = formatAmount(auditPmeTier.priceMin!, "en", { compact: true });
  const etiFrom = formatAmount(auditEtiTier.priceMin!, "en", { compact: true });
  const implEntry = getEntryLabel(IMPLEMENTATION_TIERS, "en", { compact: false });
  return `Module 1 — On-site sessions (1 day from ${formatAmount(getTierById(INTERVENTION_TIERS, "intervention-essentielle").priceFlat!, "en", { compact: true })}, ${interventionsEntry}). Module 2 — AI audit (4 tiers: Flash from ${flash}, Targeted from ${cibleFrom}, Strategic SME from ${pmeFrom}, Strategic Mid-cap from ${etiFrom}). Module 3 — AI implementation (production deployment, ${implEntry}).`;
}

export const ABOUT_TIMELINE = [
  {
    id: "2026",
    date: "2026",
    fr: {
      title: "Création d'Axion-IA",
      description:
        "Lancement du cabinet IA opérationnel et de la plateforme axion-ia.com — mobile-first, multilingue FR/EN.",
    },
    en: {
      title: "Axion-IA founded",
      description:
        "Operational AI consultancy launched with the axion-ia.com platform — mobile-first, FR/EN multilingual.",
    },
  },
] as const;

export const ABOUT_TEAM = [
  {
    id: "will",
    /**
     * Identité dérivée du SSOT `FOUNDER` (2026-08-19).
     *
     * Cette carte affichait « Will · Fondateur · lead consultant » pendant que
     * la fiche d'entité `/fr/equipe/williams` et tout le JSON-LD affirmaient
     * « Williams Jullin · Fondateur & CEO d'Axion-IA ». Deux fonctions
     * publiques pour un seul homme, sur deux pages du même site : c'est
     * exactement la divergence que `lib/brand.ts` a été créé pour supprimer
     * (cf. son commentaire d'en-tête, qui cite ce cas précis), et c'est ce
     * qu'un moteur doit arbitrer quand il tente de fusionner l'entité.
     * Seule la bio, qui n'existe nulle part ailleurs, reste littérale ici.
     */
    fr: {
      name: FOUNDER.displayName,
      role: FOUNDER.roleLineFr,
      bio: "10 ans en transformation digitale, opérationnel terrain.",
    },
    en: {
      name: FOUNDER.displayName,
      role: FOUNDER.roleLineEn,
      bio: "10 years in digital transformation, hands-on field practice.",
    },
  },
  // City Domination 2026-05-18 P1-13 (audit A11 P0) — Manon EN bio.
  // Persona éditoriale IA d'Axion-IA, transparence AI Act EU art. 50.
  // Doctrine v2.1 : zéro réseau social, supervision humaine, contenus IA-assistés.
  // Cf. /equipe/manon (FR) + /team/manon (EN) + AiContentDisclaimer composant.
  {
    id: "manon",
    fr: {
      name: "Manon",
      role: "Plume éditoriale IA · supervision humaine",
      bio: "Persona éditoriale IA d'Axion-IA. Rédige les contenus éditoriaux avec assistance d'IA générative (OpenAI, Anthropic, Perplexity), supervisée par l'équipe Axion-IA avant publication. Transparence AI Act EU art. 50.",
    },
    en: {
      name: "Manon",
      role: "AI editorial author · human supervision",
      bio: "Axion-IA's AI editorial persona. Drafts editorial content with generative AI assistance (OpenAI, Anthropic, Perplexity), supervised by the Axion-IA team before publication. EU AI Act art. 50 transparency.",
    },
  },
] as const;

/**
 * Corps d'une entrée FAQ dans une langue.
 *
 * `question` + `answer` sont les seuls champs OBLIGATOIRES : les 88 entrées
 * historiques ne portent qu'eux et continuent de fonctionner à l'identique.
 *
 * Les champs suivants sont OPTIONNELS et enrichissent la fiche `/faq/[slug]`
 * (ajoutés le 2026-08-10). Le gabarit ne rend une section QUE si sa donnée
 * existe : une entrée non enrichie garde exactement la page qu'elle avait.
 * C'est ce qui permet d'enrichir le corpus question par question, sans
 * migration de masse et sans jamais afficher de section vide.
 *
 * ⚠️ PRIX : ce fichier est scanné par `no-hardcoded-prices.spec.ts`. N'écrire
 * aucun montant en clair — utiliser un token `{{price:<tierId>|flat}}`, résolu
 * au rendu depuis le SSOT `pricing.ts`.
 *
 * ⚠️ VOCABULAIRE : « audit » désigne la prestation payante `/audit` — pour le
 * coaching, écrire « état des lieux ». En revanche « formation » est un mot
 * NORMAL depuis le 2026-08-10 : son bannissement a été levé, le site vendant
 * 21 formations au catalogue.
 */
export interface FaqAnswerBlock {
  question: string;
  answer: string;
  /** Points scannables affichés sous la réponse. Idéalement 3 à 5. */
  keyPoints?: readonly string[];
  /** Chiffres-clés de la réponse (grand chiffre + libellé court). */
  facts?: readonly { figure: string; label: string }[];
  /** Déroulé concret, quand la réponse en décrit un. */
  steps?: readonly { title: string; detail: string }[];
  /** Confusions fréquentes à lever — ce que la réponse n'est PAS. */
  nuances?: readonly { title: string; detail: string }[];
}

export interface FaqEntry {
  id: string;
  fr: FaqAnswerBlock;
  en: FaqAnswerBlock;
  /**
   * Date de dernière révision éditoriale de CETTE entrée (ISO `YYYY-MM-DD`).
   *
   * Sans elle, la fiche retombe sur la constante globale `FAQ_LAST_REVIEWED` —
   * ce qui faisait déclarer à Google la même date de publication ET de
   * modification pour les 88 pages. Renseigner dès qu'une entrée est retravaillée.
   */
  reviewedAt?: string;
  /**
   * Questions réellement liées, par id. Sans elle, le gabarit retombe sur
   * « les autres questions de la même catégorie, dans l'ordre du tableau » —
   * un rapprochement qui n'en est pas un.
   */
  related?: readonly string[];
}

export const FAQ_GLOBAL: ReadonlyArray<FaqEntry> = [
  {
    id: "geo-france",
    reviewedAt: "2026-08-12",
    related: ["geo-metropoles", "geo-tpe-rural", "geo-distance-international"],
    fr: {
      question: "Couvrez-vous toute la France et l'international ?",
      answer:
        "Oui, toute la France. Nous intervenons sur site dans les 13 régions de France métropolitaine, Corse comprise, et dans les 5 DROM — Guadeloupe, Martinique, Guyane, La Réunion, Mayotte. Nous accompagnons également les entreprises francophones à l'étranger : Belgique, Suisse, Luxembourg, Monaco, Maghreb, Afrique francophone, Québec — sur devis selon la zone et la mission.\n\nAxion-IA ne fonctionne pas en réseau d'agences : ce sont les intervenants qui se déplacent, ou la mission se tient à distance quand c'est plus efficace. Conséquence directe, les tarifs publics sont les mêmes partout, sans surcoût géographique. Les frais de déplacement, eux, sont facturés en sus et figurent sur une ligne distincte du devis : vous savez ce que vous payez avant de signer.\n\nLes 5 prestations sont accessibles sur tout le territoire — audit IA, formations collectives, coaching 1-to-1, implémentation, sites web & SaaS IA. Le même expert senior vous suit du cadrage à la livraison, quelle que soit votre région, et le devis arrive sous 48 h ouvrées.",
      keyPoints: [
        "13 régions métropolitaines, Corse comprise, et les 5 DROM",
        "Entreprises francophones à l'étranger, sur devis selon la zone",
        "Sur site ou à distance, selon ce que la mission exige vraiment",
        "Mêmes tarifs publics partout, frais de déplacement facturés en sus",
        "Les 5 prestations disponibles sur l'ensemble du territoire",
      ],
      facts: [
        { figure: "13", label: "régions métropolitaines" },
        { figure: "5", label: "DROM couverts" },
        { figure: "1", label: "expert du cadrage à la livraison" },
        { figure: "48 h", label: "ouvrées pour le devis" },
      ],
      nuances: [
        {
          title: "Ce n'est pas un réseau d'agences",
          detail:
            "Il n'y a pas de bureau Axion-IA dans chaque ville. Les intervenants se déplacent chez vous, ou la mission se tient en visio. C'est ce qui permet d'afficher les mêmes tarifs à Lille qu'à Bastia.",
        },
        {
          title: "Le sur-site n'est pas obligatoire",
          detail:
            "Beaucoup de missions se tiennent très bien à distance, et c'est souvent plus rentable pour une petite structure. Le format se décide au cadrage, pas d'après la géographie.",
        },
        {
          title: "Les frais de déplacement ne sont pas inclus",
          detail:
            "Les tarifs publics ne varient pas d'une région à l'autre, mais les frais de déplacement s'ajoutent : ils sont chiffrés selon la zone et apparaissent séparément sur le devis.",
        },
      ],
    },
    en: {
      question: "Couvrez-vous toute la France et l'international ?",
      answer:
        "Oui. Nous intervenons sur site dans les 13 régions de France métropolitaine, Corse comprise (Île-de-France, Auvergne-Rhône-Alpes, Provence-Alpes-Côte d'Azur, Occitanie, Nouvelle-Aquitaine, Hauts-de-France, Pays de la Loire, Bretagne, Grand Est, Normandie, Bourgogne-Franche-Comté, Centre-Val de Loire, Corse), dans les 5 DROM (Guadeloupe, Martinique, Guyane, La Réunion, Mayotte), ainsi qu'auprès des entreprises francophones à l'étranger (Belgique, Suisse, Luxembourg, Monaco, Maghreb, Afrique francophone, Québec, etc.) — sur devis selon la zone et la mission.",
    },
  },
  {
    id: "geo-metropoles",
    reviewedAt: "2026-08-12",
    related: ["geo-france", "geo-tpe-rural", "geo-distance-international"],
    fr: {
      question:
        "Intervenez-vous dans les métropoles régionales (Lyon, Marseille, Toulouse, Bordeaux, Lille, Nantes…) ?",
      answer:
        "Oui, dans toutes. Nos intervenants se déplacent à Lyon, Marseille, Toulouse, Bordeaux, Lille, Nantes, Strasbourg, Montpellier, Rennes, Nice, Reims, Saint-Étienne, Le Havre, Grenoble, Dijon, Angers — et plus généralement dans toute ville française, métropole ou non.\n\nAucune ville n'est traitée comme une périphérie : les tarifs publics affichés sont identiques partout, sans surcoût géographique. Ce qui change d'un déplacement à l'autre, ce sont les frais de trajet, facturés en sus et détaillés sur une ligne distincte du devis. Vous connaissez donc le montant total avant de vous engager.\n\nSur place, l'intervention prend la forme qui sert votre besoin : formation collective en intra, de 4 h à 2 journées, pour un groupe de 2 à 15 participants ; journée de coaching 1-to-1 de 7 à 8 heures sur le poste réel d'une seule personne ; ou phase de terrain d'un audit IA. Le même expert senior mène le cadrage et la livraison. Et si le déplacement n'apporte rien à votre cas, la mission se tient à distance.",
      keyPoints: [
        "Toutes les capitales régionales, et plus largement toute ville française",
        "Tarifs publics identiques partout, sans surcoût géographique",
        "Frais de déplacement en sus, sur une ligne distincte du devis",
        "Formation collective, coaching 1-to-1 ou phase terrain d'audit",
        "Le format à distance reste possible quand le déplacement n'apporte rien",
      ],
      facts: [
        { figure: "13", label: "régions couvertes sur site" },
        { figure: "2-15", label: "participants en intra" },
        { figure: "7-8 h", label: "journée de coaching 1-to-1" },
        { figure: "48 h", label: "ouvrées pour le devis" },
      ],
      nuances: [
        {
          title: "Ce n'est pas une antenne locale",
          detail:
            "Il n'y a pas de bureau Axion-IA à Lyon ou à Nantes. Ce sont les intervenants qui viennent chez vous, à la date convenue, avec leur propre équipement.",
        },
        {
          title: "Le prix ne dépend pas de la ville",
          detail:
            "Les tarifs publics sont les mêmes de Paris à Perpignan. Seuls les frais de déplacement varient selon la zone, et ils sont chiffrés à part, pas noyés dans le forfait.",
        },
        {
          title: "Les grandes villes ne passent pas devant",
          detail:
            "Une TPE d'une commune de trois mille habitants est accompagnée dans les mêmes conditions et par le même profil senior qu'une PME lyonnaise.",
        },
      ],
    },
    en: {
      question:
        "Do you work in regional cities (Lyon, Marseille, Toulouse, Bordeaux, Lille, Nantes…)?",
      answer:
        // « Travel costs included » a ete retire le 2026-08-12 : c'etait la SEULE
        // surface du site a l'affirmer, et elle contredisait la doctrine tenue
        // partout ailleurs (frais de deplacement factures en sus, sur une ligne
        // distincte du devis). Ne pas le reintroduire.
        "Yes. Our consultants travel to every regional capital: Lyon, Marseille, Toulouse, Bordeaux, Lille, Nantes, Strasbourg, Montpellier, Rennes, Nice, Reims, Saint-Étienne, Le Havre, Grenoble, Dijon, Angers — and more broadly any French city. Rates are the same everywhere; travel costs are billed separately.",
    },
  },
  {
    id: "geo-tpe-rural",
    reviewedAt: "2026-08-12",
    related: ["geo-france", "geo-metropoles", "tpe-ia"],
    fr: {
      question: "Et pour les TPE, PME et artisans en zone rurale ou petites villes ?",
      answer:
        "Oui, sans réserve. Artisans, commerçants, TPE, PME et ETI sont accompagnés partout en France, y compris en zone rurale et dans les petites villes. La taille de votre commune ne change ni l'accès aux prestations, ni les tarifs publics affichés : ils sont identiques d'un bout à l'autre du territoire.\n\nPour une petite structure, le format à distance est souvent le plus rentable : aucun frais de déplacement à supporter, aucune journée perdue en trajets, et la même qualité d'accompagnement — même intervenant senior, mêmes livrables, mêmes méthodes. Quand le terrain est indispensable, parce qu'il faut voir un atelier, un poste de production ou réunir toute l'équipe, l'intervention sur site reste évidemment possible.\n\nConcrètement, un artisan ou un commerçant ne démarre pas par un chantier lourd. Une journée de coaching 1-to-1 de 7 à 8 heures sur son propre poste, ou une formation courte à partir de 4 h pour deux ou trois personnes, suffit à débloquer les usages du quotidien : devis, relances, réponses clients, comptes rendus.",
      keyPoints: [
        "Artisans, commerçants, TPE, PME et ETI, partout en France",
        "Zones rurales et petites villes incluses, sans condition de taille",
        "Tarifs publics identiques quelle que soit la commune",
        "Le distanciel évite les frais de déplacement, à qualité égale",
        "Sur site quand le terrain l'exige : atelier, production, équipe entière",
      ],
      facts: [
        { figure: "4 h", label: "format de formation le plus court" },
        { figure: "2-15", label: "participants par groupe" },
        { figure: "7-8 h", label: "journée de coaching 1-to-1" },
        { figure: "48 h", label: "ouvrées pour le devis" },
      ],
      nuances: [
        {
          title: "Ce n'est pas une version allégée",
          detail:
            "Une TPE rurale reçoit le même intervenant senior et les mêmes livrables qu'une entreprise de grande ville. Seul le périmètre change, jamais le niveau d'exigence.",
        },
        {
          title: "Le distanciel n'est pas un pis-aller",
          detail:
            "Pour une petite structure, c'est souvent le format le plus rentable : pas de frais de trajet, pas de demi-journée perdue sur la route, et on travaille sur vos vrais dossiers.",
        },
        {
          title: "Ce n'est pas réservé aux entreprises déjà équipées",
          detail:
            "Aucun prérequis technique. On part de vos outils actuels, même s'ils se résument à une boîte mail, un tableur et un logiciel de facturation.",
        },
      ],
    },
    en: {
      question: "What about SMEs, craftsmen in rural areas or small towns?",
      answer:
        "Absolutely. We support craftsmen, retailers, SMEs and mid-cap companies across France, including rural areas and small towns. Remote format is often more cost-effective for these structures — without losing quality of support.",
    },
  },
  {
    id: "geo-distance-international",
    reviewedAt: "2026-08-12",
    related: ["geo-france", "presentiel-distance", "formation-ia-entreprise"],
    fr: {
      question: "Pouvez-vous intervenir à distance ou à l'international ?",
      answer:
        "Oui, les deux sont possibles. À distance, la session se tient en visioconférence sécurisée avec partage d'écran : le contenu, la durée et les ateliers sont identiques à ceux du présentiel, et les accès aux outils sont préparés avec vous en amont si besoin. C'est le format le plus simple quand vos équipes sont réparties sur plusieurs sites.\n\nSur site, nous couvrons les 13 régions de France métropolitaine, Corse comprise, ainsi que les 5 DROM. À l'international, nous intervenons auprès des entreprises francophones — Belgique, Suisse, Luxembourg, Monaco, Maghreb, Afrique francophone, Québec — sur devis selon la zone et la mission ; un déplacement hors métropole se cale sur une mission d'une semaine minimum, le temps de transférer réellement l'autonomie à l'équipe. Les interventions se déroulent en français ou en anglais.\n\nLe format hybride existe aussi : une journée sur place pour lancer la dynamique, puis les sessions de suivi à distance. Quel que soit le lieu, le devis vous parvient sous 48 h ouvrées.",
      keyPoints: [
        "Distanciel en visioconférence sécurisée : même contenu, même durée, mêmes ateliers",
        "Sur site dans les 13 régions métropolitaines, Corse comprise, et les 5 DROM",
        "International francophone sur devis : Belgique, Suisse, Luxembourg, Monaco, Maghreb, Afrique francophone, Québec",
        "Déplacement hors métropole calé sur une mission d'une semaine minimum",
        "Sessions en français ou en anglais, format hybride possible",
      ],
      facts: [
        { figure: "13", label: "régions métropolitaines couvertes" },
        { figure: "5", label: "DROM couverts" },
        { figure: "1 semaine", label: "minimum à l'international" },
        { figure: "48 h", label: "ouvrées pour le devis" },
      ],
      nuances: [
        {
          title: "À distance ne veut pas dire au rabais",
          detail:
            "Même programme, même durée, même niveau d'interactivité : les ateliers portent dans les deux cas sur les tâches réelles apportées par les participants. Seule la salle change.",
        },
        {
          title: "Ce n'est pas un webinaire",
          detail:
            "Le groupe reste restreint, chacun pratique sur son propre poste et le formateur passe d'un participant à l'autre. Une session à distance n'est pas une diffusion descendante.",
        },
        {
          title: "L'international n'est pas une intervention d'un jour",
          detail:
            "Hors France métropolitaine, un déplacement sur site se cale sur une mission d'une semaine minimum. Pour un besoin plus court, le distanciel reste la bonne réponse.",
        },
      ],
    },
    en: {
      question: "Can you work fully remote or internationally?",
      answer:
        "Yes to both. Secure video calls, encrypted screen sharing, deliverables within 48h. We deliver in French or English, across the European Union and beyond (Switzerland, UK, Quebec, French-speaking North Africa). Hybrid format available (on-site + remote).",
    },
  },
  {
    id: "definition-axion-ia",
    reviewedAt: "2026-08-12",
    related: ["les-3-modules-axion-ia", "comment-commencer", "choisir-cabinet-ia"],
    fr: {
      question: "Qu'est-ce qu'Axion-IA ?",
      answer:
        "Axion-IA est un cabinet IA opérationnel pour entreprises, basé en France. Concrètement : des intervenants seniors qui viennent travailler sur vos outils, vos données et vos dossiers réels, plutôt que de livrer une présentation sur l'intelligence artificielle.\n\nL'offre tient en cinq prestations. Les Formations IA, en intra, de 4 heures à 2 journées, pour un groupe de 2 à 15 participants. Le Coaching IA 1-to-1, une journée de 7 à 8 heures avec une seule personne, sur son poste. L'Audit IA, qui cartographie vos process et chiffre les opportunités, sur quatre niveaux. L'Implémentation IA, qui met en production les automatisations retenues. Et les Sites web & SaaS IA, pour greffer chatbot, recherche sémantique ou agents sur votre plateforme.\n\nNous intervenons sur site dans les 13 régions métropolitaines et les 5 DROM, ou à distance. L'échange démarre par un appel de cadrage de 30 minutes, sans engagement, et le devis suit sous 48 heures ouvrées.",
      keyPoints: [
        "Cabinet IA opérationnel basé en France, intervenants seniors",
        "Cinq prestations : formations, coaching 1-to-1, audit, implémentation, sites web & SaaS IA",
        "On travaille sur vos outils et vos données réelles, pas sur des cas d'école",
        "13 régions métropolitaines et 5 DROM, sur site ou à distance",
        "Appel de cadrage de 30 minutes, devis sous 48 h ouvrées",
      ],
      facts: [
        { figure: "5", label: "prestations au catalogue" },
        { figure: "13", label: "régions métropolitaines" },
        { figure: "5 DROM", label: "également couverts" },
        { figure: "48 h", label: "ouvrées pour le devis" },
      ],
      nuances: [
        {
          title: "Ce n'est pas un éditeur de logiciel",
          detail:
            "Axion-IA ne vend aucune licence et n'impose aucun outil. Le choix des modèles est justifié dans chaque devis, et il n'y a aucun lock-in technologique.",
        },
        {
          title: "Ce n'est pas une prestation de slides",
          detail:
            "Les journées se déroulent sur vos comptes et vos documents. Les équipes repartent avec des méthodes applicables dès le lendemain, pas avec un support de présentation.",
        },
        {
          title: "Un cabinet, pas une plateforme en ligne",
          detail:
            "Chaque mission est menée par un intervenant senior, le même du cadrage à la livraison. Devis fixe, facture, aucun abonnement imposé.",
        },
      ],
    },
    en: {
      question: "What is Axion-IA?",
      answer:
        "Axion-IA is an operational AI consultancy for companies, based in France. We work across several modules: on-site interventions, audit, AI implementation, 1-to-1 support, and websites and SaaS augmented with AI.",
    },
  },
  {
    id: "les-3-modules-axion-ia",
    reviewedAt: "2026-08-12",
    related: ["definition-axion-ia", "tarifs-publics-transparents", "comment-commencer"],
    fr: {
      // « Quels sont les 3 modules ? » reformulée le 2026-08-13 (décision Will) :
      // le titre affichait « 3 » alors que la réponse explique les 5 prestations.
      // Le SLUG `les-3-modules-axion-ia` reste, lui, INCHANGÉ (URL indexée).
      question: "Quels sont les modules d'Axion-IA ?",
      answer:
        "Le découpage historique en trois modules — interventions, audit, implémentation — a été élargi : l'offre Axion-IA compte aujourd'hui cinq prestations, et c'est cette liste qui fait foi.\n\nLes Formations IA se déroulent en intra, de 4 heures à 2 journées, pour un groupe de 2 à 15 participants, dans vos locaux ou à distance. Le Coaching IA 1-to-1 est une journée de 7 à 8 heures avec une seule personne, sur son poste réel. L'Audit IA cartographie vos process et chiffre les opportunités, sur quatre niveaux selon la taille de l'entreprise et le périmètre. L'Implémentation IA met en production les automatisations retenues, avec 30 jours de support inclus à la livraison. Les Sites web & SaaS IA greffent chatbot, recherche sémantique ou agents sur votre site existant, ou construisent une plateforme IA-native.\n\nCes cinq prestations sont indépendantes : rien n'oblige à les enchaîner dans cet ordre.",
      keyPoints: [
        "Cinq prestations aujourd'hui, et non plus trois modules",
        "Formations IA : 4 heures à 2 journées, en intra, 2 à 15 participants",
        "Coaching IA 1-to-1 : une journée, une seule personne, sur son poste",
        "Audit IA sur quatre niveaux ; Implémentation IA avec 30 jours de support",
        "Sites web & SaaS IA : chatbot, recherche sémantique, agents, plateforme sur mesure",
      ],
      facts: [
        { figure: "5", label: "prestations au catalogue" },
        { figure: "4", label: "niveaux d'audit IA" },
        { figure: "2-15", label: "participants par formation" },
        { figure: "30 j", label: "de support après livraison" },
      ],
      nuances: [
        {
          title: "Trois modules, cinq prestations",
          detail:
            "Le mot « modules » vient du lancement, quand l'offre en comptait trois. La liste officielle en compte cinq : formations, coaching 1-to-1, audit, implémentation, sites web & SaaS IA.",
        },
        {
          title: "Ce ne sont pas des étapes obligatoires",
          detail:
            "On peut commencer par une formation, par un audit ou directement par une implémentation. L'appel de cadrage de 30 minutes sert justement à choisir le bon point d'entrée.",
        },
        {
          title: "Le tarif dépend du format",
          detail:
            "Formation de 4 heures : {{price:intervention-4h|flat}} pour le groupe. Journée de formation : {{price:intervention-essentielle|from}}. Coaching 1-to-1 : {{price:intervention-membre-equipe|flat}} avec un collaborateur, {{price:intervention-dirigeants|flat}} avec le dirigeant. Audit IA : {{price:audit-flash|from}}. Implémentation : sur devis, avec réponse sous 48 h ouvrées.",
        },
      ],
    },
    en: {
      question: "What are Axion-IA's modules?",
      answer: modulesAnswerEn(),
    },
  },
  {
    id: "securite-donnees-ia",
    reviewedAt: "2026-08-12",
    related: [
      "confidentialite-projet-ia",
      "ia-on-premise",
      "ia-donnees-entrainement-confidentialite",
    ],
    fr: {
      question: "Mes données sont-elles partagées ?",
      answer:
        "Non. Vos données ne sont ni revendues, ni partagées à des fins publicitaires, et aucune donnée sensible n'est transmise à un tiers sans votre accord explicite. L'hébergement par défaut des solutions déployées est européen (Hetzner, Francfort), et les services edge privilégient les points de présence situés dans l'Union européenne.\n\nLe cadre est contractuel avant d'être technique. L'engagement de confidentialité couvre toute la durée de la mission et les trois années qui suivent. Lorsque Axion-IA traite des données personnelles pour votre compte, un accord de sous-traitance au sens de l'article 28 du RGPD précise la nature du traitement, les mesures de sécurité et le sort des données en fin de prestation. La liste complète des sous-traitants, avec leur localisation et leur cadre de transfert, est publiée sur la page sous-processeurs, et toute évolution est notifiée trente jours avant.\n\nSelon la sensibilité, la stack peut être open-source et auto-hébergée chez vous plutôt que confiée à un service tiers. C'est un arbitrage posé au cadrage technique, pas une option de dernière minute.",
      keyPoints: [
        "Aucune donnée revendue, aucun usage publicitaire",
        "Hébergement par défaut dans l'Union européenne (Hetzner, Francfort)",
        "Confidentialité engagée pendant la mission et 3 ans après",
        "Liste des sous-traitants publique, préavis de 30 jours avant tout changement",
        "Option open-source auto-hébergée chez vous pour les cas sensibles",
      ],
      facts: [
        { figure: "3 ans", label: "de confidentialité après la mission" },
        { figure: "30 j", label: "de préavis sur les sous-traitants" },
        { figure: "art. 28", label: "le cadre RGPD applicable" },
        { figure: "UE", label: "hébergement par défaut" },
      ],
      nuances: [
        {
          title: "Ce n'est pas une certification",
          detail:
            "Axion-IA applique un cadre contractuel et technique documenté, mais n'affiche aucun label de sécurité. Ce que vous obtenez, ce sont des engagements écrits et une liste de sous-traitants vérifiable.",
        },
        {
          title: "Hébergement européen ne veut pas dire zéro tiers",
          detail:
            "Certains outils utilisés restent établis hors UE. Leur localisation et leur cadre de transfert sont indiqués un par un sur la page sous-processeurs, plutôt que résumés par une formule générale.",
        },
        {
          title: "La conformité de vos traitements reste la vôtre",
          detail:
            "Sur vos propres données, c'est vous qui êtes responsable de traitement. Axion-IA intervient comme sous-traitant et documente ce qu'il fait, sans se substituer à votre analyse ni à votre conseil.",
        },
      ],
    },
    en: {
      question: "Is my data shared?",
      answer:
        "No. EU hosting by default (Hetzner Frankfurt). No sensitive data sent to third parties without explicit consent. AI models hosted with you or on dedicated infra if required.",
    },
  },
  {
    id: "outils-ia",
    reviewedAt: "2026-08-12",
    related: ["chatgpt-vs-claude", "no-code-position", "ia-on-premise"],
    fr: {
      question: "Quels outils IA utilisez-vous ?",
      answer:
        "Un mix, choisi cas par cas : des modèles open-source (Llama, Mistral) et des modèles propriétaires (GPT-4, Claude). Le choix est justifié dans chaque devis et il n'y a aucun lock-in technologique — vous n'êtes lié ni à un éditeur, ni à nous.\n\nEn formation et en coaching, on prend en main les assistants réellement utilisés en entreprise — ChatGPT, Claude et Gemini — ainsi que les extensions de navigateur et les transcripteurs de réunion. La page Stack IA détaille les 11 outils que nous utilisons au quotidien, répartis en cinq usages : réfléchir, produire, capter, construire, orchestrer.\n\nEn implémentation, nous livrons du code sur mesure (Node.js, Python, TypeScript) dans vos systèmes plutôt que des workflows montés sur une plateforme tierce ; Make ou Zapier ne sont mobilisés que sur demande explicite. Pour les données sensibles, les modèles open-source peuvent tourner dans votre propre infrastructure ou sur une infrastructure dédiée hébergée dans l'Union européenne.",
      keyPoints: [
        "Open-source (Llama, Mistral) et propriétaire (GPT-4, Claude), selon le cas",
        "Choix du modèle justifié dans chaque devis, aucun lock-in technologique",
        "En formation : ChatGPT, Claude, Gemini, extensions et transcripteurs de réunion",
        "En implémentation : code sur mesure dans vos systèmes, pas de no-code par défaut",
        "Modèles open-source déployables chez vous ou sur infrastructure dédiée en UE",
      ],
      facts: [
        { figure: "11", label: "outils sur la page Stack IA" },
        { figure: "5", label: "usages couverts" },
        { figure: "3", label: "assistants pris en main en formation" },
      ],
      nuances: [
        {
          title: "Nous ne revendons aucun outil",
          detail:
            "Axion-IA n'est le distributeur d'aucun éditeur. Un modèle est retenu parce qu'il convient à votre cas, et le devis explique pourquoi.",
        },
        {
          title: "Le no-code n'est pas la position par défaut",
          detail:
            "Zapier, Make et les plateformes équivalentes restent possibles si vos équipes les utilisent déjà en production. Sinon, nous livrons du code que vous possédez.",
        },
        {
          title: "Le cloud n'est pas obligatoire",
          detail:
            "Un déploiement local (on-premise) est possible pour des données médicales ou confidentielles. Par défaut, l'hébergement est européen.",
        },
      ],
    },
    en: {
      question: "Which AI tools do you use?",
      answer:
        "Mix of open-source (Llama, Mistral) and proprietary models (GPT-4, Claude) depending on the case. Justified in every quote. No technology lock-in.",
    },
  },
  {
    id: "no-code-position",
    reviewedAt: "2026-08-12",
    related: ["outils-ia", "ia-souveraine-europe", "implementation-ia-sur-mesure"],
    fr: {
      question: "Utilisez-vous Zapier, Make ou des plateformes no-code ?",
      answer:
        "Non, pas par défaut. Axion-IA livre du code custom de qualité production — Node.js, Python, TypeScript, infrastructures cloud-native — directement dans VOS systèmes, jamais dans des plateformes tierces qui louent l'accès à vos données.\n\nLes raisons sont simples : souveraineté RGPD (vos données restent chez vous), zéro lock-in éditeur (vous possédez le code, les workflows et la documentation), performances 10× supérieures grâce aux appels API directs sans saut d'entrée-sortie entre les étapes, et conformité AI Act native — traçabilité des actions, versioning git, tests automatisés.\n\nMake, Zapier, n8n, Bubble ou Airtable restent possibles sur demande client explicite, typiquement quand votre équipe ops les pilote déjà en production et veut les conserver. Nous y greffons alors les briques IA proprement : garde-fous, gestion des erreurs, quotas surveillés, et logique documentée pour qu'une bascule vers du custom reste faisable. C'est notre différence avec ceux qui assemblent des workflows préfabriqués : nous construisons, nous ne collons pas des briques.",
      keyPoints: [
        "Par défaut : du code custom livré dans vos systèmes, pas dans une plateforme louée",
        "Vous possédez le code, les workflows et la documentation",
        "Appels API directs, sans saut d'entrée-sortie entre chaque étape",
        "Conformité AI Act native : traçabilité, versioning git, tests automatisés",
        "n8n, Make, Zapier, Bubble, Airtable : uniquement sur demande explicite",
      ],
      facts: [
        { figure: "10×", label: "de performances en plus" },
        { figure: "5", label: "plateformes no-code couvertes" },
        { figure: "0", label: "dépendance verrouillée" },
        { figure: "2-4 sem", label: "si greffe dans du no-code" },
      ],
      nuances: [
        {
          title: "Ce n'est pas un rejet du no-code",
          detail:
            "n8n, Make, Zapier, Bubble et Airtable sont pris en charge quand votre équipe les utilise déjà en production. Ce que nous refusons, c'est d'en faire la réponse par défaut à un besoin qui mérite du code.",
        },
        {
          title: "Ce n'est pas plus long à livrer",
          detail:
            "Une greffe IA dans une stack no-code existante passe en production en 2 à 4 semaines. Une automatisation custom ciblée tient dans le même ordre de grandeur : le sur-mesure n'est pas synonyme de projet interminable.",
        },
        {
          title: "Ce n'est pas un aller sans retour",
          detail:
            "Si vous partez d'une stack no-code, nous documentons la logique de vos scénarios dès la conception, pour qu'une migration ultérieure vers du custom se fasse sans tout reconstruire.",
        },
      ],
    },
    en: {
      question: "Utilisez-vous Zapier, Make ou des plateformes no-code ?",
      answer:
        "Non par défaut. Axion-IA livre du code custom de qualité production (Node.js, Python, TypeScript, infrastructures cloud-native) dans VOS systèmes — jamais dans des plateformes tierces qui louent l'accès à vos données. Pourquoi : souveraineté RGPD (vos données restent chez vous), zéro lock-in éditeur (vous possédez le code), performances 10× supérieures (appels API directs, pas de saut I/O entre étapes), conformité AI Act native (audit trail, versioning git, tests automatisés). Make, Zapier ou autres plateformes no-code sont disponibles uniquement sur demande client explicite — par exemple si votre équipe ops les utilise déjà en production. C'est notre différence avec les freelances IA qui assemblent des workflows préfabriqués : nous sommes des experts IA seniors qui construisent, nous ne collons pas des briques.",
    },
  },
  {
    id: "facturation",
    reviewedAt: "2026-08-12",
    related: ["tarifs-publics-transparents", "cout-projet-ia-pme", "budget-demarrer-ia"],
    fr: {
      question: "Comment se passe la facturation ?",
      answer:
        "Devis fixe, virement bancaire, facture : la mécanique tient en trois temps, sans abonnement ni engagement de durée. Chaque prestation est chiffrée dans un devis détaillé, valable 30 jours ; la commande devient ferme à réception de ce devis signé, accompagné le cas échéant de l'acompte convenu. Le règlement s'effectue par virement, à la commande pour les prestations courantes ; au-delà d'un certain montant, un échelonnement — acompte au démarrage, solde à la livraison — peut être convenu et figure alors au devis.\n\nTous les tarifs publiés sont hors taxes : la TVA française à 20 % s'ajoute sur la facture. Le montant validé avant démarrage est celui qui apparaît sur la facture — pas de régie, pas de facturation à l'heure passée, pas de dépassement de périmètre décidé en cours de route. Un devis personnalisé est établi sous 48 h ouvrées après l'appel de cadrage. Et si un imprévu tombe côté client, la prestation est reportable une fois sans frais, à une date convenue entre les parties.",
      keyPoints: [
        "Devis détaillé valable 30 jours : la commande est ferme à la signature",
        "Règlement par virement bancaire, aucun abonnement ni engagement de durée",
        "Tarifs publiés hors taxes — la TVA française à 20 % s'ajoute sur la facture",
        "Devis personnalisé sous 48 h ouvrées après l'appel de cadrage",
        "Prestation reportable une fois sans frais en cas d'imprévu",
      ],
      facts: [
        { figure: "48 h", label: "ouvrées pour le devis" },
        { figure: "30 j", label: "de validité du devis" },
        { figure: "20 %", label: "de TVA en sus" },
        { figure: "1", label: "report sans frais possible" },
      ],
      steps: [
        {
          title: "Appel de cadrage",
          detail:
            "Une trentaine de minutes pour cerner le besoin, le format adapté et le périmètre. C'est le seul temps offert du parcours, et il sert surtout à éviter un devis à côté de la plaque.",
        },
        {
          title: "Devis détaillé sous 48 h ouvrées",
          detail:
            "Périmètre écrit, livrables, délais et prix ferme. Le devis reste valable 30 jours : vous décidez sans pression de calendrier.",
        },
        {
          title: "Signature et règlement",
          detail:
            "La commande devient ferme au retour du devis signé, avec l'acompte convenu s'il y en a un. Virement bancaire ; l'échéancier éventuel figure au devis.",
        },
        {
          title: "Livraison puis facture",
          detail:
            "La facture reprend exactement le montant validé, hors taxes, avec la TVA applicable. Aucun ajustement à la hausse en fin de mission.",
        },
      ],
      nuances: [
        {
          title: "Ce n'est pas un abonnement",
          detail:
            "Chaque prestation est un livrable autonome, sans engagement de durée. Seuls les formats explicitement récurrents — coaching régulier, maintenance — reposent sur un contrat, et c'est écrit au devis.",
        },
        {
          title: "Ce n'est pas de la régie",
          detail:
            "On ne facture pas les heures passées mais un forfait sur un périmètre écrit. Si le périmètre change, cela fait l'objet d'un avenant discuté, jamais d'une ligne supplémentaire découverte sur la facture.",
        },
        {
          title: "Les tarifs affichés ne sont pas TTC",
          detail:
            "Tous les montants publiés sur le site sont hors taxes. La TVA s'ajoute sur la facture selon le régime applicable au client : à budgéter dès le départ.",
        },
      ],
    },
    en: {
      question: "How does billing work?",
      answer:
        "Fixed quote + bank transfer + invoice (EU VAT regime according to client residence). No subscriptions, no commitments.",
    },
  },
  {
    id: "comment-commencer",
    reviewedAt: "2026-08-12",
    related: ["definition-axion-ia", "budget-demarrer-ia", "premier-diagnostic-ia"],
    fr: {
      question: "Par où commencer avec l'IA dans mon entreprise ?",
      answer:
        "Par un cas réel, pas par un plan stratégique. La première étape recommandée est une intervention de découverte — une demi-journée ou une journée — qui identifie 3 à 5 process candidats à l'IA dans votre contexte. L'intervenant arrive avec ses modèles, travaille sur vos données et démontre des gains concrets avant tout engagement.\n\nEn amont, un appel de cadrage de 30 minutes suffit à choisir le bon point d'entrée. Si vous voulez faire monter une équipe, ce sera une formation en intra. Si le sujet est votre propre poste, ce sera le coaching 1-to-1. Si vous cherchez une cartographie chiffrée de l'entreprise, ce sera l'audit IA.\n\nAucune compétence technique n'est requise et aucune installation logicielle n'est demandée de votre côté. Le devis suit sous 48 heures ouvrées, et les équipes formées sont opérationnelles dès le lendemain.",
      keyPoints: [
        "Commencer par un cas réel, pas par une stratégie IA",
        "Appel de cadrage de 30 minutes pour choisir le point d'entrée",
        "Journée de découverte : 3 à 5 process candidats identifiés sur vos données",
        "Aucune compétence technique ni installation requise de votre côté",
        "Devis sous 48 h ouvrées, équipes opérationnelles dès le lendemain",
      ],
      facts: [
        { figure: "30 min", label: "d'appel de cadrage" },
        { figure: "3-5", label: "process identifiés" },
        { figure: "48 h", label: "ouvrées pour le devis" },
        { figure: "J+1", label: "équipes opérationnelles" },
      ],
      steps: [
        {
          title: "Appel de cadrage",
          detail:
            "30 minutes pour décrire votre contexte et cerner le format adapté. Sans engagement, et sans qu'aucun chiffrage ne soit encore nécessaire.",
        },
        {
          title: "Journée de découverte",
          detail:
            "Une demi-journée ou une journée sur vos données réelles : 3 à 5 process candidats à l'IA sont identifiés et les gains sont démontrés en direct.",
        },
        {
          title: "Choix du format",
          detail:
            "Formation en intra pour une équipe, coaching 1-to-1 pour un poste, audit IA pour une cartographie chiffrée de l'entreprise. Le devis arrive sous 48 heures ouvrées.",
        },
        {
          title: "Mise en pratique",
          detail:
            "Les équipes appliquent dès le lendemain. Ce qui mérite d'être automatisé passe ensuite en implémentation, avec 30 jours de support inclus à la livraison.",
        },
      ],
      nuances: [
        {
          title: "Ce n'est pas un projet informatique",
          detail:
            "La première étape ne demande ni budget IT, ni installation, ni compétence technique. L'intervenant vient avec son propre équipement.",
        },
        {
          title: "Ce n'est pas un audit",
          detail:
            "La journée de découverte porte sur 3 à 5 process. La cartographie complète de l'entreprise, avec scoring et chiffrage des opportunités, c'est l'audit IA — une prestation distincte.",
        },
        {
          title: "Il n'y a pas d'ordre imposé",
          detail:
            "Rien n'oblige à passer par la découverte avant une formation ou une implémentation. C'est un point d'entrée recommandé, pas un préalable.",
        },
      ],
    },
    en: {
      question: "Where do I start with AI in my company?",
      answer:
        "The recommended first step is a discovery session (half-day or full day) to identify 3 to 5 AI candidate processes in your real context. Axion-IA arrives on site with its AI models and works on your data to demonstrate concrete gains before any commitment.",
    },
  },
  {
    id: "delai-implementation",
    reviewedAt: "2026-08-12",
    related: [
      "implementation-ia-sur-mesure",
      "accompagnement-post-implementation",
      "integration-ia-entreprise-concrete",
    ],
    fr: {
      question: "Quel est le délai pour implémenter l'IA en entreprise ?",
      answer:
        "Comptez 6 à 8 semaines pour un projet d'implémentation IA complet, à compter de la signature du devis : 1 semaine de cadrage, 2 à 4 semaines de prototype, 1 à 2 semaines de tests et 1 semaine de déploiement. Trente jours de support correctif sont inclus après la mise en production.\n\nLe périmètre fait varier ce délai dans les deux sens. Une automatisation simple — lecture de factures, chatbot branché sur votre site — tourne en environ 2 semaines. À l'inverse, une IA sur mesure profondément intégrée à vos systèmes s'étale sur 4 à 12 semaines. Le devis, lui, part sous 48 heures ouvrées après l'échange de cadrage.\n\nRien n'oblige à attendre la fin pour voir quelque chose : on travaille par sprints courts avec des démos régulières, donc vous validez à chaque étape au lieu de découvrir le résultat au dernier jour. Et si votre besoin est d'abord de faire monter vos équipes, une formation collective les rend opérationnelles dès le lendemain.",
      keyPoints: [
        "6 à 8 semaines pour un projet complet, à partir de la signature du devis",
        "1 sem. de cadrage, 2 à 4 sem. de prototype, 1 à 2 sem. de tests, 1 sem. de déploiement",
        "Environ 2 semaines pour une automatisation simple et ciblée",
        "30 jours de support correctif inclus après la mise en production",
        "Devis envoyé sous 48 h ouvrées après l'échange de cadrage",
      ],
      facts: [
        { figure: "6-8 sem", label: "pour un projet complet" },
        { figure: "2 sem", label: "pour une automatisation simple" },
        { figure: "30 j", label: "de support inclus" },
        { figure: "48 h", label: "ouvrées pour le devis" },
      ],
      steps: [
        {
          title: "Cadrage",
          detail:
            "Ateliers métier, choix d'architecture, backlog priorisé et spécifications claires. Environ une semaine, avant la première ligne de code.",
        },
        {
          title: "Prototype",
          detail:
            "2 à 4 semaines de sprints courts avec démos régulières. La solution prend forme sur vos vraies données, sans effet tunnel.",
        },
        {
          title: "Tests et recette",
          detail:
            "1 à 2 semaines de vérifications et de corrections, avec validation métier avant tout passage en production.",
        },
        {
          title: "Déploiement et suivi",
          detail:
            "Une semaine de mise en production sur vos outils, formation des équipes, puis 30 jours de support correctif.",
        },
      ],
      nuances: [
        {
          title: "Le compteur part de la signature",
          detail:
            "Ces semaines démarrent quand le devis est signé, pas au premier contact. Avant, il y a l'échange de cadrage puis le chiffrage, envoyé sous 48 heures ouvrées.",
        },
        {
          title: "Ce n'est pas un délai unique pour tous les projets",
          detail:
            "Une automatisation ciblée sort en environ 2 semaines ; une IA sur mesure profondément intégrée demande 4 à 12 semaines. C'est le périmètre qui commande, pas un forfait de durée.",
        },
        {
          title: "Une formation ne suit pas ce calendrier",
          detail:
            "Une formation collective n'a pas de phase de développement. Les équipes sont opérationnelles dès le lendemain de la session, sur leurs propres cas.",
        },
      ],
    },
    en: {
      question: "How long does it take to implement AI in a company?",
      answer:
        "An Axion-IA AI implementation project takes 6 to 8 weeks: 1 week scoping, 2 to 4 weeks prototype, 1 to 2 weeks testing, 1 week deployment. 30 days support included. For training alone, teams are operational from the next day.",
    },
  },
  {
    id: "ia-remplace-salaries",
    reviewedAt: "2026-08-12",
    related: ["heures-semaine-pme", "pme-ia", "automatiser-taches-ia"],
    fr: {
      question: "L'IA va-t-elle remplacer mes salariés ?",
      answer:
        "Non : l'IA automatise des tâches, pas des métiers. Elle prend en charge le répétitif à faible valeur — saisie, classement, rédaction d'e-mails standards, comptes-rendus de réunion, recherche d'informations — et libère du temps sur les missions à forte valeur ajoutée.\n\nEn pratique, cela donne des équipes qui produisent davantage à effectif constant, une masse salariale qui n'augmente plus au rythme de la croissance, et certains postes qui évoluent vers des missions plus stratégiques. Les gains constatés se situent autour de 1 à 3 heures par jour et par collaborateur, dès la première semaine.\n\nC'est un levier de productivité, et l'arbitrage sur l'organisation reste le vôtre. Axion-IA intervient sur le diagnostic technique et la transformation des process ; nous ne conseillons ni sur l'organisation RH interne, ni sur les décisions d'effectif.",
      keyPoints: [
        "L'IA automatise des tâches répétitives, pas des métiers",
        "Saisie, classement, e-mails standards, comptes-rendus, recherche d'informations",
        "Plus de production à effectif constant, certains postes évoluent",
        "1 à 3 heures libérées par jour et par collaborateur, dès la première semaine",
        "L'organisation RH reste votre décision : nous intervenons sur les process",
      ],
      facts: [
        { figure: "1-3 h", label: "gagnées par jour" },
        { figure: "5-15 h", label: "libérées par semaine" },
        { figure: "3-5", label: "automatisations identifiées d'emblée" },
      ],
      nuances: [
        {
          title: "Ce n'est pas un plan de réduction d'effectifs",
          detail:
            "Axion-IA n'intervient ni sur l'organisation RH, ni sur les décisions d'effectif. Notre périmètre s'arrête au diagnostic technique et à la transformation des process.",
        },
        {
          title: "Toutes les tâches ne s'automatisent pas",
          detail:
            "L'IA générative excelle sur le langage, la recherche et l'analyse. Les tâches qui demandent une relation client, un arbitrage ou une responsabilité engagée restent humaines.",
        },
        {
          title: "Le gain n'est pas automatique",
          detail:
            "Sans prise en main, les outils restent inutilisés. C'est exactement ce que traitent la formation et le coaching 1-to-1 : rendre les équipes autonomes sur leurs propres cas.",
        },
      ],
    },
    en: {
      question: "Will AI replace my employees?",
      answer:
        "AI automates low-value repetitive tasks (data entry, filing, standard email drafting, meeting notes, information search) to free up time for higher-value work. In practice: your teams produce more with the same headcount, your payroll no longer scales at the same pace as your growth, and some roles can evolve toward more strategic missions. It's a productivity lever — we support you on the technical diagnosis and process transformation, not on internal HR organisation (which stays your decision).",
    },
  },
  {
    id: "competences-techniques",
    reviewedAt: "2026-08-12",
    related: ["formation-ia-entreprise", "equipes-operationnelles", "outils-ia"],
    fr: {
      question: "Faut-il avoir des compétences techniques pour bénéficier d'une intervention IA ?",
      answer:
        "Non, aucune. Les formations Axion-IA s'adressent à des équipes non techniques : la seule qui suppose une aisance en développement ou en administration système est celle destinée aux profils IT. Partout ailleurs, on part du principe que certains participants n'ont jamais ouvert un outil d'IA, et chaque notion est démontrée en direct avant d'être pratiquée immédiatement.\n\nCôté matériel, rien à installer : un ordinateur portable et une connexion internet suffisent, et les accès aux outils sont préparés avec vous en amont si besoin. Les exercices portent sur vos propres tâches — offres d'emploi et comptes rendus côté RH, propositions et relances côté commercial, rapports et relances côté comptabilité, courriers et synthèses côté direction — et non sur des cas d'école.\n\nCe qui compte n'est donc pas le niveau technique, mais le fait d'arriver avec de vraies tâches à traiter. Les participants qui utilisent déjà l'IA de temps en temps ne perdent rien pour autant : ils y gagnent une méthode et des réflexes de vérification qu'ils n'ont généralement pas.",
      keyPoints: [
        "Aucun prérequis technique : les formations sont conçues pour des équipes non techniques",
        "Seule exception, la formation destinée aux profils IT suppose une aisance en développement",
        "Rien à installer : un ordinateur portable et une connexion internet suffisent",
        "Les accès aux outils sont préparés avec vous en amont si besoin",
        "Chaque notion est démontrée en direct, puis pratiquée sur vos propres tâches",
      ],
      facts: [
        { figure: "0", label: "prérequis technique" },
        { figure: "3", label: "assistants pratiqués" },
        { figure: "2-15", label: "participants par groupe" },
        { figure: "4 h", label: "format le plus court" },
      ],
      nuances: [
        {
          title: "Ce n'est pas un cours d'informatique",
          detail:
            "On n'écrit pas de code et on ne configure rien. On apprend à formuler une demande, à choisir le bon assistant et à relire ce qui en sort avant de le diffuser.",
        },
        {
          title: "Ce n'est pas une démonstration à regarder",
          detail:
            "Chaque notion est suivie d'une pratique immédiate sur une tâche réelle du participant. Les exercices sont différenciés par profil et une partie se fait en binômes.",
        },
        {
          title: "Débuter ne veut pas dire être seul dans son cas",
          detail:
            "Le groupe compte 2 à 15 personnes et mélange les niveaux : ceux qui n'ont jamais essayé et ceux qui utilisent déjà l'IA. C'est ce mélange qui fait avancer la salle.",
        },
      ],
    },
    en: {
      question: "Do you need technical skills to benefit from an AI session?",
      answer:
        "No. Axion-IA sessions are designed for non-technical teams. No software installation is required on your end. The trainer arrives with their own equipment and adapts examples to your real business roles (HR, accounting, sales, operations, etc.).",
    },
  },
  {
    id: "roi-mesurer",
    reviewedAt: "2026-08-12",
    related: ["budget-demarrer-ia", "audit-ia-definition", "cout-projet-ia-pme"],
    fr: {
      question: "Comment mesurer le ROI d'un projet IA ?",
      answer:
        "On mesure le ROI d'un projet IA en partant du temps, jamais de l'argent. Axion-IA suit trois dimensions : le temps gagné par collaborateur, observable dès J+3 sur les tâches traitées autrement ; le coût des tâches automatisées, calculé avant et après ; et la qualité des livrables, c'est-à-dire les erreurs évitées et les délais tenus.\n\nLe calcul s'enchaîne toujours dans le même ordre. Vous estimez les heures quotidiennes passées sur les tâches répétitives, vous les multipliez par l'effectif concerné et par une hypothèse d'adoption assumée : notre modèle retient de 40 % d'efficacité pour une adoption prudente à 75 % pour des workflows réellement outillés et pratiqués tous les jours. Vous obtenez des heures rendues, converties en jours libérés puis en équivalents temps plein. La conversion en euros n'arrive qu'en dernier : heures annuelles rendues multipliées par votre coût horaire chargé.\n\nLe simulateur /roi enchaîne ces étapes avant toute intervention et publie chacune de ses hypothèses. Ce sont des ordres de grandeur, pas un engagement de résultat : comptez 4 à 8 semaines de pratique régulière avant un effet stable sur la charge de travail.",
      keyPoints: [
        "Trois dimensions : temps gagné, coût des tâches automatisées, qualité des livrables",
        "On part des heures, jamais des euros — la conversion financière vient en dernier",
        "Hypothèse d'adoption assumée : de 40 % à 75 % d'efficacité sur le temps répétitif",
        "Heures rendues, puis jours libérés, puis équivalents temps plein",
        "Le simulateur /roi chiffre l'estimation avant toute intervention",
      ],
      facts: [
        { figure: "3", label: "dimensions mesurées" },
        { figure: "J+3", label: "premiers gains observables" },
        { figure: "40-75 %", label: "efficacité selon l'adoption" },
        { figure: "4-8 sem.", label: "avant un effet stable" },
      ],
      steps: [
        {
          title: "Comptez les heures répétitives",
          detail:
            "Par personne et par jour, le temps passé à rédiger, chercher, résumer et reporter. Une estimation à la louche suffit pour démarrer.",
        },
        {
          title: "Choisissez votre hypothèse d'adoption",
          detail:
            "De 40 % d'efficacité pour une adoption prudente à 75 % pour des workflows réellement reconstruits et pratiqués au quotidien.",
        },
        {
          title: "Convertissez en heures rendues",
          detail:
            "Multipliez par l'effectif concerné : vous obtenez des heures rendues, puis des jours libérés, puis des équivalents temps plein sur l'année.",
        },
        {
          title: "Passez en euros en dernier",
          detail:
            "Heures annuelles rendues multipliées par votre coût horaire chargé. C'est une conclusion du calcul, jamais son point de départ.",
        },
      ],
      nuances: [
        {
          title: "Ce n'est pas un engagement de résultat",
          detail:
            "Le simulateur produit des ordres de grandeur à partir d'hypothèses publiées sur la page. Pour un chiffrage sur vos process réels, avec mesure avant/après, c'est l'objet de l'audit IA.",
        },
        {
          title: "Ce n'est pas mesurable dès la première semaine",
          detail:
            "Les premiers réflexes s'installent tout de suite, mais un gain stable suppose que les nouveaux usages remplacent durablement les anciens : 4 à 8 semaines de pratique régulière.",
        },
        {
          title: "Ce n'est pas qu'une histoire d'euros",
          detail:
            "Les erreurs évitées et les délais tenus pèsent autant que les heures gagnées. Ils ne se convertissent pas en euros : ils se constatent sur la qualité des livrables.",
        },
      ],
    },
    en: {
      question: "How do you measure the ROI of an AI project?",
      answer:
        "Axion-IA measures ROI on 3 dimensions: time saved per employee (observable from day 3), cost of automated tasks (calculated before/after) and deliverable quality (fewer errors, deadlines met). The /roi simulator lets you estimate gains before any session.",
    },
  },
  {
    id: "ai-act-2026",
    reviewedAt: "2026-08-12",
    related: ["rgpd-ia", "ia-droit-auteur-contenu", "risques-ia-entreprise"],
    fr: {
      question: "Quelles sont les obligations légales des entreprises face à l'AI Act 2026 ?",
      answer:
        "L'AI Act européen est entré en vigueur en 2024 et son application est progressive jusqu'à août 2026. Il classe les systèmes d'IA par niveau de risque et fait porter des obligations différentes selon cette classification.\n\nPour une entreprise qui utilise de l'IA générative sans la développer, trois obligations reviennent le plus souvent : informer les utilisateurs qu'un contenu est généré par IA (article 50), documenter les usages d'IA à risque limité, et désigner un interlocuteur chargé de la conformité IA. S'y ajoutent les obligations RGPD, qui continuent de s'appliquer pleinement aux données traitées.\n\nAxion-IA intègre la conformité AI Act dans ses implémentations : étiquetage des contenus générés, traçabilité des traitements, versionnage. C'est un travail de mise en place technique, pas une prestation juridique — la qualification exacte de vos systèmes et la validation de votre conformité relèvent de votre conseil.",
      keyPoints: [
        "Entré en vigueur en 2024, application progressive jusqu'à août 2026",
        "Les systèmes d'IA sont classés par niveau de risque",
        "Article 50 : informer que le contenu est généré par IA",
        "Documenter les usages à risque limité, désigner un interlocuteur conformité",
        "Le RGPD continue de s'appliquer en parallèle",
      ],
      facts: [
        { figure: "2024", label: "entrée en vigueur" },
        { figure: "août 2026", label: "plein effet du règlement" },
        { figure: "art. 50", label: "transparence des contenus IA" },
        { figure: "3", label: "obligations les plus courantes" },
      ],
      nuances: [
        {
          title: "Ce n'est pas une prestation juridique",
          detail:
            "Axion-IA met en place les dispositifs techniques : étiquetage, traçabilité, versionnage. La qualification de vos systèmes et la validation de votre conformité relèvent de votre conseil juridique.",
        },
        {
          title: "Toutes les obligations ne visent pas tout le monde",
          detail:
            "Le règlement gradue les obligations selon le rôle tenu — fournisseur du système ou entreprise qui l'utilise — et selon le niveau de risque. Utiliser un assistant du marché n'emporte pas les mêmes exigences que publier un système à haut risque.",
        },
        {
          title: "L'échéance n'est pas unique",
          detail:
            "L'application est échelonnée jusqu'à août 2026, obligation par obligation. Il n'y a pas une date unique à laquelle tout devient exigible d'un coup.",
        },
      ],
    },
    en: {
      question: "What are companies' legal obligations under the 2026 AI Act?",
      answer:
        "The EU AI Act (phased enforcement until August 2026) requires companies using generative AI to: (1) inform users that content is AI-generated (art. 50), (2) document limited-risk AI uses, (3) appoint an AI compliance contact. Axion-IA integrates AI Act compliance into its implementations.",
    },
  },
  {
    id: "pme-ia",
    reviewedAt: "2026-08-12",
    related: ["heures-semaine-pme", "tpe-ia", "automatiser-taches-ia"],
    fr: {
      question: "Comment l'IA peut-elle aider une PME concrètement ?",
      answer:
        "Par des gains de temps sur des tâches quotidiennes, obtenus en quelques jours et sans projet informatique. Dans une PME, les usages qui rapportent le plus vite sont toujours les mêmes : la rédaction d'e-mails et de propositions commerciales (−70 % du temps), les comptes-rendus de réunion générés automatiquement, la recherche d'informations et la veille (5× plus rapide), la qualification de prospects par scoring automatisé et la génération de rapports internes.\n\nCe sont des usages transversaux : ils concernent le commercial comme la comptabilité, les RH comme la direction. Une PME n'a donc pas besoin de lancer un chantier data pour en profiter — un assistant bien configuré sur les bons cas suffit à démarrer.\n\nConcrètement, cela représente 1 à 3 heures libérées par jour et par collaborateur, dès la première semaine. Les automatisations plus lourdes, quand elles se justifient, passent ensuite en implémentation.",
      keyPoints: [
        "Rédaction d'e-mails et de propositions commerciales : −70 % du temps",
        "Comptes-rendus de réunion générés automatiquement",
        "Recherche d'informations et veille : 5× plus rapide",
        "Qualification de prospects et rapports internes automatisés",
        "1 à 3 heures libérées par jour et par collaborateur",
      ],
      facts: [
        { figure: "−70 %", label: "sur la rédaction" },
        { figure: "5×", label: "sur la recherche d'informations" },
        { figure: "1-3 h", label: "gagnées par jour" },
        { figure: "5", label: "usages à gain rapide" },
      ],
      nuances: [
        {
          title: "Pas besoin d'un chantier data",
          detail:
            "Ces gains s'obtiennent avec des assistants du marché correctement configurés sur vos cas. Le chantier data, s'il se justifie, vient bien plus tard.",
        },
        {
          title: "Ce n'est pas réservé aux profils techniques",
          detail:
            "Les formations sont conçues pour des équipes non techniques : aucune installation n'est requise et les exemples sont pris dans vos métiers réels.",
        },
        {
          title: "L'outil seul ne suffit pas",
          detail:
            "Un abonnement à un assistant ne produit aucun gain s'il n'est pas pris en main sur des dossiers concrets. C'est ce que fait la journée de formation ou de coaching.",
        },
      ],
    },
    en: {
      question: "How can AI concretely help an SME?",
      answer:
        "For an SME, the fastest AI gains come from: email and commercial proposal writing (−70% time), meeting notes (automated), information research and monitoring (5× faster), prospect qualification (automated scoring) and internal report generation.",
    },
  },
  {
    id: "chatgpt-vs-claude",
    reviewedAt: "2026-08-12",
    related: ["chatgpt-copilot-gemini-choisir", "ia-gratuite-vs-payante", "outils-ia"],
    fr: {
      question: "Quelle est la différence entre ChatGPT et Claude ?",
      answer:
        "Ce sont deux assistants conversationnels concurrents, très proches dans l'usage quotidien, qui se distinguent surtout par leur tempérament. ChatGPT, édité par OpenAI, est le plus répandu et le plus riche en fonctions annexes : génération d'images, exécution de code, écosystème d'extensions. Claude, édité par Anthropic, est réputé pour l'analyse de documents longs, la finesse rédactionnelle et une approche prudente sur les sujets sensibles.\n\nDans les faits, un dirigeant qui teste les deux sur ses propres tâches constatera des écarts bien moins spectaculaires que ne le laissent croire les comparatifs en ligne. Les deux rédigent, résument, traduisent et raisonnent correctement. Ce qui fait vraiment la différence en entreprise, c'est le paramétrage de la confidentialité, l'intégration à vos outils existants et la qualité de vos consignes — pas la marque inscrite sur l'onglet.\n\nAxion-IA est indépendant des éditeurs. Sur une journée de coaching 1-to-1 de 7 à 8 heures, en tête-à-tête, on prend en main les 3 assistants les plus utilisés en entreprise — ChatGPT, Claude et Gemini — sur vos vrais dossiers. Vous tranchez ensuite en connaissance de cause.",
      keyPoints: [
        "Deux assistants concurrents, très proches dans l'usage courant",
        "ChatGPT : le plus répandu, l'écosystème de fonctions le plus large",
        "Claude : documents longs, rédaction, prudence sur les sujets sensibles",
        "En entreprise, confidentialité et intégration pèsent plus que la marque",
        "Le seul test valable : vos propres dossiers, avec les deux outils",
      ],
      facts: [
        { figure: "3", label: "assistants pris en main" },
        { figure: "7-8 h", label: "en tête-à-tête" },
        { figure: "1", label: "seule personne accompagnée" },
      ],
      nuances: [
        {
          title: "Ce n'est pas un match à trancher pour dix ans",
          detail:
            "Les deux éditeurs se dépassent tour à tour, à quelques mois d'intervalle. Savoir changer d'outil compte davantage que choisir le bon une fois pour toutes.",
        },
        {
          title: "La version gratuite ne dit rien de l'usage professionnel",
          detail:
            "Les offres découverte ne reflètent ni les capacités des formules professionnelles, ni leurs garanties de confidentialité. Comparer en gratuit mène à de fausses conclusions.",
        },
        {
          title: "Le meilleur modèle ne rattrape pas une mauvaise consigne",
          detail:
            "L'écart de résultat entre deux utilisateurs du même assistant est presque toujours plus grand que l'écart entre deux assistants concurrents.",
        },
      ],
    },
    en: {
      question: "What is the difference between ChatGPT and Claude?",
      answer:
        "ChatGPT (OpenAI) and Claude (Anthropic) are two leading LLM models. Claude stands out for its very long context window (ideal for analysing long documents), enhanced safety approach (Constitutional AI), and excellent writing and analysis performance. The choice depends on the use case: Axion-IA recommends the most suitable model for your context.",
    },
  },
  {
    id: "audit-ia-definition",
    reviewedAt: "2026-08-12",
    related: ["livrables-audit-ia", "duree-audit-ia", "cout-audit-ia-entreprise"],
    fr: {
      question: "Qu'est-ce qu'un audit IA d'entreprise ?",
      answer:
        "Un audit IA d'entreprise est un diagnostic qui cartographie vos processus existants, identifie les opportunités d'automatisation ou d'assistance par l'IA, les score sur deux axes — ROI estimé et complexité technique —, chiffre chacune en effort, coût et délai, puis livre un plan d'implémentation priorisé. Un audit Axion-IA identifie typiquement 8 à 15 opportunités.\n\nIl existe quatre niveaux, calibrés sur la taille et le périmètre. L'audit sur place tient en une journée complète dans vos locaux et s'adresse aux TPE. L'audit Ciblé couvre un département sur trois à quatre semaines. Le Stratégique PME couvre deux à quatre services sur cinq à six semaines, avec restitution en COMEX. Le Stratégique ETI est transverse et multi-BU, sur neuf semaines, avec un volet gouvernance et des livrables board-ready.\n\nLe livrable est toujours un document écrit — de 8 à 15 pages pour l'audit sur place, jusqu'à 60 à 80 pages pour l'ETI — accompagné d'une restitution orale. Chaque recommandation est cadrée RGPD (où sont les données, qui y accède, sur quelle base juridique) et vérifiée au regard de l'AI Act 2026.",
      keyPoints: [
        "Cartographie des processus, puis scoring ROI et complexité de chaque opportunité",
        "8 à 15 opportunités identifiées, chacune chiffrée en effort, coût et délai",
        "Quatre niveaux : sur place (TPE), Ciblé, Stratégique PME, Stratégique ETI",
        "Livrable écrit de 8-15 à 60-80 pages selon le niveau, plus une restitution",
        "Chaque recommandation cadrée RGPD et vérifiée au regard de l'AI Act 2026",
      ],
      facts: [
        { figure: "8-15", label: "opportunités IA identifiées" },
        { figure: "4", label: "niveaux d'audit" },
        { figure: "1 j", label: "pour l'audit sur place" },
        { figure: "9 sem.", label: "pour l'audit ETI" },
      ],
      steps: [
        {
          title: "Cadrage du périmètre",
          detail:
            "Un appel de cadrage fixe le niveau et le périmètre : une TPE entière, un département, plusieurs services ou un groupe multi-BU.",
        },
        {
          title: "Cartographie des processus",
          detail:
            "Entretiens terrain et collecte documentaire : quels chronophages, quelle volumétrie, quels outils en place, quelles frictions réelles.",
        },
        {
          title: "Scoring et chiffrage",
          detail:
            "Chaque opportunité IA reçoit un score ROI et complexité, puis un chiffrage en effort, coût et délai d'implémentation.",
        },
        {
          title: "Plan priorisé et restitution",
          detail:
            "Rapport écrit et atelier de restitution : ce qu'il faut lancer en premier, ce qui peut attendre, ce qu'il vaut mieux abandonner.",
        },
      ],
      nuances: [
        {
          title: "Ce n'est pas un rapport théorique",
          detail:
            "Chaque opportunité est chiffrée en effort, coût et délai, et cadrée RGPD. Le document sert à arbitrer un investissement, pas à documenter un état de l'art.",
        },
        {
          title: "Ce n'est pas un état des lieux d'un poste",
          detail:
            "L'audit porte sur des processus et des services. Pour faire monter une personne sur ses propres outils, sur son poste réel, c'est le coaching 1-to-1.",
        },
        {
          title: "Ce n'est pas une commande déguisée",
          detail:
            "Le plan est rédigé pour que vos équipes puissent l'exécuter seules. Nous confier la suite reste une décision distincte, prise après lecture du rapport.",
        },
      ],
    },
    en: {
      question: "What is a company AI audit?",
      answer:
        "An Axion-IA AI audit is a 1 to 5-day diagnostic that maps your existing processes, identifies 8 to 15 AI opportunities scored by ROI/complexity, costs each opportunity (effort + cost + timeline) and delivers a prioritised implementation plan. The deliverable is a 25 to 40-page PDF with a debrief workshop.",
    },
  },
  {
    id: "equipes-operationnelles",
    reviewedAt: "2026-08-12",
    related: ["formation-ia-entreprise", "former-equipes-ia", "formation-ia-difference"],
    fr: {
      question:
        "En combien de temps les équipes sont-elles opérationnelles après une formation IA ?",
      answer:
        "Dès le lendemain. Les formations Axion-IA sont construites pour cela : chaque notion fait l'objet d'une démonstration courte, suivie d'une pratique immédiate sur les tâches réelles apportées par les participants. Personne ne repart avec des notes à retranscrire — on repart avec ce qu'on a produit en séance.\n\nÀ l'issue d'une journée, chacun dispose de prompts construits sur ses propres cas, de trames réutilisables et d'une liste de 5 premières actions à mener dans son poste. L'acquisition est vérifiée pendant la session par les exercices, puis par un quiz individuel de 10 questions dont le seuil de réussite est fixé à 7 sur 10 ; une attestation individuelle mentionnant les compétences acquises est remise à l'issue du parcours.\n\nLa vitesse d'installation dépend ensuite du format retenu. Une demi-journée de 4 heures lève les blocages et pose les premiers usages ; une journée de 7 heures installe une pratique commune ; les formats de 2 journées vont jusqu'à la construction d'automatisations. Les formations de 2 jours sont scindables en deux journées espacées, ce qui laisse le temps de pratiquer entre les deux.",
      keyPoints: [
        "Opérationnel dès le lendemain : la pratique se fait en séance, sur vos vraies tâches",
        "Chacun repart avec ses prompts, des trames réutilisables et 5 premières actions",
        "Quiz individuel de 10 questions, seuil de réussite fixé à 7 sur 10",
        "Attestation individuelle mentionnant les compétences acquises",
        "Les formations de 2 jours sont scindables en deux journées espacées",
      ],
      facts: [
        { figure: "J+1", label: "premiers usages en autonomie" },
        { figure: "5", label: "premières actions listées" },
        { figure: "10", label: "questions au quiz final" },
        { figure: "7/10", label: "seuil de réussite" },
      ],
      steps: [
        {
          title: "Démonstration courte",
          detail:
            "Le formateur montre la notion en direct, sur un cas transversal, avant toute théorie. Rien à recopier : la salle regarde faire, puis fait.",
        },
        {
          title: "Pratique immédiate",
          detail:
            "Chacun applique la notion à une tâche réelle de son poste, apportée le matin même. Exercices différenciés par profil et travail en binômes.",
        },
        {
          title: "Vérification avant diffusion",
          detail:
            "On relit la production avec une grille et on repère ce qui est faux ou invérifiable. C'est ce réflexe qui rend l'autonomie utilisable dès le lendemain.",
        },
        {
          title: "Ce que je fais lundi",
          detail:
            "Chacun écrit ses 5 premières actions et conserve ses prompts. Quiz individuel de 10 questions, puis attestation individuelle des compétences acquises.",
        },
      ],
      nuances: [
        {
          title: "Ce n'est pas une montée en compétence théorique",
          detail:
            "L'objectif est explicitement l'inverse des slides oubliés : ce qui n'a pas été pratiqué en séance sur un cas réel n'est pas considéré comme acquis.",
        },
        {
          title: "Opérationnel ne veut pas dire expert",
          detail:
            "Au bout d'une journée, on maîtrise quelques usages solides et les réflexes de vérification — pas l'ensemble du paysage IA. C'est ce qui rend le résultat tenable.",
        },
        {
          title: "Le délai d'accès n'est pas le délai d'autonomie",
          detail:
            "Comptez au moins 11 jours ouvrés entre la confirmation et la session, le temps de préparer les cas et les accès. L'autonomie, elle, se joue le lendemain de la session.",
        },
      ],
    },
    en: {
      question: "How quickly are teams operational after AI training?",
      answer:
        "From the next day. Axion-IA trainings are 100% practical on real company cases. Participants leave with immediately applicable workflows, personalised prompts and a list of 5 first concrete actions for their role.",
    },
  },
  {
    id: "eti-grands-comptes",
    reviewedAt: "2026-08-12",
    related: ["audit-ia-definition", "implementation-ia-sur-mesure", "qui-pilote-ia-entreprise"],
    fr: {
      question: "Axion-IA travaille-t-il avec les ETI et grands comptes ?",
      answer:
        "Oui. Axion-IA accompagne des entreprises de toutes tailles, des TPE aux ETI et aux grands comptes. Pour ces dernières, l'offre prend une forme différente : programmes multi-sites sur devis, audits stratégiques approfondis et implémentations à large envergure avec gouvernance des données.\n\nL'Audit Stratégique ETI est conçu pour les structures de 250 à 5 000 salariés : cartographie multi-directions, 20 à 30 entretiens, restitution en COMEX et devant le conseil, plan de 60 à 80 pages exploitable en instance, puis 30 jours d'accompagnement après la remise. Le cadre AI Act et RGPD y est traité par défaut, avec mise en place d'un comité IA, d'une charte interne et des rôles associés.\n\nCôté implémentation, les missions ETI et les programmes annuels sont sur devis. Le principe reste celui des autres prestations : un intervenant senior, le même du cadrage à la livraison, et des livrables actionnables plutôt qu'un rapport de plus.",
      keyPoints: [
        "Toutes les tailles, des TPE aux ETI et grands comptes",
        "Programmes multi-sites et programmes annuels sur devis",
        "Audit Stratégique ETI : 250 à 5 000 salariés, 20 à 30 entretiens",
        "Restitution COMEX et conseil, plan de 60 à 80 pages, 30 jours d'accompagnement",
        "Gouvernance IA, conformité AI Act et RGPD traitées par défaut",
      ],
      facts: [
        { figure: "250-5000", label: "salariés visés" },
        { figure: "20-30", label: "entretiens menés" },
        { figure: "60-80", label: "pages de plan" },
        { figure: "30 j", label: "d'accompagnement post-audit" },
      ],
      nuances: [
        {
          title: "Ce n'est pas un cabinet de stratégie",
          detail:
            "Les livrables sont exploitables par les équipes : opportunités chiffrées, plan d'implémentation priorisé, gouvernance opérationnelle. Nous mettons ensuite en production ce qui a été retenu.",
        },
        {
          title: "Nous ne remplaçons pas vos équipes internes",
          detail:
            "Sur les grandes structures, Axion-IA vient en complément d'une DSI ou d'une équipe data déjà en place — pas à leur place.",
        },
        {
          title: "Les secteurs très régulés se traitent à plusieurs",
          detail:
            "Pour le nucléaire, la pharmacie ou la défense, la mission est co-pilotée avec un cabinet spécialisé partenaire.",
        },
      ],
    },
    en: {
      question: "Does Axion-IA work with mid-caps and large companies?",
      answer:
        "Yes. Axion-IA works with companies of all sizes, from small businesses to mid-caps and large companies. For mid-caps and large accounts, Axion-IA offers multi-site programmes (on request), in-depth strategic audits and large-scale AI implementations with data governance.",
    },
  },
  {
    id: "secteurs-ia",
    reviewedAt: "2026-08-12",
    related: ["pme-ia", "eti-grands-comptes", "formation-ia-entreprise"],
    fr: {
      question: "Quels secteurs sont concernés par l'IA générative ?",
      answer:
        "Tous les secteurs économiques, parce que l'IA générative agit sur des tâches — écrire, chercher, résumer, classer, analyser — qui existent dans n'importe quelle activité. Ce qui change d'un secteur à l'autre, ce sont les cas d'usage prioritaires et les contraintes de confidentialité.\n\nDix secteurs disposent d'une page dédiée sur le site : comptabilité et finance, BTP et immobilier, restauration et hôtellerie, santé et médecine, juridique, commerce et retail, industrie et logistique, artisanat et services, RH et recrutement, collectivités et secteur public. Huit formations sectorielles complètent le catalogue, avec des cas d'usage propres au métier.\n\nLes cinq prestations Axion-IA sont disponibles quel que soit votre secteur. Pour les activités qui manipulent des données sensibles — santé, juridique, finance —, les modèles open-source peuvent être déployés dans votre propre infrastructure ou sur une infrastructure dédiée hébergée dans l'Union européenne.",
      keyPoints: [
        "L'IA générative agit sur des tâches présentes dans tous les secteurs",
        "10 secteurs disposent d'une page dédiée sur le site",
        "8 formations sectorielles au catalogue, avec cas d'usage métier",
        "Les cinq prestations sont disponibles quel que soit le secteur",
        "Données sensibles : déploiement possible en local ou sur infrastructure UE dédiée",
      ],
      facts: [
        { figure: "10", label: "secteurs avec page dédiée" },
        { figure: "8", label: "formations sectorielles" },
        { figure: "5", label: "prestations, tous secteurs" },
      ],
      nuances: [
        {
          title: "Ce n'est pas réservé à la tech",
          detail:
            "Les pages secteur couvrent aussi bien l'artisanat, le BTP ou la restauration que le juridique et la finance. Le critère n'est pas la maturité technique de l'entreprise, mais le volume de tâches répétitives à traiter.",
        },
        {
          title: "Un secteur n'est pas un cas d'usage",
          detail:
            "Deux entreprises du même secteur n'ont pas les mêmes priorités. Les cas travaillés sont toujours les vôtres, pris dans vos dossiers réels.",
        },
        {
          title: "Les secteurs régulés demandent un cadrage en plus",
          detail:
            "Santé, juridique ou finance imposent des exigences de confidentialité fortes. Elles se traitent par le choix du modèle et du mode d'hébergement, à cadrer dès le devis.",
        },
      ],
    },
    en: {
      question: "Which sectors are affected by generative AI?",
      answer:
        "All economic sectors are affected. Axion-IA works in particular in: consulting and professional services (legal, accounting, HR), industry (production, maintenance, quality), healthcare (documentation, analysis), retail (e-commerce, customer relations), construction (quotes, reporting) and education.",
    },
  },
  {
    id: "choisir-cabinet-ia",
    reviewedAt: "2026-08-12",
    related: ["deroule-mission-axion", "tarifs-publics-transparents", "audit-ia-definition"],
    fr: {
      question: "Comment choisir un cabinet IA ?",
      answer:
        "Quatre critères suffisent à trancher. Premièrement, le cabinet intervient-il sur site, avec vos données réelles et vos vrais dossiers, ou se contente-t-il de slides ? Deuxièmement, livre-t-il un ROI chiffré et mesurable, ou des promesses qualitatives ? Troisièmement, maîtrise-t-il plusieurs modèles — ChatGPT, Claude, Gemini, et des modèles ouverts comme Llama ou Mistral déployables chez vous — ou n'est-il que le revendeur d'un seul outil ? Quatrièmement, prévoit-il un accompagnement après le déploiement, une fois l'effet nouveauté passé ?\n\nAxion-IA répond positivement aux quatre. Trois vérifications supplémentaires font la différence à l'usage. Demandez qui interviendra réellement : chez Axion-IA les intervenants sont tous seniors, et le même expert vous suit du cadrage à la livraison. Demandez les tarifs : ils sont publics, et le devis détaillé arrive sous 48 heures ouvrées. Demandez enfin ce qui reste chez vous à la fin — le rapport, les prompts testés et les méthodes doivent vous appartenir. La couverture est nationale : 13 régions et 5 DROM, sur site ou à distance.",
      keyPoints: [
        "Sur site avec vos données réelles, pas une démonstration générique",
        "Un ROI chiffré et mesurable, pas des promesses qualitatives",
        "Plusieurs modèles maîtrisés — pas le revendeur d'un seul outil",
        "Un accompagnement prévu après le déploiement",
        "Des tarifs publics et un devis détaillé sous 48 h ouvrées",
      ],
      facts: [
        { figure: "4", label: "critères de sélection" },
        { figure: "48 h", label: "pour le devis détaillé" },
        { figure: "13 + 5", label: "régions et DROM couverts" },
      ],
      nuances: [
        {
          title: "Ce n'est pas une question de taille de cabinet",
          detail:
            "Un grand nom ne garantit pas que la personne présente le jour J connaisse votre métier. Demandez qui intervient vraiment, et si c'est la même personne du cadrage à la livraison.",
        },
        {
          title: "Un revendeur d'outil n'est pas un cabinet IA",
          detail:
            "Beaucoup d'acteurs sont adossés à une seule plateforme et recommandent ce qu'ils vendent. La bonne question : quels modèles avez-vous écartés pour mon cas, et pourquoi ?",
        },
        {
          title: "Un devis n'est pas un diagnostic",
          detail:
            "Le chiffrage d'une implémentation n'a de sens qu'après cartographie des processus. Un budget annoncé avant tout diagnostic mérite une explication.",
        },
      ],
    },
    en: {
      question: "How do you choose an AI consultancy?",
      answer:
        "4 key criteria: (1) does the consultancy work on site with your real data (not just slides)? (2) does it deliver a costed, measurable ROI? (3) does it master multiple AI models (not a reseller of a single tool)? (4) does it offer post-deployment support? Axion-IA meets all 4 criteria.",
    },
  },
  {
    id: "ia-on-premise",
    reviewedAt: "2026-08-12",
    related: ["securite-donnees-ia", "ia-souveraine-europe", "confidentialite-projet-ia"],
    fr: {
      question: "Peut-on faire de l'IA sans envoyer ses données dans le cloud ?",
      answer:
        "Oui. Trois niveaux de confinement existent, et le bon dépend de la sensibilité de vos données. Par défaut, tout est hébergé dans l'Union européenne (Hetzner, Francfort), sous RGPD, sans transfert hors UE non encadré contractuellement.\n\nPour les sujets plus sensibles — données de santé, dossiers clients confidentiels, R&D, RH — on passe sur une infrastructure dédiée, ou carrément sur du on-premise : des modèles open-source comme Llama ou Mistral tournent alors dans votre propre infrastructure, et aucune donnée ne sort de chez vous. La contrepartie est réelle : il faut du matériel, et les modèles ouverts restent en retrait des meilleurs modèles propriétaires sur certaines tâches.\n\nC'est pourquoi on ne tranche pas à l'aveugle. L'architecture est choisie en fonction de vos données, pas d'une posture, et les choix techniques sont justifiés par écrit dans le devis avant toute signature. Un accord de confidentialité est signé avant l'intervention, et les échantillons utilisés pour les démonstrations sont systématiquement anonymisés.",
      keyPoints: [
        "Hébergement dans l'UE par défaut (Hetzner, Francfort), conforme RGPD",
        "Infrastructure dédiée ou déploiement on-premise pour les données sensibles",
        "Modèles open-source Llama et Mistral hébergés dans votre propre infrastructure",
        "Choix techniques justifiés par écrit dans le devis, avant signature",
        "Accord de confidentialité signé avant l'intervention, échantillons anonymisés",
      ],
      facts: [
        { figure: "3", label: "niveaux de confinement" },
        { figure: "UE", label: "hébergement par défaut" },
        { figure: "2", label: "modèles ouverts déployables chez vous" },
        { figure: "0", label: "transfert hors UE non encadré" },
      ],
      nuances: [
        {
          title: "On-premise et hébergement UE ne sont pas la même chose",
          detail:
            "L'hébergement dans l'Union européenne est le réglage par défaut ; l'on-premise va plus loin, avec les modèles installés sur vos propres serveurs. Les deux répondent au RGPD, mais pas au même niveau d'exigence.",
        },
        {
          title: "Ce n'est pas sans contrepartie technique",
          detail:
            "Les modèles ouverts hébergés chez vous demandent du matériel et restent en retrait des meilleurs modèles propriétaires sur certaines tâches. On mesure l'écart sur vos cas réels avant de trancher.",
        },
        {
          title: "Ce n'est pas réservé aux grands comptes",
          detail:
            "Le critère n'est pas votre taille mais la sensibilité de vos données. Un cabinet de quelques personnes qui manipule des dossiers médicaux ou juridiques est concerné avant une PME industrielle.",
        },
      ],
    },
    en: {
      question: "Can you use AI without sending your data to the cloud?",
      answer:
        "Yes. Axion-IA masters the deployment of AI models locally (on-premise) or on dedicated EU-hosted infrastructure. For sensitive cases (medical data, confidential customer data), open-source models (Llama, Mistral) can be hosted in your own infrastructure.",
    },
  },
  {
    id: "ia-vs-automatisation",
    reviewedAt: "2026-08-12",
    related: ["automatiser-taches-ia", "automatisation-ia-workflow-metier", "no-code-position"],
    fr: {
      question: "Quelle est la différence entre l'IA et l'automatisation traditionnelle ?",
      answer:
        "La différence tient en un mot : l'automatisation traditionnelle applique des règles, l'IA générative interprète. Un script ou un robot RPA exécute une suite d'instructions écrites à l'avance ; si le cas ne rentre pas dans la règle, il s'arrête ou se trompe. Un modèle d'IA générative comprend une consigne en langage naturel, s'accommode des variations et produit du texte, une synthèse ou une analyse.\n\nLes deux n'ont donc pas le même terrain. Pour un flux structuré, régulier et sans ambiguïté — recopier des lignes d'un fichier vers un logiciel, déclencher une relance à date fixe — l'automatisation classique reste plus rapide, moins coûteuse et parfaitement prévisible. Dès qu'il faut lire un document mal formaté, trier des demandes clients rédigées à la main ou écrire une réponse, c'est l'IA qui prend le relais.\n\nEn pratique, les chaînes qui tiennent dans la durée combinent les deux : des règles pour le squelette du processus, un modèle d'IA aux endroits précis où il faut comprendre. Axion-IA choisit la brique adaptée à chaque étape plutôt que de tout confier à l'IA parce que c'est le mot du moment.",
      keyPoints: [
        "L'automatisation applique des règles ; l'IA interprète une consigne",
        "RPA et scripts : rapides, prévisibles, imbattables sur les flux structurés",
        "IA : documents mal formatés, langage libre, rédaction, analyse",
        "Une règle qui sort de son cadre s'arrête ; l'IA, elle, s'adapte",
        "Les chaînes efficaces combinent les deux, étape par étape",
      ],
      nuances: [
        {
          title: "L'IA ne remplace pas l'automatisation",
          detail:
            "Confier à un modèle une tâche que trois lignes de code exécutent parfaitement, c'est payer plus cher pour un résultat moins prévisible.",
        },
        {
          title: "Ce n'est pas une question de modernité",
          detail:
            "Le RPA n'est pas dépassé. Il reste le bon outil chaque fois que le processus est stable, répétitif et sans exception à gérer.",
        },
        {
          title: "L'IA n'est pas déterministe",
          detail:
            "Deux exécutions d'une même consigne peuvent donner deux formulations différentes. Sur un flux comptable, c'est un défaut ; sur une rédaction commerciale, c'est une qualité.",
        },
      ],
    },
    en: {
      question: "What is the difference between AI and traditional automation?",
      answer:
        "Traditional automation (RPA, scripts) follows strict predefined rules and doesn't handle exceptions. Generative AI understands natural language, adapts to variations and generates content or analyses. Axion-IA uses both depending on the case: RPA for structured flows, AI for tasks requiring understanding and generation.",
    },
  },
  {
    id: "presentiel-distance",
    reviewedAt: "2026-08-12",
    related: ["geo-distance-international", "geo-france", "formation-ia-entreprise"],
    fr: {
      question: "Axion-IA intervient-il à distance ou sur site ?",
      answer:
        "Les deux, au choix, et avec le même programme. Le format par défaut est le présentiel en intra, dans vos locaux : c'est celui qui permet de travailler directement sur vos outils, vos documents et vos données, et de capter les vraies questions au moment où elles se posent. Le distanciel est possible sur l'ensemble du catalogue, avec le même contenu et le même niveau d'interactivité.\n\nIl s'impose surtout quand l'équipe est répartie sur plusieurs sites, quand les déplacements pèseraient plus lourd que la session elle-même, ou pour une session de suivi après un premier passage sur place. Un format hybride est également possible : une journée dans vos locaux pour lancer la dynamique, puis le suivi à distance.\n\nDans les deux cas, le matériel demandé est le même — un ordinateur portable et une connexion internet — et les accès aux outils sont préparés avec vous en amont si besoin. Le format ne change pas le prix : il est fixé par groupe et par formation, pas par personne, et il n'y a pas de surcoût géographique en France métropolitaine.",
      keyPoints: [
        "Présentiel en intra par défaut, distanciel possible sur tout le catalogue",
        "Même programme, même durée, même niveau d'interactivité dans les deux cas",
        "Le distanciel convient aux équipes multi-sites et aux sessions de suivi",
        "Format hybride possible : une journée sur place, puis le suivi à distance",
        "Prix fixé par groupe, sans surcoût géographique en France métropolitaine",
      ],
      facts: [
        { figure: "2", label: "formats : sur site ou à distance" },
        { figure: "2-15", label: "participants par groupe" },
        { figure: "13", label: "régions métropolitaines couvertes" },
        { figure: "0", label: "surcoût géographique" },
      ],
      nuances: [
        {
          title: "Le distanciel n'est pas un webinaire",
          detail:
            "Le groupe reste restreint, chacun pratique sur son poste et le formateur passe d'un participant à l'autre. Ce n'est pas une diffusion que l'on suit en spectateur.",
        },
        {
          title: "Le présentiel n'est pas réservé aux grandes villes",
          detail:
            "Les 13 régions métropolitaines, Corse comprise, et les 5 DROM sont couverts, sans surcoût géographique sur le tarif de la formation en métropole.",
        },
        {
          title: "Le format ne fait pas varier le prix",
          detail:
            "Le tarif dépend de la formation choisie et de sa durée, pas du lieu ni du nombre de participants : il est fixé par groupe de 2 à 15 personnes.",
        },
      ],
    },
    en: {
      question: "Does Axion-IA work remotely or on site?",
      answer:
        "Both. The preferred format is on site (France and internationally) as it allows working directly on your tools and data. Remote sessions are possible via videoconference for geographically dispersed teams or follow-up training.",
    },
  },
  {
    id: "heures-semaine-pme",
    reviewedAt: "2026-08-12",
    related: ["pme-ia", "roi-mesurer", "ia-remplace-salaries"],
    fr: {
      question: "Combien d'heures par semaine l'IA peut-elle libérer dans une PME ?",
      answer:
        "Entre 5 et 15 heures par collaborateur et par semaine : c'est la moyenne qu'Axion-IA observe après une formation et un déploiement IA. Ramené à la journée, cela représente 1 à 3 heures gagnées, visibles dès la première semaine.\n\nL'écart entre 5 et 15 heures s'explique par le poste occupé. Un commercial récupère du temps sur les propositions et les devis ; les RH sur les offres d'emploi et les comptes-rendus ; la comptabilité sur les rapports et les relances ; la direction sur les synthèses et les analyses. Plus un poste comporte d'écrit et de recherche d'informations, plus le gain est élevé — jusqu'à −70 % du temps de rédaction et une veille 5× plus rapide.\n\nCe gain n'est pas automatique : il vient de la prise en main sur des cas réels, pas de l'abonnement à un outil. C'est la raison pour laquelle les journées se déroulent sur vos propres dossiers.",
      keyPoints: [
        "5 à 15 heures par collaborateur et par semaine, en moyenne observée",
        "Soit 1 à 3 heures par jour, dès la première semaine",
        "L'écart s'explique par le poste : plus d'écrit, plus de gain",
        "Commercial, RH, comptabilité, direction : les gains ne portent pas sur les mêmes tâches",
        "Le gain vient de la prise en main sur des cas réels, pas de l'outil seul",
      ],
      facts: [
        { figure: "5-15 h", label: "libérées par semaine" },
        { figure: "1-3 h", label: "gagnées par jour" },
        { figure: "−70 %", label: "sur la rédaction" },
        { figure: "5×", label: "sur la veille" },
      ],
      nuances: [
        {
          title: "Ce n'est pas une garantie",
          detail:
            "C'est une moyenne observée, pas un engagement contractuel. Le gain réel dépend du poste, des outils déjà en place et de l'usage effectif après la journée.",
        },
        {
          title: "Le temps libéré n'est pas du temps supprimé",
          detail:
            "Ces heures se reportent sur des missions à plus forte valeur ajoutée. C'est un levier de productivité, pas une mesure d'effectif.",
        },
        {
          title: "Toutes les tâches ne comptent pas pareil",
          detail:
            "Le gain se concentre sur l'écrit, la recherche et la synthèse. Une journée passée en clientèle ou en atelier bouge peu.",
        },
      ],
    },
    en: {
      question: "How many hours per week can AI free up in an SME?",
      answer:
        "Axion-IA observes an average of 5 to 15 hours freed per employee per week after AI training and deployment. Gains vary by role: sales (proposals, quotes), HR (job ads, meeting notes), accounting (reports, reminders) and management (summaries, analyses).",
    },
  },
  {
    id: "tpe-ia",
    reviewedAt: "2026-08-12",
    related: ["audit-ia-tpe-pme", "comment-commencer", "budget-demarrer-ia"],
    fr: {
      question: "L'implémentation IA est-elle adaptée aux TPE ?",
      answer:
        "Oui, et c'est souvent plus simple qu'en grande entreprise : moins de couches de validation, un dirigeant qui décide vite, des processus qu'on tient encore en tête. Le seul vrai prérequis, c'est d'avoir une tâche répétitive ou un agacement quotidien à traiter.\n\nTrois formats servent de porte d'entrée. La formation collective, sur une journée sur site, fait monter l'équipe en compétence sur ses propres cas. L'audit sur place cartographie l'entreprise en une journée et priorise ce qui rapporte le plus vite. Le Pilote IA, lui, teste l'IA sur un seul processus ciblé et prouve la valeur avant tout déploiement large.\n\nAucune compétence technique n'est requise pour démarrer, et il n'y a ni équipe data ni culture IA préalable à constituer : on part de vos outils actuels et de vos vraies tâches. Chaque prestation est chiffrée en forfait fixe, avec un devis ferme envoyé sous 48 heures ouvrées — pas de régie, pas de dépassement.",
      keyPoints: [
        "Trois portes d'entrée : formation collective, audit sur place, Pilote IA",
        "Le Pilote IA teste un seul processus avant tout déploiement large",
        "Aucune compétence technique ni équipe data requise pour démarrer",
        "L'audit sur place cartographie l'entreprise en une journée",
        "Forfait fixe, devis ferme sous 48 h ouvrées",
      ],
      facts: [
        { figure: "3", label: "formats d'entrée" },
        { figure: "1 j", label: "pour l'audit sur place" },
        { figure: "1", label: "processus ciblé au pilote" },
        { figure: "48 h", label: "ouvrées pour le devis" },
      ],
      nuances: [
        {
          title: "Ce n'est pas réservé aux entreprises structurées",
          detail:
            "On couvre l'artisan qui veut fluidifier ses devis et son suivi client comme le grand groupe. Le critère n'est pas la taille, mais l'existence d'une tâche répétitive à absorber.",
        },
        {
          title: "Le budget d'entrée est public",
          detail:
            "Les prix sont affichés : {{price:audit-flash|from}} pour l'audit sur place, {{price:impl-poc|from}} pour le Pilote IA. Chaque mission fait ensuite l'objet d'un devis ferme en forfait fixe.",
        },
        {
          title: "Un pilote n'est pas un déploiement",
          detail:
            "Le Pilote IA porte sur un processus ciblé, pour prouver la valeur vite et à moindre risque. L'extension aux autres processus se décide après, au vu des résultats mesurés.",
        },
      ],
    },
    en: {
      question: "Is AI implementation suitable for small businesses?",
      answer:
        "Yes. Axion-IA offers a range accessible to small businesses: the group training (one day on site) and on-site audit are the entry-level formats. The implementation POC allows testing AI on a targeted process before any large-scale deployment.",
    },
  },
  {
    id: "confidentialite-projet-ia",
    reviewedAt: "2026-08-12",
    related: ["securite-donnees-ia", "rgpd-ia", "ia-souveraine-europe"],
    fr: {
      question: "Comment garantir la confidentialité des données lors d'un projet IA ?",
      answer:
        "Par un cadre posé avant la première ligne de code, pas après. Un engagement de confidentialité contractuel précède toute intervention : il couvre les informations non publiques échangées et vaut pendant toute la mission et les trois ans qui suivent.\n\nEn pratique, trois règles tiennent l'essentiel. Les démonstrations se font sur des échantillons anonymisés, jamais sur des dossiers nominatifs. Vos données ne quittent pas votre infrastructure sans accord explicite. Et l'hébergement des solutions déployées est européen par défaut (Hetzner, Francfort), avec la possibilité d'une stack open-source auto-hébergée chez vous quand la sensibilité l'exige.\n\nQuand Axion-IA traite des données personnelles pour votre compte, un accord de sous-traitance conforme à l'article 28 du RGPD encadre l'objet, la durée, les mesures de sécurité et le sort des données. En fin de mission, vos données et configurations vous sont restituées dans un format exploitable, et les copies de travail sont supprimées.",
      keyPoints: [
        "Engagement de confidentialité signé avant l'intervention, valable 3 ans après",
        "Démonstrations sur échantillons anonymisés, jamais sur dossiers nominatifs",
        "Aucune sortie de données hors de votre infrastructure sans accord explicite",
        "Accord de sous-traitance RGPD dès qu'il y a des données personnelles",
        "Restitution en format exploitable et suppression des copies de travail",
      ],
      facts: [
        { figure: "3 ans", label: "de confidentialité après la mission" },
        { figure: "art. 28", label: "le cadre RGPD de sous-traitance" },
        { figure: "UE", label: "hébergement par défaut" },
      ],
      steps: [
        {
          title: "Cadrer avant de commencer",
          detail:
            "L'engagement de confidentialité est signé avant l'intervention, et le périmètre des données accessibles est écrit noir sur blanc plutôt que supposé.",
        },
        {
          title: "Travailler sur des échantillons anonymisés",
          detail:
            "Les démonstrations et les tests portent sur des données anonymisées. Les dossiers nominatifs restent chez vous, dans vos outils.",
        },
        {
          title: "Arbitrer l'hébergement au cadrage technique",
          detail:
            "Service hébergé en Union européenne ou stack open-source installée chez vous : le choix se fait selon la sensibilité réelle du cas, avant le développement.",
        },
        {
          title: "Restituer puis supprimer",
          detail:
            "En fin de prestation, vos données et configurations sont restituées dans un format exploitable et les copies de travail sont supprimées, sous réserve des obligations légales de conservation.",
        },
      ],
      nuances: [
        {
          title: "Ce n'est pas un simple paragraphe de devis",
          detail:
            "L'engagement de confidentialité est contractuel, et il se double d'un accord de sous-traitance dès que des données personnelles sont traitées pour votre compte.",
        },
        {
          title: "Anonymiser n'est pas appauvrir",
          detail:
            "Les démonstrations portent sur vos vrais formats de documents : seules les données identifiantes sont retirées, le cas d'usage reste réaliste.",
        },
        {
          title: "Aucune garantie absolue ne s'achète",
          detail:
            "Axion-IA s'engage sur des moyens documentés et vérifiables. L'analyse de risque propre à votre activité relève de vous et de votre conseil.",
        },
      ],
    },
    en: {
      question: "How do you guarantee data confidentiality in an AI project?",
      answer:
        "Axion-IA signs a contractual confidentiality agreement before any engagement. Client data never leaves your infrastructure without explicit consent. Samples used for demos are systematically anonymised. Models and data hosted exclusively in the EU (Hetzner Frankfurt).",
    },
  },
  {
    id: "accompagnement-post-implementation",
    reviewedAt: "2026-08-12",
    related: [
      "delai-implementation",
      "implementation-ia-sur-mesure",
      "integration-ia-entreprise-concrete",
    ],
    fr: {
      question: "Axion-IA propose-t-il un accompagnement après l'implémentation ?",
      answer:
        "Oui, et il commence sans rien demander : 30 jours de support correctif accompagnent toute implémentation, à compter de la mise en production. Pendant ce mois, les ajustements et les corrections sont pris en charge, et si une fonctionnalité livrée ne correspond pas au cahier des charges signé, elle est corrigée sans surcoût.\n\nAu-delà, rien n'est imposé. Vous pouvez ne rien prendre : le code, les workflows et la documentation vous sont livrés, tout continue de tourner sans nous. Ceux qui préfèrent un filet souscrivent un contrat de maintenance optionnel, un forfait mensuel de 4 heures couvrant corrections, montées de version et optimisations continues. Un besoin nouveau, lui, est chiffré comme une mission complémentaire — pas absorbé dans un abonnement flou.\n\nLe troisième volet est humain : des sessions de suivi forment les nouvelles recrues ou couvrent les fonctionnalités ajoutées depuis la livraison. C'est souvent ce qui fait la différence entre un outil utilisé tous les jours et un outil oublié six mois plus tard.",
      keyPoints: [
        "30 jours de support correctif inclus dans toute implémentation",
        "Aucune maintenance mensuelle imposée : le code et la documentation sont à vous",
        "Contrat de maintenance optionnel, forfait de 4 h par mois",
        "Un écart au cahier des charges signé est corrigé sans surcoût",
        "Sessions de suivi pour les nouvelles recrues et les nouvelles fonctionnalités",
      ],
      facts: [
        { figure: "30 j", label: "de support inclus" },
        { figure: "4 h", label: "par mois en maintenance" },
        { figure: "0", label: "abonnement obligatoire" },
      ],
      nuances: [
        {
          title: "Ce n'est pas un abonnement déguisé",
          detail:
            "Le contrat de maintenance est optionnel et se souscrit après les 30 jours inclus. Si vous ne le prenez pas, rien ne s'arrête : la solution vous appartient et continue de fonctionner.",
        },
        {
          title: "Ce n'est pas de la maintenance d'infrastructure",
          detail:
            "Le forfait couvre les corrections, les montées de version et les optimisations de ce qui a été livré. L'hébergement et les abonnements aux modèles restent à votre nom.",
        },
        {
          title: "Une évolution n'est pas une correction",
          detail:
            "Une nouvelle automatisation ou un périmètre élargi fait l'objet d'un devis complémentaire, en forfait fixe comme le projet initial. Vous savez ce que vous payez avant de lancer.",
        },
      ],
    },
    en: {
      question: "Does Axion-IA offer support after implementation?",
      answer:
        "Yes. 30 days of corrective support are included in every implementation project. Beyond that, an optional monthly maintenance contract is available for corrections, version upgrades and continuous optimisation. Axion-IA also offers follow-up training sessions for new hires or new AI features.",
    },
  },
  {
    id: "cout-projet-ia-pme",
    reviewedAt: "2026-08-12",
    related: ["tarifs-publics-transparents", "budget-demarrer-ia", "cout-audit-ia-entreprise"],
    fr: {
      question: "Combien coûte un projet IA pour une PME ?",
      answer:
        "Cela dépend du format, et les prix d'entrée sont publics. Une journée de coaching 1-to-1 avec un collaborateur : {{price:intervention-membre-equipe|flat}} ; la même journée avec le dirigeant : {{price:intervention-dirigeants|flat}}. Une journée collective en intra, pour un groupe de 2 à 15 participants : {{price:intervention-essentielle|flat}} — un prix par groupe, jamais par personne. L'audit IA d'une journée sur site, calibré pour une TPE : {{price:audit-flash|from}} ; les niveaux ciblé et stratégique : {{price:audit-cible|range}}.\n\nL'implémentation se chiffre au périmètre. Le pilote, concentré sur un seul cas d'usage prioritaire, est annoncé en fourchette publique : {{price:impl-poc|full}} ; les déploiements multi-cas en PME ou en ETI passent par un devis détaillé, parce que le nombre d'intégrations et de connexions à vos outils change tout. Dans tous les cas, le principe est le même : un devis fixe sous 48 h ouvrées, un périmètre écrit avant de commencer, et le montant validé qui devient celui de la facture. Une PME démarre presque toujours par une seule journée, pas par un programme.",
      keyPoints: [
        "Cinq prestations, chacune avec un prix d'entrée public",
        "Formats collectifs facturés par groupe de 2 à 15 participants, jamais par personne",
        "Coaching 1-to-1 et audit sur site : le ticket d'entrée d'une PME",
        "Implémentation chiffrée au périmètre, après cadrage écrit",
        "Devis fixe sous 48 h ouvrées, montant validé avant démarrage",
      ],
      facts: [
        { figure: "5", label: "prestations au catalogue" },
        { figure: "2-15", label: "participants par groupe" },
        { figure: "1 j", label: "pour l'audit sur site" },
        { figure: "48 h", label: "ouvrées pour le devis" },
      ],
      nuances: [
        {
          title: "Ce n'est pas un prix par personne",
          detail:
            "Les journées collectives se facturent au groupe : le coût par participant baisse mécaniquement quand l'effectif monte, dans la limite du format retenu.",
        },
        {
          title: "« Sur devis » n'est pas un prix caché",
          detail:
            "Les formats dont le périmètre varie vraiment — déploiement multi-cas, plateforme sur mesure — sont chiffrés après cadrage plutôt qu'annoncés derrière une fourchette qui ne voudrait rien dire.",
        },
        {
          title: "Le coût du projet n'est pas seulement le devis",
          detail:
            "Comptez aussi le temps de vos équipes, les abonnements aux outils IA retenus et, éventuellement, la maintenance après la période de support incluse. Tout cela s'anticipe au cadrage.",
        },
      ],
    },
    en: {
      question: "How much does an AI project cost for an SME?",
      answer:
        "Axion-IA pricing starts from a few hundred euros for training (half-day) and several thousand euros for a full audit or implementation. Each project has a fixed quote with no surprises. See the pricing page or request a free quote.",
    },
  },
  {
    id: "rgpd-ia",
    reviewedAt: "2026-08-12",
    related: ["ai-act-2026", "securite-donnees-ia", "confidentialite-projet-ia"],
    fr: {
      question: "Qu'est-ce que le RGPD implique pour les projets IA ?",
      answer:
        "Le RGPD ne crée pas de régime spécial pour l'IA : il applique aux projets IA les mêmes obligations qu'à tout traitement de données personnelles. Cinq points reviennent systématiquement — une base légale pour chaque traitement, l'information des personnes concernées, le respect de leurs droits (accès, rectification, effacement), des durées de conservation définies, et des mesures de sécurité proportionnées au risque.\n\nDeux réflexes propres à l'IA s'y ajoutent. D'abord, savoir où partent les données : un assistant en ligne est un traitement comme un autre, avec un hébergeur, un sous-traitant et parfois un transfert hors UE à encadrer. Ensuite, ne pas confondre RGPD et AI Act : le second ajoute ses propres obligations, notamment l'information du public sur les contenus générés par IA (article 50).\n\nAxion-IA intègre ces exigences dans ses implémentations et conclut, le cas échéant, un accord de sous-traitance au titre de l'article 28. La qualification de vos traitements, elle, relève de votre responsable de traitement et se valide avec votre conseil. La CNIL reste l'autorité de contrôle compétente.",
      keyPoints: [
        "Mêmes obligations que pour tout traitement : pas de régime spécial IA",
        "Base légale, information, droits, durées de conservation, sécurité",
        "Un assistant en ligne est un traitement : hébergeur et transferts à encadrer",
        "RGPD et AI Act sont deux textes distincts, à traiter en parallèle",
        "Accord de sous-traitance RGPD quand Axion-IA traite pour votre compte",
      ],
      facts: [
        { figure: "5", label: "obligations de base" },
        { figure: "art. 28", label: "le contrat de sous-traitance" },
        { figure: "art. 50", label: "transparence AI Act" },
        { figure: "CNIL", label: "autorité de contrôle" },
      ],
      nuances: [
        {
          title: "Le RGPD n'interdit pas l'IA",
          detail:
            "Il encadre la donnée personnelle, pas la technologie. Beaucoup d'usages courants — synthèse de documents internes, rédaction, veille — n'en manipulent quasiment pas.",
        },
        {
          title: "RGPD et AI Act ne se recouvrent pas",
          detail:
            "L'un protège les personnes sur leurs données, l'autre encadre les systèmes d'IA eux-mêmes. Les deux se traitent en parallèle, pas l'un à la place de l'autre.",
        },
        {
          title: "Cette page n'est pas un avis juridique",
          detail:
            "Elle décrit un cadre général. La conformité de vos traitements s'apprécie cas par cas, avec votre responsable de traitement et votre conseil.",
        },
      ],
    },
    en: {
      question: "What does GDPR imply for AI projects?",
      answer:
        "GDPR imposes several obligations for AI projects: legal basis for any personal data processing, information to data subjects, right to erasure, defined retention periods and appropriate security measures. Axion-IA integrates GDPR compliance into its implementations and can recommend a DPO if needed.",
    },
  },
  {
    id: "formation-ia-difference",
    reviewedAt: "2026-08-12",
    related: ["formation-ia-entreprise", "competences-techniques", "equipes-operationnelles"],
    fr: {
      question:
        "Quelle est la différence entre une formation IA générale et l'intervention Axion-IA ?",
      answer:
        "La différence tient en un mot : la matière travaillée. Une formation IA générale illustre les outils sur des exemples fabriqués pour la salle. Chez Axion-IA, la matière première, ce sont vos propres tâches : les participants arrivent avec de vrais dossiers, de vrais courriers, de vrais comptes rendus, et repartent avec ce qu'ils ont produit dessus.\n\nTrois choix de conception en découlent. Les sessions sont en intra, en groupe de 2 à 15 personnes : pas de session inter-entreprises où l'on n'ose pas sortir ses dossiers. Le catalogue est découpé par métier — RH, marketing, commercial, finance, juridique, achats, relation client, production, IT — et par secteur d'activité, plutôt qu'en un tronc commun unique. Et chaque notion est démontrée en direct puis pratiquée immédiatement, au lieu d'être exposée puis illustrée.\n\nEnfin, on n'apprend pas un outil, on apprend à choisir : les trois assistants les plus utilisés en entreprise — ChatGPT, Claude et Gemini — sont pratiqués côte à côte, et le reste du paysage est situé en panorama pour que chacun sache à quoi sert quoi.",
      keyPoints: [
        "Les exercices portent sur vos vrais dossiers, pas sur des cas fabriqués",
        "Sessions en intra uniquement, en groupe de 2 à 15 personnes",
        "Catalogue découpé par métier et par secteur d'activité, pas un tronc commun unique",
        "Démonstration courte puis pratique immédiate, notion par notion",
        "ChatGPT, Claude et Gemini pratiqués côte à côte — on apprend à choisir",
      ],
      facts: [
        { figure: "2-15", label: "participants par groupe" },
        { figure: "3", label: "assistants pratiqués" },
        { figure: "4 h à 3 j", label: "durées au catalogue" },
        { figure: "10", label: "questions au quiz final" },
      ],
      nuances: [
        {
          title: "Ce n'est pas une session inter-entreprises",
          detail:
            "Chaque session est montée pour une seule entreprise. C'est ce qui permet de travailler sur des dossiers que personne ne sortirait devant des concurrents.",
        },
        {
          title: "Ce n'est pas un cours sur un outil",
          detail:
            "On ne fait pas le tour des menus d'un produit. On installe une méthode de formulation et de vérification, qui reste valable quand le modèle change.",
        },
        {
          title: "Sur mesure ne veut pas dire improvisé",
          detail:
            "Chaque formation a un programme écrit, des objectifs pédagogiques et une évaluation. Ce qui varie, ce sont les cas travaillés, pas la structure de la journée.",
        },
      ],
    },
    en: {
      question: "What is the difference between a generic AI training and an Axion-IA session?",
      answer:
        "Generic AI training presents tools theoretically. An Axion-IA session is 100% practical: the trainer works directly on your emails, documents, data and real processes. You leave with operational workflows for your specific case, not generic concepts.",
    },
  },
  {
    id: "site-web-augmente-ia",
    reviewedAt: "2026-08-12",
    related: [
      "creation-site-web-augmente-ia",
      "integration-ia-site-existant",
      "site-internet-intelligent-definition",
    ],
    fr: {
      question: "Qu'est-ce qu'un site web augmenté par l'IA ?",
      answer:
        "C'est un site qui ne se contente plus d'afficher des pages : il comprend, répond et agit. Concrètement, on y greffe des fonctions d'intelligence artificielle — recherche sémantique, chatbot métier ancré sur vos contenus, génération de contenu, recommandation de produits ou de services, analyse du comportement des visiteurs.\n\nLa différence avec un chatbot générique tient à l'ancrage. Vos pages, documents et fiches produit sont indexés dans une base vectorielle hébergée dans l'Union européenne ; l'assistant répond à partir de cette base et cite ses sources, 24 h/24. Il ne brode pas sur votre périmètre, parce qu'il n'a rien d'autre à lire que vous.\n\nDans la grande majorité des cas, aucune refonte n'est nécessaire : les briques se greffent sur l'existant via une API, un widget JavaScript ou un plugin, sans toucher au design ni à la structure — WordPress, Webflow, Shopify, Next.js et la plupart des stacks exposant une API. Comptez 2 à 3 semaines pour un chatbot ancré sur vos contenus, 1 à 2 semaines pour une recherche sémantique si le contenu est déjà structuré.",
      keyPoints: [
        "Recherche sémantique, chatbot ancré, génération de contenu, recommandation, analyse des visiteurs",
        "L'assistant répond à partir de vos seuls contenus et cite ses sources",
        "Base vectorielle hébergée dans l'UE, conforme RGPD",
        "Greffe sur l'existant via API, widget JavaScript ou plugin, sans refonte",
        "WordPress, Webflow, Shopify, Next.js et toute stack exposant une API",
      ],
      facts: [
        { figure: "2-3 sem", label: "pour un chatbot ancré" },
        { figure: "1-2 sem", label: "pour la recherche sémantique" },
        { figure: "24 h/24", label: "de disponibilité" },
        { figure: "0", label: "refonte nécessaire" },
      ],
      nuances: [
        {
          title: "Ce n'est pas une refonte de site",
          detail:
            "Dans la grande majorité des cas, le design et la structure ne bougent pas : on ajoute des briques par-dessus. La question de la refonte ne se pose que si la plateforme n'expose aucune API.",
        },
        {
          title: "Ce n'est pas un chatbot générique posé sur une page",
          detail:
            "L'assistant est indexé sur vos pages et vos documents, et répond en citant ses sources. Un widget branché sur un modèle générique, lui, se met à inventer dès qu'il sort de ce qu'il connaît.",
        },
        {
          title: "Ce n'est pas la même chose qu'une plateforme IA-native",
          detail:
            "Greffer l'IA sur un site existant va vite. Concevoir une plateforme où l'IA est présente dès l'architecture, c'est un autre chantier — 6 à 12 semaines — qu'on ne recommande que si l'existant est bloquant.",
        },
      ],
    },
    en: {
      question: "What is an AI-augmented website?",
      answer:
        "An AI-augmented website integrates artificial intelligence features directly into your interface: semantic search, custom business chatbot, automated content generation, product or service recommendations, and visitor behaviour analytics. Axion-IA designs and implements these AI layers on your existing site (WordPress, Next.js, Webflow…) without a complete rebuild.",
    },
  },
  {
    id: "coaching-1-to-1-dirigeant",
    reviewedAt: "2026-08-12",
    related: [
      "accompagnement-ia-individuel-dirigeant",
      "mentorat-ia-dirigeant",
      "coaching-ia-prise-en-main-outils",
    ],
    fr: {
      question: "À quoi sert le coaching 1-to-1 IA pour les dirigeants ?",
      answer:
        "À prendre de la hauteur sur l'IA sans y passer vos soirées. Le coaching 1-to-1 dirigeant est une journée de 7 à 8 heures en tête-à-tête avec un intervenant senior, préparée en amont sur votre secteur : {{price:intervention-dirigeants|flat}}. Elle ne porte pas sur l'entreprise entière mais sur vous — votre temps, vos décisions, votre charge personnelle. On déroule le panorama IA de votre secteur, préparé avant la journée, on hiérarchise 5 à 10 leviers par impact et par urgence, et on regarde ce que cela donne à trois ans.\n\nLes usages travaillés sont ceux de votre quotidien : préparation de réunions, lecture rapide de dossiers, rédaction stratégique, veille sectorielle automatisée. Sous 7 jours, vous recevez la note de cadrage stratégique — le panorama sourcé et vos leviers priorisés — qui devient une base de discussion utilisable telle quelle avec votre équipe de direction. La journée se tient sur site, à distance ou en hybride, partout en France métropolitaine et dans les DROM.",
      keyPoints: [
        "Une journée de 7 à 8 h en tête-à-tête, préparée en amont sur votre secteur",
        "Le périmètre, c'est vous : votre temps, vos décisions, votre charge",
        "Panorama IA sectoriel puis 5 à 10 leviers hiérarchisés par impact et urgence",
        "Note de cadrage stratégique remise sous 7 jours",
        "Sur site, à distance ou en hybride, partout en France",
      ],
      facts: [
        { figure: "7-8 h", label: "en tête-à-tête" },
        { figure: "5-10", label: "leviers hiérarchisés" },
        { figure: "7 j", label: "pour la note de cadrage" },
        { figure: "3 ans", label: "d'horizon travaillé" },
      ],
      steps: [
        {
          title: "Préparation en amont",
          detail:
            "Votre secteur, vos concurrents, vos contraintes. Le panorama IA est constitué avant la journée pour ne pas la passer à s'informer.",
        },
        {
          title: "Panorama et mise à niveau",
          detail:
            "Ce qui existe réellement dans votre métier, ce qui marche, ce qui relève encore de la démonstration. Sourcé, sans jargon et sans effet de mode.",
        },
        {
          title: "Hiérarchisation des leviers",
          detail:
            "5 à 10 leviers classés par impact et par urgence, avec l'effort associé. On travaille aussi vos usages personnels : réunions, dossiers, rédaction, veille.",
        },
        {
          title: "Note de cadrage sous 7 jours",
          detail:
            "Le panorama sourcé et vos leviers priorisés, sous une forme présentable à votre équipe de direction sans réécriture.",
        },
      ],
      nuances: [
        {
          title: "Ce n'est pas un audit d'entreprise",
          detail:
            "La journée porte sur le dirigeant et ses arbitrages. La cartographie chiffrée de toute l'entreprise, avec scoring des opportunités, c'est l'audit IA — une prestation distincte.",
        },
        {
          title: "Ce n'est pas une séance collective",
          detail:
            "Une seule personne, un seul intervenant. Pour embarquer un comité de direction ou une équipe, ce sont les journées collectives, en groupe de 2 à 15 participants.",
        },
        {
          title: "Le tarif dépend du profil accompagné",
          detail:
            "Journée avec le dirigeant : {{price:intervention-dirigeants|flat}}. La même journée avec un collaborateur, centrée sur son poste : {{price:intervention-membre-equipe|flat}}.",
        },
      ],
    },
    en: {
      question: "What is the 1-to-1 AI coaching for executives?",
      answer:
        "Axion-IA 1-to-1 coaching is individual support for CEOs, managing directors, HRDs or department heads. In 3 to 5 sessions, you learn to integrate AI into your own daily practice: meeting preparation, data analysis, strategic writing, automated sector monitoring. The goal: save 5 to 10 hours per week and make better decisions faster.",
    },
  },
  // ── Batch perfection FAQ 2026-05-31 — extension couverture intentions ──────────
  {
    id: "tarifs-publics-transparents",
    reviewedAt: "2026-08-12",
    related: ["facturation", "cout-projet-ia-pme", "budget-demarrer-ia"],
    fr: {
      question: "Les tarifs Axion-IA sont-ils publics et transparents ?",
      answer:
        "Oui, et ils sont consultables sans formulaire à remplir. La page tarifs affiche le prix d'entrée de chaque prestation : coaching 1-to-1 avec un collaborateur ({{price:intervention-membre-equipe|flat}}) ou avec le dirigeant ({{price:intervention-dirigeants|flat}}), journée collective pour 2 à 15 participants ({{price:intervention-essentielle|flat}}), audit IA sur site ({{price:audit-flash|from}}). Seuls les formats dont le périmètre varie réellement — implémentation large, plateforme web ou SaaS sur mesure — sont annoncés sur devis, faute de fourchette honnête à publier.\n\nLa raison est pratique autant qu'éthique : la transparence accélère le bon rapprochement. Si nos tarifs ne correspondent pas à votre budget, vous le savez en trente secondes plutôt qu'après trois rendez-vous. Tous les montants publiés sont hors taxes, la TVA s'ajoutant sur la facture, et les formats collectifs se lisent par groupe et non par personne. Pour une mission sur mesure, le devis détaillé arrive sous 48 h ouvrées après l'appel de cadrage : périmètre écrit, livrables, délais, prix ferme. Le montant validé avant démarrage est celui que vous réglez.",
      keyPoints: [
        "Prix d'entrée publiés pour chaque prestation, sans formulaire préalable",
        "Formats collectifs affichés par groupe de 2 à 15 participants",
        "« Sur devis » réservé aux périmètres réellement variables",
        "Devis détaillé sous 48 h ouvrées après l'appel de cadrage",
        "Montants hors taxes : la TVA s'ajoute sur la facture",
      ],
      facts: [
        { figure: "5", label: "prestations tarifées publiquement" },
        { figure: "2-15", label: "participants par groupe" },
        { figure: "48 h", label: "ouvrées pour le devis" },
        { figure: "30 j", label: "de validité du devis" },
      ],
      nuances: [
        {
          title: "Public ne veut pas dire uniforme",
          detail:
            "Le tarif dépend du profil accompagné et du format : une journée 1-to-1 avec un collaborateur et une journée avec le dirigeant n'ont ni le même contenu ni le même prix.",
        },
        {
          title: "Sur devis n'est pas un prix opaque",
          detail:
            "Un devis Axion-IA est détaillé et ferme : périmètre écrit, livrables, délais. Il vaut 30 jours et ne bouge pas en cours de mission.",
        },
        {
          title: "Les prix affichés sont hors taxes",
          detail:
            "Aucun montant publié n'inclut la TVA. Elle s'ajoute sur la facture selon le régime applicable : à intégrer au budget dès la comparaison des offres.",
        },
      ],
    },
    en: {
      question: "Is Axion-IA pricing public and transparent?",
      answer:
        "Yes. Axion-IA publishes public pricing, with no opaque quotes or hidden costs: each service (audit, session, implementation, coaching) has a clear entry price, and custom projects are quoted in detail before any commitment. You know exactly what you pay and why, with ROI estimated upfront.",
    },
  },
  {
    id: "aides-subventions-ia",
    reviewedAt: "2026-08-12",
    related: ["cout-projet-ia-pme", "facturation", "budget-demarrer-ia"],
    fr: {
      question: "Existe-t-il des aides ou subventions pour un projet IA ?",
      answer:
        "Des dispositifs publics existent, mais aucun n'est automatique et aucun n'est porté par Axion-IA. Selon votre taille, votre secteur et votre région, un projet de transformation numérique peut relever d'un programme national ou d'un dispositif régional ; les développements réellement innovants peuvent, eux, entrer dans le champ des crédits d'impôt recherche et innovation. Chacun de ces mécanismes a ses propres critères, révisés régulièrement : l'éligibilité se vérifie auprès de l'organisme qui accorde l'aide, et votre expert-comptable reste le mieux placé pour trancher le volet fiscal.\n\nCe que nous pouvons faire, c'est vous remettre un dossier propre : un périmètre écrit, un devis détaillé, des livrables datés et un chiffrage des gains attendus — exactement les pièces qu'un financeur réclame. En revanche, aucune prestation n'est vendue comme financée ou subventionnée : le devis est un montant net que vous engagez, et une éventuelle prise en charge se règle ensuite entre vous et l'organisme concerné. Si ce point conditionne votre décision, le plus simple est de l'aborder dès l'appel de cadrage, avant même le devis.",
      keyPoints: [
        "Des dispositifs nationaux, régionaux et fiscaux existent — aucun n'est automatique",
        "L'éligibilité dépend de votre taille, de votre secteur et de votre région",
        "Elle se vérifie auprès de l'organisme qui accorde l'aide, pas auprès du prestataire",
        "Axion-IA ne porte aucun dispositif et ne conditionne aucun devis à une prise en charge",
        "Périmètre écrit, devis détaillé et gains chiffrés : les pièces utiles à un dossier",
      ],
      facts: [
        { figure: "30 min", label: "d'appel de cadrage" },
        { figure: "48 h", label: "ouvrées pour le devis" },
        { figure: "30 j", label: "de validité du devis" },
      ],
      nuances: [
        {
          title: "Ce n'est pas une éligibilité garantie",
          detail:
            "Aucune règle générale ne s'applique : deux entreprises voisines, de taille ou de secteur différents, n'ont pas les mêmes droits. Toute réponse ferme vient de l'organisme, jamais d'un prestataire.",
        },
        {
          title: "Une aide ne change pas le prix",
          detail:
            "Le devis reste un montant net, dû dans les conditions prévues. Une prise en charge éventuelle intervient après coup, entre vous et l'organisme, sans effet rétroactif sur la facture.",
        },
        {
          title: "Ce n'est pas un conseil fiscal",
          detail:
            "Nous ne sommes ni financeur ni cabinet fiscal. Sur les crédits d'impôt comme sur les dispositifs régionaux, l'analyse revient à votre expert-comptable et à l'organisme instructeur.",
        },
      ],
    },
    en: {
      question: "Are there grants or subsidies for an AI project?",
      answer:
        "Depending on your project, some AI audits or diagnostics can be partially co-funded in France: the France Num programme and its diagnostics, regional digital-transformation grants, BPI schemes where applicable, and research/innovation tax credits (CIR/CII) for custom development. Eligibility depends on your size, sector and region; we point you to the relevant schemes during the audit.",
    },
  },
  {
    id: "budget-demarrer-ia",
    reviewedAt: "2026-08-12",
    related: ["cout-projet-ia-pme", "comment-commencer", "tarifs-publics-transparents"],
    fr: {
      question: "Quel budget prévoir pour démarrer l'IA dans mon entreprise ?",
      answer:
        "Le ticket d'entrée est celui d'une journée, pas celui d'un programme. Deux portes existent. La journée de coaching 1-to-1, sur le poste réel d'un collaborateur ({{price:intervention-membre-equipe|flat}}) ou avec le dirigeant ({{price:intervention-dirigeants|flat}}), qui allège tout de suite des tâches concrètes. Ou la journée d'audit sur site ({{price:audit-flash|from}}), qui cartographie l'entreprise et hiérarchise les opportunités avant d'investir. Pour faire monter une équipe entière, la journée collective réunit de 2 à 15 personnes : {{price:intervention-essentielle|flat}} pour le groupe.\n\nLa méthode compte plus que le montant : commencer petit sur un cas à fort impact, mesurer le temps réellement gagné, puis étendre. Un pilote d'implémentation sur un seul cas d'usage vient ensuite, en fourchette publique : {{price:impl-poc|full}}. Le déploiement multi-cas, lui, se chiffre au périmètre — et seulement une fois la valeur constatée. Prévoyez aussi le budget non financier : une journée bloquée sans réunion parallèle, un échantillon de données anonymisées, et quelqu'un en interne pour porter le sujet après notre départ.",
      keyPoints: [
        "Une journée suffit pour démarrer — coaching 1-to-1 ou audit sur site",
        "Journée collective facturée au groupe, de 2 à 15 participants",
        "Commencer petit, mesurer le temps gagné, puis étendre",
        "Le pilote d'implémentation ne vient qu'après la preuve de valeur",
        "Prévoir aussi du temps interne et un porteur du sujet",
      ],
      facts: [
        { figure: "1 j", label: "pour démarrer" },
        { figure: "2-15", label: "participants par groupe" },
        { figure: "7 j", label: "pour le livrable écrit" },
        { figure: "48 h", label: "ouvrées pour le devis" },
      ],
      steps: [
        {
          title: "Une première journée",
          detail:
            "Coaching 1-to-1 sur un poste, ou audit sur site pour cartographier l'entreprise. Dans les deux cas, on travaille sur vos vrais dossiers, pas sur un cas d'école.",
        },
        {
          title: "Mesurer, pas ressentir",
          detail:
            "Le livrable écrit arrive sous 7 jours avec un plan d'action chiffré. Les semaines suivantes servent à vérifier le temps réellement gagné sur les tâches visées.",
        },
        {
          title: "Un pilote sur un seul cas",
          detail:
            "On industrialise l'usage qui a le mieux tenu, sur un périmètre volontairement étroit. C'est le premier vrai investissement, et il reste réversible.",
        },
        {
          title: "Étendre si les chiffres suivent",
          detail:
            "Déploiement multi-cas, formation des équipes, intégrations : chiffré au périmètre, à la lumière des gains constatés et pas d'une promesse de départ.",
        },
      ],
      nuances: [
        {
          title: "Ce n'est pas un budget annuel à voter",
          detail:
            "Chaque prestation est un livrable autonome, sans engagement de durée. Vous pouvez vous arrêter après la première journée si la valeur n'y est pas.",
        },
        {
          title: "Le budget n'est pas seulement financier",
          detail:
            "Une journée réellement bloquée, des données d'exemple anonymisées et un porteur interne pèsent autant que le devis sur le résultat final.",
        },
        {
          title: "Démarrer n'est pas déployer",
          detail:
            "La première journée met des usages entre les mains d'une personne ou d'une équipe. Automatiser un processus complet relève de l'implémentation, avec son propre chiffrage.",
        },
      ],
    },
    en: {
      question: "What budget should I plan to get started with AI?",
      answer:
        "You can start without a big budget. A first AI audit or a targeted session is an investment of a few hundred to a few thousand euros, with ROI often reached within weeks (hours saved, tasks automated). A custom implementation (agents, automations, domain AI) is priced by scope. The right approach: start small on a high-impact case, prove ROI, then scale.",
    },
  },
  {
    id: "duree-audit-ia",
    reviewedAt: "2026-08-12",
    related: ["audit-ia-definition", "livrables-audit-ia", "audit-ia-tpe-pme"],
    fr: {
      question: "Combien de temps dure un audit IA ?",
      answer:
        "Cela dépend du niveau d'audit : d'une seule journée à neuf semaines. L'audit sur place, destiné aux TPE, tient en une journée complète dans vos locaux, de 9 h à 17 h ; le rapport de synthèse suit sous 48 heures ouvrées, au plus tard sous sept jours.\n\nLes niveaux supérieurs sont des missions. L'audit Ciblé, qui couvre un département, se déroule sur trois à quatre semaines — parfois deux pour un périmètre simple traité à distance. L'audit Stratégique PME couvre deux à quatre services sur cinq à six semaines, restitution en COMEX comprise. L'audit Stratégique ETI, transverse et multi-BU, demande neuf semaines et vingt à trente entretiens.\n\nLa vraie question n'est pas la durée de la mission mais votre charge interne, et elle reste faible : six à dix heures cumulées sur trois semaines pour un audit Ciblé, huit à quinze heures sur cinq à six semaines pour un Stratégique PME. Les entretiens sont planifiés au fil de l'eau, sans gel d'activité. Comptez enfin deux à trois semaines entre la signature et le démarrage, le temps de caler les disponibilités.",
      keyPoints: [
        "Audit sur place : 1 journée complète (9 h-17 h), rapport sous 48 h ouvrées",
        "Audit Ciblé : 3 à 4 semaines sur un département",
        "Stratégique PME : 5 à 6 semaines sur 2 à 4 services",
        "Stratégique ETI : 9 semaines et 20 à 30 entretiens",
        "Charge interne de 6 à 15 h cumulées selon le niveau, sans gel d'activité",
      ],
      facts: [
        { figure: "1 j", label: "pour l'audit sur place" },
        { figure: "3-4 sem.", label: "pour l'audit Ciblé" },
        { figure: "9 sem.", label: "pour l'audit ETI" },
        { figure: "6-15 h", label: "de charge interne" },
      ],
      steps: [
        {
          title: "Cadrage et entretiens",
          detail:
            "Cadrage du périmètre puis entretiens terrain : de trois entretiens pour un audit Ciblé à trente pour un ETI, plus la collecte documentaire.",
        },
        {
          title: "Cartographie et scoring",
          detail:
            "Cartographie des processus, benchmark des outils, scoring des opportunités IA par ROI estimé et complexité technique.",
        },
        {
          title: "Plan d'exécution et restitution",
          detail:
            "Remise du plan chiffré et atelier de restitution — en COMEX pour une PME, devant le comité exécutif et le board pour un audit ETI.",
        },
      ],
      nuances: [
        {
          title: "La durée n'est pas votre temps de travail",
          detail:
            "Une mission de six semaines ne mobilise que huit à quinze heures cumulées chez vous, entretiens compris. Les créneaux sont posés au fil de l'eau.",
        },
        {
          title: "Le délai de démarrage s'ajoute à la durée",
          detail:
            "Comptez deux à trois semaines entre la signature et le lancement des entretiens, le temps de caler les disponibilités des personnes à rencontrer.",
        },
        {
          title: "Une journée sur site n'est pas une version au rabais",
          detail:
            "L'audit sur place couvre toute l'activité d'une TPE. Ce n'est pas un extrait d'un audit plus long : c'est le format calibré pour une entreprise de 1 à 19 salariés.",
        },
      ],
    },
    en: {
      question: "How long does an AI audit take?",
      answer:
        "An Axion-IA audit usually runs from a few hours to a few days depending on company size. The on-site or remote phase (process mapping, use-case identification, ROI estimation) often lasts half a day to a day; the report and roadmap are delivered shortly after, within a few business days.",
    },
  },
  {
    id: "livrables-audit-ia",
    reviewedAt: "2026-08-12",
    related: ["audit-ia-definition", "duree-audit-ia", "audit-maturite-ia-entreprise"],
    fr: {
      question: "Que contient le rapport d'un audit IA ?",
      answer:
        "Le rapport d'audit IA Axion-IA contient cinq blocs : la cartographie de vos processus et de leurs points de friction ; une liste priorisée de cas d'usage IA concrets ; pour chacun, une estimation du ROI et du temps gagné ; les outils et l'architecture recommandés, cadrés RGPD et souveraineté ; enfin une feuille de route séquencée. C'est un document fait pour arbitrer, pas un rapport théorique.\n\nSon volume suit le niveau d'audit : 8 à 15 pages pour l'audit sur place d'une TPE, jusqu'à 60 à 80 pages board-ready pour un audit Stratégique ETI. S'y ajoutent des livrables annexes selon le format — la bibliothèque des prompts testés en direct pendant la journée sur site, 3 à 5 quick-wins priorisés, une roadmap stratégique 12-24 mois pour les PME, un cadre de gouvernance IA et 30 jours d'accompagnement post-audit pour les ETI.\n\nTout est remis avec une restitution orale, et tout vous appartient : le plan est écrit pour que vos équipes puissent l'exécuter seules si vous le décidez.",
      keyPoints: [
        "Cartographie des processus et des points de friction",
        "Cas d'usage priorisés, chacun avec ROI et temps gagné estimés",
        "Outils et architecture recommandés, cadrés RGPD et souveraineté",
        "Feuille de route séquencée : de 8-15 à 60-80 pages selon le niveau",
        "Annexes selon le format : prompts testés, quick-wins, roadmap, gouvernance",
      ],
      facts: [
        { figure: "5", label: "blocs dans le rapport" },
        { figure: "8-15 p.", label: "pour l'audit sur place" },
        { figure: "60-80 p.", label: "pour l'audit ETI" },
        { figure: "3-5", label: "quick-wins priorisés" },
      ],
      nuances: [
        {
          title: "Ce n'est pas un catalogue d'outils",
          detail:
            "La liste des outils vient après la cartographie, jamais avant. Une recommandation d'outil sans processus cartographié n'a aucune valeur d'arbitrage.",
        },
        {
          title: "Ce n'est pas réservé aux techniciens",
          detail:
            "Le rapport est écrit pour être lu par un dirigeant, un COMEX ou un conseil d'administration selon le niveau. Le détail technique reste en annexe.",
        },
        {
          title: "Ce n'est pas un rapport figé",
          detail:
            "Le plan distingue ce que vos équipes activent seules et ce qui demande un chantier dédié. C'est un document de travail, à reprendre à chaque arbitrage.",
        },
      ],
    },
    en: {
      question: "What does an AI audit report contain?",
      answer:
        "The Axion-IA audit report contains: a map of your processes and friction points, a prioritised list of concrete AI use cases, an ROI and time-saved estimate for each, recommended tools and architecture (with GDPR and sovereignty constraints), and a sequenced roadmap. It is an actionable document, not a theoretical report.",
    },
  },
  {
    id: "automatiser-taches-ia",
    reviewedAt: "2026-08-12",
    related: ["ia-vs-automatisation", "automatisation-ia-workflow-metier", "heures-semaine-pme"],
    fr: {
      question: "Quelles tâches peut-on automatiser avec l'IA en entreprise ?",
      answer:
        "Les tâches répétitives et prévisibles, celles qui prennent du temps sans en créer. En pratique : tri et réponse aux e-mails, rédaction de devis et de comptes-rendus, classification et extraction de documents, relances clients, génération de contenus, synthèse de réunions, support client de premier niveau, analyse de données et reporting.\n\nLe catalogue Axion-IA les classe par fonction d'entreprise — service client, ventes et prospection, marketing, administratif, ressources humaines, données et pilotage, production, communication interne — parce que le bon point de départ n'est presque jamais « l'IA » en général, mais un irritant précis dans un service précis. Une automatisation utile commence par une tâche que quelqu'un fait tous les jours en soupirant.\n\nL'IA ne remplace pas le métier : elle absorbe le travail répétitif pour libérer du temps sur les tâches à forte valeur ajoutée. Sur les postes concernés, on observe en moyenne 5 à 15 heures libérées par collaborateur et par semaine. Les décisions sensibles, elles, gardent un point de contrôle humain — l'automatisation s'arrête là où le jugement commence.",
      keyPoints: [
        "E-mails, devis, comptes-rendus, relances, extraction de documents, reporting",
        "8 fonctions d'entreprise couvertes, du service client à la production",
        "5 à 15 heures libérées par collaborateur et par semaine sur les postes concernés",
        "Point de contrôle humain conservé sur les décisions sensibles",
        "On part d'un irritant précis, pas d'un projet « IA » général",
      ],
      facts: [
        { figure: "8", label: "fonctions d'entreprise couvertes" },
        { figure: "5-15 h", label: "libérées par semaine" },
        { figure: "2 sem", label: "pour une automatisation simple" },
      ],
      nuances: [
        {
          title: "Ce n'est pas remplacer un poste",
          detail:
            "L'IA prend la part répétitive d'un métier, pas le métier. Les gains se lisent en temps rendu aux tâches à valeur, pas en effectif retiré.",
        },
        {
          title: "Ce n'est pas tout automatiser d'un coup",
          detail:
            "On commence par un cas précis et mesurable, on prouve le gain, puis on étend. Les grands programmes qui automatisent tout en même temps sont ceux qui n'aboutissent pas.",
        },
        {
          title: "Ce n'est pas une automatisation sans surveillance",
          detail:
            "Les décisions sensibles gardent un point de contrôle humain. Une réponse client délicate ou une validation financière est préparée par l'IA, jamais envoyée à l'aveugle.",
        },
      ],
    },
    en: {
      question: "Which business tasks can be automated with AI?",
      answer:
        "Many high-value repetitive tasks: email triage and replies, drafting quotes and reports, document classification and extraction, customer follow-ups, content generation, meeting summaries, first-level customer support, data analysis and reporting. AI does not replace the job: it absorbs repetitive work to free up time for high-value tasks.",
    },
  },
  {
    id: "ia-integration-outils",
    reviewedAt: "2026-08-12",
    related: [
      "integration-ia-entreprise-concrete",
      "automatisation-ia-workflow-metier",
      "implementation-ia-sur-mesure",
    ],
    fr: {
      question: "Comment intégrer l'IA à mon CRM ou à mes outils existants ?",
      answer:
        "Par leurs API ou par des connecteurs, sans rien remplacer. Vos outils restent vos outils : l'IA vient se brancher dessus. Côté CRM et ERP, on travaille avec Salesforce, HubSpot, Sage, Cegid ou Microsoft Dynamics ; côté quotidien, avec Slack, Teams, Notion, Airtable, Google Workspace et votre messagerie.\n\nCe que cela donne dépend de l'outil : enrichissement automatique des fiches, scoring des leads, prévisions de ventes, comptes-rendus rédigés à partir des échanges, extraction de données depuis les documents entrants. La greffe s'accompagne toujours d'un peu de plomberie invisible mais décisive — monitoring, gestion des erreurs, respect des limites de taux et suivi des coûts par usage.\n\nL'approche est délibérément progressive : on greffe l'IA là où elle apporte le plus de valeur, on mesure, puis on étend. Aucune refonte du système d'information n'est nécessaire, et vos contraintes de sécurité cadrent les choix techniques dès le départ. C'est ce qui évite les grands chantiers coûteux qui n'aboutissent jamais.",
      keyPoints: [
        "Branchement par API ou connecteurs, sans remplacer vos outils",
        "Salesforce, HubSpot, Sage, Cegid, Microsoft Dynamics, Slack, Teams, Notion, Google Workspace",
        "Enrichissement de fiches, scoring de leads, prévisions, comptes-rendus automatiques",
        "Monitoring, gestion des erreurs, limites de taux et coûts par usage",
        "Approche progressive : on greffe, on mesure, puis on étend",
      ],
      facts: [
        { figure: "0", label: "refonte du SI nécessaire" },
        { figure: "5", label: "CRM et ERP couverts" },
        { figure: "6", label: "outils du quotidien connectés" },
        { figure: "30 j", label: "de support après livraison" },
      ],
      nuances: [
        {
          title: "Ce n'est pas un changement d'outil",
          detail:
            "Votre CRM, votre ERP et votre messagerie restent en place. L'IA s'y branche par API : personne n'a de nouvelle interface à apprendre.",
        },
        {
          title: "Ce n'est pas un projet informatique global",
          detail:
            "On ne refond pas le système d'information. On greffe une brique sur un cas précis, on mesure le gain, puis on décide de la suite au vu des résultats.",
        },
        {
          title: "Un connecteur ne suffit pas",
          detail:
            "Brancher l'API est la partie facile. Le monitoring, la gestion des erreurs, les limites de taux et le suivi des coûts par usage font la différence entre une démonstration et une intégration qui tient en production.",
        },
      ],
    },
    en: {
      question: "How do I integrate AI with my CRM or existing tools?",
      answer:
        "AI integrates with your existing tools (CRM, ERP, email, document management, spreadsheets) via their APIs or connectors, without replacing everything. Axion-IA favours a gradual approach: we graft AI where it adds the most value, respecting your stack and security constraints. No need to overhaul your information system to benefit from AI.",
    },
  },
  {
    id: "agent-ia-definition",
    reviewedAt: "2026-08-12",
    related: ["agent-vs-chatbot", "ia-vs-automatisation", "chatbot-ia-entreprise"],
    fr: {
      question: "Qu'est-ce qu'un agent IA ?",
      answer:
        "Un agent IA est un programme qui ne se contente pas de répondre : il accomplit une tâche de bout en bout. À partir d'un objectif, il consulte vos données, utilise des outils — envoyer un e-mail, mettre à jour une fiche CRM, générer un document —, enchaîne plusieurs étapes et corrige sa trajectoire quand l'une d'elles échoue.\n\nC'est une différence de nature avec un chatbot, qui dialogue et s'arrête là. Le chatbot informe, l'agent fait le travail. Concrètement, cela donne des agents de prospection qui qualifient et enrichissent, des agents de support qui traitent une demande jusqu'à sa résolution, des agents de veille qui surveillent un marché, ou des agents d'opérations branchés sur vos processus internes.\n\nAutonome ne veut pas dire livré à lui-même. Les décisions sensibles — un engagement financier, une réponse client délicate — gardent un point de contrôle humain, et l'agent journalise ce qu'il fait pour que ses actions restent vérifiables. C'est cette combinaison d'autonomie encadrée et de traçabilité qui rend un agent utilisable en production, plutôt qu'impressionnant en démonstration.",
      keyPoints: [
        "Il agit : il utilise vos outils et enchaîne plusieurs étapes vers un objectif",
        "Le chatbot informe, l'agent fait le travail",
        "Cas d'usage : prospection, support, veille concurrentielle, opérations",
        "Point de contrôle humain conservé sur les décisions sensibles",
        "Actions journalisées, donc vérifiables après coup",
      ],
      facts: [
        { figure: "4", label: "familles de cas d'usage" },
        { figure: "0", label: "décision sensible sans humain" },
        { figure: "30 j", label: "de support après livraison" },
      ],
      nuances: [
        {
          title: "Ce n'est pas un chatbot un peu meilleur",
          detail:
            "Un chatbot répond dans une conversation. Un agent exécute une tâche dans vos systèmes, en plusieurs étapes, et produit un résultat — pas un message.",
        },
        {
          title: "Ce n'est pas une automatisation à règles fixes",
          detail:
            "Un script suit un chemin prédéfini et s'arrête à la première exception. Un agent interprète la situation et adapte sa trajectoire, ce qui le rend utilisable sur des cas variables.",
        },
        {
          title: "Autonome ne veut pas dire sans surveillance",
          detail:
            "Les décisions sensibles passent par une validation humaine et les actions sont journalisées. L'autonomie porte sur l'exécution, pas sur l'engagement de l'entreprise.",
        },
      ],
    },
    en: {
      question: "What is an AI agent?",
      answer:
        "An AI agent is a program that does more than answer: it carries out tasks end to end autonomously. From a goal, it can consult your data, use tools (send an email, update a CRM, generate a document), chain several steps and adapt. That is the key difference from a simple chatbot, which only converses.",
    },
  },
  {
    id: "agent-vs-chatbot",
    reviewedAt: "2026-08-12",
    related: ["agent-ia-definition", "chatbot-ia-entreprise", "automatisation-ia-workflow-metier"],
    fr: {
      question: "Quelle est la différence entre un agent IA et un chatbot ?",
      answer:
        "Un chatbot répond, un agent IA agit — c'est toute la différence. Le chatbot rend une réponse à une question posée, puis attend la suivante : il informe. L'agent, lui, enchaîne plusieurs étapes seul à partir d'un objectif : il cherche l'information dans vos systèmes, la synthétise, puis déclenche une action — créer une fiche dans le CRM, envoyer une relance, produire un rapport.\n\nCette capacité à agir change la façon de le déployer. Un agent démarre en mode suggestion sur vos cas réels : il propose, un opérateur valide. Il ne bascule en autonomie qu'action par action, une fois son comportement vérifié. Son périmètre d'accès est limité aux seuls systèmes nécessaires et chacune de ses décisions est journalisée, donc vérifiable après coup.\n\nAxion-IA conçoit les deux selon le besoin réel. Un chatbot suffit quand la demande est conversationnelle et documentaire ; un agent s'impose quand la tâche est multi-étapes et se termine par une action sur vos outils. Dans les deux cas, l'humain garde la main sur les décisions sensibles.",
      keyPoints: [
        "Le chatbot informe ; l'agent mène une tâche de bout en bout",
        "L'agent lit vos données, appelle vos outils et enchaîne les étapes",
        "Déploiement prudent : d'abord en suggestion, puis en autonomie vérifiée",
        "Périmètre d'accès borné, chaque décision journalisée",
        "Les actions sensibles restent soumises à validation humaine",
      ],
      facts: [
        { figure: "4-8 sem", label: "premier agent en production" },
        { figure: "100 %", label: "décisions traçables" },
        { figure: "24/7", label: "agent actif sans pause" },
      ],
      steps: [
        {
          title: "Cadrage des missions et des accès",
          detail:
            "On délimite les tâches confiées à l'agent, les systèmes qu'il peut lire ou modifier, et les actions qui exigent un feu vert humain avant exécution.",
        },
        {
          title: "Démarrage en mode suggestion",
          detail:
            "L'agent propose ses actions sur vos cas réels sans les exécuter. Vous vérifiez son comportement sur des situations que vous connaissez déjà.",
        },
        {
          title: "Autonomie progressive et traçage",
          detail:
            "Il bascule en autonomie action par action, une fois le comportement validé. Chaque décision reste journalisée, donc identifiable et corrigeable.",
        },
      ],
      nuances: [
        {
          title: "Ce n'est pas un chatbot rebaptisé",
          detail:
            "Un assistant conversationnel branché sur vos documents reste un chatbot : il répond. Tant qu'aucune action n'est déclenchée sur vos systèmes, il n'y a pas d'agent.",
        },
        {
          title: "Ce n'est pas une automatisation à règles fixes",
          detail:
            "Un script rejoue une séquence et se bloque dès qu'un cas sort du scénario. L'agent interprète l'ambigu, repère une pièce manquante et escalade au lieu de casser.",
        },
        {
          title: "Ce n'est pas une IA laissée sans surveillance",
          detail:
            "Le périmètre d'accès est limité aux systèmes nécessaires, les actions à impact passent par une validation, et le journal permet de rejouer chaque décision.",
        },
      ],
    },
    en: {
      question: "What is the difference between an AI agent and a chatbot?",
      answer:
        "A chatbot answers questions in a conversation. An AI agent acts: it performs concrete tasks (processing an order, qualifying a lead, producing a report) using your tools and data, across several autonomous steps. The chatbot informs; the agent does the work. Axion-IA designs both depending on your real need, keeping a human in the loop for sensitive decisions.",
    },
  },
  {
    id: "former-equipes-ia",
    reviewedAt: "2026-08-12",
    related: ["formation-ia-entreprise", "atelier-ia-equipe", "equipes-operationnelles"],
    fr: {
      question: "Comment monter mes équipes en compétence sur l'IA ?",
      answer:
        "Par la pratique, sur vos propres cas, et en commençant par un périmètre restreint plutôt que par toute l'entreprise d'un coup. Le chemin le plus courant : une demi-journée de 4 heures pour lever les blocages d'un premier groupe, puis une journée pour installer une pratique commune, puis un format de 2 journées pour les équipes qui doivent construire des automatisations.\n\nLes sessions se tiennent en intra, par groupe de 2 à 15 personnes, sur site ou à distance. On y couvre les mêmes fondamentaux quel que soit le métier : formuler une demande structurée, choisir le bon assistant selon le besoin, vérifier une production avant de la diffuser, et savoir quelles données ne sortent jamais de l'entreprise. Le reste du programme est calé sur votre métier ou votre secteur d'activité.\n\nCe qui fait tenir la montée en compétence, c'est ce qui reste après : des prompts construits en séance, une trame commune écrite par l'équipe elle-même, et des cas d'usage identifiés service par service. Comptez au moins 11 jours ouvrés entre la confirmation et la session, le temps de préparer les cas et les accès.",
      keyPoints: [
        "Commencer par un groupe et un format court plutôt que par toute l'entreprise",
        "4 heures pour lever les blocages, 1 journée pour installer une pratique commune",
        "Sessions en intra, 2 à 15 personnes, sur site ou à distance",
        "Fondamentaux communs : formuler, choisir l'assistant, vérifier, protéger les données",
        "Ce qui reste : les prompts construits en séance et la trame commune de l'équipe",
      ],
      facts: [
        { figure: "4 h", label: "format le plus court" },
        { figure: "2-15", label: "participants par groupe" },
        { figure: "11 j", label: "ouvrés de délai d'accès" },
        { figure: "2-3 j", label: "formats les plus longs" },
      ],
      steps: [
        {
          title: "Choisir le point d'entrée",
          detail:
            "« IA pour bien commencer » si l'équipe part de zéro ; « IA pour les équipes » si les usages existent déjà mais chacun à sa façon, avec des résultats inégaux.",
        },
        {
          title: "Préparer les cas",
          detail:
            "Chaque participant arrive avec de vraies tâches. Les accès aux outils sont préparés avec vous en amont si besoin. Comptez au moins 11 jours ouvrés avant la session.",
        },
        {
          title: "La session",
          detail:
            "Démonstration courte, pratique immédiate, exercices différenciés par profil et travail en binômes. Un quiz individuel de 10 questions valide les acquis en fin de parcours.",
        },
        {
          title: "L'ancrage",
          detail:
            "L'équipe repart avec ses prompts et sa trame commune. Les formats de 2 jours peuvent être scindés en deux journées espacées, pour pratiquer entre les deux.",
        },
      ],
      nuances: [
        {
          title: "Former tout le monde d'un coup n'est pas la meilleure entrée",
          detail:
            "Un premier groupe qui pratique vraiment vaut mieux qu'une plénière suivie de rien. Si l'objectif est justement de réunir toute l'entreprise le même jour, le format séminaire monte jusqu'à 50 participants.",
        },
        {
          title: "Ce n'est pas la même chose qu'un accompagnement individuel",
          detail:
            "Le Coaching IA 1-to-1 accueille une seule personne, une journée entière, sur son poste. Les interventions collectives installent une pratique partagée dans une équipe.",
        },
        {
          title: "Un outil déployé n'est pas une compétence installée",
          detail:
            "Donner accès à un assistant ne fait pas monter une équipe : sans méthode de formulation ni réflexe de vérification, l'usage retombe en quelques semaines.",
        },
      ],
    },
    en: {
      question: "How do I upskill my teams on AI?",
      answer:
        "Axion-IA hands-on sessions are practical, not theoretical: we start from your real business cases and your teams leave autonomous on tools they will use the next day. On-site or remote, we cover good habits, writing effective prompts, pitfalls to avoid (confidentiality, checking answers) and responsible use. The goal: teams that save time safely, not forgotten slides.",
    },
  },
  {
    id: "ia-generative-definition",
    reviewedAt: "2026-08-12",
    related: ["ia-vs-automatisation", "ia-hallucinations-fiabilite", "automatiser-taches-ia"],
    fr: {
      question: "Qu'est-ce que l'IA générative ?",
      answer:
        "L'IA générative désigne les systèmes capables de produire du contenu nouveau — texte, code, images, synthèses, traductions — à partir d'une simple consigne écrite en langage courant. Contrairement aux logiciels classiques, on ne les programme pas : on leur explique ce qu'on attend, comme à un collaborateur. Les assistants les plus connus en entreprise, ChatGPT, Claude ou Gemini, en sont les visages grand public.\n\nTechniquement, ces modèles ont appris, sur d'immenses corpus, à prédire la suite la plus plausible d'un texte. Cela explique à la fois leur aisance rédactionnelle et leur principale limite : ils produisent ce qui ressemble à une bonne réponse, pas nécessairement une réponse vérifiée. D'où la règle constante d'une relecture humaine sur tout ce qui engage l'entreprise.\n\nPour une PME, l'intérêt n'est pas le gadget. C'est de traiter en quelques minutes ce qui prenait des heures : rédiger une proposition commerciale, résumer trente pages de compte rendu, trier des demandes clients, préparer un reporting. Le gain se mesure en heures rendues à vos équipes, pas en démonstrations impressionnantes.",
      keyPoints: [
        "Produit du contenu nouveau à partir d'une consigne en langage courant",
        "On ne la programme pas : on lui explique ce qu'on attend",
        "ChatGPT, Claude et Gemini en sont les visages grand public",
        "Elle prédit ce qui est plausible, pas ce qui est vérifié",
        "Relecture humaine sur tout ce qui engage l'entreprise",
      ],
      nuances: [
        {
          title: "Ce n'est pas un moteur de recherche",
          detail:
            "Un assistant génératif ne consulte pas une base de vérité : il compose une réponse. Sans source demandée et vérifiée, rien ne garantit l'exactitude.",
        },
        {
          title: "Ce n'est pas de l'automatisation",
          detail:
            "L'IA générative interprète et rédige ; les scripts et le RPA appliquent des règles fixes. Les deux se combinent très bien, mais ne se remplacent pas.",
        },
        {
          title: "Ce n'est pas réservé aux entreprises techniques",
          detail:
            "Les usages les plus rentables sont bureautiques : rédaction, synthèse, tri de demandes, comptes rendus. Aucun développeur n'est nécessaire pour commencer.",
        },
      ],
    },
    en: {
      question: "What is generative AI?",
      answer:
        "Generative AI is a category of artificial intelligence able to produce new content — text, code, images, summaries — from a natural-language instruction. Models such as Claude or GPT are its engines. For a business, the point is not the gadget: it is automating writing, analysis and information processing at scale, while keeping human control over the results.",
    },
  },
  {
    id: "risques-ia-entreprise",
    reviewedAt: "2026-08-12",
    related: ["ia-hallucinations-fiabilite", "securite-donnees-ia", "ai-act-2026"],
    fr: {
      question: "Quels sont les risques de l'IA en entreprise et comment les maîtriser ?",
      answer:
        "Quatre risques dominent : la fuite de données confidentielles, les erreurs de l'IA présentées avec assurance — les « hallucinations » —, la dépendance à un fournisseur unique, et la non-conformité (RGPD, AI Act). Aucun n'est propre à l'IA, mais tous s'amplifient quand l'outil entre dans l'entreprise sans règle écrite.\n\nQuatre garde-fous suffisent à les ramener à un niveau acceptable. Choisir des outils dont les conditions de traitement des données sont compatibles avec votre activité. Ne jamais publier une sortie IA sans relecture humaine sur les sujets à enjeu : ressources humaines, juridique, finance, communication. Tracer les usages, pour savoir qui utilise quoi et sur quelles données. Et privilégier une solution hébergée en Union européenne, voire chez vous, quand les données sont critiques.\n\nCes garde-fous se posent au cadrage, pas après l'incident. C'est précisément ce que l'audit IA formalise : cartographie des usages réels, arbitrages d'hébergement, règles de relecture, indicateurs à suivre dans le temps.",
      keyPoints: [
        "Fuite de données, erreurs, dépendance fournisseur, non-conformité",
        "Relecture humaine obligatoire sur RH, juridique, finance, communication",
        "Tracer qui utilise quoi, sur quelles données",
        "Hébergement en UE ou chez vous quand les données sont critiques",
        "Garde-fous posés au cadrage, pas après l'incident",
      ],
      facts: [
        { figure: "4", label: "risques principaux" },
        { figure: "4", label: "garde-fous à poser" },
        { figure: "UE", label: "hébergement des cas critiques" },
      ],
      nuances: [
        {
          title: "Ce n'est pas un problème purement technique",
          detail:
            "La moitié de ces risques se traite par des règles écrites et de la montée en compétence des équipes, pas par l'achat d'un logiciel supplémentaire.",
        },
        {
          title: "Interdire l'IA n'est pas un garde-fou",
          detail:
            "Une interdiction sans alternative déplace l'usage vers les comptes personnels des salariés, hors de toute traçabilité. Encadrer protège mieux que défendre.",
        },
        {
          title: "Le risque juridique ne se règle pas par un outil",
          detail:
            "La qualification de vos traitements et de vos obligations relève de votre responsable de traitement et de votre conseil. L'outillage technique n'y suffit pas.",
        },
      ],
    },
    en: {
      question: "What are the risks of AI in business and how do you manage them?",
      answer:
        'The main risks are confidential data leaks, AI errors or "hallucinations", vendor lock-in, and non-compliance (GDPR, AI Act). You manage them with clear rules: choose data-respecting tools, never publish an AI output without human review on sensitive topics, log usage, and favour sovereign solutions when data is critical. Axion-IA frames these safeguards from the audit onward.',
    },
  },
  {
    id: "ia-hallucinations-fiabilite",
    reviewedAt: "2026-08-12",
    related: ["risques-ia-entreprise", "ia-biais-objectivite", "ia-generative-definition"],
    fr: {
      question: "Comment éviter les erreurs et hallucinations de l'IA ?",
      answer:
        "Une hallucination, c'est une réponse fausse énoncée avec le même aplomb qu'une réponse juste. Le phénomène n'est pas un bug qu'un correctif ferait disparaître : il découle du fonctionnement même des modèles, qui composent la suite la plus plausible au lieu de consulter une base de vérité. Personne, aujourd'hui, ne peut vous promettre un assistant qui ne se trompe jamais.\n\nEn revanche, le risque se réduit fortement, et de façon vérifiable. Quatre leviers font l'essentiel du travail : ancrer l'IA sur vos propres documents validés plutôt que sur sa mémoire générale, exiger systématiquement les sources, maintenir une relecture humaine sur tout ce qui engage — juridique, financier, RH, communication externe — et mesurer la qualité dans le temps au lieu de la supposer acquise.\n\nBien cadrée, l'IA devient fiable pour de la production quotidienne. Livrée sans garde-fous à des équipes qu'on n'a pas formées, elle expose à l'erreur, et cette erreur sort avec votre signature. C'est précisément ce qu'Axion-IA installe : les usages, les contrôles et le réflexe de vérification.",
      keyPoints: [
        "Une hallucination est une réponse fausse énoncée avec assurance",
        "Ce n'est pas un bug passager : c'est inhérent au fonctionnement des modèles",
        "Ancrer l'IA sur vos documents validés réduit fortement le risque",
        "Exiger les sources, relire tout ce qui engage l'entreprise",
        "Mesurer la qualité dans la durée, pas une seule fois au démarrage",
      ],
      steps: [
        {
          title: "Ancrer l'IA sur vos données",
          detail:
            "Brancher l'assistant sur vos documents validés — procédures, contrats types, base de connaissances — plutôt que de le laisser puiser dans sa mémoire générale.",
        },
        {
          title: "Exiger les sources",
          detail:
            "Demander systématiquement d'où vient l'information et quels passages ont servi. Une réponse sans source se relit ; elle ne se publie pas.",
        },
        {
          title: "Garder l'humain sur ce qui engage",
          detail:
            "Juridique, financier, RH, communication externe : la relecture reste obligatoire. Sur le reste, un contrôle par sondage suffit généralement.",
        },
        {
          title: "Mesurer dans la durée",
          detail:
            "Repasser à intervalles réguliers sur un échantillon de sorties. La fiabilité se constate au fil des semaines, elle ne se décrète pas le premier jour.",
        },
      ],
      nuances: [
        {
          title: "Ce n'est pas un mensonge de la machine",
          detail:
            "Le modèle n'a aucune intention de tromper. Il produit ce qui est statistiquement plausible, sans conscience de l'écart avec le réel.",
        },
        {
          title: "Changer de modèle ne suffit pas",
          detail:
            "Un assistant plus récent réduit la fréquence des erreurs, jamais leur possibilité. La méthode de vérification reste indispensable, quel que soit l'outil.",
        },
        {
          title: "Ce n'est pas à l'IA de dire si elle a raison",
          detail:
            "Lui demander « es-tu sûr ? » ne prouve rien : la confirmation sort du même mécanisme que l'erreur. Seule une source externe tranche.",
        },
      ],
    },
    en: {
      question: "How do you avoid AI errors and hallucinations?",
      answer:
        'A "hallucination" is a false answer presented confidently. You prevent it by grounding AI on your verified data (instead of its general memory), asking for sources, keeping human review on high-stakes topics, and measuring quality over time. Properly framed, AI becomes reliable for production; delivered without safeguards, it exposes you to error. That is exactly what Axion-IA puts in place.',
    },
  },
  {
    id: "ia-souveraine-europe",
    reviewedAt: "2026-08-12",
    related: ["ia-on-premise", "securite-donnees-ia", "rgpd-ia"],
    fr: {
      question: "Qu'est-ce qu'une IA souveraine ou européenne ?",
      answer:
        "Une IA « souveraine » n'est pas un label : c'est une architecture où vous savez où vos données sont hébergées, qui les traite et sous quel cadre juridique. En pratique, cela va d'un service hébergé dans l'Union européenne jusqu'à des modèles open-source comme Llama ou Mistral installés sur vos propres serveurs, sans transfert incontrôlé hors UE.\n\nL'enjeu est de calibrer le niveau, pas de tout verrouiller. Quatre domaines justifient presque toujours le niveau le plus strict : la santé, le juridique, les ressources humaines et la R&D. Pour un compte-rendu de réunion interne, un service européen sérieux suffit ; pour un dossier patient ou un dépôt en cours, l'auto-hébergement se discute réellement.\n\nChez Axion-IA, l'hébergement des solutions déployées est européen par défaut (Hetzner, Francfort), l'arbitrage se pose au cadrage technique, et toute évolution de sous-traitant est notifiée trente jours avant. Le déploiement de modèles ouverts chez vous reste une option assumée quand la sensibilité l'exige.",
      keyPoints: [
        "Savoir où sont vos données, qui les traite, sous quel cadre juridique",
        "Du service hébergé en UE jusqu'aux modèles ouverts installés chez vous",
        "Santé, juridique, RH et R&D : les domaines les plus exposés",
        "Hébergement européen par défaut, arbitrage posé au cadrage technique",
        "Toute évolution de sous-traitant notifiée 30 jours avant",
      ],
      facts: [
        { figure: "4", label: "domaines les plus sensibles" },
        { figure: "UE", label: "hébergement par défaut" },
        { figure: "30 j", label: "de préavis sur les sous-traitants" },
      ],
      nuances: [
        {
          title: "Souverain ne veut pas dire français",
          detail:
            "Le critère opérationnel est le lieu de traitement et le cadre juridique applicable, pas la nationalité de l'éditeur du modèle.",
        },
        {
          title: "Souverain ne veut pas dire moins performant",
          detail:
            "Les modèles ouverts couvrent aujourd'hui la majorité des usages bureautiques. L'écart se joue surtout sur les tâches de raisonnement les plus exigeantes.",
        },
        {
          title: "Ce n'est pas tout ou rien",
          detail:
            "La plupart des entreprises font cohabiter un service européen pour le quotidien et un déploiement fermé pour une poignée de traitements sensibles.",
        },
      ],
    },
    en: {
      question: "What is sovereign or European AI?",
      answer:
        '"Sovereign" AI refers to solutions where your data stays hosted and processed within a controlled framework (Europe, or even your own servers), GDPR-compliant, with no uncontrolled transfer outside the EU. This is essential for sensitive data (health, legal, HR, R&D). Axion-IA designs architectures combining performance and sovereignty depending on your sensitivity level, up to on-premise deployments when needed.',
    },
  },
  {
    id: "deroule-mission-axion",
    reviewedAt: "2026-08-12",
    related: ["comment-commencer", "duree-audit-ia", "livrables-audit-ia"],
    fr: {
      question: "Comment se déroule une mission avec Axion-IA ?",
      answer:
        "En quatre temps, chacun produisant un livrable et chacun pouvant être le dernier. Tout commence par un appel de cadrage pour cerner le besoin, avec un devis sous 48 heures ouvrées. Viennent ensuite les quatre étapes : identifier, auditer, implémenter, mesurer.\n\nIdentifier, c'est une journée sur site : 3 à 5 process candidats, des démonstrations sur vos données anonymisées, des quick-wins déployables sous trente jours, et une cartographie terrain en sortie. Auditer, c'est cinq jours pour chiffrer chaque opportunité et remettre un plan priorisé, sous forme d'un document de 25 à 40 pages et d'un atelier de restitution. Implémenter, c'est six à huit semaines du cadrage technique à la mise en production, avec trente jours de support inclus. Mesurer, c'est revenir compter les heures et les coûts réellement économisés, sur des indicateurs convenus avant le déploiement.\n\nLa méthode est découplée du contrat long : vous pouvez vous arrêter à la fin de n'importe quelle étape, et le même intervenant senior vous suit du cadrage à la livraison.",
      keyPoints: [
        "Quatre temps séparés, un livrable concret à chaque étape",
        "Appel de cadrage puis devis sous 48 h ouvrées",
        "Journée sur site, audit de 5 jours, mise en production en 6-8 semaines",
        "Chaque étape peut être la dernière : aucun engagement de durée imposé",
        "Le même intervenant senior du cadrage jusqu'à la livraison",
      ],
      facts: [
        { figure: "1 jour", label: "sur site pour identifier" },
        { figure: "5 j", label: "d'audit" },
        { figure: "6-8 sem.", label: "jusqu'à la production" },
        { figure: "30 j", label: "de support inclus" },
      ],
      steps: [
        {
          title: "Identifier",
          detail:
            "Une journée sur site pour cartographier vos process : 3 à 5 candidats retenus, démonstrations sur vos données anonymisées, quick-wins déployables sous 30 jours. Livrable : la cartographie terrain.",
        },
        {
          title: "Auditer",
          detail:
            "Cinq jours pour chiffrer chaque opportunité et la classer par ROI et complexité. Livrable : un plan priorisé de 25 à 40 pages, restitué en atelier avec vos équipes.",
        },
        {
          title: "Implémenter",
          detail:
            "Six à huit semaines : cadrage technique, prototype itératif, tests utilisateurs, déploiement progressif. Livrable : la solution en production, avec 30 jours de support.",
        },
        {
          title: "Mesurer",
          detail:
            "Retour sur les indicateurs convenus avant le déploiement — heures et coûts économisés, impact qualitatif — et itération si une dérive de qualité apparaît. Livrable : le ROI mesuré.",
        },
      ],
      nuances: [
        {
          title: "Ce n'est pas un engagement en bloc",
          detail:
            "Chaque étape peut être la dernière. Le plan chiffré reste exploitable si vous décidez d'internaliser la suite, sans lock-in technique ni commercial.",
        },
        {
          title: "Ce n'est pas une démonstration commerciale",
          detail:
            "Les démonstrations tournent sur vos process et vos propres documents, pas sur un jeu de données de vitrine préparé à l'avance.",
        },
        {
          title: "Le ROI est mesuré, pas promis",
          detail:
            "Les indicateurs sont fixés avant le déploiement, ce qui rend le constat vérifiable des deux côtés. Axion-IA intervient au titre d'une obligation de moyens : aucune garantie de résultat n'est donnée.",
        },
      ],
    },
    en: {
      question: "How does a mission with Axion-IA unfold?",
      answer:
        "A mission follows four simple steps: a first conversation to scope your need, an audit identifying high-ROI use cases, delivery (session, intervention or custom implementation), then support to embed usage and measure gains. You stay in control at every step, deliverables are concrete, and the goal remains measurable ROI — not a demo with no follow-up.",
    },
  },
  // ── Batch perfection FAQ 2026-05-31 #2 — secteurs, cas d'usage, comparatifs ────
  // (terminologie sûre : « session/intervention/accompagnement », jamais OPCO/CPF/
  //  Qualiopi ; aucun prix chiffré ni fait spécifique inventé.)
  {
    id: "ia-commerce-retail",
    reviewedAt: "2026-08-12",
    related: ["ia-e-commerce", "automatiser-service-client-ia", "secteurs-ia"],
    fr: {
      question: "Comment l'IA peut-elle aider un commerce ou un retailer ?",
      answer:
        "Sur trois fronts très concrets, tous ancrés dans le quotidien d'un point de vente. D'abord la relation client : réponses aux questions fréquentes, traitement des avis en ligne, relances et fidélisation. Ensuite le catalogue : rédaction et mise à jour des descriptions produits, cohérence des fiches d'une référence à l'autre. Enfin le pilotage : lecture de vos historiques de vente, saisonnalité, anticipation des ruptures et repérage des références qui dorment en réserve.\n\nL'objectif n'est jamais de remplacer le contact humain, puisque c'est lui qui fait vendre, mais de libérer du temps administratif pour le rendre au conseil en rayon. Axion-IA observe en moyenne 5 à 15 heures libérées par collaborateur et par semaine après une formation et un déploiement.\n\nOn ne déploie pas tout d'un coup : on part d'un cas à fort impact, on le fait tourner sur vos vraies données, puis on étend au reste de l'enseigne.",
      keyPoints: [
        "Relation client : avis en ligne, questions fréquentes, relances, fidélisation",
        "Catalogue : descriptions produits rédigées et tenues à jour",
        "Pilotage : historiques de vente, saisonnalité, ruptures et stock dormant",
        "Le vendeur reste au contact ; l'IA absorbe l'administratif autour",
        "Un premier cas à fort impact, mesuré, avant toute extension",
      ],
      facts: [
        { figure: "5-15 h", label: "libérées par collaborateur" },
        { figure: "2-3", label: "cas d'usage pour démarrer" },
        { figure: "1 j", label: "d'audit IA au maximum" },
        { figure: "48 h", label: "ouvrées pour le devis" },
      ],
      steps: [
        {
          title: "Chiffrer le temps de bureau",
          detail:
            "Combien d'heures partent chaque semaine dans les avis, les fiches produits, les relances et le suivi de stock. On mesure au lieu de deviner : c'est ce que fait l'audit IA, en une demi-journée à une journée.",
        },
        {
          title: "Choisir 2 à 3 cas d'usage",
          detail:
            "On garde ceux qui coûtent le plus de temps et qui se testent vite. Le reste attend : se disperser sur dix chantiers est la façon la plus sûre de n'en finir aucun.",
        },
        {
          title: "Faire tourner sur vos données",
          detail:
            "Vos historiques de vente, vos vraies fiches produits, vos avis réels. Un cas d'usage validé sur les données du magasin vaut mieux qu'une démonstration sur un catalogue fictif.",
        },
        {
          title: "Emmener l'équipe",
          detail:
            "Une session collective, de 4 heures à 2 journées selon le périmètre, en groupe de 2 à 15 participants. Sans les personnes qui s'en serviront tous les jours, l'outil tombe en désuétude en quelques semaines.",
        },
      ],
      nuances: [
        {
          title: "Ce n'est pas un remplacement des vendeurs",
          detail:
            "En commerce, la vente se joue au contact. L'IA prend l'administratif qui éloigne le vendeur du client : elle rend du temps de rayon, elle n'en supprime pas.",
        },
        {
          title: "Prévoir n'est pas deviner",
          detail:
            "Une prévision de réassort ne sera jamais parfaite. Elle est simplement meilleure que l'intuition seule, parce qu'elle s'appuie sur vos propres historiques de vente.",
        },
        {
          title: "Ce n'est pas réservé aux grandes enseignes",
          detail:
            "Les formats d'entrée, session collective sur site et audit sur place, sont accessibles à une TPE. Un commerce indépendant démarre sur un seul cas d'usage, pas sur un programme d'enseigne.",
        },
      ],
    },
    en: {
      question: "Comment l'IA peut-elle aider un commerce ou un retailer ?",
      answer:
        "Pour un commerce, l'IA automatise les tâches chronophages et améliore la relation client : réponses aux questions fréquentes, gestion des avis, descriptions produits, prévisions de stock, relances et fidélisation, analyse des ventes. L'objectif n'est pas de remplacer le contact humain mais de libérer du temps pour la vente et le conseil. On commence par un cas concret à fort impact, puis on étend.",
    },
  },
  {
    id: "ia-restauration-hotellerie",
    reviewedAt: "2026-08-12",
    related: ["ia-commerce-retail", "automatiser-service-client-ia", "secteurs-ia"],
    fr: {
      question: "L'IA est-elle utile pour un restaurant ou un hôtel ?",
      answer:
        "Oui, et le gain se joue hors de la salle : sur les heures de bureau qui l'entourent. Trois postes reviennent systématiquement. Les avis en ligne d'abord, qui s'accumulent sans réponse et pèsent sur le référencement local. Le planning ensuite, refait chaque dimanche soir en jonglant avec les disponibilités, les contrats et les extras. Enfin les demandes clients répétitives, horaires, accès, allergènes, disponibilités, qui tombent à toute heure et coupent le service.\n\nS'y ajoutent la prévision d'affluence à partir de vos propres historiques, saisons hautes comprises, et le marketing local. Bien cadrée, l'IA réduit la charge administrative sans dénaturer l'accueil : c'est un accueil humain qui fait revenir un client, jamais un outil.\n\nLe point de départ raisonnable est un audit IA d'une demi-journée à une journée, qui identifie les 2 à 3 tâches les plus coûteuses en temps avant tout achat de logiciel.",
      keyPoints: [
        "Avis en ligne : réponses personnalisées, validées avant publication",
        "Planning hebdomadaire et gestion des remplacements",
        "Demandes clients répétitives traitées en dehors des heures de service",
        "Prévision d'affluence à partir de vos historiques, saisons hautes incluses",
        "L'accueil reste humain ; l'administratif passe à l'IA",
      ],
      facts: [
        { figure: "2-3", label: "tâches ciblées en premier" },
        { figure: "1 j", label: "d'audit IA au maximum" },
        { figure: "5-15 h", label: "libérées par collaborateur" },
        { figure: "48 h", label: "ouvrées pour le devis" },
      ],
      steps: [
        {
          title: "Lister les heures hors service",
          detail:
            "Planning, avis, mails, réservations, réponses aux questions : ce sont ces heures-là qui se récupèrent, pas celles passées en salle ou en cuisine.",
        },
        {
          title: "Commencer par les avis",
          detail:
            "C'est le chantier le plus rapide à mettre en route : l'outil s'appuie sur vos réponses existantes pour retrouver votre ton, vous relisez et publiez d'un clic.",
        },
        {
          title: "Absorber les demandes répétitives",
          detail:
            "Horaires, accès, allergènes, disponibilités. Ces questions reviennent chaque jour à l'identique et coupent le service : elles se traitent en amont.",
        },
        {
          title: "Former ceux qui s'en serviront",
          detail:
            "Une session collective sur site ou à distance, en groupe de 2 à 15 participants. Un outil que personne n'a pris en main ne survit pas au premier coup de feu.",
        },
      ],
      nuances: [
        {
          title: "Ce n'est pas un robot à l'accueil",
          detail:
            "Rien de ce qui touche à la relation en salle ou en réception n'est automatisé. L'IA travaille sur les tâches de bureau : avis, plannings, mails, réservations.",
        },
        {
          title: "Une réponse générée n'est pas une réponse publiée",
          detail:
            "Sur un avis client, la validation humaine reste la règle. L'outil rédige un premier jet dans votre ton ; vous gardez la main avant publication.",
        },
        {
          title: "Ce n'est pas réservé aux groupes hôteliers",
          detail:
            "Un restaurant indépendant ou un hôtel familial démarre sur un seul cas d'usage. Les formats d'entrée, audit sur place et session collective, sont accessibles à une TPE.",
        },
      ],
    },
    en: {
      question: "L'IA est-elle utile pour un restaurant ou un hôtel ?",
      answer:
        "Oui. Dans la restauration et l'hôtellerie, l'IA aide sur la réservation et la prise de demandes, les réponses aux avis en ligne, la gestion des plannings, les prévisions d'affluence, le marketing local et les réponses aux questions des clients 24/7. Bien cadrée, elle réduit la charge administrative et améliore l'expérience client, sans dénaturer l'accueil humain.",
    },
  },
  {
    id: "ia-btp-construction",
    reviewedAt: "2026-08-12",
    related: ["ia-immobilier", "ia-gestion-documents", "automatiser-facturation-ia"],
    fr: {
      question: "Comment l'IA s'applique-t-elle au BTP et à la construction ?",
      answer:
        "Par le bureau, pas par le chantier. L'IA accélère d'abord le chiffrage et la production des devis : à partir d'une description de chantier, elle génère la structure et les postes récurrents, et votre conducteur de travaux ajuste les spécificités et les prix. Elle lit ensuite les pièces lourdes, CCTP, DPGF, dossiers d'appel d'offres, pour en faire ressortir les points d'attention, et elle rédige les comptes-rendus de chantier à partir de notes ou d'un enregistrement.\n\nLe troisième chantier est moins visible mais souvent le plus rentable : remettre de l'ordre dans une information éparpillée entre mails, PDF, photos et versions de plans, pour retrouver la bonne pièce au lieu de la chercher. S'y ajoute la veille sur les appels d'offres.\n\nLe gain porte donc sur le temps de bureau, qui pèse lourd dans le secteur, et sert à recentrer les équipes sur le terrain. L'imprévu de chantier, lui, reste entièrement humain.",
      keyPoints: [
        "Chiffrage et devis : structure et postes récurrents générés, ajustés par vous",
        "Lecture des CCTP, DPGF et dossiers d'appel d'offres",
        "Comptes-rendus de chantier rédigés à partir de notes ou d'un enregistrement",
        "Information de chantier remise en ordre : mails, PDF, photos, versions de plans",
        "Le gain est sur le temps de bureau, pour rendre les équipes au terrain",
      ],
      facts: [
        { figure: "3-5", label: "process passés au crible" },
        { figure: "1 j", label: "d'audit IA au maximum" },
        { figure: "6-8 sem.", label: "pour une implémentation" },
        { figure: "48 h", label: "ouvrées pour le devis" },
      ],
      steps: [
        {
          title: "Mesurer le temps de bureau",
          detail:
            "Combien d'heures par devis, par compte-rendu, par dossier d'appel d'offres. C'est l'objet de l'audit IA : cartographier 3 à 5 process candidats et chiffrer le gain récupérable.",
        },
        {
          title: "Attaquer le devis en premier",
          detail:
            "C'est presque toujours le poste le plus coûteux et le plus répétitif. La structure et les postes standards se génèrent ; votre expertise fait le reste.",
        },
        {
          title: "Ranger l'information de chantier",
          detail:
            "Rendre interrogeables les mails, PDF, photos et versions de plans, pour qu'une question du chef de chantier ne bloque plus le bureau pendant quarante minutes.",
        },
        {
          title: "Brancher, puis former",
          detail:
            "L'outillage se greffe sur votre logiciel de devis et votre messagerie existants. Une implémentation se déroule en 6 à 8 semaines, avec 30 jours de support inclus.",
        },
      ],
      nuances: [
        {
          title: "L'IA ne pilote pas un chantier",
          detail:
            "Elle ne gère ni l'aléa météo, ni un sous-traitant défaillant, ni une réception de chantier. Elle libère du temps pour que vous gériez ces imprévus mieux.",
        },
        {
          title: "Ce n'est pas un logiciel de plus à la place du vôtre",
          detail:
            "L'IA se greffe sur votre logiciel de devis, votre messagerie et votre GED via leurs API. Pas besoin de refondre votre système d'information pour en profiter.",
        },
        {
          title: "Un devis généré n'est pas un devis envoyé",
          detail:
            "Un chiffrage engage l'entreprise. L'IA produit un premier jet structuré ; la relecture et la validation par un professionnel restent obligatoires avant l'envoi.",
        },
      ],
    },
    en: {
      question: "Comment l'IA s'applique-t-elle au BTP et à la construction ?",
      answer:
        "Dans le BTP, l'IA accélère le chiffrage et les devis, l'analyse de cahiers des charges, la rédaction de comptes-rendus de chantier, le suivi administratif et la veille appels d'offres. Elle aide aussi à structurer la donnée éparpillée (mails, PDF, photos). Le gain est surtout sur le temps de bureau, qui pèse lourd dans le secteur, pour recentrer les équipes sur le terrain.",
    },
  },
  {
    id: "ia-immobilier",
    reviewedAt: "2026-08-12",
    related: [
      "ia-btp-construction",
      "creation-site-web-augmente-ia",
      "automatiser-service-client-ia",
    ],
    fr: {
      question: "Comment l'IA aide-t-elle une agence immobilière ?",
      answer:
        "Sur l'administratif et la prospection, qui mangent les journées d'un agent. L'IA rédige les annonces à partir des caractéristiques du bien et les décline pour chaque portail, qualifie les demandes entrantes avant qu'elles n'arrivent au téléphone, répond aux questions courantes en dehors des heures d'agence et automatise les relances, côté acquéreurs comme côté vendeurs.\n\nElle prépare aussi les éléments d'une estimation à partir de données de marché, met en forme les comptes-rendus de visite et assemble les pièces d'un dossier. Sur un mandat, ce sont autant d'heures rendues à la relation et à la négociation, c'est-à-dire à la partie du métier qui ne se délègue pas. Axion-IA observe en moyenne 5 à 15 heures libérées par collaborateur et par semaine après une formation et un déploiement.\n\nUn point de vigilance : une annonce et une estimation engagent l'agence. L'IA produit un premier jet, un professionnel valide avant publication.",
      keyPoints: [
        "Annonces rédigées et déclinées portail par portail",
        "Demandes entrantes qualifiées avant d'arriver au téléphone",
        "Questions courantes traitées en dehors des heures d'agence",
        "Relances acquéreurs et vendeurs automatisées",
        "Estimations et comptes-rendus de visite préparés, jamais publiés sans relecture",
      ],
      facts: [
        { figure: "5-15 h", label: "libérées par collaborateur" },
        { figure: "2-3", label: "cas d'usage pour démarrer" },
        { figure: "1 j", label: "d'audit IA au maximum" },
        { figure: "48 h", label: "ouvrées pour le devis" },
      ],
      steps: [
        {
          title: "Partir des annonces",
          detail:
            "C'est le poste le plus répétitif et le plus mesurable : même bien, plusieurs portails, plusieurs formats. Le gain de temps se constate dès le premier mandat.",
        },
        {
          title: "Qualifier les demandes entrantes",
          detail:
            "Budget, secteur, délai, financement : quelques questions posées en amont évitent des dizaines d'appels hors cible et laissent les négociateurs sur les vrais projets.",
        },
        {
          title: "Automatiser les relances",
          detail:
            "Acquéreurs en attente de visite, vendeurs à recontacter, pièces manquantes d'un dossier. Ce sont des rappels que l'agenda humain laisse tomber en période chargée.",
        },
        {
          title: "Mesurer avant d'étendre",
          detail:
            "On compare le temps passé avant et après sur ces trois postes. Si le gain est là, on étend au reste de l'agence ; sinon, on corrige avant d'investir davantage.",
        },
      ],
      nuances: [
        {
          title: "Ce n'est pas un estimateur automatique",
          detail:
            "L'IA prépare les éléments d'une estimation à partir de données de marché. L'avis de valeur, lui, engage l'agence et reste la responsabilité de l'agent.",
        },
        {
          title: "Ce n'est pas un remplaçant du négociateur",
          detail:
            "La visite, la découverte du besoin et la négociation restent humaines. L'IA travaille en amont et en aval, sur la production de documents et le suivi.",
        },
        {
          title: "Ce n'est pas réservé aux réseaux nationaux",
          detail:
            "Une agence indépendante démarre sur un seul cas d'usage, souvent les annonces. Les formats d'entrée, audit sur place et session collective, conviennent à une TPE.",
        },
      ],
    },
    en: {
      question: "Comment l'IA aide-t-elle une agence immobilière ?",
      answer:
        "En immobilier, l'IA rédige les annonces, qualifie les leads entrants, répond aux demandes 24/7, prépare les estimations à partir de données de marché, organise les visites et automatise les relances. Elle fait gagner un temps précieux sur l'administratif et la prospection, pour que les agents se concentrent sur la relation et la négociation.",
    },
  },
  {
    id: "ia-cabinet-comptable-conseil",
    reviewedAt: "2026-08-12",
    related: ["automatiser-facturation-ia", "ia-gestion-documents", "confidentialite-projet-ia"],
    fr: {
      question: "L'IA est-elle utile pour un cabinet comptable ou de conseil ?",
      answer:
        "Beaucoup, parce que le métier repose sur une production répétitive et très documentée. Concrètement : extraction et classement des pièces justificatives quel que soit le format dans lequel le client les envoie, pré-saisie des écritures, aide au rapprochement bancaire et au lettrage, relances automatiques pour les pièces manquantes avant la clôture. Côté conseil, l'IA synthétise des documents volumineux et prépare un premier jet de note ou de livrable, que l'associé retravaille.\n\nLe point non négociable est le cadre de confidentialité. Dossiers clients, données financières et pièces nominatives ne circulent pas n'importe où : c'est un prérequis de conception, pas une option, et il détermine le choix des outils comme celui de l'hébergement.\n\nBien posée, l'IA absorbe la production répétitive et redonne du temps au conseil à valeur ajoutée, c'est-à-dire au cœur du métier et à la partie que le client paie réellement.",
      keyPoints: [
        "Pièces justificatives extraites et classées quel que soit le format reçu",
        "Pré-saisie des écritures, aide au rapprochement bancaire et au lettrage",
        "Relances clients automatisées avant la clôture",
        "Documents volumineux synthétisés, premiers jets de notes et de livrables",
        "Confidentialité posée en prérequis de conception, pas en option",
      ],
      facts: [
        { figure: "5-15 h", label: "libérées par collaborateur" },
        { figure: "2-3", label: "cas d'usage pour démarrer" },
        { figure: "6-8 sem.", label: "pour une implémentation" },
        { figure: "30 j", label: "de support après déploiement" },
      ],
      steps: [
        {
          title: "Choisir un flux, pas le cabinet entier",
          detail:
            "Un seul type de pièce, sur un seul portefeuille. Un flux qui fonctionne bout en bout convainc davantage qu'un plan de transformation à l'échelle du cabinet.",
        },
        {
          title: "Poser le cadre de confidentialité d'abord",
          detail:
            "Quelles données sortent, lesquelles restent, où est l'hébergement, qui a accès. Cette décision vient avant le choix de l'outil, jamais après.",
        },
        {
          title: "Faire tourner sur des dossiers réels",
          detail:
            "Sur vos formats reçus, y compris les plus sales : photos de tickets, PDF scannés de travers, mails avec pièces jointes. C'est là que se joue la fiabilité.",
        },
        {
          title: "Former les collaborateurs à vérifier",
          detail:
            "Chaque collaborateur doit connaître les usages validés pour son rôle, les limites à ne pas franchir et la façon de contrôler une sortie d'IA avant de la valider.",
        },
      ],
      nuances: [
        {
          title: "Ce n'est pas la fin de la revue humaine",
          detail:
            "La responsabilité de l'expert-comptable ne se délègue pas à un outil. L'IA pré-saisit et propose ; la revue, le contrôle et la signature restent humains.",
        },
        {
          title: "Ce n'est pas un changement de logiciel comptable",
          detail:
            "L'IA se branche sur votre production existante via les API et les connecteurs. C'est une couche d'automatisation par-dessus votre outil, pas son remplaçant.",
        },
        {
          title: "Ce n'est pas réservé aux grands cabinets",
          detail:
            "Un cabinet de quelques collaborateurs démarre sur un flux unique. L'audit sur place et la session collective sont les formats d'entrée, y compris pour une TPE.",
        },
      ],
    },
    en: {
      question: "L'IA est-elle utile pour un cabinet comptable ou de conseil ?",
      answer:
        "Beaucoup. Pour un cabinet comptable ou de conseil, l'IA extrait et classe les pièces, pré-saisit les écritures, synthétise des documents volumineux, rédige des notes et des livrables, et automatise la relation client récurrente. Avec un cadre de confidentialité strict, elle absorbe la production répétitive pour redonner du temps au conseil à valeur ajoutée — le cœur du métier.",
    },
  },
  {
    id: "ia-industrie-production",
    reviewedAt: "2026-08-12",
    related: ["ia-btp-construction", "ia-integration-outils", "ia-gestion-documents"],
    fr: {
      question: "Comment l'IA s'applique-t-elle à l'industrie et à la production ?",
      answer:
        "Par deux portes, et la plus rentable n'est pas celle qu'on imagine. La porte évidente est celle de la production : prévisions de demande, contrôle qualité, exploitation des données machines. Elle suppose des données propres et un projet structuré, donc du temps.\n\nLa porte rapide est celle de la connaissance et du bureau. Rendre interrogeable la documentation technique, manuels, gammes, historiques de pannes, ordres de travail, pour qu'un technicien retrouve le bon protocole au lieu de fouiller des classeurs et des tableurs mal tenus. Automatiser la saisie des bons de commande qui arrivent en PDF, en mail et en Word chez l'administration des ventes, en se branchant sur l'ERP existant plutôt qu'en le remplaçant. Produire le reporting de production sans ressaisie.\n\nC'est de ce côté-là que les premiers gains arrivent le plus vite, et ils financent souvent les chantiers data plus lourds qui viennent ensuite.",
      keyPoints: [
        "Documentation technique rendue interrogeable : manuels, gammes, historiques de pannes",
        "Support et maintenance : retrouver le bon protocole en quelques secondes",
        "Saisie des bons de commande automatisée côté administration des ventes",
        "Reporting de production produit sans ressaisie",
        "Les gains rapides du bureau financent les chantiers data plus lourds",
      ],
      facts: [
        { figure: "3-5", label: "process passés au crible" },
        { figure: "6-8 sem.", label: "pour une implémentation" },
        { figure: "30 j", label: "de support après déploiement" },
        { figure: "48 h", label: "ouvrées pour le devis" },
      ],
      steps: [
        {
          title: "Commencer par la connaissance",
          detail:
            "Rassembler manuels, gammes, historiques de pannes et ordres de travail, puis les rendre interrogeables en langage naturel. Aucun capteur à installer pour cela.",
        },
        {
          title: "Cibler une saisie répétitive",
          detail:
            "Bons de commande, accusés de réception, bons de livraison : des documents qui arrivent dans tous les formats et que quelqu'un retape chaque jour à la main.",
        },
        {
          title: "Se brancher sur l'existant",
          detail:
            "ERP, GMAO, GED : l'IA se connecte via les API et les connecteurs. Une couche d'automatisation par-dessus le système actuel, pas une migration.",
        },
        {
          title: "Étendre vers la donnée machine",
          detail:
            "Prévisions de demande et qualité viennent après, une fois les données assainies et l'équipe convaincue. Une implémentation se déroule en 6 à 8 semaines.",
        },
      ],
      nuances: [
        {
          title: "Ce n'est pas un projet data de dix-huit mois",
          detail:
            "Les premiers gains ne demandent ni datalake ni capteurs : ils viennent de la documentation et de l'administratif de production, avec les données que vous avez déjà.",
        },
        {
          title: "Ce n'est pas un remplacement de l'ERP ou de la GMAO",
          detail:
            "Vos outils métier restent en place. L'IA s'y connecte pour extraire, contrôler et injecter, sans que vous ayez à refondre votre système d'information.",
        },
        {
          title: "Ce n'est pas un outil de plus imposé au terrain",
          detail:
            "Si un technicien doit faire dix clics en atelier, il ne s'en servira pas. L'usage terrain se teste avant le déploiement, pas après.",
        },
      ],
    },
    en: {
      question: "Comment l'IA s'applique-t-elle à l'industrie et à la production ?",
      answer:
        "Dans l'industrie, l'IA aide sur la documentation technique, le support et la maintenance (recherche dans les manuels, diagnostics assistés), la qualité, les prévisions de demande, le reporting et l'administratif de production. Au-delà des usages lourds en data, beaucoup de gains rapides viennent de l'automatisation des tâches de bureau et de la mise à disposition de la connaissance interne.",
    },
  },
  {
    id: "ia-e-commerce",
    reviewedAt: "2026-08-12",
    related: ["ia-commerce-retail", "creation-site-web-augmente-ia", "agent-vs-chatbot"],
    fr: {
      question: "Comment booster un e-commerce avec l'IA ?",
      answer:
        "En travaillant trois leviers, dans l'ordre que votre catalogue et votre trafic imposent. Le premier est le contenu : génération et mise à jour des fiches produits, sur des catalogues où personne n'a jamais eu le temps de tout rédiger, plus les textes de référencement et les e-mailings. Le deuxième est le parcours d'achat : un assistant qui pose deux ou trois questions et oriente vers la bonne référence, quand le visiteur se noie dans les options et abandonne son panier.\n\nLe troisième est l'après-vente : suivi de commande, retours, questions récurrentes, traités sans mobiliser une personne à plein temps. S'y ajoute la lecture des comportements d'achat, qui dit où le tunnel fuit.\n\nL'ordre compte plus que la liste. Sur un petit catalogue très visité, on commence par le parcours ; sur un gros catalogue mal décrit, par les fiches produits. C'est exactement ce qu'un audit IA tranche avant d'engager des développements.",
      keyPoints: [
        "Fiches produits générées et tenues à jour sur l'ensemble du catalogue",
        "Contenus de référencement et e-mailings rédigés en série",
        "Assistant d'achat qui oriente vers la bonne référence en deux ou trois questions",
        "Après-vente : suivi de commande, retours et questions récurrentes",
        "L'ordre des chantiers dépend de votre catalogue et de votre trafic",
      ],
      facts: [
        { figure: "2-3", label: "cas d'usage pour démarrer" },
        { figure: "1 j", label: "d'audit IA au maximum" },
        { figure: "5-15 h", label: "libérées par collaborateur" },
        { figure: "48 h", label: "ouvrées pour le devis" },
      ],
      steps: [
        {
          title: "Regarder où le tunnel fuit",
          detail:
            "Vos statistiques disent déjà beaucoup : pages produits sans conversion, paniers abandonnés, recherches internes sans résultat. Le premier chantier sort de ces chiffres.",
        },
        {
          title: "Trancher entre catalogue et parcours",
          detail:
            "Gros catalogue mal décrit : on commence par les fiches produits. Petit catalogue très visité : on commence par l'assistant d'achat. Rarement les deux en même temps.",
        },
        {
          title: "Se brancher sur la boutique existante",
          detail:
            "L'IA se connecte à votre plateforme e-commerce et à votre outil de support via leurs API. Une refonte complète n'est presque jamais le bon point de départ.",
        },
        {
          title: "Mesurer sur un périmètre restreint",
          detail:
            "Une catégorie, une gamme, un canal de support. On compare avant et après sur ce périmètre avant d'étendre à tout le catalogue.",
        },
      ],
      nuances: [
        {
          title: "Ce n'est pas une refonte de boutique",
          detail:
            "L'IA se greffe sur votre plateforme actuelle. Changer de solution e-commerce est un projet distinct, qui ne conditionne pas les premiers gains.",
        },
        {
          title: "Une fiche générée n'est pas une fiche publiée",
          detail:
            "Caractéristiques techniques, mentions obligatoires, allégations produit : tout cela engage le vendeur. Le premier jet est produit par l'IA, la validation reste humaine.",
        },
        {
          title: "Un assistant n'est pas un chatbot scripté",
          detail:
            "Un arbre de réponses figé frustre l'acheteur. Un assistant s'appuie sur votre catalogue réel, comprend une question formulée librement et sait dire qu'il ne sait pas.",
        },
      ],
    },
    en: {
      question: "Comment booster un e-commerce avec l'IA ?",
      answer:
        "Pour un e-commerce, l'IA génère et optimise les fiches produits, personnalise les recommandations, automatise le service client et les retours, rédige les contenus SEO et e-mailings, et analyse les comportements d'achat. Résultat : plus de conversions et moins de temps passé sur les tâches répétitives. On priorise les leviers selon votre catalogue et votre trafic.",
    },
  },
  {
    id: "automatiser-facturation-ia",
    reviewedAt: "2026-08-12",
    related: [
      "ia-gestion-documents",
      "automatisation-ia-workflow-metier",
      "ia-cabinet-comptable-conseil",
    ],
    fr: {
      question: "Peut-on automatiser la facturation et l'administratif avec l'IA ?",
      answer:
        "Oui, sur la partie répétitive du travail — la validation, elle, reste humaine. L'IA génère devis et factures à partir de vos modèles existants, lit les justificatifs entrants pour en extraire montants et références, rapproche les paiements, déclenche les relances d'impayés et prépare les éléments à transmettre à votre comptable. Elle se branche sur vos outils actuels (CRM, ERP, messagerie, tableur) par leurs API : vous ne changez pas de logiciel.\n\nLe point important : une automatisation de facturation ne vous met pas en conformité comptable ou fiscale par elle-même. Sur les champs critiques — montants, taux, mentions obligatoires — une étape de validation humaine est toujours prévue, et le contrôle final reste celui de votre comptable ou de votre expert-comptable. L'IA supprime la ressaisie et les erreurs de recopie, pas la responsabilité.\n\nEn pratique, on démarre sur un seul flux, la lecture des factures fournisseurs par exemple, on vérifie la fiabilité sur vos vrais documents, puis on étend. La fiabilité de l'extraction dépend de la régularité de vos pièces : sur des formats stables, elle est très bonne après calibrage.",
      keyPoints: [
        "Devis et factures produits depuis vos modèles existants",
        "Pièces entrantes lues et rattachées au bon dossier, sans ressaisie",
        "Rapprochement des paiements et relances d'impayés déclenchés seuls",
        "Validation humaine systématique sur les champs critiques",
        "Aucune conformité comptable ou fiscale automatique : votre comptable garde le contrôle",
      ],
      facts: [
        { figure: "5-8 sem", label: "mise en production" },
        { figure: "0", label: "ressaisie des pièces lues" },
        { figure: "2", label: "flux : production et lecture" },
        { figure: "30 j", label: "de support inclus" },
      ],
      steps: [
        {
          title: "Cadrage des documents concernés",
          detail:
            "On identifie les pièces à produire et à lire, leurs modèles, leurs champs et les sources de données métier à mobiliser. Le périmètre est arrêté avant toute ligne de code.",
        },
        {
          title: "Construction sur un flux pilote",
          detail:
            "On développe la génération assistée et le pipeline d'extraction sur un seul flux — les factures fournisseurs, par exemple — calibré sur vos documents réels.",
        },
        {
          title: "Mise en production avec point de contrôle",
          detail:
            "Le flux bascule dans vos outils, avec validation humaine sur les champs sensibles. On compare les sorties aux saisies manuelles avant de retirer le double contrôle.",
        },
        {
          title: "Calibrage puis extension",
          detail:
            "On affine les règles d'extraction au fil de vos retours, puis on ouvre le flux suivant : relances, rapprochement bancaire, préparation comptable.",
        },
      ],
      nuances: [
        {
          title: "Ce n'est pas une mise en conformité",
          detail:
            "L'automatisation traite la saisie et le classement. La conformité comptable et fiscale de vos documents relève de votre comptable ou de votre expert-comptable, pas de l'outil.",
        },
        {
          title: "Ce n'est pas un changement de logiciel",
          detail:
            "On se branche sur votre CRM, votre ERP ou votre outil de facturation par leurs API. Vos équipes continuent de travailler là où elles ont l'habitude.",
        },
        {
          title: "Ce n'est pas fiable sans calibrage",
          detail:
            "La qualité de l'extraction dépend de la régularité de vos documents. On calibre sur vos pièces réelles et on conserve une relecture sur les champs critiques.",
        },
      ],
    },
    en: {
      question: "Peut-on automatiser la facturation et l'administratif avec l'IA ?",
      answer:
        "Oui. L'IA peut générer les devis et factures, extraire les données des justificatifs, rapprocher les paiements, relancer les impayés et préparer les éléments pour la comptabilité. Couplée à vos outils existants, elle réduit fortement la saisie manuelle et les erreurs. L'humain garde la validation finale ; l'IA fait le travail répétitif en amont.",
    },
  },
  {
    id: "automatiser-service-client-ia",
    reviewedAt: "2026-08-12",
    related: [
      "chatbot-ia-entreprise",
      "ia-hallucinations-fiabilite",
      "automatisation-ia-workflow-metier",
    ],
    fr: {
      question: "Comment automatiser le service client avec l'IA ?",
      answer:
        "Oui, en commençant par le premier niveau. L'IA répond instantanément aux questions récurrentes, qualifie et route les demandes entrantes, rédige des brouillons de réponse que vos agents valident, et assure une présence hors horaires. Les cas complexes ou sensibles continuent d'être traités par vos équipes, avec l'IA en support : le but n'est pas de supprimer l'humain mais de le décharger du répétitif.\n\nLe point de vigilance, c'est la fiabilité des réponses. L'assistant travaille en recherche-réponse sur vos propres documents : il puise dans votre base de connaissances et cite ses sources. Quand l'information n'y figure pas, il le dit et propose un relais humain plutôt que de combler le vide. Les règles d'escalade — transfert à un agent, ouverture d'un ticket, collecte du contact pour rappel — sont fixées au cadrage, pas découvertes après coup.\n\nOn ne branche pas tous les canaux d'un coup. On démarre sur un périmètre mesurable, un type de demandes récurrentes, puis on étend au site, à Slack, à Teams ou à la messagerie une fois la qualité des réponses vérifiée sur des cas réels.",
      keyPoints: [
        "Réponse immédiate aux demandes récurrentes, hors horaires comprise",
        "Tri, routage et brouillons de réponse validés par vos agents",
        "Réponses puisées dans vos documents, avec citation de la source",
        "Règles d'escalade vers un humain fixées dès le cadrage",
        "Déploiement canal par canal, en partant d'un périmètre mesurable",
      ],
      facts: [
        { figure: "24/7", label: "réponses disponibles" },
        { figure: "100 %", label: "réponses sourcées" },
        { figure: "4-8 sem", label: "mise en service" },
      ],
      steps: [
        {
          title: "Cadrage des demandes réelles",
          detail:
            "On part des questions effectivement posées en SAV ou au support, on repère les sources documentaires à indexer et les moments où l'assistant doit passer la main.",
        },
        {
          title: "Construction du moteur de recherche-réponse",
          detail:
            "Indexation de vos documents, montage de la base de connaissances, réglage des garde-fous et du ton des réponses. L'assistant ne répond que sur ce corpus.",
        },
        {
          title: "Branchement sur un premier canal",
          detail:
            "Connexion au site, à Slack, à Teams ou à la messagerie visée, avec routage des demandes vers votre outil de ticketing ou votre CRM. Un canal à la fois.",
        },
        {
          title: "Suivi conversationnel et enrichissement",
          detail:
            "On relit les échanges, on repère les réponses ratées et on complète la base pour réduire les escalades évitables, avant d'ouvrir le canal suivant.",
        },
      ],
      nuances: [
        {
          title: "Ce n'est pas la suppression de votre service client",
          detail:
            "L'IA absorbe le niveau 1 et le répétitif. Les cas complexes, les réclamations et les sujets sensibles restent traités par vos agents, mieux préparés.",
        },
        {
          title: "Ce n'est pas un chatbot générique",
          detail:
            "L'assistant répond à partir de vos procédures et de vos fiches produits, pas d'un savoir général. Il cite ses sources et signale ce qu'il ne sait pas.",
        },
        {
          title: "Ce n'est pas un déploiement tout ou rien",
          detail:
            "On valide la qualité sur un type de demandes avant d'élargir. Un même moteur de connaissances alimente ensuite tous les canaux, donc une seule base à maintenir.",
        },
      ],
    },
    en: {
      question: "Comment automatiser le service client avec l'IA ?",
      answer:
        "L'IA peut répondre instantanément aux questions fréquentes, qualifier et router les demandes, rédiger des brouillons de réponse pour vos agents, et assurer un premier niveau 24/7. Le but n'est pas de supprimer l'humain mais de le décharger du répétitif et d'accélérer les réponses. Les cas complexes ou sensibles restent traités par vos équipes, avec l'IA en support.",
    },
  },
  {
    id: "ia-gestion-documents",
    reviewedAt: "2026-08-12",
    related: [
      "automatiser-facturation-ia",
      "implementation-ia-sur-mesure",
      "confidentialite-projet-ia",
    ],
    fr: {
      question: "Comment l'IA gère et exploite mes documents ?",
      answer:
        "L'IA fait trois choses sur vos documents : elle les lit, elle les classe, et elle vous permet de les interroger. Concrètement, elle extrait les informations clés de vos PDF, e-mails, contrats et rapports, les rattache au bon dossier, et vous laisse poser une question en langage naturel — « retrouve la clause de résiliation » — pour obtenir le passage pertinent avec le document source cité. Une masse de fichiers dispersés redevient une connaissance exploitable.\n\nLa recherche se fait par le sens et non par mot-clé exact : vous retrouvez la bonne clause sans savoir dans quel fichier elle se trouve ni comment elle est formulée. Les documents scannés passent par une étape de reconnaissance de texte avant extraction, à valider sur vos cas réels.\n\nCôté confidentialité, votre corpus sert uniquement à votre solution : ni les contrats, ni les pièces extraites, ni les index sémantiques ne sont réutilisés pour entraîner un service tiers. Les accès aux documents sensibles sont journalisés, et une validation humaine reste prévue sur les sorties à enjeu.",
      keyPoints: [
        "Lecture, classement et extraction automatiques des pièces entrantes",
        "Interrogation de vos archives en langage naturel, source citée",
        "PDF, documents bureautiques et e-mails ; scans via reconnaissance de texte",
        "Corpus jamais réutilisé pour entraîner un service tiers",
        "Validation humaine conservée sur les sorties sensibles",
      ],
      facts: [
        { figure: "5-8 sem", label: "mise en production" },
        { figure: "0", label: "ressaisie des pièces lues" },
        { figure: "2", label: "flux : production et lecture" },
      ],
      steps: [
        {
          title: "Cadrage des types de documents",
          detail:
            "On identifie les documents à produire et à lire, leurs modèles, leurs champs et les sources de données métier à mobiliser. Un type de document pour commencer.",
        },
        {
          title: "Construction de la génération et de l'extraction",
          detail:
            "On développe les modèles de production assistée et les pipelines d'extraction, avec un schéma de sortie calibré sur vos documents réels, pas sur des exemples types.",
        },
        {
          title: "Indexation du corpus et mise en production",
          detail:
            "Votre corpus est indexé pour la recherche sémantique, les flux sont déployés dans vos outils, avec validation humaine sur les sorties sensibles.",
        },
        {
          title: "Calibrage continu",
          detail:
            "On affine les modèles, les règles d'extraction et la pertinence de la recherche au fil de vos documents et de vos retours, puis on étend à d'autres types de pièces.",
        },
      ],
      nuances: [
        {
          title: "Ce n'est pas une GED de plus",
          detail:
            "On ne remplace pas votre système de classement : on lit, on extrait et on indexe ce que vous stockez déjà, là où vos équipes rangent leurs fichiers aujourd'hui.",
        },
        {
          title: "Ce n'est pas de la recherche par mot-clé",
          detail:
            "Le moteur retrouve les passages par le sens et cite les documents d'origine. Vous n'avez pas besoin de connaître le terme exact employé dans le contrat.",
        },
        {
          title: "Ce n'est pas un volume minimum obligatoire",
          detail:
            "La génération assistée est utile dès que vous produisez régulièrement les mêmes documents. La recherche sémantique, elle, prend sa valeur sur quelques centaines de pièces archivées.",
        },
      ],
    },
    en: {
      question: "Comment l'IA gère et exploite mes documents ?",
      answer:
        "L'IA lit, classe et résume vos documents (PDF, e-mails, contrats, rapports), en extrait les informations clés et permet de les interroger en langage naturel (« retrouve la clause de résiliation »). Elle transforme une masse de fichiers dispersés en connaissance exploitable, en quelques secondes, avec un contrôle d'accès et de confidentialité adapté à vos données.",
    },
  },
  {
    id: "ia-reporting-analyse-donnees",
    reviewedAt: "2026-08-12",
    related: ["automatisation-ia-workflow-metier", "roi-mesurer", "ia-hallucinations-fiabilite"],
    fr: {
      question: "L'IA peut-elle automatiser mon reporting et mes analyses ?",
      answer:
        "Oui — l'IA agrège vos données, produit les synthèses, et vous rend du temps pour décider. Elle va chercher les chiffres là où ils vivent (ERP, CRM, tableurs, outils métier), les consolide, rédige des tableaux de bord commentés en langage clair, repère les tendances et signale les anomalies : dérive de coût, erreur de stock, écart inhabituel. Vous passez moins de temps à compiler et plus à arbitrer.\n\nLes analyses restent vérifiables. On garde la traçabilité des sources derrière chaque chiffre, et les conclusions passent par un contrôle humain avant diffusion : un rapport commenté par une IA n'est pas une décision, c'est une matière première à décision.\n\nLe déploiement suit le même principe que nos autres automatisations. On part d'un indicateur que vous suivez aujourd'hui à la main, on l'automatise, on vérifie que le chiffre produit correspond à celui que vous obteniez, puis on étend au reste du tableau de bord. Le gain se mesure sur le temps récupéré par étape et le volume traité, pas sur un pourcentage annoncé d'avance.",
      keyPoints: [
        "Consolidation automatique des chiffres dispersés dans vos outils",
        "Tableaux de bord commentés en langage clair, mis à jour seuls",
        "Tendances et anomalies signalées avant qu'elles ne coûtent",
        "Traçabilité des sources et relecture humaine des conclusions",
        "On automatise d'abord un indicateur, puis on étend",
      ],
      facts: [
        { figure: "4-8 sem", label: "premier flux en production" },
        { figure: "3-6", label: "flux enchaînés par projet" },
        { figure: "J+3", label: "temps gagné observable" },
      ],
      steps: [
        {
          title: "Cadrage des indicateurs",
          detail:
            "On repère ce que vous suivez réellement, souvent dans un tableur, et on chiffre le temps passé chaque semaine à le compiler à la main.",
        },
        {
          title: "Branchement sur les sources",
          detail:
            "On connecte l'ERP, le CRM, les tableurs et les outils métier concernés par API ou connecteurs, en conservant la trace de l'origine de chaque chiffre.",
        },
        {
          title: "Premier tableau de bord en production",
          detail:
            "On met en service un périmètre restreint et on compare, pendant quelques cycles, le chiffre automatisé à celui que vous produisiez manuellement.",
        },
        {
          title: "Mesure puis extension",
          detail:
            "Une fois l'écart nul et le temps gagné constaté, on ouvre les indicateurs suivants : analyse client, prévisions, détection d'anomalies.",
        },
      ],
      nuances: [
        {
          title: "Ce n'est pas un outil de BI de plus",
          detail:
            "On se branche sur vos sources actuelles pour produire des synthèses commentées. Si vous avez déjà un outil de reporting, l'IA s'ajoute par-dessus plutôt qu'à la place.",
        },
        {
          title: "Ce n'est pas une décision automatisée",
          detail:
            "L'IA rédige l'analyse et signale l'anomalie ; l'arbitrage reste humain. Les conclusions sont relues avant d'être diffusées à un comité ou à un client.",
        },
        {
          title: "Ce n'est pas conditionné à des données propres",
          detail:
            "On travaille sur vos données telles qu'elles sont, tableurs bricolés compris. Si une source n'est pas exploitable en l'état, c'est un constat du cadrage, pas un pré-requis.",
        },
      ],
    },
    en: {
      question: "L'IA peut-elle automatiser mon reporting et mes analyses ?",
      answer:
        "Oui. L'IA agrège vos données, génère des synthèses et des tableaux de bord commentés, repère les tendances et anomalies, et produit des rapports lisibles à partir de chiffres bruts. Vous passez moins de temps à compiler et plus à décider. Les analyses restent vérifiables : on garde la traçabilité des sources et un contrôle humain sur les conclusions.",
    },
  },
  {
    id: "chatgpt-copilot-gemini-choisir",
    reviewedAt: "2026-08-12",
    related: ["chatgpt-vs-claude", "ia-gratuite-vs-payante", "outils-ia"],
    fr: {
      question: "ChatGPT, Copilot, Gemini, Claude : lequel choisir pour mon entreprise ?",
      answer:
        "Il n'existe pas de meilleur outil dans l'absolu, et il faut se méfier de qui vous l'affirme. Le bon choix dépend de 3 éléments : les usages réels de vos équipes, la suite bureautique que vous utilisez déjà, et vos contraintes de confidentialité.\n\nLa logique d'écosystème pèse souvent plus lourd que les performances brutes. Copilot vit dans l'environnement Microsoft et travaille au plus près de vos fichiers et de votre messagerie ; Gemini fait de même côté Google ; ChatGPT et Claude s'emploient surtout comme assistants autonomes, solides sur le raisonnement, l'analyse de documents et la rédaction. Si toute votre entreprise est déjà sur une suite, commencer par l'assistant qui s'y intègre évite des mois de friction inutile.\n\nAxion-IA est indépendant des éditeurs : la recommandation vient de votre contexte, jamais d'un partenariat commercial. Et la meilleure décision se prend après avoir essayé, sur vos propres dossiers, ce que chacun donne vraiment — en journée de coaching 1-to-1 de 7 à 8 heures, ou en formation collective de 2 à 15 participants.",
      keyPoints: [
        "Aucun outil n'est meilleur dans l'absolu : tout dépend du contexte",
        "Trois critères : usages réels, suite bureautique en place, confidentialité",
        "Copilot côté Microsoft, Gemini côté Google, ChatGPT et Claude autonomes",
        "L'intégration à l'existant évite des mois de friction",
        "Axion-IA est indépendant des éditeurs, sans partenariat commercial",
      ],
      facts: [
        { figure: "3", label: "critères qui décident" },
        { figure: "7-8 h", label: "journée de coaching 1-to-1" },
        { figure: "2-15", label: "participants en formation" },
      ],
      steps: [
        {
          title: "Partir des usages réels",
          detail:
            "Lister ce que vos équipes font vraiment chaque semaine : rédaction, synthèse, recherche, analyse de fichiers. Le besoin dominant oriente le choix mieux qu'un comparatif.",
        },
        {
          title: "Regarder votre suite bureautique",
          detail:
            "Si tout passe déjà par Microsoft ou par Google, l'assistant intégré à cette suite part avec un avantage de terrain considérable sur ses concurrents.",
        },
        {
          title: "Trancher la question des données",
          detail:
            "Vérifier la formule retenue, l'engagement de non-entraînement sur vos données et ce que vos équipes ont le droit de saisir. Ce critère élimine plus d'options que la performance.",
        },
        {
          title: "Essayer sur vos propres dossiers",
          detail:
            "Une prise en main sur vos vrais documents révèle en quelques heures ce qu'aucun banc d'essai publié ne montrera jamais.",
        },
      ],
      nuances: [
        {
          title: "Ce n'est pas un choix définitif",
          detail:
            "Rien n'oblige à standardiser toute l'entreprise sur un seul assistant, ni à s'y tenir indéfiniment. Les positions changent vite entre éditeurs.",
        },
        {
          title: "Le comparatif de fonctionnalités n'est pas le bon angle",
          detail:
            "Les listes de fonctions se ressemblent et vieillissent en quelques semaines. Ce qui compte, c'est ce que vos équipes utiliseront réellement lundi matin.",
        },
        {
          title: "La version gratuite ne dit rien de l'usage professionnel",
          detail:
            "Elle ne reflète ni les capacités des formules professionnelles, ni leurs garanties de confidentialité. Tester en gratuit pour décider en pro fausse la comparaison.",
        },
      ],
    },
    en: {
      question: "ChatGPT, Copilot, Gemini, Claude : lequel choisir pour mon entreprise ?",
      answer:
        "Il n'y a pas de « meilleur » outil dans l'absolu : le bon choix dépend de vos usages, de vos outils existants et de vos contraintes de confidentialité. Copilot s'intègre à l'écosystème Microsoft, Gemini à Google, Claude et ChatGPT excellent sur le raisonnement et la rédaction. Axion-IA est indépendant des éditeurs : on recommande l'outil adapté à VOTRE contexte, pas celui d'un partenariat.",
    },
  },
  {
    id: "ia-gratuite-vs-payante",
    reviewedAt: "2026-08-12",
    related: [
      "ia-donnees-entrainement-confidentialite",
      "chatgpt-copilot-gemini-choisir",
      "securite-donnees-ia",
    ],
    fr: {
      question: "Les versions gratuites d'IA suffisent-elles ou faut-il payer ?",
      answer:
        "Pour découvrir, les versions gratuites suffisent largement. Pour un usage professionnel régulier, elles montrent vite leurs limites — et pas celles qu'on imagine.\n\nLe vrai sujet n'est pas la puissance du modèle, c'est la confidentialité. Sur les offres grand public gratuites, vos échanges peuvent être réutilisés pour améliorer les modèles ; sur les formules professionnelles et les accès API, les principaux fournisseurs s'engagent à ne pas s'entraîner sur vos données. Dès qu'un salarié colle un contrat, un fichier client ou un tableau de résultats dans un assistant, la question cesse d'être théorique. S'y ajoutent des limites d'usage plus hautes, des modèles plus performants et l'intégration à vos outils existants.\n\nRamené au temps gagné sur une seule tâche récurrente, l'abonnement d'un collaborateur se rentabilise vite. L'erreur classique n'est donc pas de payer trop tôt : c'est de payer sans configurer la confidentialité et sans expliquer aux équipes ce qu'elles ont le droit de saisir. Le paramétrage et les règles d'usage font davantage pour votre sécurité que le niveau d'abonnement.",
      keyPoints: [
        "Gratuit : très bien pour découvrir et se faire une opinion",
        "Payant : la vraie différence porte sur la confidentialité des données",
        "Offres pro et API : engagement de non-entraînement sur vos données",
        "S'y ajoutent limites d'usage plus hautes et intégration aux outils",
        "Payer sans configurer ni former ne protège de rien",
      ],
      nuances: [
        {
          title: "Ce n'est pas qu'une question de puissance",
          detail:
            "L'écart de qualité entre gratuit et payant existe, mais il pèse moins lourd que l'écart de garanties sur le traitement de vos données.",
        },
        {
          title: "Un abonnement ne rend pas l'usage conforme",
          detail:
            "La conformité RGPD dépend de ce que vos équipes saisissent et de la configuration retenue, pas de la ligne qui figure sur votre facture.",
        },
        {
          title: "Ce n'est pas tout ou rien",
          detail:
            "Équiper d'abord les postes qui traitent des données sensibles ou de gros volumes suffit souvent. Inutile de basculer toute l'entreprise d'un seul coup.",
        },
      ],
    },
    en: {
      question: "Les versions gratuites d'IA suffisent-elles ou faut-il payer ?",
      answer:
        "Pour découvrir, les versions gratuites suffisent. Pour un usage professionnel, les versions payantes apportent ce qui compte vraiment : confidentialité (vos données ne servent pas à l'entraînement), modèles plus performants, limites d'usage plus hautes, et intégration à vos outils. Le coût est généralement modeste face au temps gagné — l'enjeu est surtout de bien configurer la confidentialité.",
    },
  },
  {
    id: "ia-droit-auteur-contenu",
    reviewedAt: "2026-08-12",
    related: ["ia-donnees-entrainement-confidentialite", "ai-act-2026", "ia-biais-objectivite"],
    fr: {
      question: "Puis-je utiliser commercialement le contenu généré par IA ?",
      answer:
        "Oui dans la plupart des cas, mais la protection ne suit pas automatiquement. Les principaux outils autorisent l'usage commercial des contenus que vous générez — cela se vérifie dans leurs conditions du moment, qui évoluent. En revanche, en France comme dans l'Union européenne, le droit d'auteur suppose une création originale portant l'empreinte d'une personne : un contenu purement généré, sans apport humain, n'est pas automatiquement protégé.\n\nDeux points de vigilance en découlent. Un contenu non protégé peut être repris librement par un concurrent, ce qui compte pour une signature éditoriale, un slogan ou un visuel de marque. Et une sortie trop proche d'une œuvre existante — style reconnaissable, composition, formulation — reste une prise de risque, même si l'outil ne l'a pas signalée.\n\nTrois réflexes suffisent le plus souvent : relire et réécrire pour y mettre votre valeur ajoutée, vérifier les ressemblances sur les contenus exposés publiquement, et informer le lecteur quand la loi l'exige — l'AI Act prévoit cette transparence à l'article 50. Pour un enjeu contractuel ou de marque, la question se tranche avec votre conseil.",
      keyPoints: [
        "Usage commercial généralement autorisé, à vérifier dans les conditions du moment",
        "Un contenu purement généré n'est pas automatiquement protégé",
        "Ce qui n'est pas protégé peut être repris par un concurrent",
        "Vigilance sur les ressemblances avec des œuvres existantes",
        "Transparence sur les contenus générés : AI Act, article 50",
      ],
      facts: [
        { figure: "3", label: "réflexes avant publication" },
        { figure: "art. 50", label: "transparence AI Act" },
        { figure: "UE", label: "cadre juridique de référence" },
      ],
      nuances: [
        {
          title: "Usage commercial et droit d'auteur sont deux questions",
          detail:
            "Pouvoir exploiter un contenu ne signifie pas en détenir un monopole. Les conditions de l'outil règlent la première question, le droit règle la seconde.",
        },
        {
          title: "Ne pas se fier aux conditions d'hier",
          detail:
            "Les conditions d'utilisation des éditeurs changent régulièrement. Elles se relisent au moment où vous industrialisez un usage, pas une fois pour toutes.",
        },
        {
          title: "Cette page n'est pas un avis juridique",
          detail:
            "Le droit d'auteur appliqué à l'IA évolue vite et les décisions varient selon les pays. Les arbitrages engageants se prennent avec votre conseil.",
        },
      ],
    },
    en: {
      question: "Puis-je utiliser commercialement le contenu généré par IA ?",
      answer:
        "En général oui, mais avec nuances. Les principaux outils autorisent l'usage commercial des contenus que vous générez (vérifiez leurs conditions). En revanche, en France comme dans l'UE, un contenu purement généré par IA n'est pas automatiquement protégé par le droit d'auteur, et il faut rester vigilant sur les ressemblances avec des œuvres existantes. La bonne pratique : relire, adapter et apporter votre valeur humaine.",
    },
  },
  {
    id: "ia-biais-objectivite",
    reviewedAt: "2026-08-12",
    related: ["ia-hallucinations-fiabilite", "risques-ia-entreprise", "ai-act-2026"],
    fr: {
      question: "L'IA est-elle objective ou peut-elle être biaisée ?",
      answer:
        "Non, l'IA n'est pas objective, et mieux vaut le savoir avant de s'en servir. Un modèle reflète les données sur lesquelles il a été entraîné : il en reprend les angles morts, les stéréotypes et les déséquilibres, sans jamais signaler qu'il le fait. Il ne fabrique pas ses biais, il les hérite — puis les reformule dans une prose fluide et assurée, ce qui les rend d'autant plus difficiles à repérer.\n\nPour un usage professionnel, cela impose des garde-fous simples. Vérifier les sorties sur les sujets sensibles : recrutement, évaluation, juridique, crédit, tarification. Ne jamais déléguer une décision qui affecte une personne — l'IA prépare, l'humain tranche et assume. Documenter les usages, pour pouvoir expliquer plus tard comment une décision a été prise. Sur l'évaluation des personnes, le cadre réglementaire européen se durcit d'ailleurs nettement.\n\nBien encadrée, l'IA est un excellent assistant d'analyse et de rédaction. Elle ne doit jamais devenir un juge automatique. Axion-IA pose ces règles avec vos équipes au moment de la mise en place, pas après le premier incident.",
      keyPoints: [
        "Un modèle hérite des biais présents dans ses données d'entraînement",
        "Le style assuré rend ces biais nettement plus difficiles à repérer",
        "Vérification systématique sur RH, juridique, crédit, tarification",
        "L'IA prépare la décision ; l'humain la tranche et l'assume",
        "Documenter les usages pour pouvoir les expliquer ensuite",
      ],
      nuances: [
        {
          title: "Ce n'est pas le défaut d'un éditeur en particulier",
          detail:
            "Tous les modèles apprennent sur des données produites par des humains. Changer d'outil déplace le biais, il ne le supprime pas.",
        },
        {
          title: "Ce n'est pas parce que c'est chiffré que c'est neutre",
          detail:
            "Un score ou un classement produit par une IA paraît objectif. Il porte pourtant exactement les mêmes partis pris que le texte qui l'accompagne.",
        },
        {
          title: "Ce n'est pas une raison de s'en priver",
          detail:
            "Un humain pressé a lui aussi ses biais, et ils sont moins traçables. L'enjeu est d'encadrer l'usage et de le documenter, pas de renoncer à l'outil.",
        },
      ],
    },
    en: {
      question: "L'IA est-elle objective ou peut-elle être biaisée ?",
      answer:
        "L'IA n'est pas neutre : elle reflète les données sur lesquelles elle a été entraînée et peut reproduire des biais. Pour un usage professionnel, cela impose des garde-fous : vérifier les sorties sur les sujets sensibles (RH, juridique, finance), ne pas déléguer les décisions importantes à la machine, et documenter les usages. Bien encadrée, l'IA est un excellent assistant ; elle ne doit pas être un juge automatique.",
    },
  },
  {
    id: "ia-donnees-entrainement-confidentialite",
    reviewedAt: "2026-08-12",
    related: ["securite-donnees-ia", "ia-gratuite-vs-payante", "confidentialite-projet-ia"],
    fr: {
      question: "Mes données servent-elles à entraîner l'IA ?",
      answer:
        "Cela dépend entièrement de l'offre utilisée, et c'est le premier réglage à vérifier. Sur les formules grand public gratuites, les conversations peuvent être réutilisées pour améliorer les modèles, parfois par défaut. Sur les offres professionnelles et les accès par API, les conditions prévoient généralement l'inverse — mais elles varient d'un éditeur à l'autre et changent au fil des versions : elles se lisent au moment du déploiement, pas une fois pour toutes.\n\nLa vérification tient en trois temps. Identifier précisément l'offre et le compte réellement utilisés. Ouvrir les paramètres de confidentialité pour désactiver ce qui doit l'être. Puis inscrire la règle retenue dans le cadre du projet. Lorsque Axion-IA traite des données personnelles pour votre compte, un accord de sous-traitance au titre de l'article 28 du RGPD précise ce qui est fait des données.\n\nC'est un point passé en revue systématiquement au cadrage : le choix de l'outil se fait aussi sur ce critère, et l'hébergement des solutions déployées reste européen par défaut.",
      keyPoints: [
        "Tout dépend de l'offre : grand public gratuite, professionnelle ou API",
        "Les conditions varient selon l'éditeur et changent au fil des versions",
        "Le réglage se vérifie compte par compte, pas au niveau de l'entreprise",
        "Configuration retenue inscrite dans le cadre du projet",
        "Hébergement des solutions déployées européen par défaut",
      ],
      facts: [
        { figure: "3", label: "points à vérifier" },
        { figure: "art. 28", label: "cadre RGPD de sous-traitance" },
        { figure: "UE", label: "hébergement par défaut" },
      ],
      steps: [
        {
          title: "Identifier l'offre réellement utilisée",
          detail:
            "Compte personnel gratuit, abonnement professionnel ou accès par API : ce n'est pas le même régime, et les équipes mélangent souvent les trois sans le savoir.",
        },
        {
          title: "Régler les paramètres du compte",
          detail:
            "La plupart des offres exposent un réglage d'entraînement ou d'historique. Il se vérifie compte par compte, à la mise en service puis lors des changements de version.",
        },
        {
          title: "Écrire la règle plutôt que la supposer",
          detail:
            "La configuration retenue est consignée dans le cadre du projet, avec un accord de sous-traitance RGPD dès que des données personnelles sont concernées.",
        },
      ],
      nuances: [
        {
          title: "Payer ne suffit pas",
          detail:
            "Une offre professionnelle mal configurée reste mal configurée. Le réglage se constate sur le compte, pas sur la facture.",
        },
        {
          title: "Ce n'est pas un engagement d'Axion-IA sur des outils tiers",
          detail:
            "Les conditions des éditeurs leur appartiennent et évoluent. Ce qu'Axion-IA apporte, c'est de les vérifier au cadrage et de vous dire précisément ce qu'elles prévoient.",
        },
        {
          title: "Entraînement et confidentialité ne se confondent pas",
          detail:
            "Même sans réutilisation pour l'entraînement, vos données transitent chez un prestataire. La question du lieu de traitement et du cadre de transfert reste entière.",
        },
      ],
    },
    en: {
      question: "Mes données servent-elles à entraîner l'IA ?",
      answer:
        "Cela dépend de l'outil et de la formule. Avec les offres grand public gratuites, vos échanges peuvent parfois être réutilisés ; avec les offres professionnelles et API, les principaux fournisseurs s'engagent à ne pas entraîner leurs modèles sur vos données. C'est un point que nous vérifions systématiquement chez Axion-IA : on choisit des configurations où vos données restent les vôtres.",
    },
  },
  {
    id: "erreurs-eviter-projet-ia",
    reviewedAt: "2026-08-12",
    related: ["comment-commencer", "roi-mesurer", "qui-pilote-ia-entreprise"],
    fr: {
      question: "Quelles erreurs éviter quand on se lance dans l'IA ?",
      answer:
        "Cinq erreurs reviennent presque toujours : vouloir tout automatiser d'un coup, choisir l'outil avant d'avoir défini le besoin, négliger la confidentialité des données, déployer sans former les équipes, et ne jamais mesurer ce que le projet a rapporté. Elles ont un point commun : elles font démarrer le projet par la technologie au lieu du travail réel.\n\nLa méthode inverse paraît plus lente sur le papier et se révèle bien plus rapide en pratique. On part d'un cas concret à fort impact, on prouve le gain sur vos propres données, on sécurise le cadre, on embarque les équipes, puis on étend à d'autres process. Sur une journée de cartographie terrain, 3 à 5 process candidats suffisent à repérer les deux ou trois qui méritent vraiment un déploiement.\n\nUn dernier réflexe : distinguer l'outil de l'usage. Un abonnement souscrit pour toute l'entreprise, sans référent, sans règle de relecture et sans cas d'usage identifié, ne produit pas d'IA dans l'entreprise — il produit une ligne de dépense.",
      keyPoints: [
        "Tout automatiser d'un coup : le piège le plus coûteux",
        "Choisir l'outil avant le besoin, c'est partir à l'envers",
        "Confidentialité et formation ne sont pas des options de fin de projet",
        "Un projet non mesuré ne se défend pas au budget suivant",
        "Un abonnement sans référent ni cas d'usage n'est qu'une dépense",
      ],
      facts: [
        { figure: "5", label: "erreurs les plus fréquentes" },
        { figure: "3-5", label: "process passés en revue" },
        { figure: "1", label: "cas d'usage pour démarrer" },
      ],
      steps: [
        {
          title: "Partir d'un cas concret",
          detail:
            "Un process chronophage, documenté, avec un responsable identifié. Pas une ambition générale d'utiliser davantage l'IA.",
        },
        {
          title: "Prouver le gain sur vos données",
          detail:
            "Démonstration sur vos vrais documents et chiffrage du temps gagné, avant tout déploiement à l'échelle.",
        },
        {
          title: "Sécuriser le cadre",
          detail:
            "Outil choisi en connaissance de ses conditions de traitement des données, règles de relecture écrites, hébergement arbitré selon la sensibilité.",
        },
        {
          title: "Embarquer puis étendre",
          detail:
            "Former les personnes concernées, mesurer le résultat sur les indicateurs convenus, et seulement ensuite passer au process suivant.",
        },
      ],
      nuances: [
        {
          title: "Commencer petit n'est pas manquer d'ambition",
          detail:
            "Un premier cas prouvé finance et légitime les suivants. Un grand programme non prouvé s'arrête au premier arbitrage budgétaire.",
        },
        {
          title: "Ce n'est pas un sujet d'informaticiens",
          detail:
            "Les process les plus rentables à automatiser sont administratifs et commerciaux. Ils se cartographient avec celles et ceux qui les exécutent.",
        },
        {
          title: "Un pilote réussi n'est pas un déploiement",
          detail:
            "Passer de la démonstration à la production suppose du cadrage technique, des tests utilisateurs et un déploiement progressif. C'est une étape à part entière.",
        },
      ],
    },
    en: {
      question: "Quelles erreurs éviter quand on se lance dans l'IA ?",
      answer:
        "Les pièges classiques : vouloir tout automatiser d'un coup, choisir l'outil avant le besoin, négliger la confidentialité des données, déployer sans former les équipes, et ne pas mesurer le ROI. La bonne méthode est inverse : partir d'un cas concret à fort impact, prouver le gain, sécuriser les données, embarquer les équipes, puis étendre. C'est exactement la démarche que cadre l'audit.",
    },
  },
  {
    id: "qui-pilote-ia-entreprise",
    reviewedAt: "2026-08-12",
    related: ["former-equipes-ia", "comment-commencer", "erreurs-eviter-projet-ia"],
    fr: {
      question: "Qui doit piloter l'IA dans l'entreprise ?",
      answer:
        "Trois rôles, et surtout pas un service informatique dédié. La direction donne la vision et arbitre les priorités. Un référent métier motivé — le « champion » interne — porte l'usage au quotidien et sert de premier recours pour ses collègues. Un accompagnement externe apporte le cadrage et la montée en compétence, le temps que l'autonomie s'installe.\n\nDans les TPE et PME, c'est souvent le dirigeant lui-même qui impulse, et c'est une bonne nouvelle : les décisions se prennent vite. L'essentiel tient alors en deux conditions. Un sponsor clairement identifié à la direction, parce qu'un projet IA sans arbitre s'enlise dès qu'il touche à un process partagé entre plusieurs services. Et un premier cas d'usage concret, parce que rien n'embarque une équipe comme un collègue qui gagne des heures chaque semaine.\n\nLe référent n'a pas besoin d'être technicien. Il doit connaître le process, avoir envie d'essayer, et disposer de temps reconnu pour le faire. Une journée de cartographie terrain suffit généralement à désigner les bons candidats et à fixer le premier périmètre.",
      keyPoints: [
        "Trois rôles : direction, référent métier, accompagnement externe",
        "Aucun service informatique dédié n'est nécessaire",
        "Un sponsor clairement identifié à la direction pour arbitrer",
        "Un référent qui connaît le process, pas forcément un technicien",
        "Un premier cas d'usage concret pour embarquer l'équipe",
      ],
      facts: [
        { figure: "3", label: "rôles à réunir" },
        { figure: "1", label: "sponsor à la direction" },
        { figure: "1 jour", label: "pour cadrer le premier cas" },
      ],
      nuances: [
        {
          title: "Ce n'est pas un poste à créer",
          detail:
            "Dans une PME, le référent consacre quelques heures par semaine à ce rôle. Il ne change pas de métier, il gagne une responsabilité reconnue.",
        },
        {
          title: "Ce n'est pas un sujet réservé à l'informatique",
          detail:
            "Les gains les plus rapides sont administratifs et commerciaux. Un pilotage exclusivement technique passe à côté des process qui coûtent le plus cher.",
        },
        {
          title: "Un comité ne remplace pas un sponsor",
          detail:
            "Multiplier les instances ralentit l'arbitrage. Une personne qui décide et un référent qui fait suffisent largement pour démarrer.",
        },
      ],
    },
    en: {
      question: "Qui doit piloter l'IA dans l'entreprise ?",
      answer:
        "Pas besoin d'un service informatique dédié. Le pilotage idéal associe la direction (vision et priorités), un référent métier motivé (le « champion » interne) et un accompagnement externe pour le cadrage et la montée en compétence. Dans les TPE/PME, c'est souvent le dirigeant lui-même qui impulse. L'essentiel : un sponsor clair et un premier cas d'usage concret pour embarquer les équipes.",
    },
  },
  // ── Batch FAQ #3 — par service (keyword-rich, EN = clone FR car EN désactivé).
  //    Services réels : audit · formation/interventions · implémentation ·
  //    sites web & SaaS IA · coaching 1-to-1. NDA OK → « formation » autorisé ;
  //    jamais OPCO/CPF/Qualiopi ; aucun prix chiffré inventé. ────────────────────
  {
    id: "audit-ia-tpe-pme",
    reviewedAt: "2026-08-12",
    related: ["audit-ia-definition", "cout-audit-ia-entreprise", "premier-diagnostic-ia"],
    fr: {
      question: "Quel audit IA pour une TPE ou une PME ?",
      answer:
        "Cela dépend surtout de votre effectif. Une TPE de 1 à 19 salariés — artisan, commerçant, profession libérale, indépendant — relève de l'audit sur place : une journée complète dans vos locaux, de 9 h à 17 h. On cartographie toute l'activité, on teste l'IA en direct sur deux ou trois de vos vrais cas, et le rapport de synthèse suit sous 48 heures ouvrées.\n\nUne PME s'oriente vers l'audit Ciblé quand un seul département est concerné — marketing, RH, opérations, finance, juridique ou support — sur trois à quatre semaines. Quand plusieurs services le sont, c'est l'audit Stratégique PME : deux à quatre services cartographiés sur cinq à six semaines, avec une roadmap 12-24 mois et une restitution en COMEX.\n\nDans tous les cas, vous repartez avec une feuille de route priorisée et chiffrée, calibrée sur votre taille et votre secteur — pas un rapport théorique. Un appel de cadrage permet de choisir le bon niveau avant tout devis : c'est le point de départ le plus sûr pour démarrer l'IA sans se disperser.",
      keyPoints: [
        "TPE de 1 à 19 salariés : audit sur place, 1 journée complète dans vos locaux",
        "PME, un seul département concerné : audit Ciblé, 3 à 4 semaines",
        "PME, plusieurs services : Stratégique PME, 5 à 6 semaines et roadmap 12-24 mois",
        "Rapport de synthèse sous 48 h ouvrées pour l'audit sur place",
        "Un appel de cadrage fixe le bon niveau avant tout devis",
      ],
      facts: [
        { figure: "1-19", label: "salariés pour l'audit TPE" },
        { figure: "1 j", label: "sur site pour une TPE" },
        { figure: "2-4", label: "services en Stratégique PME" },
        { figure: "12-24 mois", label: "de roadmap PME" },
      ],
      steps: [
        {
          title: "L'appel de cadrage",
          detail:
            "Un échange court pour décrire votre contexte et votre périmètre prioritaire. C'est là que se choisit le niveau d'audit adapté à votre taille.",
        },
        {
          title: "Le terrain",
          detail:
            "Une journée complète sur site pour une TPE, ou des entretiens répartis sur trois à six semaines pour une PME, selon le nombre de services concernés.",
        },
        {
          title: "Le rapport et la restitution",
          detail:
            "Feuille de route priorisée et chiffrée : sous 48 heures ouvrées pour l'audit sur place, en fin de mission avec restitution COMEX pour une PME.",
        },
      ],
      nuances: [
        {
          title: "Ce n'est pas réservé aux entreprises déjà équipées",
          detail:
            "Beaucoup d'audits partent d'une entreprise qui n'utilise l'IA nulle part. L'objectif est précisément de dire par où commencer, et avec quoi.",
        },
        {
          title: "Ce n'est pas une formation",
          detail:
            "L'audit cartographie et priorise ; il ne fait pas monter vos équipes en compétence. C'est l'objet des formations collectives ou du coaching 1-to-1, souvent en suite d'audit.",
        },
        {
          title: "Ce n'est pas un forfait unique",
          detail:
            "Quatre niveaux existent selon la taille et le périmètre. L'audit d'une TPE et celui d'une PME multi-services ne mobilisent pas le même travail.",
        },
      ],
    },
    en: {
      question: "Quel audit IA pour une TPE ou une PME ?",
      answer:
        "L'audit IA Axion-IA s'adapte aux TPE et PME : en une demi-journée à une journée, on cartographie vos processus, on identifie les cas d'usage IA les plus rentables pour votre taille et votre secteur, et on chiffre le ROI. Vous repartez avec une feuille de route concrète et priorisée — pas un rapport théorique. C'est le point de départ idéal pour démarrer l'IA sans se disperser.",
    },
  },
  {
    id: "audit-maturite-ia-entreprise",
    reviewedAt: "2026-08-12",
    related: ["audit-ia-definition", "premier-diagnostic-ia", "qui-pilote-ia-entreprise"],
    fr: {
      question: "Qu'est-ce qu'un audit de maturité IA d'entreprise ?",
      answer:
        "C'est l'évaluation de votre point de départ, avant toute décision d'investissement. Un audit de maturité IA regarde cinq choses : les outils d'IA déjà utilisés dans l'entreprise, y compris les usages informels que personne n'a déclarés ; le niveau réel des équipes ; la qualité et l'accessibilité de vos données ; les processus automatisables ; et votre conformité, RGPD comme AI Act 2026.\n\nIl en sort une photographie objective de votre situation et les prochaines étapes prioritaires. L'intérêt est d'éviter deux erreurs symétriques : investir dans des outils que personne n'utilisera parce que le niveau des équipes n'y est pas, ou lancer une automatisation sur des données trop dispersées pour être exploitables.\n\nChez Axion-IA, cette évaluation n'est pas une prestation séparée : elle constitue la première phase de l'audit IA, quel que soit le niveau retenu. Les entretiens terrain et la collecte documentaire servent d'abord à situer votre maturité, avant de scorer les opportunités par ROI estimé et complexité technique. Un appel de cadrage permet de dimensionner le périmètre à couvrir.",
      keyPoints: [
        "Cinq dimensions : outils en place, niveau des équipes, données, processus, conformité",
        "Les usages informels comptent autant que les outils officiels",
        "Une photographie objective de votre point de départ, pas un classement",
        "Évite d'investir dans des outils que personne n'utilisera",
        "Première phase de l'audit IA Axion-IA, pas une prestation séparée",
      ],
      facts: [
        { figure: "5", label: "dimensions évaluées" },
        { figure: "2026", label: "AI Act pris en compte" },
        { figure: "4", label: "niveaux d'audit possibles" },
      ],
      nuances: [
        {
          title: "Ce n'est pas un score de vanité",
          detail:
            "L'intérêt n'est pas de recevoir une note mais de savoir quelle étape est bloquante : les données, les compétences ou la conformité.",
        },
        {
          title: "Ce n'est pas réservé aux grandes entreprises",
          detail:
            "Une TPE a une maturité IA comme une ETI. L'audit sur place d'une journée couvre exactement ce même terrain, à l'échelle d'une petite structure.",
        },
        {
          title: "Ce n'est pas une prestation distincte",
          detail:
            "L'évaluation de maturité est intégrée à la première phase de chaque audit IA Axion-IA. Il n'y a pas de format « maturité » à commander séparément.",
        },
      ],
    },
    en: {
      question: "Qu'est-ce qu'un audit de maturité IA d'entreprise ?",
      answer:
        "Un audit de maturité IA évalue où en est votre entreprise face à l'intelligence artificielle : outils déjà utilisés, niveau des équipes, qualité et accessibilité de vos données, processus automatisables, et conformité (RGPD, AI Act). Il situe votre maturité et trace les prochaines étapes prioritaires. C'est une photographie objective qui évite d'investir au hasard et concentre les efforts là où l'IA rapporte vraiment.",
    },
  },
  {
    id: "cout-audit-ia-entreprise",
    reviewedAt: "2026-08-12",
    related: ["tarifs-publics-transparents", "aides-subventions-ia", "audit-ia-definition"],
    fr: {
      question: "Combien coûte un audit IA pour une entreprise ?",
      answer:
        "Les tarifs d'audit sont publics et affichés, sans devis opaque ni prix caché. Ils s'annoncent toujours comme un plancher, le chiffrage réel se faisant au cas par cas selon le périmètre couvert. Audit sur place pour une TPE, une journée complète dans vos locaux : {{price:audit-flash}}. Audit Ciblé sur un département : {{price:audit-cible}}. Audits Stratégiques, PME comme ETI : {{price:audit-strategique-pme}}.\n\nCe qui fait varier le montant, ce n'est pas votre effectif en soi mais le périmètre réel : le nombre de services cartographiés, le nombre d'entretiens terrain, la profondeur des livrables, et la présence ou non d'un volet gouvernance. Un département simple traité à distance et un groupe multi-BU ne mobilisent pas le même travail.\n\nLe devis détaillé arrive sous 48 heures ouvrées après l'appel de cadrage, et il est ferme : vous savez exactement ce que vous payez, et pourquoi, avant tout engagement. Pour les groupes très grands, une phase de cadrage précède le devis afin de figer le périmètre.",
      keyPoints: [
        "Tarifs publics et affichés, annoncés comme un plancher",
        "Audit sur place pour une TPE : {{price:audit-flash}}",
        "Audit Ciblé sur un département : {{price:audit-cible}}",
        "Audits Stratégiques PME et ETI : {{price:audit-strategique-pme}}",
        "Devis détaillé et ferme sous 48 h ouvrées",
      ],
      facts: [
        { figure: "4", label: "niveaux tarifés" },
        { figure: "48 h", label: "pour le devis détaillé" },
        { figure: "1 j", label: "sur site, niveau TPE" },
      ],
      nuances: [
        {
          title: "Ce n'est pas un forfait unique",
          detail:
            "Quatre niveaux existent, du format TPE d'une journée à l'audit transverse multi-BU. Un montant annoncé sans périmètre défini ne veut rien dire.",
        },
        {
          title: "Un tarif d'entrée n'est pas le prix final",
          detail:
            "Les prix d'audit s'affichent comme un plancher. Le devis, lui, est ferme : il fixe le périmètre, les entretiens et les livrables avant signature.",
        },
        {
          title: "Le prix ne dépend pas que de votre effectif",
          detail:
            "Un département avec des intégrations techniques lourdes demande plus de travail qu'un périmètre simple traité à distance, à effectif égal. C'est la complexité qui compte.",
        },
      ],
    },
    en: {
      question: "Combien coûte un audit IA pour une entreprise ?",
      answer:
        "Axion-IA pratique des tarifs publics et transparents pour l'audit IA, avec un tarif d'entrée clair selon le format (audit flash sur site ou audit approfondi), et un devis détaillé pour les missions plus larges. L'investissement reste modeste face au temps gagné identifié, et certains diagnostics peuvent être partiellement co-financés (France Num, BPI, subventions régionales) selon votre profil.",
    },
  },
  {
    id: "premier-diagnostic-ia",
    reviewedAt: "2026-08-12",
    related: ["audit-ia-definition", "audit-maturite-ia-entreprise", "comment-commencer"],
    fr: {
      question: "Comment se passe un premier diagnostic IA ?",
      answer:
        "Tout commence par un appel de cadrage, court et sans engagement : vous décrivez votre activité, vos irritants et vos objectifs, et on détermine ensemble le niveau adapté. Le diagnostic lui-même, c'est l'audit IA — une prestation à part entière, avec livrable écrit.\n\nIl se déroule ensuite en trois temps. On observe vos processus et vos outils tels qu'ils fonctionnent réellement, en entretiens terrain ou sur une journée complète dans vos locaux pour une TPE. On repère les tâches chronophages automatisables et on teste l'IA en direct sur deux ou trois de vos vrais cas, jamais sur une démonstration générique. On identifie enfin les cas d'usage à fort impact pour démarrer vite, chacun scoré par ROI estimé et complexité technique.\n\nVous ressortez avec des actions concrètes et un ordre de priorité clair, pas une liste de bonnes intentions : ce qui s'active tout de suite, ce qui peut attendre, ce qu'il vaut mieux abandonner. Le plan est rédigé pour que vos équipes puissent l'exécuter seules.",
      keyPoints: [
        "Un appel de cadrage d'abord, pour caler le périmètre et le niveau",
        "Le diagnostic lui-même, c'est l'audit IA — une prestation à part entière",
        "Observation des processus réels, y compris les procédures orales",
        "2 à 3 cas d'usage à fort impact testés en direct sur vos vrais dossiers",
        "En sortie : des actions classées par priorité, ROI et complexité",
      ],
      facts: [
        { figure: "3", label: "temps du diagnostic" },
        { figure: "2-3", label: "cas d'usage prioritaires" },
        { figure: "1 j", label: "sur site pour une TPE" },
      ],
      steps: [
        {
          title: "L'appel de cadrage",
          detail:
            "Vous décrivez votre activité, vos irritants et vos objectifs. On en déduit le périmètre prioritaire et le niveau d'audit adapté à votre taille.",
        },
        {
          title: "L'observation du terrain",
          detail:
            "Entretiens et observation de vos processus et outils tels qu'ils fonctionnent vraiment, y compris les procédures orales qui ne sont écrites nulle part.",
        },
        {
          title: "Les tests sur vos vrais cas",
          detail:
            "On teste l'IA en direct sur deux ou trois situations réelles de votre quotidien. Vous voyez ce qui marche, et tout aussi utile, ce qui ne marche pas.",
        },
        {
          title: "La priorisation",
          detail:
            "Chaque cas d'usage est scoré par ROI estimé et complexité, puis replacé dans un plan : ce qui démarre maintenant, ce qui attend, ce qu'on abandonne.",
        },
      ],
      nuances: [
        {
          title: "L'appel de cadrage n'est pas le diagnostic",
          detail:
            "L'appel sert à caler le périmètre et le bon niveau. Le diagnostic lui-même, c'est l'audit IA : une intervention sur le terrain avec un livrable écrit.",
        },
        {
          title: "Ce n'est pas un questionnaire à remplir",
          detail:
            "On observe vos processus en situation. Les frictions d'équipe et les procédures orales ne remontent jamais dans un formulaire d'auto-évaluation.",
        },
        {
          title: "Ce n'est pas un préalable obligatoire à une vente",
          detail:
            "Le plan est rédigé pour que vos équipes puissent l'exécuter seules. Passer à l'implémentation avec nous reste une décision distincte, prise après lecture du rapport.",
        },
      ],
    },
    en: {
      question: "Comment se passe un premier diagnostic IA ?",
      answer:
        "Le premier diagnostic IA commence par un échange pour comprendre votre activité, vos irritants et vos objectifs. On observe ensuite vos processus et vos outils, on repère les tâches chronophages automatisables, et on identifie 2 à 3 cas d'usage à fort impact pour démarrer vite. L'objectif : sortir avec des actions concrètes et un ordre de priorité clair, pas une liste de bonnes intentions.",
    },
  },
  {
    id: "formation-ia-entreprise",
    reviewedAt: "2026-08-12",
    related: ["formation-ia-difference", "presentiel-distance", "equipes-operationnelles"],
    fr: {
      question: "Comment se passe une formation IA en entreprise ?",
      answer:
        "Toujours en intra, dans vos locaux ou à distance, pour un seul et même groupe de 2 à 15 personnes. Une journée type dure 7 heures ; le catalogue va de la demi-journée de 4 heures aux formats de 2 journées, ceux-ci étant scindables en journées espacées.\n\nLe déroulé est le même partout. On pose d'abord le cadre — ce qu'une IA sait faire, ce qu'elle fait mal, et les données qui ne sortent jamais de l'entreprise — puis chaque notion est démontrée en direct avant d'être pratiquée immédiatement sur les tâches réelles apportées par les participants. Les exercices sont différenciés par profil et une partie se fait en binômes. La journée se termine par ce que chacun applique dès le lundi suivant.\n\nEn amont, on cale avec vous la formation, les cas à travailler et, si besoin, les accès aux outils : le délai d'accès est d'au moins 11 jours ouvrés à compter de la confirmation. À l'issue, un quiz individuel de 10 questions valide les acquis, avec un seuil de réussite à 7 sur 10, et une attestation individuelle est remise.",
      keyPoints: [
        "Toujours en intra : une session est montée pour une seule entreprise",
        "Groupe de 2 à 15 personnes, sur site ou à distance, au même tarif",
        "Journée type de 7 heures ; du format 4 heures aux parcours de 2 journées",
        "Le cadre de confidentialité est posé avant tout atelier",
        "Quiz individuel de 10 questions et attestation individuelle à l'issue",
      ],
      facts: [
        { figure: "7 h", label: "pour une journée type" },
        { figure: "2-15", label: "participants par groupe" },
        { figure: "11 j", label: "ouvrés de délai d'accès" },
        { figure: "10", label: "questions au quiz final" },
      ],
      steps: [
        {
          title: "Cadrage en amont",
          detail:
            "On choisit la formation, on liste les cas à travailler et on prépare si besoin les accès aux outils. Le délai d'accès est d'au moins 11 jours ouvrés après confirmation.",
        },
        {
          title: "Le cadre, avant tout atelier",
          detail:
            "Ce que l'IA sait faire, ce qu'on ne lui confie jamais, et les données qui ne sortent pas de l'entreprise. Ce module précède systématiquement la pratique.",
        },
        {
          title: "Démonstration puis pratique",
          detail:
            "Chaque notion est montrée en direct, puis appliquée immédiatement aux tâches réelles apportées par les participants, en exercices différenciés et en binômes.",
        },
        {
          title: "Vérification et suite",
          detail:
            "On relit les productions avec une grille, puis chacun écrit ce qu'il applique dès lundi. Quiz individuel de 10 questions, seuil à 7 sur 10, puis attestation.",
        },
      ],
      nuances: [
        {
          title: "Ce n'est pas une session inter-entreprises",
          detail:
            "Le groupe vient d'une seule entreprise. C'est ce qui permet de travailler sur des dossiers confidentiels et d'écrire une trame commune réellement utilisable ensuite.",
        },
        {
          title: "Le tarif ne dépend pas du nombre de participants",
          detail:
            "Il est fixé par groupe et par formation, jamais par personne : réunir 12 collaborateurs plutôt que 4 ne change pas le montant du devis.",
        },
        {
          title: "Une formation n'est pas une implémentation",
          detail:
            "La formation rend l'équipe autonome sur ses outils. Concevoir et déployer une automatisation dans vos systèmes relève de l'implémentation IA, une prestation distincte.",
        },
      ],
    },
    en: {
      question: "Comment se passe une formation IA en entreprise ?",
      answer:
        "La formation IA Axion-IA est 100 % pratique et adaptée à vos métiers : on part de vos cas réels, pas de théorie. Sur site ou à distance, vos équipes manipulent les outils, apprennent à rédiger des prompts efficaces, à vérifier les réponses et à travailler en sécurité (confidentialité des données). Elles repartent autonomes et opérationnelles dès le lendemain, avec des gains de temps mesurables sur leurs tâches quotidiennes.",
    },
  },
  {
    id: "formation-chatgpt-claude-entreprise",
    reviewedAt: "2026-08-12",
    related: ["outils-ia", "chatgpt-vs-claude", "formation-ia-entreprise"],
    fr: {
      question: "Proposez-vous une formation ChatGPT ou Claude pour les entreprises ?",
      answer:
        "Oui, et sans se limiter à un seul éditeur. Les formations Axion-IA font pratiquer côte à côte les trois assistants les plus utilisés en entreprise — ChatGPT, Claude et Gemini — pour que chacun sache lequel choisir selon le besoin, plutôt que d'apprendre par cœur les menus d'un produit. Le reste du paysage (Microsoft Copilot, Mistral, Perplexity, Midjourney, Sora, HeyGen) est situé en panorama, pour savoir à quoi sert quoi, sans être manipulé en séance.\n\nLe contenu va au-delà de la prise en main : formuler une demande structurée avec la méthode AXION, construire des prompts réutilisables sur ses tâches récurrentes, créer ses propres assistants, vérifier une production avant de la diffuser, et savoir quelles données ne se soumettent jamais.\n\nCe parti pris d'indépendance a une raison simple : les modèles changent vite. Une compétence attachée à un seul produit se périme avec lui ; une méthode de formulation et de vérification, non. Les sessions se tiennent en intra, en groupe de 2 à 15 personnes, sur site ou à distance, de la demi-journée de 4 heures aux parcours de 2 journées.",
      keyPoints: [
        "ChatGPT, Claude et Gemini pratiqués côte à côte, sur vos propres cas",
        "Copilot, Mistral, Perplexity et les outils d'image ou de vidéo situés en panorama",
        "Au-delà des bases : prompts réutilisables, assistants personnels, vérification avant diffusion",
        "Les règles de confidentialité posées avant tout atelier",
        "Formation indépendante des éditeurs — la méthode survit au changement de modèle",
      ],
      facts: [
        { figure: "3", label: "assistants pratiqués en séance" },
        { figure: "2-15", label: "participants par groupe" },
        { figure: "4 h", label: "format le plus court" },
        { figure: "7 h", label: "pour une journée type" },
      ],
      nuances: [
        {
          title: "Ce n'est pas une formation à un produit",
          detail:
            "On ne fait pas le tour des menus de ChatGPT ou de Claude. On apprend à formuler et à vérifier — ce qui reste vrai quand l'interface ou le modèle change.",
        },
        {
          title: "Panorama ne veut pas dire pratiqué",
          detail:
            "Copilot, Mistral, Perplexity, Midjourney, Sora et HeyGen sont situés pour que vous sachiez à quoi ils servent. Ils ne sont pas manipulés pendant la session.",
        },
        {
          title: "Ce n'est pas une formation technique",
          detail:
            "Aucun code, aucune API : le format s'adresse à des équipes non techniques. Seule la formation destinée aux profils IT suppose une aisance en développement.",
        },
      ],
    },
    en: {
      question: "Proposez-vous une formation ChatGPT ou Claude pour les entreprises ?",
      answer:
        "Oui. Axion-IA forme vos équipes à l'usage professionnel des IA génératives (ChatGPT, Claude, Copilot, Gemini) selon vos outils et vos besoins. On va au-delà des bases : prompts métier efficaces, automatisations concrètes, bonnes pratiques de confidentialité et vérification des réponses. La formation est indépendante des éditeurs : on vous apprend à utiliser l'outil le plus adapté à votre contexte, pas à dépendre d'un seul.",
    },
  },
  {
    id: "atelier-ia-equipe",
    reviewedAt: "2026-08-12",
    related: ["former-equipes-ia", "formation-ia-entreprise", "equipes-operationnelles"],
    fr: {
      question: "Qu'est-ce qu'un atelier IA pour une équipe ?",
      answer:
        "C'est le format court du catalogue : une demi-journée de 4 heures, en intra, avec un groupe de 2 à 15 personnes qui travaille sur ses propres tâches. Il sert à lancer une dynamique et à lever les blocages, pas à couvrir tout le sujet — c'est précisément ce qui permet de le caler sans désorganiser une semaine de travail.\n\nLe déroulé tient en trois temps. On pose d'abord le cadre : ce qu'une IA générative sait faire, ce qu'elle fait mal, et ce qu'on ne lui confie jamais, à commencer par les données qui ne sortent pas de l'entreprise. On installe ensuite une méthode de formulation, la méthode AXION, démontrée puis appliquée par chacun à une tâche de son poste jusqu'à obtenir un résultat exploitable. On termine par trois usages à emporter et par ce que chacun met en place dès le lundi suivant.\n\nSi l'équipe utilise déjà l'IA mais chacun à sa façon, la journée complète est plus adaptée : elle laisse le temps de construire des prompts réutilisables et une trame commune.",
      keyPoints: [
        "Demi-journée de 4 heures, en intra, groupe de 2 à 15 personnes",
        "Sur les tâches réelles apportées par les participants",
        "Trois temps : le cadre, la méthode de formulation, les usages à emporter",
        "Aucun prérequis — le format accueille aussi les débutants complets",
        "Chacun repart avec ce qu'il met en place dès le lundi suivant",
      ],
      facts: [
        { figure: "4 h", label: "une demi-journée" },
        { figure: "3", label: "modules au programme" },
        { figure: "2-15", label: "participants par groupe" },
        { figure: "0", label: "prérequis" },
      ],
      steps: [
        {
          title: "Le cadre",
          detail:
            "Ce que l'IA générative sait faire, ce qu'elle fait mal, et ce qu'on ne lui confie jamais. Les données qui ne sortent pas de l'entreprise sont posées avant tout exercice.",
        },
        {
          title: "La méthode de formulation",
          detail:
            "La méthode AXION est démontrée en direct, puis chacun l'applique à une tâche réelle de son poste jusqu'à obtenir un résultat exploitable — pas une réponse générique.",
        },
        {
          title: "Trois usages à emporter",
          detail:
            "On retient les usages qui tiennent vraiment dans le quotidien de l'équipe, et chacun écrit par quoi il commence dès le lundi suivant.",
        },
      ],
      nuances: [
        {
          title: "Ce n'est pas une démonstration à regarder",
          detail:
            "Chacun pratique sur son propre poste et sur ses vraies tâches. Le formateur passe d'un participant à l'autre : la salle produit, elle n'assiste pas.",
        },
        {
          title: "4 heures ne remplacent pas un parcours",
          detail:
            "Le format lève les blocages et installe les premiers usages. Construire des automatisations et les mettre en service demande un format de 2 journées.",
        },
        {
          title: "Ce n'est pas réservé aux petites équipes",
          detail:
            "Jusqu'à 15 participants au même tarif, fixé par groupe. Pour réunir toute l'entreprise le même jour, jusqu'à 50 personnes, c'est le séminaire qui prend le relais.",
        },
      ],
    },
    en: {
      question: "Qu'est-ce qu'un atelier IA pour une équipe ?",
      answer:
        "Un atelier IA est une session courte et pratique où votre équipe travaille sur ses propres cas d'usage, en direct, avec un expert. En quelques heures, on identifie les tâches à automatiser, on teste des outils, et chacun repart avec des automatisations concrètes applicables immédiatement. C'est un format idéal pour lancer une dynamique IA dans l'équipe et lever les blocages, sans monopoliser des journées entières.",
    },
  },
  {
    id: "formation-ia-dirigeants",
    reviewedAt: "2026-08-12",
    related: [
      "coaching-ia-cadres-managers",
      "coaching-1-to-1-dirigeant",
      "formation-ia-entreprise",
    ],
    fr: {
      question: "Existe-t-il une formation IA pour dirigeants et managers ?",
      answer:
        "Oui, sous deux formes qu'il vaut mieux ne pas confondre. Pour le dirigeant lui-même, le format le plus direct est la journée 1-to-1 : 7 à 8 heures en tête-à-tête avec un intervenant senior, sur son poste réel et ses propres dossiers — préparation de réunions, analyse, rédaction, veille — avec un état des lieux de son poste et un plan d'action chiffré à la clé.\n\nPour une équipe de direction ou une ligne managériale, ce sont les interventions collectives : une journée en intra, en groupe de 2 à 15 personnes, sur site ou à distance, avec les mêmes fondamentaux que pour les autres équipes — formuler une demande structurée, choisir le bon assistant, vérifier avant de diffuser, protéger les données — appliqués cette fois aux tâches d'un manager.\n\nDans les deux cas, l'objectif est double : gagner du temps personnellement, et savoir cadrer puis piloter la démarche IA de ses équipes sans être un expert technique. Pour réunir toute l'entreprise le même jour, jusqu'à 50 participants, c'est le format séminaire qui prend le relais.",
      keyPoints: [
        "Deux formats : la journée 1-to-1 pour le dirigeant, l'intervention collective pour l'équipe de direction",
        "1-to-1 : 7 à 8 heures en tête-à-tête, sur ses propres dossiers",
        "Collectif : une journée en intra, 2 à 15 personnes, sur site ou à distance",
        "Objectif double : gagner du temps et savoir piloter la démarche IA de ses équipes",
        "Séminaire jusqu'à 50 participants pour réunir toute l'entreprise le même jour",
      ],
      facts: [
        { figure: "7-8 h", label: "en tête-à-tête (1-to-1)" },
        { figure: "1", label: "seule personne en 1-to-1" },
        { figure: "2-15", label: "participants en collectif" },
        { figure: "50", label: "participants au séminaire" },
      ],
      nuances: [
        {
          title: "Ce n'est pas une conférence sur l'IA",
          detail:
            "On ne commente pas les tendances du marché : on travaille sur les dossiers réels du dirigeant ou de ses managers, et on repart avec des méthodes appliquées.",
        },
        {
          title: "Le 1-to-1 et le collectif ne se remplacent pas",
          detail:
            "Le 1-to-1 accueille une seule personne, une journée entière, sur son poste. L'intervention collective installe une pratique partagée dans une équipe.",
        },
        {
          title: "Le tarif du 1-to-1 dépend du profil accompagné",
          detail:
            "Journée avec le dirigeant : {{price:intervention-dirigeants|flat}}. Journée avec un collaborateur : {{price:intervention-membre-equipe|flat}}. Le devis suit sous 48 h ouvrées.",
        },
      ],
    },
    en: {
      question: "Existe-t-il une formation IA pour dirigeants et managers ?",
      answer:
        "Oui. Axion-IA propose des formations et un accompagnement IA dédiés aux dirigeants, DG, DRH et managers : comment intégrer l'IA dans son quotidien (préparation de réunions, analyse, rédaction stratégique, veille), comment cadrer une démarche IA dans son entreprise, et comment piloter sans être expert technique. L'objectif est double : gagner du temps personnellement et savoir conduire la transformation IA de ses équipes.",
    },
  },
  {
    id: "implementation-ia-sur-mesure",
    reviewedAt: "2026-08-12",
    related: [
      "delai-implementation",
      "integration-ia-entreprise-concrete",
      "accompagnement-post-implementation",
    ],
    fr: {
      question: "Qu'est-ce qu'une implémentation IA sur mesure ?",
      answer:
        "C'est la conception et le déploiement d'une solution IA calée sur vos processus, et non sur ceux d'un logiciel du marché : automatisation d'un workflow, agent métier, traitement documentaire, assistant interne, intégration à vos outils existants. Contrairement à un outil générique, elle épouse votre façon de travailler et vos contraintes de sécurité et de RGPD.\n\nLe déroulé est toujours le même : cadrage technique et ateliers métier, développement par sprints courts avec des démos régulières, recette puis mise en production dans vos outils, enfin une phase de suivi. Comptez six à huit semaines pour la majorité des cas, avec trente jours de support correctif inclus à la livraison. Pas d'effet tunnel : vous voyez la solution prendre forme à chaque sprint.\n\nÀ la fin, le code et la documentation vous sont livrés, et vos équipes sont formées pour rester autonomes. Aucun abonnement n'est imposé et la maintenance reste optionnelle. C'est le même intervenant senior qui cadre le besoin et qui livre la solution, sans passage de relais entre un avant-vente et une équipe de production.",
      keyPoints: [
        "Une solution calée sur vos processus, pas un outil générique adapté",
        "Sprints courts, démos régulières, validation métier à chaque étape",
        "Six à huit semaines pour la majorité des cas",
        "Code et documentation livrés, équipes formées, aucun abonnement imposé",
        "Le même intervenant senior du cadrage à la livraison",
      ],
      facts: [
        { figure: "6-8 sem", label: "du cadrage à la production" },
        { figure: "1 sem", label: "de cadrage technique" },
        { figure: "3-5", label: "opérationnels en phase de test" },
        { figure: "30 j", label: "de support inclus" },
      ],
      steps: [
        {
          title: "Cadrage et conception",
          detail:
            "Ateliers métier, choix d'architecture, backlog priorisé et spécifications claires. Vous savez exactement ce qui va être construit, et pourquoi, avant le premier sprint.",
        },
        {
          title: "Développement itératif",
          detail:
            "On construit par sprints courts, avec une démo et une validation métier à chaque étape. Deux à quatre semaines suffisent en général pour une première version utilisable.",
        },
        {
          title: "Recette et mise en production",
          detail:
            "Tests utilisateurs par trois à cinq opérationnels, corrections, puis passage en production dans vos outils. Le code et la documentation vous sont remis.",
        },
        {
          title: "Suivi et évolution",
          detail:
            "Trente jours de support correctif sont inclus pour les ajustements. Ensuite, vous faites évoluer à la demande, sans maintenance imposée.",
        },
      ],
      nuances: [
        {
          title: "Ce n'est pas un logiciel sur étagère",
          detail:
            "Un outil du marché vous demande d'adapter vos process aux siens. Ici, c'est l'inverse : la solution se construit à partir de votre façon de travailler et de vos contraintes.",
        },
        {
          title: "Ce n'est pas un abonnement",
          detail:
            "Le projet est cadré et devisé, le code vous est livré avec sa documentation. Un contrat de maintenance existe, mais il reste optionnel.",
        },
        {
          title: "Ce n'est pas un audit IA",
          detail:
            "L'audit cartographie et chiffre les opportunités de toute l'entreprise ; l'implémentation construit et met en production une solution. Ce sont deux prestations distinctes.",
        },
      ],
    },
    en: {
      question: "Qu'est-ce qu'une implémentation IA sur mesure ?",
      answer:
        "L'implémentation IA sur mesure consiste à concevoir et déployer une solution IA adaptée à VOS processus : automatisation d'un workflow, agent IA métier, traitement documentaire, assistant interne, intégration à vos outils existants. Contrairement à un outil générique, elle épouse votre façon de travailler et vos contraintes (sécurité, RGPD). Axion-IA livre une solution opérationnelle, testée et documentée, avec un accompagnement pour l'ancrer durablement.",
    },
  },
  {
    id: "integration-ia-entreprise-concrete",
    reviewedAt: "2026-08-12",
    related: ["implementation-ia-sur-mesure", "deroule-mission-axion", "delai-implementation"],
    fr: {
      question: "Comment intégrer concrètement l'IA dans mon entreprise ?",
      answer:
        "Par étapes, et en commençant petit. Un audit IA identifie d'abord les cas d'usage à plus fort retour, chiffrés et classés par complexité. On déploie ensuite une première solution sur un seul de ces cas, on forme les équipes concernées, on mesure les gains réels, puis on étend au suivant. Cette progression prouve la valeur en quelques semaines et évite les grands programmes coûteux qui n'aboutissent jamais.\n\nL'IA se greffe sur vos outils existants — CRM, ERP, messagerie, agenda — via leurs API ou des connecteurs. Vous ne refondez pas votre système d'information, et vos équipes continuent de travailler là où elles ont l'habitude.\n\nRien n'oblige à aller au bout : la démarche est volontairement découplée du contrat long. Vous pouvez vous arrêter après l'audit, après la première implémentation ou après la mesure, et le plan chiffré reste exploitable même si vous internalisez la suite. Beaucoup d'entreprises déploient elles-mêmes les gains rapides identifiés en début de parcours, puis reviennent pour les chantiers plus lourds.",
      keyPoints: [
        "Un cas d'usage à la fois, choisi pour son retour et sa faisabilité",
        "Greffe sur vos outils existants, sans refonte du système d'information",
        "Formation des équipes concernées avant la mise en service",
        "Gains mesurés sur des indicateurs convenus avant le déploiement",
        "Arrêt possible à la fin de chaque étape, sans lock-in technique ni commercial",
      ],
      facts: [
        { figure: "4", label: "étapes de la méthode" },
        { figure: "5 j", label: "pour l'audit IA" },
        { figure: "6-8 sem", label: "jusqu'à la production" },
        { figure: "30 j", label: "pour déployer un gain rapide" },
      ],
      steps: [
        {
          title: "Identifier",
          detail:
            "Une journée sur site pour cartographier vos process, retenir trois à cinq candidats à l'IA et repérer les gains rapides déployables sous trente jours.",
        },
        {
          title: "Auditer",
          detail:
            "Cinq jours pour chiffrer chaque opportunité, la scorer sur le retour et la complexité, et vous remettre un plan priorisé que vos équipes peuvent exécuter.",
        },
        {
          title: "Implémenter",
          detail:
            "Six à huit semaines pour passer du plan à une solution qui tourne dans vos outils : cadrage technique, prototype itératif, tests, déploiement progressif.",
        },
        {
          title: "Mesurer",
          detail:
            "On revient compter ce que ça a rapporté, sur les indicateurs convenus au départ : heures et coûts économisés, impact qualitatif. Itération si une dérive apparaît.",
        },
      ],
      nuances: [
        {
          title: "Ce n'est pas un grand programme de transformation",
          detail:
            "On ne lance pas dix chantiers en parallèle. Un cas d'usage est déployé, mesuré et adopté avant qu'on ouvre le suivant.",
        },
        {
          title: "Ce n'est pas un changement d'outils",
          detail:
            "L'IA se branche sur votre CRM, votre ERP et votre messagerie par leurs API. Aucune refonte du système d'information n'est nécessaire pour démarrer.",
        },
        {
          title: "Ce n'est pas un engagement de longue durée",
          detail:
            "Chaque étape produit un livrable qui se suffit à lui-même. Vous pouvez vous arrêter après l'audit et déployer la suite en interne.",
        },
      ],
    },
    en: {
      question: "Comment intégrer concrètement l'IA dans mon entreprise ?",
      answer:
        "On procède par étapes : un audit identifie le cas d'usage à plus fort ROI, on déploie une première solution IA sur ce cas précis, on forme les équipes concernées, on mesure les gains, puis on étend. L'IA se greffe sur vos outils existants (CRM, ERP, messagerie) sans tout remplacer. Cette approche progressive prouve la valeur rapidement et évite les grands projets coûteux qui n'aboutissent pas.",
    },
  },
  {
    id: "chatbot-ia-entreprise",
    reviewedAt: "2026-08-12",
    related: ["agent-vs-chatbot", "automatiser-service-client-ia", "ia-hallucinations-fiabilite"],
    fr: {
      question: "Peut-on créer un chatbot ou un assistant IA pour mon entreprise ?",
      answer:
        "Oui, et branché sur vos propres contenus. Axion-IA conçoit des assistants et chatbots IA sur mesure : réponse aux clients hors horaires, support interne pour vos équipes, assistant commercial ou documentaire. Contrairement à un chatbot générique, il répond à partir de vos informations réelles — procédures, fiches produits, base d'articles — et cite le document d'où vient sa réponse.\n\nC'est ce qui règle la question des réponses inventées : l'assistant puise uniquement dans votre base de connaissances indexée. Quand l'information n'y figure pas, il le dit et bascule vers un humain selon des règles d'escalade fixées au cadrage. Les échanges et les documents indexés sont hébergés dans l'UE par défaut, et le modèle retenu peut être contraint pour exclure toute réutilisation de vos conversations à des fins d'entraînement.\n\nLa connaissance vit dans vos documents, pas dans le code : vous mettez à jour une procédure, l'assistant en tient compte après ré-indexation, sans nous solliciter. Un même moteur alimente tous les canaux — site, Slack, Teams, messagerie — donc vous ne maintenez qu'une seule base.",
      keyPoints: [
        "Répond sur vos documents et cite l'origine de chaque réponse",
        "Dit qu'il ne sait pas et passe la main plutôt que d'inventer",
        "Un seul moteur de connaissances pour tous les canaux",
        "Vous mettez à jour un document, l'assistant suit après ré-indexation",
        "Échanges et corpus hébergés dans l'UE par défaut",
      ],
      facts: [
        { figure: "4-8 sem", label: "mise en service" },
        { figure: "24/7", label: "réponses disponibles" },
        { figure: "100 %", label: "réponses sourcées" },
      ],
      steps: [
        {
          title: "Cadrage des questions réelles",
          detail:
            "On part des demandes effectivement posées en SAV, en helpdesk ou en qualification de leads, et on liste les sources documentaires à indexer.",
        },
        {
          title: "Construction du moteur de recherche-réponse",
          detail:
            "Indexation de vos documents, montage de la base de connaissances, réglage des garde-fous, du ton et des règles d'escalade vers un humain.",
        },
        {
          title: "Branchement sur vos canaux",
          detail:
            "Connexion au site, à Slack, à Teams ou à la messagerie visée, avec routage des demandes vers votre outil de ticketing ou votre CRM.",
        },
        {
          title: "Suivi et enrichissement de la base",
          detail:
            "On relit les échanges, on repère les réponses ratées et on complète le corpus pour réduire les escalades évitables au fil des semaines.",
        },
      ],
      nuances: [
        {
          title: "Ce n'est pas un chatbot à scénarios",
          detail:
            "Pas d'arbre de dialogue à maintenir. L'assistant comprend la question telle qu'elle est posée et va chercher la réponse dans vos documents indexés.",
        },
        {
          title: "Ce n'est pas un agent IA",
          detail:
            "Un chatbot répond et oriente. Dès qu'il faut enchaîner plusieurs étapes et déclencher une action dans vos systèmes, on parle d'agent — un autre type de projet.",
        },
        {
          title: "Ce n'est pas un remplacement de vos agents",
          detail:
            "Les demandes simples sont traitées, le reste est routé vers la bonne personne. Vos équipes récupèrent du temps sur les cas qui en méritent vraiment.",
        },
      ],
    },
    en: {
      question: "Peut-on créer un chatbot ou un assistant IA pour mon entreprise ?",
      answer:
        "Oui. Axion-IA conçoit des assistants et chatbots IA sur mesure, branchés sur VOS contenus et vos données : réponse aux clients 24/7, support interne pour vos équipes, assistant commercial ou documentaire. Contrairement à un chatbot générique, il répond à partir de vos informations réelles, avec un cadre de confidentialité maîtrisé. On garde l'humain dans la boucle pour les cas sensibles.",
    },
  },
  {
    id: "automatisation-ia-workflow-metier",
    reviewedAt: "2026-08-12",
    related: ["ia-vs-automatisation", "automatiser-taches-ia", "implementation-ia-sur-mesure"],
    fr: {
      question: "Comment automatiser un workflow métier avec l'IA ?",
      answer:
        "On cartographie le flux réel avant d'automatiser quoi que ce soit : étapes, déclencheurs, points de décision, exceptions, et le temps passé sur chaque maillon répétitif. Ce n'est qu'ensuite qu'on modélise l'enchaînement — validations, branches conditionnelles, relances, escalades — et qu'on fixe les seuils où l'IA décide seule et ceux où elle demande un feu vert.\n\nLe workflow se branche sur vos outils existants (CRM, ERP, messagerie, agenda) par leurs API ou des connecteurs, et la bascule se fait flux par flux, sans tout couper d'un coup. Chaque action est journalisée et rejouable : vous pouvez retracer le déroulé et ajuster les plafonds à tout moment.\n\nLa différence avec une automatisation classique tient à la gestion de l'imprévu. Là où un script à règles fixes se bloque, l'IA interprète un e-mail mal rédigé, repère une pièce manquante, classe un cas ambigu et escalade au lieu de casser. Les meilleurs candidats sont les flux à fort volume et faible enjeu de décision : relances de devis et de factures, validations internes, reporting récurrent, onboarding.",
      keyPoints: [
        "Cartographie du flux réel avant toute automatisation",
        "Seuils explicites : ce que l'IA décide seule, ce qu'elle fait valider",
        "Branchement sur vos outils actuels, bascule flux par flux",
        "Chaque action journalisée et rejouable, plafonds ajustables",
        "Les exceptions remontent à vous, le reste roule",
      ],
      facts: [
        { figure: "4-8 sem", label: "premier flux en production" },
        { figure: "3-6", label: "flux enchaînés par projet" },
        { figure: "100 %", label: "flux tracés bout en bout" },
      ],
      steps: [
        {
          title: "Cartographie du processus",
          detail:
            "On trace le flux réel de bout en bout — étapes, déclencheurs, points de décision, exceptions — et on chiffre le temps passé sur chaque maillon répétitif.",
        },
        {
          title: "Conception du workflow et des embranchements",
          detail:
            "On modélise validations, branches conditionnelles, relances et escalades, puis on fixe les seuils métier où l'IA agit seule et ceux qui exigent un humain.",
        },
        {
          title: "Connexion aux outils et mise en production",
          detail:
            "On branche le workflow sur votre CRM, votre ERP, votre messagerie et votre agenda, on teste sur cas réels, puis on bascule flux par flux.",
        },
        {
          title: "Mesure, ajustement et passation",
          detail:
            "On suit le volume traité, le taux d'exceptions et le temps gagné par étape, on affine les seuils, et on vous remet le code et la documentation.",
        },
      ],
      nuances: [
        {
          title: "Ce n'est pas de la RPA",
          detail:
            "Un robot classique rejoue des clics sur des règles fixes et casse dès qu'un cas sort du script. Ici, l'IA interprète l'ambigu et escalade au lieu de bloquer.",
        },
        {
          title: "Ce n'est pas un changement de CRM ou d'ERP",
          detail:
            "Le workflow s'orchestre par-dessus votre stack actuelle, en lisant et en écrivant là où vos équipes travaillent déjà. Aucune couche de ressaisie n'est ajoutée.",
        },
        {
          title: "Ce n'est pas une automatisation sans contrôle",
          detail:
            "Les seuils de validation sont définis au cadrage, par exemple au-delà d'un certain montant ou sur un client sensible. Toutes les actions sont journalisées.",
        },
      ],
    },
    en: {
      question: "Comment automatiser un workflow métier avec l'IA ?",
      answer:
        "On cartographie d'abord votre processus (par exemple : réception d'une demande, qualification, réponse, suivi), puis on identifie les étapes où l'IA fait gagner du temps. On connecte l'IA à vos outils pour automatiser ces étapes, avec des points de contrôle humains aux moments clés. Résultat : un workflow plus rapide et fiable, où vos équipes se concentrent sur la valeur, pas sur la saisie répétitive.",
    },
  },
  {
    id: "creation-site-web-augmente-ia",
    reviewedAt: "2026-08-12",
    related: [
      "site-internet-intelligent-definition",
      "saas-application-ia-sur-mesure",
      "integration-ia-site-existant",
    ],
    fr: {
      question: "Axion-IA crée-t-il des sites web augmentés à l'IA ?",
      answer:
        "Oui : les sites web et plateformes SaaS augmentés à l'IA font partie des cinq prestations du catalogue. On conçoit des sites où l'IA est intégrée dès la conception plutôt qu'ajoutée en fin de projet : assistant conversationnel ancré sur vos contenus, recherche sémantique, génération et personnalisation éditoriale, qualification automatique des visiteurs, agents capables de déclencher des actions dans vos outils. La stack suit vos objectifs — Next.js, Nuxt, Laravel, Symfony, Django, Rails ou le CMS que vous utilisez déjà — et jamais l'inverse.\n\nUne plateforme complète sur mesure avec IA intégrée se construit en 6 à 12 semaines, en forfait fixe : pas de régie, pas de dépassement. Ordre de grandeur publié pour le développement web : {{price:codage-web|full}} ; au-delà, le chiffrage se fait au périmètre après cadrage. Toute la chaîne est hébergée en Union européenne et conforme au RGPD. Enfin, vous restez propriétaire de l'ensemble — code source, bases de données, modèles, configurations, livrés dans votre infrastructure : si vous nous quittez, la plateforme continue de fonctionner.",
      keyPoints: [
        "L'IA intégrée dès la conception, pas greffée en fin de projet",
        "6 à 12 semaines pour une plateforme complète, en forfait fixe",
        "Stack choisie selon vos objectifs, pas selon nos habitudes",
        "Hébergement en Union européenne, conforme RGPD",
        "Code, données et configurations livrés dans votre infrastructure",
      ],
      facts: [
        { figure: "6-12", label: "semaines pour une plateforme" },
        { figure: "2-3", label: "semaines pour un chatbot" },
        { figure: "30 j", label: "de support inclus" },
        { figure: "48 h", label: "ouvrées pour le devis" },
      ],
      steps: [
        {
          title: "Cadrage et arbitrage",
          detail:
            "Une trentaine de minutes pour trancher la vraie question : construire une base neuve ou augmenter l'existant. Le devis détaillé suit sous 48 h ouvrées.",
        },
        {
          title: "Conception et choix de stack",
          detail:
            "Parcours, contenus, données disponibles, contraintes de sécurité et de RGPD. La stack est choisie ici, en fonction de vos objectifs et de votre environnement.",
        },
        {
          title: "Développement au forfait",
          detail:
            "Périmètre écrit, prix ferme, livraisons intermédiaires visibles. Les briques IA sont branchées sur vos contenus réels, pas sur un jeu de démonstration.",
        },
        {
          title: "Mise en production et suite",
          detail:
            "Livraison dans votre infrastructure, avec 30 jours de support inclus. Au-delà, un contrat de maintenance reste optionnel.",
        },
      ],
      nuances: [
        {
          title: "Ce n'est pas un site vitrine avec un chatbot posé dessus",
          detail:
            "Les fonctions IA sont branchées sur vos contenus et vos données métier. Un widget générique répond à tout le monde pareil ; ici, il répond depuis votre périmètre.",
        },
        {
          title: "Ce n'est pas un abonnement à notre plateforme",
          detail:
            "Vous êtes propriétaire du code, des bases et des configurations, livrés chez vous. Aucun abonnement mensuel n'est imposé pour que le site continue de tourner.",
        },
        {
          title: "Ce n'est pas forcément une refonte",
          detail:
            "Si votre site actuel fonctionne et expose une API, greffer les briques IA dessus va plus vite et coûte moins cher qu'une reconstruction complète.",
        },
      ],
    },
    en: {
      question: "Axion-IA crée-t-il des sites web augmentés à l'IA ?",
      answer:
        "Oui. Axion-IA conçoit des sites web et plateformes augmentés à l'intelligence artificielle : assistant de navigation, recherche intelligente, génération et personnalisation de contenu, qualification automatique des visiteurs, chatbot intégré. L'IA n'est pas un gadget posé par-dessus : elle est pensée pour convertir et faire gagner du temps. On part de vos objectifs business et on construit un site rapide, moderne et réellement utile.",
    },
  },
  {
    id: "saas-application-ia-sur-mesure",
    reviewedAt: "2026-08-12",
    related: [
      "creation-site-web-augmente-ia",
      "integration-ia-site-existant",
      "implementation-ia-sur-mesure",
    ],
    fr: {
      question: "Développez-vous des applications ou SaaS augmentés à l'IA sur mesure ?",
      answer:
        "Oui, avec l'IA au cœur du produit et non greffée à la fin : agents autonomes capables d'agir, automatisation des processus métier répétitifs, recherche sémantique, analyse de données, génération de contenu. La question préalable n'est d'ailleurs pas technique mais économique. Si votre plateforme actuelle fonctionne et expose une API, l'augmenter va plus vite et coûte moins cher. Si elle a plus de cinq ans, résiste aux évolutions ou n'expose aucune API, repartir sur une base IA-native est souvent plus rentable à dix-huit mois. On tranche avec vous dès le premier appel, quitte à vous dire que le projet neuf n'est pas justifié.\n\nLe développement se fait en forfait fixe sur un périmètre écrit — pas de régie. Comptez 6 à 12 semaines pour une plateforme complète, puis 30 jours de support inclus après la mise en production ; au-delà, la maintenance est optionnelle : {{price:maintenance-standard|full}}. Sécurité, RGPD et souveraineté des données sont traités comme des contraintes de conception : hébergement en Union européenne, et code, bases et modèles livrés dans votre infrastructure.",
      keyPoints: [
        "IA-native : agents, automatisations et recherche sémantique intégrés dès la conception",
        "Arbitrage honnête entre augmenter l'existant et repartir d'une base neuve",
        "6 à 12 semaines en forfait fixe, sur un périmètre écrit",
        "30 jours de support inclus, maintenance ensuite optionnelle",
        "Hébergement UE, code et données livrés chez vous",
      ],
      facts: [
        { figure: "6-12", label: "semaines de développement" },
        { figure: "30 j", label: "de support inclus" },
        { figure: "4 h", label: "par mois de maintenance" },
        { figure: "48 h", label: "ouvrées pour le devis" },
      ],
      steps: [
        {
          title: "Cadrage et arbitrage",
          detail:
            "Ce que fait déjà votre outil, ce qu'il expose comme API, ce qu'il coûte à faire évoluer. On décide ensemble entre augmentation et plateforme neuve.",
        },
        {
          title: "Conception du produit",
          detail:
            "Parcours utilisateurs, modèle de données, points d'intégration, exigences RGPD et sécurité. Le périmètre est écrit avant la première ligne de code.",
        },
        {
          title: "Développement par itérations",
          detail:
            "Forfait fixe, livraisons intermédiaires visibles, retours intégrés au fil de l'eau. Les briques IA sont testées sur vos données réelles.",
        },
        {
          title: "Mise en production et transfert",
          detail:
            "Déploiement dans votre infrastructure, transfert de compétences à vos équipes, 30 jours de support inclus. La maintenance reste ensuite un choix.",
        },
      ],
      nuances: [
        {
          title: "Ce n'est pas un logiciel Axion-IA loué",
          detail:
            "Vous ne payez pas un abonnement pour accéder à votre propre outil. Code, bases et modèles sont livrés chez vous, et la plateforme continue de fonctionner sans nous.",
        },
        {
          title: "IA-native ne veut pas dire tout automatique",
          detail:
            "Les agents agissent dans un périmètre défini, avec des garde-fous et une reprise humaine. C'est une conception d'ingénierie, pas une promesse d'autonomie totale.",
        },
        {
          title: "Ce n'est pas toujours la bonne option",
          detail:
            "Quand l'existant fonctionne et s'ouvre par API, l'augmenter suffit dans la majorité des cas. Une plateforme neuve se justifie par des coûts d'évolution, pas par l'envie de neuf.",
        },
      ],
    },
    en: {
      question: "Développez-vous des applications ou SaaS augmentés à l'IA sur mesure ?",
      answer:
        "Oui. Axion-IA développe des applications et plateformes SaaS sur mesure intégrant l'IA au cœur du produit : automatisations métier, analyse de données, génération de contenu, agents intelligents. On conçoit la solution autour de votre besoin réel et de vos contraintes (sécurité, RGPD, souveraineté des données), avec une attention forte à la performance et à l'expérience utilisateur. De l'idée au produit en ligne, avec un accompagnement continu.",
    },
  },
  {
    id: "site-internet-intelligent-definition",
    reviewedAt: "2026-08-12",
    related: [
      "site-web-augmente-ia",
      "creation-site-web-augmente-ia",
      "integration-ia-site-existant",
    ],
    fr: {
      question: "Qu'est-ce qu'un site internet augmenté à l'intelligence artificielle ?",
      answer:
        "C'est un site dont certaines fonctions sont assurées par des modèles d'IA branchés sur vos propres contenus, au lieu de pages figées. Quatre briques reviennent le plus souvent : un assistant conversationnel qui répond en citant ses sources, une recherche en langage naturel qui comprend l'intention plutôt que les mots exacts, la génération et la personnalisation de contenus, et la qualification automatique des visiteurs et de leurs demandes.\n\nTechniquement, vos pages, documents et fiches produit sont indexés dans une base vectorielle hébergée en Union européenne ; l'assistant interroge cette base pour construire chaque réponse. C'est ce qui lui permet de rester dans votre périmètre, de citer ses sources et de dire qu'il ne sait pas plutôt que d'inventer — quand la question sort du cadre, il passe la main à un humain. La différence avec un site vitrine ne se lit donc pas dans le design : elle se mesure au travail que le site fait à votre place, 24 h/24, sur des questions auxquelles quelqu'un devait répondre à la main.",
      keyPoints: [
        "Des fonctions assurées par l'IA, branchées sur vos contenus réels",
        "Assistant conversationnel, recherche en langage naturel, personnalisation, qualification",
        "Vos contenus indexés dans une base vectorielle hébergée en Union européenne",
        "Réponses sourcées, dans votre périmètre, avec relais humain hors cadre",
        "La différence se mesure au travail fait à votre place, pas au design",
      ],
      facts: [
        { figure: "4", label: "briques les plus courantes" },
        { figure: "24/7", label: "de disponibilité" },
        { figure: "2-3", label: "semaines pour un chatbot" },
      ],
      nuances: [
        {
          title: "Ce n'est pas un chatbot scripté",
          detail:
            "Un arbre de décision répond aux questions prévues et bloque sur les autres. Ici, la réponse est construite à partir de vos contenus indexés, y compris sur des formulations inattendues.",
        },
        {
          title: "Ce n'est pas une IA qui invente",
          detail:
            "L'assistant répond depuis votre base documentaire en citant ses sources. Hors de ce périmètre, il le dit et passe la main plutôt que de produire une réponse plausible mais fausse.",
        },
        {
          title: "Ce n'est pas réservé aux gros sites",
          detail:
            "Une seule brique suffit à démarrer — souvent la recherche ou l'assistant. Le périmètre s'étend ensuite, contenu par contenu, selon ce qui est réellement consulté.",
        },
      ],
    },
    en: {
      question: "Qu'est-ce qu'un site internet augmenté à l'intelligence artificielle ?",
      answer:
        "Un site augmenté à l'IA intègre des fonctions intelligentes qui améliorent l'expérience et les résultats : recherche en langage naturel, recommandations personnalisées, assistant conversationnel, génération de contenu, qualification automatique des leads. Concrètement, il comprend mieux vos visiteurs, répond instantanément et convertit davantage. C'est la différence entre un site vitrine statique et un site qui travaille pour vous, 24/7.",
    },
  },
  {
    id: "integration-ia-site-existant",
    reviewedAt: "2026-08-12",
    related: [
      "creation-site-web-augmente-ia",
      "site-internet-intelligent-definition",
      "chatbot-ia-entreprise",
    ],
    fr: {
      question: "Peut-on intégrer l'IA à mon site ou ma plateforme existante ?",
      answer:
        "Oui, dans la grande majorité des cas, et sans refonte. Les briques IA se greffent sur votre site par une API, un widget JavaScript ou un plugin : assistant ancré sur vos contenus, recherche sémantique, génération de contenu, automatisation des formulaires et du traitement des demandes. Ni le design ni la structure ne sont touchés, et il n'y a pas d'interruption de service dès lors que votre CMS expose une API ou un flux de contenu — WordPress, Webflow, Shopify, PrestaShop, Next.js, Laravel, Django ou Symfony conviennent, comme la plupart des stacks modernes.\n\nLes délais sont courts : deux à trois semaines pour un assistant greffé sur un site existant, à partir de {{price:codage-web|compact}} ; une à deux semaines pour une recherche sémantique si le contenu est déjà structuré. La bonne méthode consiste à démarrer par une seule brique, mesurer ce qu'elle change vraiment, puis étendre le périmètre. Le seul vrai obstacle est une plateforme fermée, sans API ni export exploitable : dans ce cas, on vous le dit dès le premier échange.",
      keyPoints: [
        "Greffe par API, widget JavaScript ou plugin — sans toucher au design",
        "Compatible avec la plupart des CMS et stacks exposant une API",
        "Deux à trois semaines pour un assistant, une à deux pour la recherche sémantique",
        "On démarre par une brique, on mesure, puis on étend",
        "Une plateforme fermée sans API reste le seul vrai obstacle",
      ],
      facts: [
        { figure: "2-3", label: "semaines pour un assistant" },
        { figure: "1-2", label: "semaines pour la recherche" },
        { figure: "30 j", label: "de support inclus" },
        { figure: "48 h", label: "ouvrées pour le devis" },
      ],
      steps: [
        {
          title: "Vérification technique",
          detail:
            "On regarde si votre CMS expose une API, un flux ou un export exploitable. C'est ce point, et lui seul, qui décide de la faisabilité et du délai.",
        },
        {
          title: "Indexation de vos contenus",
          detail:
            "Pages, documents et fiches produit sont indexés dans une base vectorielle hébergée en Union européenne. C'est la source unique des réponses.",
        },
        {
          title: "Greffe et mise en ligne",
          detail:
            "Widget, plugin ou appel d'API selon votre stack. Le design et la structure existants restent intacts, sans interruption de service.",
        },
        {
          title: "Mesure puis extension",
          detail:
            "On regarde les questions réellement posées et ce qu'elles évitent comme travail manuel, avec 30 jours de support inclus, avant d'ajouter une brique.",
        },
      ],
      nuances: [
        {
          title: "Ce n'est pas une refonte",
          detail:
            "Le site reste le vôtre, tel qu'il est. On ajoute des fonctions par-dessus, sans reprendre le design, la structure ni le contenu existant.",
        },
        {
          title: "Ce n'est pas un plugin générique",
          detail:
            "L'assistant est ancré sur vos contenus indexés et répond dans votre périmètre. Un module prêt à l'emploi, lui, répond depuis un modèle qui ne connaît pas votre activité.",
        },
        {
          title: "Ce n'est pas toujours possible",
          detail:
            "Une plateforme totalement fermée, sans API ni export, bloque la greffe. C'est alors l'occasion d'arbitrer honnêtement entre migration et reconstruction.",
        },
      ],
    },
    en: {
      question: "Peut-on intégrer l'IA à mon site ou ma plateforme existante ?",
      answer:
        "Oui. Pas besoin de tout refaire : Axion-IA greffe des fonctions IA sur votre site ou plateforme actuelle — chatbot, recherche intelligente, génération de contenu, automatisation des formulaires et des leads. On s'adapte à votre technologie existante via ses API ou des connecteurs. Vous bénéficiez de l'IA rapidement, sans refonte coûteuse, et on peut faire évoluer le périmètre ensuite selon les résultats.",
    },
  },
  {
    id: "accompagnement-ia-individuel-dirigeant",
    reviewedAt: "2026-08-12",
    related: [
      "coaching-1-to-1-dirigeant",
      "mentorat-ia-dirigeant",
      "coaching-ia-prise-en-main-outils",
    ],
    fr: {
      question: "Proposez-vous un accompagnement IA individuel pour dirigeant ?",
      answer:
        "Oui, et il est strictement individuel : une personne, un intervenant senior, aucune salle de formation. Le format de référence est la journée de 7 à 8 heures avec le dirigeant ({{price:intervention-dirigeants|flat}}), déclinable sur deux jours quand le périmètre le justifie. Elle se tient dans vos locaux, à distance ou en hybride, sur les 13 régions et les 5 DROM ; à l'international, nous intervenons dans les structures francophones sur des missions d'une semaine minimum.\n\nLa confidentialité fait partie du cadre : on travaille sur vos vrais dossiers, vos vrais comptes et vos vrais chiffres, et rien n'est conservé après la journée. C'est aussi le même expert du premier échange à la remise du livrable — vous n'expliquez jamais deux fois votre contexte, et personne ne repart avec la moitié de l'histoire. Concrètement, un appel de cadrage d'une trentaine de minutes suffit à choisir le format et à caler la date ; le devis suit sous 48 h ouvrées, et la note de cadrage écrite arrive sous 7 jours après la journée.",
      keyPoints: [
        "Une seule personne accompagnée, par un intervenant senior",
        "Journée de 7 à 8 h, déclinable sur deux jours selon le périmètre",
        "Dans vos locaux, à distance ou en hybride — 13 régions et 5 DROM",
        "Vos vrais dossiers, rien de conservé après la journée",
        "Le même expert du premier échange à la remise du livrable",
      ],
      facts: [
        { figure: "1", label: "seule personne accompagnée" },
        { figure: "7-8 h", label: "en tête-à-tête" },
        { figure: "13+5", label: "régions et DROM couverts" },
        { figure: "48 h", label: "ouvrées pour le devis" },
      ],
      nuances: [
        {
          title: "Ce n'est pas une formation collective",
          detail:
            "Rien n'est mutualisé : ni le programme, ni le rythme, ni les cas travaillés. Pour faire monter plusieurs personnes ensemble, ce sont les journées en groupe de 2 à 15 participants.",
        },
        {
          title: "Ce n'est pas un état des lieux de l'entreprise",
          detail:
            "Le périmètre reste celui du dirigeant et de ses arbitrages. L'analyse chiffrée des processus de toute la structure relève de l'audit IA, qui est une autre prestation.",
        },
        {
          title: "Ce n'est pas un engagement de durée",
          detail:
            "La journée est autonome et se suffit à elle-même. Si vous voulez inscrire l'accompagnement dans le temps, c'est le format récurrent qui s'y prête, sous contrat dédié.",
        },
      ],
    },
    en: {
      question: "Proposez-vous un accompagnement IA individuel pour dirigeant ?",
      answer:
        "Oui. Le coaching IA 1-to-1 Axion-IA est un accompagnement individuel et confidentiel pour dirigeants : en quelques séances, vous apprenez à intégrer l'IA dans votre propre pratique (préparation de réunions, analyse, rédaction stratégique, veille sectorielle). Le rythme et les cas travaillés sont les vôtres. L'objectif : gagner plusieurs heures par semaine et prendre de meilleures décisions, plus vite, avec l'IA comme copilote personnel.",
    },
  },
  {
    id: "mentorat-ia-dirigeant",
    reviewedAt: "2026-08-12",
    related: [
      "coaching-1-to-1-dirigeant",
      "coaching-ia-cadres-managers",
      "coaching-ia-prise-en-main-outils",
    ],
    fr: {
      question: "Qu'est-ce qu'un mentorat IA pour dirigeant ?",
      answer:
        "C'est le format qui s'inscrit dans la durée, là où la journée 1-to-1 est ponctuelle. Concrètement : une session régulière avec le même intervenant senior, tous les mois ou tous les deux mois, sur un contrat de 6, 12 ou 24 mois — {{price:un-a-un-recurrent|full}}. Entre deux sessions, vous appliquez sur votre propre terrain ; à la suivante, on repart de ce qui a réellement tenu et de ce qui a coincé, sans repasser par la théorie.\n\nL'intérêt n'est pas pédagogique, il est décisionnel. Les outils changent vite, vos priorités aussi, et un arbitrage pris en janvier ne se juge qu'en mars : le mentorat sert à trancher au bon moment — quel usage industrialiser, lequel abandonner, quand passer d'une pratique personnelle à un déploiement d'équipe, quand ne rien faire. Beaucoup de dirigeants commencent par une journée complète pour poser l'état des lieux et repartir avec un plan, puis basculent en sessions régulières pour ancrer les usages sans y consacrer des semaines.",
      keyPoints: [
        "Une session régulière, mensuelle ou tous les deux mois",
        "Contrat de 6, 12 ou 24 mois, avec le même intervenant senior",
        "On repart à chaque fois de ce qui a tenu et de ce qui a coincé",
        "Un format décisionnel : quoi industrialiser, quoi abandonner, quand",
        "Souvent précédé d'une journée complète pour poser l'état des lieux",
      ],
      facts: [
        { figure: "6-24", label: "mois de contrat" },
        { figure: "1", label: "session, mensuelle ou bimestrielle" },
        { figure: "7-8 h", label: "pour la journée initiale" },
      ],
      nuances: [
        {
          title: "Ce n'est pas une formation",
          detail:
            "Il n'y a ni programme figé ni progression imposée. L'ordre du jour de chaque session vient de ce que vous avez tenté depuis la précédente et des décisions qui arrivent.",
        },
        {
          title: "Ce n'est pas un contrat de support",
          detail:
            "Le mentorat ne remplace ni la maintenance d'un outil livré, ni l'assistance technique. Il porte sur vos arbitrages, pas sur le bon fonctionnement d'une solution en production.",
        },
        {
          title: "Ce n'est pas un engagement à l'aveugle",
          detail:
            "Le rythme, la durée du contrat et le nombre de sessions sont fixés au devis avant de signer. Rien ne se découvre en cours de route.",
        },
      ],
    },
    en: {
      question: "Qu'est-ce qu'un mentorat IA pour dirigeant ?",
      answer:
        "Le mentorat IA est un accompagnement individuel dans la durée : un expert vous guide pas à pas dans l'adoption de l'IA, répond à vos questions concrètes, et vous aide à prendre les bonnes décisions au bon moment. Contrairement à une formation ponctuelle, il s'inscrit dans le temps et s'adapte à l'évolution de vos besoins. C'est idéal pour un dirigeant qui veut monter en compétence sereinement, à son rythme.",
    },
  },
  {
    id: "coaching-ia-cadres-managers",
    reviewedAt: "2026-08-12",
    related: [
      "coaching-ia-prise-en-main-outils",
      "coaching-1-to-1-dirigeant",
      "mentorat-ia-dirigeant",
    ],
    fr: {
      question: "Le coaching IA est-il adapté aux cadres et aux managers ?",
      answer:
        "Oui, et c'est souvent le profil sur lequel le retour est le plus visible. La journée 1-to-1 s'adresse à n'importe quel poste — responsable administratif, comptabilité, achats, RH, marketing, encadrement d'équipe — et se tient au tarif collaborateur : {{price:intervention-membre-equipe|flat}}. On part de vos tâches réelles : reporting hebdomadaire, comptes-rendus de réunion, tri des mails, notes internes, réponses récurrentes, tableaux de suivi. On les allège une par une, sur vos propres dossiers et vos propres outils.\n\nLa particularité d'un manager, c'est le double bénéfice : ce qu'il gagne pour lui, et ce qu'il devient capable de transmettre à son équipe. Vous repartez de la journée avec 3 à 5 méthodes pratiquées, utilisables dès le lendemain, puis votre cahier de prompts et un plan d'action sous 7 jours, avec un point de suivi à 30 jours. Quand plusieurs managers sont concernés, une journée collective en groupe de 2 à 15 participants est souvent plus efficace qu'un 1-to-1 répété : {{price:intervention-essentielle|flat}} pour le groupe.",
      keyPoints: [
        "Ouvert à tous les postes d'encadrement, au tarif collaborateur",
        "On part des tâches réelles : reporting, comptes-rendus, mails, notes internes",
        "3 à 5 méthodes pratiquées, utilisables dès le lendemain",
        "Cahier de prompts et plan d'action sous 7 jours, suivi à 30 jours",
        "Plusieurs managers concernés : la journée collective est souvent plus adaptée",
      ],
      facts: [
        { figure: "3-5", label: "méthodes maîtrisées" },
        { figure: "7 j", label: "pour le livrable écrit" },
        { figure: "30 j", label: "avant le point de suivi" },
        { figure: "2-15", label: "participants en collectif" },
      ],
      nuances: [
        {
          title: "Ce n'est pas du coaching de management",
          detail:
            "On ne travaille ni la posture, ni la conduite d'entretien, ni le leadership. Le sujet, ce sont vos tâches et vos outils, et le temps qu'ils vous prennent chaque semaine.",
        },
        {
          title: "Ce n'est pas une formation d'équipe",
          detail:
            "La journée accueille une seule personne, sur son poste. Faire monter toute l'équipe relève des journées collectives, en groupe de 2 à 15 participants.",
        },
        {
          title: "Le tarif ne dépend pas du niveau hiérarchique",
          detail:
            "Il dépend du profil accompagné et du contenu de la journée : {{price:intervention-membre-equipe|flat}} pour un cadre ou un manager sur son poste, {{price:intervention-dirigeants|flat}} pour la journée dirigeant, centrée sur les arbitrages.",
        },
      ],
    },
    en: {
      question: "Le coaching IA est-il adapté aux cadres et aux managers ?",
      answer:
        "Tout à fait. Le coaching IA 1-to-1 s'adresse aussi aux cadres, managers et responsables d'équipe : apprendre à automatiser ses tâches, gagner du temps sur le reporting et la rédaction, mais aussi savoir faire monter son équipe en compétence sur l'IA. L'accompagnement est personnalisé selon votre métier et vos outils. Un manager qui maîtrise l'IA devient un multiplicateur de productivité pour toute son équipe.",
    },
  },
  {
    // Première entrée enrichie du corpus (Will 2026-08-10) : elle sert de
    // patron pour la montée en qualité des 87 autres. Tous les faits ci-dessous
    // proviennent des pages produit déjà publiées (`/un-a-un`,
    // `/interventions/individuel`, `IndividualCoachingPage`) — rien n'est
    // avancé qui ne soit déjà affirmé ailleurs sur le site.
    //
    // ⚠️ Volontairement MUET sur le financement. Le dépôt porte deux doctrines
    // contradictoires sur le statut du 1-to-1 (conseil hors Qualiopi côté
    // public depuis 2026-07-17, résidus AFEST côté back-office) : tant que ce
    // n'est pas tranché, on n'affirme ni OPCO, ni AFEST, ni a fortiori CPF.
    id: "coaching-ia-prise-en-main-outils",
    reviewedAt: "2026-08-10",
    related: [
      "coaching-ia-cadres-managers",
      "accompagnement-ia-individuel-dirigeant",
      "mentorat-ia-dirigeant",
    ],
    fr: {
      question: "Un coaching IA pour prendre en main les outils, c'est possible ?",
      answer:
        "Oui, et c'est le format le plus rapide pour devenir autonome. Le Coaching IA 1-to-1 se déroule sur une journée de 7 à 8 heures, en tête-à-tête avec un intervenant senior, sur votre poste de travail réel et vos propres dossiers. On prend en main les assistants les plus utilisés en entreprise — ChatGPT, Claude et Gemini — ainsi que les extensions de navigateur et les transcripteurs de réunion, puis on crée vos assistants IA personnels. Rien n'est générique : on travaille sur vos documents, vos données, votre quotidien. Vous repartez avec 3 à 5 méthodes maîtrisées, un cahier de prompts qui reste le vôtre et un plan d'action chiffré ; le livrable écrit suit sous 7 jours, avec un point de suivi à 30 jours. La journée se tient sur site, à distance ou en hybride.",
      keyPoints: [
        "Une journée de 7 à 8 h, une seule personne — jamais un groupe",
        "Sur votre poste réel, vos comptes et vos vrais documents",
        "ChatGPT, Claude et Gemini, extensions, transcripteurs, puis vos propres assistants",
        "3 à 5 méthodes maîtrisées et un cahier de prompts qui reste le vôtre",
        "Livrable écrit sous 7 jours, point de suivi à 30 jours",
      ],
      facts: [
        { figure: "7-8 h", label: "en tête-à-tête" },
        { figure: "1", label: "seule personne accompagnée" },
        { figure: "3-5", label: "méthodes maîtrisées" },
        { figure: "7 j", label: "pour le livrable écrit" },
      ],
      steps: [
        {
          title: "État des lieux de votre poste",
          detail:
            "On passe en revue vos tâches réelles et on chiffre le temps perdu sur les plus répétitives. Ce n'est pas un audit d'entreprise : le périmètre, c'est votre poste.",
        },
        {
          title: "Prise en main des outils",
          detail:
            "ChatGPT, Claude, Gemini, extensions de navigateur, transcripteurs de réunion — sur vos propres comptes, pas sur un environnement de démonstration.",
        },
        {
          title: "Pratique sur vos cas",
          detail:
            "3 à 5 cas concrets travaillés sur vos vrais documents, jusqu'à ce que la méthode soit acquise. On pratique, on ne se contente pas d'en parler.",
        },
        {
          title: "Plan d'action et suite",
          detail:
            "Ce que vous appliquez seul dès le lendemain, et ce qui mériterait un accompagnement dédié. Le livrable écrit arrive sous 7 jours.",
        },
      ],
      nuances: [
        {
          title: "Ce n'est pas une session collective",
          detail:
            "Le 1-to-1 accueille une seule personne, sur son poste. Pour faire monter toute une équipe, ce sont les interventions collectives, en groupe de 2 à 15 participants.",
        },
        {
          title: "Ce n'est pas un état des lieux de toute l'entreprise",
          detail:
            "La journée porte sur un poste et ses tâches. La cartographie chiffrée de l'entreprise entière, avec scoring des opportunités, c'est l'audit IA — une prestation distincte.",
        },
        {
          title: "Le tarif dépend du profil accompagné",
          detail:
            "Journée avec un collaborateur : {{price:intervention-membre-equipe|flat}}. Journée avec le dirigeant : {{price:intervention-dirigeants|flat}}. Un échange préalable de 30 minutes permet de trancher, et le devis suit sous 48 h ouvrées.",
        },
      ],
    },
    en: {
      question: "Un coaching IA pour prendre en main les outils, c'est possible ?",
      answer:
        "Oui, et c'est le format le plus rapide pour devenir autonome. Le Coaching IA 1-to-1 se déroule sur une journée de 7 à 8 heures, en tête-à-tête avec un intervenant senior, sur votre poste de travail réel et vos propres dossiers. On prend en main les assistants les plus utilisés en entreprise — ChatGPT, Claude et Gemini — ainsi que les extensions de navigateur et les transcripteurs de réunion, puis on crée vos assistants IA personnels. Rien n'est générique : on travaille sur vos documents, vos données, votre quotidien. Vous repartez avec 3 à 5 méthodes maîtrisées, un cahier de prompts qui reste le vôtre et un plan d'action chiffré ; le livrable écrit suit sous 7 jours, avec un point de suivi à 30 jours. La journée se tient sur site, à distance ou en hybride.",
    },
  },
];

// Blog : split Sprint 14.10 (2026-05-08) — `BlogPost` + données + helpers
// déplacés dans `src/content/blog/`. Les exports ci-dessous restent disponibles
// pour rétrocompatibilité avec les pages /blog/* + sitemap + getRelatedBlogPosts.
export type { BlogPost, BlogPostCopy, BlogFaqItem } from "@/content/blog";
export {
  BLOG_POSTS,
  getBlogPost,
  getAllBlogSlugs,
  getAllBlogCategorySlugs,
  getBlogPostsByCategory,
  getBlogCategoryLabel,
  getAllBlogTagSlugs,
  getBlogPostsByTag,
  getAllBlogAuthorSlugs,
  getBlogPostsByAuthor,
  getBlogAuthorLabel,
} from "@/content/blog";

// Help center articles — Sprint 14 fixtures, replaced by Prisma in Sprint 15.
export interface HelpArticle {
  slug: string;
  category: string; // displayed label
  fr: { title: string; excerpt: string; body: string };
  en: { title: string; excerpt: string; body: string };
}

export const HELP_ARTICLES: ReadonlyArray<HelpArticle> = [
  {
    slug: "preparer-une-intervention",
    category: "Avant l'intervention",
    fr: {
      title: "Comment préparer une intervention IA ?",
      excerpt:
        "Comment préparer une intervention IA Axion-IA : les 3-5 process à cibler, les participants à mobiliser, les données à réunir et la journée à bloquer.",
      body: "Une intervention Axion-IA réussie repose sur 4 préparatifs : (1) lister 3-5 process candidats à l'IA, (2) inviter 1 décideur + 2-3 opérationnels concernés, (3) préparer un échantillon de données anonymisées (factures, emails, comptes-rendus) pour démos, (4) bloquer 1 journée complète sans réunions parallèles. Aucune installation logicielle n'est requise — l'intervenant arrive avec son équipement et ses modèles IA.",
    },
    en: {
      title: "How to prepare an AI session?",
      excerpt: "List the data, participants and objectives to clarify before the day.",
      body: "A successful Axion-IA session relies on 4 preparations: (1) list 3-5 candidate processes for AI, (2) invite 1 decision-maker + 2-3 operational staff, (3) prepare an anonymised data sample (invoices, emails, meeting notes) for demos, (4) block a full day with no parallel meetings. No software installation is required — the consultant arrives with their own equipment and AI models.",
    },
  },
  {
    slug: "perimetre-audit-ia",
    category: "Comprendre un audit IA",
    fr: {
      title: "Quel est le périmètre d'un audit IA Axion-IA ?",
      excerpt:
        "Le périmètre d'un audit IA Axion-IA : cartographie des process, 8-15 opportunités IA scorées et chiffrées, plan d'implémentation priorisé sur 5 jours.",
      body: "L'audit IA Axion-IA couvre 5 jours d'analyse : (1) cartographie de vos process actuels via interviews ; (2) identification de 8-15 opportunités IA scorées ROI/complexité ; (3) chiffrage individuel chaque opportunité (effort + coût + délai) ; (4) plan d'implémentation priorisé ; (5) recommandations gouvernance données + sourcing modèles. Livrable : document PDF 25-40 pages + atelier de restitution 2 h.",
    },
    en: {
      title: "What is the scope of an Axion-IA AI audit?",
      excerpt: "Complete mapping, per-opportunity costing, prioritised implementation plan.",
      body: "The Axion-IA AI audit covers 5 days of analysis: (1) mapping your current processes via interviews; (2) identifying 8-15 AI opportunities scored ROI/complexity; (3) individual costing of each opportunity (effort + cost + timeline); (4) prioritised implementation plan; (5) data governance + model sourcing recommendations. Deliverable: 25-40 page PDF + 2h debrief workshop.",
    },
  },
  {
    slug: "phases-implementation",
    category: "Implémentation IA",
    fr: {
      title: "Quelles sont les phases d'un projet d'implémentation ?",
      excerpt: "5 phases clés : cadrage, prototype, tests, déploiement, support.",
      body: "Un projet d'implémentation IA Axion-IA suit 5 phases : (1) cadrage technique 1 semaine — choix du modèle, architecture, données ; (2) prototype 2-4 semaines — version fonctionnelle sur jeu de données réel ; (3) tests utilisateurs 1-2 semaines — validation par 3-5 opérationnels ; (4) déploiement production 1 semaine — mise en service progressive ; (5) support 30 jours inclus. Total 6-8 semaines pour la majorité des cas.",
    },
    en: {
      title: "What are the phases of an implementation project?",
      excerpt: "5 key phases: scoping, prototype, testing, deployment, support.",
      body: "An Axion-IA AI implementation project follows 5 phases: (1) technical scoping 1 week — model choice, architecture, data; (2) prototype 2-4 weeks — functional version on real data; (3) user testing 1-2 weeks — validation by 3-5 operational staff; (4) production deployment 1 week — progressive go-live; (5) 30-day support included. Total 6-8 weeks for most cases.",
    },
  },
  {
    slug: "facturation-tva",
    category: "Facturation & TVA",
    fr: {
      title: "Comment fonctionne la facturation et la TVA ?",
      excerpt: "Virement bancaire, TVA française 20 %, devis fixe.",
      body: "Axion-IA est une SAS française et applique la TVA française. Pour les clients professionnels de l'UE disposant d'un n° de TVA intracommunautaire valide : autoliquidation, facture sans TVA (art. 196 directive 2006/112/CE). Pour les clients français et les clients UE sans n° de TVA : TVA française à 20 %. Pour les clients hors UE : facture sans TVA (hors-champ). Paiement par virement, devis fixe, aucune mensualité. La facture est livrée en PDF signé sous 48 h après prestation.",
    },
    en: {
      title: "How does billing and VAT work?",
      excerpt: "Bank transfer, French 20% VAT, fixed quote.",
      body: "Axion-IA is a French company (SAS) and applies French VAT. For EU business clients with a valid intra-community VAT number: reverse charge, invoice without VAT. For French clients and EU clients without a VAT number: French VAT at 20%. For non-EU clients: invoice without VAT (out of scope). Payment by bank transfer, fixed quote, no subscriptions. Signed PDF invoice delivered within 48h of service.",
    },
  },
  {
    slug: "securite-donnees",
    category: "Sécurité & données",
    fr: {
      title: "Comment Axion-IA sécurise mes données ?",
      excerpt: "Hébergement UE Hetzner Frankfurt, RGPD strict, pas de partage tiers.",
      body: "Toutes les données client sont hébergées sur Hetzner CPX32 à Frankfurt (UE). Aucun partage avec des tiers sans consentement explicite. Les modèles IA peuvent être hébergés chez vous (on-prem) ou sur infrastructure dédiée si requis. Politique RGPD complète, exercice des droits sous 30 jours, DPO joignable à contact@axion-ia.com. Anonymisation systématique des échantillons utilisés pour démos.",
    },
    en: {
      title: "How does Axion-IA secure my data?",
      excerpt: "EU hosting Hetzner Frankfurt, strict GDPR, no third-party sharing.",
      body: "All client data is hosted on Hetzner CPX32 in Frankfurt (EU). No sharing with third parties without explicit consent. AI models can be hosted with you (on-prem) or on dedicated infrastructure if required. Complete GDPR policy, rights exercise within 30 days, DPO reachable at contact@axion-ia.com. Systematic anonymisation of samples used for demos.",
    },
  },
  {
    slug: "support-post-livraison",
    category: "Support post-livraison",
    fr: {
      title: "Quel support après livraison ?",
      excerpt: "30 jours de maintenance corrective inclus, escalade chaude.",
      body: `Tout projet Axion-IA inclut 30 jours de support post-livraison : maintenance corrective sur les bugs identifiés, escalade chaude par email/téléphone (réponse sous 4 h ouvrées), 1 itération de fine-tuning si dérive de qualité observée. Au-delà, contrat de maintenance optionnel à ${formatPrice(maintenanceStandard, "fr")} (4 h/mois forfait). Aucun support n'est facturé pendant les 30 jours initiaux.`,
    },
    en: {
      title: "What post-delivery support?",
      excerpt: "30 days of corrective maintenance included, warm escalation.",
      body: `Every Axion-IA project includes 30 days of post-delivery support: corrective maintenance on identified bugs, warm escalation by email/phone (response within 4 business hours), 1 fine-tuning iteration if quality drift observed. Beyond that, optional maintenance contract at ${formatPrice(maintenanceStandard, "en")} (4h/month flat fee). No support is billed during the initial 30 days.`,
    },
  },
];

export function getHelpArticle(slug: string): HelpArticle | undefined {
  return HELP_ARTICLES.find((a) => a.slug === slug);
}

export function getAllHelpSlugs(): string[] {
  return HELP_ARTICLES.map((a) => a.slug);
}

export function getAllHelpCategorySlugs(): string[] {
  const cats = new Set(HELP_ARTICLES.map((a) => slugify(a.category)));
  return [...cats];
}

export function getHelpArticlesByCategory(slug: string): HelpArticle[] {
  return HELP_ARTICLES.filter((a) => slugify(a.category) === slug);
}

export function getHelpCategoryLabel(slug: string): string | undefined {
  const found = HELP_ARTICLES.find((a) => slugify(a.category) === slug);
  return found?.category;
}

export function getFaqEntry(id: string): FaqEntry | undefined {
  return FAQ_GLOBAL.find((f) => f.id === id);
}

export function getAllFaqIds(): string[] {
  return FAQ_GLOBAL.map((f) => f.id);
}

/**
 * Catégorisation des FAQ legacy (FAQ_GLOBAL) par thème — perfection FAQ 2026-05-31
 * (axe C, « allumer les hubs /faq/par-thematique »). Avant, toutes les FAQ legacy
 * tombaient dans "general" → 5 hubs sur 6 noindex (thin). Mapping vers l'enum
 * Prisma `FAQCategory` (general | interventions | implementation | audit |
 * pricing | process). Toute FAQ non mappée → "general" (fallback).
 */
const FAQ_GLOBAL_CATEGORY: Readonly<Record<string, string>> = {
  // interventions
  "geo-distance-international": "interventions",
  "competences-techniques": "interventions",
  "equipes-operationnelles": "interventions",
  "presentiel-distance": "interventions",
  "formation-ia-difference": "interventions",
  "coaching-1-to-1-dirigeant": "un-a-un",
  // implementation
  "no-code-position": "implementation",
  "delai-implementation": "implementation",
  "ia-on-premise": "implementation",
  "tpe-ia": "implementation",
  "accompagnement-post-implementation": "implementation",
  "site-web-augmente-ia": "implementation",
  // audit
  "audit-ia-definition": "audit",
  "roi-mesurer": "audit",
  "choisir-cabinet-ia": "audit",
  // pricing
  facturation: "pricing",
  "cout-projet-ia-pme": "pricing",
  "tarifs-publics-transparents": "pricing",
  "aides-subventions-ia": "pricing",
  "budget-demarrer-ia": "pricing",
  // process
  "securite-donnees-ia": "process",
  "confidentialite-projet-ia": "process",
  "rgpd-ia": "process",
  "risques-ia-entreprise": "process",
  "ia-souveraine-europe": "process",
  "deroule-mission-axion": "process",
  // audit (batch 2026-05-31)
  "duree-audit-ia": "audit",
  "livrables-audit-ia": "audit",
  // implementation (batch 2026-05-31)
  "automatiser-taches-ia": "implementation",
  "ia-integration-outils": "implementation",
  "agent-ia-definition": "implementation",
  "agent-vs-chatbot": "implementation",
  // interventions (batch 2026-05-31)
  "former-equipes-ia": "interventions",
  // implementation (batch #2 2026-05-31 — cas d'usage)
  "automatiser-facturation-ia": "implementation",
  "automatiser-service-client-ia": "implementation",
  "ia-gestion-documents": "implementation",
  "ia-reporting-analyse-donnees": "implementation",
  // process (batch #2 2026-05-31 — gouvernance/juridique)
  "ia-droit-auteur-contenu": "process",
  "ia-donnees-entrainement-confidentialite": "process",
  "erreurs-eviter-projet-ia": "process",
  "qui-pilote-ia-entreprise": "process",
  // general (batch #2) : secteurs (commerce/resto/btp/immo/compta/industrie/ecommerce),
  // comparatifs outils, biais → fallback "general"
  // ── batch #3 par service ──
  // audit
  "audit-ia-tpe-pme": "audit",
  "audit-maturite-ia-entreprise": "audit",
  "cout-audit-ia-entreprise": "audit",
  "premier-diagnostic-ia": "audit",
  // interventions / formation
  "formation-ia-entreprise": "interventions",
  "formation-chatgpt-claude-entreprise": "interventions",
  "atelier-ia-equipe": "interventions",
  "formation-ia-dirigeants": "interventions",
  // implementation
  "implementation-ia-sur-mesure": "implementation",
  "integration-ia-entreprise-concrete": "implementation",
  "chatbot-ia-entreprise": "implementation",
  "automatisation-ia-workflow-metier": "implementation",
  // sites web & SaaS IA (nouveau hub)
  "creation-site-web-augmente-ia": "sites-web",
  "saas-application-ia-sur-mesure": "sites-web",
  "site-internet-intelligent-definition": "sites-web",
  "integration-ia-site-existant": "sites-web",
  // coaching 1-to-1 (nouveau hub)
  "accompagnement-ia-individuel-dirigeant": "un-a-un",
  "mentorat-ia-dirigeant": "un-a-un",
  "coaching-ia-cadres-managers": "un-a-un",
  "coaching-ia-prise-en-main-outils": "un-a-un",
  // (tout le reste → "general")
};

/** Catégorie thématique d'une FAQ legacy (défaut "general"). */
export function getFaqGlobalCategory(id: string): string {
  return FAQ_GLOBAL_CATEGORY[id] ?? "general";
}

// slugify importé depuis @/lib/slug (SSOT V-10 2026-05-22).
// Anciennement défini inline ici — comportement identique préservé (maxLen default 80).

export { slugify };
