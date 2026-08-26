/**
 * Les quatre gestes du dossier société, exercés pour de vrai.
 *
 * 🔴 POURQUOI CE FICHIER EXISTE. Un typecheck vert prouve que le code compile,
 * pas qu'il fait ce qu'il annonce. Trois comportements de ce module ne se
 * déduisent d'aucune signature, et chacun est une manière de perdre une pièce
 * administrative :
 *
 *   1. le REMPLACEMENT n'efface l'ancien fichier qu'APRÈS avoir écrit le
 *      nouveau et mis la base à jour — l'inverse détruirait le seul exemplaire
 *      d'une attestation si l'écriture échouait ;
 *   2. un remplacement aux dates VIDES ne doit pas écraser les dates
 *      existantes par `null` — sinon renouveler un Kbis lui ferait perdre sa
 *      péremption ;
 *   3. changer le TYPE d'une pièce doit rafraîchir les DEUX rubriques, sinon
 *      l'ancienne continue d'afficher ce qu'elle ne contient plus.
 *
 * Le contrôle des rôles est vérifié en premier : une action d'écriture qui
 * accepterait un visiteur anonyme n'aurait aucune des trois garanties ci-dessus
 * à défendre.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockAuth = vi.fn();
vi.mock("@/auth", () => ({ auth: () => mockAuth() }));

const mockRevalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (p: string) => mockRevalidatePath(p) }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    societeDocument: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    activityLog: { create: vi.fn() },
  },
}));

/** Journal d'appels du stockage — l'ORDRE est ce qu'on vérifie. */
const appels: string[] = [];
vi.mock("@/server/console-documents/storage", async (importOriginal) => {
  const reel = await importOriginal<typeof import("@/server/console-documents/storage")>();
  return {
    ...reel,
    storeConsoleDoc: vi.fn(async (_buf: Buffer, nom: string) => {
      appels.push(`store:${nom}`);
      return { storagePath: `/vol/${nom}`, hashSha256: "h".repeat(64) };
    }),
    deleteConsoleDocFile: vi.fn(async (p: string | null | undefined) => {
      appels.push(`delete:${p}`);
    }),
  };
});

import { prisma } from "@/lib/prisma";
import {
  importerSocieteDocAction,
  modifierSocieteDocAction,
  remplacerFichierSocieteDocAction,
  supprimerSocieteDocAction,
} from "./documents.actions";

const db = prisma as unknown as {
  societeDocument: Record<string, ReturnType<typeof vi.fn>>;
  activityLog: { create: ReturnType<typeof vi.fn> };
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function connecte(role: string): void {
  mockAuth.mockResolvedValue({ user: { id: "admin-1", role } });
}

/**
 * Un `File` réellement lisible.
 *
 * 🔴 Le `File` de l'environnement de test n'expose pas `arrayBuffer()`, alors
 * que celui du runtime Next l'expose — et c'est par là que l'action lit le
 * contenu. Sans ce complément, les tests échoueraient sur un manque du HARNAIS
 * en accusant le code : exactement le « mock incomplet est un contrat rompu »
 * que ce dépôt a déjà payé. On complète la pièce manquante plutôt que de
 * réécrire l'action pour contourner son propre environnement.
 */
function fichier(nom = "kbis.pdf", octets = new Uint8Array([1, 2, 3])): File {
  const f = new File([octets], nom, { type: "application/pdf" });
  if (typeof f.arrayBuffer !== "function") {
    Object.defineProperty(f, "arrayBuffer", {
      value: async () => octets.buffer.slice(0),
      configurable: true,
    });
  }
  return f;
}

function formulaire(champs: Record<string, string | File>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(champs)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  appels.length = 0;
  connecte("admin");
  db.societeDocument["findFirst"]!.mockResolvedValue(null);
  db.societeDocument["create"]!.mockResolvedValue({ id: "doc-1" });
  db.societeDocument["update"]!.mockResolvedValue({});
  db.societeDocument["delete"]!.mockResolvedValue({});
  db.activityLog.create.mockResolvedValue({});
});

// ── Contrôle d'accès ─────────────────────────────────────────────────────────

