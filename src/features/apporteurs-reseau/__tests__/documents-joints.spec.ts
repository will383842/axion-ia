import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

// Documents joints aux e-mails de l'apporteur : on ne joint QUE ce qui existe sur R2.
// Un document absent, ou un stockage en panne, ne fait jamais échouer l'envoi.

const h = vi.hoisted(() => ({
  entete: vi.fn(),
  configure: true,
  signaler: vi.fn(),
}));

vi.mock("@/lib/r2-storage", () => ({
  enteteObjetR2: (...a: unknown[]) => h.entete(...a),
  isR2Configured: () => h.configure,
}));
vi.mock("../signaler", () => ({ signalerErreurReseau: (...a: unknown[]) => h.signaler(...a) }));

import {
  DOCUMENTS_ANNEXES,
  NOM_CONTRAT_SIGNE,
  PREFIXE_DOCUMENTS_APPORTEURS,
  TAILLE_MAX_PIECES_OCTETS,
  documentsAnnexesAJoindre,
  pieceContratDeLAccuse,
  piecesDuContratSigne,
} from "../documents-joints";

const CLE_CONTRAT = "apporteurs/6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b/contrat-v2-signe-abcd.pdf";
const [FICHE, LIVRET] = DOCUMENTS_ANNEXES;

/** Simule R2 : `tailles` donne la taille de chaque objet présent ; absent = `null`. */
function r2(tailles: Record<string, number>) {
  h.entete.mockImplementation(async (cle: string) =>
    cle in tailles ? { taille: tailles[cle], etag: "e" } : null,
  );
}

let avertissements: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  h.configure = true;
  avertissements = vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("déclaration des documents annexes", () => {
  it("fiche des commissions et livret, chacun à une clé fixe sous le préfixe commun", () => {
    expect(DOCUMENTS_ANNEXES.map((d) => d.id)).toEqual(["fiche-commissions", "livret"]);
    for (const d of DOCUMENTS_ANNEXES) {
      expect(d.cleR2.startsWith(PREFIXE_DOCUMENTS_APPORTEURS)).toBe(true);
      expect(d.cleR2.endsWith(".pdf")).toBe(true);
      expect(d.nomFichier).toMatch(/^[A-Za-z0-9-]+\.pdf$/);
    }
    expect(new Set(DOCUMENTS_ANNEXES.map((d) => d.cleR2)).size).toBe(DOCUMENTS_ANNEXES.length);
  });

  it("le plafond ne dépasse pas celui que le worker d'e-mails accepte", () => {
    const worker = readFileSync(
      join(process.cwd(), "src/server/queue/workers/email-worker.ts"),
      "utf-8",
    );
    const lu = /export const TAILLE_MAX_PJ_OCTETS = (\d+) \* ([\d_]+);/.exec(worker);
    expect(lu).not.toBeNull();
    const plafondWorker = Number(lu![1]) * Number(lu![2]!.replace(/_/g, ""));
    expect(TAILLE_MAX_PIECES_OCTETS).toBeLessThanOrEqual(plafondWorker);
  });
});

describe("documents annexes à joindre", () => {
  it("les deux existent : les deux sont joints, avec le nom montré au destinataire", async () => {
    r2({ [FICHE.cleR2]: 1000, [LIVRET.cleR2]: 2000 });
    expect(await documentsAnnexesAJoindre()).toEqual([
      { filename: FICHE.nomFichier, r2Key: FICHE.cleR2, contentType: "application/pdf" },
      { filename: LIVRET.nomFichier, r2Key: LIVRET.cleR2, contentType: "application/pdf" },
    ]);
  });

  it("🔴 document absent de R2 : non joint, sans erreur, et journalisé", async () => {
    r2({ [FICHE.cleR2]: 1000 });
    const pieces = await documentsAnnexesAJoindre();
    expect(pieces.map((p) => p.r2Key)).toEqual([FICHE.cleR2]);
    expect(avertissements).toHaveBeenCalledTimes(1);
    expect(String(avertissements.mock.calls[0]?.[0])).toContain("livret");
  });

  it("aucun document déposé (état d'aujourd'hui) : rien n'est joint", async () => {
    r2({});
    expect(await documentsAnnexesAJoindre()).toEqual([]);
  });

  it("R2 en panne : rien n'est joint, rien n'est levé, la panne est signalée", async () => {
    h.entete.mockRejectedValue(new Error("réseau"));
    expect(await documentsAnnexesAJoindre()).toEqual([]);
    expect(h.signaler).toHaveBeenCalled();
  });

  it("R2 non configuré : rien n'est joint, R2 n'est pas interrogé", async () => {
    h.configure = false;
    expect(await documentsAnnexesAJoindre()).toEqual([]);
    expect(h.entete).not.toHaveBeenCalled();
  });

  it("objet vide : non joint", async () => {
    r2({ [FICHE.cleR2]: 0, [LIVRET.cleR2]: 2000 });
    expect((await documentsAnnexesAJoindre()).map((p) => p.r2Key)).toEqual([LIVRET.cleR2]);
  });

  it("document qui ferait dépasser le plafond : non joint, les autres le restent", async () => {
    r2({ [FICHE.cleR2]: 1000, [LIVRET.cleR2]: TAILLE_MAX_PIECES_OCTETS });
    expect((await documentsAnnexesAJoindre()).map((p) => p.r2Key)).toEqual([FICHE.cleR2]);
  });
});

