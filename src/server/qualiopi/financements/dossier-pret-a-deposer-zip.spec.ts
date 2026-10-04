/**
 * Chantier OPCO A6 — le ZIP « prêt à déposer » contient le kit et SEULEMENT
 * les pièces présentes ; les manquantes sont nommées dans LISEZMOI.txt.
 */

import { describe, it, expect, vi } from "vitest";
import JSZip from "jszip";

vi.mock("@/lib/r2-storage", () => ({
  documentPdfKey: (d: { type: string; numero: string; createdAt: Date }) =>
    `documents/${d.createdAt.getFullYear()}/${d.type}/${d.numero}.pdf`,
  getObjectBufferR2: vi.fn(),
}));

import { construireZipPretADeposer } from "./dossier-pret-a-deposer-zip";
import { encartDepot, etatPiecesDemande } from "./dossier-pret-a-deposer";
import type { DossierPretADeposer } from "./dossier-pret-a-deposer-lecture";

const D = (iso: string) => new Date(`${iso}T10:00:00.000Z`);

const DOSSIER: DossierPretADeposer = {
  numeroSession: "AXI-SESS-2026-001",
  intituleFormation: "IA appliquée",
  raisonSociale: "Invest Sun",
  pieces: etatPiecesDemande([
    {
      id: "c",
      type: "convention",
      numero: "AXI-DOC-1",
      createdAt: D("2026-09-01"),
      annuleeAt: null,
      statutSignature: "signee",
      exemplaireSigneKey: "documents/2026/convention/AXI-DOC-1-signe.pdf",
    },
    {
      id: "p",
      type: "programme",
      numero: "AXI-DOC-2",
      createdAt: D("2026-09-01"),
      annuleeAt: null,
      statutSignature: "non_requise",
      exemplaireSigneKey: null,
    },
  ]),
  encart: encartDepot({
    opco: "akto",
    dateDebut: D("2026-11-20"),
    regime: "inconnu",
    etatFonds: null,
  }),
};

const KIT = { type: "kit_opco" as const, numero: "AXI-DOC-9", createdAt: D("2026-10-04") };

async function ouvrir(base64: string): Promise<JSZip> {
  return JSZip.loadAsync(base64, { base64: true });
}

describe("construireZipPretADeposer", () => {
  it("contient le kit + seulement les pièces présentes, nommées selon la convention", async () => {
    const lire = vi.fn(async (cle: string) => Buffer.from(`pdf:${cle}`));
    const r = await construireZipPretADeposer({ kit: KIT, dossier: DOSSIER }, lire);
    const zip = await ouvrir(r.base64);
    const noms = Object.keys(zip.files).sort();
    expect(noms).toHaveLength(4);
    expect(noms.some((n) => n.startsWith("Kit") && n.includes("AXI-DOC-9"))).toBe(true);
    expect(noms).toContain("Convention de formation signee - Invest Sun - AXI-DOC-1.pdf");
    expect(noms.some((n) => n.includes("AXI-DOC-2.pdf"))).toBe(true);
    expect(noms).toContain("LISEZMOI.txt");
    // Seules les pièces présentes sont lues au stockage : kit + 2.
    expect(lire).toHaveBeenCalledTimes(3);
    expect(r.joints).toEqual(["AXI-DOC-9", "AXI-DOC-1", "AXI-DOC-2"]);
    expect(r.manquantes).toEqual(["Devis", "Calendrier et organisation de l'action"]);
    expect(r.filename).toBe("Dossier OPCO a deposer - Invest Sun - AXI-SESS-2026-001.zip");

    const lisezmoi = await zip.file("LISEZMOI.txt")!.async("string");
    expect(lisezmoi).toContain("[MANQUANTE] Devis — non émise");
    expect(lisezmoi).toContain("Comment déposer chez Akto");
    expect(lisezmoi).toContain("Portail entreprise : non renseigné");
  });

  it("pièce présente au registre mais absente du stockage → non jointe, déclarée manquante", async () => {
    const lire = vi.fn(async (cle: string) =>
      cle.includes("programme") ? null : Buffer.from("x"),
    );
    const r = await construireZipPretADeposer({ kit: KIT, dossier: DOSSIER }, lire);
    expect(r.joints).toEqual(["AXI-DOC-9", "AXI-DOC-1"]);
    expect(r.manquantes).toContain("Programme de la formation");
  });

  it("convention signée → le lecteur reçoit la clé de l'exemplaire SIGNÉ, jamais la vierge", async () => {
    const lire = vi.fn(async (cle: string) => Buffer.from(`pdf:${cle}`));
    await construireZipPretADeposer({ kit: KIT, dossier: DOSSIER }, lire);
    const cles = lire.mock.calls.map(([c]) => c);
    expect(cles).toContain("documents/2026/convention/AXI-DOC-1-signe.pdf");
    expect(cles).not.toContain("documents/2026/convention/AXI-DOC-1.pdf");
  });

  it("exemplaire signé introuvable au stockage → convention manquante, la vierge n'est pas jointe", async () => {
    const lire = vi.fn(async (cle: string) =>
      cle.endsWith("-signe.pdf") ? null : Buffer.from("x"),
    );
    const r = await construireZipPretADeposer({ kit: KIT, dossier: DOSSIER }, lire);
    expect(r.joints).toEqual(["AXI-DOC-9", "AXI-DOC-2"]);
    expect(r.manquantes).toContain("Convention de formation signée");
    const zip = await ouvrir(r.base64);
    expect(Object.keys(zip.files).some((n) => n.includes("AXI-DOC-1"))).toBe(false);
    const lisezmoi = await zip.file("LISEZMOI.txt")!.async("string");
    expect(lisezmoi).toContain("exemplaire signé introuvable");
    expect(lire.mock.calls.map(([c]) => c)).not.toContain(
      "documents/2026/convention/AXI-DOC-1.pdf",
    );
  });

  it("exemplaireSigneKey null → convention manquante, aucune lecture de la vierge", async () => {
    const pieces = etatPiecesDemande([
      {
        id: "c",
        type: "convention",
        numero: "AXI-DOC-1",
        createdAt: D("2026-09-01"),
        annuleeAt: null,
        statutSignature: "signee",
        exemplaireSigneKey: null,
      },
    ]);
    const lire = vi.fn(async (cle: string) => Buffer.from(cle));
    const r = await construireZipPretADeposer({ kit: KIT, dossier: { ...DOSSIER, pieces } }, lire);
    expect(r.manquantes).toContain("Convention de formation signée");
    expect(lire).toHaveBeenCalledTimes(1); // le kit seul
  });

  it("kit introuvable au stockage → erreur, pas de ZIP sans kit", async () => {
    await expect(
      construireZipPretADeposer({ kit: KIT, dossier: DOSSIER }, async () => null),
    ).rejects.toThrow(/kit/i);
  });
});
