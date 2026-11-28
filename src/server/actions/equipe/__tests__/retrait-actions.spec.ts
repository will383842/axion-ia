/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  garde: vi.fn(),
  effacer: vi.fn(),
  consentement: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/server/equipe-garde", () => ({ exigerAdministrateur: m.garde }));
vi.mock("@/server/equipe/retrait/retrait", () => ({
  effacerDefinitivement: m.effacer,
  retirerUnConsentement: m.consentement,
  remettreLienRetrait: vi.fn(),
}));

import {
  effacerCollaborateurDefinitivement,
  retirerConsentementCollaborateur,
} from "../collaborateurs";

const ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
  m.garde.mockResolvedValue({ userId: "adm", role: "admin" });
  m.effacer.mockResolvedValue({ ok: true });
  m.consentement.mockResolvedValue({ ok: true, slug: "x" });
});

describe("actions de retrait de la console", () => {
  it("l'effacement réel est refusé sans rôle administrateur, avant tout accès", async () => {
    m.garde.mockRejectedValue(new Error("forbidden"));
    const r = await effacerCollaborateurDefinitivement(ID, "EFFACER");
    expect(r.ok).toBe(false);
    expect(m.effacer).not.toHaveBeenCalled();
    const r2 = await retirerConsentementCollaborateur(ID, "photo");
    expect(r2.ok).toBe(false);
    expect(m.consentement).not.toHaveBeenCalled();
  });

  it("identifiant non UUID et consentement inconnu sont refusés", async () => {
    expect((await effacerCollaborateurDefinitivement("1 OR 1=1", "EFFACER")).ok).toBe(false);
    expect((await retirerConsentementCollaborateur(ID, "tout")).ok).toBe(false);
    expect(m.effacer).not.toHaveBeenCalled();
  });

  it("transmet l'acteur administrateur et la confirmation", async () => {
    await effacerCollaborateurDefinitivement(ID, "EFFACER", "2026-11-01");
    expect(m.effacer).toHaveBeenCalledWith({
      memberId: ID,
      confirmation: "EFFACER",
      acteur: "adm",
      demandeLe: "2026-11-01",
    });
  });
});
