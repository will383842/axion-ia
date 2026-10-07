/**
 * Non-régression (lot L1, 2026-10-07) : le panneau « ▶ N vidéos » de la liste
 * lit les vidéos par CETTE route, inchangée. Ce fichier verrouille sa garde :
 * session exigée, même prédicat que la fiche (`peutOuvrirDossierCandidat`),
 * seule une vidéo `disponible` de CE dossier est servie.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const findUniqueMock = vi.fn();

vi.mock("@/auth", () => ({ auth: () => authMock() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    jobApplicationVideo: { findUnique: (...a: unknown[]) => findUniqueMock(...a) },
    activityLog: { create: async () => ({}) },
  },
}));
vi.mock("@/server/careers/videos-candidat", () => ({
  cheminVideo: () => "/inexistant/video.mp4",
}));

import { GET } from "./route";

const params = Promise.resolve({ id: "app-1", videoId: "vid-1" });
const req = () => new Request("http://localhost/x");

beforeEach(() => {
  vi.clearAllMocks();
  findUniqueMock.mockResolvedValue({
    id: "vid-1",
    applicationId: "app-1",
    statut: "disponible",
    mime: "video/mp4",
  });
});

describe("route vidéo d'un candidat — garde inchangée", () => {
  it("sans session : 401", async () => {
    authMock.mockResolvedValue(null);
    expect((await GET(req(), { params })).status).toBe(401);
  });

  it("rôle qui n'ouvre pas le dossier (reader, editor) : 403, sans lire la base", async () => {
    for (const role of ["reader", "editor"]) {
      authMock.mockResolvedValue({ user: { id: "u1", role } });
      expect((await GET(req(), { params })).status, role).toBe(403);
    }
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it("vidéo pas encore passée par l'antivirus, ou d'un autre dossier : 404", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "super_admin" } });
    findUniqueMock.mockResolvedValueOnce({
      id: "vid-1",
      applicationId: "app-1",
      statut: "analyse",
    });
    expect((await GET(req(), { params })).status).toBe(404);
    findUniqueMock.mockResolvedValueOnce({
      id: "vid-1",
      applicationId: "autre",
      statut: "disponible",
    });
    expect((await GET(req(), { params })).status).toBe(404);
  });
});
