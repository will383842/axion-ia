import { beforeEach, describe, expect, it, vi } from "vitest";

// `acces.ts` importe `@/auth` (next-auth) pour ses gardes de PAGE — hors sujet
// ici, et next-auth exige un `next/server` que vitest ne résout pas. Même
// simulation que `admin-calendly/__tests__/la-lecture-est-gardee-comme-l-ecriture.spec.ts`.
vi.mock("@/auth", () => ({ auth: async () => null }));
vi.mock("next/navigation", () => ({
  redirect: () => {
    throw new Error("redirect");
  },
}));

/**
 * **CE QUE CHAQUE OUTIL REND, CONFRONTÉ À L'ÉCRAN QU'IL DOUBLE.**
 *
 * Le critère de fin du lot 4b, pour la boîte de réception : « inbox.recent
 * rend le même nombre d'éléments et les mêmes identifiants que l'écran, pour
 * le même rôle console ». Ici l'écran est `listInbox` LUI-MÊME — la fonction
 * que la page appelle —, exercé sur les mêmes lectures simulées que le test de
 * la boîte, puis comparé à la sortie de l'outil. Si l'habilitation diverge
 * (l'outil masque, l'écran non, ou l'inverse), les identifiants du canal
 * « appel » ne coïncident plus et le test rougit.
 */

const listSubmissionsMock = vi.fn();
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
  MAX_FETCH_CALENDLY: 2000,
}));
const podcastFindManyMock = vi.fn();
const readsFindManyMock = vi.fn();
const alertesFindManyMock = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    podcastRequest: { findMany: (...a: unknown[]) => podcastFindManyMock(...a) },
    adminInboxRead: { findMany: (...a: unknown[]) => readsFindManyMock(...a) },
    alerteSysteme: { findMany: (...a: unknown[]) => alertesFindManyMock(...a) },
  },
}));
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: string) => `clair:${v}` }));
vi.mock("@/lib/admin-path", () => ({ adminPath: (_l: string, p: string) => `/fr/adm/${p}` }));
const getAgendaFenetreMock = vi.fn();
vi.mock("@/features/admin-agenda/queries", () => ({
  getAgendaFenetre: (...a: unknown[]) => getAgendaFenetreMock(...a),
}));
const getHubSignauxMock = vi.fn();
vi.mock("@/features/admin-planning/hub-queries", () => ({
  getHubSignaux: (...a: unknown[]) => getHubSignauxMock(...a),
}));

import { ROLES_APPELS } from "@/features/admin-calendly/acces";
import { peutOuvrirDossierCandidat } from "@/server/auth/habilitations";
import { listInbox, PER_CHANNEL_FETCH } from "@/features/admin-inbox/queries";

import { contexteDAppel, habilitationsDeLAdaptateur, ROLE_DE_L_ADAPTATEUR } from "../identite";
import { agendaJour, agendaSemaine } from "../outils/agenda";
import { inboxRecent } from "../outils/inbox-recent";
import { pilotageAlertes } from "../outils/pilotage-alertes";
import { qualiopiConformite } from "../outils/qualiopi-conformite";
import { rendezVousList } from "../outils/rendezvous-list";

const d = (iso: string) => new Date(iso);
const ctx = () =>
  contexteDAppel({ requestId: "req-1", principal: "socle" }, d("2026-09-02T04:00:00Z"));

function rdv(i: number, contactName: string | null = null) {
  return {
    key: `cal_${String(i)}`,
    source: "calendly",
    sourceRecordId: `evt-${String(i)}`,
    detailHref: "/fr/adm/contacts/appels/x",
    title: "premier-contact",
    contactName,
    contactEmail: null,
    contactPhone: null,
    timeConfirmed: true,
    startTime: d(`2026-09-0${String((i % 7) + 1)}T09:00:00Z`),
    endTime: d(`2026-09-0${String((i % 7) + 1)}T09:30:00Z`),
    dayKey: `2026-09-0${String((i % 7) + 1)}`,
    status: "scheduled",
    location: null,
    format: "telephone",
    notes: "note privée",
    createdAt: d("2026-09-01T08:00:00Z"),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  readsFindManyMock.mockResolvedValue([]);
  podcastFindManyMock.mockResolvedValue([]);
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
        submittedAt: d("2026-08-30T10:00:00Z"),
        replyCount: 0,
      },
      {
        id: "s2",
        type: "contact",
        unifiedType: "presse",
        status: "replied",
        contactName: "Autre",
        contactEmail: "a@media.fr",
        companyName: "Média 2",
        submittedAt: d("2026-08-29T10:00:00Z"),
        replyCount: 1,
      },
    ],
  });
  listApplicationsMock.mockResolvedValue({
    items: [
      {
        id: "a1",
        contactName: "Candidat",
        contactEmail: "c@x.fr",
        jobTitle: "Formateur",
        status: "new",
        submittedAt: d("2026-08-31T10:00:00Z"),
      },
    ],
  });
  listRendezVousMock.mockResolvedValue({ rows: [rdv(1), rdv(2)], total: 2 });
});

