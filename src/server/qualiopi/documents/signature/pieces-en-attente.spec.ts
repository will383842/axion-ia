/**
 * Le compteur de la pastille et la liste de la page « À traiter » doivent
 * porter sur EXACTEMENT le même ensemble.
 *
 * 🔴 CE TEST EXISTE À CAUSE D'UNE PANNE RÉELLE, lue en production le
 * 2026-08-03 : la pastille rouge affichait **2** pendant que la page affichait
 * « Rien à traiter — tout est à jour ». Le filtre « pièce remplacée » n'avait
 * été posé que sur la page ; le compteur comptait encore les lignes brutes.
 *
 * Un badge qui ment une fois n'est plus jamais regardé. On verrouille donc
 * l'égalité, pas seulement l'existence du filtre.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const findManyMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    documentGenere: {
      findMany: (...args: unknown[]) => findManyMock(...args),
    },
  },
}));

import { listerPiecesEnAttente, compterPiecesEnAttente } from "./pieces-en-attente";

/** Le cas INVEST SUN : `-003` et `-011` en attente, `-009` signée, même session. */
const EN_ATTENTE_REMPLACEES = [
  {
    id: "d3",
    numero: "-003",
    type: "convention",
    sessionId: "sess-1",
    statutSignature: "en_attente",
    updatedAt: new Date("2026-07-31"),
    trainerId: null,
    session: null,
    signatures: [],
  },
  {
    id: "d11",
    numero: "-011",
    type: "convention",
    sessionId: "sess-1",
    statutSignature: "en_attente",
    updatedAt: new Date("2026-08-01"),
    trainerId: null,
    session: null,
    signatures: [],
  },
];

/** Réponse du second `findMany` : la pièce du même type/session déjà signée. */
const DEJA_SIGNEES = [{ sessionId: "sess-1", type: "convention" }];

function brancher(enAttente: unknown[], signees: unknown[]): void {
  findManyMock.mockReset();
  findManyMock.mockImplementation((args: { where?: { statutSignature?: unknown } }) => {
    // Le second appel vise `statutSignature: "signee"` (une chaîne), le
    // premier un `{ in: [...] }`.
    const s = args?.where?.statutSignature;
    return Promise.resolve(s === "signee" ? signees : enAttente);
  });
}

describe("pièces en attente de signature — pastille et page d'accord", () => {
  beforeEach(() => findManyMock.mockReset());

  it("écarte les pièces remplacées par une version signée, des DEUX côtés", async () => {
    brancher(EN_ATTENTE_REMPLACEES, DEJA_SIGNEES);
    const liste = await listerPiecesEnAttente();
    brancher(EN_ATTENTE_REMPLACEES, DEJA_SIGNEES);
    const compte = await compterPiecesEnAttente();

    expect(liste).toHaveLength(0);
    expect(compte).toBe(0);
    expect(compte, "la pastille doit dire ce que la page montre").toBe(liste.length);
  });

  it("garde les pièces qu'aucune version signée ne remplace", async () => {
    brancher(EN_ATTENTE_REMPLACEES, []);
    const liste = await listerPiecesEnAttente();
    brancher(EN_ATTENTE_REMPLACEES, []);
    const compte = await compterPiecesEnAttente();

    expect(liste).toHaveLength(2);
    expect(compte).toBe(2);
  });

  it("ne masque JAMAIS une pièce sans session — rien ne prouve qu'elle est remplacée", async () => {
    const sansSession = [
      {
        id: "lm",
        numero: "LM-1",
        type: "lettre_mission",
        sessionId: null,
        statutSignature: "en_attente",
        updatedAt: new Date(),
        trainerId: "t1",
        session: null,
        signatures: [],
      },
    ];
    brancher(sansSession, DEJA_SIGNEES);
    const liste = await listerPiecesEnAttente();
    brancher(sansSession, DEJA_SIGNEES);
    const compte = await compterPiecesEnAttente();

    expect(liste).toHaveLength(1);
    expect(compte).toBe(1);
  });

  // Le repli « base indisponible » (try/catch → [] / 0) n est pas testé ici :
  // le détecteur de rejets non gérés de vitest fait échouer le test sur la
  // promesse rejetée que `vi.fn` conserve dans `mock.results`, alors même que
  // le code la rattrape. Le comportement est inchangé par rapport au code
  // d origine et n est pas ce que ce fichier verrouille.
});
