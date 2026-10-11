// CAMP-2 — `EmailOutbox.jobId` : la clé d'idempotence d'un envoi suit l'e-mail en
// corbeille, pour qu'une relance garée ne soit jamais garée deux fois.
import { beforeEach, describe, expect, it, vi } from "vitest";

const { create, findFirst } = vi.hoisted(() => ({ create: vi.fn(), findFirst: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { emailOutbox: { create, findFirst }, emailAutomationSetting: { findMany: vi.fn() } },
}));

import { garerPourValidation, jobIdDejaGare } from "../outbox-service";

const BASE = {
  template: "devis-envoi",
  recipient: "a@exemple.invalid",
  locale: "fr" as const,
  payload: {},
  sujet: "Votre devis",
};

beforeEach(() => {
  vi.clearAllMocks();
  create.mockResolvedValue({ id: "o-1" });
});

describe("garerPourValidation écrit la clé", () => {
  it("avec une clé : la ligne la porte", async () => {
    expect(await garerPourValidation({ ...BASE, jobId: "fi-dossier-relance-t1-f5-j3" })).toBe(
      "o-1",
    );
    expect(create.mock.calls[0]![0].data.jobId).toBe("fi-dossier-relance-t1-f5-j3");
  });
  it("sans clé : la ligne est celle d'avant CAMP-2, sans champ jobId", async () => {
    await garerPourValidation(BASE);
    expect(create.mock.calls[0]![0].data).not.toHaveProperty("jobId");
  });
  it("colonne pas encore posée (fenêtre de déploiement) : garé quand même, sans la clé", async () => {
    create.mockRejectedValueOnce(new Error("column job_id does not exist"));
    expect(await garerPourValidation({ ...BASE, jobId: "k" })).toBe("o-1");
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[1]![0].data).not.toHaveProperty("jobId");
  });
  it("base muette : null, comme avant", async () => {
    create.mockRejectedValue(new Error("ECONNREFUSED"));
    expect(await garerPourValidation({ ...BASE, jobId: "k" })).toBeNull();
  });
  it("une clé trop longue est tronquée à 200 caractères", async () => {
    await garerPourValidation({ ...BASE, jobId: "x".repeat(300) });
    expect(create.mock.calls[0]![0].data.jobId).toHaveLength(200);
  });
});

describe("jobIdDejaGare — une relance garée n'est jamais regarée", () => {
  it("vrai dès qu'une ligne porte la clé, quel que soit son statut", async () => {
    findFirst.mockResolvedValueOnce({ id: "o-1" });
    expect(await jobIdDejaGare("k")).toBe(true);
    expect(findFirst).toHaveBeenCalledWith({ where: { jobId: "k" }, select: { id: true } });
  });
  it("faux sans ligne", async () => {
    findFirst.mockResolvedValueOnce(null);
    expect(await jobIdDejaGare("k")).toBe(false);
  });
  it("base muette ou colonne absente : null (on ne sait pas)", async () => {
    findFirst.mockRejectedValueOnce(new Error("column job_id does not exist"));
    expect(await jobIdDejaGare("k")).toBeNull();
  });
});
