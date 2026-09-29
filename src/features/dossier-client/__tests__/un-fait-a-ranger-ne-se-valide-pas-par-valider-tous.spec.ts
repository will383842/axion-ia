// @vitest-environment node
/**
 * ⛔ Un fait « à ranger » (portée non choisie) ne se valide JAMAIS par
 * « Valider tous » : il n'est pas coché d'avance, et s'il est coché à la main
 * sans projet, « Valider et préparer le devis » le REFUSE et n'écrit rien
 * (la base le refuserait aussi : CHECK `faits_valide_range`).
 *
 * Mutation qui fait rougir : retirer `if (f.portee === "a_ranger") return false`
 * de `validableEnLot` → le premier test rougit ; retirer le refus dans
 * `validerApresLAppel` → le second rougit sur le contrôle rejoué au COMMIT.
 * Contre-témoin : le même fait, coché avec un projet choisi, est RANGÉ dans
 * ce projet puis validé, dans la même transaction.
 */

import { describe, expect, it } from "vitest";

import { validableEnLot, validerApresLAppel } from "../valider";
import { dossierEnMemoire, fiche, id } from "./_dossier-en-memoire";

const ADMIN = "00000000-0000-4000-8000-0000000000ad";

function scene() {
  const f = fiche({ raisonSociale: "Fiche Fictive" });
  const rencontreId = id(5);
  const faitId = id(6);
  const base = dossierEnMemoire({
    client: [f],
    rencontre: [
      {
        id: rencontreId,
        source: "saisie_manuelle",
        type: "visio",
        titre: "Rendez-vous",
        clientId: f["id"],
        rattachementStatut: "valide",
        statut: "planifie",
        estTestInterne: false,
        calendlyEventId: null,
        projetId: null,
        debutPrevu: new Date("2026-10-06T08:00:00Z"),
      },
    ],
    fait: [
      {
        id: faitId,
        clientId: f["id"],
        portee: "a_ranger",
        projetId: null,
        type: "besoin",
        cle: "former",
        enonce: "",
        certitude: "dit_explicitement",
        confiance: "haute",
        source: "transcription",
        rencontreId,
        statut: "propose",
        suivi: null,
      },
    ],
  });
  return { base, f, rencontreId, faitId };
}

describe("⛔ un fait à ranger ne se valide pas par « Valider tous »", () => {
  it("il n'est pas coché d'avance", () => {
    expect(
      validableEnLot({
        id: "x",
        type: "besoin",
        portee: "a_ranger",
        statut: "propose",
        confiance: "haute",
        certitude: "dit_explicitement",
      }),
    ).toBe(false);
  });

  it("coché sans projet : refusé, et RIEN n'est écrit", async () => {
    const { base, rencontreId, faitId } = scene();
    await expect(
      validerApresLAppel(base.client as never, {
        rencontreId,
        parAdminId: ADMIN,
        projet: { mode: "aucun" },
        faitsCoches: [faitId],
        note: null,
        suivi: { issue: "eu_lieu", suite: "aucune", suiteLe: null },
      }),
    ).rejects.toThrow(/choisissez un projet/);
    expect(base.tables["fait"]?.[0]?.["statut"]).toBe("propose");
    expect(base.tables["rencontreSuivi"] ?? []).toHaveLength(0);
    expect(base.tables["faitEvenement"] ?? []).toHaveLength(0);
  });

  it("contre-témoin : avec un nouveau projet, il est rangé PUIS validé", async () => {
    const { base, rencontreId, faitId } = scene();
    const r = await validerApresLAppel(base.client as never, {
      rencontreId,
      parAdminId: ADMIN,
      projet: { mode: "nouveau", titre: "Formation commerciale" },
      faitsCoches: [faitId],
      note: null,
      suivi: { issue: "eu_lieu", suite: "aucune", suiteLe: null },
    });
    const fait = base.tables["fait"]?.[0];
    expect(fait?.["portee"]).toBe("projet");
    expect(fait?.["projetId"]).toBe(r.projetId);
    expect(fait?.["statut"]).toBe("valide");
    expect(base.tables["rencontre"]?.[0]?.["projetId"]).toBe(r.projetId);
  });
});
