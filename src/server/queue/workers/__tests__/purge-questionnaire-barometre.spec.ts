/**
 * Bloc 7 du worker de purge : les réponses du questionnaire du Baromètre 2027 s'effacent 24 mois
 * après LEUR jour d'envoi (collecte sans date de fin).
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

  it("la limite est aujourd'hui moins 24 mois (minuit UTC)", () => {
    expect(limiteEffacement(new Date("2028-12-01T15:30:00.000Z")).toISOString()).toBe(
      "2026-12-01T00:00:00.000Z",
    );
  });

  it("chaque réponse a sa propre échéance : filtre sur `jour`, jamais sur une date de fin", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2028-12-01T03:00:00.000Z"));
    await executerPurgeRetention();
    expect(deleteMany).toHaveBeenCalledTimes(1);
    expect(deleteMany).toHaveBeenCalledWith({
      where: { campagne: "barometre-2027", jour: { lte: new Date("2026-12-01T00:00:00.000Z") } },
    });
  });

  it("une réponse envoyée la veille de la limite est visée, celle du lendemain ne l'est pas", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2029-01-13T03:00:00.000Z"));
    await executerPurgeRetention();
    const arg = deleteMany.mock.calls[0]?.[0] as { where: { jour: { lte: Date } } };
    expect(arg.where.jour.lte.toISOString()).toBe("2027-01-13T00:00:00.000Z");
  });

  it("une panne est signalée sans interrompre la passe", async () => {
    deleteMany.mockRejectedValue(new Error("down"));
    await expect(executerPurgeRetention()).resolves.toBeUndefined();
    expect(captureWorkerError).toHaveBeenCalled();
  });
});
