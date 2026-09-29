/**
 * ⛔ CLIQUET NOMINATIF — TOUTE FUSION DE FICHES PASSE PAR LA FILE PARTNERS
 * (chantier visio, PR 4 ; correction anti-doublon D3).
 *
 * `client.fusionne` a UN producteur : `fusionnerFiches`
 * (`src/features/dossier-client/fusionner.ts`), qui écrit la fusion
 * (`clientFusion.create`) ET appelle `emettreFusionVersPartners` — la file
 * existante `ecrireEvenementPartners` et le constructeur `payloadClientFusionne`
 * — dans la même transaction. Ce cliquet rougit si :
 *   1. un autre fichier écrit une fusion (`clientFusion.create|createMany|upsert`,
 *      `INSERT INTO client_fusions`) sans figurer, motivé, dans la liste ;
 *   2. un écrivain de la liste n'appelle plus `emettreFusionVersPartners` ;
 *   3. quelqu'un fabrique à nouveau un événement ou un rejeu maison
 *      (`evenementFusionPourPartners`, `fusionsARejouerVersPartners`,
 *      `FUSIONS_A_REJOUER`) ;
 *   4. l'émission n'utilise plus la file existante et le constructeur du contrat.
 *
 * Balayage DÉRIVÉ de `src/` et `scripts/` (tests exclus). Contre-témoin : le
 * détecteur reconnaît un écrivain fictif. Angle mort : un accès dynamique
 * (`prisma["clientFusion"]`) n'est pas vu.
 */

import { describe, expect, it } from "vitest";

import { lire, sansCommentaires, sourcesExigeesSous } from "./sources-du-circuit-visio";

const PRODUCTEUR = "src/features/dossier-client/fusionner.ts";

/** Écrivains de `ClientFusion`, nominatifs. Chacun DOIT émettre. */
const ECRIVAINS: readonly string[] = [PRODUCTEUR];

const ECRIT_UNE_FUSION: ReadonlyArray<RegExp> = [
  /\.clientFusion\.(create|createMany|upsert)\s*\(/,
  /INSERT\s+INTO\s+"?client_fusions"?[\s(]/i,
];

const MAISON = /\b(evenementFusionPourPartners|fusionsARejouerVersPartners|FUSIONS_A_REJOUER)\b/;

function ecritUneFusion(source: string): boolean {
  return ECRIT_UNE_FUSION.some((m) => m.test(source));
}

const SOURCES = sourcesExigeesSous(["src", "scripts"]).map(
  (f) => [f, sansCommentaires(lire(f))] as const,
);

describe("⛔ toute fusion de fiches passe par la file Partners (D3)", () => {
  it("les écrivains de ClientFusion sont exactement ceux de la liste", () => {
    const trouves = SOURCES.filter(([, code]) => ecritUneFusion(code)).map(([f]) => f);
    expect(trouves.sort()).toEqual([...ECRIVAINS].sort());
  });

  it("chaque écrivain appelle emettreFusionVersPartners", () => {
    for (const f of ECRIVAINS) {
      expect(sansCommentaires(lire(f)), f).toMatch(/await\s+emettreFusionVersPartners\s*\(/);
    }
  });

  it("l'émission passe par la file existante et le constructeur du contrat", () => {
    const code = lire(PRODUCTEUR);
    expect(code).toMatch(/from "@\/server\/partners-sync\/outbox"/);
    expect(code).toMatch(/from "@\/server\/partners\/payloads"/);
    expect(sansCommentaires(code)).toMatch(/ecrireEvenementPartners\s*\(/);
    expect(sansCommentaires(code)).toMatch(/payloadClientFusionne\s*\(/);
  });

  it("aucun événement ni rejeu maison ne revient", () => {
    const trouves = SOURCES.filter(([, code]) => MAISON.test(code)).map(([f]) => f);
    expect(trouves).toEqual([]);
  });

  it("🔑 CONTRE-TÉMOIN : le détecteur voit un écrivain fictif", () => {
    expect(ecritUneFusion("await tx.clientFusion.create({ data })")).toBe(true);
    expect(ecritUneFusion("INSERT INTO client_fusions (id) VALUES ($1)")).toBe(true);
    expect(ecritUneFusion("await tx.clientFusion.findMany({})")).toBe(false);
    expect(MAISON.test("export const FUSIONS_A_REJOUER = {}")).toBe(true);
  });
});
