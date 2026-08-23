// Landings de RÉCEPTION D'ANNONCE — `/partenaire/[source]`.
//
// Une page par canal payant ou partenaire (Le Bon Coin, un journal, un club
// d'affaires, une école…). Elles ne servent QU'À CONVERTIR le trafic d'une
// annonce : elles ne visent aucun mot-clé et sont toutes en `noindex`.
//
// 🔴 POURQUOI `noindex` — la question a été tranchée deux fois dans ce dépôt.
// `app/sitemap-recrutement.xml/route.ts` documente déjà la règle pour les 40
// pages ville : « offre commune ≈ 89 % de contenu identique → doorway ». Ces
// landings sont dans le même cas face à `/devenir-commercial-ia`. Les indexer
// cannibaliserait la page principale (qui porte, elle, le JobPosting Google
// for Jobs) pour un gain nul : 100 % de leur trafic vient de l'annonce.
// Cf. `docs/annonce-leboncoin-recrutement.md` §4.
//
// STRUCTURE — le fond est COMMUN (l'offre est la même partout), seul
// l'habillage d'entrée change par canal. Dupliquer l'offre par source la
// ferait diverger en trois semaines.
//
// 🔴 AUCUN MONTANT EN DUR ICI. Les commissions viennent de `pricing.ts`
// (SSOT) — cf. l'incident documenté l. 813 de ce fichier : deux barèmes
// publics ont divergé de 150 €/journée parce qu'un montant avait été
// réécrit à la main.
//
// TUTOIEMENT — aligné sur `/memo-isere`, qui tutoie de bout en bout, et sur
// le tunnel de candidature. (⚠️ Le `<h1>` de memo-isere vouvoie encore :
// incohérence connue, à traiter sur les deux pages ensemble.)

/** Sources reconnues. L'`id` DOIT exister dans `SOURCE_OPTIONS`
 *  (`lib/commercial-application/model.ts`) — sans quoi la candidature arrive
 *  sans provenance et l'annonce n'est pas mesurable. */
export const PARTENAIRE_SOURCES = ["leboncoin"] as const;

export type PartenaireSource = (typeof PARTENAIRE_SOURCES)[number];

export function isPartenaireSource(v: string): v is PartenaireSource {
  return (PARTENAIRE_SOURCES as readonly string[]).includes(v);
}

export interface PartenaireLanding {
  /** Doit correspondre à un `id` de `SOURCE_OPTIONS`. */
  readonly source: PartenaireSource;
  /** Libellé humain du canal — affiché dans le badge du héro. */
  readonly canal: string;
  /** Titre SEO/onglet (la page est noindex, mais l'onglet et l'OG comptent). */
  readonly metaTitle: string;
  readonly metaDescription: string;
  /** Accroche du héro, avant la partie en italique terracotta. */
  readonly h1: string;
  /** Partie mise en valeur du `h1`. */
  readonly h1Em: string;
  /** Chapô — court, il décide si le bouton reste au-dessus de la ligne de flottaison. */
  readonly chapo: string;
}

export const PARTENAIRE_LANDINGS: Readonly<Record<PartenaireSource, PartenaireLanding>> = {
  leboncoin: {
    source: "leboncoin",
    canal: "Vu sur Le Bon Coin",
    metaTitle: "Apporteur d'affaires IA — partout en France",
    metaDescription:
      "Tu connais des dirigeants, nous formons leurs équipes à l'IA. Tu présentes, on vend, tu touches ta commission. Deux produits, zéro closing, aucune connaissance en IA requise.",
    h1: "Tu connais des dirigeants.",
    h1Em: "Nous formons leurs équipes.",
    chapo:
      "Tu présentes, on s'occupe du reste, tu touches ta commission. Deux produits à retenir, pas un catalogue. Et tu ne closes jamais.",
  },
};

// ── Contenu COMMUN à toutes les landings ────────────────────────────────────

/**
 * Mentions de réassurance INCONDITIONNELLES — vraies quel que soit l'état de
 * la certification.
 *
 * 🔴 LES MENTIONS CONDITIONNELLES NE VIVENT PAS ICI, et c'est délibéré.
 * « Organisme certifié Qualiopi » et « Formations finançables OPCO » sont
 * déclarées dans la PAGE, à trois lignes de l'appel à
 * `isQualiopiCertificationObtenue()`. Les poser dans ce fichier-ci — qui
 * n'importe aucun drapeau — reproduirait exactement la faille de
 * `/memo-isere` : un littéral servi en production parce que sa garde vivait
 * dans un autre fichier et que personne ne l'a vu. Le test
 * `server/qualiopi/config/__tests__/assertion-flag-surfaces.spec.ts` refuse
 * ce montage, et il a raison.
 */
