// @vitest-environment node
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/r2-storage", () => ({ uploadToR2: vi.fn() }));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: vi.fn() }));
vi.mock("@/server/cgv-pdf", () => ({ rendreCgvPdf: vi.fn() }));
vi.mock("@/server/qualiopi/config/site-settings", () => ({ getQualiopiConfig: vi.fn() }));

import {
  envoyerConfirmationCommande,
  cleCgvAcceptees,
  type DependancesConfirmation,
} from "./confirmation-commande";
import { CGV_VERSION } from "@/content/cgv-version";

const OFFRE = {
  v: 1,
};

function deps(over: Partial<DependancesConfirmation> & { devis?: unknown } = {}) {
  const enfiler = vi.fn(async () => ({ enqueued: true }));
  const deposer = vi.fn(async () => undefined);
  const d: DependancesConfirmation = {
    lireDevis: async () =>
      (over.devis as never) ?? {
        id: "dv1",
        numero: "AXI-DEV-1",
        lignes: [{ designation: "x", quantite: 1, prixUnitaireHtCents: 100_000 }],
        offre: null,
        client: { raisonSociale: "Acme", contactEmail: "a@acme.fr" },
      },
    formulesActives: async () => false,
    regimeEtTaux: async () => ({ regime: "assujetti", taux: 20 }),
    pdfCgv: async () => Buffer.from("pdf"),
    deposer,
    enfiler: enfiler as never,
    ...over,
  };
  return { d, enfiler, deposer };
}

const DEMANDE = {
  declencheur: "contresignature_axion_explicite" as const,
  devisId: "dv1",
  pdfDevisSigneR2Key: "documents/2026/devis/AXI-DEV-1.pdf",
};

describe("envoyerConfirmationCommande", () => {
  it("devis classique : e-mail avec montants HT/TVA/TTC, CGV et devis signé en PJ", async () => {
    const { d, enfiler, deposer } = deps();
    const r = await envoyerConfirmationCommande(DEMANDE, d);
    expect(r).toEqual({ envoye: true, garePourValidation: false });
    expect(deposer).toHaveBeenCalledWith(cleCgvAcceptees(), expect.any(Buffer));
    const [tpl, to, , payload, opts] = enfiler.mock.calls[0] as unknown as [
      string,
      string,
      string,
      Record<string, string>,
      { attachments: { r2Key: string }[] },
    ];
    expect(tpl).toBe("devis-commande-confirmation");
    expect(to).toBe("a@acme.fr");
    expect(payload["montantHtLabel"]).toMatch(/1\s?000,00/);
    expect(payload["montantTtcLabel"]).toMatch(/1\s?200,00/);
    expect(opts.attachments.map((a) => a.r2Key)).toEqual([
      DEMANDE.pdfDevisSigneR2Key,
      `documents/cgv/CGV-${CGV_VERSION}.pdf`,
    ]);
  });
  it("INERTE si l'interrupteur formules est éteint et que le devis porte une offre", async () => {
    const { d, enfiler } = deps({
      devis: {
        id: "dv1",
        numero: "N",
        lignes: [],
        offre: OFFRE,
        client: { raisonSociale: "A", contactEmail: "a@a.fr" },
      },
    });
    expect(await envoyerConfirmationCommande(DEMANDE, d)).toEqual({
      envoye: false,
      raison: "formules_eteintes",
    });
    expect(enfiler).not.toHaveBeenCalled();
  });
  it("formules allumées mais aucun choix transmis : rien ne part", async () => {
    const { d, enfiler } = deps({
      formulesActives: async () => true,
      devis: {
        id: "dv1",
        numero: "N",
        lignes: [],
        offre: OFFRE,
        client: { raisonSociale: "A", contactEmail: "a@a.fr" },
      },
    });
    expect(await envoyerConfirmationCommande(DEMANDE, d)).toEqual({
      envoye: false,
      raison: "choix_requis",
    });
    expect(enfiler).not.toHaveBeenCalled();
  });
  it("sans adresse ou devis introuvable : rien ne part", async () => {
    const a = deps({
      devis: {
        id: "d",
        numero: "N",
        lignes: [],
        offre: null,
        client: { raisonSociale: "A", contactEmail: " " },
      },
    });
    expect((await envoyerConfirmationCommande(DEMANDE, a.d)).envoye).toBe(false);
    const b = deps({ lireDevis: async () => null });
    expect(await envoyerConfirmationCommande(DEMANDE, b.d)).toEqual({
      envoye: false,
      raison: "devis_introuvable",
    });
    expect(a.enfiler).not.toHaveBeenCalled();
  });
  it("file indisponible : résultat typé, pas d'exception", async () => {
    const { d } = deps({ enfiler: vi.fn(async () => ({ enqueued: false })) as never });
    expect(await envoyerConfirmationCommande(DEMANDE, d)).toEqual({
      envoye: false,
      raison: "file_indisponible",
    });
  });
  it("jamais déclenchée hors de l'action explicite : aucun cron/webhook/worker ne l'importe", async () => {
    const { execSync } = await import("node:child_process");
    const out = execSync(
      "grep -rln 'confirmation-commande' src --include=*.ts --include=*.tsx || true",
      { encoding: "utf8" },
    );
    const importeurs = out
      .split("\n")
      .filter(
        (f) =>
          f &&
          !f.endsWith("confirmation-commande.ts") &&
          !f.endsWith("confirmation-commande.spec.ts") &&
          !f.includes("catalogue.ts"),
      );
    expect(importeurs.filter((f) => /webhook|cron|worker|queue/i.test(f))).toEqual([]);
  });
});
