// @vitest-environment node
/**
 * ⛔ « Après l'appel » ne perd pas l'appréciation de l'onglet « Rendez-vous ».
 *
 * Le formulaire de l'onglet (`SuiviRendezVousForm`, champ « note ») écrit une
 * appréciation libre dans `rendez_vous_suivis`. « Valider et préparer le
 * devis » ne la montre pas et ne la transmet pas : il ne doit donc pas la
 * remettre à NULL, ni l'auteur (`renseignePar`) — l'onglet existant reste
 * juste (critère d'acceptation de la PR 4).
 *
 * Mutation qui fait rougir : dans `enregistrerSuiviDans`, écrire
 * `note: e.note ?? null` sans condition → le premier test rougit.
 * Contre-témoin : l'onglet, qui transmet `note: null` (champ vidé), l'efface.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { enregistrerSuivi } from "../suivi";
import { validerApresLAppel } from "../valider";
import { CLE_TEST, dossierEnMemoire, fiche, id, rendezVousCalendly } from "./_dossier-en-memoire";

const ADMIN = "00000000-0000-4000-8000-0000000000ad";
const CLE_INITIALE = process.env["PII_ENCRYPTION_KEY"];
beforeEach(() => {
  process.env["PII_ENCRYPTION_KEY"] = CLE_TEST;
});
afterEach(() => {
  if (CLE_INITIALE === undefined) delete process.env["PII_ENCRYPTION_KEY"];
  else process.env["PII_ENCRYPTION_KEY"] = CLE_INITIALE;
});

function scene() {
  const f = fiche({ raisonSociale: "Fiche Fictive" });
  const ev = rendezVousCalendly();
  const rencontreId = id(5);
  const base = dossierEnMemoire({
    client: [f],
    calendlyEvent: [ev],
    rencontre: [
      {
        id: rencontreId,
        source: "calendly",
        type: "visio",
        titre: "Discutons de votre projet IA",
        calendlyEventId: ev["id"],
        clientId: f["id"],
        rattachementStatut: "valide",
        statut: null,
        estTestInterne: false,
        projetId: null,
        debutPrevu: ev["startTime"],
      },
    ],
    rendezVousSuivi: [
      {
        id: "s1",
        calendlyEventId: ev["id"],
        issue: "eu_lieu",
        suite: "relance",
        suiteLe: new Date("2026-10-09T00:00:00Z"),
        note: "Appréciation fictive saisie dans l'onglet",
        renseignePar: "admin@exemple-fictif.fr",
      },
    ],
  });
  return { base, ev, rencontreId };
}

describe("⛔ « Après l'appel » ne perd pas la note de l'onglet « Rendez-vous »", () => {
  it("la note et son auteur restent après « Valider et préparer le devis »", async () => {
    const { base, rencontreId } = scene();
    await validerApresLAppel(base.client as never, {
      rencontreId,
      parAdminId: ADMIN,
      projet: { mode: "aucun" },
      faitsCoches: [],
      note: { prochaineEtape: "Rappeler la semaine prochaine" },
      suivi: { issue: "eu_lieu", suite: "devis", suiteLe: new Date("2026-10-12T00:00:00Z") },
    });
    const s = base.tables["rendezVousSuivi"]?.[0];
    expect(s?.["suite"]).toBe("devis");
    expect(s?.["note"]).toBe("Appréciation fictive saisie dans l'onglet");
    expect(s?.["renseignePar"]).toBe("admin@exemple-fictif.fr");
  });

  it("contre-témoin : l'onglet qui vide le champ efface l'appréciation", async () => {
    const { base, ev } = scene();
    await enregistrerSuivi(base.client as never, {
      calendlyEventId: ev["id"] as string,
      issue: "absent",
      suite: null,
      suiteLe: null,
      note: null,
      auteurId: ADMIN,
      renseignePar: "autre@exemple-fictif.fr",
    });
    const s = base.tables["rendezVousSuivi"]?.[0];
    expect(s?.["note"]).toBeNull();
    expect(s?.["renseignePar"]).toBe("autre@exemple-fictif.fr");
  });
});
