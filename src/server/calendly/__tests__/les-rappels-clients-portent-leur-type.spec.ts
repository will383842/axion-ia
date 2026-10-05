// Les e-mails clients portent leur TYPE ; le worker survit à la migration en retard.
//
// Chantier « Types de rendez-vous », lot L3 (2026-10-04).
//
//   · un passage CLIENT transmet `typeRendezVous` (colonne, sinon nom) et, pour
//     un échange projet, le service choisi (`besoin`) ;
//   · les passages apporteur et salon n'en reçoivent rien : leurs gabarits ne
//     changent pas ;
//   · la colonne absente (worker en avance de ~50 min sur la migration) ne fait
//     PAS échouer le passage : il est rejoué sur le nom seul, sans la colonne.

import { describe, it, expect, vi, beforeEach } from "vitest";

const findMany = vi.fn();
const update = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    calendlyEvent: {
      findMany: (...a: unknown[]) => findMany(...a),
      update: (...a: unknown[]) => update(...a),
    },
  },
}));

const enqueueEmail = vi.fn();
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: (...a: unknown[]) => enqueueEmail(...a),
}));

import { executerPassage, PASSAGES } from "../rappels-appel";

const MAINTENANT = Date.UTC(2026, 9, 4, 10, 0, 0);

function passage(job: (typeof PASSAGES)[number]["job"]) {
  const p = PASSAGES.find((x) => x.job === job);
  if (!p) throw new Error(`passage ${job} introuvable`);
  return p;
}

const BESOIN = {
  invitee: {
    questions_and_answers: [
      { question: "Quel service vous intéresse ?", answer: "Formation" },
      { question: "Quelques mots sur votre projet (facultatif)", answer: "RAS" },
    ],
  },
};

function rdv(over: Record<string, unknown> = {}) {
  return {
    id: "evt_1",
    inviteeName: "Camille Dupont",
    inviteeEmail: "camille@example.invalid",
    startTime: new Date(MAINTENANT + 3 * 3_600_000),
    endTime: new Date(MAINTENANT + 3 * 3_600_000 + 30 * 60_000),
    location: "https://meet.google.com/abc-defg-hij",
    rawPayload: null,
    cancelUrl: null,
    rescheduleUrl: null,
    eventTypeName: "Diagnostic IA",
    typeRendezVous: "diagnostic",
    ...over,
  };
}

const charge = () => (enqueueEmail.mock.calls[0] as unknown[])[3] as Record<string, unknown>;

beforeEach(() => {
  vi.clearAllMocks();
  update.mockResolvedValue({});
  enqueueEmail.mockResolvedValue({ enqueued: true });
});

describe("passage client — le type et le besoin voyagent jusqu'au gabarit", () => {
  it("diagnostic : `typeRendezVous` = diagnostic, pas de besoin", async () => {
    findMany.mockResolvedValue([rdv()]);
    await executerPassage(passage("appel-confirme"), MAINTENANT);
    expect(charge()["typeRendezVous"]).toBe("diagnostic");
    expect(charge()).not.toHaveProperty("besoin");
    expect(charge()["dureeMinutes"]).toBe(30);
  });

  it("échange projet : le service choisi part avec le type", async () => {
    findMany.mockResolvedValue([
      rdv({
        eventTypeName: "Discutons de votre projet IA",
        typeRendezVous: "echange_projet",
        rawPayload: BESOIN,
      }),
    ]);
    await executerPassage(passage("appel-confirme"), MAINTENANT);
    expect(charge()["typeRendezVous"]).toBe("echange_projet");
    expect(charge()["besoin"]).toBe("Formation");
  });

  it("colonne NULL (fenêtre de déploiement) : le type se replie sur le nom", async () => {
    findMany.mockResolvedValue([
      rdv({ eventTypeName: "Discutons de votre projet IA", typeRendezVous: null }),
    ]);
    await executerPassage(passage("appel-rappel-j1"), MAINTENANT + 3 * 3_600_000 - 1445 * 60_000);
    expect(charge()["typeRendezVous"]).toBe("echange_projet");
  });

  it("la requête lit la colonne du type", async () => {
    findMany.mockResolvedValue([]);
    await executerPassage(passage("appel-confirme"), MAINTENANT);
    const args = findMany.mock.calls[0]?.[0] as { select: Record<string, unknown> };
    expect(args.select["typeRendezVous"]).toBe(true);
  });
});

describe("passages apporteur et salon — gabarits inchangés", () => {
  it.each(["apporteur-echange-confirme", "rdv-salon-confirme"] as const)(
    "%s : ni type ni besoin dans la charge",
    async (job) => {
      findMany.mockResolvedValue([
        rdv({
          eventTypeName: job.startsWith("rdv-salon")
            ? "Rencontre au salon GOFAB"
            : "Échange apporteur",
          typeRendezVous: job.startsWith("rdv-salon") ? "salon" : "apporteur",
          rawPayload: BESOIN,
        }),
      ]);
      await executerPassage(passage(job), MAINTENANT);
      expect(charge()).not.toHaveProperty("typeRendezVous");
      expect(charge()).not.toHaveProperty("besoin");
    },
  );
});

describe("worker en avance sur la migration — repli sur le nom", () => {
  const colonneAbsente = Object.assign(
    new Error(
      "The column `calendly_events.type_rendez_vous` does not exist in the current database.",
    ),
    { code: "P2022" },
  );

  it("rejoue la requête SANS la colonne, avec les clauses historiques", async () => {
    findMany
      .mockRejectedValueOnce(colonneAbsente)
      .mockResolvedValueOnce([
        rdv({ typeRendezVous: undefined, eventTypeName: "Discutons de votre projet IA" }),
      ]);
    const p = passage("appel-confirme");
    const res = await executerPassage(p, MAINTENANT);

    expect(res.ok).toBe(true);
    expect(res.envoyes).toBe(1);
    expect(findMany).toHaveBeenCalledTimes(2);
    const second = findMany.mock.calls[1]?.[0] as {
      where: { AND: unknown[] };
      select: Record<string, unknown>;
    };
    expect(second.where.AND).toEqual([...p.filtresParNom]);
    expect(second.select).not.toHaveProperty("typeRendezVous");
    // Le type vient alors du nom.
    expect(charge()["typeRendezVous"]).toBe("echange_projet");
  });

  it("une autre erreur de lecture reste une erreur (pas de repli muet)", async () => {
    findMany.mockRejectedValueOnce(new Error("connexion refusée"));
    const res = await executerPassage(passage("appel-confirme"), MAINTENANT);
    expect(res.ok).toBe(false);
    expect(findMany).toHaveBeenCalledTimes(1);
  });
});
