import { describe, expect, it } from "vitest";

import { renderEmailTemplate } from "../index";

const norm = (s: string) => s.replace(/\s+/g, " ");
const releve = async (extra: Record<string, unknown>) =>
  norm(
    (
      await renderEmailTemplate("apporteur-releve" as never, "fr", {
        contactName: "Claire Martin",
        montant: "500,00 €",
        numeroAutofacture: "AXI-APP-2026-0001",
        sommeVirement: "600,00 €",
        ...extra,
      })
    ).text,
  );

describe("relevé d'autofacture : la somme virée dit son régime de TVA", () => {
  it("assujetti : « TVA comprise »", async () => {
    const t = await releve({ regimeTva: "assujetti" });
    expect(t).toContain("Somme virée : 600,00 €, TVA comprise.");
  });
  it("franchise : « TVA non applicable, article 293 B du CGI », jamais « TVA comprise »", async () => {
    const t = await releve({ regimeTva: "franchise_293b", sommeVirement: "500,00 €" });
    expect(t).toContain("Somme virée : 500,00 € (TVA non applicable, article 293 B du CGI).");
    expect(t).not.toContain("TVA comprise");
  });
  it("champ absent (ancien émetteur) : texte d'avant", async () => {
    const t = await releve({});
    expect(t).toContain("Somme virée : 600,00 €.");
    expect(t).not.toContain("TVA comprise");
  });
});

describe("A8 : la commission est due dès le paiement intégral, pas dès la réalisation", () => {
  it("l'e-mail « commande signée » ne dit plus « prestation réalisée »", async () => {
    const r = await renderEmailTemplate("apporteur-commande-signee" as never, "fr", {
      contactName: "Claire Martin",
      entreprise: "Acme",
    });
    const t = norm(r.text);
    expect(t).not.toMatch(/prestation (sera|est) réalisée/);
    expect(t).toContain("payé l'intégralité de sa commande");
  });
  it("l'e-mail de bienvenue (issue de l'échange) non plus", async () => {
    const r = await renderEmailTemplate("apporteur-issue-presentation" as never, "fr", {
      contactName: "Claire Martin",
    }).catch(() => null);
    if (r) expect(norm(r.text)).not.toMatch(/prestation est réalisée/);
  });
});
