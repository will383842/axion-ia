// @vitest-environment node

/**
 * Lot 3d — le PDF du relevé mensuel, rendu depuis `ContenuReleveV1` SEUL.
 * Le relevé n'est PAS une facture : la mention figure en tête ET en pied, aucun mot de facturation
 * (« facture à payer », « montant dû »…) n'est ajouté, et aucune donnée personnelle n'est lue.
 */
import React from "react";
import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const r2 = vi.hoisted(() => ({ uploadToR2: vi.fn(async (key: string) => ({ key })) }));
vi.mock("@/lib/r2-storage", () => ({
  uploadToR2: r2.uploadToR2,
  isR2Configured: () => true,
}));

import { MENTION_PAS_UNE_FACTURE } from "../types";
import { contenuExemple } from "./fixtures";
import {
  ReleveMensuelPdf,
  type EnteteReleve,
  rendreEtStockerPdfReleve,
  textesDuReleve,
} from "../pdf";

const ENTETE: EnteteReleve = { numero: "REL-2026-10-0001", destinataire: "Apporteur fictif" };

beforeEach(() => r2.uploadToR2.mockClear());

describe("PDF du relevé : n'est pas une facture", () => {
  it("porte la mention en tête ET en pied (deux occurrences au moins)", () => {
    const textes = textesDuReleve(contenuExemple(), ENTETE);
    const n = textes.filter((t) => t.includes("n'est pas une facture")).length;
    expect(n).toBeGreaterThanOrEqual(2);
    expect(textes).toContain(MENTION_PAS_UNE_FACTURE);
  });

  it("le titre n'est ni une facture ni une autofacture ; le numéro est REL-, jamais AXI-APP-", () => {
    const textes = textesDuReleve(contenuExemple(), ENTETE);
    const titre = textes.find((t) => t.startsWith("Relevé de commissions"))!;
    expect(titre).toBeTruthy();
    expect(titre.toLowerCase()).not.toMatch(/facture|autofacture/);
    const numero = textes.find((t) => t.startsWith("Relevé n° "))!;
    expect(numero).toMatch(/^Relevé n° REL-\d{4}-\d{2}-\d{4}$/);
    expect(numero).not.toContain("AXI-APP-");
  });

  it("en-tête : destinataire, contact réclamations, délais du contrat sans délai nouveau", () => {
    const tout = textesDuReleve(contenuExemple(), ENTETE).join("\n");
    expect(tout).toContain("Destinataire : Apporteur fictif");
    expect(tout).toContain("Réclamations : contact@axion-ia.com");
    expect(tout).toContain("30 jours, annexe 2, article 2.4");
    expect(tout).toContain("n'en crée aucun nouveau");
  });

  it("rectificatif : « Rectifie le relevé n° … du … » seulement s'il est fourni", () => {
    expect(textesDuReleve(contenuExemple(), ENTETE).join("\n")).not.toContain("Rectifie");
    const r = textesDuReleve(contenuExemple(), {
      ...ENTETE,
      rectifie: { numero: "REL-2026-10-0001", date: "2026-11-03" },
    }).join("\n");
    expect(r).toContain("Rectifie le relevé n° REL-2026-10-0001 du 03/11/2026");
  });

  it("le total du mois rend les sous-totaux facturées et versées", () => {
    const c = contenuExemple();
    const tout = textesDuReleve(c, ENTETE).join("\n");
    expect(tout).toContain(`Dont commissions facturées : ${c.sousTotaux.facturees.nb}`);
    expect(tout).toContain(`Dont commissions versées : ${c.sousTotaux.versees.nb}`);
  });

  it("ne contient aucun vocabulaire de facture à payer", () => {
    const tout = textesDuReleve(contenuExemple(), ENTETE).join("\n").toLowerCase();
    expect(tout).not.toMatch(/facture à payer|montant dû|à régler|payez/);
  });

  it("affiche la règle lue, ou le renvoi au décompte quand elle est absente", () => {
    const c = contenuExemple() as unknown as {
      facturees: { lignes: Array<Record<string, unknown>> };
    };
    const l = c.facturees.lignes[0]!;
    l.regle = null;
    l.renvoiDecompte = "AXI-APP-2026-0001";
    const tout = textesDuReleve(c as never, ENTETE).join("\n");
    expect(tout).toContain("voir le décompte de l'autofacture n° AXI-APP-2026-0001");
  });

  it("version courte quand il n'y a aucun mouvement", () => {
    const c = { ...contenuExemple(), aucunMouvement: true };
    expect(textesDuReleve(c, ENTETE).join("\n")).toContain("aucun mouvement");
  });

  it("n'expose aucun IBAN ni e-mail (seul le contact de réclamations de la société figure)", () => {
    const tout = textesDuReleve(contenuExemple(), ENTETE)
      .join("\n")
      .replaceAll("contact@axion-ia.com", "");
    expect(tout).not.toMatch(/FR\d{2}\s?\d{4}|@/);
  });

  it("le composant est un document A4", () => {
    const el = ReleveMensuelPdf({
      contenu: contenuExemple(),
      entete: ENTETE,
    }) as React.ReactElement;
    expect(el).toBeTruthy();
  });
});

describe("rendreEtStockerPdfReleve", () => {
  it("rend un vrai PDF, le dépose sous la clé donnée et rend { r2Key, sha256 } de ses octets", async () => {
    const cle = "apporteurs/releves/app-1/REL-2026-10-0001-abcd1234.pdf";
    const r = await rendreEtStockerPdfReleve(contenuExemple(), cle, ENTETE);
    expect(r.r2Key).toBe(cle);
    const [k, octets, type] = r2.uploadToR2.mock.calls[0] as unknown as [string, Buffer, string];
    expect(k).toBe(cle);
    expect(type).toBe("application/pdf");
    expect(octets.subarray(0, 4).toString()).toBe("%PDF");
    expect(r.sha256).toBe(createHash("sha256").update(octets).digest("hex"));
  });

  it("est reproductible : deux rendus du même contenu donnent les mêmes octets", async () => {
    const a = await rendreEtStockerPdfReleve(contenuExemple(), "k1", ENTETE);
    const b = await rendreEtStockerPdfReleve(contenuExemple(), "k1", ENTETE);
    expect(a.sha256).toBe(b.sha256);
  });

  it("refuse une clé vide", async () => {
    await expect(rendreEtStockerPdfReleve(contenuExemple(), "", ENTETE)).rejects.toThrow();
  });
});
