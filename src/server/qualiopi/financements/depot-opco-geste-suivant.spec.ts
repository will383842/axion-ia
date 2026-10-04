/**
 * Lot OPCO A7b (manque n°9) — la page Financement mène au geste suivant :
 * lien vers le portail de dépôt de l'OPCO (lu dans `OPCO_FICHES`, rien
 * d'inventé), saisie de l'accord écrit au même endroit que le dépôt, et
 * estimation au barème en lecture seule.
 */

import { describe, expect, it } from "vitest";
import { encartDepot } from "./dossier-pret-a-deposer";
import { OPCO_FICHES, OPCO_IDS } from "./opco-referentiel";
import { planAccordEcrit } from "./accord-ecrit";
import { entreeEstimationDeSession } from "./estimation-opco-session";

const DEBUT = new Date("2026-11-16T08:00:00.000Z");

describe("encartDepot — lien du portail = celui de la fiche OPCO", () => {
  it.each(OPCO_IDS)("%s", (opco) => {
    const e = encartDepot({ opco, dateDebut: DEBUT, regime: "inconnu", etatFonds: null });
    expect(e.portailUrl).toBe(OPCO_FICHES[opco].portailEntrepriseUrl.valeur);
  });

  it("OPCOMMERCE : l'adresse relevée", () => {
    const e = encartDepot({
      opco: "opcommerce",
      dateDebut: DEBUT,
      regime: "inconnu",
      etatFonds: null,
    });
    expect(e.portailUrl).toBe("https://entreprise.lopcommerce.com/forconet/");
  });

  it("OPCO inconnu : aucun lien", () => {
    const e = encartDepot({ opco: null, dateDebut: DEBUT, regime: "inconnu", etatFonds: null });
    expect(e.portailUrl).toBeNull();
  });
});

describe("planAccordEcrit — où et comment la date de l'accord s'écrit", () => {
  it("accord déjà acté (accord reçu, facturé, payé) : la date seule", () => {
    for (const statut of ["accord_recu", "facture", "paiement_recu"] as const) {
      expect(planAccordEcrit({ statut, depotFaitLe: null })).toEqual({ geste: "date_seule" });
    }
  });

  it("demande envoyée : l'accord est acté avec sa date", () => {
    expect(planAccordEcrit({ statut: "envoye", depotFaitLe: null })).toEqual({
      geste: "transitions",
      vers: ["accord_recu"],
    });
  });

  it("dossier à monter dont le dépôt est saisi : envoi constaté, puis accord", () => {
    expect(
      planAccordEcrit({ statut: "a_monter", depotFaitLe: new Date("2026-10-01T00:00:00Z") }),
    ).toEqual({ geste: "transitions", vers: ["envoye", "accord_recu"] });
  });

  it("dossier à monter sans dépôt : refus qui dit quoi faire", () => {
    const p = planAccordEcrit({ statut: "a_monter", depotFaitLe: null });
    expect(p.geste).toBe("refus");
    if (p.geste === "refus") expect(p.message).toMatch(/dépôt/);
  });

  it("refusé ou clos : refus", () => {
    expect(planAccordEcrit({ statut: "refuse", depotFaitLe: null }).geste).toBe("refus");
    expect(planAccordEcrit({ statut: "clos", depotFaitLe: null }).geste).toBe("refus");
  });
});

describe("entreeEstimationDeSession — ce que l'estimation lit de la session", () => {
  const base = {
    dateDebut: DEBUT,
    modalite: "presentiel" as const,
    interEntreprises: false,
    dureeReelleHeures: null,
    formation: { dureeHeures: 14 },
    nbParticipantsPrevus: 4,
    nbParticipantsReels: null,
    montantHtCents: 280_000,
    client: {
      opco: "atlas",
      opcoIdentifie: null,
      idcc: "1486",
      effectif: 12,
      opcoEnveloppeAnnuelleCents: null,
    },
  };

  it("intra, durée de la formation, participants prévus, barème à la date de début", () => {
    const e = entreeEstimationDeSession(base);
    expect(e).toEqual({
      nbParticipants: 4,
      dureeHeures: 14,
      modalite: "intra",
      montantHtCents: 280_000,
      opco: "atlas",
      idcc: "1486",
      effectif: 12,
      asOf: DEBUT,
    });
  });

  it("inter distanciel, durée réelle et participants réels quand ils existent", () => {
    const e = entreeEstimationDeSession({
      ...base,
      interEntreprises: true,
      modalite: "distanciel",
      dureeReelleHeures: 7,
      nbParticipantsReels: 3,
    });
    expect(e?.modalite).toBe("inter_distanciel");
    expect(e?.dureeHeures).toBe(7);
    expect(e?.nbParticipants).toBe(3);
  });

  it("OPCO lu par la règle unique (texte libre reconnu) et enveloppe de la fiche", () => {
    const e = entreeEstimationDeSession({
      ...base,
      interEntreprises: true,
      client: { ...base.client, opco: null, opcoIdentifie: "akto", opcoEnveloppeAnnuelleCents: 9 },
    });
    expect(e?.opco).toBe("akto");
    expect(e?.modalite).toBe("inter_presentiel");
    expect(e?.enveloppeRestanteCents).toBe(9);
  });

  it("sans client ou sans OPCO : pas d'estimation", () => {
    expect(entreeEstimationDeSession({ ...base, client: null })).toBeNull();
    expect(
      entreeEstimationDeSession({ ...base, client: { ...base.client, opco: null } }),
    ).toBeNull();
  });
});
