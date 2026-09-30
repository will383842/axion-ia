// Landings de RÉCEPTION D'ANNONCE — une route racine par canal (`/leboncoin`,
// `/indeed`), de la même forme que `/memo-isere`.
//
// Une page par canal payant ou partenaire (Le Bon Coin, un journal, un club
// d'affaires, une école…). Elles ne servent QU'À CONVERTIR le trafic d'une
// annonce : elles ne visent aucun mot-clé et sont toutes en `noindex`.
//
// 🔴 POURQUOI `noindex` — la question a été tranchée deux fois dans ce dépôt.
// `app/sitemap-recrutement.xml/route.ts` documente déjà la règle pour les 40
// pages ville : « offre commune ≈ 89 % de contenu identique → doorway ». Ces
// landings sont dans le même cas face à `/devenir-commercial-ia`. Les indexer
// cannibaliserait la page principale pour un gain nul : 100 % de leur trafic
// vient de l'annonce.
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
// VOUVOIEMENT — décision Will du 29/09/2026 (« on reste sur le vouvoiement ») :
// `/memo-isere`, ces landings et tout le tunnel de candidature vouvoient.

/** Sources reconnues. L'`id` DOIT exister dans `SOURCE_OPTIONS`
 *  (`lib/commercial-application/model.ts`) — sans quoi la candidature arrive
 *  sans provenance et l'annonce n'est pas mesurable. */
export const PARTENAIRE_SOURCES = ["leboncoin", "indeed"] as const;

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
      "Vous connaissez des dirigeants ? Nous formons leurs équipes à l'IA. Vous recommandez, nous faisons le reste, vous touchez une commission indicative.",
    h1: "Vous connaissez des dirigeants.",
    h1Em: "Nous formons leurs équipes.",
    chapo:
      "Vous présentez, nous nous occupons du reste, vous touchez votre commission, à titre indicatif selon le barème en vigueur. Deux produits à retenir, pas un catalogue. Et vous ne concluez jamais la vente.",
  },

  /**
   * Indeed. ⚠️ Indeed ne moissonne aucun balisage du site (et le site n'en
   * publie plus pour les apporteurs depuis le 2026-09-19) : la publication y
   * est manuelle (ou par flux XML). Cette landing est donc la cible du lien
   * déposé À LA MAIN dans l'annonce Indeed — rien n'y arrive tout seul.
   *
   * Le chapô insiste sur « sans CV » : c'est LA différence qui compte face à
   * l'attente d'un candidat venu d'Indeed, où l'on postule presque toujours en
   * déposant un CV. La dire tôt évite l'abandon devant un tunnel qui n'en
   * demande pas.
   */
  indeed: {
    source: "indeed",
    canal: "Vu sur Indeed",
    metaTitle: "Apporteur d'affaires IA — indépendant, partout en France",
    metaDescription:
      "Apporteur d'affaires indépendant, formations et audits IA. Commission indicative par journée payée, aucune connaissance en IA. Candidature en 3 min, sans CV.",
    h1: "Apporteur d'affaires IA,",
    h1Em: "indépendant et sans plafond",
    chapo:
      "Candidature en 3 minutes, sans CV et sans lettre de motivation. Vous recommandez des entreprises, nous nous occupons du reste, vous touchez votre commission, à titre indicatif selon le barème en vigueur. Deux produits à retenir, et vous ne concluez jamais la vente.",
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
  "Statut libre : micro-entreprise ou société",
  "Cumulable avec votre activité actuelle",
  "Démarrer ne vous coûte rien",
];

export interface Produit {
  readonly titre: string;
  readonly commission: string;
  readonly detail: readonly string[];
}

/** Le bloc « Comment ça se passe ». Cinq étapes, celles de l'annonce. */
export const PARTENAIRE_ETAPES: readonly { readonly titre: string; readonly texte: string }[] = [
  {
    titre: "Vous candidatez",
    texte:
      "Trois minutes, zéro CV, zéro lettre de motivation. Un e-mail de confirmation vous est envoyé dès l'envoi — personne ne reste sans réponse.",
  },
  {
    // 2026-09-29 — l'invitation part seule, ~15 minutes après un DOSSIER
    // COMPLET (`invitation-auto.ts`) ; ces landings mènent au dossier complet.
    titre: "Un échange de 15 minutes",
    texte:
      "Dans les minutes qui suivent votre candidature, vous recevez une invitation à réserver un échange de 15 minutes en visio. Nous vous présentons l'offre, vous posez vos questions. Pas de réunion collective : un vrai échange.",
  },
  {
    titre: "Vous présentez une entreprise",
    texte:
      "Vous parlez d'Axion-IA à une entreprise que vous connaissez, vous nous la signalez. Elle est enregistrée à votre nom.",
  },
  {
    titre: "On s'occupe du reste",
    texte:
      "Nous contactons l'entreprise, présentons, montons le dossier, facturons. Vous n'avez ni à négocier, ni à faire de devis, ni à relancer un impayé.",
  },
  {
    titre: "Vous touchez votre commission",
    texte:
      "Quand l'entreprise nous a payés, nous vous payons, selon le barème indicatif en vigueur. C'est la règle de l'apport d'affaires : la commission est due à l'encaissement.",
  },
];

