/**
 * 🔴 UNE DEMANDE DE CONTRESIGNATURE PAR JOURNÉE SIGNÉE — LE SOIR, JAMAIS LA NUIT.
 *
 * Relecture exactitude de #1096 (review 5209451470). L'idempotence portait sur
 * le jour civil de Paris. Sur une session de trois jours sans réaction :
 * demande le 16 à 17:25, deuxième envoi le 17 à 00:25 (la clé du 17 est libre),
 * rien le soir du 17 (clé prise), troisième envoi le 18 à 00:25, rien pour le
 * 18. Des e-mails en pleine nuit, et deux journées jamais demandées.
 *
 * Ce que la console affiche — « le soir de chaque journée signée » — devient
 * vrai : chaque journée a sa propre demande, envoyée après sa fin, rappelée au
 * plus deux fois à un jour d'écart, et rien entre 21:00 et 08:00 à Paris.
 *
 * Et un envoi que la chaîne n'a pas pu faire partir (`failed`) ne consomme ni
 * un des trois envois, ni la place du jour.
 *
 * Le journal des envois est un registre EN MÉMOIRE, lu et écrit par le service
 * au fil des passages : c'est lui qui porte l'idempotence, il doit être réel.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

interface Log {
  jobId: string;
  status: "pending" | "sent" | "failed";
  createdAt: Date;
}
const journal: Log[] = [];
const envois: Array<{ at: Date; demiJournees: string[]; payload: Record<string, unknown> }> = [];
let sessionsCourantes: unknown[] = [];

const enqueueEmail = vi.fn(
  async (
    _t: string,
    _to: string,
    _l: string,
    payload: Record<string, unknown>,
    o: { jobId: string },
  ) => {
    journal.push({ jobId: o.jobId, status: "pending", createdAt: new Date() });
    envois.push({
      at: new Date(),
      demiJournees: (payload["demiJournees"] as string[]) ?? [],
      payload,
    });
    return { enqueued: true };
  },
);

const correspond = (l: Log, where: Record<string, unknown>): boolean => {
  const j = where["jobId"];
  if (typeof j === "string" && l.jobId !== j) return false;
  if (j !== null && typeof j === "object") {
    const o = j as { startsWith?: string; contains?: string };
    if (o.startsWith !== undefined && !l.jobId.startsWith(o.startsWith)) return false;
    if (o.contains !== undefined && !l.jobId.includes(o.contains)) return false;
  }
  const c = where["createdAt"] as { gt?: Date } | undefined;
  if (c?.gt !== undefined && !(l.createdAt > c.gt)) return false;
  const st = where["status"] as { not?: string; notIn?: string[] } | undefined;
  if (st?.not !== undefined && l.status === st.not) return false;
  if (st?.notIn !== undefined && st.notIn.includes(l.status)) return false;
  return true;
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainingSession: { findMany: vi.fn(async () => sessionsCourantes) },
    trainer: {
      findUnique: vi.fn(async () => ({ email: "formateur@example.test", prenom: "C", nom: "D" })),
    },
    emailLog: {
      findFirst: vi.fn(
        async (a: { where: Record<string, unknown> }) =>
          journal.find((l) => correspond(l, a.where)) ?? null,
      ),
      count: vi.fn(
        async (a: { where: Record<string, unknown> }) =>
          journal.filter((l) => correspond(l, a.where)).length,
      ),
      findMany: vi.fn(async (a: { where: Record<string, unknown> }) =>
        journal.filter((l) => correspond(l, a.where)),
      ),
    },
  },
}));
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: (...a: Parameters<typeof enqueueEmail>) => enqueueEmail(...a),
}));
vi.mock("@/server/email/suppression", () => ({
  verdictAvantEnvoi: async () => ({ retenu: false }),
}));

import { envoyerDemandesContresignature } from "../demande-contresignature";

const jourDb = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/** Heure de Paris (0-23) d'un instant. */
const heureParis = (d: Date) =>
  Number(
    new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", hour12: false })
      .formatToParts(d)
      .find((p) => p.type === "hour")?.value,
  );

/** Une session signée par un stagiaire, jamais contresignée. */
function sessionSignee(dates: string[]) {
  return (maintenant: Date) => [
    {
      id: "sess-1",
      numero: "AXI-SESS-2026-042",
      titreSession: "IA pour bien commencer",
      formateurPrincipalId: "t-1",
      sessionFormateurs: [],
      jours: dates.map((d) => ({
        date: jourDb(d),
        heureDebut: "09:00",
        heureFin: "17:00",
        trainerId: null,
      })),
      emargementContresignatures: [],
      enrollments: [
        {
          // Les signatures n'existent qu'une fois la demi-journée commencée.
          presences: dates
            .filter((d) => jourDb(d).getTime() <= maintenant.getTime())
            .flatMap((d) => [
              { date: jourDb(d), demiJournee: "matin" },
              { date: jourDb(d), demiJournee: "apres_midi" },
            ]),
        },
      ],
    },
  ];
}

