/**
 * QNC NC6, lot présence 2/3 — les envois de la confirmation de présence (P-12, étapes 3-4).
 * Base simulée en mémoire : la trace écrite par un passage est lue par le suivant, ce qui
 * est ce qui fait tenir l'anti-doublon.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  etat: "actif" as string | null,
  sessions: [] as unknown[],
  journal: [] as Array<{ enrollmentId: string; objet: string; rang: number; creeLe: Date }>,
  reponses: [] as Array<{ enrollmentId: string; objet: string; survenuLe: Date }>,
}));

vi.mock("@/lib/prisma", () => {
  const prisma = {
    setting: {
      findUnique: vi.fn(async () => (h.etat === null ? null : { value: { etat: h.etat } })),
    },
    trainingSession: {
      findMany: vi.fn(async () =>
        (h.sessions as Array<{ enrollments: Array<{ id: string }> }>).map((s) => ({
          ...s,
          enrollments: s.enrollments.map((e) => ({
            ...e,
            relancesJournal: h.journal.filter((j) => j.enrollmentId === e.id),
            remisesRetours: h.reponses.filter((r) => r.enrollmentId === e.id),
          })),
        })),
      ),
    },
    remiseRetour: {
      create: vi.fn(async (a: { data: { enrollmentId: string; objet: string } }) => ({
        id: "remise-1",
        ...a.data,
      })),
    },
    relanceJournal: {
      create: vi.fn(async (a: { data: { enrollmentId: string; objet: string; rang: number } }) => {
        h.journal.push({ ...a.data, creeLe: new Date() });
        return a.data;
      }),
    },
    $transaction: vi.fn(async (ops: Array<Promise<unknown>>) => Promise.all(ops)),
  };
  return { prisma };
});

const enqueueEmail = vi.fn();
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: (...a: unknown[]) => enqueueEmail(...a) }));

import { prisma } from "@/lib/prisma";
import { inscriptionsActives } from "@/server/qualiopi/inscriptions/inscriptions-actives";
import { envoyerConfirmationsPresence } from "../envois";

const db = prisma as unknown as {
  trainingSession: { findMany: ReturnType<typeof vi.fn> };
  remiseRetour: { create: ReturnType<typeof vi.fn> };
  relanceJournal: { create: ReturnType<typeof vi.fn> };
};

/** J = lundi 26/10/2026. J-3 = vendredi 23/10 (heure d'été), J-1 = dimanche 25/10 (heure d'hiver). */
const J_DATE = new Date("2026-10-26T00:00:00Z");
const J3_10H = new Date("2026-10-23T08:00:00Z"); // 10 h Paris
const J2_10H = new Date("2026-10-24T08:00:00Z");
const J1_12H = new Date("2026-10-25T11:00:00Z"); // 12 h Paris (CET)

function inscription(over: Record<string, unknown> = {}) {
  return {
    id: "enr-1",
    trainee: { email: "camille@exemple.fr", prenom: "Camille", nom: "Dupont" },
    client: null,
    ...over,
  };
}

function session(over: Record<string, unknown> = {}, enrollments = [inscription()]) {
  return {
    id: "ses-1",
    numero: "AXI-SESS-2026-001",
    titreSession: "Piloter son activité avec l'IA",
    dateDebut: J_DATE,
    estTestInterne: false,
    jours: [{ date: J_DATE, heureDebut: "09:00", heureFin: "17:00" }],
    client: {
      raisonSociale: "Atelier Lumen",
      contactNom: "Alex Martin",
      contactEmail: "alex@lumen.fr",
    },
    enrollments,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env["AUTH_SECRET"] = "secret-de-test-presence";
  delete process.env["DATABASE_URL"];
  vi.useFakeTimers();
  vi.setSystemTime(J3_10H);
  h.etat = "actif";
  h.sessions = [session()];
  h.journal = [];
  h.reponses = [];
  enqueueEmail.mockResolvedValue({ enqueued: true });
});
afterEach(() => vi.useRealTimers());

const demandeFaite = (le: Date) => [
  { enrollmentId: "enr-1", objet: "presence_confirmation", rang: 1, creeLe: le },
];

