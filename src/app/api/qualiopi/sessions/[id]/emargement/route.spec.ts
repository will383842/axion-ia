/**
 * Garde — l'écran « Télécharger la feuille à jour » rend le MÊME tirage que les
 * dossiers d'audit.
 *
 * 🔴 X-documents-pdf-01 (audit initial 2026-09-14, relecture de la PR 1089). Le
 * tirage à jour était construit ici ET dans le dossier de session, avec deux
 * populations d'inscriptions différentes, et aucun des deux PDF ne disait qu'il
 * était une réimpression. La route passe désormais par
 * `rendreTirageEmargementAJour`, seul chemin de rendu. Ce qui vaut pour le PDF
 * lui-même — mention datée, pièce d'origine, feuille ANNULÉE jamais empruntée —
 * est gardé dans `documents/emargement-tirage.spec.ts`.
 *
 * Ici : ce que la ROUTE en fait — statut, nom de fichier.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: () => authMock() }));

const rendreMock = vi.fn();
vi.mock("@/server/qualiopi/documents/emargement-tirage", () => ({
  rendreTirageEmargementAJour: (...a: unknown[]) => rendreMock(...a),
}));

import { GET } from "./route";

const SESSION = "44444444-4444-4444-8444-444444444444";

function requete(): Request {
  return new Request(`https://test.local/api/qualiopi/sessions/${SESSION}/emargement`);
}

function tirage(numeroOrigine: string | null) {
  return {
    ok: true as const,
    buffer: Buffer.from("%PDF-a-jour"),
    numeroOrigine,
    numeroSession: "AXI-SESS-2026-003",
    totalSignatures: 4,
    mention: "Réimpression à jour du …",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({ user: { id: "admin-1", role: "super_admin" } });
  rendreMock.mockResolvedValue(tirage("AXI-DOC-2026-011"));
});

describe("🔴 GET emargement — un seul tirage à jour, celui des dossiers d'audit", () => {
  it("rend le tirage partagé, pour CETTE session", async () => {
    const res = await GET(requete() as never, { params: Promise.resolve({ id: SESSION }) });

    expect(rendreMock).toHaveBeenCalledTimes(1);
    expect(rendreMock.mock.calls[0]![0]).toBe(SESSION);
    expect(res.status).toBe(200);
    expect(Buffer.from(await res.arrayBuffer()).toString()).toBe("%PDF-a-jour");
  });

  it("nomme le fichier d'après la pièce d'origine, suffixé -a-jour", async () => {
    const res = await GET(requete() as never, { params: Promise.resolve({ id: SESSION }) });
    expect(res.headers.get("Content-Disposition")).toContain("AXI-DOC-2026-011-a-jour.pdf");
  });

  it("sans feuille au registre, le nom de fichier dit encore qu'il s'agit d'un tirage à jour", async () => {
    rendreMock.mockResolvedValue(tirage(null));
    const res = await GET(requete() as never, { params: Promise.resolve({ id: SESSION }) });
    expect(res.headers.get("Content-Disposition")).toContain(`emargement-${SESSION}-a-jour.pdf`);
  });

  it("session introuvable → 404 ; journées non déclarées → 409", async () => {
    rendreMock.mockResolvedValue({ ok: false, message: "Session introuvable" });
    const a = await GET(requete() as never, { params: Promise.resolve({ id: SESSION }) });
    expect(a.status).toBe(404);

    rendreMock.mockResolvedValue({ ok: false, message: "Les journées de cette session …" });
    const b = await GET(requete() as never, { params: Promise.resolve({ id: SESSION }) });
    expect(b.status).toBe(409);
  });
});
