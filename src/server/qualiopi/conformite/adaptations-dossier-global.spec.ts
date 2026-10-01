/**
 * Indicateur 10 ⭐ dans le dossier global : la vraie preuve d'adaptation,
 * session par session — et AUCUN détail de santé.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { enrollment: { findMany: vi.fn() } },
}));
vi.mock("@/server/qualiopi/adaptation/colonne-declaration", () => ({
  colonneDeclarationDisponible: vi.fn(async () => true),
}));
vi.mock("@/server/qualiopi/adaptation/journal-consignation", () => ({
  lireCircuitAdaptation: vi.fn(async () => new Map()),
}));

import { prisma } from "@/lib/prisma";
import { produireRegistreAdaptations } from "./adaptations-dossier-global";

const mockFindMany = prisma.enrollment.findMany as unknown as ReturnType<typeof vi.fn>;

function inscription(p: {
  id: string;
  session: string;
  nom: string;
  handicap?: boolean;
  reponse?: string | null;
}) {
  return {
    id: p.id,
    traineeId: `t-${p.id}`,
    adaptationsRealisees: p.reponse ?? null,
    besoinAdaptationDeclareAt: null,
    questionnaires: [],
    trainee: {
      nom: p.nom,
      prenom: "Alex",
      deletedAt: null,
      situationHandicap: p.handicap ?? false,
    },
    session: {
      id: p.session,
      numero: `S-${p.session}`,
      titreSession: `Atelier ${p.session}`,
      dateDebut: new Date("2026-09-10T07:00:00Z"),
      dateFin: new Date("2026-09-11T15:00:00Z"),
    },
  };
}

beforeEach(() => vi.clearAllMocks());

describe("produireRegistreAdaptations", () => {
  it("une section par session, le besoin déclaré et la réponse de l'organisme", async () => {
    mockFindMany.mockResolvedValue([
      inscription({
        id: "1",
        session: "A",
        nom: "Martin",
        handicap: true,
        reponse: "Supports en gros caractères",
      }),
      inscription({ id: "2", session: "B", nom: "Bernard", handicap: true }),
    ]);
    const r = await produireRegistreAdaptations();
    const texte = r.lignes.join("\n");
    expect(texte).toContain("Session S-A — Atelier A");
    expect(texte).toContain("Alex Martin — besoin déclaré");
    expect(texte).toContain("« Supports en gros caractères »");
    expect(texte).toContain("Session S-B — Atelier B");
    expect(texte).toContain("Alex Bernard — besoin déclaré — AUCUNE RÉPONSE CONSIGNÉE");
    expect(r.nbAConsigner).toBe(1);
    expect(r.nbSessions).toBe(2);
    // La mention santé est écrite UNE fois, en pied.
    expect(texte.match(/donnée de santé/g)).toHaveLength(1);
  });

  it("🔴 aucun champ de détail (donnée de santé) n'est demandé à la base", async () => {
    mockFindMany.mockResolvedValue([]);
    await produireRegistreAdaptations();
    const args = mockFindMany.mock.calls[0]?.[0] as { select: Record<string, unknown> };
    const select = JSON.stringify(args.select);
    expect(select).not.toMatch(/detail/i);
    expect(select).not.toMatch(/Chiffre/);
  });

  it("sessions annulées ou reportées exclues par le prédicat partagé", async () => {
    mockFindMany.mockResolvedValue([]);
    await produireRegistreAdaptations();
    const args = mockFindMany.mock.calls[0]?.[0] as { where: Record<string, unknown> };
    expect(args.where["session"]).toEqual({ statut: { notIn: ["annulee", "reportee"] } });
  });

  it("aucun besoin nulle part → le fichier le dit", async () => {
    mockFindMany.mockResolvedValue([]);
    const r = await produireRegistreAdaptations();
    expect(r.lignes.join("\n")).toContain(
      "Aucun besoin d'adaptation déclaré ni réponse consignée, sur aucune session tenue.",
    );
  });
});
