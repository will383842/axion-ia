// R7 — LA COMMISSION D'UN APPORTEUR NE SE CHIFFRE PLUS AU PUBLIC (ordre de Williams,
// 08/11/2026 : « il ne faut plus de prix affichés […] TOUT LE RESTE, IL NE FAUT PLUS
// RIEN AFFICHER NULLE PART » ; brief de marque : « apporteurs : sans prix ni promesse »).
//
// Les pages de recrutement d'apporteurs (tunnel Facebook, Indeed, Le Bon Coin, VSL,
// « apporteur d'affaires indépendant », /devenir-commercial-ia, /memo-isere) disaient
// « 500 € par journée vendue », « 30 % de la facture », et citaient le prix de vente des
// audits pour en calculer la commission. Elles disent désormais la même chose SANS
// chiffre : une commission sur chaque mission signée, détaillée au contrat.
//
// 🔑 On MASQUE, on ne supprime pas : les constantes `COMMISSION_*` / `COMMERCIAL_COMMISSIONS`
// de `pricing.ts` restent la source du barème — contrat, grille privée
// (`/apporteur/dossier/<id>/<jeton>/commissions`), e-mails à l'apporteur retenu
// (`_bareme-apporteur.ts`). Repasser `COMMISSIONS_PUBLIQUES_AFFICHEES` à `true`
// rétablit l'affichage chiffré là où il est conservé derrière ce drapeau ; ne le faire
// que sur décision de Williams.
//
// Témoin : `__tests__/apporteurs-sans-montant-public.spec.tsx` (rendu réel des pages).

/** Interrupteur unique de l'affichage chiffré des commissions au public. */
// 2026-11-11 — Williams : « il ne faut pas cacher les montants des commissions, au contraire c'est un
// atout ». Allumé : la commission de la Journée IA (500 € HT, `pricing.ts`) s'affiche, toujours « à titre
// indicatif ». Seuls les montants des audits et des formations restent masqués (ordre R7 du 08/11).
export const COMMISSIONS_PUBLIQUES_AFFICHEES: boolean = true;

/** Le discours qualitatif qui remplace les montants. Aucun chiffre, aucune promesse. */
export const COMMISSION_QUALITATIVE = {
  /** Titre d'un encart. */
  titre: "Une commission sur chaque mission signée",
  /** Phrase courte, insérable dans un texte (minuscule initiale). */
  phrase: "une commission sur chaque mission signée, détaillée dans votre contrat",
  /** Détail sous le titre. */
  detail:
    "Une formation ou un audit IA : chaque mission signée et payée par une entreprise que vous avez présentée ouvre droit à une commission. Son mode de calcul est détaillé dans votre contrat d'apporteur, remis avant tout engagement.",
  /** Rappel de prudence (garde `jur:remuneration-indicative`). */
  prudence:
    "Rien n'est garanti : la commission dépend uniquement des missions réellement signées et payées.",
  /** Réponse de FAQ « Combien ça rapporte ? ». */
  faq: "Une commission sur chaque mission signée et payée par une entreprise que vous avez présentée, formation ou audit IA. Son mode de calcul est détaillé dans votre contrat d'apporteur, remis avant tout engagement. Rien n'est garanti : elle dépend uniquement des missions réellement signées et payées.",
  /** Variante anglaise courte (métadonnées EN). */
  phraseEn: "a commission on every signed engagement, set out in your agreement",
} as const;
