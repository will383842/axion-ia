/**
 * Fiche client, étape 4 : « Facture établie hors console (date) » fait passer prospect en client.
 * Base SIMULÉE. Garde : le statut ne fait que monter, la date n'est jamais dans le futur, le tout
 * dans UNE transaction avec sa trace, et rien n'est supprimé.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const CID = "11111111-1111-4111-8111-111111111111";
const ADMIN = "44444444-4444-4444-8444-444444444444";

const tx = vi.hoisted(() => ({
  client: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
  clientFactureHorsConsole: { upsert: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
  activityLog: { create: vi.fn() },
}));
const bd = vi.hoisted(() => ({
  $transaction: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
}));
vi.mock("@/lib/prisma", () => ({ prisma: bd }));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn(async () => ({ userId: ADMIN })),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("@/lib/admin-path", () => ({ adminPath: (_l: string, p: string) => `/fr/console/${p}` }));
vi.mock("@/features/dossier-client/message-de-retour", () => ({
  avecMessageDeRetour: (u: string, c: string, t: string) => `${u}&${c}=${t}`,
}));

import { factureHorsConsoleAction } from "../actions-facture-hors-console";
import { statutApresFactureHorsConsole, validerJourFacture } from "../facture-hors-console";

const formulaire = (o: Record<string, string>): FormData => {
  const fd = new FormData();
  for (const [k, v] of Object.entries({
    clientId: CID,
    facture_hors_console: "1",
    date: "2026-10-01",
    ...o,
  })) {
    fd.set(k, v);
  }
  return fd;
};
const issue = (fd: FormData): Promise<string> =>
  factureHorsConsoleAction(fd).then(
    () => "pas de redirection",
    (e: Error) => e.message,
  );

beforeEach(() => {
  vi.clearAllMocks();
  tx.client.findUnique.mockResolvedValue({ statut: "prospect" });
});

describe("règles pures", () => {
  it("le statut ne fait que monter", () => {
    expect(statutApresFactureHorsConsole("prospect")).toBe("client_actif");
    expect(statutApresFactureHorsConsole("devis_envoye")).toBe("client_actif");
    expect(statutApresFactureHorsConsole("client_actif")).toBeNull();
    expect(statutApresFactureHorsConsole("client_inactif")).toBeNull();
    expect(statutApresFactureHorsConsole("perdu")).toBeNull();
  });

  it("la date : valide, pas future, pas absurde", () => {
    const auj = "2026-10-26";
    expect(validerJourFacture("2026-10-26", auj)).toEqual({ ok: true, jour: "2026-10-26" });
    expect(validerJourFacture("2026-10-27", auj).ok).toBe(false);
    expect(validerJourFacture("2026-02-30", auj).ok).toBe(false);
    expect(validerJourFacture("26/10/2026", auj).ok).toBe(false);
    expect(validerJourFacture("1999-12-31", auj).ok).toBe(false);
    expect(validerJourFacture("", auj).ok).toBe(false);
  });
});

describe("factureHorsConsoleAction", () => {
  it("prospect : note la date, passe client actif, laisse une trace, dans une transaction", async () => {
    const r = await issue(formulaire({}));
    expect(r).toContain("onglet=devis-factures");
    expect(r).toContain("la fiche est maintenant un client");
    expect(bd.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.clientFactureHorsConsole.upsert.mock.calls[0]![0]).toMatchObject({
      where: { clientId: CID },
      create: { clientId: CID, parAdminId: ADMIN },
    });
    expect(tx.client.update).toHaveBeenCalledWith({
      where: { id: CID },
      data: { statut: "client_actif" },
    });
    expect(tx.activityLog.create.mock.calls[0]![0].data).toMatchObject({
      adminUserId: ADMIN,
      action: "client.devient_client",
      targetId: CID,
      changes: { statutAvant: "prospect", statutApres: "client_actif", etabliLe: "2026-10-01" },
    });
  });

  it.each(["client_actif", "client_inactif", "perdu"])(
    "%s : la date est notée, le statut ne bouge pas",
    async (statut) => {
      tx.client.findUnique.mockResolvedValue({ statut });
      const r = await issue(formulaire({}));
      expect(r).toContain("message=Facture hors console enregistrée.");
      expect(r).not.toContain("maintenant un client");
      expect(tx.clientFactureHorsConsole.upsert).toHaveBeenCalled();
      expect(tx.client.update).not.toHaveBeenCalled();
      expect(tx.activityLog.create).not.toHaveBeenCalled();
    },
  );

  it("ne supprime jamais rien", async () => {
    await issue(formulaire({}));
    expect(tx.client.delete).not.toHaveBeenCalled();
    expect(tx.client.deleteMany).not.toHaveBeenCalled();
    expect(tx.clientFactureHorsConsole.delete).not.toHaveBeenCalled();
    expect(tx.clientFactureHorsConsole.deleteMany).not.toHaveBeenCalled();
  });

  it.each([
    ["case non cochée", { facture_hors_console: "" }],
    ["date future", { date: "2999-01-01" }],
    ["date illisible", { date: "hier" }],
  ])("refuse : %s — rien n'est écrit", async (_n, champs) => {
    expect(await issue(formulaire(champs))).toContain("erreur=");
    expect(bd.$transaction).not.toHaveBeenCalled();
  });

  it("fiche introuvable : message d'erreur, rien n'est écrit", async () => {
    tx.client.findUnique.mockResolvedValue(null);
    expect(await issue(formulaire({}))).toContain("erreur=");
    expect(tx.clientFactureHorsConsole.upsert).not.toHaveBeenCalled();
  });

  it("sans fiche valide, ne touche à rien", async () => {
    expect(await issue(formulaire({ clientId: "x" }))).toContain("REDIRECT:");
    expect(bd.$transaction).not.toHaveBeenCalled();
  });
});
