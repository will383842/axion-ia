/**
 * 🔴 LES LIENS D'ÉMARGEMENT PARTENT SEULS — À CHAQUE STAGIAIRE, SANS TUER UN LIEN QUI SERT.
 *
 * ## Le défaut, vécu sur la seule session réelle
 *
 * Session réservée la veille (créée le 04/09 à 18:30 pour le 05/09 à 09:00).
 * Les jetons ont été FABRIQUÉS le 04/09 par « Émettre les liens », qui n'envoie
 * rien ; ils sont partis le 06/09 à 16:32, à la main. La stagiaire a signé le
 * lendemain de la formation.
 *
 * Le rattrapage horaire du jour J existait, mais sa garde raisonnait à la maille
 * de la SESSION (« aucun inscrit n'a de lien remis ») et sur les seules premières
 * 24 h. Trois trous restaient ouverts :
 *
 *  1. un seul stagiaire servi — par un renvoi ciblé, par le rappel J-7 — et plus
 *     aucun autre inscrit ne recevait jamais rien ;
 *  2. un inscrit ajouté le deuxième jour d'une session de trois jours n'était
 *     vu par aucun passage ;
 *  3. le rappel J-7 et le rappel de la veille joignent un lien SANS le marquer
 *     remis : le passage du jour J le réémettait, donc le RÉVOQUAIT — deux envois
 *     pour le même créneau, et le premier lien mort dans la boîte.
 *
 * ## Ce que ce fichier garde
 *
 * La maille devient l'INSCRIPTION, et un lien n'est remplacé automatiquement
 * que s'il n'est entre les mains de personne : ni remis, ni ouvert, ni fabriqué
 * aujourd'hui (un QR du jour est à l'écran ou imprimé pour la séance).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const findUnique = vi.fn(async (..._a: unknown[]): Promise<unknown> => null);
const update = vi.fn(async (..._a: unknown[]): Promise<unknown> => ({}));
const enqueueEmail = vi.fn(async (..._a: unknown[]): Promise<unknown> => ({ enqueued: true }));
const verdictAvantEnvoi = vi.fn(async (..._a: unknown[]): Promise<unknown> => ({ retenu: false }));
let compteurJeton = 0;
const creerTokenInscription = vi.fn(async (..._a: unknown[]) => {
  compteurJeton += 1;
  return {
    token: "t".repeat(64),
    tokenId: `jeton-neuf-${compteurJeton}`,
    expiresAt: new Date("2026-09-20T00:00:00Z"),
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainingSession: {
      get findUnique() {
        return findUnique;
      },
    },
    emargementToken: {
      get update() {
        return update;
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
vi.mock("@/server/qualiopi/emargement/token-service", () => ({
  creerTokenInscription: (...a: unknown[]) => creerTokenInscription(...a),
  TokenEmargementError: class extends Error {},
}));
vi.mock("@/server/qualiopi/inscriptions/inscriptions-actives", () => ({
  inscriptionsActives: () => ({}),
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { envoyerLiensPourSession } from "../envoi-liens";
import * as remise from "../remise-lien";

/** Jeudi 17/09/2026, 09:30 à Paris. */
const MAINTENANT = new Date("2026-09-17T07:30:00.000Z");

const jeton = (j: Partial<{ envoyeAt: Date | null; usedAt: Date | null; createdAt: Date }>) => ({
  envoyeAt: null,
  usedAt: null,
  createdAt: new Date("2026-09-15T10:00:00.000Z"),
  ...j,
});

