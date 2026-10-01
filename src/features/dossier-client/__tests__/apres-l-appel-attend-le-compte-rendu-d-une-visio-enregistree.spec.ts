// @vitest-environment node
/**
 * M-2 (2e vérification du chantier visio) — « Après l'appel » ouvert juste
 * après une visio ENREGISTRÉE, avant que le compte rendu soit prêt.
 *
 *   1. « A eu lieu » se valide SANS note tant que le compte rendu de
 *      l'enregistrement est en préparation (enregistrement en traitement, ou
 *      compte rendu `brouillon`) — la note n'est plus forcée ;
 *   2. contre-témoin : sans enregistrement ni compte rendu, la note reste exigée ;
 *   3. l'état « en préparation / prêt / aucun » est lu par UNE fonction, celle
 *      de la vue (titre « Note (facultative) » et bandeau) ;
 *   4. valider le compte rendu de l'enregistrement SIGNALE la note écrite
 *      remplacée et les informations qui restent à valider dans « Après
 *      l'appel » (le message le dit).
 *
 * Mutation qui rougit : retirer `compteRenduEnregistre` du calcul de
 * `existe` dans `valider.ts` → le premier test rougit.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { validerApresLAppel } from "../valider";
import { compteRenduEnregistre, titreDeLaNote } from "../compte-rendu-en-preparation";
import {
  messageApresValidationDuCompteRendu,
  validerCompteRendu,
} from "@/server/visio/gestes-compte-rendu";
import { CLE_TEST, dossierEnMemoire, fiche, id, rendezVousCalendly } from "./_dossier-en-memoire";
import { baseEspion } from "../../../../tests/outils/base-espion";

const ADMIN = "00000000-0000-4000-8000-0000000000ad";
const CLE_INITIALE = process.env["PII_ENCRYPTION_KEY"];
beforeEach(() => {
  process.env["PII_ENCRYPTION_KEY"] = CLE_TEST;
});
afterEach(() => {
  if (CLE_INITIALE === undefined) delete process.env["PII_ENCRYPTION_KEY"];
  else process.env["PII_ENCRYPTION_KEY"] = CLE_INITIALE;
});

function scene(extra: { enregistrement?: string; compteRendu?: string } = {}) {
  const f = fiche({ raisonSociale: "Fiche Fictive" });
  const ev = rendezVousCalendly();
  const rencontreId = id(7);
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
    enregistrement: extra.enregistrement
      ? [{ id: id(8), rencontreId, statut: extra.enregistrement }]
      : [],
    compteRendu: extra.compteRendu
      ? [{ id: id(9), rencontreId, version: 1, origine: "ia", statut: extra.compteRendu }]
      : [],
  });
  return { base, rencontreId };
}

const valider = (base: ReturnType<typeof scene>["base"], rencontreId: string) =>
  validerApresLAppel(base.client as never, {
    rencontreId,
    parAdminId: ADMIN,
    projet: { mode: "aucun" },
    faitsCoches: [],
    note: {},
    suivi: { issue: "eu_lieu", suite: "relance", suiteLe: new Date("2026-10-12T00:00:00Z") },
  });

describe("M-2 — « Après l'appel » avant le compte rendu d'une visio enregistrée", () => {
  it("enregistrement en traitement : « A eu lieu » se valide sans note", async () => {
    const { base, rencontreId } = scene({ enregistrement: "en_traitement" });
    await expect(valider(base, rencontreId)).resolves.toMatchObject({ compteRenduId: null });
  });

  it("compte rendu encore en brouillon : pas de note exigée", async () => {
    const { base, rencontreId } = scene({ compteRendu: "brouillon" });
    await expect(valider(base, rencontreId)).resolves.toBeTruthy();
  });

  it("contre-témoin : ni enregistrement ni compte rendu, la note reste exigée", async () => {
    const { base, rencontreId } = scene();
    await expect(valider(base, rencontreId)).rejects.toThrow(/au moins une ligne de note/);
  });

  it("contre-témoin : un enregistrement refusé ne dispense pas de la note", async () => {
    const { base, rencontreId } = scene({ enregistrement: "refuse" });
    await expect(valider(base, rencontreId)).rejects.toThrow(/au moins une ligne de note/);
  });

  it("la vue lit l'état : en préparation, prêt, ou aucun", async () => {
    const enCours = scene({ enregistrement: "depose" });
    expect(await compteRenduEnregistre(enCours.base.client as never, enCours.rencontreId)).toBe(
      "en_preparation",
    );
    const pret = scene({ enregistrement: "compte_rendu_pret", compteRendu: "a_valider" });
    expect(await compteRenduEnregistre(pret.base.client as never, pret.rencontreId)).toBe("pret");
    const rien = scene();
    expect(await compteRenduEnregistre(rien.base.client as never, rien.rencontreId)).toBe("aucun");
    expect(titreDeLaNote("en_preparation")).toBe("Note (facultative)");
    expect(titreDeLaNote("pret")).toBe("Note (facultative)");
    expect(titreDeLaNote("aucun")).toBe("Note (pas d'enregistrement)");
  });

  it("valider le compte rendu signale la note remplacée et les informations à valider", async () => {
    const e = baseEspion({
      "compteRendu.findUnique": () => ({ id: "cr1", rencontreId: "r1", statut: "a_valider" }),
      "compteRendu.count": () => 1,
      "fait.count": () => 3,
      "enregistrement.findMany": () => [],
    });
    const r = await validerCompteRendu(e.base, {
      compteRenduId: "cr1",
      parAdminId: "a",
      maintenant: new Date("2026-10-06T11:00:00Z"),
    });
    expect(r).toEqual({ noteManuelleRemplacee: true, faitsAValider: 3 });
    const m = messageApresValidationDuCompteRendu(r);
    expect(m).toContain("Après l'appel");
    expect(m).toContain("3 informations");
    expect(m).toMatch(/note/);
    expect(
      messageApresValidationDuCompteRendu({ noteManuelleRemplacee: false, faitsAValider: 0 }),
    ).toBe("Compte rendu validé. Le son de l'appel va être supprimé.");
  });
});
