/**
 * La liste des candidatures dit « Apporteur d'affaires · ville », pas
 * « Commercial Mémo Isère » — et ce n'est QU'UN libellé d'affichage.
 *
 * L'ancien libellé nommait une annonce (le Mémorial de l'Isère) et un métier
 * (« commercial ») qui ne sont ni l'un ni l'autre ce qu'est un apporteur : une
 * personne indépendante qui recommande Axion-IA, venue de n'importe quel canal.
 *
 * 🔑 Le libellé est calculé à la lecture. Le test le vérifie en interdisant
 * toute écriture : la base simulée ne connaît que `count` et `findMany`, et la
 * ligne rendue par la base est comparée, après coup, à ce qu'elle était avant
 * — rien de ce qui est stocké ne change pour un renommage d'écran.
 */

import { describe, it, expect, vi } from "vitest";

const findMany = vi.fn();
const count = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    submission: {
      findMany: (...a: unknown[]) => findMany(...a),
      count: (...a: unknown[]) => count(...a),
    },
  },
}));
vi.mock("../session", () => ({
  requireAdminRead: () => Promise.resolve({ userId: "admin-1", role: "super_admin" }),
  requireAdminWrite: () => Promise.resolve({ userId: "admin-1", role: "super_admin" }),
}));
vi.mock("@/auth", () => ({ auth: () => Promise.resolve(null) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { listCandidaturesUnifieesAction } from "../actions";

function dossier(id: string, details: Record<string, unknown>) {
  return {
    id,
    contactName: "Camille Martin",
    contactEmail: "camille@exemple.invalid",
    status: "new",
    needsAttention: true,
    submittedAt: new Date("2026-09-19T10:00:00Z"),
    details,
  };
}

describe("candidatures — libellé des dossiers apporteurs", () => {
  it("affiche « Apporteur d'affaires · ville », et « Apporteur d'affaires » sans ville", async () => {
    const lignes = [
      dossier("a", {
        unifiedType: "recrutement",
        subType: "candidature-commerciale",
        ville: "Grenoble",
      }),
      dossier("b", { unifiedType: "recrutement", subType: "candidature-commerciale" }),
    ];
    const avant = structuredClone(lignes);
    count.mockResolvedValue(2);
    findMany.mockResolvedValue(lignes);

    const res = await listCandidaturesUnifieesAction({ scope: "memo" });

    expect(res.items.map((i) => i.offerLabel)).toEqual([
      "Apporteur d'affaires · Grenoble",
      "Apporteur d'affaires",
    ]);
    expect(res.items.some((i) => /Commercial|Mémo Isère/.test(i.offerLabel))).toBe(false);
    // Valeur stockée inchangée : rien n'a été réécrit dans les lignes lues.
    expect(lignes).toEqual(avant);
  });
});
