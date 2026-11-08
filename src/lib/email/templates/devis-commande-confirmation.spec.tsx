import { describe, it, expect } from "vitest";
import { renderEmailTemplate } from "./index";
import { EMAILS_AUTOMATIQUES_PAR_DEFAUT, libelleTemplateEmail } from "@/server/email/outbox-policy";

const PAYLOAD = {
  clientNom: "Acme",
  numero: "AXI-DEV-2026-014",
  formuleRetenue: "Abonnement",
  montantHtLabel: "1 000,00 €",
  montantTvaLabel: "200,00 €",
  montantTtcLabel: "1 200,00 €",
  cgvVersionLabel: "4 octobre 2026",
  cgvJointes: true,
};

describe("devis-commande-confirmation", () => {
  it("confirme la commande, la formule, HT/TVA/TTC et la version des CGV", async () => {
    const r = await renderEmailTemplate("devis-commande-confirmation", "fr", PAYLOAD);
    expect(r.subject).toContain("AXI-DEV-2026-014");
    for (const t of ["Abonnement", "1 000,00 €", "200,00 €", "1 200,00 €", "4 octobre 2026"]) {
      expect(r.text).toContain(t);
    }
    expect(r.text).toContain("contrat est formé");
    expect(r.text).toMatch(/pièces jointes/);
    expect(r.text).not.toMatch(/aucun gain garanti|en un clic/i);
  });
  it("CGV non retrouvables : ni version citée ni CGV annoncées en pièce jointe", async () => {
    const { cgvVersionLabel: _v, cgvJointes: _j, ...sans } = PAYLOAD;
    const r = await renderEmailTemplate("devis-commande-confirmation", "fr", sans);
    expect(r.text).not.toContain("Conditions générales de vente acceptées");
    expect(r.text).not.toMatch(/conditions générales de vente acceptées, au format/);
    expect(r.text).toMatch(/pièce jointe le devis signé/);
  });
  it("sans formule, la ligne « Formule retenue » est absente", async () => {
    const { formuleRetenue: _f, ...sans } = PAYLOAD;
    const r = await renderEmailTemplate("devis-commande-confirmation", "fr", sans);
    expect(r.text).not.toContain("Formule retenue");
  });
  it("ne part JAMAIS seul (file à valider) et porte un libellé", () => {
    expect(EMAILS_AUTOMATIQUES_PAR_DEFAUT).not.toContain("devis-commande-confirmation");
    expect(libelleTemplateEmail("devis-commande-confirmation")).toMatch(/Confirmation de commande/);
  });
});
