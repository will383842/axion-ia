// Tests de la boîte de réception unifiée (refonte 2026-07-29).
//
// La vue « Tout » agrège 4 canaux hétérogènes. Trois propriétés font sa valeur
// et méritent d'être verrouillées :
//   1. la CHRONOLOGIE est le seul ordre — un tri par source la rendrait inutile ;
//   2. un canal en panne ne doit pas vider la boîte entière ;
//   3. la troncature doit être signalée, jamais silencieuse.

import { describe, it, expect, vi, beforeEach } from "vitest";

const listSubmissionsMock = vi.fn();
// ⚠️ ON SIMULE LA LECTURE, PAS L ACTION. Depuis le lot 4a, `listInbox` appelle
//    `reads.listSubmissions` — la lecture SANS session — parce que l action
//    commence par `auth()`, qui lit un cookie de navigateur qu un appel MCP n a
//    pas. Simuler l ancien chemin rendrait ce test VERT sur du code mort.
vi.mock("@/features/admin-submissions/reads", () => ({
  listSubmissions: (...a: unknown[]) => listSubmissionsMock(...a),
}));

const listApplicationsMock = vi.fn();
vi.mock("@/features/admin-job-applications/reads", () => ({
  listApplications: (...a: unknown[]) => listApplicationsMock(...a),
}));

const listRendezVousMock = vi.fn();
vi.mock("@/features/admin-rendezvous/queries", () => ({
  listRendezVous: (...a: unknown[]) => listRendezVousMock(...a),
}));

const podcastFindManyMock = vi.fn();
const readsFindManyMock = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    podcastRequest: { findMany: (...a: unknown[]) => podcastFindManyMock(...a) },
    adminInboxRead: { findMany: (...a: unknown[]) => readsFindManyMock(...a) },
  },
}));

vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: string) => `clair:${v}` }));
vi.mock("@/lib/admin-path", () => ({
  adminPath: (_locale: string, p: string) => `/fr/adm/${p}`,
}));

import { listInbox, PER_CHANNEL_FETCH } from "../queries";

const d = (iso: string) => new Date(iso);

beforeEach(() => {
  vi.clearAllMocks();
  readsFindManyMock.mockResolvedValue([]);
  listSubmissionsMock.mockResolvedValue({
    items: [
      {
        id: "s1",
        type: "contact",
        unifiedType: "presse",
        status: "new",
        contactName: "Journaliste",
        contactEmail: "j@media.fr",
        companyName: "Le Média",
        submittedAt: d("2026-07-20T10:00:00Z"),
        replyCount: 0,
      },
    ],
  });
  listRendezVousMock.mockResolvedValue({
    rows: [
      {
        key: "cal_1",
        // `sourceRecordId` est l'id BRUT en base — c'est lui la clé d'accusé de
        // lecture, pas `key` qui est namespacée pour l'affichage.
        sourceRecordId: "cal_1",
        detailHref: "/fr/adm/contacts/appels/cal1",
        title: "premier-contact",
        contactName: null,
        contactEmail: null,
        timeConfirmed: false,
        startTime: null,
        dayKey: "2026-07-25",
        status: "scheduled",
        createdAt: d("2026-07-25T08:00:00Z"),
      },
    ],
  });
  listApplicationsMock.mockResolvedValue({
    items: [
      {
        id: "a1",
        contactName: "Candidat",
        contactEmail: "c@x.fr",
        offerTitleSnap: "Développeur web",
        status: "new",
        needsAttention: false,
        submittedAt: d("2026-07-22T12:00:00Z"),
      },
    ],
  });
  podcastFindManyMock.mockResolvedValue([
    {
      id: "p1",
      companyName: "ACME",
      leaderName: "enc-nom",
      email: "enc-mail",
      city: "Grenoble",
      status: "new",
      createdAt: d("2026-07-18T09:00:00Z"),
    },
  ]);
});

