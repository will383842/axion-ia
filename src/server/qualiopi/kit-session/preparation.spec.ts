/**
 * Tests — preparation.ts.
 *
 * L'enjeu : l'état ne doit JAMAIS pouvoir dire « prêt » à tort. Une case à
 * cocher se coche par optimisme ; ici l'état se déduit, et ces tests vérifient
 * qu'il se déduit dans le bon sens — en particulier qu'une sortie générée mais
 * non relue n'est PAS un kit prêt.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainingSession: { findUnique: vi.fn(), findMany: vi.fn() },
    supportFormation: { count: vi.fn() },
    sessionKitSorties: { findUnique: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { lirePreparation, listerSessionsAPreparer } from "./preparation";

const p = prisma as unknown as {
  trainingSession: { findUnique: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
  supportFormation: { count: ReturnType<typeof vi.fn> };
};

const SESSION = "11111111-1111-1111-1111-111111111111";

function session(kitSorties: unknown) {
  return {
    id: SESSION,
    formationId: "f-1",
    formation: { slug: "ia-pour-les-rh" },
    kitSorties,
  };
}

const UNE_SORTIE = [{ moduleId: "mod-1", moduleTitre: "M1", prompt: "p", sortie: "une réponse" }];

beforeEach(() => vi.clearAllMocks());

describe("lirePreparation — l'état se déduit", () => {
  it("« kit_absent » quand la formation n'a pas de classeur publié", async () => {
    p.trainingSession.findUnique.mockResolvedValue(session(null));
    p.supportFormation.count.mockResolvedValue(0);

    const prep = await lirePreparation(SESSION);

    expect(prep?.etape).toBe("kit_absent");
    expect(prep?.kitPublie).toBe(false);
  });

  it("« a_generer » quand le classeur existe mais qu'aucune sortie n'est produite", async () => {
    p.trainingSession.findUnique.mockResolvedValue(session(null));
    p.supportFormation.count.mockResolvedValue(1);

    expect((await lirePreparation(SESSION))?.etape).toBe("a_generer");
  });

  it("🔴 « a_valider » — une sortie générée que PERSONNE n'a relue n'est pas prête", async () => {
    p.trainingSession.findUnique.mockResolvedValue(
      session({ sorties: UNE_SORTIE, genereLe: new Date(), valideLe: null }),
    );
    p.supportFormation.count.mockResolvedValue(1);

    const prep = await lirePreparation(SESSION);

    expect(prep?.etape).toBe("a_valider");
    expect(prep?.etape).not.toBe("pret");
  });

  it("« pret » seulement après relecture humaine", async () => {
    p.trainingSession.findUnique.mockResolvedValue(
      session({ sorties: UNE_SORTIE, genereLe: new Date(), valideLe: new Date() }),
    );
    p.supportFormation.count.mockResolvedValue(1);

    expect((await lirePreparation(SESSION))?.etape).toBe("pret");
  });

  it("ignore une sortie vide : validée ou non, elle ne compte pas", async () => {
    p.trainingSession.findUnique.mockResolvedValue(
      session({ sorties: [{ moduleId: "mod-1", sortie: "   " }], genereLe: null, valideLe: null }),
    );
    p.supportFormation.count.mockResolvedValue(1);

    const prep = await lirePreparation(SESSION);
    expect(prep?.nbSorties).toBe(0);
    expect(prep?.etape).toBe("a_generer");
  });

  it("ne compte que les classeurs porteurs d'une clé R2", async () => {
    p.trainingSession.findUnique.mockResolvedValue(session(null));
    p.supportFormation.count.mockResolvedValue(1);
    await lirePreparation(SESSION);

    const where = p.supportFormation.count.mock.calls[0]?.[0]?.where as Record<string, unknown>;
    expect(where.type).toBe("kit_formateur_imprime");
    expect(where.pdfKey).toEqual({ not: null });
  });

  it("rend null sur une session inconnue, sans lever", async () => {
    p.trainingSession.findUnique.mockResolvedValue(null);
    expect(await lirePreparation(SESSION)).toBeNull();
  });
});

describe("listerSessionsAPreparer — l'écran anti-oubli", () => {
  it("n'interroge QUE les sessions futures, ni annulées ni réalisées", async () => {
    p.trainingSession.findMany.mockResolvedValue([]);

    await listerSessionsAPreparer(30);

    const where = p.trainingSession.findMany.mock.calls[0]?.[0]?.where as {
      dateDebut: { gte: Date; lte: Date };
      statut: { notIn: string[] };
    };
    expect(where.dateDebut.gte.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
    expect(where.statut.notIn).toContain("annulee");
    // 🔴 Rappeler de préparer une session PASSÉE fait du bruit — et le bruit
    // fait qu'on cesse de lire les rappels.
    expect(where.statut.notIn).toContain("realisee");
  });

  it("écarte les sessions déjà prêtes et garde celles qui ne le sont pas", async () => {
    const dans5j = new Date(Date.now() + 5 * 86_400_000);
    p.trainingSession.findMany.mockResolvedValue([
      { id: "s-pret", titreSession: "Prête", dateDebut: dans5j },
      { id: "s-todo", titreSession: "À préparer", dateDebut: dans5j },
    ]);
    p.trainingSession.findUnique
      .mockResolvedValueOnce({
        id: "s-pret",
        formationId: "f",
        formation: { slug: "x" },
        kitSorties: { sorties: UNE_SORTIE, genereLe: new Date(), valideLe: new Date() },
      })
      .mockResolvedValueOnce({
        id: "s-todo",
        formationId: "f",
        formation: { slug: "x" },
        kitSorties: null,
      });
    p.supportFormation.count.mockResolvedValue(1);

    const liste = await listerSessionsAPreparer(30);

    expect(liste.map((l) => l.sessionId)).toEqual(["s-todo"]);
    expect(liste[0]?.etape).toBe("a_generer");
    expect(liste[0]?.joursRestants).toBe(5);
  });
});
