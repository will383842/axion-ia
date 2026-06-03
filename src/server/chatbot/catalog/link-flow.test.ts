/**
 * T-38 — État conversationnel + confirmation avant lien (D-CONFIRM 🔒, doc 16 §6d).
 *
 * Vérifie : lien envoyé SEULEMENT après confirmation (ou raccourci « envoie
 * direct ») · annonce sans liens d'abord · reset propre si le client change d'avis.
 */

import { describe, it, expect } from "vitest";
import {
  detectLinkSignal,
  onSearchResults,
  onUserSignal,
  INITIAL_FLOW,
} from "@/server/chatbot/catalog/link-flow";

describe("T-38 detectLinkSignal", () => {
  it("« envoie direct » → shortcut_direct (prioritaire)", () => {
    expect(detectLinkSignal("envoie direct les liens")).toBe("shortcut_direct");
    expect(detectLinkSignal("juste le lien stp")).toBe("shortcut_direct");
  });
  it("« oui montrez » → confirm", () => {
    expect(detectLinkSignal("oui montrez-moi")).toBe("confirm");
    expect(detectLinkSignal("d'accord, envoyez les liens")).toBe("confirm");
  });
  it("« non, autre chose » → decline", () => {
    expect(detectLinkSignal("non, autre chose finalement")).toBe("decline");
  });
  it("message neutre → none", () => {
    expect(detectLinkSignal("et pour 8 personnes ?")).toBe("none");
  });
});

describe("T-38 machine à états — confirmation avant lien", () => {
  it("recherche → annonce (proposed), AUCUN lien envoyé d'abord", () => {
    const t = onSearchResults(["intervention-essentielle", "intervention-claude"]);
    expect(t.state.linkState).toBe("proposed");
    expect(t.sendLinks).toBe(false);
  });

  it("confirmation après annonce → liens envoyés (sent)", () => {
    const proposed = onSearchResults(["intervention-claude"]).state;
    const t = onUserSignal(proposed, "confirm");
    expect(t.sendLinks).toBe(true);
    expect(t.state.linkState).toBe("sent");
  });

  it("raccourci « envoie direct » dès la recherche → liens immédiats (sent)", () => {
    const t = onSearchResults(["intervention-claude"], { directShortcut: true });
    expect(t.state.linkState).toBe("sent");
    expect(t.sendLinks).toBe(true);
  });

  it("confirmation SANS offre en attente → pas d'envoi (no-op)", () => {
    const t = onUserSignal(INITIAL_FLOW, "confirm");
    expect(t.sendLinks).toBe(false);
    expect(t.state.linkState).toBe("idle");
  });

  it("le client change d'avis (decline) → reset propre, pas d'envoi", () => {
    const proposed = onSearchResults(["intervention-claude"]).state;
    const t = onUserSignal(proposed, "decline");
    expect(t.state).toEqual(INITIAL_FLOW);
    expect(t.sendLinks).toBe(false);
  });

  it("recherche vide → idle, pas d'annonce", () => {
    const t = onSearchResults([]);
    expect(t.state.linkState).toBe("idle");
    expect(t.sendLinks).toBe(false);
  });
});
