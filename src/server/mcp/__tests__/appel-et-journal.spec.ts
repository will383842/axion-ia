import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `acces.ts` importe `@/auth` (next-auth) pour ses gardes de PAGE — hors sujet
// ici, et next-auth exige un `next/server` que vitest ne résout pas. Même
// simulation que `admin-calendly/__tests__/la-lecture-est-gardee-comme-l-ecriture.spec.ts`.
vi.mock("@/auth", () => ({ auth: async () => null }));
vi.mock("next/navigation", () => ({
  redirect: () => {
    throw new Error("redirect");
  },
}));

import { detectPii } from "@/lib/knowledge/pii-scan";

/**
 * **L'EXÉCUTION D'UN APPEL, ET LE JOURNAL QUI NE CONTIENT AUCUN CONTENU.**
 *
 * Les sources sont simulées SATURÉES de coordonnées : un e-mail dans chaque
 * objet, un téléphone dans chaque message, une adresse dans chaque note. Puis
 * chaque ligne écrite par le journal est passée à `detectPii` — le détecteur
 * du dépôt, pas une regex maison — et le test ANNONCE combien de lignes il a
 * scannées. Une ligne de journal vide de coordonnées sur zéro ligne ne prouve
 * rien : d'où le plancher.
 */

const EMAIL = "prospect.temoin@exemple-temoin.fr";
const TELEPHONE = "06 12 34 56 78";

const inboxMock = vi.hoisted(() => ({ listInbox: vi.fn() }));
vi.mock("@/features/admin-inbox/queries", () => ({
  listInbox: (...a: unknown[]) => inboxMock.listInbox(...a),
  PER_CHANNEL_FETCH: 100,
}));

const agendaMock = vi.hoisted(() => ({ getAgendaFenetre: vi.fn() }));
vi.mock("@/features/admin-agenda/queries", () => ({
  getAgendaFenetre: (...a: unknown[]) => agendaMock.getAgendaFenetre(...a),
}));

const rdvMock = vi.hoisted(() => ({ listRendezVous: vi.fn() }));
vi.mock("@/features/admin-rendezvous/queries", () => ({
  listRendezVous: (...a: unknown[]) => rdvMock.listRendezVous(...a),
  MAX_FETCH_CALENDLY: 2000,
}));

const hubMock = vi.hoisted(() => ({ getHubSignaux: vi.fn() }));
vi.mock("@/features/admin-planning/hub-queries", () => ({
  getHubSignaux: (...a: unknown[]) => hubMock.getHubSignaux(...a),
}));

const alertesMock = vi.hoisted(() => ({ listAlertes: vi.fn() }));
vi.mock("@/server/qualiopi/alertes/alertes-service", () => ({
  listAlertes: (...a: unknown[]) => alertesMock.listAlertes(...a),
}));

import { executerAppel, MARGE_DE_COMPACTION } from "../appel";
import { nomComplet } from "../contrat";
import { CLES_DU_JOURNAL, PREFIXE_DU_JOURNAL } from "../journal";
import { OUTILS } from "../registre";

const d = (iso: string) => new Date(iso);

