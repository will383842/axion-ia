/**
 * Tests de NON-RÉGRESSION — le cloisonnement de l'espace formateur.
 *
 * ## Pourquoi ce fichier existe
 *
 * Un formateur anime pour PLUSIEURS clients. Le 2026-08-16, le portail stagiaire
 * s'est révélé organisé par TYPE DE PIÈCE et non par dossier : à deux
 * formations, la convocation de l'une masquait celle de l'autre. La règle posée
 * alors — UN ESPACE S'ORGANISE PAR DOSSIER — vaut ici avec un enjeu de plus :
 * entre deux dossiers de l'espace formateur, il n'y a pas seulement deux
 * formations, il y a deux CLIENTS.
 *
 * L'audit de l'espace formateur (LOT 18) n'a trouvé aucun regroupement global
 * dans `collectif-queries.ts`, `kit-queries.ts` ni `feuille-groupe.ts` : tout y
 * est ancré sur la session. Ce fichier VERROUILLE cet état de fait, pour qu'il
 * ne se perde pas au prochain refactor — une garde qui n'existe qu'en lecture de
 * diff ne garde rien.
 *
 * Ce qui est verrouillé, et ce qui casse si on l'enlève :
 *
 *  1. **Une ligne par session, chacune avec SES chiffres.** Hisser le rôle ou le
 *     compteur hors du parcours ferait porter à toutes les formations celui de
 *     la première — le formateur lirait « principal » sur une session qu'il
 *     assiste, et le nombre d'inscrits d'un autre client.
 *  2. **L'identifiant et l'appartenance dans LA MÊME requête.** Les séparer en
 *     deux lectures, c'est laisser passer la fenêtre où la seconde est oubliée.
 *  3. **Le kit se résout depuis la formation de LA session autorisée.** Un
 *     `formationId` mémorisé entre deux appels servirait les corrigés du client
 *     précédent.
 *  4. **La feuille d'émargement lit les contresignatures SOUS la session.** Une
 *     lecture par `trainerId` seul afficherait « contresigné » chez un client
 *     parce que la même demi-journée l'a été chez un autre.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainingSession: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn() },
    supportFormation: { findFirst: vi.fn() },
    // Présent pour pouvoir affirmer qu'on ne l'appelle JAMAIS : les participants
    // se lisent sous la session, pas par une lecture globale de stagiaires.
    trainee: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { listMyTrainingSessions, getTrainingSessionForFormateur } from "./collectif-queries";
import { lireKitFormateur } from "./kit-queries";
import { lireFeuilleGroupe } from "@/server/qualiopi/emargement/feuille-groupe";

type Mock = ReturnType<typeof vi.fn>;
const mockPrisma = prisma as unknown as {
  trainingSession: { findMany: Mock; findFirst: Mock; findUnique: Mock };
  supportFormation: { findFirst: Mock };
  trainee: { findMany: Mock };
};

const TRAINER = "22222222-2222-4222-8222-222222222222";

/** Deux clients, deux dossiers. Les identifiants sont nommés pour se lire. */
const SESSION_ALPHA = "11111111-1111-4111-8111-111111111111";
const SESSION_BETA = "33333333-3333-4333-8333-333333333333";
const FORMATION_ALPHA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const FORMATION_BETA = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. La liste des formations
// ─────────────────────────────────────────────────────────────────────────────

