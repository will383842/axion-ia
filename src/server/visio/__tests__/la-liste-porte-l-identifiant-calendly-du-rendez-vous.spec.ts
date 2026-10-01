/**
 * La liste de l'extension porte l'identifiant Calendly du rendez-vous
 * (« Enregistrer cette visio ? », 2026-10-01) : le lien « Oui, enregistrer »
 * de la console donne cet identifiant quand la rencontre n'existe pas encore,
 * et l'extension doit le retrouver dans sa liste du jour pour la pré-sélection.
 * Champ FACULTATIF du contrat v1 : une extension 1.2.0 l'ignore.
 */

import { beforeEach, describe, expect, it } from "vitest";

import { RencontreDuJour } from "@/lib/schemas/enregistreur";
import { listerRencontresDuJour } from "../liste-enregistreur";
import {
  CLE_DE_TEST,
  commePrisma,
  fausseBase,
  semerRencontreCalendly,
  T0,
} from "../../../../tests/outils/fixtures-enregistreur";

describe("la liste porte l'identifiant Calendly du rendez-vous", () => {
  beforeEach(() => {
    process.env["PII_ENCRYPTION_KEY"] = CLE_DE_TEST;
  });

  it("une rencontre Calendly renvoie son calendlyEventId", async () => {
    const db = fausseBase();
    const { calendlyEventId } = semerRencontreCalendly(db);
    const liste = await listerRencontresDuJour(commePrisma(db), { maintenant: T0, mode: "ouvert" });
    expect(liste).toHaveLength(1);
    expect(liste[0]?.calendlyEventId).toBe(calendlyEventId);
  });

  it("le champ est facultatif dans le contrat", () => {
    const sans = {
      rencontreId: "3f1c2a4e-8b7d-4c1e-9a2b-1c2d3e4f5a6b",
      source: "saisie_manuelle",
      titre: "x",
      debutPrevu: null,
      finPrevue: null,
      personne: null,
      entrepriseDeclaree: null,
      clientPropose: null,
      motifProposition: null,
      reponseCalendly: null,
      nonSurCalendly: false,
      refusAnterieur: false,
      estTestInterne: false,
      enregistrementActifId: null,
      preavis: null,
    };
    expect(RencontreDuJour.safeParse(sans).success).toBe(true);
    expect(RencontreDuJour.safeParse({ ...sans, calendlyEventId: "evt_1" }).success).toBe(true);
  });
});
