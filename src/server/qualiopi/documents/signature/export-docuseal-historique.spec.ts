// @vitest-environment node
import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  clesDocuseal,
  exporterDevisHistorique,
  type DependancesExport,
  type DevisHistorique,
} from "./export-docuseal-historique";

const DEVIS: DevisHistorique = {
  id: "d1",
  numero: "AXI-DEV-2026-001",
  docusealSubmissionId: "42",
  documentGenereId: "doc1",
  clientNom: "Acme",
  clientEmail: "a@acme.fr",
  acceptedAt: new Date("2026-07-20T10:00:00Z"),
  createdAt: new Date("2026-07-01T10:00:00Z"),
};
const PDF = Buffer.from("pdf-signe");
const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");

function faux(over: Partial<DependancesExport> = {}, devis: DevisHistorique[] = [DEVIS]) {
  const d = {
    listerDevis: vi.fn(async () => devis),
    signatureDocusealExiste: vi.fn(async () => false),
    lireSoumission: vi.fn(async () => ({
      pdfSigneUrl: "https://ds/x.pdf",
      journalAuditUrl: "https://ds/audit.pdf",
      checksumPdf: sha(PDF),
      signeAt: new Date("2026-07-20T10:00:00Z"),
    })),
    telecharger: vi.fn(async (u: string) => (u.includes("audit") ? Buffer.from("journal") : PDF)),
    deposerR2: vi.fn(async () => undefined),
    enregistrerSignature: vi.fn(async () => true),
    ...over,
  } satisfies DependancesExport;
  return d;
}

describe("export du devis historique DocuSeal", () => {
  it("dry-run : rien n'est téléchargé, déposé ni écrit", async () => {
    const d = faux();
    const [r] = await exporterDevisHistorique(d, { apply: false });
    expect(r?.etat).toBe("a_faire");
    expect(d.telecharger).not.toHaveBeenCalled();
    expect(d.deposerR2).not.toHaveBeenCalled();
    expect(d.enregistrerSignature).not.toHaveBeenCalled();
  });

  it("apply : dépose le PDF et le journal sous documents/, écrit la ligne, rapporte l'empreinte", async () => {
    const d = faux();
    const [r] = await exporterDevisHistorique(d, { apply: true });
    const cles = clesDocuseal(DEVIS.numero, 2026);
    expect(cles.pdf.startsWith("documents/2026/")).toBe(true);
    expect(d.deposerR2).toHaveBeenCalledTimes(2);
    expect(d.deposerR2).toHaveBeenCalledWith(
      cles.pdf,
      PDF,
      expect.objectContaining({ sha256: sha(PDF) }),
    );
    expect(d.enregistrerSignature).toHaveBeenCalledOnce();
    expect(r).toMatchObject({ etat: "fait", sha256Pdf: sha(PDF), ligneEcrite: true });
  });

  it("idempotent : une ligne docuseal existante → rien n'est refait", async () => {
    const d = faux({ signatureDocusealExiste: vi.fn(async () => true) });
    const [r] = await exporterDevisHistorique(d, { apply: true });
    expect(r?.etat).toBe("deja_fait");
    expect(d.lireSoumission).not.toHaveBeenCalled();
    expect(d.deposerR2).not.toHaveBeenCalled();
  });

  it("empreinte annoncée différente : arrêt avant tout dépôt", async () => {
    const d = faux({
      lireSoumission: vi.fn(async () => ({
        pdfSigneUrl: "https://ds/x.pdf",
        journalAuditUrl: null,
        checksumPdf: "0".repeat(64),
        signeAt: null,
      })),
    });
    const [r] = await exporterDevisHistorique(d, { apply: true });
    expect(r?.etat).toBe("erreur");
    expect(d.deposerR2).not.toHaveBeenCalled();
  });

  it("devis sans pièce numérotée : fichiers déposés, aucune ligne, signalé", async () => {
    const d = faux({}, [{ ...DEVIS, documentGenereId: null }]);
    const [r] = await exporterDevisHistorique(d, { apply: true });
    expect(r).toMatchObject({ etat: "fait", sansPiece: true, ligneEcrite: false });
    expect(d.enregistrerSignature).not.toHaveBeenCalled();
  });

  it("une erreur sur un devis n'interrompt pas les suivants", async () => {
    const d = faux(
      {
        lireSoumission: vi.fn().mockRejectedValueOnce(new Error("503")).mockResolvedValue({
          pdfSigneUrl: "u",
          journalAuditUrl: null,
          checksumPdf: null,
          signeAt: null,
        }),
      },
      [DEVIS, { ...DEVIS, id: "d2", numero: "AXI-DEV-2026-002" }],
    );
    const r = await exporterDevisHistorique(d, { apply: true });
    expect(r.map((x) => x.etat)).toEqual(["erreur", "fait"]);
  });
});

describe("le script", () => {
  it("n'écrit aucune suppression et ne contient aucune valeur d'accès en dur", async () => {
    const { readFileSync } = await import("node:fs");
    const src =
      readFileSync("scripts/export-docuseal-devis-historique.ts", "utf8") +
      readFileSync("src/server/qualiopi/documents/signature/export-docuseal-historique.ts", "utf8");
    expect(src).not.toMatch(/\.delete(Many)?\(|DeleteObject|DROP\s|TRUNCATE/i);
    expect(src).not.toMatch(/https?:\/\/(?!ds\/)[a-z0-9.-]+\.[a-z]{2,}\/api/i);
  });
});