describe("pièces de l'e-mail « contrat signé »", () => {
  it("contrat + fiche + livret quand tout existe, le contrat en premier", async () => {
    r2({ [CLE_CONTRAT]: 50_000, [FICHE.cleR2]: 1000, [LIVRET.cleR2]: 2000 });
    expect(await piecesDuContratSigne(CLE_CONTRAT)).toEqual([
      { filename: NOM_CONTRAT_SIGNE, r2Key: CLE_CONTRAT, contentType: "application/pdf" },
      { filename: FICHE.nomFichier, r2Key: FICHE.cleR2, contentType: "application/pdf" },
      { filename: LIVRET.nomFichier, r2Key: LIVRET.cleR2, contentType: "application/pdf" },
    ]);
  });

  it("annexes absentes : le contrat seul, comme avant", async () => {
    r2({ [CLE_CONTRAT]: 50_000 });
    expect(await piecesDuContratSigne(CLE_CONTRAT)).toEqual([
      { filename: NOM_CONTRAT_SIGNE, r2Key: CLE_CONTRAT, contentType: "application/pdf" },
    ]);
  });

  it("🔴 R2 en panne : le contrat reste TOUJOURS dans la liste (le worker réessaiera)", async () => {
    h.entete.mockRejectedValue(new Error("réseau"));
    expect((await piecesDuContratSigne(CLE_CONTRAT)).map((p) => p.r2Key)).toEqual([CLE_CONTRAT]);
  });

  it("le poids du contrat compte dans le plafond des annexes", async () => {
    r2({
      [CLE_CONTRAT]: TAILLE_MAX_PIECES_OCTETS - 1500,
      [FICHE.cleR2]: 1000,
      [LIVRET.cleR2]: 2000,
    });
    expect((await piecesDuContratSigne(CLE_CONTRAT)).map((p) => p.r2Key)).toEqual([
      CLE_CONTRAT,
      FICHE.cleR2,
    ]);
  });
});

describe("pièce de l'accusé de signature", () => {
  it("le PDF signé par l'apporteur existe : il est joint", async () => {
    r2({ [CLE_CONTRAT]: 50_000 });
    const pieces = await pieceContratDeLAccuse(CLE_CONTRAT);
    expect(pieces).toHaveLength(1);
    expect(pieces[0]).toMatchObject({ r2Key: CLE_CONTRAT, contentType: "application/pdf" });
  });

  it("R2 en panne ou objet absent : aucune pièce, aucune erreur", async () => {
    r2({});
    expect(await pieceContratDeLAccuse(CLE_CONTRAT)).toEqual([]);
    h.entete.mockRejectedValue(new Error("réseau"));
    expect(await pieceContratDeLAccuse(CLE_CONTRAT)).toEqual([]);
  });

  it("🔴 aucun journal ne porte la clé du contrat (elle contient l'identifiant du dossier)", async () => {
    r2({});
    await pieceContratDeLAccuse(CLE_CONTRAT);
    h.entete.mockRejectedValue(new Error("réseau"));
    await pieceContratDeLAccuse(CLE_CONTRAT);
    await piecesDuContratSigne(CLE_CONTRAT);
    const ecrit = JSON.stringify([
      avertissements.mock.calls,
      h.signaler.mock.calls.map((c) => c[0]),
    ]);
    expect(ecrit).not.toContain("6f1c2a3b");
  });
});
