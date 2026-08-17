/**
 * 🔴 DIRE LA VÉRITÉ AU CLIC — que répond l'écran après un envoi ? Module PUR.
 *
 * ## Le défaut, Lot 3quinquies §2
 *
 * Cinq écrans déclenchent un envoi dont l'action peut répondre
 * `garePourValidation: true` — l'e-mail **n'est pas parti**, il attend une
 * approbation humaine dans la corbeille de validation.
 *
 * **Trois le disaient. Deux annonçaient un succès d'envoi dans les deux cas :**
 *
 *   · `DevisLifecycleButtons` → « Devis renvoyé par email à … »
 *   · `FactureFormationActions` → « Facture envoyée à … »
 *
 * Or l'action calcule **déjà** une `note` qui explique exactement la situation
 * — *« L'email attend votre validation dans Emails → À valider ; il partira une
 * fois approuvé »* — et les deux écrans la **jetaient**.
 *
 * ## Pourquoi ce n'est pas un détail de formulation
 *
 * Un admin qui lit « Facture envoyée » n'ira pas valider la corbeille. La
 * facture reste bloquée, le client ne reçoit rien, et **personne ne cherche** —
 * puisque l'écran a dit que c'était parti. Le message envoie l'utilisateur
 * exactement là où il ne faut pas.
 *
 * ## Pourquoi un module PUR, et pas un `if` dans chaque composant
 *
 * Il y a cinq écrans et trois formulations différentes du même fait. Une
 * quatrième naîtra au prochain écran. La règle vit donc ici, testable sans
 * jsdom — et surtout **sans monter un composant qui tire `next-auth`** par
 * import transitif, ce qui rend le test de composant impossible dans ce dépôt.
 *
 * 🔴 Le TON ne remplace pas le TEXTE. `attention` n'est qu'un renfort visuel :
 * la phrase dit déjà tout, conformément à la règle du dépôt — l'état s'écrit en
 * toutes lettres, la couleur ne fait que doubler (WCAG 1.4.1).
 */

/** Ce que l'action d'envoi rend, réduit à ce qui décide du message. */
export interface ResultatEnvoi {
  /** L'e-mail est-il réellement parti en file d'envoi ? */
  readonly enqueued: boolean;
  /** Est-il retenu dans la corbeille de validation, en attente d'approbation ? */
  readonly garePourValidation: boolean;
  readonly to: string;
  /**
   * Phrase calculée par l'action, qui explique la situation exacte.
   *
   * ⚠️ Quand elle existe, elle est RELAYÉE telle quelle : l'écran n'en invente
   * pas une autre. Deux phrases pour le même fait divergent, et c'est celle de
   * l'écran — la moins informée — qui gagnerait.
   */
  readonly note?: string | undefined;
}

export type TonMessage =
  /** L'e-mail est parti. */
  | "succes"
  /**
   * L'action a eu lieu, mais l'effet attendu — le départ de l'e-mail — n'a PAS
   * eu lieu. Ni un succès, ni une erreur : un troisième cas, qui appelle un
   * geste humain.
   */
  | "attention";

export interface MessageEnvoi {
  readonly ton: TonMessage;
  readonly texte: string;
}

/**
 * Le message à afficher après un envoi.
 *
 * @param objet — « Devis », « Facture »… au nominatif, il ouvre la phrase.
 */
export function messageEnvoi(objet: string, r: ResultatEnvoi): MessageEnvoi {
  if (r.garePourValidation) {
    return {
      ton: "attention",
      texte:
        r.note ??
        `${objet} enregistré : l'e-mail n'est PAS parti — il attend votre validation dans Emails → À valider.`,
    };
  }

  if (!r.enqueued) {
    // 🔴 Troisième cas, distinct des deux autres : la file est indisponible.
    // Le confondre avec un succès ferait croire l'envoi fait ; le confondre
    // avec la corbeille enverrait valider une file vide.
    return {
      ton: "attention",
      texte:
        r.note ??
        `${objet} enregistré, mais l'e-mail n'a pas pu être expédié (file d'attente indisponible) — réessayer plus tard.`,
    };
  }

  // Envoi réel. ⚠️ La note est quand même relayée si elle existe : l'action
  // peut avoir quelque chose à dire sur un envoi réussi (une signature
  // attendue qui n'a pas été créée, par exemple).
  return {
    ton: "succes",
    texte: r.note ?? `${objet} envoyé à ${r.to}.`,
  };
}
