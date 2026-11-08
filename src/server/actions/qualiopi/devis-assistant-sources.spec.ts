import { beforeEach, describe, expect, it, vi } from "vitest";

const listInbox = vi.fn();
const clientsParEmail = vi.fn();
const requireAdminWrite = vi.fn();
vi.mock("@/features/admin-inbox/queries", () => ({
  listInbox: (...a: unknown[]) => listInbox(...a),
  PER_CHANNEL_FETCH: 100,
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
  listInbox.mockResolvedValue({ rows: [LIGNE], truncated: false, failedChannels: [] });
  clientsParEmail.mockResolvedValue(new Map());
});

describe("listerSourcesPourQuiAction (S13)", () => {
  it("lecture STRICTEMENT seule : aucun rôle passé à listInbox, donc ni déchiffrement ni activityLog", async () => {
    await listerSourcesPourQuiAction({ recherche: "" });
    const arg = listInbox.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(arg["adminUserId"]).toBe("adm-1");
    // Un rôle déclenche le déchiffrement des candidatures et l'écriture
    // `careers.candidature.liste.consultee` : il doit rester null/absent.
    expect(arg["roleAdmin"] == null).toBe(true);
  });

  it("la fenêtre couvre les 4 canaux (4 × 100) : 200 candidatures récentes + 1 message ancien => le message apparaît", async () => {
    const candidatures = Array.from({ length: 200 }, (_, i) => ({
      ...LIGNE,
      key: `cand_${i}`,
      channel: "candidature",
      sourceId: `c${i}`,
      receivedAt: new Date(Date.UTC(2026, 10, 1, 12, 0, 0) - i * 1000),
    }));
    const ancien = {
      ...LIGNE,
      key: "msg_ancien",
      receivedAt: new Date("2026-01-01T10:00:00Z"),
      contactName: "Message Ancien",
    };
    // Simule le tri + la troncature à `pageSize` de la vraie `listInbox`.
    listInbox.mockImplementation(async (f: { pageSize: number }) => ({
      rows: [...candidatures, ancien]
        .sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime())
        .slice(0, f.pageSize),
      truncated: false,
      failedChannels: [],
    }));
    const r = await listerSourcesPourQuiAction({ recherche: "" });
    expect("data" in r && r.data.map((x) => x.libelle)).toContain("Message Ancien");
  });

  it("un canal utile en panne : la liste est signalée incomplète, jamais présentée comme complète", async () => {
    listInbox.mockResolvedValue({ rows: [LIGNE], truncated: false, failedChannels: ["appel"] });
    const r = await listerSourcesPourQuiAction({ recherche: "" });
    expect("data" in r && r.note).toMatch(/incomplète.*appels réservés/);
  });

  it("liste tronquée : note claire", async () => {
    const messages = Array.from({ length: 100 }, (_, i) => ({
      ...LIGNE,
      key: `m${i}`,
      sourceId: `m${i}`,
    }));
    listInbox.mockResolvedValue({ rows: messages, truncated: true, failedChannels: [] });
    const r = await listerSourcesPourQuiAction({ recherche: "" });
    expect("data" in r && r.note).toMatch(/incomplète/);
  });

  it("truncated vrai à cause de 100 candidatures seules : aucune note", async () => {
    const cands = Array.from({ length: 100 }, (_, i) => ({
      ...LIGNE,
      key: `c${i}`,
      channel: "candidature",
      sourceId: `c${i}`,
    }));
    listInbox.mockResolvedValue({ rows: [LIGNE, ...cands], truncated: true, failedChannels: [] });
    const r = await listerSourcesPourQuiAction({ recherche: "" });
    expect("data" in r && r.note).toBeUndefined();
  });

  it("un canal sans rapport (candidature) en panne n'alarme pas", async () => {
    listInbox.mockResolvedValue({
      rows: [LIGNE],
      truncated: false,
      failedChannels: ["candidature"],
    });
    const r = await listerSourcesPourQuiAction({ recherche: "" });
    expect("data" in r && r.note).toBeUndefined();
  });

  it("appels ET messages illisibles : erreur claire, pas une liste vide", async () => {
    listInbox.mockResolvedValue({
      rows: [],
      truncated: false,
      failedChannels: ["appel", "message"],
    });
    const r = await listerSourcesPourQuiAction({ recherche: "" });
    expect("error" in r && r.error).toMatch(/n'a pas pu être lue/);
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
