/**
 * 🔴 UN ENVOI AUTOMATIQUE RATÉ REPART AU PASSAGE SUIVANT — PAS LE LENDEMAIN.
 *
 * Relecture exactitude de #1096 (review 5209451470), déroulé rejoué heure par
 * heure :
 *
 *  · 17/09 00:05 UTC — le passage horaire fabrique le jeton, la mise en file
 *    échoue (Redis indisponible) : `envoyeAt` reste nul ;
 *  · les passages suivants lisaient ce jeton « fabriqué aujourd'hui » — la
 *    raison qui protège un QR de salle — et ne le remplaçaient plus ;
 *  · le lien partait le 18 à 00:05, le lendemain de la formation. Exactement le
 *    symptôme de la session réelle.
 *
 * Le correctif : un jeton dont l'e-mail n'a pas été accepté n'a été remis à
 * personne — son clair est perdu avec la valeur de retour. Il est RÉVOQUÉ sur
 * place. Le passage suivant ne voit plus de lien vivant et ressert l'inscription.
 * Un QR réellement fabriqué pour la salle ne passe jamais par ce chemin : il
 * reste protégé.
 *
 * Le double de Prisma est un petit registre EN MÉMOIRE, pour que la révocation
 * et la sélection du passage suivant se lisent réellement l'une l'autre.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

interface Jeton {
  id: string;
  enrollmentId: string;
  createdAt: Date;
  envoyeAt: Date | null;
  usedAt: Date | null;
  revokedAt: Date | null;
  expiresAt: Date;
}
const registre: Jeton[] = [];
let seq = 0;

const enqueueEmail = vi.fn(async (..._a: unknown[]): Promise<unknown> => ({ enqueued: true }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainingSession: {
      findUnique: vi.fn(async () => ({
        numero: "AXI-SESS-2026-042",
        titreSession: "IA pour bien commencer",
        dateDebut: new Date("2026-09-17T07:00:00Z"),
        dateFin: new Date("2026-09-17T15:00:00Z"),
        enrollments: [
          {
            id: "insc-1",
            trainee: { prenom: "A", nom: "B", email: "a@example.test" },
            emargementTokens: registre
              .filter((j) => j.revokedAt === null && j.expiresAt > new Date())
              .map((j) => ({ envoyeAt: j.envoyeAt, usedAt: j.usedAt, createdAt: j.createdAt })),
          },
        ],
      })),
    },
    emargementToken: {
      update: vi.fn(async (a: { where: { id: string }; data: { envoyeAt: Date } }) => {
        const j = registre.find((x) => x.id === a.where.id);
        if (j) j.envoyeAt = a.data.envoyeAt;
        return j;
      }),
      updateMany: vi.fn(
        async (a: {
          where: { id: string; envoyeAt?: null; revokedAt?: null };
          data: { revokedAt: Date };
        }) => {
          let count = 0;
          for (const j of registre) {
            if (j.id !== a.where.id || j.revokedAt !== null || j.envoyeAt !== null) continue;
            j.revokedAt = a.data.revokedAt;
            count++;
          }
          return { count };
        },
      ),
    },
  },
}));
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: (...a: unknown[]) => enqueueEmail(...a),
}));
vi.mock("@/server/email/suppression", () => ({
  verdictAvantEnvoi: async () => ({ retenu: false }),
}));
vi.mock("@/server/qualiopi/emargement/token-service", () => ({
  // Le vrai contrat : un seul jeton vivant, toute création révoque le précédent.
  creerTokenInscription: async (input: { enrollmentId: string }) => {
    const maintenant = new Date();
    for (const j of registre) {
      if (j.enrollmentId === input.enrollmentId && j.revokedAt === null) j.revokedAt = maintenant;
    }
    const j: Jeton = {
      id: `jeton-${++seq}`,
      enrollmentId: input.enrollmentId,
      createdAt: maintenant,
      envoyeAt: null,
      usedAt: null,
      revokedAt: null,
      expiresAt: new Date("2026-09-19T15:00:00Z"),
    };
    registre.push(j);
    return { token: "t".repeat(64), tokenId: j.id, expiresAt: j.expiresAt };
  },
  TokenEmargementError: class extends Error {},
}));
vi.mock("@/server/qualiopi/inscriptions/inscriptions-actives", () => ({
  inscriptionsActives: () => ({}),
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { envoyerLiensPourSession } from "../envoi-liens";

async function passage(iso: string) {
  vi.setSystemTime(new Date(iso));
  return envoyerLiensPourSession({ sessionId: "s1", origine: "cron-j0", cible: "sans_lien_remis" });
}

beforeEach(() => {
  registre.length = 0;
  seq = 0;
  vi.clearAllMocks();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("🔴 déroulé heure par heure du 17/09 (session 09:00–17:00 Paris)", () => {
  it("file en panne à 00:05 UTC → le lien part à 01:05 UTC, pas le lendemain", async () => {
    enqueueEmail.mockResolvedValueOnce({ enqueued: false }); // 00:05 : Redis absent
    enqueueEmail.mockResolvedValue({ enqueued: true });

    await passage("2026-09-17T00:05:00Z");
    // Le jeton fabriqué pour un e-mail qui n'est pas parti n'est entre les mains
    // de personne : il ne doit pas survivre vivant.
    expect(registre.filter((j) => j.revokedAt === null)).toHaveLength(0);

    const r = await passage("2026-09-17T01:05:00Z");
    expect(r).toMatchObject({ ok: true, envoyes: 1 });
    expect(enqueueEmail).toHaveBeenCalledTimes(2);

    // Et plus rien ensuite : le lien parti est remis, un seul envoi réussi.
    for (const h of ["02:05", "06:05", "15:05", "22:05"]) {
      await passage(`2026-09-17T${h}:00Z`);
    }
    expect(enqueueEmail).toHaveBeenCalledTimes(2);
    const vivants = registre.filter((j) => j.revokedAt === null);
    expect(vivants).toHaveLength(1);
    expect(vivants[0]?.envoyeAt).toBeInstanceOf(Date);
  });

  it("un e-mail GARÉ en validation n'est pas révoqué : il partira à l'approbation", async () => {
    enqueueEmail.mockResolvedValue({ enqueued: false, garePourValidation: true });
    await passage("2026-09-17T00:05:00Z");
    expect(registre.filter((j) => j.revokedAt === null)).toHaveLength(1);
  });

  it("une mise en file qui LÈVE révoque aussi le jeton, et le passage suivant ressert", async () => {
    enqueueEmail.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    enqueueEmail.mockResolvedValue({ enqueued: true });
    await passage("2026-09-17T00:05:00Z");
    expect(registre.filter((j) => j.revokedAt === null)).toHaveLength(0);
    const r = await passage("2026-09-17T01:05:00Z");
    expect(r).toMatchObject({ ok: true, envoyes: 1 });
  });

  it("contre-témoin : un QR fabriqué en salle le matin même reste intouché", async () => {
    // Fabriqué par « Émettre les liens », jamais par ce service : aucune
    // révocation « d'envoi raté » ne peut l'atteindre.
    registre.push({
      id: "qr-salle",
      enrollmentId: "insc-1",
      createdAt: new Date("2026-09-17T06:30:00Z"),
      envoyeAt: null,
      usedAt: null,
      revokedAt: null,
      expiresAt: new Date("2026-09-19T15:00:00Z"),
    });
    for (const h of ["07:05", "08:05", "12:05"]) await passage(`2026-09-17T${h}:00Z`);
    expect(enqueueEmail).not.toHaveBeenCalled();
    expect(registre.find((j) => j.id === "qr-salle")?.revokedAt).toBeNull();
  });
});