describe("interrupteur", () => {
  it("éteint : aucune requête sur les sessions, aucun envoi", async () => {
    h.etat = null;
    const bilan = await envoyerConfirmationsPresence(J3_10H);
    expect(db.trainingSession.findMany).not.toHaveBeenCalled();
    expect(enqueueEmail).not.toHaveBeenCalled();
    expect(bilan.demandes).toBe(0);
  });

  it("DATABASE_URL stub.invalid : sort tout de suite, sans lire l'interrupteur", async () => {
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    await envoyerConfirmationsPresence(J3_10H);
    expect(db.trainingSession.findMany).not.toHaveBeenCalled();
    expect(enqueueEmail).not.toHaveBeenCalled();
  });

  it("essai : la requête est filtrée sur les sessions de test, et une autre est ignorée", async () => {
    h.etat = "essai";
    h.sessions = [session({ id: "ses-reelle", estTestInterne: false })];
    await envoyerConfirmationsPresence(J3_10H);
    const where = db.trainingSession.findMany.mock.calls[0]?.[0].where;
    expect(where.estTestInterne).toBe(true);
    // Même si la base rendait une session réelle, rien ne part pour elle.
    expect(enqueueEmail).not.toHaveBeenCalled();
  });

  it("essai : une session de test est servie", async () => {
    h.etat = "essai";
    h.sessions = [session({ estTestInterne: true })];
    await envoyerConfirmationsPresence(J3_10H);
    expect(enqueueEmail).toHaveBeenCalledTimes(1);
  });

  it("n'agit que sur les sessions planifiées et les inscriptions actives", async () => {
    await envoyerConfirmationsPresence(J3_10H);
    const where = db.trainingSession.findMany.mock.calls[0]?.[0];
    expect(where.where.statut).toBe("planifiee");
    expect(where.select.enrollments.where).toMatchObject(inscriptionsActives());
    expect(JSON.stringify(where.select.enrollments.where)).toContain("abandon");
  });
});