describe("un lien vivant est-il entre les mains de quelqu'un ?", () => {
  it("remis par e-mail → on n'y touche pas", () => {
    expect(
      remise.raisonDeNePasRemplacer(
        jeton({ envoyeAt: new Date("2026-09-16T00:05:00Z") }),
        MAINTENANT,
      ),
    ).toBe("remis");
  });

  it("antérieur à la colonne `envoyeAt` → héritage, on n'y touche pas", () => {
    expect(
      remise.raisonDeNePasRemplacer(
        jeton({ createdAt: new Date("2026-09-04T16:30:00Z") }),
        MAINTENANT,
      ),
    ).toBe("heritage");
  });

  it("déjà OUVERT (QR scanné, lien cliqué) → on n'y touche pas", () => {
    expect(
      remise.raisonDeNePasRemplacer(
        jeton({ usedAt: new Date("2026-09-16T08:00:00Z") }),
        MAINTENANT,
      ),
    ).toBe("ouvert");
  });

  it("fabriqué AUJOURD'HUI (heure de Paris) → QR du jour, on n'y touche pas", () => {
    expect(
      remise.raisonDeNePasRemplacer(
        jeton({ createdAt: new Date("2026-09-17T06:00:00Z") }),
        MAINTENANT,
      ),
    ).toBe("fabrique_aujourdhui");
    // 00:30 à Paris le 17 = 22:30 UTC le 16 : c'est bien « aujourd'hui ».
    expect(
      remise.raisonDeNePasRemplacer(
        jeton({ createdAt: new Date("2026-09-16T22:30:00Z") }),
        MAINTENANT,
      ),
    ).toBe("fabrique_aujourdhui");
  });

  it("🔴 fabriqué UN AUTRE JOUR, jamais envoyé ni ouvert → remplaçable (AXI-SESS-2026-001)", () => {
    expect(
      remise.raisonDeNePasRemplacer(
        jeton({ createdAt: new Date("2026-09-16T16:30:00Z") }),
        MAINTENANT,
      ),
    ).toBeNull();
  });

  it("une inscription attend son lien tant qu'aucun jeton vivant n'est intouchable", () => {
    expect(remise.inscriptionAttendSonLien([], MAINTENANT)).toBe(true);
    expect(
      remise.inscriptionAttendSonLien(
        [jeton({ createdAt: new Date("2026-09-16T16:30:00Z") })],
        MAINTENANT,
      ),
    ).toBe(true);
    expect(
      remise.inscriptionAttendSonLien(
        [jeton({ envoyeAt: new Date("2026-09-16T00:05:00Z") })],
        MAINTENANT,
      ),
    ).toBe(false);
  });

  it("le `where` Prisma et le prédicat disent la MÊME chose", () => {
    // Deux écritures d'une règle — une pour la base, une pour la mémoire — ne
    // tiennent ensemble que si elles vivent côte à côte et se testent ensemble.
    const w = remise.whereJetonIntouchable(MAINTENANT) as {
      revokedAt: null;
      expiresAt: { gt: Date };
      OR: Array<Record<string, unknown>>;
    };
    expect(w.revokedAt).toBeNull();
    expect(w.expiresAt.gt).toEqual(MAINTENANT);
    expect(w.OR).toHaveLength(4);
    const debutJour = (
      w.OR.find((c) => "createdAt" in c && "gte" in (c["createdAt"] as object))?.["createdAt"] as {
        gte: Date;
      }
    ).gte;
    // Minuit à Paris le 17/09 (heure d'été) = 22:00 UTC le 16/09.
    expect(debutJour.toISOString()).toBe("2026-09-16T22:00:00.000Z");
  });
});

const SESSION = {
  numero: "AXI-SESS-2026-042",
  titreSession: "IA pour bien commencer",
  dateDebut: new Date("2026-09-16T07:00:00Z"),
  dateFin: new Date("2026-09-18T15:00:00Z"),
  enrollments: [
    {
      id: "insc-servie",
      trainee: { prenom: "A", nom: "Servie", email: "a@example.test" },
      emargementTokens: [jeton({ envoyeAt: new Date("2026-09-16T00:05:00Z") })],
    },
    {
      id: "insc-ajoutee-jour-2",
      trainee: { prenom: "B", nom: "Ajoutee", email: "b@example.test" },
      emargementTokens: [],
    },
    {
      id: "insc-qr-du-jour",
      trainee: { prenom: "C", nom: "Qr", email: "c@example.test" },
      emargementTokens: [jeton({ createdAt: new Date("2026-09-17T06:45:00Z") })],
    },
    {
      id: "insc-fabriquee-la-veille",
      trainee: { prenom: "D", nom: "Veille", email: "d@example.test" },
      emargementTokens: [jeton({ createdAt: new Date("2026-09-16T16:30:00Z") })],
    },
  ],
};

