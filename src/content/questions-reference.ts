/**
 * Questions-réponses de référence : SOURCE UNIQUE des questions que plusieurs
 * pages posent (plan « questions-réponses de référence » du 18/11/2026).
 *
 * Règles d'écriture (verrouillées par `__tests__/questions-reference.spec.ts`) :
 *  - la question est celle qu'un dirigeant tape dans une IA, sujet nommé ;
 *  - la réponse fait de 40 à 80 mots, et sa 1re phrase répond seule en nommant le sujet ;
 *  - un montant n'est jamais écrit en dur : jeton `{{PRIX}}` (prix de la Journée IA),
 *    résolu par `remplacerJetons()` ; tout le reste est « sur devis » ;
 *  - AI Act : uniquement les formulations sûres de l'état du droit au 18/11/2026 ;
 *  - une page qui pose une de ces questions l'IMPORTE (`faqItems`) au lieu de la recopier.
 *
 * Décisions de Williams du 18/11/2026 reprises ici : l'audit convient aux entreprises de 2 à 250 salariés, la formation de l'après-midi va jusqu'à 15 personnes
 * (correction du 20/11/2026) ; audit le matin (2 à 4 h selon la structuration de l’entreprise), formation de 4 h l'après-midi ;
 * garantie gardée (« Si la Journée IA n'identifie pas des gains d'au moins 3 fois son prix, elle
 * est remboursée », distincte d'une « garantie de résultat », qu'on ne donne pas) ; les {{PRIX}}
 * sont déduits d'un devis d'automatisation ou de mise en place signé dans les 60 jours suivant
 * la Journée IA, jamais d'une formation.
 *
 * Volontairement absent : l'audit approfondi (durée non décidée) et le nom du fondateur.
 */
import {
  DELAI_RAPPORT_JOURS_OUVRES,
  MULTIPLE_GARANTIE,
  remplacerJetons,
  seuilGarantieEur,
} from "./journee-ia-commun";
import { formatAmount } from "./pricing";

/** Seuil de la garantie (3 fois le prix HT de la journée), calculé, jamais tapé. */
const SEUIL = formatAmount(seuilGarantieEur(), "fr");

/** Phrase unique sur l'audit approfondi : importée par la page /prix-audit-ia pour ne jamais diverger. */
export const PHRASE_AUDIT_APPROFONDI =
  "Un audit plus approfondi, au-delà de la Journée IA, se chiffre sur devis après un premier échange gratuit de 45 minutes.";

export interface QuestionReference {
  readonly id: string;
  readonly question: string;
  /** Jeton autorisé : `{{PRIX}}`. */
  readonly reponse: string;
  /** Doit figurer dans la 1re phrase de la réponse. */
  readonly sujet: string;
  /** Fichier de vérité, pour la relecture. */
  readonly source: string;
  readonly liens?: ReadonlyArray<{ href: string; libelle: string }>;
}

