// @vitest-environment node
/**
 * ⛔ RENOUVELER UN APPAREIL RÉVOQUÉ EST REFUSÉ (V1, S5).
 *
 * « Renouveler » créait le nouveau jeton PUIS révoquait l'ancien, hors
 * transaction : si la révocation échouait, deux jetons restaient valides
 * (l'ancien, celui d'un poste perdu, pour 90 jours) et l'erreur affichée
 * laissait croire que rien n'avait changé. Et renouveler un appareil déjà
 * révoqué recréait un jeton sous son nom.
 *
 * Désormais `renouvelerAppareil` : UNE transaction, révoquer d'abord (et
 * seulement un appareil encore actif), puis créer.
 *
 * Mutations qui rougissent : créer avant de révoquer (1er cas, ordre) ;
 * appeler la base hors de `$transaction` (1er cas : le faux client n'a de
 * modèle que dans la transaction) ; retirer le refus d'un appareil révoqué
 * (2e cas) ; revenir à `creerAppareil` + `revoquerAppareil` dans l'action
 * (3e cas).
 * Contre-témoin : un appareil actif est bien renouvelé (1er cas).
 * Angle mort : l'annulation réelle de la transaction (Postgres) n'est pas
 * jouée ici ; seul l'ordre et le périmètre le sont.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import type { PrismaClient } from "../../../../prisma/generated/client";
import { renouvelerAppareil } from "../jeton";

const T0 = new Date("2026-10-06T10:00:00Z");

function base(appareil: { id: string; nom: string; revoqueLe: Date | null } | null) {
  const journal: string[] = [];
  const tx = {
    appareilEnregistrement: {
      findUnique: async () => {
        journal.push("lire");
        return appareil;
      },
      updateMany: async (a: { where: { revoqueLe: null } }) => {
        journal.push("revoquer");
        return { count: appareil && appareil.revoqueLe === null && a.where.revoqueLe === null ? 1 : 0 };
      },
      create: async () => {
        journal.push("creer");
        return { id: "nouveau" };
      },
    },
  };
  const db = {
    $transaction: async <T>(fn: (t: typeof tx) => Promise<T>): Promise<T> => {
      journal.push("debut");
      const r = await fn(tx);
      journal.push("fin");
      return r;
    },
  };
  return { db: db as unknown as Pick<PrismaClient, "$transaction">, journal };
}

describe("⛔ renouveler un appareil révoqué est refusé", () => {
  it("un appareil actif : dans une transaction, révoqué d'abord, puis recréé", async () => {
    const b = base({ id: "a1", nom: "Poste de test", revoqueLe: null });
    const r = await renouvelerAppareil(b.db, { appareilId: "a1", adminUserId: "u1", maintenant: T0 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.appareilId).toBe("nouveau");
    expect(b.journal).toEqual(["debut", "lire", "revoquer", "creer", "fin"]);
  });

  it("un appareil déjà révoqué : refusé, aucun jeton créé", async () => {
    const b = base({ id: "a1", nom: "Poste de test", revoqueLe: T0 });
    const r = await renouvelerAppareil(b.db, { appareilId: "a1", adminUserId: "u1", maintenant: T0 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/déjà révoqué/);
    expect(b.journal).not.toContain("creer");

    const absent = base(null);
    const r2 = await renouvelerAppareil(absent.db, {
      appareilId: "a1",
      adminUserId: "u1",
      maintenant: T0,
    });
    expect(r2.ok).toBe(false);
    expect(absent.journal).not.toContain("creer");
  });

  it("l'action « Renouveler » passe par renouvelerAppareil, jamais créer puis révoquer", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/features/admin-enregistreur/actions.ts"),
      "utf8",
    );
    const corps = source.slice(source.indexOf("export async function renouvelerJetonAction"));
    const fin = corps.indexOf("\nexport async function", 1);
    const renouveler = fin > 0 ? corps.slice(0, fin) : corps;
    expect(renouveler).toContain("renouvelerAppareil(");
    expect(renouveler).not.toContain("creerAppareil(");
    expect(renouveler).not.toContain("revoquerAppareil(");
  });
});
