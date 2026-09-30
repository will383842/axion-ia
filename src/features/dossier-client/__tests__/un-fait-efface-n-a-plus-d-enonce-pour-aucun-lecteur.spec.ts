/**
 * Un fait EFFACÉ n'a plus d'énoncé, quel que soit le lecteur (RGPD) — et il
 * n'y a qu'UNE lecture des faits d'un client (`lire-faits.ts`), partagée par
 * la console (`lireFaitsDuClient`) et le worker du questionnaire (P6).
 *
 * Deux copies de la même lecture divergeaient sans que le compilateur le
 * voie : ce test rougit si l'une revient.
 *
 * Mutation qui rougit : retirer `efface ? "" :` dans `lireFaitsDUnClient`
 * (l'énoncé effacé ressort) ; ou recopier un `db.fait.findMany` déchiffrant
 * dans `etapes-a-la-demande.ts` ou `lireFaitsDuClient`.
 * Contre-témoin : un fait validé garde son énoncé ; une parole indéchiffrable
 * devient « (illisible…) » à l'écran et « » pour l'IA.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/chiffrer-parole", () => ({
  dechiffrerParole: (v: string) => {
    if (v.startsWith("x:")) throw new Error("clé absente");
    return v.replace(/^c:/, "");
  },
}));

import { lireFaitsDUnClient, TEXTE_ILLISIBLE } from "../lire-faits";

function ligne(id: string, statut: string, enonce: string, texteCourt: string | null) {
  return {
    id,
    type: "besoin",
    cle: null,
    portee: "projet",
    projetId: "p1",
    statut,
    suivi: null,
    enonce,
    texteCourt,
    montantMinCents: null,
    montantMaxCents: null,
    dateCible: null,
    quantite: null,
    refCatalogue: null,
    constateLe: new Date("2026-09-20T10:00:00Z"),
    citationDebutMs: null,
    rencontreId: "r1",
    contactSujetId: null,
    contactLocuteurId: "k1",
    relation: null,
    relationAvecFaitId: null,
    remplaceParId: null,
    citationVerifiee: true,
  };
}

function base() {
  const findMany = vi
    .fn()
    .mockResolvedValue([
      ligne("f1", "valide", "c:former 12 personnes", "c:12 personnes"),
      ligne("f2", "efface", "c:le secret du client", "c:secret"),
      ligne("f3", "valide", "x:illisible", null),
    ]);
  return { db: { fait: { findMany } } as never, findMany };
}

describe("un fait effacé n'a plus d'énoncé pour aucun lecteur", () => {
  for (const [lecteur, illisible] of [
    ["la console", TEXTE_ILLISIBLE],
    ["le worker (entrée de l'IA)", ""],
  ] as const) {
    it(`${lecteur} : effacé vide, validé lisible`, async () => {
      const { db } = base();
      const faits = await lireFaitsDUnClient(db, "c1", {
        statuts: ["valide", "efface"],
        illisible,
      });
      const par = new Map(faits.map((f) => [f.id, f]));
      expect(par.get("f2")?.enonce).toBe("");
      expect(par.get("f2")?.texteCourt).toBeNull();
      expect(par.get("f1")?.enonce).toBe("former 12 personnes");
      expect(par.get("f1")?.texteCourt).toBe("12 personnes");
      expect(par.get("f3")?.enonce).toBe(illisible);
      expect(par.get("f1")?.contactLocuteurId).toBe("k1");
    });
  }

  it("seuls les statuts demandés sont lus, pour ce client", async () => {
    const { db, findMany } = base();
    await lireFaitsDUnClient(db, "c1", { statuts: ["valide", "efface"], illisible: "" });
    expect(findMany.mock.calls[0]?.[0]?.where).toEqual({
      clientId: "c1",
      statut: { in: ["valide", "efface"] },
    });
  });

  it("la console et le worker passent par cette lecture, sans copie", () => {
    for (const fichier of [
      "src/features/dossier-client/queries.ts",
      "src/server/visio/passes/etapes-a-la-demande.ts",
    ]) {
      const src = readFileSync(resolve(process.cwd(), fichier), "utf8");
      expect(src, fichier).toMatch(/lireFaitsDUnClient\(/);
      // La règle RGPD n'est écrite qu'une fois : dans `lire-faits.ts`.
      expect(src, fichier).not.toMatch(/statut === "efface" \? ""/);
    }
  });
});
