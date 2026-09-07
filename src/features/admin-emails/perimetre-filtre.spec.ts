/**
 * 🔴 LES COMPTEURS DOIVENT SUIVRE LE FILTRE — 2026-09-07.
 *
 * ## Le défaut
 *
 * On filtrait le journal sur une stagiaire, la liste affichait TROIS lignes, et
 * les cartes du haut affichaient toujours « Envoyés 197 » — le total du journal
 * entier. Rien à l'écran ne disait que les deux nombres ne répondaient pas à la
 * même question.
 *
 * 🔑 Sur un écran qu'on montre à un auditeur, c'est pire qu'un chiffre faux :
 * c'est un chiffre VRAI posé sur la mauvaise question. Un chiffre faux se
 * remarque ; celui-là non — il est cohérent avec lui-même, et il ment sur son
 * périmètre.
 *
 * ## Ce que ces cas gardent
 *
 * Le `where` des compteurs et celui de la liste doivent partager le même
 * PÉRIMÈTRE — fenêtre, destinataire, session. Et le statut doit en rester
 * dehors : filtrer sur « Envoyé » afficherait sinon toujours « 0 échec », ce qui
 * est le défaut symétrique et déjà documenté dans le module.
 *
 * Les cas lisent les `where` réellement passés à Prisma plutôt qu'un résultat :
 * c'est la construction de la requête qui portait le défaut, et un jeu de
 * données de test la contournerait.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const count = vi.fn(async (_a?: unknown) => 0);
const findMany = vi.fn(async (_a?: unknown) => [] as unknown[]);
const groupBy = vi.fn(async (_a?: unknown) => [] as unknown[]);
const sessionFindUnique = vi.fn(async (_a?: unknown) => null as unknown);

vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailLog: {
      count: (a: unknown) => count(a as never),
      findMany: (a: unknown) => findMany(a as never),
      groupBy: (a: unknown) => groupBy(a as never),
    },
    trainingSession: { findUnique: (a: unknown) => sessionFindUnique(a as never) },
  },
}));

import { chargerEmails } from "./query";

const BASE = {
  jours: 30,
  statut: null,
  gabarit: null,
  destinataire: null,
  sessionId: null,
  page: 1,
};

/** Les `where` de tous les appels Prisma d'un chargement. */
function wheres(): Array<Record<string, unknown>> {
  return [...count.mock.calls, ...findMany.mock.calls, ...groupBy.mock.calls]
    .map((c) => (c[0] as { where?: Record<string, unknown> } | undefined)?.where)
    .filter((w): w is Record<string, unknown> => w !== undefined);
}

beforeEach(() => {
  vi.clearAllMocks();
  count.mockResolvedValue(0);
  findMany.mockResolvedValue([]);
  groupBy.mockResolvedValue([]);
  sessionFindUnique.mockResolvedValue(null);
});

describe("🔴 le périmètre du filtre s'applique À TOUTES les lectures", () => {
  it("le destinataire restreint la liste ET les compteurs", async () => {
    await chargerEmails({ ...BASE, destinataire: "simone.blanc.26@gmail.com" });

    const tous = wheres();
    expect(tous.length).toBeGreaterThan(3); // liste + total + 2 groupBy + rebonds durs
    for (const w of tous) {
      expect(
        w["recipient"],
        "une lecture ignore le filtre de destinataire : ses compteurs porteront sur le journal entier " +
          "alors que la liste est filtrée — le défaut d'origine, à l'identique.",
      ).toEqual({ contains: "simone.blanc.26@gmail.com" });
    }
  });

  it("la session restreint la liste ET les compteurs", async () => {
    await chargerEmails({ ...BASE, sessionId: "sess-1" });

    for (const w of wheres()) {
      expect(w["entityId"], "une lecture ignore le filtre de session").toHaveProperty("in");
    }
  });
});

describe("🔴 contre-témoins — ne pas trop restreindre", () => {
  it("le STATUT reste hors des compteurs", async () => {
    // Sinon filtrer sur « Envoyé » afficherait toujours « 0 échec » : le défaut
    // symétrique, déjà documenté dans le module. Au moins une lecture (celle des
    // compteurs) doit ignorer le statut.
    await chargerEmails({ ...BASE, statut: "sent" });

    const sansStatut = wheres().filter((w) => w["status"] === undefined);
    expect(
      sansStatut.length,
      "toutes les lectures portent le filtre de statut : les compteurs afficheraient " +
        "« 0 échec » dès qu'on regarde les envois.",
    ).toBeGreaterThan(0);
  });

  it("la liste des GABARITS ignore le gabarit choisi", async () => {
    // Sinon cliquer une puce ferait disparaître toutes les autres, et l'écran
    // deviendrait un cul-de-sac dont on ne sort qu'en éditant l'URL.
    await chargerEmails({ ...BASE, gabarit: "qualiopi-convocation" });

    const sansGabarit = wheres().filter((w) => w["template"] === undefined);
    expect(sansGabarit.length).toBeGreaterThan(0);
  });

  it("🔑 une session INTROUVABLE rend zéro ligne, jamais le journal entier", async () => {
    // Le cas qui compte pour un auditeur : un identifiant erroné ne doit pas
    // faire lire le courrier d'un autre dossier en croyant lire le sien. Le
    // filtre porte alors sur une liste VIDE.
    sessionFindUnique.mockResolvedValue(null);

    await chargerEmails({ ...BASE, sessionId: "inconnue" });

    for (const w of wheres()) {
      expect(w["entityId"]).toEqual({ in: [] });
    }
  });
});
