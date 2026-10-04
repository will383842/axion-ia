/**
 * Lot OPCO A7a — UN seul OPCO par client, lu par UNE règle (`opcoDuClient`).
 *
 * La console porte deux champs : `Client.opcoIdentifie` (texte libre, écrit par
 * l'inférence IDCC/NAF, renseigné sur les clients réels) et `Client.opco` (typé,
 * ajouté par le lot A1, vide sur tous les clients existants). Avant ce lot, les
 * briques récentes ne lisaient que le second, les anciennes que le premier :
 * chacune était aveugle sur la moitié des fiches.
 *
 * Témoins : un client qui n'a QUE `opcoIdentifie = "atlas"` est vu par le
 * régime, l'état des fonds et l'alerte de facturation ; un client qui n'a QUE
 * `opco` reçoit une facture subrogée et une relance adressées à son OPCO.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockEtatFondsFindMany } = vi.hoisted(() => ({ mockEtatFondsFindMany: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { etatFondsOpco: { findMany: mockEtatFondsFindMany } },
}));

import { referenceOpcoDuClient } from "./opco-referentiel";
import { entreeRegimeDepuisSession } from "./regime-paiement-session";
import { etatFondsDuClient } from "./etat-fonds-opco-lecture";
import { candidatsDelaiFacturationOpco } from "../alertes/regle-delai-facturation-opco";
import { resoudreDestinataireFacture } from "./destinataire-facture";
import { resoudreDestinataireRelance } from "./relance-destinataire";
import { construireLignesPayeurs, type ContexteSessionPayeurs } from "./dossier-payeurs";

const SEULEMENT_ANCIEN = { opco: null, opcoIdentifie: "atlas" } as const;
const SEULEMENT_TYPE = { opco: "akto", opcoIdentifie: null } as const;

beforeEach(() => {
  mockEtatFondsFindMany.mockReset();
});

describe("referenceOpcoDuClient — ce que la fiche dit de son OPCO", () => {
  it("l'OPCO typé prime, puis l'identifiant reconnu, puis le texte libre tel quel", () => {
    expect(referenceOpcoDuClient({ opco: "akto", opcoIdentifie: "atlas" })).toBe("akto");
    expect(referenceOpcoDuClient(SEULEMENT_ANCIEN)).toBe("atlas");
    expect(referenceOpcoDuClient({ opco: null, opcoIdentifie: "  Mon OPCO  " })).toBe("Mon OPCO");
  });

  it("rien, ou des blancs : null", () => {
    expect(referenceOpcoDuClient(null)).toBeNull();
    expect(referenceOpcoDuClient({ opco: null, opcoIdentifie: "   " })).toBeNull();
  });
});

describe("client avec SEULEMENT opcoIdentifie = « atlas »", () => {
  it("le régime de paiement voit Atlas", () => {
    const { entree } = entreeRegimeDepuisSession({
      client: { ...SEULEMENT_ANCIEN, effectif: 8 },
      dossiersFinancement: [],
    });
    expect(entree.opco).toBe("atlas");
  });

  it("l'état des fonds interroge les relevés d'Atlas", async () => {
    mockEtatFondsFindMany.mockResolvedValue([]);
    await etatFondsDuClient({ ...SEULEMENT_ANCIEN, idcc: null, effectif: 8 });
    expect(mockEtatFondsFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { opco: "atlas" } }),
    );
  });

  it("l'alerte de délai de facturation se lève", () => {
    const alertes = candidatsDelaiFacturationOpco(
      [
        {
          id: "s-1",
          numero: "AXI-SES-001",
          dateFin: new Date("2026-10-01T12:00:00.000Z"),
          client: SEULEMENT_ANCIEN,
        },
      ],
      // Atlas : 90 jours après la fin → limite le 2026-12-30, seuil à J-15.
      new Date("2026-12-20T12:00:00.000Z"),
    );
    expect(alertes).toHaveLength(1);
    expect(alertes[0]?.message).toContain("Atlas");
  });
});

describe("client avec SEULEMENT l'OPCO typé « akto »", () => {
  it("la facture subrogée est adressée à Akto, plus à « OPCO (à préciser) »", () => {
    const d = resoudreDestinataireFacture("opco", {
      raisonSociale: "Client SAS",
      ...SEULEMENT_TYPE,
    });
    expect(d.nom).toBe("Akto");
  });

  it("la relance est adressée à Akto", () => {
    const r = resoudreDestinataireRelance({
      destinataire: "opco",
      destinataireNom: "OPCO (à préciser)",
      dossier: null,
      client: {
        raisonSociale: "Client SAS",
        contactNom: null,
        contactEmail: null,
        ...SEULEMENT_TYPE,
      },
    });
    expect(r.nom).toBe("Akto");
  });

  it("le débiteur OPCO du dossier est Akto", () => {
    const session: ContexteSessionPayeurs = {
      financementType: "opco",
      clientId: "c-1",
      numeroDossierOpco: null,
      edofVerifieAt: null,
      ftDispositif: null,
      montantHtCents: 300000,
      opcoSubrogation: true,
      priseEnChargeMontantCents: 300000,
      client: { id: "c-1", raisonSociale: "Client SAS", ...SEULEMENT_TYPE },
    };
    const lignes = construireLignesPayeurs([], session);
    expect(lignes[0]).toMatchObject({ payeurType: "opco_subroge", payeurNom: "Akto" });
  });
});
