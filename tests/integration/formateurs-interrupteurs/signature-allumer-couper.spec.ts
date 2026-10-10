/**
 * Lot S6a — allumer / couper un interrupteur du socle de signature
 * (`signature.*`) contre un VRAI Postgres (Gate D,
 * `pnpm test:integration tests/integration/formateurs-interrupteurs`).
 *
 * Même calque que `allumer-couper.spec.ts` (S0-ter) : l'écrivain des
 * interrupteurs `signature.*` journalisait sa clé texte dans
 * `activity_logs.target_id` (uuid) — Postgres aurait refusé la ligne et annulé
 * l'allumage. Un faux client Prisma ne le voit pas ; la vraie base, si.
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
    settings: [] as Array<{ key: string; value: unknown; updatedBy: string | null }>,
    journal: [] as Array<{
      action: string;
      target_type: string | null;
      target_id: string | null;
      changes: unknown;
    }>,
  },
}));

const ADMIN_ID = "00000000-0000-4000-8000-00000056a0ee";
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
              name: "Test S6a",
              email: "s6a-signature@test.invalid",
              passwordHash: "x",
              role: "super_admin",
            },
          });
          rendu = await fn(tx);
          ecrit.settings = await tx.setting.findMany({
            where: { key: { startsWith: "signature." } },
            select: { key: true, value: true, updatedBy: true },
          });
          ecrit.journal = await tx.$queryRaw`
            SELECT action, target_type, target_id::text AS target_id, changes
            FROM activity_logs WHERE admin_user_id = ${ADMIN_ID}::uuid`;
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
  basculerSignatureAlertesHorsJetonAction,
  basculerSignatureCopiePartielleAction,
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
  ecrit.settings = [];
  ecrit.journal = [];
});

describe("S6a — interrupteur « Alertes de signature hors lien à jeton » sur base réelle", () => {
  it("Allumer écrit le réglage ET sa ligne de journal, sans `target_id`", async () => {
    const r = await basculerSignatureAlertesHorsJetonAction(INITIAL, fd("1"));
    expect(r).toEqual({ ok: true, message: "Enregistré." });
    expect(ecrit.settings).toEqual([
      { key: "signature.alertes_hors_jeton", value: { actif: true }, updatedBy: ADMIN_ID },
    ]);
    expect(ecrit.journal).toEqual([
      {
        action: "signature.interrupteur_allume",
        target_type: "setting",
        target_id: null,
        changes: { cle: "signature.alertes_hors_jeton", avant: false, apres: true },
      },
    ]);
  });

  it("Couper écrit le réglage ET sa ligne de journal", async () => {
    const r = await basculerSignatureAlertesHorsJetonAction(INITIAL, fd("0"));
    expect(r).toEqual({ ok: true, message: "Coupé." });
    expect(ecrit.settings).toMatchObject([{ value: { actif: false } }]);
    expect(ecrit.journal).toHaveLength(1);
    expect(ecrit.journal[0]?.action).toBe("signature.interrupteur_coupe");
  });

  it("préalable manquant (copie partielle sans textes validés) → refus, rien d'écrit", async () => {
    const r = await basculerSignatureCopiePartielleAction(INITIAL, fd("1"));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/^Allumage refusé/);
    expect(ecrit.settings).toEqual([]);
    expect(ecrit.journal).toEqual([]);
  });
});

describe("rien ne reste en base", () => {
  it("aucune ligne de test après coup", async () => {
    const [s, a, l] = await Promise.all([
      db.client.setting.count({ where: { key: { startsWith: "signature." } } }),
      db.client.adminUser.count({ where: { id: ADMIN_ID } }),
      db.client.activityLog.count({ where: { adminUserId: ADMIN_ID } }),
    ]);
    expect([s, a, l]).toEqual([0, 0, 0]);
  });
});
