import { describe, expect, it } from "vitest";

import { renderEmailTemplate } from "../index";

const norm = (s: string) => s.replace(/\s+/g, " ");
const rendu = async (payload: Record<string, unknown>) =>
  renderEmailTemplate("apporteur-regime-tva" as never, "fr", {
    contactName: "Claire Martin",
    effetAu: "1er décembre 2026",
    ...payload,
  });

describe("e-mail « changement de régime de TVA » (contrat 2.8, art. 4.7 et 6.3)", () => {
  it("passage à la TVA : le n° de TVA, la date, l'article 4.7 et la contestation (art. 6.3)", async () => {
    const r = await rendu({ regime: "assujetti", numeroTva: "FR00123456782" });
    const t = norm(r.text);
    expect(r.subject).toBe("Votre régime de TVA est mis à jour");
    expect(t).toContain("à compter du 1er décembre 2026, vous facturez la TVA (n° FR00123456782)");
    expect(t).toContain("article 4.7");
    expect(t).toContain("Les factures déjà émises ne sont pas modifiées");
    expect(t).toContain("article 6.3");
  });

  it("sortie de la TVA : franchise en base, article 293 B", async () => {
    const t = norm((await rendu({ regime: "franchise_293b" })).text);
    expect(t).toContain("vous ne facturez pas la TVA (franchise en base, article 293 B du CGI)");
    expect(t).not.toContain("n° ");
  });

  it("assujetti sans n° fourni : jamais de « n° » vide", async () => {
    const t = norm((await rendu({ regime: "assujetti" })).text);
    expect(t).toContain("vous facturez la TVA.");
  });

  it("variante annulation", async () => {
    const r = await rendu({ regime: "franchise_293b", annule: true });
    expect(r.subject).toBe("Votre changement de régime de TVA est annulé");
    expect(norm(r.text)).toContain("est annulé : votre régime actuel reste inchangé");
  });

  it("aucune occurrence de « débits » ni de TTC (la commission reste hors taxes)", async () => {
    for (const p of [
      { regime: "assujetti", numeroTva: "FR00123456782" },
      { regime: "franchise_293b" },
      { regime: "franchise_293b", annule: true },
    ]) {
      const t = norm((await rendu(p)).text);
      expect(t).not.toMatch(/débits|TTC/i);
    }
  });
});
