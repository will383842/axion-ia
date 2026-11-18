import { describe, it, expect } from "vitest";
import { estIssueInconnue, PREFIXE_ISSUE_INCONNUE } from "../reponse-manuelle-etat";

describe("estIssueInconnue", () => {
  it("null → faux", () => expect(estIssueInconnue(null)).toBe(false));
  it("undefined → faux", () => expect(estIssueInconnue(undefined)).toBe(false));
  it("texte sans préfixe → faux", () => expect(estIssueInconnue("Envoi non abouti")).toBe(false));
  it("texte commençant par le préfixe → vrai", () =>
    expect(estIssueInconnue(PREFIXE_ISSUE_INCONNUE + "détail")).toBe(true));
});
