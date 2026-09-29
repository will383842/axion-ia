// @vitest-environment node
/**
 * ⛔ Le suivi d'une rencontre Calendly est écrit DANS LES DEUX tables, dans
 * la même transaction, par la fonction unique `enregistrerSuivi()` : la
 * rencontre (`rencontre_suivis`, l'autorité) et l'onglet « Rendez-vous »
 * (`rendez_vous_suivis`), tant que le lien Calendly vit. Elles ne divergent
 * jamais.
 *
 * Mutation qui fait rougir : retirer le bloc « La recopie dans l'onglet »
 * de `suivi.ts` → le premier test rougit (RendezVousSuivi absent).
 * Contre-témoins : une rencontre SAISIE dans la console n'écrit que
 * `rencontre_suivis` (pas de Calendly) et prend le statut de son issue ; un
 * type hors liste blanche n'écrit que `rendez_vous_suivis`, comme avant.
 * Angle mort : `issue-apporteur-actions.ts` écrit `rendez_vous_suivis` sans
 * rencontre (exception nommée : les apporteurs n'ont pas de dossier client).
 */

import { describe, expect, it } from "vitest";

import { enregistrerSuivi } from "../suivi";
import { dossierEnMemoire, fiche, id, rendezVousCalendly } from "./_dossier-en-memoire";

const ADMIN = "00000000-0000-4000-8000-0000000000ad";
const LE = new Date("2026-10-10T00:00:00Z");

describe("⛔ le suivi d'une rencontre Calendly est recopié dans l'onglet", () => {
  it("les deux tables, mêmes valeurs, et le statut reste celui de Calendly", async () => {
    const ev = rendezVousCalendly();
    const base = dossierEnMemoire({ calendlyEvent: [ev] });
    const r = await enregistrerSuivi(base.client as never, {
      calendlyEventId: ev["id"] as string,
      issue: "eu_lieu",
      suite: "devis",
      suiteLe: LE,
      note: "Intéressé",
      auteurId: ADMIN,
      renseignePar: "w@exemple-fictif.fr",
    });
    expect(r.suiviCalendlyEcrit).toBe(true);
    const s = base.tables["rencontreSuivi"]?.[0];
    const rv = base.tables["rendezVousSuivi"]?.[0];
    expect(s?.["issue"]).toBe("eu_lieu");
    expect(rv?.["issue"]).toBe("eu_lieu");
    expect(s?.["suite"]).toBe(rv?.["suite"]);
    expect((s?.["suiteLe"] as Date).getTime()).toBe((rv?.["suiteLe"] as Date).getTime());
    // La note n'existe que dans l'onglet : sur la rencontre, une note est un fait.
    expect(s?.["note"]).toBeUndefined();
    expect(rv?.["note"]).toBe("Intéressé");
    expect(base.tables["rencontre"]?.[0]?.["statut"]).toBeNull();
  });

  it("contre-témoin : une rencontre saisie n'écrit pas l'onglet, et prend le statut de l'issue", async () => {
    const f = fiche({ raisonSociale: "Fiche Fictive" });
    const rencontreId = id(5);
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
          calendlyEventId: null,
          estTestInterne: false,
        },
      ],
    });
    const r = await enregistrerSuivi(base.client as never, {
      rencontreId,
      issue: "absent",
      suite: null,
      suiteLe: null,
      auteurId: ADMIN,
    });
    expect(r.suiviCalendlyEcrit).toBe(false);
    expect(base.tables["rendezVousSuivi"] ?? []).toHaveLength(0);
    expect(base.tables["rencontre"]?.[0]?.["statut"]).toBe("absent");
  });

  it("contre-témoin : un échange hors liste blanche n'écrit que l'onglet", async () => {
    const ev = rendezVousCalendly({ eventTypeName: "Échange apporteur d'affaires" });
    const base = dossierEnMemoire({ calendlyEvent: [ev] });
    const r = await enregistrerSuivi(base.client as never, {
      calendlyEventId: ev["id"] as string,
      issue: "absent",
      suite: null,
      suiteLe: null,
      auteurId: ADMIN,
    });
    expect(r.rencontreId).toBeNull();
    expect(base.tables["rencontre"] ?? []).toHaveLength(0);
    expect(base.tables["rencontreSuivi"] ?? []).toHaveLength(0);
    expect(base.tables["rendezVousSuivi"]).toHaveLength(1);
  });

  it("une suite sans date est refusée, et rien n'est écrit", async () => {
    const ev = rendezVousCalendly();
    const base = dossierEnMemoire({ calendlyEvent: [ev] });
    await expect(
      enregistrerSuivi(base.client as never, {
        calendlyEventId: ev["id"] as string,
        issue: "eu_lieu",
        suite: "relance",
        suiteLe: null,
        auteurId: ADMIN,
      }),
    ).rejects.toThrow(/sans date/);
    expect(base.tables["rendezVousSuivi"] ?? []).toHaveLength(0);
    expect(base.tables["rencontre"] ?? []).toHaveLength(0);
  });
});