const lignesDuJournal: string[] = [];
let espion: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  lignesDuJournal.length = 0;
  espion = vi.spyOn(console, "info").mockImplementation((...args: unknown[]) => {
    const texte = args.map(String).join(" ");
    if (texte.startsWith(PREFIXE_DU_JOURNAL)) lignesDuJournal.push(texte);
  });

  inboxMock.listInbox.mockResolvedValue({
    rows: [
      {
        key: "sub_s1",
        sourceId: "s1",
        channel: "message",
        receivedAt: d("2026-09-01T10:00:00Z"),
        subject: `Question de ${EMAIL} au ${TELEPHONE}`,
        contactName: `Jean Témoin <${EMAIL}>`,
        contactEmail: EMAIL,
        context: `rappeler au ${TELEPHONE}`,
        statusLabel: "Nouveau",
        needsAction: true,
        unread: false,
      },
    ],
    total: 1,
    page: 1,
    totalPages: 1,
    countsByChannel: { appel: 0, message: 1, candidature: 0, podcast: 0 },
    actionCount: 1,
    actionByChannel: { appel: 0, message: 1, candidature: 0, podcast: 0 },
    unreadByChannel: { appel: 0, message: 0, candidature: 0, podcast: 0 },
    truncated: false,
    failedChannels: [],
  });
  agendaMock.getAgendaFenetre.mockResolvedValue({
    items: [
      {
        key: "gg_1",
        source: "google",
        titre: `Appel ${EMAIL}`,
        debut: d("2026-09-02T08:00:00Z"),
        fin: d("2026-09-02T08:30:00Z"),
        journeeEntiere: false,
        occupe: true,
        jour: "2026-09-02",
        contact: null,
        telephone: null,
        lieu: `visio ${TELEPHONE}`,
        format: "visio",
        detailHref: null,
        googleEventId: null,
        note: `note ${EMAIL}`,
        annule: false,
      },
    ],
    diagnostics: {
      googleConfigure: true,
      googleOk: true,
      googleTronque: false,
      nbCalendly: 0,
      nbGoogle: 1,
    },
  });
  rdvMock.listRendezVous.mockResolvedValue({
    rows: [
      {
        key: "cal_1",
        source: "calendly",
        sourceRecordId: "evt-1",
        detailHref: "/x",
        title: "premier contact",
        startTime: d("2026-09-03T09:00:00Z"),
        endTime: d("2026-09-03T09:30:00Z"),
        timeConfirmed: true,
        dayKey: "2026-09-03",
        status: "scheduled",
        contactName: "Jean Témoin",
        contactEmail: EMAIL,
        contactPhone: TELEPHONE,
        location: null,
        format: "telephone",
        notes: `me joindre au ${TELEPHONE}`,
        createdAt: d("2026-09-01T00:00:00Z"),
      },
    ],
    total: 1,
  });
  hubMock.getHubSignaux.mockResolvedValue([
    {
      code: "session_non_staffee",
      niveau: "critique",
      titre: "Session sans formateur",
      explication: `contacter ${EMAIL}`,
      items: [{ label: `Session A — ${TELEPHONE}`, href: "/x/planning/1" }],
    },
  ]);
  alertesMock.listAlertes.mockResolvedValue([
    {
      id: "00000000-0000-4000-8000-000000000001",
      code: "opco_sans_accord",
      niveau: "important",
      titre: `Accord OPCO manquant — ${EMAIL}`,
      message: `relancer ${TELEPHONE}`,
      cibleType: "TrainingSession",
      cibleId: "00000000-0000-4000-8000-000000000002",
      lu: false,
      resolue: false,
      resolueAt: null,
      notifiedAt: null,
      metadata: {},
      createdAt: d("2026-09-01T00:00:00Z"),
      updatedAt: d("2026-09-01T00:00:00Z"),
    },
  ]);
});

afterEach(() => {
  espion.mockRestore();
});

const ARGUMENTS_PAR_OUTIL: Record<string, unknown> = {
  "inbox.recent": { limite: 5 },
  "agenda.jour": { jour: "2026-09-02" },
  "agenda.semaine": { depuis: "2026-09-02" },
  "rendezvous.list": { statut: "scheduled" },
  "pilotage.alertes": { annee: 2026, mois: 9 },
  "qualiopi.conformite": { niveau: "important" },
};

