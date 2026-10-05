import { beforeEach, describe, expect, it, vi } from "vitest";

const etat = vi.hoisted(() => ({
  envoisAt: [] as Date[],
  piecesEnAttente: 0,
  dejaPartis: new Set<string>(),
  envoyes: [] as Array<Record<string, unknown>>,
  alertes: [] as Array<{ template: string; payload: Record<string, unknown>; jobId: string }>,
  piecesJugees: [] as Array<{
    type: string;
    statut: string;
    expireAt: Date | null;
    remplaceeAt: null;
  }>,
  liberees: [] as Array<Record<string, unknown>>,
  piecesADeposer: [] as Array<Record<string, unknown>>,
}));

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: unknown) => v }));
vi.mock("@/lib/destinataires-internes", () => ({
  destinataireAlertesInternes: () => "contact@axion-ia.com",
}));
vi.mock("../jeton", () => ({ urlDossier: () => "https://lien" }));
vi.mock("../envois", () => ({
  envoyer: vi.fn(async (e: Record<string, unknown>) => {
    etat.envoyes.push(e);
    return "envoye";
  }),
}));
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: vi.fn(
    async (
      template: string,
      _to: string,
      _l: string,
      payload: Record<string, unknown>,
      o: { jobId: string },
    ) => {
      etat.alertes.push({ template, payload, jobId: o.jobId });
      etat.dejaPartis.add(o.jobId);
      return { enqueued: true };
    },
  ),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailLog: {
      findMany: vi.fn(async () => etat.envoisAt.map((sentAt) => ({ sentAt }))),
      count: vi.fn(async (a: { where: { jobId: string } }) =>
        etat.dejaPartis.has(a.where.jobId) ? 1 : 0,
      ),
    },
    pieceApporteur: {
      count: vi.fn(async () => etat.piecesEnAttente),
      findMany: vi.fn(async (a: { where: { statut?: string } }) =>
        a.where.statut === "deposee" ? etat.piecesADeposer : etat.piecesJugees,
      ),
      findUnique: vi.fn(async () => ({
        id: "PC1",
        type: "vigilance",
        statut: "deposee",
        deposeeAt: new Date("2026-10-04T10:00:00Z"),
        apporteurId: "APP1",
        apporteur: { prenom: "Jeanne", nom: "Martin" },
      })),
    },
    apporteurReseau: {
      findUnique: vi.fn(async () => ({
        id: "APP1",
        prenom: "Jeanne",
        nom: "Martin",
        email: "j@m.fr",
        versionLien: 1,
      })),
    },
    commissionApporteur: {
      updateMany: vi.fn(async (a: Record<string, unknown>) => {
        etat.liberees.push(a);
        return { count: 2 };
      }),
    },
  },
}));

import { alerterPiecesVigilanceDeposees } from "../alerte-vigilance";
import {
  jobIdRelanceVigilance,
  libererSiPiecesValides,
  relancerVigilance,
  relanceVigilanceDue,
} from "../commissions";

const J0 = new Date("2026-10-01T09:00:00Z");
const apres = (j: number) => new Date(J0.getTime() + j * 86_400_000);

beforeEach(() => {
  etat.envoisAt = [];
  etat.piecesEnAttente = 0;
  etat.dejaPartis = new Set();
  etat.envoyes = [];
  etat.alertes = [];
  etat.piecesJugees = [];
  etat.liberees = [];
  etat.piecesADeposer = [];
});

