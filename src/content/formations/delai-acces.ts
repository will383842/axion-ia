/**
 * Délai d'accès aux formations (indicateur 1 du Référentiel national qualité) —
 * SOURCE UNIQUE de tout ce que le site public en dit.
 *
 * 🔴 2026-10-02 — Règle décidée par le dirigeant. Le site affichait « sous 11
 * jours ouvrés minimum à compter de la confirmation d'inscription ». Ce chiffre
 * n'avait aucun fondement : introduit le 2026-06-06 comme valeur par défaut de la
 * fiche publique (commit fa085b755), sans source ni raison écrite, puis recopié
 * « partout » le 2026-09-30 (#1239) en le présentant comme « la règle réelle ». Ce
 * n'était pas la règle : une entreprise qui finance elle-même peut démarrer sous
 * 48 heures. Une mention plus longue que la réalité est une mention inexacte
 * (indicateur 1 : information exacte, aucune mention trompeuse).
 *
 * Ce module ne dépend de rien : il est lu par les fiches formation, les pages
 * villes, la FAQ transversale ET la base de connaissances du générateur de
 * contenus (qui ne doit importer aucun module lourd).
 *
 * ⚠️ Particulier qui finance lui-même sa formation : le contrat de formation lui
 * ouvre un délai de rétractation de 10 jours (art. L.6353-5 du Code du travail),
 * détaillé dans les CGV. La phrase ci-dessous ne vise que l'entreprise et l'OPCO,
 * seuls publics que le site propose aujourd'hui (formations intra-entreprise) ;
 * si une offre aux particuliers ouvre, ce délai devra figurer ici.
 */

/**
 * Corps de la règle, sans son étiquette. Texte validé par le dirigeant, tel quel.
 *
 * 🔴 2026-10-16 (L15, NC12) — nouvelle décision du dirigeant : « environ 2 semaines
 * entre votre demande et la formation ». Elle remplace la règle du 2026-10-02
 * (« dès 48 heures pour un financement direct… ») : une seule phrase, lue partout.
 */
export const DELAI_ACCES_CORPS = "environ 2 semaines entre votre demande et la formation.";

/** Phrase complète, à afficher là où le texte n'a pas déjà l'étiquette « Délai d'accès ». */
export const DELAI_ACCES_PHRASE = `Délai d'accès : ${DELAI_ACCES_CORPS}`;

/** Valeur d'un champ déjà étiqueté « Délai d'accès » (fiche formation) : même texte, initiale en capitale. */
export const DELAI_ACCES_VALEUR = `${DELAI_ACCES_CORPS.charAt(0).toUpperCase()}${DELAI_ACCES_CORPS.slice(1)}`;

/** Forme abrégée fidèle, pour les espaces courts (badge, ligne de fiche). */
export const DELAI_ACCES_COURT = "Environ 2 semaines entre votre demande et la formation";

/** Forme abrégée découpée pour les tuiles « chiffre + libellé ». */
export const DELAI_ACCES_FAIT = {
  figure: "≈ 2 sem.",
  label: "entre votre demande et la formation",
} as const;

/**
 * Complément, quand la page propose d'autres financeurs que l'OPCO : on n'invente
 * aucun délai à leur place.
 */
export function delaiAccesAutresFinanceurs(financeurs: ReadonlyArray<string>): string {
  if (financeurs.length === 0) return "";
  return `Avec ${financeurs.join(" ou ")}, comptez le délai de réponse du financeur.`;
}

/**
 * Formes de l'ancienne affirmation, que le contenu public ne doit plus porter.
 * Lu par la garde `delai-acces-une-seule-regle.spec.ts`.
 */
export const DELAI_ACCES_FORMES_RETIREES: ReadonlyArray<RegExp> = [
  /\b11\s+jours\s+ouvr/i,
  /\bonze\s+jours\s+ouvr/i,
  /jours\s+ouvrés\s+minimum/i,
  /figure:\s*"11 j"/,
  // 🔴 2026-10-16 (L15) — la règle « dès 48 heures / délai OPCO en sus » est remplacée
  // par la décision du dirigeant : « environ 2 semaines entre votre demande et la formation ».
  /d[èe]s\s+48\s*(h\b|heures)/i,
  /d[ée]lai\s+OPCO\s+en\s+sus/i,
];
