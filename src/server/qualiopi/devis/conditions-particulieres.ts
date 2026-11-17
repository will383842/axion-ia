/**
 * Conditions particulières d'un devis CLASSIQUE — logique PURE.
 *
 * Ni zod ni prisma : ce module est importé par le formulaire client (compteur,
 * avertissement) comme par le schéma serveur et les gabarits.
 */

/** Longueur maximale du texte, après normalisation côté serveur. */
export const CONDITIONS_PARTICULIERES_MAX = 4000;

/**
 * Phrase imprimée SOUS le texte, par le PDF et par la page de signature.
 * Constante UNIQUE : les deux surfaces ne peuvent pas diverger.
 *
 * ⚖️ Texte contractuel — à confirmer par le fondateur.
 */
export const PHRASE_PRIMAUTE_CONDITIONS_PARTICULIERES =
  "Les présentes conditions particulières, acceptées par la signature du présent devis, dérogent aux Conditions générales de vente ; en cas de contradiction, elles prévalent.";

/**
 * Mots qui ne doivent pas figurer sur un devis pour le moment. L'avertissement de
 * la saisie n'est pas bloquant : le serveur ne refuse rien.
 */
export const MOTS_SENSIBLES = [
  "certification",
  "certifié",
  "qualiopi",
  "opco",
  "prise en charge",
  "financement",
  "financeur",
] as const;

/**
 * Normalise la saisie : CRLF → LF, caractères de contrôle retirés (sauf \n et \t),
 * trois sauts de ligne ou plus ramenés à deux, bords retirés ; vide → `null`.
 */
export function normaliserConditionsParticulieres(s: string): string | null {
  const texte = s
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return texte === "" ? null : texte;
}

function sansCasseNiAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Mots sensibles présents dans `s` (sans casse ni accents), dans l'ordre de la liste. */
export function motsSensiblesTrouves(s: string): string[] {
  const texte = sansCasseNiAccents(s);
  return MOTS_SENSIBLES.filter((m) => texte.includes(sansCasseNiAccents(m)));
}
