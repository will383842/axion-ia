// CAMP-2 — `enqueueEmail` transmet la clé d'idempotence à la corbeille quand il gare.
import { beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => ({ garer: vi.fn(), mode: vi.fn() }));
vi.mock("@/server/email/outbox-service", () => ({
  resoudreMode: (...a: unknown[]) => d.mode(...a),
  garerPourValidation: (...a: unknown[]) => d.garer(...a),
}));
vi.mock("@/server/email/verdict-envoi", async (orig) => ({
  ...(await orig<typeof import("@/server/email/verdict-envoi")>()),
  verdictAvantEnvoi: vi.fn(async () => ({ retenu: false })),
}));

import { enqueueEmail } from "../queues";

beforeEach(() => {
  vi.clearAllMocks();
  d.mode.mockResolvedValue("validation");
  d.garer.mockResolvedValue("o-1");
});

describe("la clé suit l'envoi en corbeille", () => {
  it("avec un jobId : garé avec la clé", async () => {
    const r = await enqueueEmail(
      "devis-envoi",
      "a@exemple.invalid",
      "fr",
      {},
      {
        jobId: "cle-1",
        sujet: "Votre devis",
      },
    );
    expect(r).toEqual({ enqueued: false, garePourValidation: true, outboxId: "o-1" });
    expect(d.garer).toHaveBeenCalledWith(expect.objectContaining({ jobId: "cle-1" }));
  });
  it("sans jobId : aucune clé", async () => {
    await enqueueEmail("devis-envoi", "a@exemple.invalid", "fr", {}, { sujet: "Votre devis" });
    expect(d.garer.mock.calls[0]![0]).not.toHaveProperty("jobId");
  });
});
