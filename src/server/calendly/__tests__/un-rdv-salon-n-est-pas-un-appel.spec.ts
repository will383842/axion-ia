/**
 * Un rendez-vous pris POUR UN SALON n'est pas un appel (2026-09-29, GOFAB).
 *
 * Quatre points, chacun avec son témoin :
 *   1. la règle de reconnaissance (nom du type d'événement) ;
 *   2. les passages client EXCLUENT les rendez-vous salon, les passages salon
 *      ne visent QU'eux — dans la requête ;
 *   3. le J-2 regarde bien 48 h plus loin, avec son propre marqueur ;
 *   4. le message dit où venir, propose de déplacer / annuler / passer en visio.
 */
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
const enqueueEmail = vi.fn(async (..._a: unknown[]) => ({ enqueued: true }));
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: (...a: unknown[]) => enqueueEmail(...a),
}));

import { HORS_APPELS_APPORTEUR } from "../appel-apporteur";
import { estRdvSalon, HORS_RDV_SALON, salonDuNom, SEULS_RDV_SALON } from "../rdv-salon";
import { executerPassage, PASSAGES } from "../rappels-appel";
import { renderEmailTemplate } from "@/lib/email/templates";

const NOW = Date.UTC(2026, 9, 11, 8, 0, 0);

beforeEach(() => {
  vi.clearAllMocks();
  findMany.mockResolvedValue([]);
});

async function whereDe(job: string) {
  const p = PASSAGES.find((x) => x.job === job);
  if (!p) throw new Error(`passage ${job} introuvable`);
  await executerPassage(p, NOW);
  return (findMany.mock.calls[0]?.[0] as { where: Record<string, unknown> }).where;
}

describe("estRdvSalon / salonDuNom — la règle de reconnaissance", () => {
  it.each(["Rencontre au salon GOFAB — 13 octobre", "RENCONTRE SALON", "Rendez-vous Salon"])(
    "« %s » est un rendez-vous salon",
    (nom) => expect(estRdvSalon(nom)).toBe(true),
  );

  it.each(["Premier contact", "Échange apporteur (salon)", "", null, undefined])(
    "TÉMOIN — « %s » n'en est pas un",
    (nom) => expect(estRdvSalon(nom)).toBe(false),
  );

  it("GOFAB est reconnu, un autre salon ne l'est pas", () => {
    expect(salonDuNom("Rencontre au salon GoFab")).toBe("gofab");
    expect(salonDuNom("Rencontre au salon Global Industrie")).toBeNull();
  });
});

describe("les populations ne se recouvrent pas", () => {
  it.each(PASSAGES.filter((p) => p.destinataire === "client").map((p) => p.job))(
    "passage client « %s » : exclut les rendez-vous salon",
    async (job) => {
      const where = await whereDe(job);
      expect(where["AND"]).toContainEqual(HORS_RDV_SALON);
      expect(where["AND"]).not.toContainEqual(SEULS_RDV_SALON);
    },
  );

  it.each(PASSAGES.filter((p) => p.destinataire === "salon").map((p) => p.job))(
    "passage salon « %s » : ne vise QUE les rendez-vous salon, jamais un apporteur",
    async (job) => {
      const where = await whereDe(job);
      expect(where["AND"]).toEqual([SEULS_RDV_SALON, HORS_APPELS_APPORTEUR]);
    },
  );

  it("trois messages salon exactement : confirmation, J-2, J-1 — pas de H-1", () => {
    expect(PASSAGES.filter((p) => p.destinataire === "salon").map((p) => p.moment)).toEqual([
      "confirmation",
      "j2",
      "j1",
    ]);
  });
});

describe("le rappel J-2", () => {
  it("regarde 48 h → 48 h 15 plus loin, sur son propre marqueur", async () => {
    const where = await whereDe("rdv-salon-rappel-j2");
    expect(where["startTime"]).toEqual({
      gte: new Date(NOW + 2880 * 60_000),
      lt: new Date(NOW + 2895 * 60_000),
    });
    expect(where["rappelJ2EnvoyeAt"]).toBeNull();
    expect(where).not.toHaveProperty("rappelJ1EnvoyeAt");
  });

  it("transmet le salon au gabarit et pose son marqueur", async () => {
    const debut = new Date(NOW + 2885 * 60_000);
    findMany.mockResolvedValue([
      {
        id: "rdv-1",
        inviteeName: "Claire Martin",
        inviteeEmail: "claire@example.com",
        startTime: debut,
        endTime: new Date(debut.getTime() + 20 * 60_000),
        location: "Arena Saint-Étienne Métropole",
        rawPayload: null,
        cancelUrl: "https://calendly.com/cancellations/abc",
        rescheduleUrl: "https://calendly.com/reschedulings/abc",
        eventTypeName: "Rencontre au salon GOFAB — 13 octobre",
      },
    ]);
    const p = PASSAGES.find((x) => x.job === "rdv-salon-rappel-j2")!;
    const r = await executerPassage(p, NOW);
    expect(r.envoyes).toBe(1);
    const [job, , , payload] = enqueueEmail.mock.calls[0] as [
      string,
      string,
      string,
      Record<string, unknown>,
    ];
    expect(job).toBe("rdv-salon-rappel-j2");
    expect(payload).toMatchObject({ salon: "gofab", moment: "j2", dureeMinutes: 20 });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ rappelJ2EnvoyeAt: expect.any(Date) }),
      }),
    );
  });
});

describe("le message dit où venir et laisse une porte de sortie", () => {
  const payload = {
    prenom: "Claire",
    date: "mardi 13 octobre",
    heure: "10:20",
    dureeMinutes: 20,
    salon: "gofab",
    cancelUrl: "https://calendly.com/cancellations/abc",
    rescheduleUrl: "https://calendly.com/reschedulings/abc",
  };

  it.each([
    ["rdv-salon-confirme", "confirmation"],
    ["rdv-salon-rappel-j2", "j2"],
    ["rdv-salon-rappel-j1", "j1"],
  ] as const)("%s : lieu, espace affaires, déplacer, annuler, visio", async (job, moment) => {
    const r = await renderEmailTemplate(job, "fr", { ...payload, moment });
    expect(r.html).toContain("1 rue André Jeantet");
    expect(r.html).toContain("espace affaires");
    expect(r.html).toContain("Lyon Pacte PME AURA");
    expect(r.html).toContain("https://calendly.com/reschedulings/abc");
    expect(r.html).toContain("https://calendly.com/cancellations/abc");
    expect(r.html).toContain("https://calendly.com/axion-ia/premier-contact");
    expect(r.subject).toContain("GOFAB");
    // Un rendez-vous en personne : jamais le vocabulaire de l'appel.
    expect(r.html).not.toMatch(/appel de découverte|lien de connexion/i);
  });

  it("les trois objets sont distincts", async () => {
    const objets = await Promise.all(
      (["confirmation", "j2", "j1"] as const).map(
        async (moment) =>
          (await renderEmailTemplate("rdv-salon-confirme", "fr", { ...payload, moment })).subject,
      ),
    );
    expect(new Set(objets).size).toBe(3);
  });
});