export const QUESTIONS_REFERENCE: Readonly<Record<string, QuestionReference>> = {
  "ref-commencer": {
    id: "ref-commencer",
    question: "Par où commencer avec l’IA dans une PME ?",
    reponse:
      "Pour commencer avec l’IA dans une PME, partez de vos tâches, pas d’un outil. Axion-IA cartographie l’entreprise service par service, chiffre vos plus gros gains en heures et en euros, puis retient 3 à 5 priorités. Le premier pas est gratuit : un Diagnostic IA de 45 minutes, en visio ou par téléphone, avant de décider de la Journée IA.",
    sujet: "PME",
    source: "src/app/[locale]/_accueil/contenu.ts (faq-commencer)",
  },
  "ref-journee-prix": {
    id: "ref-journee-prix",
    question: "Combien coûte la Journée IA ?",
    reponse: `La Journée IA d’Axion-IA coûte {{PRIX}}, prix unique. L’audit du matin convient aux entreprises de 2 à 250 salariés (2 à 4 h selon la structuration de l’entreprise) ; la formation de 4 h l’après-midi accueille jusqu’à 15 personnes. La journée comprend aussi 3 à 5 priorités écrites le soir, puis le rapport chiffré et le plan d’action sous ${DELAI_RAPPORT_JOURS_OUVRES} jours ouvrés. Si les gains identifiés dans ce rapport, sur 12 mois, n'atteignent pas ${MULTIPLE_GARANTIE} fois son prix HT, soit ${SEUIL}, elle est remboursée sur demande écrite.`,
    sujet: "Journée IA",
    source: "src/content/pricing.ts, src/content/journee-ia-commun.ts",
  },
  "ref-formation-prix": {
    id: "ref-formation-prix",
    question: "Combien coûte une formation IA pour une PME ?",
    reponse:
      "Une formation IA pour une PME est facturée sur devis écrit, hors taxes, par groupe (de 2 à 15 stagiaires par session) et jamais par personne. Le prix dépend de la formation retenue, de sa durée (de 4 heures à 2 jours) et du format, sur site ou à distance. Le seul prix affiché est celui de la Journée IA, {{PRIX}}, qui comprend 4 heures de formation.",
    sujet: "formation IA",
    source: "src/content/formations/effectif.ts, src/content/pricing.ts",
  },
  "ref-ai-act-pme": {
    id: "ref-ai-act-pme",
    question: "Que demande l’AI Act à une PME qui utilise l’IA ?",
    reponse:
      "L’AI Act, le règlement européen sur l’IA, demande aux entreprises qui utilisent des systèmes d’IA de prendre des mesures pour favoriser la maîtrise de l’IA de leur personnel (article 4). Depuis le 27 juillet 2026, cet article a été assoupli par le règlement (UE) 2026/1744 : aucun niveau précis n’est imposé à chaque salarié. Les obligations sur les systèmes à haut risque s’appliqueront à partir du 2 décembre 2027.",
    sujet: "AI Act",
    source: "AI-ACT-ARTICLE-4-ETAT-2026-11-18.md, phrases sûres 1, 2, 3, 5",
  },
  "ref-ai-act-formation": {
    id: "ref-ai-act-formation",
    question: "Une formation à l’IA est-elle exigée par l’AI Act ?",
    reponse:
      "Non, l’AI Act n’impose pas de suivre une formation précise. L’article 4 demande de prendre des mesures pour favoriser la maîtrise de l’IA du personnel, sans fixer de format ni de niveau à chaque salarié. Une formation est l’une des mesures possibles. Aucune certification n’est prévue pour cet article : l’attestation remise à chaque participant est une trace écrite de la formation suivie.",
    sujet: "AI Act",
    source: "AI-ACT-ARTICLE-4-ETAT-2026-11-18.md, phrases sûres 1, 3, 4",
  },
  "ref-audit-contenu": {
    id: "ref-audit-contenu",
    question: "Que contient un audit IA pour une PME ?",
    reponse: `Un audit IA en PME cartographie l’entreprise service par service, repère les tâches répétitives et chiffre chacune en heures et en euros. Il les classe par rentabilité et par rapidité de mise en place, retient 3 à 5 priorités écrites, puis se prolonge par un rapport chiffré avec un plan d’action sur 90 jours, remis sous ${DELAI_RAPPORT_JOURS_OUVRES} jours ouvrés dans le cadre de la Journée IA.`,
    sujet: "audit IA",
    source: "src/content/journee-ia-commun.ts (DESCRIPTION_SERVICE_JOURNEE_IA, RAPPORT_COMPLET)",
  },
  "ref-audit-prix": {
    id: "ref-audit-prix",
    question: "Combien coûte un audit IA pour une PME ?",
    reponse: `Un audit IA se fait dans la Journée IA : 2 à 4 h d’audit le matin, suivies de 4 h de formation l’après-midi, pour {{PRIX}}, prix unique. Rien ne se paie en ligne : les modalités figurent dans votre devis écrit. ${PHRASE_AUDIT_APPROFONDI}`,
    sujet: "audit IA",
    source: "src/content/journee-ia-commun.ts, src/content/pricing.ts",
  },
  "ref-audit-vs-info": {
    id: "ref-audit-vs-info",
    question: "Quelle différence entre un audit IA et un audit informatique ?",
    reponse:
      "Un audit IA ne se confond pas avec un audit informatique. L’audit informatique examine le parc, la sécurité et les licences ; l’audit IA regarde les tâches et le temps de vos équipes pour repérer ce que l’IA peut préparer, le chiffrer en heures et en euros et fixer 3 à 5 priorités. Les deux se complètent et ne se remplacent pas.",
    sujet: "audit IA",
    source: "pack-journee-ia-2026-11-10 (GEO-021)",
  },
  "ref-audit-vs-formation": {
    id: "ref-audit-vs-formation",
    question: "Audit IA ou formation IA : par quoi commencer ?",
    reponse:
      "Audit IA et formation IA se complètent, et le mieux est de les enchaîner. L’audit décrit votre situation et fixe les priorités ; la formation change les pratiques des équipes sur leurs propres dossiers. La Journée IA d’Axion-IA fait les deux le même jour, dans vos locaux : l’audit du matin oriente la formation de l’après-midi, avec 3 à 5 priorités écrites le soir.",
    sujet: "audit IA",
    source: "src/content/journee-ia-commun.ts (DESCRIPTION_SERVICE_JOURNEE_IA)",
  },
  "ref-automatisation-prix": {
    id: "ref-automatisation-prix",
    question: "Combien coûte une automatisation IA pour une PME ?",
    reponse:
      "Une automatisation IA pour une PME est facturée sur devis écrit et forfaitaire, fixé avant de commencer, sans heures qui tournent, selon les outils à relier et le volume traité. Les {{PRIX}} de la Journée IA sont déduits d’un devis d’automatisation ou de mise en place signé dans les 60 jours suivant la Journée IA, jamais d’une formation. Premier pas gratuit : un Diagnostic IA de 45 minutes.",
    sujet: "automatisation IA",
    source: "src/content/implementation-fr-overrides.ts",
  },
  "ref-automatiser-premier": {
    id: "ref-automatiser-premier",
    question: "Quelles tâches automatiser en premier dans une PME ?",
    reponse:
      "Dans une PME, les premières tâches à automatiser avec l’IA sont celles qui reviennent souvent, suivent des règles claires et prennent un temps mesurable : devis, relances, comptes rendus, tri des e-mails. Commencez par un ou deux flux seulement, relisez les résultats, puis étendez. La Journée IA chiffre ces tâches en heures et en euros et les classe par rentabilité.",
    sujet: "automatiser",
    source: "src/app/[locale]/_accueil/contenu.ts, src/content/implementation-fr-overrides.ts",
  },
  "ref-outils-existants": {
    id: "ref-outils-existants",
    question: "Faut-il changer de logiciels pour intégrer l’IA ?",
    reponse:
      "Non, intégrer l’IA dans une PME n’oblige pas à changer de logiciels. Les automatisations se branchent sur les outils que vous utilisez déjà, comme la messagerie, le CRM, la comptabilité ou les tableurs, via leurs connecteurs ou leurs interfaces. On repère d’abord ce qui existe, puis on ajoute seulement ce qui manque, pour que vos équipes gardent leurs habitudes.",
    sujet: "logiciels",
    source: "src/content/implementation-fr-overrides.ts",
  },
  "ref-coaching": {
    id: "ref-coaching",
    question: "Qu’est-ce qu’un coaching IA individuel pour un dirigeant ?",
    reponse:
      "Un coaching IA individuel est une journée en tête-à-tête (7 à 8 heures) entre un dirigeant ou un collaborateur et un expert Axion-IA, préparée en amont sur votre métier et menée sur vos vraies tâches. Vous recevez un livrable personnalisé sous 7 jours. Le coaching se fait partout en France, outre-mer compris, sur devis écrit après un premier échange gratuit.",
    sujet: "coaching IA",
    source: "src/app/[locale]/un-a-un/page.tsx",
  },
  "ref-coaching-vs-formation": {
    id: "ref-coaching-vs-formation",
    question: "Coaching individuel ou formation collective : que choisir ?",
    reponse:
      "Pour une seule personne, choisissez le coaching IA individuel ; pour une équipe, la formation collective, de 2 à 15 stagiaires par session ; pour cadrer l’IA dans toute l’entreprise, la Journée IA. Le coaching travaille sur les dossiers d’une personne, la formation sur les pratiques communes d’un groupe, la Journée IA sur l’entreprise entière : audit le matin, formation l’après-midi.",
    sujet: "coaching",
    source: "src/content/formations/effectif.ts, src/app/[locale]/un-a-un/page.tsx",
  },
  "ref-remplacer": {
    id: "ref-remplacer",
    question: "L’IA va-t-elle remplacer mes salariés ?",
    reponse:
      "Non, l’IA n’a pas vocation à remplacer vos salariés : avec Axion-IA, elle retire des tâches répétitives, et la personne garde la main pour valider chaque résultat. Le temps gagné sert aux clients, aux relances et aux dossiers qui demandent du jugement. L’audit mesure ce temps tâche par tâche, avec vous, pour décider ensemble de ce qui vaut la peine d’être préparé par l’IA.",
    sujet: "salariés",
    source: "pack-journee-ia-2026-11-10 (GEO-024)",
  },
  "ref-donnees": {
    id: "ref-donnees",
    question: "Nos données sont-elles protégées quand on utilise l’IA ?",
    reponse:
      "Vos données restent sous votre contrôle quand vous utilisez l’IA avec Axion-IA : rien de confidentiel ne part sans votre accord. Pendant la formation, nous écrivons avec vos équipes des règles d’usage : ce que l’on confie à l’IA, et ce que l’on ne lui confie jamais, comme les données clients. Pour les mises en place, l’hébergement se fait dans l’UE par défaut.",
    sujet: "données",
    source:
      "src/app/[locale]/journee-ia/contenu.ts (faq-donnees), src/content/implementation-fr-overrides.ts",
  },
  "ref-partout-france": {
    id: "ref-partout-france",
    question: "Axion-IA intervient-il partout en France ?",
    reponse:
      "Axion-IA intervient partout en France, outre-mer compris, dans vos locaux. La Journée IA, la formation et l’audit se déroulent chez vous ; le Diagnostic IA de 45 minutes se fait en visio ou par téléphone. La date est fixée avec vous pendant cet appel, sans engagement avant le devis écrit.",
    sujet: "Axion-IA",
    source: "src/content/offre.ts",
  },
};

export interface ItemFaqReference {
  id: string;
  question: string;
  answer: string;
  liens?: ReadonlyArray<{ href: string; label: string }>;
}

/** Réponse brute d'une question de référence (lève si l'id est inconnu). */
export function reponseReference(id: string): string {
  const q = QUESTIONS_REFERENCE[id];
  if (!q) throw new Error(`Question de référence inconnue : ${id}`);
  return q.reponse;
}

/** Les questions demandées, dans l'ordre, jetons résolus (même tableau pour le texte visible et le JSON-LD). */
export function faqItems(ids: readonly string[], _locale: "fr" = "fr"): ItemFaqReference[] {
  return ids.map((id) => {
    const q = QUESTIONS_REFERENCE[id];
    if (!q) throw new Error(`Question de référence inconnue : ${id}`);
    return {
      id: q.id,
      question: q.question,
      answer: remplacerJetons(q.reponse),
      ...(q.liens ? { liens: q.liens.map((l) => ({ href: l.href, label: l.libelle })) } : {}),
    };
  });
}