/** « Je n'y connais rien en IA » — le frein n°1 de ce recrutement.
 *  Le recadrage bat l'argument « on vous formera », qui sous-entend qu'il faut
 *  savoir. Cf. `docs/annonce-leboncoin-recrutement.md` §2.3. */
export const PARTENAIRE_OBJECTION_IA: readonly string[] = [
  "Le dirigeant en face n'y connaît rien non plus — c'est bien pour ça qu'il a besoin de nous.",
  "Aucune démo à faire. Aucun outil à installer. Aucun devis à monter.",
  "Une question technique ? « Excellente question, c'est exactement ce que l'expert vous détaillera. Je vous cale un rendez-vous ? »",
  "Votre premier rendez-vous, nous pouvons le faire à deux, en visio, si vous le souhaitez.",
];

/** Les profils visés. Nommer les métiers est ce qui déclenche la
 *  reconnaissance — une liste vague ne convertit personne. */
export const PARTENAIRE_PROFILS: readonly string[] = [
  "Commerciaux B2B (vente aux entreprises), en poste ou anciens",
  "Commerciaux qui visitent déjà des entreprises : télécom, énergie, mutuelle, sécurité, propreté, fournitures, logiciels",
  "Indépendants qui visitent plusieurs entreprises par semaine",
  "Courtiers en assurance ou en financement professionnel",
  "Consultants indépendants",
  "Professionnels de l'immobilier d'entreprise",
  "Anciens dirigeants",
  "Jeunes retraités du commerce",
];

/** « Ce que ce n'est pas ». Contre-intuitif mais décisif : c'est ce qui
 *  distingue l'offre des arnaques du même rayon. */
export const PARTENAIRE_CE_QUE_CE_NEST_PAS: readonly { readonly t: string; readonly d: string }[] =
  [
    {
      t: "Pas de salaire fixe",
      d: "Vous êtes payé à la commission, sur les ventes réelles, une fois que le client a réglé sa facture.",
    },
    {
      t: "Pas de frais d'entrée",
      d: "Aucun kit à acheter, aucun stock, aucune avance. Démarrer ne vous coûte rien.",
    },
    {
      t: "Pas de recrutement en cascade",
      d: "Nous ne vous demanderons jamais de recruter qui que ce soit pour gagner de l'argent.",
    },
    {
      t: "Pas d'objectif imposé",
      d: "Pas de reporting, pas de hiérarchie. Vous y consacrez le temps que vous voulez.",
    },
  ];

// ── Coût des annonces ───────────────────────────────────────────────────────

export interface CoutAnnonce {
  /** Dépense CUMULÉE sur ce canal, en euros TTC. */
  readonly montantEur: number;
  /** Ce que couvre ce montant — daté, pour qu'on sache quoi ajouter la fois d'après. */
  readonly note: string;
}

/**
 * Ce que chaque canal a coûté, saisi à la main.
 *
 * 🔴 SANS CE CHIFFRE, L'ÉCRAN DE PILOTAGE COMPARE DES VOLUMES, PAS DES
 * RENTABILITÉS. Un canal gratuit qui produit 200 candidatures et zéro apporteur
 * actif coûte plus cher qu'un canal à 300 € qui en produit dix — et rien dans
 * les données ne permet de le voir tant que la dépense n'est pas enregistrée.
 *
 * Volontairement un fichier de code et non un réglage en base : une dépense
 * publicitaire est un événement rare (quelques fois par an et par canal), et la
 * poser ici la rend **versionnée** — on sait qui a écrit quel montant, quand, et
 * ce qu'il couvrait. Un champ libre en console aurait perdu cette trace.
 *
 * ⚠️ MONTANT CUMULÉ, pas le prix d'un dépôt. Republier une annonce = additionner,
 * et compléter la note. Un canal absent d'ici est traité comme **gratuit** (0 €),
 * ce qui est le bon défaut : la plupart le sont vraiment (Google for Jobs,
 * LinkedIn organique, bouche à oreille).
 *
 * Évolution possible si le rythme s'accélère : passer en réglage éditable en
 * console. Tant que les dépenses se comptent sur les doigts d'une main, ce
 * fichier suffit et documente mieux.
 */
export const COUTS_ANNONCES: Readonly<Record<string, CoutAnnonce>> = {
  // Exemple à compléter dès la première dépense réelle :
  // leboncoin: { montantEur: 0, note: "Dépôt initial du JJ/MM/AAAA" },
  // "memorial-isere": { montantEur: 0, note: "Encart du JJ/MM/AAAA" },
  // jemepropose: { montantEur: 0, note: "Annonce déposée le JJ/MM/AAAA" },
};

/** Dépense enregistrée pour un canal. Absent ⇒ 0 € (canal gratuit). */
export function coutAnnonce(source: string): number {
  return COUTS_ANNONCES[source]?.montantEur ?? 0;
}