describe("🔴 l'envoi automatique sert CHAQUE inscrit qui n'a rien, et seulement lui", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    compteurJeton = 0;
    vi.useFakeTimers();
    vi.setSystemTime(MAINTENANT);
    findUnique.mockResolvedValue(SESSION);
    enqueueEmail.mockResolvedValue({ enqueued: true });
    verdictAvantEnvoi.mockResolvedValue({ retenu: false });
  });

  it("n'émet et n'envoie qu'aux inscrits sans lien entre les mains de quelqu'un", async () => {
    const r = await envoyerLiensPourSession({
      sessionId: "s1",
      origine: "cron-j0",
      cible: "sans_lien_remis",
    });
    vi.useRealTimers();

    const servis = creerTokenInscription.mock.calls.map(
      (c) => (c[0] as { enrollmentId: string }).enrollmentId,
    );
    expect(servis.sort()).toEqual(["insc-ajoutee-jour-2", "insc-fabriquee-la-veille"]);
    expect(enqueueEmail).toHaveBeenCalledTimes(2);
    expect(r).toMatchObject({ ok: true, envoyes: 2 });
  });

  it("lit les jetons VIVANTS de chaque inscription dans la même requête", async () => {
    await envoyerLiensPourSession({
      sessionId: "s1",
      origine: "cron-j0",
      cible: "sans_lien_remis",
    });
    vi.useRealTimers();
    const select = (
      findUnique.mock.calls[0]?.[0] as {
        select: { enrollments: { select: { emargementTokens?: { where: object } } } };
      }
    ).select;
    expect(select.enrollments.select.emargementTokens?.where).toMatchObject({ revokedAt: null });
  });

  it("personne à servir n'est PAS un échec : rien à faire, rien d'écrit", async () => {
    findUnique.mockResolvedValue({ ...SESSION, enrollments: [SESSION.enrollments[0]] });
    const r = await envoyerLiensPourSession({
      sessionId: "s1",
      origine: "cron-j0",
      cible: "sans_lien_remis",
    });
    vi.useRealTimers();
    expect(creerTokenInscription).not.toHaveBeenCalled();
    expect(r).toEqual({ ok: true, envoyes: 0, echecs: [] });
  });

  it("🔴 une adresse sur la liste de suppression n'use AUCUN jeton et dit pourquoi", async () => {
    // Sans ce contrôle préalable, chaque passage horaire fabriquait un jeton
    // neuf — révoquant le précédent — pour un e-mail que la file retenait
    // ensuite. Et le motif affiché était « file indisponible, réessayez ».
    findUnique.mockResolvedValue({ ...SESSION, enrollments: [SESSION.enrollments[1]] });
    verdictAvantEnvoi.mockResolvedValue({ retenu: true, motif: "rebond_dur", depuis: null });
    const r = await envoyerLiensPourSession({
      sessionId: "s1",
      origine: "cron-j0",
      cible: "sans_lien_remis",
    });
    vi.useRealTimers();
    expect(creerTokenInscription).not.toHaveBeenCalled();
    expect(r).toMatchObject({ ok: false });
    expect((r as { motif: string }).motif).toMatch(/suppression/i);
  });

  it("le renvoi manuel depuis la console garde son contrat : TOUS les inscrits", async () => {
    await envoyerLiensPourSession({ sessionId: "s1", origine: "console" });
    vi.useRealTimers();
    expect(creerTokenInscription).toHaveBeenCalledTimes(4);
  });
});
