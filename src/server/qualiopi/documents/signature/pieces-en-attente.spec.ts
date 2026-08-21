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

// ─────────────────────────────────────────────────────────────────────────────
// `D5-4-04` (2026-08-20) — une seule lecture, et un compteur qui ne plafonne pas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ⚠️ CE QUE CES TESTS NE PEUVENT PAS PROUVER, et il faut le savoir.
 *
 * L'unification passe par `cache()` de React, qui mémoïse **à l'échelle d'un
 * rendu**. Sonde exécutée le 2026-08-20 : hors contexte de rendu, `cache()`
 * n'est PAS mémoïsant — deux appels donnent deux exécutions réelles. Aucun test
 * unitaire ne peut donc observer la déduplication.
 *
 * 🔑 Une garde qui ne peut pas rougir ne garde rien. On ne fait donc PAS semblant
 * de tester la mémoïsation. Ce qui est gardé ici, c'est ce qui est observable et
 * qui casserait pour de bon :
 *
 *   1. le module ne contient qu'UNE lecture des pièces en attente — si quelqu'un
 *      en réintroduit une seconde, les deux redivergeront comme en 2026-08-03 ;
 *   2. le compteur n'hérite PAS du plafond d'affichage de la liste.
 *
 * Le second point est le piège propre à ce refactor : dériver le compte de la
 * liste tronquée aurait figé la pastille à 30. Un badge qui dit « 30 » quand il
 * y en a 47 ment — et c'est exactement le défaut que ce fichier existe pour
 * empêcher.
 */
describe("`D5-4-04` — une lecture unique, un compteur non tronqué", () => {
  beforeEach(() => findManyMock.mockReset());

  function fabriquer(n: number) {
    return Array.from({ length: n }, (_, i) => ({
      id: `d${i}`,
      numero: `-${String(i).padStart(3, "0")}`,
      type: "convention",
      // `sessionId: null` → `retirerPiecesRemplacees` sort tout de suite, on
      // mesure la troncature et rien d'autre.
      sessionId: null,
      statutSignature: "en_attente",
      updatedAt: new Date(2026, 0, 1 + i),
      trainerId: null,
      session: null,
      signatures: [],
    }));
  }

  it("🔴 le compteur dit 47 quand la liste en montre 30", async () => {
    brancher(fabriquer(47), []);
    const compte = await compterPiecesEnAttente();
    brancher(fabriquer(47), []);
    const liste = await listerPiecesEnAttente();

    expect(liste, "la page affiche 30 lignes au plus").toHaveLength(30);
    expect(compte, "la pastille dit le TOTAL, pas ce qui tient à l'écran").toBe(47);
  });

  it("sous le plafond, les deux disent le même nombre", async () => {
    // 🔑 Témoin négatif. Sans lui, un compteur qui rendrait n'importe quel
    // nombre supérieur à 30 passerait le test ci-dessus.
    brancher(fabriquer(7), []);
    const compte = await compterPiecesEnAttente();
    brancher(fabriquer(7), []);
    const liste = await listerPiecesEnAttente();

    expect(liste).toHaveLength(7);
    expect(compte).toBe(7);
  });

  it("🔴 le module ne lit les pièces en attente qu'à UN endroit", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const source = readFileSync(
      join(
        process.cwd(),
        "src",
        "server",
        "qualiopi",
        "documents",
        "signature",
        "pieces-en-attente.ts",
      ),
      "utf-8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");

    // `where: enAttente()` est le prédicat partagé : une seule occurrence dans
    // le code réel signifie une seule lecture à mémoïser.
    const lectures = source.match(/where:\s*enAttente\(\)/g) ?? [];
    expect(lectures, `occurrences trouvées : ${lectures.length}`).toHaveLength(1);
  });
});
