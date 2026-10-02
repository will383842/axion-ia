/**
 * Date de version du règlement intérieur — affichée sur la page publique
 * (« Mise à jour ») et imprimée sur le PDF remis au stagiaire (« Version du »).
 *
 * ## Pourquoi (2026-10-02)
 *
 * La page affichait « Mise à jour · 6 mai 2026 » (date alignée sur la
 * déclaration d'accessibilité, pas sur le règlement), alors que son texte a
 * changé le 24/08, les 13, 15 et 30/09 (article sur les violences, attestation,
 * santé-sécurité, représentation des stagiaires) — `git log -L` sur l'entrée
 * `reglement-interieur` de `src/content/legal.ts`. Et le PDF imprimait comme
 * « version » la date du jour du tirage : deux exemplaires du même texte
 * portaient deux versions différentes. Un document remis aux stagiaires dont la
 * date de version est fausse ne prouve pas quelle règle leur était opposable.
 *
 * ## La règle, et ce qui la garde
 *
 * La date est celle du DERNIER changement de contenu (ici : le texte de
 * l'article 3 quater et la numérotation du PDF, 2 octobre 2026). `empreinte` est
 * le SHA-256 du contenu publié (FR + EN) : le test
 * `src/content/__tests__/reglement-interieur-date-suit-le-texte.spec.ts`
 * rougit dès que le texte change sans que la date et l'empreinte soient
 * reprises ensemble.
 */

export const REGLEMENT_INTERIEUR_VERSION = {
  iso: "2026-10-02",
  libelleFr: "2 octobre 2026",
  libelleEn: "October 2, 2026",
  empreinte: "acab41e234396187cd2f8a2ff280d0b1c41c590f09fe5cba251aaf008b7ec5a8",
} as const;
