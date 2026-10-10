/**
 * Lot S0-ter — allumer / couper un interrupteur formateurs contre un VRAI
 * Postgres (Gate D, `pnpm test:integration tests/integration/formateurs-interrupteurs`).
 *
 * Constaté en prod le 2026-10-10 : « Allumer » sur « Échange de découverte
 * ouvert » levait une `PrismaClientKnownRequestError`, la page cassait et
 * l'interrupteur restait coupé. Un faux client Prisma accepte n'importe quelle
 * forme d'écriture ; seule une vraie base dit si la ligne de journal entre
 * dans `activity_logs` (colonnes typées, clé étrangère vers `admin_users`).
 *
 * L'action est appelée TELLE QUELLE ; seul `$transaction` est enveloppé : la
 * vraie transaction s'exécute (admin de test compris), puis est ANNULÉE — la
 * base reste vide. Sans `DATABASE_URL`, ce fichier ÉCHOUE, il ne se saute pas.
 */

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { PrismaClient } from "../../../prisma/generated/client";

const { db, auth, ecrit } = vi.hoisted(() => ({
  db: { client: null as unknown as PrismaClient },
  auth: vi.fn(),
  ecrit: {
    setting: null as unknown,
    journal: [] as Array<{ action: string; target_type: string | null; changes: unknown }>,
  },
}));

const ADMIN_ID = "00000000-0000-4000-8000-0000000510ee";
const ANNULE = new Error("ANNULE — la transaction de test ne laisse aucune ligne");

vi.mock("@/auth", () => ({ auth: () => auth() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/admin-path", () => ({ adminPath: (_l: string, p: string) => `/fr/adm/${p}` }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      let rendu: unknown;
      try {
        await db.client.$transaction(async (tx) => {
          await tx.adminUser.create({
            data: {
              id: ADMIN_ID,
              name: "Test S0-ter",
              email: "s0-ter@test.invalid",
              passwordHash: "x",
              role: "super_admin",
            },
          });
          rendu = await fn(tx);
          ecrit.setting = await tx.setting.findUnique({
            where: { key: "formateurs.echange_ouvert" },
          });
          ecrit.journal = await tx.$queryRaw`
            SELECT action, target_type, changes FROM activity_logs
            WHERE admin_user_id = ${ADMIN_ID}::uuid`;
          throw ANNULE;
        });
      } catch (e) {
        if (e !== ANNULE) throw e;
      }
      return rendu;
    },
  },
}));

import {
  basculerFormateursEchangeOuvertAction,
  type EtatBascule,
} from "@/server/actions/qualiopi/formateurs-interrupteurs";

const INITIAL: EtatBascule = { ok: true, message: "" };

function fd(actif: "0" | "1"): FormData {
  const f = new FormData();
  f.set("actif", actif);
  return f;
}

db.client = new PrismaClient();
afterAll(() => db.client.$disconnect());

beforeEach(() => {
  auth.mockResolvedValue({ user: { id: ADMIN_ID, role: "super_admin" } });
  ecrit.setting = null;
  ecrit.journal = [];
});

describe("S0-ter — interrupteur « Échange de découverte ouvert » sur base réelle", () => {
  it("Allumer écrit le réglage ET sa ligne de journal", async () => {
    const r = await basculerFormateursEchangeOuvertAction(INITIAL, fd("1"));
    expect(r).toEqual({ ok: true, message: "Enregistré." });
    expect(ecrit.setting).toMatchObject({ value: { actif: true }, updatedBy: ADMIN_ID });
    expect(ecrit.journal).toEqual([
      {
        action: "formateurs.interrupteur_allume",
        target_type: "setting",
        changes: { cle: "formateurs.echange_ouvert", avant: false, apres: true },
      },
    ]);
  });

  it("Couper écrit le réglage ET sa ligne de journal", async () => {
    const r = await basculerFormateursEchangeOuvertAction(INITIAL, fd("0"));
    expect(r).toEqual({ ok: true, message: "Coupé." });
    expect(ecrit.setting).toMatchObject({ value: { actif: false } });
    expect(ecrit.journal).toHaveLength(1);
    expect(ecrit.journal[0]?.action).toBe("formateurs.interrupteur_coupe");
  });
});

describe("rien ne reste en base", () => {
  it("aucune ligne de test après coup", async () => {
    const [s, a, l] = await Promise.all([
      db.client.setting.count({ where: { key: { startsWith: "formateurs." } } }),
      db.client.adminUser.count({ where: { id: ADMIN_ID } }),
      db.client.activityLog.count({ where: { adminUserId: ADMIN_ID } }),
    ]);
    expect([s, a, l]).toEqual([0, 0, 0]);
  });
});
