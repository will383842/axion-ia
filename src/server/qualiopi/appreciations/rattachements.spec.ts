/**
 * Tests — rattachements.ts : la colonne « Rattachée à » du registre des
 * appréciations se lit en clair, et se charge sans N+1.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainee: { findMany: vi.fn() },
    enrollment: { findMany: vi.fn() },
    client: { findMany: vi.fn() },
    trainer: { findMany: vi.fn() },
    coachingSession: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { resoudreRattachementsAppreciations, type AppreciationARattacher } from "./rattachements";

type Fn = ReturnType<typeof vi.fn>;
const p = prisma as unknown as Record<
  "trainee" | "enrollment" | "client" | "trainer" | "coachingSession",
  { findMany: Fn }
>;

function appreciation(
  id: string,
  champs: Partial<Omit<AppreciationARattacher, "id">> = {},
): AppreciationARattacher {
  return {
    id,
    traineeId: null,
    enrollmentId: null,
    clientId: null,
    trainerId: null,
    coachingSessionId: null,
    ...champs,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  p.trainee.findMany.mockResolvedValue([{ id: "t1", prenom: "Alice", nom: "Martin" }]);
  p.enrollment.findMany.mockResolvedValue([
    {
      id: "e1",
      trainee: { id: "t2", prenom: "Bruno", nom: "Durand" },
      session: { id: "s1", numero: "SES-2026-0042" },
    },
  ]);
  p.client.findMany.mockResolvedValue([{ id: "c1", raisonSociale: "Acme SAS" }]);
  p.trainer.findMany.mockResolvedValue([{ id: "f1", prenom: "Claire", nom: "Petit" }]);
  p.coachingSession.findMany.mockResolvedValue([
    { id: "cs1", dateSeance: new Date("2026-09-15T09:00:00Z") },
  ]);
});

describe("resoudreRattachementsAppreciations", () => {
  it("rend des libellés lisibles, chacun avec l'identifiant de sa fiche", async () => {
    const r = await resoudreRattachementsAppreciations([
      appreciation("a1", { traineeId: "t1", enrollmentId: "e1" }),
      appreciation("a2", { clientId: "c1" }),
      appreciation("a3", { trainerId: "f1", enrollmentId: "e1" }),
      appreciation("a4", { coachingSessionId: "cs1" }),
    ]);

    expect(r.get("a1")).toEqual({
      stagiaire: { id: "t1", libelle: "Alice Martin" },
      session: { id: "s1", libelle: "SES-2026-0042" },
    });
    expect(r.get("a2")).toEqual({ client: { id: "c1", libelle: "Acme SAS" } });
    expect(r.get("a3")?.formateur).toEqual({ id: "f1", libelle: "Claire Petit" });
    expect(r.get("a4")?.seance?.id).toBe("cs1");
    expect(r.get("a4")?.seance?.libelle).toMatch(/^Séance d'accompagnement du /);
  });

  it("à défaut de stagiaire direct, désigne celui de l'inscription", async () => {
    const r = await resoudreRattachementsAppreciations([
      appreciation("a1", { enrollmentId: "e1" }),
    ]);
    expect(r.get("a1")?.stagiaire).toEqual({ id: "t2", libelle: "Bruno Durand" });
  });

  it("une appréciation rattachée à rien porte un objet vide (« auteur non rattaché »)", async () => {
    const r = await resoudreRattachementsAppreciations([appreciation("a1")]);
    expect(r.get("a1")).toEqual({});
    // Rien à résoudre : aucune requête.
    for (const table of Object.values(p)) expect(table.findMany).not.toHaveBeenCalled();
  });

  it("sans N+1 : une seule requête par table, quel que soit le nombre de lignes", async () => {
    const lignes = Array.from({ length: 50 }, (_, i) =>
      appreciation(`a${i}`, {
        traineeId: "t1",
        enrollmentId: "e1",
        clientId: "c1",
        trainerId: "f1",
        coachingSessionId: "cs1",
      }),
    );
    await resoudreRattachementsAppreciations(lignes);
    for (const table of Object.values(p)) expect(table.findMany).toHaveBeenCalledTimes(1);
    // Les identifiants sont dédoublonnés avant la requête groupée.
    expect(p.trainee.findMany.mock.calls[0]?.[0]).toMatchObject({
      where: { id: { in: ["t1"] } },
    });
  });

  it("fail-soft : une table indisponible n'empêche pas les autres libellés", async () => {
    p.client.findMany.mockRejectedValue(new Error("indisponible"));
    const r = await resoudreRattachementsAppreciations([
      appreciation("a1", { traineeId: "t1", clientId: "c1" }),
    ]);
    expect(r.get("a1")).toEqual({ stagiaire: { id: "t1", libelle: "Alice Martin" } });
  });
});
