/**
 * `produireConvention` photographie la case « Journée IA » du devis de la session
 * (`session.devis.journeeIa`) : vraie → `data.journeeIa === true` ; fausse, absente ou session
 * sans devis → le champ n'est pas posé (le gabarit lit « absent = faux »).
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
  adresseSiege: "1 rue de la Paix, 69001 Lyon",
  adresseExercice: "1 rue de la Paix, 69001 Lyon",
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
  lieuVille: "Lyon",
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

describe("produireConvention — photo de la case Journée IA", () => {
  it.each([
    ["devis à vrai", { devis: { journeeIa: true } }, true],
    ["devis à faux", { devis: { journeeIa: false } }, false],
    ["session sans devis", { devis: null }, false],
  ])("%s", async (_nom, extra, attendu) => {
    reglage.mockReturnValue(true);
    findUnique.mockResolvedValue({ ...SESSION, ...extra });
    const r = await produireConvention("s-1");
    expect(r.ok).toBe(true);
    if (attendu) expect(dernier?.props.data.journeeIa).toBe(true);
    else expect(dernier?.props.data).not.toHaveProperty("journeeIa");
  });

  it("la requête lit la colonne du devis lié", async () => {
    reglage.mockReturnValue(true);
    await produireConvention("s-1");
    expect(findUnique.mock.calls[0]![0].select.devis).toEqual({ select: { journeeIa: true } });
  });
});
