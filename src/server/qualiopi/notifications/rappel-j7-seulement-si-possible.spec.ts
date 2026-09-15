/**
 * 🔴 24 H D'AVANCE ÉTAIT NÉCESSAIRE, PAS SUFFISANT.
 *
 * #1066 a cessé de lever `rappel_j7_non_envoye` pour une session créée moins de
 * 24 h avant son début. Mais l'envoyeur réel ne passe qu'UNE fois par jour, à
 * 08:00 UTC, et il exige que la convocation de chaque inscrit soit partie depuis
 * au moins 24 h. Une session créée 30 ou 40 h avant son début ne rencontre donc
 * AUCUN passage où le rappel pouvait partir — et recevait quand même l'alerte
 * « Rappel J-7 jamais envoyé ».
 *
 * Ce fichier joue la lecture de la règle, heure par heure, sur des sessions dont
 * la convocation porte l'horodatage qu'écrirait le cron HORAIRE de convocation.
 * Chaque cas donne l'heure UTC et l'heure de Paris : l'envoyeur passe à 10:00 à
 * Paris l'été, à 09:00 l'hiver.
 *
 * 🔑 DEUX SENS, comme toujours : un cas « possible » qui ne remonterait plus
 * serait un faux négatif — une règle éteinte ressemble à « rien à signaler ».
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const findMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { trainingSession: { findMany: (...a: unknown[]) => findMany(...a) } },
}));
vi.mock("@/server/qualiopi/inscriptions/inscriptions-actives", () => ({
  inscriptionsActives: () => ({ statut: { notIn: ["abandon", "exclu"] } }),
}));

import { sessionsSansRappelJ7 } from "./rappel-j7-manquant";

const HEURE = 60 * 60 * 1000;
const JOUR = 24 * HEURE;
const z = (iso: string) => new Date(iso);

/** Lecture le lendemain d'une session commencée : dans la fenêtre de constat. */
const MAINTENANT = z("2026-10-28T12:00:00.000Z");

/**
 * L'horodatage qu'écrit le cron de convocation : horaire (`0 * * * *`), il ne
 * convoque qu'à 5,5 jours du début au plus tôt, et pose `new Date()` quelques
 * secondes après l'heure pile.
 */
function convoqueParLeCron(inscritLe: Date, debut: Date): Date {
  const auPlusTot = Math.max(inscritLe.getTime(), debut.getTime() - 5.5 * JOUR);
  return new Date(Math.floor(auPlusTot / HEURE) * HEURE + HEURE + 5_000);
}

interface Inscrit {
  createdAt: Date;
  convocationEnvoyeeAt: Date | null;
}

function session(numero: string, creeLe: Date, debut: Date, inscrits?: Inscrit[]) {
  return {
    id: `id-${numero}`,
    numero,
    titreSession: "IA pour bien commencer",
    dateDebut: debut,
    createdAt: creeLe,
    enrollments: inscrits ?? [
      { createdAt: creeLe, convocationEnvoyeeAt: convoqueParLeCron(creeLe, debut) },
    ],
  };
}

async function remonte(s: ReturnType<typeof session>): Promise<boolean> {
  findMany.mockResolvedValue([s]);
  const r = await sessionsSansRappelJ7(MAINTENANT);
  return r.some((x) => x.numero === s.numero);
}

beforeEach(() => {
  findMany.mockReset();
});

// Début : mardi 22/09/2026 07:00 UTC = 09:00 Paris (heure d'été).
const DEBUT = z("2026-09-22T07:00:00.000Z");
const avant = (heures: number) => new Date(DEBUT.getTime() - heures * HEURE);

