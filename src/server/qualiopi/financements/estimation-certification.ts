/**
 * Qualiopi — une estimation de financement MUTUALISÉ ne se présente pas sans
 * certification (sous-lot 8G).
 *
 * ## Le défaut fermé ici
 *
 * Constaté à l'audit OPCO du 15/08 (`_AUDIT/OPCO-COMMERCIAL-2026-08-15/`, T8) :
 * `createDevisAction` calcule et enregistre `montantOpcoEstimeCents` sans jamais
 * consulter l'état de la certification, et le PDF imprime « Prise en charge
 * estimée : X € » dès que le champ existe.
 *
 * 🔴 Or l'accès aux fonds mutualisés — OPCO, CPF, France Travail — **exige la
 * certification** (art. L.6316-1). Tant qu'elle n'est pas délivrée, ce chiffre
 * n'est pas une estimation incertaine : c'est un montant **légalement
 * inaccessible**. Le devis est la pièce que le client lit et accepte ; y porter
 * ce montant, c'est promettre un financement qu'on ne peut pas obtenir.
 *
 * L'avertissement existait déjà (`validateFinancementMutualiseSansCertification`)
 * mais il vit sur la page financement d'une SESSION — donc **après** le devis,
 * c'est-à-dire après que le client a lu la promesse.
 *
 * ## Ce qu'on garde, et ce qu'on retire
 *
 * | | Sans certification |
 * |---|---|
 * | Calculer l'estimation | ✅ oui — c'est un chiffre de travail interne, utile pour préparer |
 * | La **stocker** sur le devis | ✅ oui — la retirer ferait perdre le travail de chiffrage |
 * | L'**imprimer** sur la pièce remise au client | ❌ **non** — c'est là que la promesse naît |
 *
 * C'est la même frontière que partout dans ce projet : **produire ≠ remettre**.
 * Le défaut n'était pas de calculer trop tôt, il était de montrer.
 *
 * ## ⚠️ Le drapeau doit dire la vérité pour que cette garde serve
 *
 * `isQualiopiCertificationObtenue()` lit `QUALIOPI_CERTIFICATION_OBTENUE`. Au
 * 16/08 la PRODUCTION porte encore `"true"` alors que le certificat n'a jamais
 * été délivré : tant que Will ne l'a pas repassé à `false`, cette garde ne se
 * déclenche pas. Elle est écrite pour le jour où le drapeau sera juste — et ce
 * module ne le corrige pas de lui-même, parce qu'un code qui décide seul qu'il
 * ne croit pas sa configuration est pire que le mensonge qu'il répare.
 *
 * Aucun import Prisma ni Next : mêmes entrées, mêmes sorties.
 */

/**
 * Financements dont l'accès est subordonné à la certification (L.6316-1).
 *
 * `direct` en est absent : il est intégralement sur fonds propres. `mixte` aussi,
 * et c'est délibéré — il reste finançable pour sa part directe, et le rendre
 * inexploitable en bloc interdirait une affaire parfaitement licite. Même
 * découpage que `validateFinancementMutualiseSansCertification`, à dessein :
 * deux listes de financements mutualisés finiraient par diverger.
 */
const FINANCEMENTS_MUTUALISES = ["opco", "cpf", "france_travail"] as const;

export interface RegimeEstimation {
  /**
   * L'estimation peut-elle figurer sur la pièce remise au client ?
   * `false` ne veut pas dire « ne pas calculer » : voir l'en-tête du module.
   */
  presentable: boolean;
  /**
   * Ce qu'on imprime À LA PLACE du montant, ou `null` s'il n'y a rien à dire.
   *
   * 🔴 Le silence n'était pas une option : retirer le bloc sans explication
   * laisserait le client croire qu'aucun financement n'existe pour cette
   * formation, ce qui est faux et lui coûterait de l'argent. On dit donc
   * exactement ce qui est vrai — le dispositif existe, il n'est pas encore
   * ouvert chez nous.
   */
  mention: string | null;
}

/**
 * Décide du sort d'une estimation de financement mutualisé.
 *
 * @param financement valeur brute de `financementSuggere` (devis) ou
 *   `financementType` (session). Tolère `null`/`undefined`/libellé inconnu :
 *   ce qui n'est pas reconnu comme mutualisé est laissé passer.
 */
export function regimeEstimationMutualisee(
  financement: string | null | undefined,
  certificationObtenue: boolean,
): RegimeEstimation {
  if (certificationObtenue) return { presentable: true, mention: null };

  const normalise = (financement ?? "").trim().toLowerCase();
  const estMutualise = (FINANCEMENTS_MUTUALISES as readonly string[]).includes(normalise);
  if (!estMutualise) return { presentable: true, mention: null };

  return {
    presentable: false,
    mention:
      "Financement mutualisé (OPCO, CPF, France Travail) : aucune estimation de prise en charge " +
      "n'est communiquée à ce stade. L'accès à ces fonds est subordonné à la certification " +
      "Qualiopi de l'organisme (art. L.6316-1), qui n'est pas encore délivrée. La présente offre " +
      "est donc établie pour un règlement direct ; une estimation vous sera transmise dès que la " +
      "certification sera obtenue.",
  };
}

/**
 * Avertissement destiné à l'ADMIN au moment où il crée le devis — pas au client.
 *
 * Distinct de `mention` : celle-ci est rédigée pour être lue par le client sur
 * le PDF, celui-ci pour que la personne qui saisit comprenne pourquoi son
 * chiffrage ne s'imprimera pas. Les confondre produirait soit un PDF qui parle
 * de configuration interne, soit un écran qui parle au client.
 */
export function avertissementEstimationAdmin(
  financement: string | null | undefined,
  certificationObtenue: boolean,
): string | null {
  if (regimeEstimationMutualisee(financement, certificationObtenue).presentable) return null;
  return (
    "Estimation calculée et enregistrée, mais NON imprimée sur le devis : la certification " +
    "Qualiopi n'est pas obtenue, et l'accès aux fonds mutualisés l'exige (art. L.6316-1). " +
    "Le PDF porte à la place une mention expliquant au client que l'offre est établie pour un " +
    "règlement direct."
  );
}
