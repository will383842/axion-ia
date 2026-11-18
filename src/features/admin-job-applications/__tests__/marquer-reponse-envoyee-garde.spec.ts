// R1 : « Marquer comme envoyée » (candidatures) refuse sans session ou sans droit sur le dossier,
// avant toute lecture ou écriture.
import { describe, it, expect, vi, beforeEach } from "vitest";

const authMock = vi.fn();
const roleOk = vi.fn();
const replyFind = vi.fn();
const aide = vi.fn();

vi.mock("@/auth", () => ({ auth: () => authMock() }));
vi.mock("@/server/auth/habilitations", () => ({
  peutOuvrirDossierCandidat: (r: string) => roleOk(r),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    jobApplication: { findUnique: async () => ({ locale: "fr" }) },
    jobApplicationReply: {
      findUnique: (...a: unknown[]) => replyFind(...a),
    },
  },
}));
vi.mock("@/lib/admin-path", () => ({ adminPath: (_l: string, p: string) => `/admin/${p}` }));
vi.mock("@/server/email/marquer-reponse-envoyee", () => ({
  marquerReponseEnvoyeeALaMain: (...a: unknown[]) => aide(...a),
}));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/features/admin-inbox/cache-tags", () => ({ INBOX_COUNTS_TAG: "t" }));
vi.mock("../envoyer-reponse", () => ({ ecrireEtEnfilerReponse: vi.fn() }));
vi.mock("@/features/job-application/complement", () => ({
  lienComplement: vi.fn(),
  CHEMIN_COMPLEMENT: "/completer-ma-candidature",
}));
vi.mock("@/lib/careers/formateur-freelance", () => ({ estCandidatureFormateurFreelance: vi.fn() }));
vi.mock("@/server/qualiopi/formateurs-independants/etats-entree", () => ({
  lireEtatsEntree: vi.fn(),
}));

import { marquerReponseCandidatureEnvoyeeAction } from "../reply-actions";

beforeEach(() => {
  authMock.mockReset();
  roleOk.mockReset().mockReturnValue(true);
  aide.mockReset().mockResolvedValue({ ok: true });
  replyFind.mockReset().mockResolvedValue({ applicationId: "a1" });
});

describe("marquerReponseCandidatureEnvoyeeAction — garde", () => {
  it("R1 : sans session → refus, aucune lecture ni écriture", async () => {
    authMock.mockResolvedValue(null);
    expect(await marquerReponseCandidatureEnvoyeeAction("r1")).toEqual({
      ok: false,
      error: "unauthorized",
    });
    expect(aide).not.toHaveBeenCalled();
    expect(replyFind).not.toHaveBeenCalled();
  });

  it("R1 : rôle sans droit sur le dossier (reader) → refus, aucune lecture ni écriture", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "reader" } });
    roleOk.mockReturnValue(false);
    expect(await marquerReponseCandidatureEnvoyeeAction("r1")).toEqual({
      ok: false,
      error: "unauthorized",
    });
    expect(roleOk).toHaveBeenCalledWith("reader");
    expect(aide).not.toHaveBeenCalled();
    expect(replyFind).not.toHaveBeenCalled();
  });

  it("droit accordé → l'aide est appelée avec le bon gabarit et l'auteur", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "admin" } });
    expect(await marquerReponseCandidatureEnvoyeeAction("r1")).toEqual({ ok: true });
    expect(aide).toHaveBeenCalledWith({
      gabarit: "candidature-reponse",
      replyId: "r1",
      adminUserId: "u1",
    });
  });
});
