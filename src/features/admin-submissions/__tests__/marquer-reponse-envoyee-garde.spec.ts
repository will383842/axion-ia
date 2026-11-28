// R1 : « Marquer comme envoyée » (messages) refuse sans session ou sans droit d'écriture,
// avant toute lecture ou écriture.
import { describe, it, expect, vi, beforeEach } from "vitest";

const authMock = vi.fn();
const aide = vi.fn();
const find = vi.fn();

vi.mock("@/auth", () => ({ auth: () => authMock() }));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: vi.fn() }));
vi.mock("@/lib/email/templates", () => ({ renderEmailTemplate: vi.fn() }));
vi.mock("@/server/email/marquer-reponse-envoyee", () => ({
  marquerReponseEnvoyeeALaMain: (...a: unknown[]) => aide(...a),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { submissionReply: { findUnique: (...a: unknown[]) => find(...a) } },
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock("@/features/commercial-application/relances-lead-apporteur", () => ({
  annulerRelancesLeadApporteur: vi.fn(),
}));

import { marquerReponseEnvoyeeAction } from "../reply-actions";

beforeEach(() => {
  authMock.mockReset();
  aide.mockReset().mockResolvedValue({ ok: true });
  find.mockReset().mockResolvedValue({ submissionId: "s1" });
});

describe("marquerReponseEnvoyeeAction — garde", () => {
  it("R1 : sans session → refus, aucune lecture ni écriture", async () => {
    authMock.mockResolvedValue(null);
    expect(await marquerReponseEnvoyeeAction("r1")).toEqual({ ok: false, error: "unauthorized" });
    expect(aide).not.toHaveBeenCalled();
    expect(find).not.toHaveBeenCalled();
  });

  it("R1 : rôle reader → refus, aucune lecture ni écriture", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "reader" } });
    expect(await marquerReponseEnvoyeeAction("r1")).toEqual({ ok: false, error: "unauthorized" });
    expect(aide).not.toHaveBeenCalled();
    expect(find).not.toHaveBeenCalled();
  });

  it("identifiant invalide → refus avant l'aide", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "admin" } });
    expect(await marquerReponseEnvoyeeAction("")).toEqual({ ok: false, error: "invalid_id" });
    expect(aide).not.toHaveBeenCalled();
  });

  it("rôle admin → l'aide est appelée avec le bon gabarit et l'auteur", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "admin" } });
    expect(await marquerReponseEnvoyeeAction("r1")).toEqual({ ok: true });
    expect(aide).toHaveBeenCalledWith({
      gabarit: "submission-reply",
      replyId: "r1",
      adminUserId: "u1",
    });
  });

  it("refus de l'aide relayé tel quel", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "editor" } });
    aide.mockResolvedValue({ ok: false, error: "etat_change" });
    expect(await marquerReponseEnvoyeeAction("r1")).toEqual({ ok: false, error: "etat_change" });
  });
});
