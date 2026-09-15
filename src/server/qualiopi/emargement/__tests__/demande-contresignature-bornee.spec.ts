/**
 * 🔴 LA DEMANDE DE CONTRESIGNATURE PART SEULE — PAR JOURNÉE, ET PAS À L'INFINI.
 *
 * Le formateur ne peut pas être « contresigné » à sa place. Ce que l'on peut
 * automatiser, c'est la demande : elle part après la fin de chaque journée
 * signée, se rappelle au plus deux fois, et s'arrête. Le manque reste ensuite
 * visible dans la console et dans l'espace du formateur — jamais bloquant pour
 * l'attestation (décision de Will).
 *
 * Ce fichier garde le CONTRAT d'un passage (sélection, destinataire, forme de
 * l'e-mail et de la trace). Le déroulé heure par heure sur plusieurs jours, la
 * nuit et le changement d'heure sont dans `une-demande-par-journee-jamais-la-nuit`.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

interface Trace {
  jobId: string;
  status: string;
  createdAt: Date;
}
const findMany = vi.fn(async (..._a: unknown[]): Promise<unknown[]> => []);
const trainerFindUnique = vi.fn(async (..._a: unknown[]): Promise<unknown> => null);
const emailLogFindMany = vi.fn(async (..._a: unknown[]): Promise<Trace[]> => []);
const enqueueEmail = vi.fn(async (..._a: unknown[]): Promise<unknown> => ({ enqueued: true }));
const verdictAvantEnvoi = vi.fn(async (..._a: unknown[]): Promise<unknown> => ({ retenu: false }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainingSession: {
      get findMany() {
        return findMany;
      },
    },
    trainer: {
      get findUnique() {
        return trainerFindUnique;
      },
    },
    emailLog: {
      get findMany() {
        return emailLogFindMany;
      },
    },
  },
}));
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: (...a: unknown[]) => enqueueEmail(...a),
}));
vi.mock("@/server/email/suppression", () => ({
  verdictAvantEnvoi: (...a: unknown[]) => verdictAvantEnvoi(...a),
}));

import * as demande from "../demande-contresignature";

/** Mercredi 16/09/2026, 18:25 à Paris : la journée du 16 est finie. */
const MAINTENANT = new Date("2026-09-16T16:25:00.000Z");
const jourDb = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const PREFIXE = "formateur-contresignature-sess-1-t-1-";

const session = (patch: Record<string, unknown> = {}) => ({
  id: "sess-1",
  numero: "AXI-SESS-2026-042",
  titreSession: "IA pour bien commencer",
  formateurPrincipalId: "t-1",
  sessionFormateurs: [],
  jours: [{ date: jourDb("2026-09-16"), heureDebut: "09:00", heureFin: "17:00", trainerId: null }],
  emargementContresignatures: [],
  enrollments: [
    {
      presences: [
        { date: jourDb("2026-09-16"), demiJournee: "matin" },
        { date: jourDb("2026-09-16"), demiJournee: "apres_midi" },
      ],
    },
  ],
  ...patch,
});

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env["DATABASE_URL"];
  findMany.mockResolvedValue([session()]);
  trainerFindUnique.mockResolvedValue({ email: "formateur@example.test", prenom: "C", nom: "D" });
  emailLogFindMany.mockResolvedValue([]);
  enqueueEmail.mockResolvedValue({ enqueued: true });
  verdictAvantEnvoi.mockResolvedValue({ retenu: false });
});