describe("avance de création — le passage de 08:00 UTC décide, pas un seuil d'heures", () => {
  it("23 h (créée lun. 21/09 08:00 UTC, 10:00 Paris) → impossible, rien ne remonte", async () => {
    // Convoquée 09:00 → 24 h plus tard, la session a commencé depuis deux heures.
    expect(await remonte(session("H23", avant(23), DEBUT))).toBe(false);
  });

  it("🔴 30 h (créée lun. 21/09 01:00 UTC, 03:00 Paris) → impossible, rien ne remonte", async () => {
    // Convoquée 02:00 → mûre mar. 22/09 02:00 → premier passage mar. 08:00,
    // une heure APRÈS le début. Aucun passage n'a pu tirer.
    expect(await remonte(session("H30", avant(30), DEBUT))).toBe(false);
  });

  it("🔴 40 h (créée dim. 20/09 15:00 UTC, 17:00 Paris) → impossible, rien ne remonte", async () => {
    // Convoquée 16:00 → mûre lun. 21/09 16:00 : le passage de lun. 08:00 est
    // déjà passé, celui de mar. 08:00 tombe après le début.
    expect(await remonte(session("H40", avant(40), DEBUT))).toBe(false);
  });

  it("🔑 50 h (créée dim. 20/09 05:00 UTC, 07:00 Paris) → POSSIBLE, l'écart remonte", async () => {
    // Convoquée 06:00 → mûre lun. 21/09 06:00 → passage lun. 08:00 (10:00 Paris),
    // 23 h avant le début. Le rappel pouvait partir : c'est un vrai raté.
    expect(await remonte(session("H50", avant(50), DEBUT))).toBe(true);
  });

  it("🔑 60 h (créée sam. 19/09 19:00 UTC, 21:00 Paris) → POSSIBLE, l'écart remonte", async () => {
    expect(await remonte(session("H60", avant(60), DEBUT))).toBe(true);
  });

  it("🔑 8 jours (créée lun. 14/09 07:00 UTC) → POSSIBLE, l'écart remonte", async () => {
    // Convoquée à J-5,5 (mer. 16/09 20:00) → passage ven. 18/09 08:00.
    expect(await remonte(session("J8", avant(8 * 24), DEBUT))).toBe(true);
  });

  it("à avance ÉGALE (45 h), l'heure du début tranche : 07:59 UTC non, 08:30 UTC oui", async () => {
    // Un seuil d'heures ne peut pas rendre ces deux réponses différentes. Seul
    // le calendrier de l'envoyeur le peut.
    const tot = z("2026-09-22T07:59:00.000Z"); // 09:59 Paris
    const tard = z("2026-09-22T08:30:00.000Z"); // 10:30 Paris
    const moins45 = (d: Date) => new Date(d.getTime() - 45 * HEURE);
    expect(await remonte(session("TOT", moins45(tot), tot))).toBe(false);
    expect(await remonte(session("TARD", moins45(tard), tard))).toBe(true);
  });
});

describe("convocation partie tard", () => {
  const cree = avant(8 * 24);

  it("🔴 session créée 8 j avant, mais convocation partie lun. 21/09 12:00 UTC → impossible", async () => {
    const s = session("CONV-TARD", cree, DEBUT, [
      { createdAt: cree, convocationEnvoyeeAt: z("2026-09-21T12:00:00.000Z") },
    ]);
    expect(await remonte(s)).toBe(false);
  });

  it("🔴 un SEUL inscrit présent depuis le début, convoqué tard, bloque toute la session", async () => {
    // L'envoyeur exige que CHAQUE inscrit présent soit convoqué depuis 24 h.
    const s = session("UN-BLOQUE", cree, DEBUT, [
      { createdAt: cree, convocationEnvoyeeAt: convoqueParLeCron(cree, DEBUT) },
      { createdAt: cree, convocationEnvoyeeAt: z("2026-09-21T12:00:00.000Z") },
    ]);
    expect(await remonte(s)).toBe(false);
  });

  it("🔑 un inscrit AJOUTÉ tard ne masque pas le raté des autres (aucun faux négatif)", async () => {
    // Avant son arrivée, l'envoyeur ne voyait que le premier inscrit, convoqué
    // depuis longtemps : le rappel pouvait partir ven. 18/09 08:00.
    const arrive = z("2026-09-21T11:00:00.000Z");
    const s = session("AJOUT-TARD", cree, DEBUT, [
      { createdAt: cree, convocationEnvoyeeAt: convoqueParLeCron(cree, DEBUT) },
      { createdAt: arrive, convocationEnvoyeeAt: convoqueParLeCron(arrive, DEBUT) },
    ]);
    expect(await remonte(s)).toBe(true);
  });

  it("🔑 convocation tardive mais encore à temps (dim. 20/09 07:30 UTC) → possible", async () => {
    const s = session("CONV-A-TEMPS", cree, DEBUT, [
      { createdAt: cree, convocationEnvoyeeAt: z("2026-09-20T07:30:00.000Z") },
    ]);
    expect(await remonte(s)).toBe(true);
  });

  it("🔑 convocation JAMAIS partie sur une session de 8 j → l'écart remonte", async () => {
    // Le cron de convocation pouvait la produire : le rappel manqué n'est pas
    // excusé par une convocation manquée.
    const s = session("JAMAIS", cree, DEBUT, [{ createdAt: cree, convocationEnvoyeeAt: null }]);
    expect(await remonte(s)).toBe(true);
  });

  it("🔴 unique inscrit ajouté 20 h avant le début, jamais convoqué → impossible", async () => {
    const s = session("INSCRIT-20H", cree, DEBUT, [
      { createdAt: avant(20), convocationEnvoyeeAt: null },
    ]);
    expect(await remonte(s)).toBe(false);
  });

  it("course au passage : convoquée à 08:00:05 la veille → signalée (échec ouvert)", async () => {
    // Le rappel de 08:00 et la convocation de 08:00 tournent à la même minute :
    // selon l'ordre d'exécution, la convocation a 24 h ou pas. Dans le doute, on
    // signale.
    const debut = z("2026-09-22T12:00:00.000Z");
    const s = session("COURSE", cree, debut, [
      { createdAt: cree, convocationEnvoyeeAt: z("2026-09-21T08:00:05.000Z") },
    ]);
    expect(await remonte(s)).toBe(true);
  });

  it("🔴 convoquée à 09:00:05 la veille, début 12:00 UTC → impossible", async () => {
    const debut = z("2026-09-22T12:00:00.000Z");
    const s = session("APRES-PASSAGE", cree, debut, [
      { createdAt: cree, convocationEnvoyeeAt: z("2026-09-21T09:00:05.000Z") },
    ]);
    expect(await remonte(s)).toBe(false);
  });
});

