import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

// Documents joints aux e-mails de l'apporteur : on ne joint QUE ce qui existe sur R2.
// Un document absent, ou un stockage en panne, ne fait jamais échouer l'envoi.

const h = vi.hoisted(() => ({
  entete: vi.fn(),
  configure: true,
  signaler: vi.fn(),
  televerser: vi.fn(),
  copie: vi.fn(),
}));

vi.mock("@/lib/r2-storage", () => ({
  enteteObjetR2: (...a: unknown[]) => h.entete(...a),
  isR2Configured: () => h.configure,
  uploadToR2: (...a: unknown[]) => h.televerser(...a),
}));
vi.mock("../guide-demarrage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../guide-demarrage")>()),
  lireGuideDemarrage: () => h.copie(),
}));
vi.mock("../signaler", () => ({ signalerErreurReseau: (...a: unknown[]) => h.signaler(...a) }));

import {
  DELAI_ENTETE_MS,
  DOCUMENTS_ANNEXES,
  NOM_CONTRAT_SIGNE,
  PREFIXE_DOCUMENTS_APPORTEURS,
  TAILLE_MAX_PIECES_OCTETS,
  bilanDesPieces,
  documentsAnnexesAJoindre,
  pieceContratDeLAccuse,
  piecesDuContratSigne,
} from "../documents-joints";

