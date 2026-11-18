/**
 * Une fiche qui PASSE en entreprise devient éligible au CRM Pro au prochain
 * balayage (`balayerDossiersClients`) ; un particulier ne part jamais.
 * Aucun appel direct à ajouter dans l'action de changement de type.
 */
import { describe, expect, it } from "vitest";

import {
  evenementDossierClient,
  type EntreeInstantaneCrm,
} from "@/server/crm-sync/instantane-dossier";

function entree(type: "entreprise" | "particulier"): EntreeInstantaneCrm {
  return {
    clientId: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
    numero: "AXI-CLI-004",
    type,
    raisonSociale: "Dupont Conseil SAS",
    siren: null,
    adresseRue: null,
    adresseCodePostal: null,
    adresseVille: null,
    telephone: null,
    effectif: null,
    factureEmise: false,
    factureHorsConsole: false,
    questionnaire: null,
    contacts: [],
  };
}

describe("éligibilité au CRM selon le type de la fiche", () => {
  it("une entrée « entreprise » donne un événement", () => {
    expect(
      evenementDossierClient(entree("entreprise"), 1, new Date("2026-11-18T10:00:00Z")),
    ).not.toBeNull();
  });
  it("une entrée « particulier » donne null", () => {
    expect(
      evenementDossierClient(entree("particulier"), 1, new Date("2026-11-18T10:00:00Z")),
    ).toBeNull();
  });
});