describe("contrôle d'accès", () => {
  it("refuse un visiteur non authentifié sur les quatre gestes", async () => {
    mockAuth.mockResolvedValue(null);
    const fd = formulaire({ id: crypto.randomUUID(), type: "kbis", titre: "x", file: fichier() });
    for (const action of [
      importerSocieteDocAction,
      modifierSocieteDocAction,
      remplacerFichierSocieteDocAction,
      supprimerSocieteDocAction,
    ]) {
      const res = await action(fd);
      expect(res).toEqual({ ok: false, error: "Non authentifié." });
    }
    expect(db.societeDocument["create"]).not.toHaveBeenCalled();
    expect(appels).toEqual([]);
  });

  it("un rôle « editor » peut importer mais PAS supprimer", async () => {
    connecte("editor");
    const importe = await importerSocieteDocAction(
      formulaire({ type: "kbis", titre: "Kbis", file: fichier() }),
    );
    expect(importe).toEqual({ ok: true });

    const supprime = await supprimerSocieteDocAction(formulaire({ id: crypto.randomUUID() }));
    expect(supprime).toEqual({ ok: false, error: "Droits insuffisants." });
    expect(db.societeDocument["delete"]).not.toHaveBeenCalled();
  });
});

// ── Import ───────────────────────────────────────────────────────────────────

describe("importer", () => {
  it("enregistre la pièce, ses dates, et journalise l'action", async () => {
    const res = await importerSocieteDocAction(
      formulaire({
        type: "kbis",
        titre: "Extrait Kbis au 30 juillet 2026",
        numeroPiece: "2026B01964",
        dateEmission: "2026-07-30",
        dateExpiration: "2026-10-30",
        file: fichier(),
      }),
    );
    expect(res).toEqual({ ok: true });

    const data = db.societeDocument["create"]!.mock.calls[0]?.[0]?.data;
    expect(data.type).toBe("kbis");
    expect(data.titre).toBe("Extrait Kbis au 30 juillet 2026");
    expect(data.numeroPiece).toBe("2026B01964");
    expect(data.dateEmission?.toISOString()).toBe("2026-07-30T00:00:00.000Z");
    expect(data.dateExpiration?.toISOString()).toBe("2026-10-30T00:00:00.000Z");
    expect(data.hashSha256).toHaveLength(64);

    expect(db.activityLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "societe.document.importe" }),
      }),
    );
  });

  it("refuse un type de fichier non autorisé SANS rien écrire", async () => {
    const exe = new File([new Uint8Array([1])], "charge.exe", {
      type: "application/x-msdownload",
    });
    const res = await importerSocieteDocAction(formulaire({ type: "kbis", titre: "x", file: exe }));
    expect(res.ok).toBe(false);
    expect(appels).toEqual([]);
    expect(db.societeDocument["create"]).not.toHaveBeenCalled();
  });

  it("refuse un type de pièce absent de la SSOT", async () => {
    const res = await importerSocieteDocAction(
      formulaire({ type: "type_invente", titre: "x", file: fichier() }),
    );
    expect(res.ok).toBe(false);
    expect(db.societeDocument["create"]).not.toHaveBeenCalled();
  });

  it("laisse les dates à null quand elles ne sont pas fournies", async () => {
    await importerSocieteDocAction(
      formulaire({ type: "statuts", titre: "Statuts", file: fichier() }),
    );
    const data = db.societeDocument["create"]!.mock.calls[0]?.[0]?.data;
    expect(data.dateEmission).toBeNull();
    expect(data.dateExpiration).toBeNull();
  });
});

// ── Modification ─────────────────────────────────────────────────────────────

