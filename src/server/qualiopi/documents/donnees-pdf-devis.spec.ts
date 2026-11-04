import { describe, it, expect, vi } from "vitest";

vi.mock("./organisme", () => ({ getOrganismeIdentite: vi.fn() }));
vi.mock("@/server/qualiopi/config/site-settings", () => ({ getQualiopiConfig: vi.fn() }));
vi.mock("@/server/qualiopi/config/flag", () => ({ isQualiopiCertificationObtenue: vi.fn() }));

import { donneesPdfDevis, type DevisPourPdf } from "./donnees-pdf-devis";

const DEVIS: DevisPourPdf = {
  numero: "AXI-DEV-2026-001",
  lignes: [{ designation: "Formation IA", quantite: 1, prixUnitaireHtCents: 150000 }],
  activite: null,
  refClient: "REF-1",
  financementSuggere: "opco",
  montantOpcoEstimeCents: 100000,
  resteAChargeCents: 50000,
  dateValidite: new Date("2026-12-31T12:00:00Z"),
  client: {
    type: "particulier",
    raisonSociale: "Jeanne Martin",
    siret: null,
    adresse: null,
    adresseRue: "1 rue A",
    adresseCodePostal: "38000",
    adresseVille: "Lyon",
    contactEmail: "j@example.com",
  },
};

const identite = { raisonSociale: "Axion", site: "https://axion-ia.com" } as never;
const maintenant = new Date("2026-11-04T10:00:00Z");

describe("donneesPdfDevis", () => {
  it("est déterministe (mêmes entrées, mêmes données)", () => {
    const ctx = {
      identite,
      regimeTva: "assujetti" as const,
      tauxStandard: 20,
      certificationObtenue: true,
    };
    expect(donneesPdfDevis(DEVIS, ctx, maintenant)).toEqual(
      donneesPdfDevis(DEVIS, ctx, maintenant),
    );
  });

  it("reprend client, adresse, particulier et estimation si certifié", () => {
    const d = donneesPdfDevis(
      DEVIS,
      { identite, regimeTva: "assujetti", tauxStandard: 20, certificationObtenue: true },
      maintenant,
    );
    expect(d.numero).toBe("AXI-DEV-2026-001");
    expect(d.client.estPersonnePhysique).toBe(true);
    expect(d.client.adresse).toBe("1 rue A, 38000 Lyon");
    expect(d.financementSuggere).toBe("OPCO");
    expect(d.montantOpcoEstimeCents).toBe(100000);
  });

  it("sans certification : pas de montants d'estimation, une mention à la place", () => {
    const d = donneesPdfDevis(
      DEVIS,
      { identite, regimeTva: "assujetti", tauxStandard: 20, certificationObtenue: false },
      maintenant,
    );
    expect(d.montantOpcoEstimeCents).toBeUndefined();
    expect(d.mentionEstimationIndisponible).toBeTruthy();
  });
});
