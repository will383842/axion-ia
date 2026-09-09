/**
 * Tests — échéance de paiement des honoraires (module PUR).
 *
 * Le test qui compte n'est pas « 30 jours plus tard » : c'est le REPLI. Une
 * échéance lue sur la seule colonne `echeanceAt` aurait laissé tout le stock
 * antérieur au correctif hors du pilotage, en silence.
 */

import { describe, expect, it } from "vitest";

import {
  calculerEcheanceHonoraires,
  DELAI_PAIEMENT_HONORAIRES_JOURS,
  echeanceEffective,
  joursDeRetard,
  STATUTS_RELEVE_DU,
} from "./echeance";
import { DELAI_PAIEMENT_MAX_JOURS } from "../financements/conditions-client";

const LE_1ER = new Date("2026-09-01T10:00:00.000Z");

describe("calculerEcheanceHonoraires", () => {
  it("pose l'échéance 30 jours après l'émission de la facture", () => {
    expect(calculerEcheanceHonoraires(LE_1ER).toISOString()).toBe("2026-10-01T10:00:00.000Z");
  });

  it("🔴 le délai contractuel reste sous le plafond d'ordre public (L.441-10)", () => {
    // Cette valeur recopie la clause 4 du contrat de sous-traitance. Un délai
    // au-delà de 60 jours serait réputé non écrit et exposerait l'organisme à
    // une amende administrative — la constante ne peut pas dériver en silence.
    expect(DELAI_PAIEMENT_HONORAIRES_JOURS).toBe(30);
    expect(DELAI_PAIEMENT_HONORAIRES_JOURS).toBeLessThanOrEqual(DELAI_PAIEMENT_MAX_JOURS);
  });

  it("ne mute pas la date reçue", () => {
    const source = new Date(LE_1ER);
    calculerEcheanceHonoraires(source);
    expect(source.toISOString()).toBe(LE_1ER.toISOString());
  });
});

describe("echeanceEffective — le repli est le cœur du correctif", () => {
  it("rend la colonne quand elle est posée", () => {
    const posee = new Date("2026-10-15T00:00:00.000Z");
    expect(
      echeanceEffective({
        statut: "facture_recue",
        dateFacture: LE_1ER,
        echeanceAt: posee,
        payeAt: null,
      }),
    ).toEqual(posee);
  });

  it("🔴 retombe sur dateFacture + 30 j quand la colonne est NULLE", () => {
    // Le cas de TOUS les relevés passés en « facture reçue » avant le
    // 2026-09-09 : la colonne existait, indexée, et rien ne l'écrivait.
    const effective = echeanceEffective({
      statut: "facture_recue",
      dateFacture: LE_1ER,
      echeanceAt: null,
      payeAt: null,
    });
    expect(effective?.toISOString()).toBe("2026-10-01T10:00:00.000Z");
  });

  it("n'invente aucune échéance sans facture", () => {
    // Un relevé validé mais non facturé n'a pas d'exigibilité : lui en donner
    // une lui fabriquerait une ancienneté de dette devinée.
    expect(
      echeanceEffective({ statut: "valide", dateFacture: null, echeanceAt: null, payeAt: null }),
    ).toBeNull();
  });
});

describe("joursDeRetard", () => {
  const now = new Date("2026-10-11T10:00:00.000Z"); // échéance + 10 j

  it("compte les jours écoulés depuis l'échéance", () => {
    expect(
      joursDeRetard(
        { statut: "facture_recue", dateFacture: LE_1ER, echeanceAt: null, payeAt: null },
        now,
      ),
    ).toBe(10);
  });

  it("rend null avant l'échéance", () => {
    expect(
      joursDeRetard(
        { statut: "facture_recue", dateFacture: LE_1ER, echeanceAt: null, payeAt: null },
        new Date("2026-09-30T10:00:00.000Z"),
      ),
    ).toBeNull();
  });

  it("🔑 le jour même de l'échéance n'est pas un retard", () => {
    // Frontière : à l'instant exact de l'échéance, le paiement est encore dans
    // les temps. Alerter ici ferait tomber l'alerte le matin du jour où l'on
    // paie.
    expect(
      joursDeRetard(
        { statut: "facture_recue", dateFacture: LE_1ER, echeanceAt: null, payeAt: null },
        new Date("2026-10-01T10:00:00.000Z"),
      ),
    ).toBeNull();
  });

  it("🔴 un relevé PAYÉ n'est jamais en retard, même payé en retard", () => {
    // Le retard s'est produit ; il ne se constate plus. Rouvrir sur un fait
    // acquitté transformerait la liste d'alertes en historique.
    expect(
      joursDeRetard(
        {
          statut: "paye",
          dateFacture: LE_1ER,
          echeanceAt: null,
          payeAt: new Date("2026-10-05T00:00:00.000Z"),
        },
        now,
      ),
    ).toBeNull();
  });

  it("ignore les statuts qui ne portent aucune dette", () => {
    for (const statut of ["brouillon", "a_valider", "annule"] as const) {
      expect(
        joursDeRetard({ statut, dateFacture: LE_1ER, echeanceAt: null, payeAt: null }, now),
        `« ${statut} » ne porte pas de dette exigible`,
      ).toBeNull();
    }
  });

  it("🔑 CONTRE-TÉMOIN : les statuts retenus produisent bien un retard", () => {
    // Sans ce témoin positif, la série de `toBeNull()` ci-dessus resterait
    // verte si `joursDeRetard` rendait `null` pour TOUT LE MONDE.
    const avecDette = STATUTS_RELEVE_DU.map((statut) =>
      joursDeRetard({ statut, dateFacture: LE_1ER, echeanceAt: null, payeAt: null }, now),
    );
    expect(avecDette).toEqual([10, 10]);
  });
});