describe("executerAppel — les six outils répondent, en sortie standard", () => {
  it("rend items + meta pour chacun, avec les coordonnées masquées (W-6 par défaut)", async () => {
    let reussis = 0;
    for (const outil of OUTILS) {
      const res = await executerAppel(nomComplet(outil.name), ARGUMENTS_PAR_OUTIL[outil.name], {});
      expect(res.ok, `${outil.name} : ${JSON.stringify(res)}`).toBe(true);
      if (!res.ok) continue;
      const sortie = res.sortie as { items: unknown[]; meta: { failedSources: string[] } };
      expect(Array.isArray(sortie.items)).toBe(true);
      expect(sortie.meta.failedSources).toEqual([]);
      reussis += 1;
    }
    console.info(`[appel] ${String(reussis)} outil(s) exécuté(s) avec succès`);
    expect(reussis).toBe(OUTILS.length);

    // Le pont d'identité : la lecture rendez-vous masque contact et notes.
    const rdv = await executerAppel(nomComplet("rendezvous.list"), {}, {});
    expect(rdv.ok).toBe(true);
    if (rdv.ok) {
      const item = (rdv.sortie as { items: { contact: unknown; notes: unknown }[] }).items[0];
      expect(item?.contact).toBeNull();
      expect(item?.notes).toBeNull();
    }
    // Et la boîte de réception a été appelée SANS habilitation, pas avec la valeur inverse.
    expect(inboxMock.listInbox).toHaveBeenCalledWith(
      expect.objectContaining({ peutVoirAppels: false }),
    );
  });

  it("refuse un outil inconnu, une entrée hors schéma, un nom réservé dans l'entrée", async () => {
    const inconnu = await executerAppel("axionia.n.existe.pas", {}, {});
    expect(inconnu.ok).toBe(false);
    if (!inconnu.ok) expect(inconnu.code).toBe("tool_not_found");

    const horsSchema = await executerAppel(nomComplet("inbox.recent"), { limite: 999 }, {});
    expect(horsSchema.ok).toBe(false);
    if (!horsSchema.ok) {
      expect(horsSchema.code).toBe("invalid_input");
      expect(horsSchema.details?.[0]?.chemin).toBe("limite");
    }

    // Un champ d'autorisation glissé dans la charge utile est un REFUS visible.
    const autorisation = await executerAppel(
      nomComplet("inbox.recent"),
      { peutVoirAppels: true },
      {},
    );
    expect(autorisation.ok).toBe(false);
    if (!autorisation.ok) expect(autorisation.code).toBe("invalid_input");
    expect(inboxMock.listInbox).not.toHaveBeenCalled();
  });

  it("une source en panne rend upstream_unavailable — SANS le message de la source", async () => {
    inboxMock.listInbox.mockRejectedValue(new Error(`ECONNREFUSED vers ${EMAIL}`));
    const res = await executerAppel(nomComplet("inbox.recent"), {}, {});
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe("upstream_unavailable");
      expect(res.message).not.toContain(EMAIL);
    }
  });

  it(`refuse au-delà de ${String(MARGE_DE_COMPACTION)} × maxBytes — ce qu'aucune compaction ne rattrape`, async () => {
    const enorme = "x".repeat(8_000);
    inboxMock.listInbox.mockResolvedValue({
      rows: Array.from({ length: 30 }, (_, i) => ({
        key: `k${String(i)}`,
        sourceId: `s${String(i)}`,
        channel: "message",
        receivedAt: d("2026-09-01T10:00:00Z"),
        subject: enorme,
        contactName: null,
        contactEmail: null,
        context: null,
        statusLabel: "Nouveau",
        needsAction: false,
        unread: false,
      })),
      total: 30,
      page: 1,
      totalPages: 1,
      countsByChannel: { appel: 0, message: 30, candidature: 0, podcast: 0 },
      actionCount: 0,
      actionByChannel: { appel: 0, message: 0, candidature: 0, podcast: 0 },
      unreadByChannel: { appel: 0, message: 0, candidature: 0, podcast: 0 },
      truncated: false,
      failedChannels: [],
    });
    const res = await executerAppel(nomComplet("inbox.recent"), { limite: 30 }, {});
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("result_too_large");
  });
});

describe("le journal ne contient aucun contenu — dérivé de detectPii, et il annonce son compte", () => {
  it("après succès, refus et pannes sur des sources saturées de coordonnées", async () => {
    for (const outil of OUTILS) {
      await executerAppel(nomComplet(outil.name), ARGUMENTS_PAR_OUTIL[outil.name], {
        requestId: "req-temoin",
        principal: "socle-temoin",
      });
    }
    await executerAppel("axionia.inconnu", { objet: EMAIL }, {});
    await executerAppel(nomComplet("inbox.recent"), { canal: EMAIL }, {});
    inboxMock.listInbox.mockRejectedValue(new Error(`panne chez ${EMAIL} ${TELEPHONE}`));
    await executerAppel(nomComplet("inbox.recent"), {}, {});

    const PLANCHER = OUTILS.length + 3;
    console.info(`[journal] ${String(lignesDuJournal.length)} ligne(s) scannée(s) par detectPii`);
    expect(lignesDuJournal.length).toBeGreaterThanOrEqual(PLANCHER);

    for (const ligne of lignesDuJournal) {
      const scan = detectPii(ligne);
      expect(scan.hasPii, `fuite dans le journal : ${ligne}`).toBe(false);
      expect(ligne).not.toContain(EMAIL);
      expect(ligne).not.toContain("Jean");
      // Et seules les clés autorisées : une clé de plus serait un contenu de plus.
      const objet = JSON.parse(ligne.slice(PREFIXE_DU_JOURNAL.length)) as Record<string, unknown>;
      expect(Object.keys(objet).sort()).toEqual([...CLES_DU_JOURNAL].sort());
    }
    // Les codes de refus apparaissent bien — le journal est un invariant de sortie.
    const codes = lignesDuJournal.map(
      (l) => (JSON.parse(l.slice(PREFIXE_DU_JOURNAL.length)) as { code: string }).code,
    );
    expect(codes).toContain("tool_not_found");
    expect(codes).toContain("invalid_input");
    expect(codes).toContain("upstream_unavailable");
    expect(codes.filter((c) => c === "ok")).toHaveLength(OUTILS.length);
  });

  it("detectPii voit bien les coordonnées des jeux simulés — sinon le test précédent ne mesure rien", () => {
    // Témoin de NON-VACUITÉ du détecteur sur nos propres données.
    expect(detectPii(`objet ${EMAIL}`).hasPii).toBe(true);
    expect(detectPii(`rappeler au ${TELEPHONE}`).hasPii).toBe(true);
  });
});
