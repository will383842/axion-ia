/**
 * Lot C (M19, côté formateur) — la convocation J-7 d'un formateur INDÉPENDANT porte la
 * ligne « lettre à signer » (si elle ne l'est pas), l'agenda joint, et lève une alerte
 * interne ; rien ne change pour un salarié, ni interrupteur éteint, ni au rappel J-1.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  trainer: { statut: "sous_traitant", organismeSousTraitantId: null as string | null },
  signee: false,
  allume: true,
  enqueue: vi.fn(async (..._a: unknown[]) => ({ enqueued: true })),
  telegram: vi.fn(async (..._a: unknown[]) => true),
  upload: vi.fn(async (..._a: unknown[]) => ({})),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    sessionFormateur: {
      findUnique: async () => ({
        trainerId: "t1",
        trainer: { email: "m@ex.test", prenom: "Marie", nom: "Durand", ...h.trainer },
        session: {
          id: "s1",
          numero: "S-1",
          titreSession: "IA",
          formationId: "f1",
          dateDebut: new Date("2026-10-20T07:00:00Z"),
          dateFin: new Date("2026-10-20T15:00:00Z"),
          modalite: "presentiel",
          nbParticipantsPrevus: 8,
          lieuType: "distanciel",
          lieuIntitule: null,
          lieuAdresse: null,
          lieuCodePostal: null,
          lieuVille: null,
          lieuSalle: null,
          lieuVisioUrl: null,
          contactSurPlaceNom: null,
          contactSurPlaceTelephone: null,
          consignesAcces: null,
          jours: [
            { date: new Date("2026-10-20T00:00:00Z"), heureDebut: "09:00", heureFin: "17:00" },
          ],
          _count: { enrollments: 0 },
        },
      }),
      update: async () => ({}),
    },
    missionFormateur: {
      findFirst: async () => ({
        statut: "acceptee",
        lettreMissionId: "d1",
        lettreMission: {
          annuleeAt: null,
          signatures: h.signee ? [{ partie: "formateur" }] : [],
        },
      }),
    },
    supportFormation: { findFirst: async () => null },
  },
}));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: h.enqueue }));
vi.mock("@/lib/telegram", () => ({ sendTelegram: h.telegram }));
vi.mock("@/lib/r2-storage", () => ({ uploadToR2: h.upload }));
vi.mock("@/server/qualiopi/formateurs-independants/interrupteurs-envoi", () => ({
  envoiAllume: async () => h.allume,
}));

import { envoyerConvocationJ7Formateur, envoyerRappelJ1Formateur } from "./convocation-formateur";

const appel = () =>
  h.enqueue.mock.calls[0] as unknown as [
    string,
    string,
    string,
    Record<string, unknown>,
    Record<string, unknown>,
  ];

beforeEach(() => {
  h.trainer = { statut: "sous_traitant", organismeSousTraitantId: null };
  h.signee = false;
  h.allume = true;
  h.enqueue.mockClear();
  h.telegram.mockClear();
  h.upload.mockClear();
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://exemple.test");
  vi.stubEnv("DATABASE_URL", "postgresql://x");
});

describe("convocation J-7 d'un indépendant", () => {
  it("lettre non signée : ligne + lien, agenda joint, alerte interne sans nom", async () => {
    await envoyerConvocationJ7Formateur("sf1");
    const [, , , payload, options] = appel();
    expect(payload.lienLettre).toBe("https://exemple.test/fr/espace-formateur?lettre=d1");
    expect(options.attachments).toEqual([
      { filename: "session.ics", r2Key: "agenda-formateur/sf1.ics", contentType: "text/calendar" },
    ]);
    expect(h.upload).toHaveBeenCalledTimes(1);
    expect(h.telegram).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(h.telegram.mock.calls)).not.toMatch(/Marie|Durand/);
  });

  it("lettre déjà signée : pas de ligne, pas d'alerte, l'agenda reste joint", async () => {
    h.signee = true;
    await envoyerConvocationJ7Formateur("sf1");
    const [, , , payload, options] = appel();
    expect(payload.lienLettre).toBeUndefined();
    expect(options.attachments).toHaveLength(1);
    expect(h.telegram).not.toHaveBeenCalled();
  });

  it("interrupteur éteint : le message d'avant", async () => {
    h.allume = false;
    await envoyerConvocationJ7Formateur("sf1");
    const [, , , payload, options] = appel();
    expect(payload.lienLettre).toBeUndefined();
    expect(options.attachments).toBeUndefined();
    expect(h.telegram).not.toHaveBeenCalled();
    expect(h.upload).not.toHaveBeenCalled();
  });

  it("salarié : le message d'avant", async () => {
    h.trainer = { statut: "salarie", organismeSousTraitantId: null };
    await envoyerConvocationJ7Formateur("sf1");
    const [, , , payload, options] = appel();
    expect(payload.lienLettre).toBeUndefined();
    expect(options.attachments).toBeUndefined();
  });

  it("rappel J-1 : jamais de ligne ni d'agenda", async () => {
    await envoyerRappelJ1Formateur("sf1");
    const [, , , payload, options] = appel();
    expect(payload.lienLettre).toBeUndefined();
    expect(options.attachments).toBeUndefined();
    expect(h.telegram).not.toHaveBeenCalled();
  });
});