describe("inbox.recent — comparaison contradictoire avec l'écran, pour le même rôle", () => {
  it("rend le même nombre d'éléments et les mêmes identifiants que listInbox", async () => {
    const habilitations = habilitationsDeLAdaptateur();
    const ecran = await listInbox({ page: 1, pageSize: 25, adminUserId: null, ...habilitations });
    const outil = await inboxRecent.handler({ page: 1, limite: 25 }, ctx());

    const idsEcran = ecran.rows.map((r) => `${r.channel}:${r.sourceId}`);
    const idsOutil = outil.items.map((it) => `${it.canal}:${it.id}`);
    console.info(
      `[inbox] écran ${String(idsEcran.length)} · outil ${String(idsOutil.length)} · ` +
        `rôle ${ROLE_DE_L_ADAPTATEUR} (peutVoirAppels=${String(habilitations.peutVoirAppels)})`,
    );
    expect(idsOutil).toEqual(idsEcran);
    expect(outil.items.length).toBeGreaterThanOrEqual(4);
    expect(outil.synthese.total).toBe(ecran.total);
    expect(outil.synthese.aAgirParCanal).toEqual(ecran.actionByChannel);
    // Aucun lien de console, aucune adresse : les clés de chaque élément sont fermées.
    for (const it of outil.items) {
      expect(Object.keys(it).sort()).toEqual(
        ["aAgir", "canal", "contact", "contexte", "id", "objet", "recuLe", "statut"].sort(),
      );
    }
  });

  it("un canal en panne apparaît dans failedSources — pas comme un canal vide", async () => {
    listApplicationsMock.mockRejectedValue(new Error("table absente"));
    const erreur = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const sortie = await inboxRecent.handler({}, ctx());
    erreur.mockRestore();
    expect(sortie.meta.failedSources).toEqual(["candidature"]);
    expect(sortie.items.some((it) => it.canal === "candidature")).toBe(false);
    expect(sortie.items.length).toBeGreaterThan(0);
  });

  it("la fenêtre de 100 par canal remonte en sourceIncomplete, DISTINCT de truncated", async () => {
    listSubmissionsMock.mockResolvedValue({
      items: Array.from({ length: PER_CHANNEL_FETCH }, (_, i) => ({
        id: `s${String(i)}`,
        type: "contact",
        unifiedType: "presse",
        status: "new",
        contactName: null,
        contactEmail: null,
        companyName: null,
        submittedAt: d("2026-08-30T10:00:00Z"),
        replyCount: 0,
      })),
    });
    const sortie = await inboxRecent.handler({ limite: 10 }, ctx());
    expect(sortie.meta.sourceIncomplete).toBe(true);
    expect(sortie.meta.sourceNote).toContain(String(PER_CHANNEL_FETCH));
    expect(sortie.meta.truncated).toBe(false);
    expect(sortie.meta.hasMore).toBe(true);
    expect(sortie.items).toHaveLength(10);
  });
});

describe("agenda.jour / agenda.semaine — la fenêtre est celle de Paris, et la source est décrite", () => {
  const diag = {
    googleConfigure: true,
    googleOk: true,
    googleTronque: false,
    nbCalendly: 0,
    nbGoogle: 0,
  };

  it("un jour = de minuit à minuit, heure de Paris (CEST = UTC+2 en septembre)", async () => {
    getAgendaFenetreMock.mockResolvedValue({ items: [], diagnostics: diag });
    await agendaJour.handler({ jour: "2026-09-02" }, ctx());
    const [debut, fin, peutVoir] = getAgendaFenetreMock.mock.calls[0] as [Date, Date, boolean];
    expect(debut.toISOString()).toBe("2026-09-01T22:00:00.000Z");
    expect(fin.toISOString()).toBe("2026-09-02T22:00:00.000Z");
    expect(peutVoir).toBe(false);
  });

  it("une semaine = sept jours, et elle franchit la fin du mois", async () => {
    getAgendaFenetreMock.mockResolvedValue({ items: [], diagnostics: diag });
    await agendaSemaine.handler({ depuis: "2026-09-28" }, ctx());
    const [debut, fin] = getAgendaFenetreMock.mock.calls[0] as [Date, Date];
    expect(debut.toISOString()).toBe("2026-09-27T22:00:00.000Z");
    expect(fin.toISOString()).toBe("2026-10-04T22:00:00.000Z");
  });

  it("Google en panne → failedSources ; Google tronqué → sourceIncomplete ; non configuré → note", async () => {
    getAgendaFenetreMock.mockResolvedValue({
      items: [],
      diagnostics: { ...diag, googleOk: false, googleRaison: "401" },
    });
    expect((await agendaJour.handler({ jour: "2026-09-02" }, ctx())).meta.failedSources).toEqual([
      "google",
    ]);

    getAgendaFenetreMock.mockResolvedValue({
      items: [],
      diagnostics: { ...diag, googleTronque: true },
    });
    const tronque = await agendaJour.handler({ jour: "2026-09-02" }, ctx());
    expect(tronque.meta.sourceIncomplete).toBe(true);
    expect(tronque.meta.failedSources).toEqual([]);

    getAgendaFenetreMock.mockResolvedValue({
      items: [],
      diagnostics: { ...diag, googleConfigure: false },
    });
    const sans = await agendaJour.handler({ jour: "2026-09-02" }, ctx());
    expect(sans.meta.failedSources).toEqual([]);
    expect(sans.meta.sourceNote).toMatch(/non configuré/);
  });
});

