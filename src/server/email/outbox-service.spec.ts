// Corbeille de validation — le repli quand la base est muette (lot 2, 2026-09-02).
//
// Avant : une lecture des règles qui échouait rendait « auto », et un devis, une
// convention ou une facture partaient sans relecture — précisément quand
// Postgres était indisponible. Désormais : la politique PAR DÉFAUT du gabarit.

import { describe, it, expect, vi, beforeEach } from "vitest";

const findMany = vi.fn();
const create = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailAutomationSetting: { findMany: (...a: unknown[]) => findMany(...a) },
    emailOutbox: { create: (...a: unknown[]) => create(...a) },
  },
}));

import { resoudreMode, garerPourValidation } from "./outbox-service";

beforeEach(() => {
  findMany.mockReset();
  create.mockReset();
});

describe("resoudreMode — base muette", () => {
  it("🔴 un devis reste « validation » quand les règles sont illisibles", async () => {
    findMany.mockRejectedValue(new Error("ECONNREFUSED"));
    expect(await resoudreMode("devis-envoi")).toBe("validation");
    expect(await resoudreMode("facture-envoi")).toBe("validation");
    expect(await resoudreMode("convention-envoi")).toBe("validation");
  });

  it("la chaîne Qualiopi part seule même base muette", async () => {
    findMany.mockRejectedValue(new Error("ECONNREFUSED"));
    expect(await resoudreMode("qualiopi-convocation")).toBe("auto");
  });

  it("les règles lues priment sur le défaut", async () => {
    findMany.mockResolvedValue([{ scope: "global", template: "devis-envoi", mode: "auto" }]);
    expect(await resoudreMode("devis-envoi")).toBe("auto");
  });
});

describe("garerPourValidation — base muette", () => {
  it("rend null sans lever : c'est l'appelant qui décide de NE PAS envoyer", async () => {
    create.mockRejectedValue(new Error("ECONNREFUSED"));
    const id = await garerPourValidation({
      template: "devis-envoi",
      recipient: "a@b.fr",
      locale: "fr",
      payload: {},
      sujet: "Votre devis",
    });
    expect(id).toBeNull();
  });
});