describe("heure d'été / heure d'hiver — même heure murale à Paris, réponse différente", () => {
  it("🔴 été : lun. 19/10 09:30 Paris = 07:30 UTC, créée 31 h avant → impossible", async () => {
    // Le passage de 08:00 UTC tombe à 10:00 Paris : après le début.
    const debut = z("2026-10-19T07:30:00.000Z");
    expect(await remonte(session("ETE", new Date(debut.getTime() - 31 * HEURE), debut))).toBe(
      false,
    );
  });

  it("🔑 hiver : lun. 26/10 09:30 Paris = 08:30 UTC, créée 31 h avant → possible", async () => {
    // Créée dans la nuit du changement d'heure (dim. 25/10 01:30 UTC = 02:30
    // Paris). Le passage de 08:00 UTC tombe à 09:00 Paris : avant le début.
    const debut = z("2026-10-26T08:30:00.000Z");
    expect(await remonte(session("HIVER", new Date(debut.getTime() - 31 * HEURE), debut))).toBe(
      true,
    );
  });
});

describe("date de début AVANCÉE après la création — l'avance ne se lit plus sur `createdAt`", () => {
  const cree = z("2026-09-01T10:00:00.000Z"); // prévue pour le 30/09

  it("🔴 avancée le 20/09 15:10 UTC au 22/09 06:00 UTC → impossible malgré 21 j depuis la création", async () => {
    // Le cron de convocation a convoqué au passage suivant le changement
    // (20/09 16:00) : mûre le 21/09 16:00, trop tard pour le 21/09 08:00.
    const debut = z("2026-09-22T06:00:00.000Z");
    const s = session("AVANCEE", cree, debut, [
      { createdAt: cree, convocationEnvoyeeAt: z("2026-09-20T16:00:05.000Z") },
    ]);
    expect(await remonte(s)).toBe(false);
  });

  it("🔑 avancée au 23/09 15:00 UTC → possible (passage du 22/09 08:00), l'écart remonte", async () => {
    const debut = z("2026-09-23T15:00:00.000Z");
    const s = session("AVANCEE-A-TEMPS", cree, debut, [
      { createdAt: cree, convocationEnvoyeeAt: z("2026-09-20T16:00:05.000Z") },
    ]);
    expect(await remonte(s)).toBe(true);
  });
});

describe("la lecture", () => {
  it("discrimine dans un même lot, dans l'ordre", async () => {
    findMany.mockResolvedValue([
      session("H30", avant(30), DEBUT),
      session("H60", avant(60), DEBUT),
      session("H40", avant(40), DEBUT),
      session("J8", avant(8 * 24), DEBUT),
    ]);
    const r = await sessionsSansRappelJ7(MAINTENANT);
    expect(r.map((s) => s.numero)).toEqual(["H60", "J8"]);
    // Ce qui sert au calcul ne sort pas.
    expect(r[0]).not.toHaveProperty("createdAt");
    expect(r[0]).not.toHaveProperty("enrollments");
  });

  it("demande à la base les dates d'inscription et de convocation des inscrits ACTIFS", async () => {
    // Un champ non sélectionné ne rougit pas : il rend `undefined`.
    findMany.mockResolvedValue([]);
    await sessionsSansRappelJ7(MAINTENANT);
    const args = findMany.mock.calls[0]?.[0] as {
      select: {
        createdAt?: boolean;
        enrollments?: { where?: unknown; select?: Record<string, boolean> };
      };
    };
    expect(args.select.createdAt).toBe(true);
    expect(args.select.enrollments?.where).toEqual({ statut: { notIn: ["abandon", "exclu"] } });
    expect(args.select.enrollments?.select?.["createdAt"]).toBe(true);
    expect(args.select.enrollments?.select?.["convocationEnvoyeeAt"]).toBe(true);
  });

  it("échoue OUVERT : une date illisible garde l'alerte, elle ne la ferme pas", async () => {
    // Une session de 30 h ne remonterait pas. Mais si la lecture rend une date
    // invalide, on ne sait pas — et ne pas savoir ne ferme pas une alerte.
    const s = session("ILLISIBLE", avant(30), DEBUT, [
      { createdAt: avant(30), convocationEnvoyeeAt: new Date(Number.NaN) },
    ]);
    expect(await remonte(s)).toBe(true);
    const sansDate = session("SANS-DATE", avant(30), DEBUT, [
      { createdAt: undefined as unknown as Date, convocationEnvoyeeAt: null },
    ]);
    expect(await remonte(sansDate)).toBe(true);
  });
});
