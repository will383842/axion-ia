// V1-A-3 — la file « à vérifier » de la console : les réponses venues d'une adresse relais
// (candidature sans empreinte), tant que la candidature n'a pas été traitée à la main.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const findManyReponses = vi.fn();
const findUniqueDossier = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    jobApplication: { findUnique: (...a: unknown[]) => findUniqueDossier(...a) },
    jobApplicationInboundReply: { findMany: (...a: unknown[]) => findManyReponses(...a) },
  },
}));
vi.mock("@/lib/pii-crypto", () => ({
  decryptPii: (v: string) => v.replace(/^enc:/, ""),
  PII_DECRYPT_PLACEHOLDER: "[encrypted — key missing]",
}));

import { lireReponsesAVerifier, lireReponsesRecuesCandidat } from "../reponses-recues";

const M = new Date("2026-10-30T10:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("lireReponsesAVerifier", () => {
  it("ne lit que les réponses humaines d'une candidature sans empreinte, encore nouvelle", async () => {
    findManyReponses.mockResolvedValue([
      { applicationId: "c1", receivedAt: new Date("2026-10-29T10:00:00Z"), subject: "Re: x" },
    ]);
    const l = await lireReponsesAVerifier({ role: "super_admin" }, M);
    expect(l).toEqual([
      { applicationId: "c1", recueLe: new Date("2026-10-29T10:00:00Z"), objet: "Re: x" },
    ]);
    const where = (findManyReponses.mock.calls[0]![0] as { where: Record<string, unknown> }).where;
    expect(where).toMatchObject({
      auto: false,
      application: { emailHash: null, status: "new", reponsesFormateur: { none: {} } },
    });
  });

  it("rend une liste vide à un rôle qui n'ouvre pas les dossiers, sans lire la base", async () => {
    expect(await lireReponsesAVerifier({ role: null }, M)).toEqual([]);
    expect(findManyReponses).not.toHaveBeenCalled();
  });
});

describe("lireReponsesRecuesCandidat — le marqueur « à vérifier »", () => {
  const ligne = (auto: boolean) => ({
    id: "r1",
    receivedAt: M,
    subject: "Re: x",
    excerpt: null,
    auto,
    zohoMessageId: "z1",
  });

  it("candidature sans empreinte : la réponse humaine est « à vérifier », l'automatique non", async () => {
    findUniqueDossier.mockResolvedValue({ emailHash: null });
    findManyReponses.mockResolvedValue([ligne(false), ligne(true)]);
    const l = await lireReponsesRecuesCandidat("c1", { role: "super_admin" });
    expect(l.map((r) => r.aVerifier)).toEqual([true, false]);
  });

  it("candidature avec empreinte : jamais « à vérifier »", async () => {
    findUniqueDossier.mockResolvedValue({ emailHash: "h" });
    findManyReponses.mockResolvedValue([ligne(false)]);
    const l = await lireReponsesRecuesCandidat("c1", { role: "super_admin" });
    expect(l[0]!.aVerifier).toBe(false);
  });
});
