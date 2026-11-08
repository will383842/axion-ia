import { beforeEach, describe, expect, it, vi } from "vitest";

const listInbox = vi.fn();
const clientsParEmail = vi.fn();
const requireAdminWrite = vi.fn();
vi.mock("@/features/admin-inbox/queries", () => ({
  listInbox: (...a: unknown[]) => listInbox(...a),
}));
vi.mock("@/server/qualiopi/crm/entrees", () => ({
  clientsParEmail: (...a: unknown[]) => clientsParEmail(...a),
}));
vi.mock("@/features/admin-calendly/acces", () => ({
  peutVoirLesAppels: () => true,
}));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: (...a: unknown[]) => requireAdminWrite(...a),
}));

import { listerSourcesPourQuiAction } from "./devis-assistant-sources";

const LIGNE = {
  key: "msg_1",
  channel: "message",
  detailHref: "/fr/x/contacts/messages/1",
  receivedAt: new Date("2026-11-01T10:00:00Z"),
  subject: "Audit IA",
  contactName: "Claire Martin",
  contactEmail: "claire@exemple.fr",
  context: "SCI Invest Sun",
  statusLabel: "Nouveau",
  needsAction: true,
  sourceId: "1",
  unread: true,
};

beforeEach(() => {
  listInbox.mockReset();
  clientsParEmail.mockReset();
  requireAdminWrite.mockReset();
  requireAdminWrite.mockResolvedValue({ userId: "adm-1", role: "admin" });
  listInbox.mockResolvedValue({ rows: [LIGNE] });
  clientsParEmail.mockResolvedValue(new Map());
});

describe("listerSourcesPourQuiAction (S13)", () => {
  it("lit la boîte de réception avec le rôle de l'appelant", async () => {
    await listerSourcesPourQuiAction({ recherche: "" });
    const arg = listInbox.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(arg["adminUserId"]).toBe("adm-1");
    expect(arg["roleAdmin"]).toBe("admin");
  });

  it("sans fiche : clientId null et lien de la page existante, rien n'est créé", async () => {
    const r = await listerSourcesPourQuiAction({ recherche: "" });
    expect(r).toEqual({
      data: [
        {
          clientId: null,
          libelle: "Claire Martin",
          detail: "Audit IA · SCI Invest Sun · Nouveau",
          lien: "/fr/x/contacts/messages/1",
        },
      ],
    });
  });

  it("avec fiche : clientId rempli", async () => {
    clientsParEmail.mockResolvedValue(
      new Map([["claire@exemple.fr", { id: "c-1", numero: "CLI-1", raisonSociale: "SCI" }]]),
    );
    const r = await listerSourcesPourQuiAction({ recherche: "" });
    expect("data" in r && r.data[0]?.clientId).toBe("c-1");
  });

  it("refuse une recherche trop longue sans lire la base", async () => {
    const r = await listerSourcesPourQuiAction({ recherche: "x".repeat(201) });
    expect("error" in r).toBe(true);
    expect(listInbox).not.toHaveBeenCalled();
  });

  it("garde d'écriture : un appelant non autorisé ne lit rien", async () => {
    requireAdminWrite.mockRejectedValue(new Error("forbidden"));
    await expect(listerSourcesPourQuiAction({ recherche: "" })).rejects.toThrow("forbidden");
    expect(listInbox).not.toHaveBeenCalled();
  });

  it("panne de lecture : message d'erreur, pas d'exception", async () => {
    listInbox.mockRejectedValue(new Error("boom"));
    const r = await listerSourcesPourQuiAction({ recherche: "" });
    expect("error" in r).toBe(true);
  });
});