describe("🔴 listMyTrainingSessions — deux clients, deux lignes distinctes", () => {
  it("garde à chaque formation SON rôle et SON nombre d'inscrits", async () => {
    mockPrisma.trainingSession.findMany.mockResolvedValue([
      {
        id: SESSION_ALPHA,
        numero: "AXI-SESS-2026-0011",
        titreSession: "IA pour les RH — client Alpha",
        statut: "planifiee",
        modalite: "presentiel",
        dateDebut: new Date("2026-09-01"),
        dateFin: new Date("2026-09-02"),
        lieuVille: "Grenoble",
        formateurPrincipalId: TRAINER,
        sessionFormateurs: [],
        _count: { enrollments: 8 },
      },
      {
        id: SESSION_BETA,
        numero: "AXI-SESS-2026-0012",
        titreSession: "IA pour les achats — client Beta",
        statut: "planifiee",
        modalite: "distanciel",
        dateDebut: new Date("2026-09-15"),
        dateFin: new Date("2026-09-15"),
        lieuVille: null,
        formateurPrincipalId: "un-autre-formateur",
        sessionFormateurs: [{ role: "assistant" }],
        _count: { enrollments: 3 },
      },
    ]);

    const lignes = await listMyTrainingSessions(TRAINER);

    // Le rôle et le compteur sont dérivés POUR CHAQUE session. Hissés hors du
    // parcours, ils porteraient partout ceux de la première.
    expect(lignes.map((l) => l.role)).toStrictEqual(["principal", "assistant"]);
    expect(lignes.map((l) => l.nbInscrits)).toStrictEqual([8, 3]);
    expect(lignes.map((l) => l.id)).toStrictEqual([SESSION_ALPHA, SESSION_BETA]);
  });

  it("ne lit QUE les sessions du formateur — les deux voies d'affectation", async () => {
    mockPrisma.trainingSession.findMany.mockResolvedValue([]);

    await listMyTrainingSessions(TRAINER);

    const where = mockPrisma.trainingSession.findMany.mock.calls[0]?.[0]?.where as {
      OR: unknown[];
    };
    // Sans ce filtre, la liste serait celle de TOUT le catalogue : les sessions
    // de tous les clients, chez tous les formateurs.
    expect(JSON.stringify(where.OR)).toContain(TRAINER);
    expect(JSON.stringify(where.OR)).toContain("formateurPrincipalId");
    expect(JSON.stringify(where.OR)).toContain("sessionFormateurs");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Le détail d'une formation
// ─────────────────────────────────────────────────────────────────────────────

describe("🔴 getTrainingSessionForFormateur — identifiant ET appartenance, ensemble", () => {
  it("pose les deux conditions dans la MÊME requête", async () => {
    mockPrisma.trainingSession.findFirst.mockResolvedValue(null);

    await getTrainingSessionForFormateur(SESSION_BETA, TRAINER);

    const where = mockPrisma.trainingSession.findFirst.mock.calls[0]?.[0]?.where as {
      id: string;
      OR?: unknown[];
    };
    // Deux lectures successives — « je charge la session, puis je vérifie » —
    // ouvrent la fenêtre où la seconde est oubliée lors d'un refactor. Ici la
    // base ne rend rien qui ne soit pas au formateur.
    expect(where.id).toBe(SESSION_BETA);
    expect(where.OR).toBeDefined();
    expect(JSON.stringify(where.OR)).toContain(TRAINER);
  });

  it("lit les participants SOUS la session, jamais par une lecture de stagiaires", async () => {
    mockPrisma.trainingSession.findFirst.mockResolvedValue(null);

    await getTrainingSessionForFormateur(SESSION_ALPHA, TRAINER);

    const select = mockPrisma.trainingSession.findFirst.mock.calls[0]?.[0]?.select as {
      enrollments: { where: unknown };
    };
    expect(select.enrollments).toBeDefined();
    // 🔴 Une liste de stagiaires construite ailleurs qu'à partir de la session
    // devrait porter elle-même son cloisonnement — c'est exactement le genre de
    // filtre qu'on oublie. On n'interroge donc jamais les stagiaires en direct.
    expect(mockPrisma.trainee.findMany).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Le kit formateur (il contient les corrigés)
// ─────────────────────────────────────────────────────────────────────────────

describe("🔴 lireKitFormateur — le kit vient de la formation de LA session ouverte", () => {
  it("interroge une formation différente pour chaque client", async () => {
    mockPrisma.supportFormation.findFirst.mockResolvedValue({
      version: 1,
      sizeBytes: 1024,
      generatedAt: null,
    });

    mockPrisma.trainingSession.findFirst.mockResolvedValue({ formationId: FORMATION_ALPHA });
    await lireKitFormateur(SESSION_ALPHA, TRAINER);

    mockPrisma.trainingSession.findFirst.mockResolvedValue({ formationId: FORMATION_BETA });
    await lireKitFormateur(SESSION_BETA, TRAINER);

    const premier = mockPrisma.supportFormation.findFirst.mock.calls[0]?.[0] as {
      where: { formationId: string };
    };
    const second = mockPrisma.supportFormation.findFirst.mock.calls[1]?.[0] as {
      where: { formationId: string };
    };
    // Le kit porte les corrigés du quiz d'évaluation. Un `formationId` mémorisé
    // d'un appel sur l'autre les servirait au client suivant.
    expect(premier.where.formationId).toBe(FORMATION_ALPHA);
    expect(second.where.formationId).toBe(FORMATION_BETA);
  });

  it("ne cherche AUCUN support quand la session n'est pas au formateur", async () => {
    mockPrisma.trainingSession.findFirst.mockResolvedValue(null);

    expect(await lireKitFormateur(SESSION_ALPHA, TRAINER)).toBeNull();
    expect(mockPrisma.supportFormation.findFirst).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. La feuille d'émargement du groupe
// ─────────────────────────────────────────────────────────────────────────────

/** Une session émargeable minimale : un jour, un stagiaire, un créneau. */
function sessionEmargeable(over: Record<string, unknown> = {}) {
  return {
    titreSession: "IA pour les RH — client Alpha",
    statut: "en_cours",
    formateurPrincipal: { nom: "Jullin", prenom: "Williams" },
    jours: [
      {
        date: new Date("2026-06-10T00:00:00.000Z"),
        heureDebut: "09:00",
        heureFin: "12:30",
        trainer: null,
      },
    ],
    emargementContresignatures: [],
    enrollments: [
      {
        id: "enrollment-1",
        statut: "planifiee",
        trainee: { nom: "Dupont", prenom: "Alice" },
        presences: [
          {
            id: "creneau-1",
            date: new Date("2026-06-10T00:00:00.000Z"),
            demiJournee: "matin",
            emargementSignatures: [],
          },
        ],
      },
    ],
    ...over,
  };
}

describe("🔴 lireFeuilleGroupe — la feuille d'un client ne renseigne pas celle d'un autre", () => {
  it("lit les contresignatures SOUS la session, et pour CE formateur", async () => {
    mockPrisma.trainingSession.findUnique.mockResolvedValue(sessionEmargeable());

    await lireFeuilleGroupe(
      SESSION_ALPHA,
      new Date("2026-06-10T10:00:00.000Z"),
      "Axion-IA",
      TRAINER,
    );

    const arg = mockPrisma.trainingSession.findUnique.mock.calls[0]?.[0] as {
      where: { id: string };
      select: { emargementContresignatures: { where: Record<string, unknown> } };
    };
    expect(arg.where.id).toBe(SESSION_ALPHA);
    // 🔴 Le point qui compte. Lues par `trainerId` seul — sans passer par la
    // relation de session — les contresignatures d'un client marqueraient
    // « contresigné » la demi-journée du même jour chez un autre : une feuille
    // afficherait une signature du formateur qu'elle ne porte pas.
    expect(arg.select.emargementContresignatures.where).toStrictEqual({
      trainerId: TRAINER,
      revokedAt: null,
    });
  });

  it("ne compose ses demi-journées qu'avec les créneaux de cette session", async () => {
    mockPrisma.trainingSession.findUnique.mockResolvedValue(sessionEmargeable());

    const demiJournees = await lireFeuilleGroupe(
      SESSION_ALPHA,
      new Date("2026-06-10T10:00:00.000Z"),
      "Axion-IA",
      TRAINER,
    );

    // Le regroupement se fait par (date, demi-journée) À L'INTÉRIEUR d'une
    // session. La même clé chez deux clients désigne deux feuilles distinctes :
    // un regroupement calculé hors du périmètre de la session les fusionnerait,
    // et le formateur ferait signer les stagiaires de l'un sur la feuille de
    // l'autre.
    expect(demiJournees).toHaveLength(1);
    expect(demiJournees?.[0]?.cle).toBe("2026-06-10|matin");
    expect(demiJournees?.[0]?.lignes.map((l) => l.stagiaireNom)).toStrictEqual(["Alice Dupont"]);
  });

  it("écarte un créneau dont la journée n'est pas déclarée dans CETTE session", async () => {
    // Un créneau dont le jour n'appartient pas à la session lue n'a ni horaires
    // ni programme : le signer produirait une ligne que le service refuse, et
    // l'afficher passerait pour une panne.
    mockPrisma.trainingSession.findUnique.mockResolvedValue(
      sessionEmargeable({
        enrollments: [
          {
            id: "enrollment-1",
            statut: "planifiee",
            trainee: { nom: "Dupont", prenom: "Alice" },
            presences: [
              {
                id: "creneau-etranger",
                date: new Date("2026-07-01T00:00:00.000Z"),
                demiJournee: "matin",
                emargementSignatures: [],
              },
            ],
          },
        ],
      }),
    );

    const demiJournees = await lireFeuilleGroupe(
      SESSION_ALPHA,
      new Date("2026-07-01T10:00:00.000Z"),
      "Axion-IA",
      TRAINER,
    );

    expect(demiJournees).toStrictEqual([]);
  });
});