describe("listInbox", () => {
  it("fusionne les 4 canaux dans l'ordre chronologique inverse", async () => {
    const res = await listInbox();
    expect(res.rows.map((r) => r.channel)).toEqual([
      "appel", // 25/07
      "candidature", // 22/07
      "message", // 20/07
      "podcast", // 18/07
    ]);
    expect(res.total).toBe(4);
    expect(res.countsByChannel).toEqual({ appel: 1, message: 1, candidature: 1, podcast: 1 });
  });

  it("déchiffre les PII du canal podcast", async () => {
    const res = await listInbox({ channel: "podcast" });
    expect(res.rows[0]?.contactName).toBe("clair:enc-nom");
    expect(res.rows[0]?.contactEmail).toBe("clair:enc-mail");
    expect(res.rows[0]?.context).toBe("ACME · Grenoble");
  });

  it("chaque ligne pointe vers la fiche native de son canal", async () => {
    const res = await listInbox();
    const byChannel = Object.fromEntries(res.rows.map((r) => [r.channel, r.detailHref]));
    expect(byChannel["appel"]).toBe("/fr/adm/contacts/appels/cal1");
    expect(byChannel["message"]).toBe("/fr/adm/contacts/messages/s1");
    expect(byChannel["candidature"]).toBe("/fr/adm/contacts/candidatures/a1");
    expect(byChannel["podcast"]).toBe("/fr/adm/podcast/p1");
  });

  it("le filtre par canal ne fausse pas les compteurs globaux", async () => {
    const res = await listInbox({ channel: "message" });
    expect(res.rows).toHaveLength(1);
    // Les onglets doivent continuer d'afficher le volume réel de chaque canal.
    expect(res.countsByChannel.appel).toBe(1);
  });

  it("« à traiter » retient l'appel sans contact et le message sans réponse", async () => {
    const res = await listInbox({ onlyAction: true });
    expect(res.rows.map((r) => r.channel).sort()).toEqual(["appel", "message", "podcast"]);
    expect(res.actionCount).toBe(3);
  });

  // Un canal qui throw (PII corrompues, table absente) ne doit pas faire
  // disparaître les trois autres : la boîte reste utilisable, dégradée.
  it("un canal en échec n'emporte pas les autres", async () => {
    listApplicationsMock.mockRejectedValueOnce(new Error("boom"));
    const res = await listInbox();
    expect(res.total).toBe(3);
    expect(res.rows.some((r) => r.channel === "candidature")).toBe(false);
  });

  // ── Régression 2026-07-29 (constatée EN PRODUCTION, pas par ces tests) ────
  //
  // `listInbox` passait `pageSize: 200` alors que `listSubmissions` et
  // `listApplications` valident `pageSize.max(100)` : le `.parse()` Zod
  // levait, `Promise.allSettled` avalait l'erreur, et la boîte affichait
  // « Message 0 » en permanence — sans la moindre alerte. Les mocks de ce
  // fichier acceptent n'importe quel argument, donc rien ne pouvait le voir.
  // On verrouille donc l'ARGUMENT, pas seulement le résultat.
  it("ne demande jamais plus de 100 éléments par canal (borne Zod des actions)", async () => {
    await listInbox();
    for (const mock of [listSubmissionsMock, listApplicationsMock]) {
      const arg = mock.mock.calls[0]?.[0] as { pageSize?: number } | undefined;
      expect(arg?.pageSize, "pageSize absent").toBeDefined();
      expect(arg?.pageSize).toBeGreaterThanOrEqual(10);
      expect(arg?.pageSize).toBeLessThanOrEqual(100);
    }
  });

  // Un canal muet doit se distinguer d'un canal vide : c'est précisément cette
  // confusion qui a laissé le bug ci-dessus survivre à un déploiement.
  it("remonte le canal en échec dans failedChannels", async () => {
    listSubmissionsMock.mockRejectedValueOnce(new Error("zod: pageSize too big"));
    const res = await listInbox();
    expect(res.failedChannels).toEqual(["message"]);
    expect(res.countsByChannel.message).toBe(0);
  });

  // Non-lu (2026-07-29) — état PAR ADMIN, absence de ligne = non lu.
  it("tout est non lu quand aucun accusé de lecture n'existe", async () => {
    const res = await listInbox({ adminUserId: "admin-1" });
    expect(res.rows.every((r) => r.unread)).toBe(true);
    expect(res.unreadByChannel).toEqual({ appel: 1, message: 1, candidature: 1, podcast: 1 });
  });

  it("une entrée déjà ouverte n'est plus signalée non lue", async () => {
    readsFindManyMock.mockResolvedValueOnce([{ entityType: "submission", entityId: "s1" }]);
    const res = await listInbox({ adminUserId: "admin-1" });
    expect(res.rows.find((r) => r.channel === "message")?.unread).toBe(false);
    expect(res.rows.find((r) => r.channel === "appel")?.unread).toBe(true);
    expect(res.unreadByChannel.message).toBe(0);
  });

  // Le badge compte ce qu'il RESTE À FAIRE (décision Will) — donc `needsAction`,
  // pas le volume, et pas le non-lu : on peut avoir lu sans avoir traité.
  it("actionByChannel compte le à-traiter, indépendamment du lu/non-lu", async () => {
    readsFindManyMock.mockResolvedValueOnce([{ entityType: "calendly_event", entityId: "cal_1" }]);
    const res = await listInbox({ adminUserId: "admin-1" });
    expect(res.actionByChannel).toEqual({ appel: 1, message: 1, candidature: 0, podcast: 1 });
    expect(res.rows.find((r) => r.channel === "appel")?.unread).toBe(false);
  });

  it("sans admin identifié : rien n'est marqué non lu à tort", async () => {
    const res = await listInbox({});
    expect(readsFindManyMock).not.toHaveBeenCalled();
    expect(res.rows.every((r) => r.unread)).toBe(true);
  });

  it("failedChannels est vide quand tout va bien", async () => {
    expect((await listInbox()).failedChannels).toEqual([]);
  });

  it("nomme le bon canal, pas celui d'à côté (alignement de l'ordre des lectures)", async () => {
    podcastFindManyMock.mockRejectedValueOnce(new Error("db down"));
    expect((await listInbox()).failedChannels).toEqual(["podcast"]);
  });

  it("signale la troncature quand un canal sature la fenêtre de lecture", async () => {
    podcastFindManyMock.mockResolvedValueOnce(
      Array.from({ length: PER_CHANNEL_FETCH }, (_, i) => ({
        id: `p${i}`,
        companyName: "ACME",
        leaderName: "n",
        email: "e",
        city: "Lyon",
        status: "archived",
        createdAt: d("2026-07-01T00:00:00Z"),
      })),
    );
    const res = await listInbox();
    expect(res.truncated).toBe(true);
  });

  it("ne signale rien quand tout tient dans la fenêtre", async () => {
    expect((await listInbox()).truncated).toBe(false);
  });

  it("pagine sans perdre le total", async () => {
    const res = await listInbox({ page: 2, pageSize: 3 });
    expect(res.total).toBe(4);
    expect(res.totalPages).toBe(2);
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0]?.channel).toBe("podcast");
  });
});
