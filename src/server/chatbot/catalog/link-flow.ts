// État conversationnel « chercher → annoncer → confirmer → envoyer » (T-38, doc 16 §6d).
//
// D-CONFIRM 🔒 : on confirme AVANT d'envoyer les liens d'offre, SAUF raccourci
// « envoie direct » (client pressé). Machine à états pure ; la persistance des
// champs `chat_conversations.search_slots / proposed_offers / link_state` (T-01)
// est faite par l'orchestrateur (T-07). Reset propre si le client change d'avis.

export type LinkState = "idle" | "proposed" | "sent";

export interface LinkFlowState {
  readonly linkState: LinkState;
  /** ids des offres proposées au tour courant. */
  readonly proposedOfferIds: ReadonlyArray<string>;
}

export type UserSignal = "confirm" | "shortcut_direct" | "decline" | "none";

export interface FlowTransition {
  readonly state: LinkFlowState;
  /** true → l'orchestrateur doit émettre les cartes/liens cliquables maintenant. */
  readonly sendLinks: boolean;
}

export const INITIAL_FLOW: LinkFlowState = { linkState: "idle", proposedOfferIds: [] };

/** Détecte un signal d'avancement dans un message utilisateur (FR). */
export function detectLinkSignal(message: string): UserSignal {
  const m = message.toLowerCase().normalize("NFC");
  // Raccourci « envoie direct » testé en premier (prioritaire sur un simple oui).
  if (
    /envoie?[\s-]*(moi)?\s*(les liens?|tout)?\s*(direct(ement)?|tout de suite|maintenant|sans détour)|juste le lien|juste les liens|direct(ement)?\b|tout de suite/i.test(
      m,
    )
  )
    return "shortcut_direct";
  if (
    /^(oui|ok|okay|d'accord|daccord|carr[ée]ment|volontiers|parfait|allez-y|allez y|je veux bien|oui merci)\b|montre[rz]?|envoie[rz]?|envoyez|je veux les? liens?|les liens? svp|partagez/i.test(
      m,
    )
  )
    return "confirm";
  if (
    /^(non|nan|pas (maintenant|tout de suite)|laisse tomber|annule|autre chose|finalement non|plutôt|plutot)\b|change[rz]? d'avis/i.test(
      m,
    )
  )
    return "decline";
  return "none";
}

/**
 * Une recherche vient de produire des offres. Sans raccourci → on ANNONCE et on
 * passe en `proposed` (pas encore de liens). Avec raccourci « envoie direct » →
 * on envoie immédiatement (`sent`).
 */
export function onSearchResults(
  offerIds: ReadonlyArray<string>,
  opts: { directShortcut?: boolean } = {},
): FlowTransition {
  if (offerIds.length === 0) {
    return { state: { linkState: "idle", proposedOfferIds: [] }, sendLinks: false };
  }
  if (opts.directShortcut) {
    return { state: { linkState: "sent", proposedOfferIds: offerIds }, sendLinks: true };
  }
  return { state: { linkState: "proposed", proposedOfferIds: offerIds }, sendLinks: false };
}

/** Applique un signal utilisateur à l'état courant. */
export function onUserSignal(state: LinkFlowState, signal: UserSignal): FlowTransition {
  switch (signal) {
    case "confirm":
    case "shortcut_direct":
      // On n'envoie que s'il y a des offres en attente de confirmation.
      if (state.linkState === "proposed" && state.proposedOfferIds.length > 0) {
        return { state: { ...state, linkState: "sent" }, sendLinks: true };
      }
      return { state, sendLinks: false };
    case "decline":
      // Le client change d'avis → reset propre (réouvre la recherche).
      return { state: INITIAL_FLOW, sendLinks: false };
    case "none":
      return { state, sendLinks: false };
  }
}

/** Reset explicite (nouvelle recherche / changement d'avis). */
export function resetFlow(): LinkFlowState {
  return INITIAL_FLOW;
}
