/**
 * Interrupteurs formateurs — Server Actions (lot S0-ter).
 *
 * Habilitation par clé, préalables relus côté serveur, journal dans la MÊME
 * transaction que l'écriture.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const auth = vi.fn();
vi.mock("@/auth", () => ({ auth: () => auth() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/admin-path", () => ({ adminPath: (_l: string, p: string) => `/fr/adm/${p}` }));

const { tx, horsTx, etat } = vi.hoisted(() => {
  const etat: {
    lignes: Array<{ key: string; value: unknown; updatedAt: Date; updatedBy: string | null }>;
  } = { lignes: [] };
  return {
    etat,
    tx: {
      setting: {
        findMany: vi.fn(async () => etat.lignes),
        findUnique: vi.fn(async () => null),
        upsert: vi.fn(async () => ({})),
      },
      activityLog: { create: vi.fn(async () => ({})) },
    },
    horsTx: {
      setting: { findMany: vi.fn(), upsert: vi.fn() },
      activityLog: { create: vi.fn() },
    },
  };
});
vi.mock("@/lib/prisma", () => ({
  prisma: {
    ...horsTx,
    $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  },
}));

import {
  basculerFormateursEchangeOuvertAction,
  basculerFormateursGardeMissionAction,
  basculerFormateursInvitationAutoAction,
  basculerFormateursPassagePaiementAction,
  basculerFormateursRelancesAutoAction,
  basculerFormateursTextesValidesAction,
  basculerSignatureAlertesHorsJetonAction,
} from "../formateurs-interrupteurs";

const INITIAL = { ok: true as const, message: "" };

function fd(champs: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(champs)) f.set(k, v);
  return f;
}
function connecte(role: string) {
  auth.mockResolvedValue({ user: { id: "u-1", role } });
}
function ligne(cle: string, value: unknown) {
  return { key: `formateurs.${cle}`, value, updatedAt: new Date(), updatedBy: null };
}

beforeEach(() => {
  vi.clearAllMocks();
  etat.lignes = [];
});

describe("préalables vérifiés côté serveur", () => {
  it("relances_auto sans dossier_en_ligne → refus, rien n'est écrit", async () => {
    connecte("admin");
    etat.lignes = [ligne("textes_valides", { actif: true })];
    const r = await basculerFormateursRelancesAutoAction(INITIAL, fd({ actif: "1" }));
    expect(r.ok).toBe(false);
    expect(tx.setting.upsert).not.toHaveBeenCalled();
    expect(tx.activityLog.create).not.toHaveBeenCalled();
  });

  it("invitation_auto sans echange_ouvert → refus", async () => {
    connecte("super_admin");
    etat.lignes = [ligne("textes_valides", { actif: true })];
    const r = await basculerFormateursInvitationAutoAction(INITIAL, fd({ actif: "1" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/échange/i);
    expect(tx.setting.upsert).not.toHaveBeenCalled();
  });

  it("invitation_auto avec ses deux préalables → allumée, journal dans la transaction", async () => {
    connecte("admin");
    etat.lignes = [
      ligne("textes_valides", { actif: true }),
      ligne("echange_ouvert", { actif: true }),
    ];
    const r = await basculerFormateursInvitationAutoAction(INITIAL, fd({ actif: "1" }));
    expect(r.ok).toBe(true);
    expect(tx.setting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: "formateurs.invitation_auto" },
        update: expect.objectContaining({ value: { actif: true } }),
      }),
    );
    expect(tx.activityLog.create).toHaveBeenCalledTimes(1);
    expect(horsTx.activityLog.create).not.toHaveBeenCalled();
    expect(horsTx.setting.upsert).not.toHaveBeenCalled();
  });

  it("garde_mission=avertir sans contrôle registre → refus", async () => {
    connecte("admin");
    const r = await basculerFormateursGardeMissionAction(INITIAL, fd({ valeur: "avertir" }));
    expect(r.ok).toBe(false);
  });

  it("passage_paiement exige une date au 1er du mois", async () => {
    connecte("admin");
    const r = await basculerFormateursPassagePaiementAction(INITIAL, fd({ date: "2026-12-15" }));
    expect(r.ok).toBe(false);
    const ok = await basculerFormateursPassagePaiementAction(INITIAL, fd({ date: "2026-12-01" }));
    expect(ok.ok).toBe(true);
  });
});

describe("couper est toujours possible", () => {
  it("couper invitation_auto alors que rien n'est allumé", async () => {
    connecte("admin");
    etat.lignes = [];
    const r = await basculerFormateursInvitationAutoAction(INITIAL, fd({ actif: "0" }));
    expect(r.ok).toBe(true);
    expect(tx.activityLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "formateurs.interrupteur_coupe" }),
      }),
    );
  });

  it("revenir à « refuser » et effacer la date de passage sont permis", async () => {
    connecte("admin");
    expect(
      (await basculerFormateursGardeMissionAction(INITIAL, fd({ valeur: "refuser" }))).ok,
    ).toBe(true);
    expect((await basculerFormateursPassagePaiementAction(INITIAL, fd({ date: "" }))).ok).toBe(
      true,
    );
  });
});

describe("habilitation par clé", () => {
  it.each(["responsable_qualite", "secretaire", "editor", "reader", "inconnu"])(
    "« %s » ne touche à aucun interrupteur technique, même pour couper",
    async (role) => {
      connecte(role);
      const r = await basculerFormateursEchangeOuvertAction(INITIAL, fd({ actif: "0" }));
      expect(r.ok).toBe(false);
      expect(tx.setting.upsert).not.toHaveBeenCalled();
    },
  );

  it("sans session → refus", async () => {
    auth.mockResolvedValue(null);
    const r = await basculerFormateursEchangeOuvertAction(INITIAL, fd({ actif: "1" }));
    expect(r.ok).toBe(false);
  });

  it("textes_valides : un `admin` n'est pas habilité, `super_admin` l'est", async () => {
    connecte("admin");
    expect((await basculerFormateursTextesValidesAction(INITIAL, fd({ actif: "1" }))).ok).toBe(
      false,
    );
    connecte("super_admin");
    expect((await basculerFormateursTextesValidesAction(INITIAL, fd({ actif: "1" }))).ok).toBe(
      true,
    );
  });
});

describe("constaté en prod le 2026-10-10 — « Allumer » cassait la page", () => {
  it("le journal ne met pas la clé texte dans `targetId` (colonne `uuid`)", async () => {
    connecte("super_admin");
    await basculerFormateursEchangeOuvertAction(INITIAL, fd({ actif: "1" }));
    const data = (tx.activityLog.create.mock.calls[0] as unknown as [{ data: object }])[0].data;
    expect(data).not.toHaveProperty("targetId");
    expect(data).toMatchObject({
      targetType: "setting",
      changes: { cle: "formateurs.echange_ouvert", avant: false, apres: true },
    });
  });

  it("une erreur de la base devient un message à l'écran, jamais une page cassée", async () => {
    connecte("super_admin");
    tx.activityLog.create.mockRejectedValueOnce(new Error("P2023 Inconsistent column data"));
    const r = await basculerFormateursEchangeOuvertAction(INITIAL, fd({ actif: "1" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/n'a pas été enregistré/);
  });
});

describe("interrupteurs `signature.*` (S6a) — même règle", () => {
  it("le journal ne met pas la clé texte dans `targetId` (colonne `uuid`)", async () => {
    connecte("super_admin");
    await basculerSignatureAlertesHorsJetonAction(INITIAL, fd({ actif: "1" }));
    const data = (tx.activityLog.create.mock.calls[0] as unknown as [{ data: object }])[0].data;
    expect(data).not.toHaveProperty("targetId");
    expect(data).toMatchObject({
      targetType: "setting",
      changes: { cle: "signature.alertes_hors_jeton", avant: false, apres: true },
    });
  });

  it("une erreur de la base devient un message à l'écran, jamais une page cassée", async () => {
    connecte("super_admin");
    tx.activityLog.create.mockRejectedValueOnce(new Error("P2023 Inconsistent column data"));
    const r = await basculerSignatureAlertesHorsJetonAction(INITIAL, fd({ actif: "1" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/n'a pas été enregistré/);
  });
});
