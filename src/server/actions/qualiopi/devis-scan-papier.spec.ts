// @vitest-environment node
/**
 * Lot I3, étape 4 — `verserScanDevisSigneAction`.
 *
 * Ordre à tenir : session → rôle → fichier (type, taille, en-tête) → devis → pré-contrôles →
 * R2 (via `signerDocument`). Tout refus en amont ne touche ni la base de preuves ni R2.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  prisma: {
    devis: { findUnique: vi.fn(), findFirst: vi.fn() },
    documentSignature: { findFirst: vi.fn() },
  },
  requireAdminWrite: vi.fn(),
  log: vi.fn(),
  signer: vi.fn(),
  apres: vi.fn(),
  horodater: vi.fn(),
  peut: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: h.prisma }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("./_guards", () => ({
  requireAdminWrite: h.requireAdminWrite,
  logQualiopiActivity: h.log,
}));
vi.mock("@/server/qualiopi/documents/signature/garde-engagement", () => ({
  peutSignerPourOrganisme: h.peut,
}));
vi.mock("@/server/qualiopi/documents/signature/contexte-requete", () => ({
  contexteRequete: async () => ({ ipHash: "i".repeat(64), userAgentSha256: "u".repeat(64) }),
}));
vi.mock("@/server/qualiopi/documents/signature/document-signature-service", () => ({
  signerDocument: h.signer,
}));
vi.mock("@/server/qualiopi/documents/signature/apres-signature", () => ({
  apresSignature: h.apres,
}));
vi.mock("@/server/qualiopi/documents/signature/horodatage-signature", () => ({
  horodaterSignature: h.horodater,
}));

import { createHash } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import { verserScanDevisSigneAction } from "./devis-scan-papier";
import { circuitPour } from "@/server/qualiopi/documents/signature/parties-requises";

const DEVIS = "11111111-1111-4111-8111-111111111111";
const PIECE = "22222222-2222-4222-8222-222222222222";
const ADMIN = "33333333-3333-4333-8333-333333333333";
const OCTETS = Buffer.from("%PDF-1.7\n contenu du scan \n%%EOF\n");
const SHA = createHash("sha256").update(OCTETS).digest("hex");

function pdf(over: { nom?: string; type?: string; octets?: Buffer } = {}): File {
  return new File([new Uint8Array(over.octets ?? OCTETS)], over.nom ?? "scan.pdf", {
    type: over.type ?? "application/pdf",
  });
}

function formulaire(
  over: {
    fichier?: File | null;
    attestation?: string | null;
    devisId?: string;
    dateEcriteParClient?: string;
  } = {},
) {
  const f = new FormData();
  f.set("devisId", over.devisId ?? DEVIS);
  if (over.dateEcriteParClient !== undefined)
    f.set("dateEcriteParClient", over.dateEcriteParClient);
  if (over.attestation !== null) f.set("attestation", over.attestation ?? "true");
  if (over.fichier !== null) f.set("fichier", over.fichier ?? pdf());
  return f;
}

function devis(over: Record<string, unknown> = {}) {
  return {
    id: DEVIS,
    statut: "envoye",
    offre: null,
    offreSha256: null,
    dateValidite: new Date("2999-01-01T22:59:59Z"),
    sentAt: new Date("2026-11-01T09:00:00Z"),
    documentGenereId: PIECE,
    client: {
      raisonSociale: "Acme SAS",
      contactNom: "Camille Durand",
      contactFonction: "Gérante",
      contactEmail: "camille@acme.test",
    },
    documentGenere: { id: PIECE, numero: "AXI-DOC-2026-001", type: "devis", annuleeAt: null },
    ...over,
  };
}

function attendSansR2OuBase() {
  expect(h.signer).not.toHaveBeenCalled();
  expect(h.apres).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env["DATABASE_URL"] = "postgresql://u:p@db.example:5432/x";
  h.requireAdminWrite.mockResolvedValue({ userId: ADMIN, role: "super_admin" });
  h.peut.mockReturnValue(true);
  h.prisma.devis.findUnique.mockResolvedValue(devis());
  h.prisma.devis.findFirst.mockResolvedValue(null);
  h.prisma.documentSignature.findFirst.mockResolvedValue(null);
  h.signer.mockResolvedValue({
    ok: true,
    signatureId: "sig-1",
    selfHash: "h".repeat(64),
    statutSignature: "partielle",
  });
  h.apres.mockResolvedValue({});
  h.horodater.mockResolvedValue("en_attente");
  h.log.mockResolvedValue(undefined);
});

describe("refus SANS R2 ni lecture de preuves", () => {
  it("non connecté", async () => {
    h.requireAdminWrite.mockRejectedValue(new Error("unauthorized"));
    const r = await verserScanDevisSigneAction(formulaire());
    expect(r.ok).toBe(false);
    attendSansR2OuBase();
    expect(h.prisma.devis.findUnique).not.toHaveBeenCalled();
  });

  it("rôle non habilité", async () => {
    h.peut.mockReturnValue(false);
    const r = await verserScanDevisSigneAction(formulaire());
    expect(r.ok).toBe(false);
    attendSansR2OuBase();
    expect(h.prisma.devis.findUnique).not.toHaveBeenCalled();
  });

  it("mauvais type (.png / image)", async () => {
    const r = await verserScanDevisSigneAction(
      formulaire({ fichier: pdf({ nom: "scan.png", type: "image/png" }) }),
    );
    expect(r.ok).toBe(false);
    attendSansR2OuBase();
    expect(h.prisma.devis.findUnique).not.toHaveBeenCalled();
  });

  it("type déclaré PDF mais en-tête faux", async () => {
    const r = await verserScanDevisSigneAction(
      formulaire({ fichier: pdf({ octets: Buffer.from("PNG pas un pdf %%EOF") }) }),
    );
    expect(r.ok).toBe(false);
    attendSansR2OuBase();
    expect(h.prisma.devis.findUnique).not.toHaveBeenCalled();
  });

  it("trop lourd (10 Mo + 1)", async () => {
    const gros = Buffer.concat([
      Buffer.from("%PDF-1.7\n"),
      Buffer.alloc(10 * 1024 * 1024 - 15, 0x20),
      Buffer.from("\n%%EOF\n"),
    ]);
    expect(gros.byteLength).toBe(10 * 1024 * 1024 + 1);
    const r = await verserScanDevisSigneAction(formulaire({ fichier: pdf({ octets: gros }) }));
    expect(r.ok).toBe(false);
    attendSansR2OuBase();
    expect(h.prisma.devis.findUnique).not.toHaveBeenCalled();
  });

  it("case non cochée", async () => {
    const r = await verserScanDevisSigneAction(formulaire({ attestation: null }));
    expect(r.ok).toBe(false);
    attendSansR2OuBase();
    expect(h.prisma.devis.findUnique).not.toHaveBeenCalled();
  });

  it.each([
    ["brouillon", { statut: "brouillon" }],
    ["accepté", { statut: "accepte" }],
    ["à formules", { offre: { v: 1 }, offreSha256: "a".repeat(64) }],
    ["sans pièce", { documentGenereId: null, documentGenere: null }],
    [
      "pièce annulée",
      { documentGenere: { id: PIECE, numero: "N", type: "devis", annuleeAt: new Date() } },
    ],
  ])("devis %s", async (_nom, over) => {
    h.prisma.devis.findUnique.mockResolvedValue(devis(over));
    const r = await verserScanDevisSigneAction(formulaire());
    expect(r.ok).toBe(false);
    attendSansR2OuBase();
  });

  it("fiche client sans nom de signataire", async () => {
    h.prisma.devis.findUnique.mockResolvedValue(
      devis({
        client: { raisonSociale: " ", contactNom: null, contactFonction: null, contactEmail: null },
      }),
    );
    const r = await verserScanDevisSigneAction(formulaire());
    expect(r.ok).toBe(false);
    attendSansR2OuBase();
  });

  it("déjà signé par le client", async () => {
    h.prisma.documentSignature.findFirst.mockResolvedValueOnce({ id: "sig-0" });
    const r = await verserScanDevisSigneAction(formulaire());
    expect(r).toMatchObject({ ok: false, message: expect.stringContaining("déjà signé") });
    attendSansR2OuBase();
  });

  it("même empreinte de scan déjà versée", async () => {
    h.prisma.documentSignature.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "sig-0" });
    const r = await verserScanDevisSigneAction(formulaire());
    expect(r).toMatchObject({ ok: false, message: expect.stringContaining("déjà été versé") });
    expect(h.prisma.documentSignature.findFirst).toHaveBeenLastCalledWith({
      where: { signatureSha256: SHA, revokedAt: null },
      select: { id: true },
    });
    attendSansR2OuBase();
  });

  it("refus en build (stub)", async () => {
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    const r = await verserScanDevisSigneAction(formulaire());
    expect(r.ok).toBe(false);
    attendSansR2OuBase();
    expect(h.requireAdminWrite).not.toHaveBeenCalled();
  });
});

describe("succès", () => {
  it("appelle signerDocument et apresSignature avec les arguments exacts, sans canal", async () => {
    const r = await verserScanDevisSigneAction(formulaire());
    expect(r).toEqual({ ok: true, signatureId: "sig-1", statutSignature: "partielle" });

    expect(h.signer).toHaveBeenCalledTimes(1);
    expect(h.signer).toHaveBeenCalledWith({
      documentGenereId: PIECE,
      porteur: {
        type: "reversement_papier",
        adminId: ADMIN,
        provider: "physical_signed",
        partie: "client",
        signataire: { nom: "Camille Durand", email: "camille@acme.test", qualite: "Gérante" },
      },
      methode: "papier_scanne",
      partiesRequises: circuitPour("devis")!.parties,
      scanPdf: { octets: expect.any(Buffer) },
      ipHash: "i".repeat(64),
      userAgentSha256: "u".repeat(64),
    });
    const octetsPasses = (h.signer.mock.calls[0]![0] as { scanPdf: { octets: Buffer } }).scanPdf
      .octets;
    expect(Buffer.compare(octetsPasses, OCTETS)).toBe(0);

    expect(h.apres).toHaveBeenCalledTimes(1);
    const apres = h.apres.mock.calls[0]![0] as Record<string, unknown>;
    expect(apres).toEqual({
      documentGenereId: PIECE,
      type: "devis",
      numero: "AXI-DOC-2026-001",
      statutSignature: "partielle",
      partie: "client",
      acteur: { type: "administrateur", session: { userId: ADMIN, role: "super_admin" } },
      sansCopiePartielle: true,
    });
    expect(apres).not.toHaveProperty("canal");

    await Promise.resolve();
    await Promise.resolve();
    expect(h.horodater).toHaveBeenCalledWith("sig-1");
  });

  it("journalise sans aucun nom", async () => {
    await verserScanDevisSigneAction(formulaire());
    const verse = h.log.mock.calls.find(
      (c) => (c[0] as { action: string }).action === "qualiopi.devis.scan_papier_verse",
    )![0] as { changes: Record<string, unknown> };
    expect(verse.changes).toEqual({
      documentGenereId: PIECE,
      signatureId: "sig-1",
      scanSha256: SHA,
      tailleOctets: OCTETS.byteLength,
      statutSignature: "partielle",
      dateEcriteParClient: null,
      statutDevisAuVersement: "envoye",
      dateValidite: "2999-01-01T22:59:59.000Z",
      validiteDepassee: false,
      dateEcriteApresValidite: false,
      dateEcriteAvantEnvoi: false,
    });
    const texte = JSON.stringify(h.log.mock.calls);
    expect(texte).not.toContain("Camille");
    expect(texte).not.toContain("Acme");
    expect(texte).not.toContain("camille@");
  });

  it("refus du service : journal « refuse » avec le seul motif, rien d'autre", async () => {
    h.signer.mockResolvedValue({ ok: false, raison: "piece_annulee", message: "annulée" });
    const r = await verserScanDevisSigneAction(formulaire());
    expect(r).toEqual({ ok: false, message: "annulée" });
    expect(h.apres).not.toHaveBeenCalled();
    const refuse = h.log.mock.calls.find(
      (c) => (c[0] as { action: string }).action === "qualiopi.devis.scan_papier_refuse",
    )![0] as { changes: Record<string, unknown> };
    expect(refuse.changes).toEqual({ motif: "piece_annulee" });
  });

  it("deux appels parallèles : une seule réussite", async () => {
    h.signer
      .mockResolvedValueOnce({
        ok: true,
        signatureId: "sig-1",
        selfHash: "h".repeat(64),
        statutSignature: "partielle",
      })
      .mockResolvedValueOnce({ ok: false, raison: "deja_signe", message: "déjà signé" });
    const [a, b] = await Promise.all([
      verserScanDevisSigneAction(formulaire()),
      verserScanDevisSigneAction(formulaire()),
    ]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    expect(h.apres).toHaveBeenCalledTimes(1);
  });
});

describe("F2 — devis expiré et date écrite par le client", () => {
  const journalVerse = () =>
    h.log.mock.calls.find(
      (c) => (c[0] as { action: string }).action === "qualiopi.devis.scan_papier_verse",
    )![0] as { changes: Record<string, unknown> };

  it("accepte_devis_expire", async () => {
    h.prisma.devis.findUnique.mockResolvedValue(
      devis({ statut: "expire", dateValidite: new Date("2026-11-10T22:59:59Z") }),
    );
    const r = await verserScanDevisSigneAction(formulaire());
    expect(r).toMatchObject({ ok: true, signatureId: "sig-1" });
    expect(h.signer).toHaveBeenCalledTimes(1);
    expect(journalVerse().changes).toMatchObject({
      statutDevisAuVersement: "expire",
      validiteDepassee: true,
    });
  });

  it("refuse_expire_successeur_emis_avant_R2", async () => {
    h.prisma.devis.findUnique.mockResolvedValue(devis({ statut: "expire" }));
    h.prisma.devis.findFirst.mockResolvedValue({ id: "suivant" });
    const r = await verserScanDevisSigneAction(formulaire());
    expect(r).toEqual({
      ok: false,
      message:
        "Une version plus récente de ce devis a été envoyée : ce scan ne peut pas être versé sur la version remplacée.",
    });
    expect(h.prisma.devis.findFirst).toHaveBeenCalledWith({
      where: { replacesDevisId: DEVIS, statut: { not: "brouillon" } },
      select: { id: true },
    });
    attendSansR2OuBase();
    expect(h.prisma.documentSignature.findFirst).not.toHaveBeenCalled();
    const refuse = h.log.mock.calls.find(
      (c) => (c[0] as { action: string }).action === "qualiopi.devis.scan_papier_refuse",
    )![0] as { changes: Record<string, unknown> };
    expect(refuse.changes).toEqual({ motif: "successeur_emis" });
  });

  it("refuse_date_ecrite_future", async () => {
    const r = await verserScanDevisSigneAction(formulaire({ dateEcriteParClient: "2999-01-01" }));
    expect(r).toEqual({
      ok: false,
      message:
        "La date écrite par le client ne peut pas être postérieure à aujourd'hui : vérifiez la saisie.",
    });
    attendSansR2OuBase();
    const refuse = h.log.mock.calls.find(
      (c) => (c[0] as { action: string }).action === "qualiopi.devis.scan_papier_refuse",
    )![0] as { changes: Record<string, unknown> };
    expect(refuse.changes).toEqual({ motif: "date_ecrite_future" });
  });

  it("refuse une date impossible (2026-02-30)", async () => {
    const r = await verserScanDevisSigneAction(formulaire({ dateEcriteParClient: "2026-02-30" }));
    expect(r.ok).toBe(false);
    attendSansR2OuBase();
  });

  it("accepte_sans_date_ecrite (absente ou chaîne vide)", async () => {
    const a = await verserScanDevisSigneAction(formulaire());
    const b = await verserScanDevisSigneAction(formulaire({ dateEcriteParClient: "" }));
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(journalVerse().changes).toMatchObject({ dateEcriteParClient: null });
  });

  it("journal_porte_date_ecrite_et_drapeaux", async () => {
    h.prisma.devis.findUnique.mockResolvedValue(
      devis({
        statut: "expire",
        dateValidite: new Date("2026-11-10T22:59:59Z"),
        sentAt: new Date("2026-11-05T09:00:00Z"),
      }),
    );
    await verserScanDevisSigneAction(formulaire({ dateEcriteParClient: "2026-11-12" }));
    expect(journalVerse().changes).toMatchObject({
      dateEcriteParClient: "2026-11-12",
      statutDevisAuVersement: "expire",
      dateValidite: "2026-11-10T22:59:59.000Z",
      validiteDepassee: true,
      dateEcriteApresValidite: true,
      dateEcriteAvantEnvoi: false,
    });
    h.log.mockClear();
    await verserScanDevisSigneAction(formulaire({ dateEcriteParClient: "2026-11-01" }));
    expect(journalVerse().changes).toMatchObject({
      dateEcriteParClient: "2026-11-01",
      dateEcriteApresValidite: false,
      dateEcriteAvantEnvoi: true,
    });
  });

  it("signeAt_jamais_remplace_par_date_ecrite", async () => {
    await verserScanDevisSigneAction(formulaire({ dateEcriteParClient: "2026-11-12" }));
    const appel = h.signer.mock.calls[0]![0] as Record<string, unknown>;
    expect(JSON.stringify(appel)).not.toContain("2026-11-12");
    expect(appel).not.toHaveProperty("signeAt");
    expect(appel).not.toHaveProperty("dateRecueil");
  });
});

describe("F1 / F2 — après le scellement", () => {
  it("F1 : le journal de réussite qui échoue ne change pas le succès (Sentry, pas de relance)", async () => {
    h.log.mockRejectedValue(new Error("journal HS"));
    const r = await verserScanDevisSigneAction(formulaire());
    expect(r).toMatchObject({ ok: true, signatureId: "sig-1" });
    expect(Sentry.captureException).toHaveBeenCalled();
  });

  it("F2 : un refus d'activation est renvoyé à l'écran", async () => {
    h.apres.mockResolvedValue({
      activationRefusee: { prefixe: "Activation refusée :", message: "motif X" },
    });
    const r = await verserScanDevisSigneAction(formulaire());
    expect(r).toMatchObject({ ok: true, activationRefusee: expect.stringContaining("motif X") });
  });

  it("D3 : refus d'activation sans prefixe : texte propre au devis, jamais « formateur »", async () => {
    h.apres.mockResolvedValue({ activationRefusee: { message: "motif X" } });
    const r = await verserScanDevisSigneAction(formulaire());
    expect(r).toMatchObject({
      ok: true,
      activationRefusee: expect.stringContaining(
        "Devis enregistré comme signé, mais la suite n'a pas pu être lancée automatiquement.",
      ),
    });
    expect((r as { activationRefusee: string }).activationRefusee).not.toMatch(/formateur/i);
  });

  it("F2 : sans refus, pas de champ activationRefusee", async () => {
    const r = await verserScanDevisSigneAction(formulaire());
    expect(r).not.toHaveProperty("activationRefusee");
  });
});
