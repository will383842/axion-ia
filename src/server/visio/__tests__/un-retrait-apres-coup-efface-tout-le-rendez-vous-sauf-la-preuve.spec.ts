/**
 * ⛔ UN RETRAIT APRÈS COUP EFFACE TOUT LE RENDEZ-VOUS SAUF LA PREUVE (B2 ; ADR 0056).
 *
 * `retirerAccordRencontre`, en une transaction sous le drapeau d'effacement :
 * segments supprimés, toutes les versions du compte rendu supprimées, faits
 * vidés et `efface` (journal gardé), cases pré-remplies vidées, liens des
 * autres faits retirés, étapes annulées, purge du son programmée, un
 * `retrait` écrit — et la PREUVE INITIALE de l'accord N'EST PAS touchée
 * (art. 17(3)(e)).
 *
 * Mutation qui rougit : supprimer les `enregistrementConsentement` de la
 * rencontre dans le retrait → la preuve disparaît ; ou oublier la suppression
 * des segments. Contre-témoin : le drapeau d'effacement est bien posé
 * (`SET LOCAL`). Angle mort : les triggers (ajout seul, contenu immuable)
 * sont prouvés par Gate D sur une vraie base.
 */

import { describe, expect, it } from "vitest";

import { retirerAccordRencontre } from "@/lib/rgpd-erase";
import { baseEspion } from "../../../../tests/outils/base-espion";

function base() {
  return baseEspion({
    "rencontre.findUnique": () => ({
      id: "r1",
      clientId: "c1",
      debutPrevu: new Date("2026-10-06T10:00:00Z"),
      debutReel: null,
      createdAt: new Date(),
    }),
    "enregistrement.findMany": () => [{ id: "e1" }],
    "transcription.findMany": () => [{ id: "tr1" }],
    "transcriptionSegment.findMany": () => [
      { transcriptionId: "tr1", ordre: 1 },
      { transcriptionId: "tr1", ordre: 2 },
    ],
    "fait.findMany": () => [{ id: "f1" }, { id: "f2" }],
    "compteRendu.findMany": (a) =>
      (a["where"] as { rencontreId?: string }).rencontreId === "r1"
        ? [{ id: "cr1" }, { id: "cr2" }]
        : [],
    "traitementVisio.updateMany": () => ({ count: 3 }),
  });
}

describe("un retrait après coup efface tout le rendez-vous sauf la preuve", () => {
  it("tout ce qui porte la parole part ; la preuve initiale reste ; un retrait est écrit", async () => {
    const e = base();
    const r = await retirerAccordRencontre("r1", "admin-1", {
      db: e.base,
      maintenant: new Date("2026-10-07T09:00:00Z"),
    });
    expect(r).toMatchObject({ segments: 2, comptesRendus: 2, faits: 2, etapesAnnulees: 3 });
    expect(e.de("transcriptionSegment", "deleteMany")[0]!.args).toEqual({
      where: { transcriptionId: { in: ["tr1"] } },
    });
    expect(e.de("compteRendu", "deleteMany")[0]!.args).toEqual({ where: { rencontreId: "r1" } });
    expect(e.de("fait", "updateMany")[0]!.args).toMatchObject({
      where: { id: { in: ["f1", "f2"] } },
      data: { statut: "efface", enonce: "", citation: null },
    });
    expect(e.de("preRemplissage", "updateMany")[0]!.args).toMatchObject({
      data: { valeurProposee: "" },
    });
    expect(e.de("traitementVisio", "updateMany")[0]!.args).toMatchObject({
      data: { statut: "annule" },
    });
    expect(e.sqls.some((s) => s.valeurs.includes("purger_audio"))).toBe(true);
    // La trace du retrait est AJOUTÉE ; la preuve initiale n'est ni supprimée ni modifiée.
    expect(e.de("enregistrementConsentement", "create")[0]!.args).toMatchObject({
      data: { type: "retrait", enregistrementId: null, declareParId: "admin-1" },
    });
    for (const m of ["delete", "deleteMany", "update", "updateMany"]) {
      expect(e.de("enregistrementConsentement", m), m).toEqual([]);
    }
    // Journal d'effacement (motif « retrait ») pour les segments, faits, comptes rendus.
    const journal = e
      .de("effacementJournal", "createMany")
      .map((a) => (a.args["data"] as Array<{ tableCible: string; motif: string }>)[0]);
    expect(journal.map((j) => j?.tableCible)).toEqual(
      expect.arrayContaining(["transcription_segments", "faits", "comptes_rendus"]),
    );
    expect(journal.every((j) => j?.motif === "retrait")).toBe(true);
  });

  it("contre-témoin : tout se fait sous le drapeau d'effacement", async () => {
    const e = base();
    await retirerAccordRencontre("r1", "admin-1", { db: e.base });
    expect(e.sqls[0]!.sql).toMatch(/SET LOCAL axion\.effacement_rgpd = 'on'/);
  });
});
