/**
 * 🔴 LA DEMANDE DE CONTRESIGNATURE PART SEULE — UNE PAR JOUR, ET PAS À L'INFINI.
 *
 * Le formateur ne peut pas être « contresigné » à sa place. Ce que l'on peut
 * automatiser, c'est la demande : elle part à la fin de la journée signée, se
 * rappelle au plus deux fois sans réaction, et s'arrête. Le manque reste ensuite
 * visible dans la console et dans l'espace du formateur — jamais bloquant pour
 * l'attestation (décision de Will).
 *
 * Idempotence : la trace durable est `email_logs` (une ligne par `jobId`, posée
 * à l'enfilage), pas la déduplication BullMQ, qui expire. Le cron est horaire :
 * sans elle, un formateur recevrait vingt-quatre fois la même demande.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const findMany = vi.fn(async (..._a: unknown[]): Promise<unknown[]> => []);
const trainerFindUnique = vi.fn(async (..._a: unknown[]): Promise<unknown> => null);
const emailLogFindFirst = vi.fn(async (..._a: unknown[]): Promise<unknown> => null);
const emailLogCount = vi.fn(async (..._a: unknown[]): Promise<number> => 0);
const enqueueEmail = vi.fn(async (..._a: unknown[]): Promise<unknown> => ({ enqueued: true }));

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
      get findFirst() {
        return emailLogFindFirst;
      },
      get count() {
        return emailLogCount;
      },
    },
  },
}));
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: (...a: unknown[]) => enqueueEmail(...a),
}));

import * as demande from "../demande-contresignature";

/** Mercredi 16/09/2026, 18:25 à Paris : la journée du 16 est finie. */
const MAINTENANT = new Date("2026-09-16T16:25:00.000Z");
const jourDb = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

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
  emailLogFindFirst.mockResolvedValue(null);
  emailLogCount.mockResolvedValue(0);
  enqueueEmail.mockResolvedValue({ enqueued: true });
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
    expect(options["jobId"]).toBe("formateur-contresignature-sess-1-t-1-20260916");
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

  it("un formateur désigné qui n'est pas membre de la session ne reçoit rien", async () => {
    // Il ne pourrait pas contresigner : l'action refuse les non-membres. Lui
    // écrire l'enverrait sur un bouton qui échoue.
    findMany.mockResolvedValue([
      session({
        formateurPrincipalId: "t-1",
        jours: [
          { date: jourDb("2026-09-16"), heureDebut: "09:00", heureFin: "17:00", trainerId: "t-x" },
        ],
      }),
    ]);
    const bilan = await demande.envoyerDemandesContresignature(MAINTENANT);
    expect(enqueueEmail).not.toHaveBeenCalled();
    expect(bilan.nonMembre).toBe(1);
  });
});

describe("🔴 idempotence et rappels BORNÉS", () => {
  it("déjà demandé aujourd'hui (trace durable) → rien ne repart", async () => {
    emailLogFindFirst.mockResolvedValue({ id: "log-1" });
    const bilan = await demande.envoyerDemandesContresignature(MAINTENANT);
    expect(enqueueEmail).not.toHaveBeenCalled();
    expect(bilan.dejaAujourdhui).toBe(1);
    const where = (emailLogFindFirst.mock.calls[0]?.[0] as { where: { jobId: string } }).where;
    expect(where.jobId).toBe("formateur-contresignature-sess-1-t-1-20260916");
  });

  it("plafond atteint sans réaction du formateur → la demande s'arrête", async () => {
    emailLogCount.mockResolvedValue(demande.PLAFOND_DEMANDES_SANS_REPONSE);
    const bilan = await demande.envoyerDemandesContresignature(MAINTENANT);
    expect(enqueueEmail).not.toHaveBeenCalled();
    expect(bilan.plafonnees).toBe(1);
  });

  it("sous le plafond → la demande part, marquée comme RAPPEL", async () => {
    emailLogCount.mockResolvedValue(1);
    await demande.envoyerDemandesContresignature(MAINTENANT);
    const payload = enqueueEmail.mock.calls[0]?.[3] as Record<string, unknown>;
    expect(payload["rangRappel"]).toBe(1);
    expect(payload["dernierRappel"]).toBe(false);
  });

  it("le compteur repart après une contresignature de CE formateur — il a réagi", async () => {
    const depuis = new Date("2026-09-15T17:00:00.000Z");
    findMany.mockResolvedValue([
      session({
        jours: [
          { date: jourDb("2026-09-15"), heureDebut: "09:00", heureFin: "17:00", trainerId: null },
          { date: jourDb("2026-09-16"), heureDebut: "09:00", heureFin: "17:00", trainerId: null },
        ],
        emargementContresignatures: [
          { date: jourDb("2026-09-15"), demiJournee: "matin", trainerId: "t-1", createdAt: depuis },
        ],
      }),
    ]);
    await demande.envoyerDemandesContresignature(MAINTENANT);
    const where = (
      emailLogCount.mock.calls[0]?.[0] as {
        where: { jobId: { startsWith: string }; createdAt?: { gt: Date } };
      }
    ).where;
    expect(where.jobId.startsWith).toBe("formateur-contresignature-sess-1-t-1-");
    expect(where.createdAt?.gt).toEqual(depuis);
  });

  it("journal illisible → on s'abstient : une demande retardée d'une heure vaut mieux qu'un doublon", async () => {
    emailLogFindFirst.mockRejectedValue(new Error("base muette"));
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