describe("modifier", () => {
  it("ne touche PAS au fichier — seules les métadonnées changent", async () => {
    db.societeDocument["findUnique"]!.mockResolvedValue({ type: "kbis" });
    const res = await modifierSocieteDocAction(
      formulaire({
        id: crypto.randomUUID(),
        type: "kbis",
        titre: "Kbis corrigé",
        dateExpiration: "2026-11-30",
      }),
    );
    expect(res).toEqual({ ok: true });
    expect(appels).toEqual([]); // ni écriture ni suppression de fichier

    const data = db.societeDocument["update"]!.mock.calls[0]?.[0]?.data;
    expect(data.titre).toBe("Kbis corrigé");
    expect(data).not.toHaveProperty("storagePath");
    expect(data).not.toHaveProperty("hashSha256");
  });

  it("changer de rubrique rafraîchit les DEUX, pas seulement la nouvelle", async () => {
    // `kbis` vit dans « Pièces légales », `note_securite` dans « RGPD & sécurité ».
    db.societeDocument["findUnique"]!.mockResolvedValue({ type: "kbis" });
    await modifierSocieteDocAction(
      formulaire({ id: crypto.randomUUID(), type: "note_securite", titre: "Note" }),
    );
    const chemins = mockRevalidatePath.mock.calls.map((c) => c[0] as string);
    expect(chemins.some((p) => p.endsWith("/societe/pieces-legales"))).toBe(true);
    expect(chemins.some((p) => p.endsWith("/societe/rgpd-securite"))).toBe(true);
  });

  it("refuse un identifiant qui n'existe pas", async () => {
    db.societeDocument["findUnique"]!.mockResolvedValue(null);
    const res = await modifierSocieteDocAction(
      formulaire({ id: crypto.randomUUID(), type: "kbis", titre: "x" }),
    );
    expect(res).toEqual({ ok: false, error: "Pièce introuvable." });
    expect(db.societeDocument["update"]).not.toHaveBeenCalled();
  });
});

// ── Remplacement ─────────────────────────────────────────────────────────────

describe("remplacer le fichier", () => {
  beforeEach(() => {
    db.societeDocument["findUnique"]!.mockResolvedValue({
      storagePath: "/vol/ancien.pdf",
      type: "kbis",
      hashSha256: "a".repeat(64),
    });
  });

  it("écrit le nouveau fichier AVANT d'effacer l'ancien", async () => {
    const res = await remplacerFichierSocieteDocAction(
      formulaire({ id: crypto.randomUUID(), file: fichier("kbis-octobre.pdf") }),
    );
    expect(res).toEqual({ ok: true });
    // 🔴 L'ordre EST le test : effacer d'abord détruirait le seul exemplaire
    // d'une attestation si la mise à jour échouait ensuite.
    expect(appels).toEqual(["store:kbis-octobre.pdf", "delete:/vol/ancien.pdf"]);
  });

  it("des dates vides ne remettent PAS les dates existantes à null", async () => {
    await remplacerFichierSocieteDocAction(
      formulaire({
        id: crypto.randomUUID(),
        file: fichier(),
        dateEmission: "",
        dateExpiration: "",
      }),
    );
    const data = db.societeDocument["update"]!.mock.calls[0]?.[0]?.data;
    expect(data).not.toHaveProperty("dateEmission");
    expect(data).not.toHaveProperty("dateExpiration");
    expect(data.storagePath).toBeDefined();
  });

  it("des dates fournies suivent le nouveau fichier — le cas du renouvellement", async () => {
    await remplacerFichierSocieteDocAction(
      formulaire({
        id: crypto.randomUUID(),
        file: fichier(),
        dateEmission: "2026-10-31",
        dateExpiration: "2027-01-31",
      }),
    );
    const data = db.societeDocument["update"]!.mock.calls[0]?.[0]?.data;
    expect(data.dateEmission?.toISOString()).toBe("2026-10-31T00:00:00.000Z");
    expect(data.dateExpiration?.toISOString()).toBe("2027-01-31T00:00:00.000Z");
  });

  it("n'efface RIEN si le fichier fourni est refusé", async () => {
    const exe = new File([new Uint8Array([1])], "x.exe", { type: "application/x-msdownload" });
    const res = await remplacerFichierSocieteDocAction(
      formulaire({ id: crypto.randomUUID(), file: exe }),
    );
    expect(res.ok).toBe(false);
    expect(appels).toEqual([]);
    expect(db.societeDocument["update"]).not.toHaveBeenCalled();
  });
});

// ── Suppression ──────────────────────────────────────────────────────────────

describe("supprimer", () => {
  it("retire la ligne, le fichier, et laisse une trace au journal", async () => {
    db.societeDocument["findUnique"]!.mockResolvedValue({
      storagePath: "/vol/kbis.pdf",
      type: "kbis",
      titre: "Kbis",
    });
    const res = await supprimerSocieteDocAction(formulaire({ id: crypto.randomUUID() }));
    expect(res).toEqual({ ok: true });
    expect(appels).toEqual(["delete:/vol/kbis.pdf"]);
    expect(db.activityLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "societe.document.supprime" }),
      }),
    );
  });
});
