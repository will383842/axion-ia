/**
 * JUR-T44b (Axion Partners), suite de JUR-T44 — le composeur de réponse de la console
 * (contacts/candidatures/[id]) ne propose plus le lien du PDF « Devenir
 * apporteur d'affaires », et les textes qui annonçaient son envoi ne le font
 * plus.
 *
 * Décision C1 de Williams du 2026-10-01 (option A, « retirer tout de suite ») :
 * le document est retiré de tout ce qui part vers un candidat jusqu'à sa
 * réécriture (JUR-T45). Le retrait du composeur est inconditionnel (arbitrage de
 * la coordination, sur délégation) : JUR-T45 le remettra.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { liensImprimesPourEmail } from "../liens-email";
import { DOCUMENT_APPORTEUR_CHEMIN } from "@/lib/commercial-application/kit-apporteur";
import { IMPRIMES } from "@/content/imprimes";
import { FORMULAIRE } from "@/content/recrutement/tunnel-facebook";
import { phraseInvitation } from "@/lib/commercial-application/issues-invitation";

const NOM_DU_PDF = DOCUMENT_APPORTEUR_CHEMIN.split("/").pop()!;
const DOCUMENT_ANNONCE = /document de présentation|presentation document/i;

describe("JUR-T44b — aucun imprimé proposé ne pointe vers le PDF apporteur", () => {
  it("le composeur ne propose ni l'imprimé « devenir-apporteur », ni aucun lien vers le PDF", () => {
    const liens = liensImprimesPourEmail("https://exemple.invalid");
    expect(liens.map((l) => l.id)).not.toContain("devenir-apporteur");
    for (const l of liens) expect(l.url).not.toContain(NOM_DU_PDF);
  });

  it("la fiche de l'imprimé ne dit plus qu'il est envoyé automatiquement", () => {
    const fiche = IMPRIMES.find((i) => i.id === "devenir-apporteur");
    expect(fiche?.resume ?? "").not.toMatch(/envoyé automatiquement/i);
  });

  it("le formulaire du tunnel n'annonce plus le document", () => {
    expect(FORMULAIRE.micro).not.toMatch(DOCUMENT_ANNONCE);
  });

  it("le message d'une invitation envoyée n'annonce plus le document", () => {
    expect(phraseInvitation("envoyee").texte).not.toMatch(DOCUMENT_ANNONCE);
  });
});
