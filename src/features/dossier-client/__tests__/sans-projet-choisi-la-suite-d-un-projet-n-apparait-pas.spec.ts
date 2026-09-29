/**
 * ⛔ « Préparer », bloc 1 (plan §3.13) : sans projet choisi, la « dernière
 * suite convenue » vient des SEULES rencontres de l'entreprise — jamais de la
 * rencontre d'un projet. Avec un projet choisi, seulement de ce projet.
 *
 * Le test ⛔ `preparer-…` ne peut pas le voir : `dernierSuivi` est lu par
 * `lireDernierSuivi()` (queries.ts) AVANT `preparer()`. Ce test passe donc par
 * la lecture elle-même, sur une base en mémoire qui applique le `where` et
 * l'`orderBy` comme Postgres (NULL en tête d'un tri décroissant, sauf
 * `nulls: "last"`).
 *
 * Mutations qui font rougir :
 *   · revenir à `...(projetId !== null ? { projetId } : {})` : sans projet
 *     choisi, la suite (plus récente) du projet B remonte ;
 *   · revenir à `debutPrevu: "desc"` : la rencontre SANS date passe devant.
 * Contre-témoin : avec le projet B choisi, c'est bien la suite de B.
 * Angle mort : la base en mémoire ne connaît que les opérateurs utilisés ici
 * (égalité, `not: null`, tri sur un champ de la rencontre).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

interface Ligne {
  suite: string | null;
  suiteLe: Date | null;
  valideLe: Date | null;
  rencontre: { clientId: string; projetId: string | null; titre: string; debutPrevu: Date | null };
}

const lignes: Ligne[] = [];

function correspond(l: Ligne, where: Record<string, unknown>): boolean {
  const r = (where.rencontre ?? {}) as Record<string, unknown>;
  for (const [cle, attendu] of Object.entries(r)) {
    if ((l.rencontre as Record<string, unknown>)[cle] !== attendu) return false;
  }
  if ("valideLe" in where && l.valideLe === null) return false;
  return true;
}

function trier(a: Ligne, b: Ligne, orderBy: unknown): number {
  const tri = (orderBy as { rencontre: { debutPrevu: unknown } }).rencontre.debutPrevu;
  const sens = typeof tri === "string" ? tri : (tri as { sort: string }).sort;
  // Postgres : NULLS FIRST par défaut en DESC.
  const nulls =
    typeof tri === "string"
      ? sens === "desc"
        ? "first"
        : "last"
      : (tri as { nulls: string }).nulls;
  const da = a.rencontre.debutPrevu;
  const db = b.rencontre.debutPrevu;
  if (da === null && db === null) return 0;
  if (da === null) return nulls === "first" ? -1 : 1;
  if (db === null) return nulls === "first" ? 1 : -1;
  return sens === "desc" ? db.getTime() - da.getTime() : da.getTime() - db.getTime();
}

vi.mock("@/lib/prisma", () => ({
  prisma: {
    rencontreSuivi: {
      findFirst: vi.fn(async (args: { where: Record<string, unknown>; orderBy: unknown }) => {
        const trouvees = lignes
          .filter((l) => correspond(l, args.where))
          .sort((a, b) => trier(a, b, args.orderBy));
        const l = trouvees[0];
        if (l === undefined) return null;
        return { suite: l.suite, suiteLe: l.suiteLe, rencontre: { titre: l.rencontre.titre } };
      }),
    },
  },
}));
vi.mock("@/lib/chiffrer-parole", () => ({ dechiffrerParole: (v: string) => v }));

const { lireDernierSuivi } = await import("../queries");

const VALIDE = new Date("2026-09-01T10:00:00Z");

function ligne(titre: string, projetId: string | null, debutPrevu: Date | null): Ligne {
  return {
    suite: "rappel",
    suiteLe: null,
    valideLe: VALIDE,
    rencontre: { clientId: "cl-1", projetId, titre, debutPrevu },
  };
}

describe("« Préparer » : la dernière suite convenue ne sort jamais de sa portée", () => {
  beforeEach(() => {
    lignes.length = 0;
    lignes.push(
      ligne("Rencontre entreprise", null, new Date("2026-09-10T09:00:00Z")),
      ligne("Rencontre entreprise sans date", null, null),
      ligne("Rencontre du projet B", "p-b", new Date("2026-09-20T09:00:00Z")),
    );
  });

  it("sans projet choisi, la suite d'une rencontre de projet n'apparaît pas", async () => {
    const s = await lireDernierSuivi("cl-1", null);
    expect(s?.rencontreTitre).toBe("Rencontre entreprise");
  });

  it("une rencontre sans date prévue ne passe pas devant une rencontre datée", async () => {
    const s = await lireDernierSuivi("cl-1", null);
    expect(s?.rencontreTitre).not.toBe("Rencontre entreprise sans date");
  });

  it("contre-témoin : avec le projet B choisi, c'est la suite de B", async () => {
    const s = await lireDernierSuivi("cl-1", "p-b");
    expect(s?.rencontreTitre).toBe("Rencontre du projet B");
  });
});