const CLE_CONTRAT = "apporteurs/6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b/contrat-v2-signe-abcd.pdf";
const [FICHE, LIVRET, GUIDE] = DOCUMENTS_ANNEXES;
/** Une annexe est FACULTATIVE pour le worker : absente à l'envoi, elle n'arrête pas l'e-mail. */
const ANNEXE = { contentType: "application/pdf", facultative: true } as const;

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
  h.televerser.mockResolvedValue({});
  h.copie.mockResolvedValue(Buffer.from("%PDF-guide"));
  avertissements = vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("déclaration des documents annexes", () => {
  it("fiche des commissions, livret et guide de démarrage, chacun à une clé fixe sous le préfixe commun", () => {
    expect(DOCUMENTS_ANNEXES.map((d) => d.id)).toEqual([
      "fiche-commissions",
      "livret",
      "guide-demarrage",
    ]);
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
  it("toutes existent : toutes sont jointes, avec le nom montré au destinataire", async () => {
    r2({ [FICHE.cleR2]: 1000, [LIVRET.cleR2]: 2000, [GUIDE.cleR2]: 3000 });
    expect(await documentsAnnexesAJoindre()).toEqual([
      { ...ANNEXE, filename: FICHE.nomFichier, r2Key: FICHE.cleR2 },
      { ...ANNEXE, filename: LIVRET.nomFichier, r2Key: LIVRET.cleR2 },
      { ...ANNEXE, filename: GUIDE.nomFichier, r2Key: GUIDE.cleR2 },
    ]);
    expect(h.televerser).not.toHaveBeenCalled();
  });

  it("🔴 document absent de R2 : non joint, sans erreur, et journalisé", async () => {
    r2({ [FICHE.cleR2]: 1000, [GUIDE.cleR2]: 3000 });
    const pieces = await documentsAnnexesAJoindre();
    expect(pieces.map((p) => p.r2Key)).toEqual([FICHE.cleR2, GUIDE.cleR2]);
    expect(avertissements).toHaveBeenCalledTimes(1);
    expect(String(avertissements.mock.calls[0]?.[0])).toContain("livret");
  });

  it("aucun document déposé (état d'aujourd'hui) : seul le guide est joint, déposé par l'application", async () => {
    r2({});
    expect((await documentsAnnexesAJoindre()).map((p) => p.r2Key)).toEqual([GUIDE.cleR2]);
  });

  it("R2 en panne : rien n'est joint, rien n'est levé, la panne est signalée", async () => {
    h.entete.mockRejectedValue(new Error("réseau"));
    expect(await documentsAnnexesAJoindre()).toEqual([]);
    expect(h.signaler).toHaveBeenCalled();
  });

  it("R2 ne répond pas : après le délai, rien n'est joint et rien n'est levé", async () => {
    vi.useFakeTimers();
    try {
      h.entete.mockImplementation(() => new Promise(() => undefined));
      const attendu = documentsAnnexesAJoindre();
      await vi.advanceTimersByTimeAsync(DELAI_ENTETE_MS * DOCUMENTS_ANNEXES.length + 1);
      expect(await attendu).toEqual([]);
      expect(h.signaler).toHaveBeenCalledTimes(DOCUMENTS_ANNEXES.length);
    } finally {
      vi.useRealTimers();
    }
  });

  it("R2 non configuré : rien n'est joint, R2 n'est pas interrogé", async () => {
    h.configure = false;
    expect(await documentsAnnexesAJoindre()).toEqual([]);
    expect(h.entete).not.toHaveBeenCalled();
  });

  it("objet vide : non joint", async () => {
    r2({ [FICHE.cleR2]: 0, [LIVRET.cleR2]: 2000, [GUIDE.cleR2]: 0 });
    expect((await documentsAnnexesAJoindre()).map((p) => p.r2Key)).toEqual([LIVRET.cleR2]);
  });

  it("document qui ferait dépasser le plafond : non joint, les autres le restent", async () => {
    r2({ [FICHE.cleR2]: 1000, [LIVRET.cleR2]: TAILLE_MAX_PIECES_OCTETS, [GUIDE.cleR2]: 3000 });
    expect((await documentsAnnexesAJoindre()).map((p) => p.r2Key)).toEqual([
      FICHE.cleR2,
      GUIDE.cleR2,
    ]);
  });
});

// Le guide de démarrage part tout seul avec le contrat : s'il manque sur R2 (404 vrai), l'application
// y dépose sa copie embarquée. Jamais sur une panne, jamais par-dessus un objet existant.
describe("🔴 le guide de démarrage : dépôt automatique sur R2", () => {
  const sansGuide = { [FICHE.cleR2]: 1000, [LIVRET.cleR2]: 2000 };

  it("absent de R2 : la copie embarquée y est déposée une fois, puis jointe (facultative)", async () => {
    r2(sansGuide);
    const pieces = await documentsAnnexesAJoindre();
    expect(h.televerser).toHaveBeenCalledTimes(1);
    expect(h.televerser).toHaveBeenCalledWith(
      GUIDE.cleR2,
      Buffer.from("%PDF-guide"),
      "application/pdf",
      expect.objectContaining({ sha256: expect.stringMatching(/^[0-9a-f]{64}$/) }),
    );
    expect(pieces.at(-1)).toEqual({ ...ANNEXE, filename: GUIDE.nomFichier, r2Key: GUIDE.cleR2 });
  });

  it("présent sur R2 (dépôt manuel) : jamais écrasé", async () => {
    r2({ ...sansGuide, [GUIDE.cleR2]: 3000 });
    await documentsAnnexesAJoindre();
    expect(h.televerser).not.toHaveBeenCalled();
  });

  it("R2 en panne ou sans réponse : aucun dépôt, guide non joint", async () => {
    h.entete.mockRejectedValue(new Error("réseau"));
    expect(await documentsAnnexesAJoindre()).toEqual([]);
    expect(h.televerser).not.toHaveBeenCalled();
  });

  it("R2 non configuré : aucun dépôt", async () => {
    h.configure = false;
    expect(await documentsAnnexesAJoindre()).toEqual([]);
    expect(h.televerser).not.toHaveBeenCalled();
  });

  it("dépôt en échec : guide non joint, signalé, rien n'est levé", async () => {
    r2(sansGuide);
    h.televerser.mockRejectedValue(new Error("refusé"));
    const pieces = await documentsAnnexesAJoindre();
    expect(pieces.map((p) => p.r2Key)).toEqual([FICHE.cleR2, LIVRET.cleR2]);
    expect(h.signaler).toHaveBeenCalled();
  });

  it("copie embarquée illisible : guide non joint, aucun dépôt", async () => {
    r2(sansGuide);
    h.copie.mockResolvedValue(null);
    const pieces = await documentsAnnexesAJoindre();
    expect(pieces.map((p) => p.r2Key)).toEqual([FICHE.cleR2, LIVRET.cleR2]);
    expect(h.televerser).not.toHaveBeenCalled();
  });

  it("la fiche et le livret absents ne sont JAMAIS déposés par l'application", async () => {
    r2({});
    await documentsAnnexesAJoindre();
    expect(h.televerser.mock.calls.map((c) => c[0])).toEqual([GUIDE.cleR2]);
  });
});

describe("pièces de l'e-mail « contrat signé »", () => {
  it("contrat + fiche + livret + guide quand tout existe, le contrat en premier", async () => {
    r2({ [CLE_CONTRAT]: 50_000, [FICHE.cleR2]: 1000, [LIVRET.cleR2]: 2000, [GUIDE.cleR2]: 3000 });
    expect(await piecesDuContratSigne(CLE_CONTRAT)).toEqual([
      { filename: NOM_CONTRAT_SIGNE, r2Key: CLE_CONTRAT, contentType: "application/pdf" },
      { ...ANNEXE, filename: FICHE.nomFichier, r2Key: FICHE.cleR2 },
      { ...ANNEXE, filename: LIVRET.nomFichier, r2Key: LIVRET.cleR2 },
      { ...ANNEXE, filename: GUIDE.nomFichier, r2Key: GUIDE.cleR2 },
    ]);
  });

  it("fiche et livret absents : le contrat et le guide (déposé par l'application)", async () => {
    r2({ [CLE_CONTRAT]: 50_000 });
    expect((await piecesDuContratSigne(CLE_CONTRAT)).map((p) => p.r2Key)).toEqual([
      CLE_CONTRAT,
      GUIDE.cleR2,
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
      [GUIDE.cleR2]: 3000,
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

// Relecture de la PR #2255 (I2) : seule la pièce que l'e-mail PROMET est exigée par le worker.
describe("pièces exigées et pièces facultatives", () => {
  it("🔴 « contrat signé » : le contrat est exigé, chaque annexe est facultative", async () => {
    r2({ [CLE_CONTRAT]: 50_000, [FICHE.cleR2]: 1000, [LIVRET.cleR2]: 2000, [GUIDE.cleR2]: 3000 });
    const [contrat, ...annexes] = await piecesDuContratSigne(CLE_CONTRAT);
    expect(contrat).not.toHaveProperty("facultative");
    expect(annexes).toHaveLength(3);
    for (const a of annexes) expect(a.facultative).toBe(true);
  });

  it("🔴 accusé : son texte ne promet aucune pièce, le contrat joint y est facultatif", async () => {
    r2({ [CLE_CONTRAT]: 50_000 });
    expect((await pieceContratDeLAccuse(CLE_CONTRAT))[0]?.facultative).toBe(true);
  });
});

// Relecture de la PR #2255 (I3) : la console dit quelles pièces ont été mises dans l'e-mail.
describe("bilan des pièces, dit à la console", () => {
  const contrat = {
    filename: NOM_CONTRAT_SIGNE,
    r2Key: CLE_CONTRAT,
    contentType: "application/pdf",
  };
  const fiche = { ...ANNEXE, filename: FICHE.nomFichier, r2Key: FICHE.cleR2 };
  const livret = { ...ANNEXE, filename: LIVRET.nomFichier, r2Key: LIVRET.cleR2 };
  const guide = { ...ANNEXE, filename: GUIDE.nomFichier, r2Key: GUIDE.cleR2 };

  it("tout est joint", () => {
    expect(bilanDesPieces([contrat, fiche, livret, guide])).toBe(
      "Pièces jointes : le contrat, la fiche des commissions, le livret et le guide de démarrage.",
    );
  });

  it("une annexe manque : elle est nommée", () => {
    expect(bilanDesPieces([contrat, fiche, guide])).toBe(
      "Pièces jointes : le contrat, la fiche des commissions et le guide de démarrage. Non joint (absent ou illisible sur le stockage) : le livret.",
    );
  });

  it("aucune annexe : le contrat seul, les trois annexes nommées", () => {
    expect(bilanDesPieces([contrat])).toBe(
      "Pièce jointe : le contrat seul. Non joints (absents ou illisibles sur le stockage) : la fiche des commissions, le livret et le guide de démarrage.",
    );
  });
});

// Relecture de la PR #2255 (I4) : les annexes ne sortent du stockage que par l'e-mail.
describe("🔴 les clés des annexes ne sont servies par aucune route", () => {
  const racine = process.cwd();
  function fichiers(dossier: string): string[] {
    return readdirSync(join(racine, dossier), { recursive: true, encoding: "utf-8" })
      .filter((f) => /\.(ts|tsx)$/.test(f) && !/(__tests__|\.spec\.)/.test(f))
      .map((f) => join(dossier, f).replace(/\\/g, "/"));
  }

  it("seuls la déclaration et la contresignature lisent le préfixe ou la liste des annexes", () => {
    const lecteurs = fichiers("src").filter((f) =>
      /documents-apporteurs\/|PREFIXE_DOCUMENTS_APPORTEURS|DOCUMENTS_ANNEXES|documents-joints/.test(
        readFileSync(join(racine, f), "utf-8"),
      ),
    );
    expect(lecteurs.sort()).toEqual([
      "src/features/apporteurs-reseau/documents-joints.ts",
      "src/features/apporteurs-reseau/signature.ts",
      "src/features/apporteurs-reseau/verification.ts",
    ]);
  });

  it("aucun code ne lit `R2_PUBLIC_BASE_URL` : le dépôt ne fabrique aucune adresse publique d'objet", () => {
    const lecteurs = [...fichiers("src"), ...fichiers("scripts")].filter((f) =>
      readFileSync(join(racine, f), "utf-8")
        .split("\n")
        .some((l) => l.includes("R2_PUBLIC_BASE_URL") && !l.trimStart().startsWith("//")),
    );
    expect(lecteurs).toEqual([]);
  });
});
