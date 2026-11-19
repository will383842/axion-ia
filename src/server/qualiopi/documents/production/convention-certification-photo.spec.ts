/**
 * `produireConvention` photographie le réglage « certification obtenue » à la génération :
 *  - réglage faux + condition suspensive demandée → refus, `generateDocument` jamais appelé ;
 *  - réglage faux sans condition → `data.certificationObtenue === false` et numéro Qualiopi
 *    vidé dans l'identité passée au gabarit ;
 *  - réglage vrai → `true` et identité intacte.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type React from "react";

vi.mock("@/lib/prisma", () => ({
  prisma: { trainingSession: { findUnique: vi.fn() } },
}));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/server/qualiopi/documents/organisme", () => ({ getOrganismeIdentite: vi.fn() }));
vi.mock("@/server/qualiopi/documents/documents-service", () => ({ generateDocument: vi.fn() }));
vi.mock("@/server/qualiopi/config/flag", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  isQualiopiCertificationObtenue: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { getOrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { generateDocument } from "@/server/qualiopi/documents/documents-service";
import { isQualiopiCertificationObtenue } from "@/server/qualiopi/config/flag";
import { produireConvention } from "./producteurs";

const findUnique = (
  prisma as unknown as { trainingSession: { findUnique: ReturnType<typeof vi.fn> } }
).trainingSession.findUnique;
const reglage = isQualiopiCertificationObtenue as ReturnType<typeof vi.fn>;

const IDENTITE = {
  raisonSociale: "Axion-IA SAS",
  nda: "84691234567",
  qualiopi: "FR-2024-001",
  siret: "12345678901234",
  adresseSiege: "1 rue de la Paix, 38000 Grenoble",
  adresseExercice: "1 rue de la Paix, 38000 Grenoble",
  email: "contact@axion-ia.fr",
  telephone: "+33 1 00 00 00 00",
  site: "https://www.axion-ia.fr",
};

const SESSION = {
  id: "s-1",
  clientId: "c-1",
  titreSession: "IA pour bien commencer",
  dateDebut: new Date("2026-12-01T08:00:00Z"),
  dateFin: new Date("2026-12-01T16:00:00Z"),
  modalite: "presentiel",
  lieuType: "sur_site",
  lieuIntitule: "SCI Invest Sun",
  lieuAdresse: "2 avenue Alsace-Lorraine",
  lieuCodePostal: "38000",
  lieuVille: "Grenoble",
  lieuSalle: null,
  lieuVisioUrl: null,
  nbParticipantsPrevus: 2,
  enrollments: [],
  montantHtCents: 140_000,
  formationSnapshot: null,
  formation: {
    objectifsPedagogiques: ["Utiliser l'IA"],
    dureeHeures: 7,
    offreSite: { publicViseFr: "Dirigeants" },
  },
  client: {
    raisonSociale: "SCI Invest Sun",
    siret: "98765432100011",
    adresse: "10 avenue du Client",
    contactNom: "Gérante",
    contactEmail: null,
    opco: "OPCO Atlas",
    opcoIdentifie: true,
  },
};

const CONDITION = { seuilConditionBps: 5000, seuilConditionCents: null, dateLimite: "2099-12-15" };

type Element = React.ReactElement<{
  data: Record<string, unknown>;
  identite: { qualiopi: string };
}>;
let dernier: Element | null = null;

beforeEach(() => {
  vi.clearAllMocks();
  dernier = null;
  findUnique.mockResolvedValue(SESSION);
  (getOrganismeIdentite as ReturnType<typeof vi.fn>).mockResolvedValue(IDENTITE);
  (generateDocument as ReturnType<typeof vi.fn>).mockImplementation(
    async (input: { buildElement: (n: string) => React.ReactElement }) => {
      dernier = input.buildElement("AXI-DOC-TEST") as Element;
      return { id: "doc-1", numero: "AXI-DOC-TEST" };
    },
  );
});

describe("🔴 produireConvention — photo du réglage « certification obtenue »", () => {
  it("réglage faux + condition suspensive : refus clair, rien n'est généré", async () => {
    reglage.mockReturnValue(false);
    const r = await produireConvention("s-1", { conditionSuspensiveOpco: CONDITION as never });
    expect(r).toEqual({
      ok: false,
      motif: "La condition suspensive n'est disponible qu'une fois la certification obtenue.",
    });
    expect(generateDocument).not.toHaveBeenCalled();
  });

  it("réglage faux sans condition : certificationObtenue faux, numéro Qualiopi vidé", async () => {
    reglage.mockReturnValue(false);
    const r = await produireConvention("s-1");
    expect(r.ok).toBe(true);
    expect(dernier?.props.data.certificationObtenue).toBe(false);
    expect(dernier?.props.identite.qualiopi).toBe("");
  });

  it("réglage vrai : certificationObtenue vrai, identité intacte", async () => {
    reglage.mockReturnValue(true);
    const r = await produireConvention("s-1");
    expect(r.ok).toBe(true);
    expect(dernier?.props.data.certificationObtenue).toBe(true);
    expect(dernier?.props.identite.qualiopi).toBe("FR-2024-001");
  });
});