describe("B1 : la demande de confirmation", () => {
  it("part vers le stagiaire avec entityType/entityId et un jobId stable", async () => {
    const bilan = await envoyerConfirmationsPresence(J3_10H);
    expect(bilan.demandes).toBe(1);
    expect(enqueueEmail).toHaveBeenCalledTimes(1);
    const [gabarit, to, locale, payload, options] = enqueueEmail.mock.calls[0] as [
      string,
      string,
      string,
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(gabarit).toBe("qualiopi-presence-confirmation");
    expect(to).toBe("camille@exemple.fr");
    expect(locale).toBe("fr");
    expect(payload["stagiairePrenomNom"]).toBe("Camille Dupont");
    expect(payload["titreFormation"]).toBe("Piloter son activité avec l'IA");
    expect(payload["dateDebutFormation"]).toBe("lundi 26 octobre 2026");
    expect(payload["lienPresence"]).toMatch(
      /^https:\/\/axion-ia\.com\/fr\/portail\/presence\/[^/?#]+$/,
    );
    expect(payload["relance"]).toBeUndefined();
    expect(options).toMatchObject({
      jobId: "presence-demande-enr-1",
      entityType: "Enrollment",
      entityId: "enr-1",
    });
  });

  it("trace : une ligne RemiseRetour et une ligne RelanceJournal rang 1", async () => {
    await envoyerConfirmationsPresence(J3_10H);
    expect(db.remiseRetour.create.mock.calls[0]?.[0].data).toMatchObject({
      sessionId: "ses-1",
      enrollmentId: "enr-1",
      nature: "remise",
      objet: "presence_confirmation",
      destinataire: "stagiaire",
      canal: "email",
    });
    expect(db.relanceJournal.create.mock.calls[0]?.[0].data).toMatchObject({
      sessionId: "ses-1",
      enrollmentId: "enr-1",
      objet: "presence_confirmation",
      destinataire: "stagiaire",
      canal: "email",
      rang: 1,
      automatique: true,
    });
  });

  it("un 2e passage dans la même heure ne renvoie rien", async () => {
    await envoyerConfirmationsPresence(J3_10H);
    await envoyerConfirmationsPresence(new Date(J3_10H.getTime() + 10 * 60_000));
    expect(enqueueEmail).toHaveBeenCalledTimes(1);
    expect(db.relanceJournal.create).toHaveBeenCalledTimes(1);
  });

  it("enqueued:false (essai bloqué, garé, file absente) : aucune trace, nouvel essai ensuite", async () => {
    enqueueEmail.mockResolvedValueOnce({ enqueued: false, essaiBloque: true });
    const bilan = await envoyerConfirmationsPresence(J3_10H);
    expect(bilan.demandes).toBe(0);
    expect(db.remiseRetour.create).not.toHaveBeenCalled();
    expect(db.relanceJournal.create).not.toHaveBeenCalled();
    await envoyerConfirmationsPresence(new Date(J3_10H.getTime() + 60 * 60_000));
    expect(enqueueEmail).toHaveBeenCalledTimes(2);
    expect(db.relanceJournal.create).toHaveBeenCalledTimes(1);
  });

  it("hors de la plage 9 h – 19 h : rien", async () => {
    const tot = new Date("2026-10-23T06:00:00Z"); // 8 h Paris
    vi.setSystemTime(tot);
    await envoyerConfirmationsPresence(tot);
    expect(enqueueEmail).not.toHaveBeenCalled();
  });

  it("une erreur sur une inscription n'empêche pas les suivantes", async () => {
    h.sessions = [
      session({}, [
        inscription({ id: "enr-1" }),
        inscription({ id: "enr-2", trainee: { email: "b@x.fr", prenom: "B", nom: "B" } }),
      ]),
    ];
    enqueueEmail.mockRejectedValueOnce(new Error("redis"));
    const bilan = await envoyerConfirmationsPresence(J3_10H);
    expect(bilan.echecs).toHaveLength(1);
    expect(bilan.demandes).toBe(1);
  });
});

describe("B2 : la relance unique", () => {
  it("part le lendemain de la demande, sans réponse, avec relance:true et rang 2", async () => {
    vi.setSystemTime(J2_10H);
    h.journal = demandeFaite(J3_10H);
    const bilan = await envoyerConfirmationsPresence(J2_10H);
    expect(bilan.relances).toBe(1);
    const [gabarit, , , payload, options] = enqueueEmail.mock.calls[0] as [
      string,
      string,
      string,
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(gabarit).toBe("qualiopi-presence-confirmation");
    expect(payload["relance"]).toBe(true);
    expect(options).toMatchObject({
      jobId: "presence-relance-enr-1",
      entityType: "Enrollment",
      entityId: "enr-1",
    });
    expect(db.relanceJournal.create.mock.calls[0]?.[0].data).toMatchObject({
      objet: "presence_confirmation",
      rang: 2,
      automatique: true,
      destinataire: "stagiaire",
    });
    // La relance et la demande ne font qu'une seule remise.
    expect(db.remiseRetour.create).not.toHaveBeenCalled();
  });

  it("pas de relance le jour même de la demande, ni après une réponse, ni une seconde fois", async () => {
    h.journal = demandeFaite(new Date("2026-10-23T07:30:00Z"));
    await envoyerConfirmationsPresence(J3_10H);
    expect(enqueueEmail).not.toHaveBeenCalled();

    vi.setSystemTime(J2_10H);
    h.journal = demandeFaite(J3_10H);
    h.reponses = [{ enrollmentId: "enr-1", objet: "presence_confirmation:non", survenuLe: J3_10H }];
    await envoyerConfirmationsPresence(J2_10H);
    expect(enqueueEmail).not.toHaveBeenCalled();

    h.reponses = [];
    h.journal = [
      ...demandeFaite(J3_10H),
      { enrollmentId: "enr-1", objet: "presence_confirmation", rang: 2, creeLe: J2_10H },
    ];
    await envoyerConfirmationsPresence(new Date(J2_10H.getTime() + 3_600_000));
    expect(enqueueEmail).not.toHaveBeenCalled();
  });
});

describe("B4 : l'information de l'entreprise", () => {
  const faits = () => {
    vi.setSystemTime(J1_12H);
    h.journal = [
      ...demandeFaite(J3_10H),
      { enrollmentId: "enr-1", objet: "presence_confirmation", rang: 2, creeLe: J2_10H },
    ];
  };

  it("part seule à J-1 à 12 h : gabarit entreprise, entityType Enrollment, trace entreprise", async () => {
    faits();
    const bilan = await envoyerConfirmationsPresence(J1_12H);
    expect(bilan.informations).toBe(1);
    const [gabarit, to, , , options] = enqueueEmail.mock.calls[0] as [
      string,
      string,
      string,
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(gabarit).toBe("qualiopi-presence-entreprise");
    expect(to).toBe("alex@lumen.fr");
    expect(options).toMatchObject({
      jobId: "presence-information_entreprise-enr-1",
      entityType: "Enrollment",
      entityId: "enr-1",
    });
    expect(db.remiseRetour.create.mock.calls[0]?.[0].data).toMatchObject({
      nature: "remise",
      objet: "presence_info_entreprise",
      destinataire: "entreprise",
      canal: "email",
    });
    expect(db.relanceJournal.create.mock.calls[0]?.[0].data).toMatchObject({
      objet: "presence_info_entreprise",
      destinataire: "entreprise",
      rang: 1,
      automatique: true,
    });
  });

  it("le payload a EXACTEMENT les clés permises, et rien de sensible", async () => {
    faits();
    await envoyerConfirmationsPresence(J1_12H);
    const payload = enqueueEmail.mock.calls[0]?.[3] as Record<string, unknown>;
    expect(Object.keys(payload).sort()).toEqual(
      [
        "contactNom",
        "dateDebutFormation",
        "raisonSociale",
        "stagiairePrenomNom",
        "titreFormation",
      ].sort(),
    );
    const brut = JSON.stringify(payload).toLowerCase();
    for (const interdit of ["adapt", "handicap", "aménag", "santé"]) {
      expect(brut).not.toContain(interdit);
    }
  });

  it("le même texte pour « non » et pour pas de réponse : le payload est identique", async () => {
    faits();
    await envoyerConfirmationsPresence(J1_12H);
    const sansReponse = enqueueEmail.mock.calls[0]?.[3];
    h.journal = h.journal.filter((j) => j.objet !== "presence_info_entreprise");
    enqueueEmail.mockClear();
    h.reponses = [{ enrollmentId: "enr-1", objet: "presence_confirmation:non", survenuLe: J2_10H }];
    await envoyerConfirmationsPresence(J1_12H);
    expect(enqueueEmail.mock.calls[0]?.[3]).toEqual(sansReponse);
  });

  it("pas d'information quand le stagiaire a confirmé (dernière réponse « oui »)", async () => {
    faits();
    h.reponses = [
      { enrollmentId: "enr-1", objet: "presence_confirmation:non", survenuLe: J3_10H },
      { enrollmentId: "enr-1", objet: "presence_confirmation:oui", survenuLe: J2_10H },
    ];
    await envoyerConfirmationsPresence(J1_12H);
    expect(enqueueEmail).not.toHaveBeenCalled();
  });

  it("enrollment.client passe avant session.client", async () => {
    faits();
    h.sessions = [
      session({}, [
        inscription({
          client: { raisonSociale: "Payeur SA", contactNom: "Pat", contactEmail: "pat@payeur.fr" },
        }),
      ]),
    ];
    await envoyerConfirmationsPresence(J1_12H);
    expect(enqueueEmail.mock.calls[0]?.[1]).toBe("pat@payeur.fr");
    expect((enqueueEmail.mock.calls[0]?.[3] as Record<string, unknown>)["raisonSociale"]).toBe(
      "Payeur SA",
    );
  });

  it("sans contactEmail : ni envoi ni trace", async () => {
    faits();
    h.sessions = [
      session({ client: { raisonSociale: "Atelier Lumen", contactNom: "A", contactEmail: null } }),
    ];
    await envoyerConfirmationsPresence(J1_12H);
    expect(enqueueEmail).not.toHaveBeenCalled();
    expect(db.relanceJournal.create).not.toHaveBeenCalled();
    expect(db.remiseRetour.create).not.toHaveBeenCalled();
  });

  it("le stagiaire est lui-même le contact : l'e-mail part quand même, et il est tracé", async () => {
    faits();
    h.sessions = [
      session({
        client: {
          raisonSociale: "Atelier Lumen",
          contactNom: "Camille Dupont",
          contactEmail: "camille@exemple.fr",
        },
      }),
    ];
    await envoyerConfirmationsPresence(J1_12H);
    expect(enqueueEmail).toHaveBeenCalledTimes(1);
    expect(db.relanceJournal.create).toHaveBeenCalledTimes(1);
  });

  it("une information déjà partie ne repart pas", async () => {
    faits();
    await envoyerConfirmationsPresence(J1_12H);
    enqueueEmail.mockClear();
    await envoyerConfirmationsPresence(new Date(J1_12H.getTime() + 3_600_000));
    expect(enqueueEmail).not.toHaveBeenCalled();
  });
});
