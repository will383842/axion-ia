/**
 * Test NÉGATIF de la déduplication des pièces de l'espace stagiaire.
 *
 * ## Le défaut reproduit
 *
 * `getEspaceStagiaire` dédupliquait les pièces **par TYPE, toutes sessions
 * confondues**, premier arrivé gagnant :
 *
 * ```ts
 * if (!parType.has(d.type)) parType.set(d.type, d);
 * ```
 *
 * Le raisonnement d'origine était juste — « présenter deux règlements
 * intérieurs de dates différentes est pire que n'en présenter aucun » — **pour
 * un stagiaire à une session**. À deux, il efface : la convocation d'une
 * formation masque celle de l'autre, et l'ordre n'est pas garanti.
 *
 * Cas réel du 16/08/2026 : une stagiaire inscrite à deux sessions du même
 * client, l'une réalisée le 31/07, l'autre le jour même.
 *
 * Ce fichier exerce la VRAIE fonction (`retenirPiecesParSessionEtType`), pas une
 * copie : la règle a été extraite dans un module pur pour cette raison. Une
 * réimplémentation dans le test aurait divergé de l'original le jour où l'un des
 * deux aurait bougé.
 */

import { describe, it, expect } from "vitest";
import { retenirPiecesParSessionEtType } from "./pieces-par-formation";

/** Forme minimale d'un document, telle que la lit `getEspaceStagiaire`. */
interface DocTest {
  type: string;
  numero: string;
  createdAt: Date;
}

function regrouper(
  enrollments: { sessionId: string | null; sessionTitre: string; documents: DocTest[] }[],
): { sessionTitre: string; type: string; numero: string }[] {
  return retenirPiecesParSessionEtType(enrollments).map((v) => ({
    sessionTitre: v.sessionTitre,
    type: v.doc.type,
    numero: v.doc.numero,
  }));
}

const IMMOBILIER = {
  sessionId: "sess-003",
  sessionTitre: "IA pour l'immobilier — INVEST SUN",
  documents: [
    { type: "convocation", numero: "AXI-DOC-2026-016", createdAt: new Date("2026-08-02") },
    { type: "programme", numero: "AXI-DOC-2026-014", createdAt: new Date("2026-08-02") },
  ],
};
const FINANCE = {
  sessionId: "sess-005",
  sessionTitre: "IA pour la finance — INVEST SUN",
  documents: [
    { type: "convocation", numero: "AXI-DOC-2026-038", createdAt: new Date("2026-08-15") },
    { type: "programme", numero: "AXI-DOC-2026-034", createdAt: new Date("2026-08-15") },
  ],
};

describe("pièces d'un stagiaire à PLUSIEURS formations", () => {
  it("🔴 les DEUX convocations sont présentes — aucune n'en masque une autre", () => {
    const pieces = regrouper([IMMOBILIER, FINANCE]);
    const convocations = pieces.filter((p) => p.type === "convocation");

    expect(
      convocations,
      "une convocation a disparu : la déduplication porte encore sur le type seul",
    ).toHaveLength(2);
    expect(convocations.map((c) => c.numero).sort()).toEqual([
      "AXI-DOC-2026-016",
      "AXI-DOC-2026-038",
    ]);
  });

  it("chaque pièce porte le titre de SA formation — sinon elle n'est pas classable", () => {
    const pieces = regrouper([IMMOBILIER, FINANCE]);
    const parTitre = new Map(pieces.map((p) => [p.numero, p.sessionTitre]));

    expect(parTitre.get("AXI-DOC-2026-016")).toContain("immobilier");
    expect(parTitre.get("AXI-DOC-2026-038")).toContain("finance");
  });

  it("l'ordre des inscriptions ne change pas le résultat — pas de premier-arrivé-gagnant", () => {
    const a = regrouper([IMMOBILIER, FINANCE])
      .map((p) => p.numero)
      .sort();
    const b = regrouper([FINANCE, IMMOBILIER])
      .map((p) => p.numero)
      .sort();
    expect(a).toEqual(b);
  });
});

describe("la déduplication est conservée là où elle protège", () => {
  it("deux règlements intérieurs de la MÊME session : un seul, le plus récent", () => {
    // C'est le défaut d'origine que la déduplication corrigeait : les
    // régénérations créent des doublons, et en présenter deux de dates
    // différentes est pire que n'en présenter aucun.
    const pieces = regrouper([
      {
        sessionId: "sess-005",
        sessionTitre: "IA pour la finance",
        documents: [
          { type: "reglement_interieur", numero: "ANCIEN", createdAt: new Date("2026-08-10") },
          { type: "reglement_interieur", numero: "RECENT", createdAt: new Date("2026-08-15") },
        ],
      },
    ]);
    expect(pieces).toHaveLength(1);
    expect(pieces[0]?.numero, "ce n'est pas la plus récente qui a été gardée").toBe("RECENT");
  });

  it("une inscription sans session ne fait pas disparaître les autres", () => {
    const pieces = regrouper([
      {
        sessionId: null,
        sessionTitre: "",
        documents: [
          { type: "convocation", numero: "ORPHELINE", createdAt: new Date("2026-01-01") },
        ],
      },
      FINANCE,
    ]);
    expect(pieces.filter((p) => p.type === "convocation")).toHaveLength(2);
  });
});
