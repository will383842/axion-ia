/**
 * Tests — trainers.ts (R9 audit E2E 2026-06-06).
 *
 * - isTrainerHabilite : fonction pure (cœur du blocage d'assignation).
 * - listTrainers / getTrainer : stub-safe (mock prisma).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindMany = vi.fn();
const mockFindUnique = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainer: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}));

import { listTrainers, getTrainer, isTrainerHabilite } from "./trainers";

const FORMATION_ID = "11111111-1111-1111-1111-111111111111";

function makeTrainer(overrides: Record<string, unknown> = {}) {
  return {
    statut: "salarie" as const,
    formationIdsHabilites: [FORMATION_ID],
    sousTraitantVerifieAt: null as Date | null,
    actif: true,
    ...overrides,
  };
}

describe("isTrainerHabilite", () => {
  it("ok si salarié actif habilité sur la formation", () => {
    expect(isTrainerHabilite(makeTrainer(), FORMATION_ID).ok).toBe(true);
  });

  it("refuse si formateur inactif", () => {
    const r = isTrainerHabilite(makeTrainer({ actif: false }), FORMATION_ID);
    expect(r.ok).toBe(false);
    expect(r.raison).toContain("inactif");
  });

  it("refuse si la formation n'est pas dans les habilitations", () => {
    const r = isTrainerHabilite(makeTrainer({ formationIdsHabilites: [] }), FORMATION_ID);
    expect(r.ok).toBe(false);
    expect(r.raison).toContain("non habilité");
  });

  it("🔴 la garde compare des IDS DE FORMATION, jamais des slugs", () => {
    // Audit certification 2026-07-25 (F11). En production la colonne legacy
    // `formationsHabilitees` contenait des SLUGS (`ia-pour-bien-commencer`) alors
    // que la garde recevait un UUID de formation : `includes()` ne pouvait jamais
    // être vrai, donc TOUT formateur était « non habilité » et aucune session ne
    // pouvait recevoir de formateur — pendant que la liste affichait « 33 ».
    const avecSlugs = isTrainerHabilite(
      makeTrainer({ formationIdsHabilites: ["ia-pour-bien-commencer"] }),
      FORMATION_ID,
    );
    expect(avecSlugs.ok).toBe(false);

    const avecIds = isTrainerHabilite(
      makeTrainer({ formationIdsHabilites: [FORMATION_ID] }),
      FORMATION_ID,
    );
    expect(avecIds.ok).toBe(true);
  });

  it("refuse un sous-traitant non vérifié même habilité", () => {
    const r = isTrainerHabilite(
      makeTrainer({ statut: "sous_traitant", sousTraitantVerifieAt: null }),
      FORMATION_ID,
    );
    expect(r.ok).toBe(false);
    expect(r.raison).toContain("Sous-traitant non vérifié");
  });

  it("ok pour un sous-traitant vérifié + habilité", () => {
    expect(
      isTrainerHabilite(
        makeTrainer({ statut: "sous_traitant", sousTraitantVerifieAt: new Date() }),
        FORMATION_ID,
      ).ok,
    ).toBe(true);
  });
});

describe("listTrainers / getTrainer (stub-safe)", () => {
  beforeEach(() => {
    mockFindMany.mockReset();
    mockFindUnique.mockReset();
  });

  it("listTrainers retourne les lignes", async () => {
    mockFindMany.mockResolvedValue([{ id: "t1", habilitations: [] }]);
    expect(await listTrainers()).toHaveLength(1);
  });

  it("🔴 nbHabilitations vient de la RELATION, jamais de la colonne legacy", async () => {
    // Audit certification 2026-07-25 (F11). En production, `formationsHabilitees`
    // contenait 33 slugs d'un catalogue archivé pendant que `TrainerHabilitation`
    // était vide : la liste affichait « 33 » et la garde d'assignation refusait
    // tout le monde. Le compte doit venir de la table qui fait foi.
    mockFindMany.mockResolvedValue([
      {
        id: "t1",
        formationsHabilitees: ["slug-a", "slug-b", "slug-c"],
        habilitations: [{ formationId: "f-1" }],
      },
    ]);
    const [t] = await listTrainers();
    expect(t?.nbHabilitations).toBe(1);
  });

  it("listTrainers demande bien le compte des habilitations à Prisma", async () => {
    mockFindMany.mockResolvedValue([]);
    await listTrainers();
    // ⚠️ Le `where: { retireAt: null }` s'est ajouté le 2026-08-17 : la
    // dé-habilitation historise au lieu de supprimer, donc la lecture doit
    // filtrer. L'intention de ce test — « le compte vient de Prisma, pas du
    // tableau legacy » — est inchangée.
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: {
          habilitations: { where: { retireAt: null }, select: { formationId: true } },
        },
      }),
    );
  });

  it("listTrainers retourne [] si la DB jette (stub build)", async () => {
    mockFindMany.mockRejectedValue(new Error("stub"));
    expect(await listTrainers()).toEqual([]);
  });

  it("listTrainers applique le filtre actifOnly", async () => {
    mockFindMany.mockResolvedValue([]);
    await listTrainers({ actifOnly: true, statut: "sous_traitant" });
    const arg = mockFindMany.mock.calls[0]?.[0] as { where?: Record<string, unknown> };
    expect(arg.where).toMatchObject({ actif: true, statut: "sous_traitant" });
  });

  it("getTrainer retourne null si la DB jette", async () => {
    mockFindUnique.mockRejectedValue(new Error("stub"));
    expect(await getTrainer("x")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 🔴 UNE HABILITATION RETIRÉE RESTE AU REGISTRE — Lot 9, trouvé le 2026-08-17.
//
// La dé-habilitation était un `deleteMany` : la ligne DISPARAISSAIT. À la
// question « depuis quand ce formateur n'est-il plus habilité ? », aucune
// réponse. Et si une session avait été ANIMÉE alors qu'il était habilité,
// retirer l'habilitation aujourd'hui détruisait la preuve de conformité de
// cette session PASSÉE (ind. 21/22).
// ─────────────────────────────────────────────────────────────────────────────

describe("🔴 seules les habilitations ACTIVES rendent un formateur habilité", () => {
  it("listTrainers ne compte QUE les non retirées", async () => {
    mockFindMany.mockResolvedValue([{ id: "t1", habilitations: [{ formationId: "f-1" }] }]);
    await listTrainers();
    const args = mockFindMany.mock.calls.at(-1)![0] as {
      include: { habilitations: { where?: { retireAt?: null } } };
    };
    // `toEqual` et non `toMatchObject` : l'égalité STRICTE est ce qui donne à ce
    // test sa seconde fonction, décidée le 2026-08-19. Le filtre
    // `formation: { statut: { not: "archive" } }` — celui des pièces imprimées —
    // ne doit PAS remonter jusqu'ici. `archiveFormationAction` autorise
    // l'archivage « même avec des sessions en cours/réalisées » : l'ajouter
    // rendrait `isTrainerHabilite` négatif pour toute session dont la formation
    // a été retirée du catalogue après coup, et un formateur qui se désiste ne
    // serait plus remplaçable. Ce test rougit si quelqu'un l'ajoute « pour
    // cohérence ».
    expect(
      args.include.habilitations.where,
      "Sans ce filtre, un formateur dé-habilité continuerait d'apparaître " +
        "habilité partout — et la garde le laisserait animer.",
    ).toEqual({ retireAt: null });
  });
});