export const PARTENAIRE_REASSURANCE_BASE: readonly string[] = [
  "Statut libre : micro-entreprise, agent commercial, apporteur",
  "Cumulable avec ton activité actuelle",
  "Démarrer ne te coûte rien",
];

export interface Produit {
  readonly titre: string;
  readonly commission: string;
  readonly detail: readonly string[];
}

/** Le bloc « Comment ça se passe ». Cinq étapes, celles de l'annonce. */
export const PARTENAIRE_ETAPES: readonly { readonly titre: string; readonly texte: string }[] = [
  {
    titre: "Tu candidates",
    texte:
      "Trois minutes, zéro CV, zéro lettre de motivation. On répond à toutes les candidatures — personne ne reste sans réponse.",
  },
  {
    titre: "On se parle en visio",
    texte:
      "Juste toi et nous. On t'explique l'offre, tu poses tes questions. Pas de réunion collective : un vrai échange.",
  },
  {
    titre: "Tu présentes une entreprise",
    texte:
      "Tu parles d'Axion-IA à une entreprise que tu connais, tu nous la signales. Elle est enregistrée à ton nom.",
  },
  {
    titre: "On vend",
    texte:
      "On appelle, on présente, on monte le dossier, on facture. Tu n'as ni à négocier, ni à faire de devis, ni à relancer un impayé.",
  },
  {
    titre: "Tu touches ta commission",
    texte:
      "Quand l'entreprise nous a payés, on te paie. C'est la règle de l'apport d'affaires : la commission est due à l'encaissement.",
  },
];

/** « Je n'y connais rien en IA » — le frein n°1 de ce recrutement.
 *  Le recadrage bat l'argument « on te formera », qui sous-entend qu'il faut
 *  savoir. Cf. `docs/annonce-leboncoin-recrutement.md` §2.3. */
export const PARTENAIRE_OBJECTION_IA: readonly string[] = [
  "Le dirigeant en face n'y connaît rien non plus — c'est bien pour ça qu'il a besoin de nous.",
  "Aucune démo à faire. Aucun outil à installer. Aucun devis à monter.",
  "Une question technique ? « Excellente question, c'est exactement ce que l'expert vous détaillera. Je vous cale un rendez-vous ? »",
  "Ton premier rendez-vous, on peut le faire à deux, en visio.",
];

/** Les profils visés. Nommer les métiers est ce qui déclenche la
 *  reconnaissance — une liste vague ne convertit personne. */
export const PARTENAIRE_PROFILS: readonly string[] = [
  "Commerciaux B2B (vente aux entreprises), en poste ou anciens",
  "Commerciaux qui visitent déjà des entreprises : télécom, énergie, mutuelle, sécurité, propreté, fournitures, logiciels",
  "Agents commerciaux multicartes",
  "Courtiers en assurance ou en financement professionnel",
  "Consultants indépendants",
  "Mandataires en immobilier d'entreprise",
  "Anciens dirigeants",
  "Jeunes retraités du commerce",
];

/** « Ce que ce n'est pas ». Contre-intuitif mais décisif : c'est ce qui
 *  distingue l'offre des arnaques du même rayon. */
export const PARTENAIRE_CE_QUE_CE_NEST_PAS: readonly { readonly t: string; readonly d: string }[] =
  [
    {
      t: "Pas de salaire fixe",
      d: "Tu es payé à la commission, sur les ventes réelles, une fois que le client a réglé sa facture.",
    },
    {
      t: "Pas de frais d'entrée",
      d: "Aucun kit à acheter, aucun stock, aucune avance. Démarrer ne te coûte rien.",
    },
    {
      t: "Pas de recrutement en cascade",
      d: "On ne te demandera jamais de recruter qui que ce soit pour gagner de l'argent.",
    },
    {
      t: "Pas d'objectif imposé",
      d: "Pas de reporting, pas de hiérarchie. Tu y consacres le temps que tu veux.",
    },
  ];
