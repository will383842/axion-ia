/**
 * L'e-mail INTERNE « devis signé par le client » — ce qu'il DOIT dire et ne dire jamais.
 *
 *  · le numéro du devis et un lien vers la fiche, dans la console ;
 *  · AUCUNE donnée personnelle (pas de nom, pas d'adresse du client) ;
 *  · classé AUTOMATIQUE : c'est une notification à Will, pas un e-mail client.
 */

import { describe, it, expect } from "vitest";
import { renderEmailTemplate } from "./index";
import {
  EMAILS_A_VALIDER_PAR_DEFAUT,
  estEmailQualiopiAutomatique,
  libelleTemplateEmail,
} from "@/server/email/outbox-policy";

const PAYLOAD = {
  numeroDevis: "AXI-DEV-2026-042",
  etape: "a_contresigner",
  consoleUrl: "https://axion-ia.com/fr/admin-x/qualiopi/devis/abc",
};

describe("devis-signe-a-contresigner", () => {
  it("dit le numéro, demande la contresignature et mène à la fiche", async () => {
    const r = await renderEmailTemplate("devis-signe-a-contresigner", "fr", PAYLOAD);
    expect(r.subject).toContain("AXI-DEV-2026-042");
    expect(r.subject).toMatch(/contresigner/i);
    expect(r.text).toContain("AXI-DEV-2026-042");
    expect(r.html).toContain("/fr/admin-x/qualiopi/devis/abc");
  });

  it("l'étape « complète » dit que le devis est signé des deux parties", async () => {
    const r = await renderEmailTemplate("devis-signe-a-contresigner", "fr", {
      ...PAYLOAD,
      etape: "complete",
    });
    expect(r.subject).toMatch(/deux parties/i);
    expect(r.subject).not.toMatch(/contresigner/i);
  });

  it("rend sans charge utile, sans écrire « undefined »", async () => {
    const r = await renderEmailTemplate("devis-signe-a-contresigner", "fr", {});
    expect(r.text).not.toContain("undefined");
    expect(r.subject).not.toContain("undefined");
  });

  it("part seul : notification interne, jamais retenue en corbeille", () => {
    expect(estEmailQualiopiAutomatique("devis-signe-a-contresigner")).toBe(true);
    expect(EMAILS_A_VALIDER_PAR_DEFAUT).not.toContain("devis-signe-a-contresigner");
    expect(libelleTemplateEmail("devis-signe-a-contresigner")).not.toMatch(/«/);
  });
});