describe("rendezvous.list — masquage W-6 et plafond de la source", () => {
  it("masque contact et notes, garde le titre, et ne porte aucun lien", async () => {
    listRendezVousMock.mockResolvedValue({ rows: [rdv(1, "Jean Témoin")], total: 1 });
    const sortie = await rendezVousList.handler({}, ctx());
    expect(sortie.items[0]?.contact).toBeNull();
    expect(sortie.items[0]?.notes).toBeNull();
    expect(sortie.items[0]?.titre).toBe("premier-contact");
    expect(Object.keys(sortie.items[0] ?? {})).not.toContain("detailHref");
  });

  it("déclare sourceIncomplete quand le total atteint le plafond de lecture", async () => {
    listRendezVousMock.mockResolvedValue({ rows: [rdv(1)], total: 2000 });
    const sortie = await rendezVousList.handler({ limite: 1 }, ctx());
    expect(sortie.meta.sourceIncomplete).toBe(true);
    expect(sortie.meta.hasMore).toBe(true);
    expect(listRendezVousMock).toHaveBeenCalledWith({ page: 1, pageSize: 1 });
  });
});

describe("pilotage.alertes — les signaux, sans leurs liens", () => {
  it("garde code, niveau, titre, explication, et les libellés seuls", async () => {
    getHubSignauxMock.mockResolvedValue([
      {
        code: "conflit_formateur",
        niveau: "attention",
        titre: "Conflit",
        explication: "deux sessions",
        items: [{ label: "Session A", href: "/x/planning/a" }],
      },
    ]);
    const sortie = await pilotageAlertes.handler({ annee: 2026, mois: 9 }, ctx());
    expect(sortie.items[0]?.elements).toEqual([{ libelle: "Session A" }]);
    expect(sortie.items[0]?.nombre).toBe(1);
    expect(JSON.stringify(sortie)).not.toContain("href");
    expect(getHubSignauxMock.mock.calls[0]?.[0]).toBe(2026);
    expect(getHubSignauxMock.mock.calls[0]?.[1]).toBe(9);
  });
});

describe("qualiopi.conformite — la lecture persistée, et hasMore par la ligne de trop", () => {
  const alerte = (i: number) => ({
    id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
    code: "opco_sans_accord",
    niveau: "important",
    titre: "Accord OPCO manquant",
    message: "relancer",
    cibleType: "TrainingSession",
    cibleId: "00000000-0000-4000-8000-000000000999",
    lu: false,
    resolue: false,
    resolueAt: null,
    notifiedAt: null,
    metadata: {},
    createdAt: d("2026-09-01T00:00:00Z"),
    updatedAt: d("2026-09-01T00:00:00Z"),
  });

  it("demande limite + 1 lignes à la source, n'en rend que limite, et pose hasMore", async () => {
    alertesFindManyMock.mockResolvedValue([alerte(1), alerte(2), alerte(3)]);
    const sortie = await qualiopiConformite.handler({ limite: 2 }, ctx());
    expect(sortie.items).toHaveLength(2);
    expect(sortie.meta.hasMore).toBe(true);
    expect(alertesFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ take: 3, where: { resolue: false } }),
    );
    expect(sortie.items[0]?.cible).toEqual({
      type: "TrainingSession",
      id: "00000000-0000-4000-8000-000000000999",
    });
  });
});

describe("le pont d'identité — W-6 par défaut", () => {
  it("le rôle de l'adaptateur est hors de ROLES_APPELS, donc peutVoirAppels vaut false", () => {
    expect(ROLES_APPELS as readonly string[]).not.toContain(ROLE_DE_L_ADAPTATEUR);
    expect(habilitationsDeLAdaptateur()).toEqual({
      peutVoirAppels: false,
      roleConsole: ROLE_DE_L_ADAPTATEUR,
    });
    // 🔑 Et le rôle transmis n'ouvre PAS le dossier de candidat : c'est la
    //    lecture qui applique le prédicat, mais la valeur se vérifie ici.
    expect(peutOuvrirDossierCandidat(ROLE_DE_L_ADAPTATEUR)).toBe(false);
    const c = contexteDAppel({}, d("2026-09-02T04:00:00Z"));
    expect(c.principal).toBe("socle");
    expect(c.requestId).toMatch(/^local-/);
    expect(c.deadline.getTime()).toBeGreaterThan(d("2026-09-02T04:00:00Z").getTime());
  });
});
