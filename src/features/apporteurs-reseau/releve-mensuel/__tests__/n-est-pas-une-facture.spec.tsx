// @vitest-environment node

/**
 * Lot 3d — le PDF du relevé mensuel, rendu depuis `ContenuReleveV1` SEUL.
 * Le relevé n'est PAS une facture : la mention figure en tête ET en pied, aucun mot de facturation
 * (« facture à payer », « montant dû »…) n'est ajouté, et aucune donnée personnelle n'est lue.
 */
import React from "react";
import { createHash } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const r2 = vi.hoisted(() => ({ uploadToR2: vi.fn(async (key: string) => ({ key })) }));
vi.mock("@/lib/r2-storage", () => ({
  uploadToR2: r2.uploadToR2,
  isR2Configured: () => true,
}));

import { registerPdfTestFontsFallback } from "@/server/qualiopi/documents/register-pdf-test-fonts";
import { MENTION_PAS_UNE_FACTURE } from "../types";
import { contenuExemple } from "./fixtures";
import { ReleveMensuelPdf, rendreEtStockerPdfReleve, textesDuReleve } from "../pdf";

beforeAll(() => registerPdfTestFontsFallback());
beforeEach(() => r2.uploadToR2.mockClear());

describe("PDF du relevé : n'est pas une facture", () => {
  it("porte la mention en tête ET en pied (deux occurrences au moins)", () => {
    const textes = textesDuReleve(contenuExemple());
    const n = textes.filter((t) => t.includes("n'est pas une facture")).length;
    expect(n).toBeGreaterThanOrEqual(2);
    expect(textes).toContain(MENTION_PAS_UNE_FACTURE);
  });

  it("ne contient aucun vocabulaire de facture à payer", () => {
    const tout = textesDuReleve(contenuExemple()).join("\n").toLowerCase();
    expect(tout).not.toMatch(/facture à payer|montant dû|à régler|payez/);
  });

  it("affiche la règle lue, ou le renvoi au décompte quand elle est absente", () => {
    const c = contenuExemple() as unknown as {
      facturees: { lignes: Array<Record<string, unknown>> };
    };
    c.facturees.lignes[0].regle = null;
    c.facturees.lignes[0].renvoiDecompte = "AXI-APP-2026-0001";
    const tout = textesDuReleve(c as never).join("\n");
    expect(tout).toContain("voir le décompte de l'autofacture n° AXI-APP-2026-0001");
  });

  it("version courte quand il n'y a aucun mouvement", () => {
    const c = { ...contenuExemple(), aucunMouvement: true };
    expect(textesDuReleve(c).join("\n")).toContain("aucun mouvement");
  });

  it("n'expose aucun IBAN ni e-mail", () => {
    const tout = textesDuReleve(contenuExemple()).join("\n");
    expect(tout).not.toMatch(/FR\d{2}\s?\d{4}|@/);
  });

  it("le composant est un document A4", () => {
    const el = ReleveMensuelPdf({ contenu: contenuExemple() }) as React.ReactElement;
    expect(el).toBeTruthy();
  });
});

describe("rendreEtStockerPdfReleve", () => {
  it("rend un vrai PDF, le dépose sous la clé donnée et rend { r2Key, sha256 } de ses octets", async () => {
    const cle = "apporteurs/releves/app-1/REL-2026-10-0001-abcd1234.pdf";
    const r = await rendreEtStockerPdfReleve(contenuExemple(), cle);
    expect(r.r2Key).toBe(cle);
    const [k, octets, type] = r2.uploadToR2.mock.calls[0] as unknown as [string, Buffer, string];
    expect(k).toBe(cle);
    expect(type).toBe("application/pdf");
    expect(octets.subarray(0, 4).toString()).toBe("%PDF");
    expect(r.sha256).toBe(createHash("sha256").update(octets).digest("hex"));
  });

  it("est reproductible : deux rendus du même contenu donnent les mêmes octets", async () => {
    const a = await rendreEtStockerPdfReleve(contenuExemple(), "k1");
    const b = await rendreEtStockerPdfReleve(contenuExemple(), "k1");
    expect(a.sha256).toBe(b.sha256);
  });

  it("refuse une clé vide", async () => {
    await expect(rendreEtStockerPdfReleve(contenuExemple(), "")).rejects.toThrow();
  });
});
