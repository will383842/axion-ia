import { beforeEach, describe, expect, it, vi } from "vitest";

// Lot L3a (B3) : alerte INTERNE (jamais à l'apporteur) quand une facture est payée à 100 % depuis
// plus de ALERTE_REALISATION_JOURS et que la prestation n'est pas marquée réalisée. Une seule
// alerte par commission. Ce délai porte sur la diligence d'Axion, pas sur l'apporteur.

const etat = vi.hoisted(() => ({
  lignes: [] as Array<Record<string, unknown>>,
  factures: {} as Record<string, Date | null>,
  mails: [] as Array<{ gabarit: string; jobId: string; payload: Record<string, unknown> }>,
  deja: new Set<string>(),
}));

vi.mock("@/lib/destinataires-internes", () => ({
  destinataireAlertesInternes: () => "alertes@exemple.fr",
}));
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: vi.fn(
    async (
      gabarit: string,
      _d: string,
      _l: string,
      payload: Record<string, unknown>,
      o: { jobId: string },
    ) => {
      etat.mails.push({ gabarit, jobId: o.jobId, payload });
      etat.deja.add(o.jobId);
      return { enqueued: true };
    },
  ),
}));
vi.mock("../commissions", () => ({ dejaEnvoye: async (j: string) => etat.deja.has(j) }));
vi.mock("../litige", () => ({ litigeDisponible: async () => true }));
vi.mock("../realisation", async (orig) => ({
  ...(await orig<typeof import("../realisation")>()),
  realisationDisponible: async () => true,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    commissionApporteur: {
      findMany: vi.fn(async (a: { where: Record<string, unknown> }) =>
        etat.lignes.filter(
          (l) =>
            (a.where["statut"] as { in: string[] }).in.includes(l["statut"] as string) &&
            l["prestationRealiseeAt"] === null &&
            (a.where["litigeDepuis"] === undefined || l["litigeDepuis"] == null),
        ),
      ),
    },
    factureFormation: {
      findMany: vi.fn(async (a: { where: { id: { in: string[] } } }) =>
        a.where.id.in.map((id) => ({ id, paidAt: etat.factures[id] ?? null })),
      ),
    },
  },
}));

import { ALERTE_REALISATION_JOURS } from "../regles";
import { alerterRealisationsEnAttente } from "../realisations-en-attente";

const MAINTENANT = new Date("2026-12-01T09:00:00Z");
const ilYa = (jours: number) => new Date(MAINTENANT.getTime() - jours * 86_400_000);

function ligne(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    apporteurId: "app-1",
    factureId: `F-${id}`,
    statut: "due",
    prestationRealiseeAt: null,
    creeAt: ilYa(1),
    ...extra,
  };
}

beforeEach(() => {
  etat.lignes = [];
  etat.factures = {};
  etat.mails = [];
  etat.deja = new Set();
});

describe("alerte « payée à 100 %, prestation non réalisée »", () => {
  it("la constante vaut 60 jours", () => {
    expect(ALERTE_REALISATION_JOURS).toBe(60);
  });

  it("payée depuis 59 jours : rien", async () => {
    etat.lignes = [ligne("c1")];
    etat.factures = { "F-c1": ilYa(59) };
    expect(await alerterRealisationsEnAttente(MAINTENANT)).toBe(0);
    expect(etat.mails).toHaveLength(0);
  });

  it("payée depuis 60 jours : une alerte interne", async () => {
    etat.lignes = [ligne("c1")];
    etat.factures = { "F-c1": ilYa(60) };
    expect(await alerterRealisationsEnAttente(MAINTENANT)).toBe(1);
    expect(etat.mails).toHaveLength(1);
    expect(etat.mails[0]).toMatchObject({
      gabarit: "qualiopi-alerte-interne",
      jobId: "apporteur-realisation-en-attente-c1",
    });
    expect(etat.mails[0]!.payload).toMatchObject({ code: "apporteur_realisation_en_attente" });
  });

  it("deuxième passage : pas de seconde alerte", async () => {
    etat.lignes = [ligne("c1")];
    etat.factures = { "F-c1": ilYa(75) };
    expect(await alerterRealisationsEnAttente(MAINTENANT)).toBe(1);
    expect(await alerterRealisationsEnAttente(MAINTENANT)).toBe(0);
    expect(etat.mails).toHaveLength(1);
  });

  it("prestation déjà réalisée, ou commission suspendue (contestation) : rien", async () => {
    etat.lignes = [
      ligne("c1", { prestationRealiseeAt: ilYa(10) }),
      ligne("c2", { litigeDepuis: ilYa(5) }),
      ligne("c3", { statut: "versee" }),
    ];
    etat.factures = { "F-c1": ilYa(90), "F-c2": ilYa(90), "F-c3": ilYa(90) };
    expect(await alerterRealisationsEnAttente(MAINTENANT)).toBe(0);
  });

  it("aucune alerte n'est adressée à l'apporteur (aucun gabarit apporteur-*)", async () => {
    etat.lignes = [ligne("c1"), ligne("c2")];
    etat.factures = { "F-c1": ilYa(100), "F-c2": ilYa(61) };
    await alerterRealisationsEnAttente(MAINTENANT);
    expect(etat.mails).toHaveLength(2);
    expect(etat.mails.every((m) => !m.gabarit.startsWith("apporteur-"))).toBe(true);
    expect(etat.mails.every((m) => !JSON.stringify(m.payload).includes("@"))).toBe(true);
  });
});
