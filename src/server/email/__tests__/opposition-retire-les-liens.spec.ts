/**
 * L6 — une opposition enregistrée retire AUTOMATIQUEMENT les liens privés
 * encore ouverts envoyés à cette personne côté réseau d'apporteurs.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const updateMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailOpposition: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "op-1" }),
    },
    lienPartage: { updateMany: (...a: unknown[]) => updateMany(...a) },
  },
}));
vi.mock("@/server/crm-sync", () => ({ syncNewsletterOptOutToCrm: vi.fn() }));
vi.mock("@/features/commercial-application/relances-lead-apporteur", () => ({
  annulerRelancesLeadApporteur: vi.fn(),
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { enregistrerOppositionPourAdresse } from "../opposition";
import { hashEmailForLookup } from "@/lib/security/email-hash";

beforeEach(() => {
  updateMany.mockReset();
  updateMany.mockResolvedValue({ count: 2 });
  delete process.env["DATABASE_URL"];
});

describe("opposition → liens retirés", () => {
  it("retire les liens ouverts des dossiers apporteurs de cette adresse", async () => {
    const r = await enregistrerOppositionPourAdresse("nadine@exemple.fr");
    expect(r.ok).toBe(true);
    expect(updateMany).toHaveBeenCalledTimes(1);
    const arg = updateMany.mock.calls[0]![0] as {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    };
    expect(arg.where).toMatchObject({
      revoqueLe: null,
      submission: { contactEmailHash: hashEmailForLookup("nadine@exemple.fr") },
    });
    expect(arg.data["revoqueLe"]).toBeInstanceOf(Date);
    expect(String(arg.data["motifRetrait"])).toMatch(/opposition/);
  });

  it("un retrait qui échoue ne fait pas échouer l'opposition", async () => {
    updateMany.mockRejectedValueOnce(new Error("base indisponible"));
    const r = await enregistrerOppositionPourAdresse("nadine@exemple.fr");
    expect(r.ok).toBe(true);
  });
});
