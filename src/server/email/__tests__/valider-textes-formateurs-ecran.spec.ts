// M1 (lot A) — l'écran de validation : les actions appelées par les boutons.
//   · un texte (gabarit ou variante) se valide ou se dévalide, super-admin seul ;
//   · « valider tous les textes formateurs d'un coup » exige une confirmation explicite
//     ET le nombre de textes affichés (la liste n'a pas changé entre l'écran et le clic) ;
//   · jamais de `targetId` dans `activity_logs` (la clé va dans `changes`).
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.fn();
vi.mock("@/auth", () => ({ auth: () => auth() }));
vi.mock("@/lib/client-ip", () => ({ getClientIp: async () => "203.0.113.7" }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { tx } = vi.hoisted(() => ({
  tx: {
    setting: {
      findUnique: vi.fn(async () => null as unknown),
      findMany: vi.fn(async () => [] as Array<{ key: string; value: unknown }>),
      upsert: vi.fn(async () => ({})),
    },
    activityLog: { create: vi.fn(async () => ({})) },
  },
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)) },
}));

import {
  validerTexteEmailFormAction,
  validerTousTextesFormateursAction,
} from "../textes-valides-actions";
import { cleDuTexte, TEXTES_FORMATEURS_A_VALIDER } from "../textes-formateurs-a-valider";
import { cleTexteValide } from "../textes-valides";

const INITIAL = { ok: true as const, message: "" };
const connecte = (role: string) => auth.mockResolvedValue({ user: { id: "u-1", role } });
const form = (champs: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(champs)) f.set(k, v);
  return f;
};
const logs = () =>
  (tx.activityLog.create.mock.calls as unknown as Array<[{ data: Record<string, unknown> }]>).map(
    (c) => c[0].data,
  );

beforeEach(() => vi.clearAllMocks());

describe("validerTexteEmailFormAction (un texte)", () => {
  it("valide une VARIANTE : écrit sa propre clé, journal sans targetId", async () => {
    connecte("super_admin");
    const r = await validerTexteEmailFormAction(
      INITIAL,
      form({ gabarit: "formateur-mission-retiree", variante: "lettre-non-signee", valide: "1" }),
    );
    expect(r.ok).toBe(true);
    const cle = cleTexteValide("formateur-mission-retiree", "lettre-non-signee");
    expect(tx.setting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { key: cle } }),
    );
    expect(logs()[0]).not.toHaveProperty("targetId");
  });

  it("retire une validation (valide=0)", async () => {
    connecte("super_admin");
    tx.setting.findUnique.mockResolvedValueOnce({ value: { valide: true } });
    const r = await validerTexteEmailFormAction(
      INITIAL,
      form({ gabarit: "formateur-dossier-lien", valide: "0" }),
    );
    expect(r).toEqual({ ok: true, message: "Validation retirée." });
    expect(tx.setting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { value: { valide: false }, updatedBy: "u-1" } }),
    );
    expect(logs()[0]?.action).toBe("email.texte_invalide");
  });

  it("refuse un texte qui ne se valide pas ici (autre public, texte de base de F23)", async () => {
    connecte("super_admin");
    for (const champs of [
      { gabarit: "lead-apporteur-recu", valide: "1" },
      { gabarit: "formateur-mission-proposee", valide: "1" },
    ]) {
      const r = await validerTexteEmailFormAction(INITIAL, form(champs));
      expect(r.ok).toBe(false);
    }
    expect(tx.setting.upsert).not.toHaveBeenCalled();
  });

  it("un administrateur qui n'est pas super-admin est refusé", async () => {
    connecte("admin");
    const r = await validerTexteEmailFormAction(
      INITIAL,
      form({ gabarit: "formateur-dossier-lien", valide: "1" }),
    );
    expect(r.ok).toBe(false);
    expect(tx.setting.upsert).not.toHaveBeenCalled();
  });
});

describe("validerTousTextesFormateursAction (d'un coup)", () => {
  const N = String(TEXTES_FORMATEURS_A_VALIDER.length);

  it("sans la case de confirmation : rien n'est écrit", async () => {
    connecte("super_admin");
    const r = await validerTousTextesFormateursAction(INITIAL, form({ nombre: N }));
    expect(r.ok).toBe(false);
    expect(tx.setting.upsert).not.toHaveBeenCalled();
    expect(tx.activityLog.create).not.toHaveBeenCalled();
  });

  it("un nombre qui ne correspond plus à la liste : rien n'est écrit", async () => {
    connecte("super_admin");
    const r = await validerTousTextesFormateursAction(
      INITIAL,
      form({ confirme: "oui", nombre: "3" }),
    );
    expect(r.ok).toBe(false);
    expect(tx.setting.upsert).not.toHaveBeenCalled();
  });

  it("un administrateur qui n'est pas super-admin est refusé", async () => {
    connecte("admin");
    const r = await validerTousTextesFormateursAction(
      INITIAL,
      form({ confirme: "oui", nombre: N }),
    );
    expect(r.ok).toBe(false);
    expect(tx.setting.upsert).not.toHaveBeenCalled();
  });

  it("confirmé : chaque texte non encore validé est écrit, UNE ligne de journal sans targetId", async () => {
    connecte("super_admin");
    const dejaValide = cleDuTexte(TEXTES_FORMATEURS_A_VALIDER[0]!);
    tx.setting.findMany.mockResolvedValueOnce([{ key: dejaValide, value: { valide: true } }]);
    const r = await validerTousTextesFormateursAction(
      INITIAL,
      form({ confirme: "oui", nombre: N }),
    );
    expect(r.ok).toBe(true);
    const ecrites = (
      tx.setting.upsert.mock.calls as unknown as Array<[{ where: { key: string } }]>
    ).map((c) => c[0].where.key);
    expect(ecrites).toHaveLength(TEXTES_FORMATEURS_A_VALIDER.length - 1);
    expect(ecrites).not.toContain(dejaValide);
    expect(ecrites).toContain(cleTexteValide("formateur-mission-proposee", "honoraires"));
    expect(logs()).toHaveLength(1);
    expect(logs()[0]).not.toHaveProperty("targetId");
    expect(logs()[0]?.action).toBe("email.textes_formateurs_valides");
    expect(logs()[0]?.changes).toMatchObject({ nombre: TEXTES_FORMATEURS_A_VALIDER.length - 1 });
  });
});