describe("relances de la vigilance : tous les 15 jours, trois au plus", () => {
  it("rien tant que 15 jours ne sont pas écoulés depuis la demande", () => {
    expect(relanceVigilanceDue([J0], apres(14.9))).toBeNull();
  });
  it("première relance à J+15, deuxième 15 jours après la première, troisième 15 jours après", () => {
    expect(relanceVigilanceDue([J0], apres(15))).toBe(1);
    expect(relanceVigilanceDue([J0, apres(15)], apres(29))).toBeNull();
    expect(relanceVigilanceDue([J0, apres(15)], apres(30))).toBe(2);
    expect(relanceVigilanceDue([J0, apres(15), apres(30)], apres(45))).toBe(3);
  });
  it("jamais plus de trois relances", () => {
    expect(relanceVigilanceDue([J0, apres(15), apres(30), apres(45)], apres(400))).toBeNull();
  });
  it("une relance en retard ne rattrape pas les précédentes d'un coup", () => {
    expect(relanceVigilanceDue([J0], apres(100))).toBe(1);
    expect(relanceVigilanceDue([J0, apres(100)], apres(101))).toBeNull();
  });
  it("sans demande initiale partie, aucune relance", () => {
    expect(relanceVigilanceDue([], apres(50))).toBeNull();
  });
  it("une clé d'idempotence distincte par relance", () => {
    expect(jobIdRelanceVigilance("A", 1)).not.toBe(jobIdRelanceVigilance("A", 2));
  });

  it("relance envoyée une seule fois : le second passage ne renvoie rien", async () => {
    etat.envoisAt = [J0];
    expect(await relancerVigilance("APP1", apres(15))).toBe(true);
    expect(etat.envoyes).toHaveLength(1);
    expect(etat.envoyes[0]).toMatchObject({
      gabarit: "apporteur-vigilance",
      jobId: "apporteur-vigilance-relance-APP1-1",
    });
    etat.dejaPartis.add("apporteur-vigilance-relance-APP1-1");
    expect(await relancerVigilance("APP1", apres(15))).toBe(false);
    expect(etat.envoyes).toHaveLength(1);
  });
  it("pas de relance si une pièce déposée attend déjà la vérification de Williams", async () => {
    etat.envoisAt = [J0];
    etat.piecesEnAttente = 1;
    expect(await relancerVigilance("APP1", apres(20))).toBe(false);
    expect(etat.envoyes).toEqual([]);
  });
});

describe("libération des commissions dès que les pièces sont conformes", () => {
  it("les deux pièces conformes : les commissions en attente passent à due tout de suite", async () => {
    etat.piecesJugees = [
      {
        type: "vigilance",
        statut: "conforme",
        expireAt: new Date("2027-03-01T00:00:00Z"),
        remplaceeAt: null,
      },
      { type: "immatriculation", statut: "conforme", expireAt: null, remplaceeAt: null },
    ];
    const n = await libererSiPiecesValides("APP1", J0);
    expect(n).toBe(2);
    expect(etat.liberees[0]).toMatchObject({
      where: { apporteurId: "APP1", statut: "en_attente_vigilance" },
      data: { statut: "due" },
    });
  });
  it("une seule des deux pièces conforme : rien n'est libéré", async () => {
    etat.piecesJugees = [
      {
        type: "vigilance",
        statut: "conforme",
        expireAt: new Date("2027-03-01T00:00:00Z"),
        remplaceeAt: null,
      },
    ];
    expect(await libererSiPiecesValides("APP1", J0)).toBe(0);
    expect(etat.liberees).toEqual([]);
  });
  it("attestation expirée : rien n'est libéré", async () => {
    etat.piecesJugees = [
      {
        type: "vigilance",
        statut: "conforme",
        expireAt: new Date("2026-09-01T00:00:00Z"),
        remplaceeAt: null,
      },
      { type: "immatriculation", statut: "conforme", expireAt: null, remplaceeAt: null },
    ];
    expect(await libererSiPiecesValides("APP1", J0)).toBe(0);
  });
});

describe("alerte interne au dépôt d'une pièce de vigilance", () => {
  it("une alerte à Williams par pièce déposée, sur le gabarit d'alerte interne existant", async () => {
    etat.piecesADeposer = [{ id: "PC1" }];
    const n = await alerterPiecesVigilanceDeposees(J0);
    expect(n).toBe(1);
    expect(etat.alertes[0]).toMatchObject({
      template: "qualiopi-alerte-interne",
      jobId: "apporteur-piece-vigilance-alerte-PC1",
    });
    expect(etat.alertes[0]!.payload.titre).toContain("Jeanne Martin");
  });
  it("jamais deux fois la même pièce", async () => {
    etat.piecesADeposer = [{ id: "PC1" }];
    await alerterPiecesVigilanceDeposees(J0);
    expect(await alerterPiecesVigilanceDeposees(J0)).toBe(0);
    expect(etat.alertes).toHaveLength(1);
  });
});
