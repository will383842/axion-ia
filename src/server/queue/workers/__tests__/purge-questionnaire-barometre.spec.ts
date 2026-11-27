/**
 * Bloc 7 du worker de purge : les réponses du questionnaire du Baromètre 2027 s'effacent 24 mois
 * après la fin de l'enquête. Avant cette limite, AUCUNE requête n'est envoyée.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { deleteMany } = vi.hoisted(() => ({ deleteMany: vi.fn() }));

vi.mock("@/lib/prisma", () => {
  const modele = () => ({
    deleteMany: vi.fn(async () => ({ count: 0 })),
    delete: vi.fn(async () => ({})),
    findMany: vi.fn(async () => []),
    count: vi.fn(async () => 0),
  });
  const cache = new Map<string, unknown>();
  return {
    prisma: new Proxy(
      {},
      {
        get(_c, nom: string) {
          if (nom === "barometreQuestionnaireReponse") return { deleteMany };
          if (!cache.has(nom)) cache.set(nom, modele());
          return cache.get(nom);
        },
      },
    ),
  };
});
const { captureWorkerError } = vi.hoisted(() => ({ captureWorkerError: vi.fn() }));
vi.mock("@/server/newsletter/retention", () => ({ purgerOutboxCrm: vi.fn(async () => 0) }));
vi.mock("@/server/careers/cv-storage", () => ({ deleteCv: vi.fn() }));
vi.mock("@/server/careers/videos-candidat", () => ({ supprimerVideosCandidature: vi.fn() }));
vi.mock("bullmq", () => ({ Worker: class {} }));
vi.mock("../connection", () => ({ getBullConnectionOrThrow: () => ({}) }));
vi.mock("@/server/queue/lib/sentry-worker", () => ({ captureWorkerError }));

import { executerPurgeRetention } from "../retention-purge-worker";
import { limiteEffacement } from "@/lib/barometre-questionnaire/constantes";

describe("purge du questionnaire du Baromètre", () => {
  beforeEach(() => {
    deleteMany.mockReset();
    deleteMany.mockResolvedValue({ count: 3 });
    captureWorkerError.mockClear();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("la limite est la fin de l'enquête + 24 mois", () => {
    expect(limiteEffacement().toISOString()).toBe("2029-01-13T00:00:00.000Z");
  });

  it("avant la limite : aucune requête", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2029-01-12T23:59:59.000Z"));
    await executerPurgeRetention();
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it("aujourd'hui (2026) : aucune requête", async () => {
    await executerPurgeRetention();
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it("après la limite : deleteMany filtré sur la campagne", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2029-01-13T03:00:00.000Z"));
    await executerPurgeRetention();
    expect(deleteMany).toHaveBeenCalledTimes(1);
    expect(deleteMany).toHaveBeenCalledWith({ where: { campagne: "barometre-2027" } });
  });

  it("une panne est signalée sans interrompre la passe", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2029-02-01T03:00:00.000Z"));
    deleteMany.mockRejectedValue(new Error("down"));
    await expect(executerPurgeRetention()).resolves.toBeUndefined();
    expect(captureWorkerError).toHaveBeenCalled();
  });
});
