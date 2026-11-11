// Landings de RÉCEPTION D'ANNONCE — une route racine par canal (`/leboncoin`, `/indeed`), de la
// même forme que `/memo-isere`.
//
// Refonte du 09/11/2026 : toutes ces pages sont générées depuis UNE maquette validée par Williams
// (`src/components/recrutement/landings/SectionsPub.tsx`, variante « annonce »). Seul le badge
// d'entrée change par canal : l'offre est la même partout (la Journée IA, une commission
// indicative par journée payée). Dupliquer l'offre par source la ferait diverger en trois semaines.
//
// Elles ne servent QU'À CONVERTIR le trafic d'une annonce : elles ne visent aucun mot-clé et sont
// toutes en `noindex` (sauf `/memo-isere`, page de presse locale, qui a sa propre route).
// Cf. `docs/annonce-leboncoin-recrutement.md` §4.
//
// 🔴 AUCUN MONTANT EN DUR ICI. Les montants viennent de `pricing.ts` (SSOT).
//
// VOUVOIEMENT — décision Will du 29/09/2026.

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
  /** Libellé humain du canal — affiché dans le badge du héros. */
  readonly canal: string;
  /** Titre SEO/onglet (la page est noindex, mais l'onglet et l'aperçu comptent). */
  readonly metaTitle: string;
  readonly metaDescription: string;
}

export const PARTENAIRE_LANDINGS: Readonly<Record<PartenaireSource, PartenaireLanding>> = {
  leboncoin: {
    source: "leboncoin",
    canal: "Vu sur Le Bon Coin",
    metaTitle: "Présentez la Journée IA à vos contacts dirigeants · Axion-IA",
    metaDescription:
      "Vous connaissez des dirigeants ? Présentez-leur la Journée IA, nous faisons le reste. Sans CV, sans frais d'entrée, sans exclusivité.",
  },

  /**
   * Indeed. ⚠️ Indeed ne moissonne aucun balisage du site (et le site n'en publie plus pour les
   * apporteurs depuis le 2026-09-19) : la publication y est manuelle (ou par flux XML). Cette
   * landing est donc la cible du lien déposé À LA MAIN dans l'annonce Indeed.
   *
   * « Sans CV » est dit dès le héros : c'est LA différence qui compte face à l'attente d'une
   * personne venue d'Indeed, où l'on postule presque toujours en déposant un CV.
   */
  indeed: {
    source: "indeed",
    canal: "Vu sur Indeed · sans CV",
    metaTitle: "Apporteur d'affaires IA indépendant, sans CV · Axion-IA",
    metaDescription:
      "Apporteur d'affaires indépendant : présentez la Journée IA à des dirigeants que vous connaissez, nous faisons le reste. Sans CV, sans frais d'entrée.",
  },
};

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
 * 🔴 SANS CE CHIFFRE, L'ÉCRAN DE PILOTAGE COMPARE DES VOLUMES, PAS DES RENTABILITÉS. Un canal
 * gratuit qui produit 200 candidatures et zéro apporteur actif coûte plus cher qu'un canal à
 * 300 € qui en produit dix — et rien dans les données ne permet de le voir tant que la dépense
 * n'est pas enregistrée.
 *
 * Volontairement un fichier de code et non un réglage en base : une dépense publicitaire est un
 * événement rare, et la poser ici la rend **versionnée**.
 *
 * ⚠️ MONTANT CUMULÉ, pas le prix d'un dépôt. Republier une annonce = additionner, et compléter la
 * note. Un canal absent d'ici est traité comme **gratuit** (0 €), ce qui est le bon défaut.
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