async function rejouer(
  debut: string,
  heures: number,
  fabrique: (m: Date) => unknown[],
  apres?: (m: Date) => void,
) {
  for (let h = 0; h < heures; h++) {
    const m = new Date(new Date(debut).getTime() + h * 3_600_000);
    vi.setSystemTime(m);
    sessionsCourantes = fabrique(m);
    await envoyerDemandesContresignature(m);
    apres?.(m);
  }
}

/** Les envois qui réclament une journée donnée (« 16 septembre »). */
const envoisPour = (motif: string) =>
  envois.filter((e) => e.demiJournees.some((d) => d.includes(motif)));

beforeEach(() => {
  journal.length = 0;
  envois.length = 0;
  vi.clearAllMocks();
  vi.useFakeTimers();
  delete process.env["DATABASE_URL"];
});
afterEach(() => vi.useRealTimers());

describe("🔴 session de trois jours (16-18/09), aucune réaction du formateur", () => {
  beforeEach(async () => {
    await rejouer(
      "2026-09-16T00:25:00Z",
      24 * 6,
      sessionSignee(["2026-09-16", "2026-09-17", "2026-09-18"]),
    );
  });

  it("aucun envoi entre 21:00 et 08:00, heure de Paris", () => {
    expect(envois.length).toBeGreaterThan(0);
    for (const e of envois) {
      const h = heureParis(e.at);
      expect(h >= 8 && h < 21, `envoi à ${h} h (Paris) le ${e.at.toISOString()}`).toBe(true);
    }
  });

  it("CHAQUE journée est demandée le soir même de sa fin (17:25 Paris)", () => {
    for (const [motif, attendu] of [
      ["16 septembre", "2026-09-16T15:25:00.000Z"],
      ["17 septembre", "2026-09-17T15:25:00.000Z"],
      ["18 septembre", "2026-09-18T15:25:00.000Z"],
    ] as const) {
      expect(envoisPour(motif)[0]?.at.toISOString(), `journée du ${motif}`).toBe(attendu);
    }
  });

  it("chaque journée : une demande et deux rappels, à au moins 23 h d'écart, puis rien", () => {
    for (const motif of ["16 septembre", "17 septembre", "18 septembre"]) {
      const liste = envoisPour(motif);
      expect(liste, `journée du ${motif}`).toHaveLength(3);
      for (let i = 1; i < liste.length; i++) {
        const ecart = liste[i]!.at.getTime() - liste[i - 1]!.at.getTime();
        expect(ecart).toBeGreaterThanOrEqual(23 * 3_600_000);
      }
    }
  });
});

describe("🔴 changement d'heure (fin de l'heure d'été, 25/10/2026)", () => {
  beforeEach(async () => {
    await rejouer("2026-10-24T00:25:00Z", 24 * 5, sessionSignee(["2026-10-24", "2026-10-25"]));
  });

  it("17:25 à Paris des deux côtés du changement d'heure", () => {
    // 24/10 en heure d'été (UTC+2) ; 25/10 en heure d'hiver (UTC+1).
    expect(envoisPour("24 octobre")[0]?.at.toISOString()).toBe("2026-10-24T15:25:00.000Z");
    expect(envoisPour("25 octobre")[0]?.at.toISOString()).toBe("2026-10-25T16:25:00.000Z");
  });

  it("jamais la nuit, même la nuit du changement", () => {
    for (const e of envois) {
      const h = heureParis(e.at);
      expect(h >= 8 && h < 21, `envoi à ${h} h (Paris)`).toBe(true);
    }
  });
});

describe("🔴 un envoi en ÉCHEC ne consomme ni un des trois envois, ni la place du jour", () => {
  it("échec à 17:25 → retenté à 18:25 ; trois envois PARTIS au total malgré deux échecs", async () => {
    let echecsRestants = 2;
    await rejouer("2026-09-16T00:25:00Z", 24 * 5, sessionSignee(["2026-09-16"]), () => {
      // Le worker d'e-mail échoue sur les deux premières tentatives.
      const dernier = journal[journal.length - 1];
      if (dernier !== undefined && dernier.status === "pending") {
        dernier.status = echecsRestants > 0 ? "failed" : "sent";
        if (echecsRestants > 0) echecsRestants--;
      }
    });
    const liste = envoisPour("16 septembre");
    expect(liste[0]?.at.toISOString()).toBe("2026-09-16T15:25:00.000Z");
    expect(liste[1]?.at.toISOString(), "l'échec a pris la place du jour").toBe(
      "2026-09-16T16:25:00.000Z",
    );
    const partis = journal.filter((l) => l.status !== "failed");
    expect(partis, "les échecs ont consommé des envois").toHaveLength(3);
  });
});