describe("la demande part seule", () => {
  it("🔴 une journée signée non contresignée → UNE demande au formateur désigné", async () => {
    const bilan = await demande.envoyerDemandesContresignature(MAINTENANT);

    expect(enqueueEmail).toHaveBeenCalledTimes(1);
    const [template, to, locale, payload, options] = enqueueEmail.mock.calls[0] as [
      string,
      string,
      string,
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(template).toBe("formateur-contresignature");
    expect(to).toBe("formateur@example.test");
    expect(locale).toBe("fr");
    expect(payload["demiJournees"]).toEqual([
      "mercredi 16 septembre 2026 — matin",
      "mercredi 16 septembre 2026 — après-midi",
    ]);
    // Accès DIRECT au geste : la page authentifiée de la formation, à l'ancre
    // du bloc d'émargement. Aucune surface publique nouvelle.
    expect(String(payload["lienEspace"])).toMatch(
      /\/espace-formateur\/sessions\/sess-1#emargement$/,
    );
    // La trace porte l'heure du passage (Paris) ET la journée réclamée.
    expect(options["jobId"]).toBe(`${PREFIXE}2026091618-j20260916`);
    expect(bilan.envoyees).toBe(1);
  });

  it("ne sélectionne ni session annulée ni reportée, et borne la fenêtre après la fin", async () => {
    await demande.envoyerDemandesContresignature(MAINTENANT);
    const where = (findMany.mock.calls[0]?.[0] as { where: Record<string, unknown> }).where as {
      statut: { in: string[] };
      dateFin: { gte: Date };
    };
    expect(where.statut.in).not.toContain("annulee");
    expect(where.statut.in).not.toContain("reportee");
    expect(MAINTENANT.getTime() - where.dateFin.gte.getTime()).toBe(
      demande.FENETRE_DEMANDE_APRES_FIN_JOURS * 24 * 60 * 60 * 1000,
    );
  });

  it("hors de la plage 08:00-21:00 (Paris) → rien, pas même une lecture", async () => {
    const bilan = await demande.envoyerDemandesContresignature(new Date("2026-09-16T21:25:00Z"));
    expect(bilan.horsPlage).toBe(true);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("tout est contresigné → aucune demande", async () => {
    findMany.mockResolvedValue([
      session({
        emargementContresignatures: [
          {
            date: jourDb("2026-09-16"),
            demiJournee: "matin",
            trainerId: "t-1",
            createdAt: MAINTENANT,
          },
          {
            date: jourDb("2026-09-16"),
            demiJournee: "apres_midi",
            trainerId: "t-1",
            createdAt: MAINTENANT,
          },
        ],
      }),
    ]);
    await demande.envoyerDemandesContresignature(MAINTENANT);
    expect(enqueueEmail).not.toHaveBeenCalled();
  });

  it("🔴 formateur de la journée NON membre → la demande va au principal, qui peut agir", async () => {
    findMany.mockResolvedValue([
      session({
        formateurPrincipalId: "t-1",
        jours: [
          { date: jourDb("2026-09-16"), heureDebut: "09:00", heureFin: "17:00", trainerId: "t-x" },
        ],
      }),
    ]);
    await demande.envoyerDemandesContresignature(MAINTENANT);
    expect(trainerFindUnique.mock.calls[0]?.[0]).toMatchObject({ where: { id: "t-1" } });
    expect(enqueueEmail).toHaveBeenCalledTimes(1);
  });

  it("personne de membre à qui demander → aucun e-mail, et compté (la fiche le signale)", async () => {
    findMany.mockResolvedValue([
      session({
        formateurPrincipalId: null,
        jours: [
          { date: jourDb("2026-09-16"), heureDebut: "09:00", heureFin: "17:00", trainerId: "t-x" },
        ],
      }),
    ]);
    const bilan = await demande.envoyerDemandesContresignature(MAINTENANT);
    expect(enqueueEmail).not.toHaveBeenCalled();
    expect(bilan.sansFormateur).toBe(2);
  });

  it("adresse sur la liste de suppression → rien n'est enfilé", async () => {
    verdictAvantEnvoi.mockResolvedValue({ retenu: true, motif: "rebond_dur", depuis: null });
    const bilan = await demande.envoyerDemandesContresignature(MAINTENANT);
    expect(enqueueEmail).not.toHaveBeenCalled();
    expect(bilan.retenues).toBe(1);
  });
});

describe("🔴 idempotence et rappels BORNÉS, au grain de la journée", () => {
  const trace = (jobId: string, heuresAvant: number, status = "sent"): Trace => ({
    jobId,
    status,
    createdAt: new Date(MAINTENANT.getTime() - heuresAvant * 3_600_000),
  });

  it("la trace est lue par (session, formateur), jamais par jour d'envoi", async () => {
    await demande.envoyerDemandesContresignature(MAINTENANT);
    const where = (
      emailLogFindMany.mock.calls[0]?.[0] as { where: { jobId: { startsWith: string } } }
    ).where;
    expect(where.jobId.startsWith).toBe(PREFIXE);
  });

  it("demandée il y a 1 h → rien ne repart", async () => {
    emailLogFindMany.mockResolvedValue([trace(`${PREFIXE}2026091617-j20260916`, 1)]);
    const bilan = await demande.envoyerDemandesContresignature(MAINTENANT);
    expect(enqueueEmail).not.toHaveBeenCalled();
    expect(bilan.enAttente).toBe(1);
  });

  it("plafond de trois envois partis → la demande s'arrête", async () => {
    emailLogFindMany.mockResolvedValue([
      trace(`${PREFIXE}2026091418-j20260916`, 48),
      trace(`${PREFIXE}2026091518-j20260916`, 24),
      trace(`${PREFIXE}2026091612-j20260916`, 30),
    ]);
    const bilan = await demande.envoyerDemandesContresignature(MAINTENANT);
    expect(enqueueEmail).not.toHaveBeenCalled();
    expect(bilan.plafonnees).toBe(1);
  });

  it("un envoi parti il y a 24 h → rappel, marqué comme tel", async () => {
    emailLogFindMany.mockResolvedValue([trace(`${PREFIXE}2026091518-j20260916`, 24)]);
    await demande.envoyerDemandesContresignature(MAINTENANT);
    const payload = enqueueEmail.mock.calls[0]?.[3] as Record<string, unknown>;
    expect(payload["rangRappel"]).toBe(1);
    expect(payload["dernierRappel"]).toBe(false);
  });

  it("🔴 un envoi en ÉCHEC il y a 1 h ne bloque rien et ne compte pas", async () => {
    emailLogFindMany.mockResolvedValue([trace(`${PREFIXE}2026091617-j20260916`, 1, "failed")]);
    await demande.envoyerDemandesContresignature(MAINTENANT);
    const payload = enqueueEmail.mock.calls[0]?.[3] as Record<string, unknown>;
    expect(payload["rangRappel"]).toBe(0);
  });

  it("la trace d'une AUTRE journée n'absorbe pas celle-ci", async () => {
    emailLogFindMany.mockResolvedValue([trace(`${PREFIXE}2026091617-j20260915`, 1)]);
    await demande.envoyerDemandesContresignature(MAINTENANT);
    expect(enqueueEmail).toHaveBeenCalledTimes(1);
  });

  it("journal illisible → on s'abstient : une demande retardée d'une heure vaut mieux qu'un doublon", async () => {
    emailLogFindMany.mockRejectedValue(new Error("base muette"));
    const bilan = await demande.envoyerDemandesContresignature(MAINTENANT);
    expect(enqueueEmail).not.toHaveBeenCalled();
    expect(bilan.echecs).toBe(1);
  });

  it("stub SSG → aucune lecture", async () => {
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    await demande.envoyerDemandesContresignature(MAINTENANT);
    expect(findMany).not.toHaveBeenCalled();
    delete process.env["DATABASE_URL"];
  });
});
