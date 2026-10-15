// L'accusé de réception dit « N pièce(s) jointe(s) bien reçue(s) » — et rien
// quand la demande est arrivée sans fichier (2026-10-15).

import { describe, expect, it } from "vitest";

import { renderEmailTemplate } from "../index";
import { phrasePiecesJointesRecues } from "../_pieces-jointes-recues";

const BASE = { contactName: "Camille", submissionId: "sub-1", companyName: "Exemple SARL" };
const GABARITS = [
  "contact-confirmed",
  "audit-confirmed",
  "implementation-confirmed",
  "quote-request-received",
] as const;

describe("accusé de réception — pièces jointes", () => {
  it("accorde la phrase au nombre", () => {
    expect(phrasePiecesJointesRecues("fr", 1)).toBe("1 pièce jointe bien reçue.");
    expect(phrasePiecesJointesRecues("fr", 3)).toBe("3 pièces jointes bien reçues.");
  });

  it.each(GABARITS)("%s mentionne les pièces reçues", async (gabarit) => {
    const { html } = await renderEmailTemplate(gabarit, "fr", { ...BASE, piecesJointesRecues: 2 });
    expect(html).toContain("2 pièces jointes bien reçues.");
  });

  it.each(GABARITS)("%s ne dit rien sans pièce jointe", async (gabarit) => {
    const { html } = await renderEmailTemplate(gabarit, "fr", BASE);
    expect(html).not.toMatch(/pièces? jointes? bien reçue/);
  });
});
