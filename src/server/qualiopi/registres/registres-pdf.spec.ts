/**
 * Tests — registres/registres-pdf.ts (LOT 2 — A3/A7/A8/A17/A18).
 *
 * Stratégie : mock @/lib/prisma + organisme ; rendu react-pdf RÉEL (fallback
 * polices built-in) → buffer %PDF + filename horodaté. Vérifie que chaque
 * builder sélectionne les données réelles du bon modèle Prisma.
 */

import { afterEach, beforeAll, describe, it, expect, vi, beforeEach } from "vitest";
import { registerPdfTestFontsFallback } from "@/server/qualiopi/documents/register-pdf-test-fonts";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    reclamation: { findMany: vi.fn() },
    veille: { findMany: vi.fn() },
    revueDirection: { findMany: vi.fn() },
    partenariat: { findMany: vi.fn() },
    sousTraitant: { findMany: vi.fn() },
    incident: { findMany: vi.fn() },
    appreciation: { findMany: vi.fn() },
    moyenPedagogique: { findMany: vi.fn() },
    trainerDevelopmentAction: { findMany: vi.fn() },
  },
}));

vi.mock("@/server/qualiopi/documents/organisme", () => ({
  getOrganismeIdentite: vi.fn().mockResolvedValue({
    raisonSociale: "Axion-IA SAS (test)",
    nda: "84691234567",
    qualiopi: "FR-2026-0001",
    siret: "12345678900001",
    adresseSiege: "11 Avenue Paul Verlaine, 38100 Grenoble",
    adresseExercice: "11 Avenue Paul Verlaine, 38100 Grenoble",
    email: "formation@axion-ia.fr",
    telephone: "+33 4 00 00 00 00",
    site: "https://axion-ia.com",
  }),
}));

import { prisma } from "@/lib/prisma";
import { construireRegistre, renderRegistrePdfBuffer, REGISTRE_TYPES } from "./registres-pdf";

const mockPrisma = prisma as unknown as {
  reclamation: { findMany: ReturnType<typeof vi.fn> };
  veille: { findMany: ReturnType<typeof vi.fn> };
  revueDirection: { findMany: ReturnType<typeof vi.fn> };
  partenariat: { findMany: ReturnType<typeof vi.fn> };
  sousTraitant: { findMany: ReturnType<typeof vi.fn> };
  incident: { findMany: ReturnType<typeof vi.fn> };
  appreciation: { findMany: ReturnType<typeof vi.fn> };
  moyenPedagogique: { findMany: ReturnType<typeof vi.fn> };
  trainerDevelopmentAction: { findMany: ReturnType<typeof vi.fn> };
};

beforeAll(() => {
  registerPdfTestFontsFallback();
});

function setupEmpty() {
  vi.clearAllMocks();
  mockPrisma.reclamation.findMany.mockResolvedValue([]);
  mockPrisma.veille.findMany.mockResolvedValue([]);
  mockPrisma.revueDirection.findMany.mockResolvedValue([]);
  mockPrisma.partenariat.findMany.mockResolvedValue([]);
  mockPrisma.sousTraitant.findMany.mockResolvedValue([]);
  mockPrisma.incident.findMany.mockResolvedValue([]);
  mockPrisma.appreciation.findMany.mockResolvedValue([]);
  mockPrisma.moyenPedagogique.findMany.mockResolvedValue([]);
  mockPrisma.trainerDevelopmentAction.findMany.mockResolvedValue([]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("renderRegistrePdfBuffer", () => {
  beforeEach(setupEmpty);

  it("expose les 9 types de registres attendus", () => {
    expect([...REGISTRE_TYPES]).toEqual([
      "reclamations",
      "veille",
      "revue_direction",
      "partenariats",
      "sous_traitants",
      "incidents",
      "appreciations",
      "moyens",
      "developpement_competences",
    ]);
  });

  it("veille : sélectionne les données réelles et rend un PDF %PDF", async () => {
    mockPrisma.veille.findMany.mockResolvedValue([
      {
        dateVeille: new Date("2026-06-01T00:00:00.000Z"),
        type: "legale",
        titre: "Nouveau décret formation",
        source: "Legifrance",
        impact: "Mise à jour du règlement intérieur",
        actionDecidee: "Réviser le modèle de convention",
      },
    ]);
    const result = await renderRegistrePdfBuffer("veille");
    expect(result.buffer.slice(0, 4).toString("utf8")).toBe("%PDF");
    expect(result.filename).toMatch(/^journal-veille-\d{4}-\d{2}-\d{2}\.pdf$/);
    expect(mockPrisma.veille.findMany).toHaveBeenCalledTimes(1);
  }, 30_000);

  it("reclamations : rend un PDF avec filename registre-reclamations-*", async () => {
    mockPrisma.reclamation.findMany.mockResolvedValue([
      {
        numero: "AXI-REC-2026-001",
        dateReception: new Date("2026-05-02T00:00:00.000Z"),
        reclamantNom: "Jean Dupont",
        objet: "Support illisible",
        statut: "resolue",
        dateReponse: new Date("2026-05-05T00:00:00.000Z"),
        actionsCorrectives: "Réédition du support",
      },
    ]);
    const result = await renderRegistrePdfBuffer("reclamations");
    expect(result.buffer.slice(0, 4).toString("utf8")).toBe("%PDF");
    expect(result.filename).toMatch(/^registre-reclamations-/);
  }, 30_000);

  it("revue_direction : résume participants/décisions/plan d'actions (Json)", async () => {
    mockPrisma.revueDirection.findMany.mockResolvedValue([
      {
        annee: 2026,
        dateRevue: new Date("2026-01-15T00:00:00.000Z"),
        statut: "validee",
        participants: ["Williams Jullin"],
        decisions: [{ libelle: "Mettre à jour la veille" }],
        planActions: [],
      },
    ]);
    const result = await renderRegistrePdfBuffer("revue_direction");
    expect(result.buffer.slice(0, 4).toString("utf8")).toBe("%PDF");
    expect(result.filename).toMatch(/^revues-direction-plan-amelioration-/);
  }, 30_000);

  it("revue_direction : l'analyse des risques est exportée, risque par risque (ind. 32)", async () => {
    // 🔴 2026-10-02 — la matrice affichait « 10 risques analysés » et le PDF
    // remis à l'auditeur n'en montrait aucun.
    mockPrisma.revueDirection.findMany.mockResolvedValue([
      {
        annee: 2026,
        dateRevue: new Date("2026-08-03T00:00:00.000Z"),
        statut: "validee",
        participants: ["Williams Jullin"],
        decisions: [{ decision: "d" }],
        planActions: [],
        risques: [
          {
            intitule: "Dépendance à un formateur unique",
            maitrise: "Vivier de sous-traitants",
            gravite: 3,
            probabilite: 3,
            misAJourLe: "2026-10-15T08:30:00.000Z",
          },
          // Saisi le 30/09, avant la datation par risque : jamais daté du 03/08.
          { intitule: "Panne de la chaîne d'e-mails", maitrise: "Relance manuelle" },
        ],
      },
    ]);
    const registre = await construireRegistre("revue_direction");
    expect(registre.sousTitre).toContain(
      "analyse des risques sur la qualité des formations délivrées",
    );
    expect(registre.colonnes).toContain("Analyse des risques");
    expect(registre.lignes[0]).toContain(
      "2 risques analysés, dont 1 coté (gravité × probabilité), mis à jour le 15/10/2026 (1 risque non daté)",
    );
    const section = registre.sections?.[0];
    expect(section?.titre).toBe(
      "Analyse des risques sur la qualité des formations délivrées — revue 2026",
    );
    expect(section?.colonnes).toEqual([
      "Risque",
      "Cause",
      "Gravité",
      "Probabilité",
      "Criticité",
      "Mesure de maîtrise",
      "Responsable",
      "Échéance",
      "Mis à jour le",
    ]);
    expect(section?.lignes).toHaveLength(2);
    expect(section?.lignes[0]).toContain("9 (élevée)");
    expect(section?.lignes[0]).toContain("15/10/2026");
    expect(section?.lignes[1]).toContain("non coté");
    expect(section?.lignes[1]).toContain("non daté");
    expect(section?.lignes[1]).not.toContain("03/08/2026");
    // Et le PDF se rend, section comprise.
    const pdf = await renderRegistrePdfBuffer("revue_direction");
    expect(pdf.buffer.slice(0, 4).toString("utf8")).toBe("%PDF");
  }, 30_000);

  it("revue_direction : une revue sans risque le dit dans sa section", async () => {
    mockPrisma.revueDirection.findMany.mockResolvedValue([
      {
        annee: 2025,
        dateRevue: new Date("2025-12-15T00:00:00.000Z"),
        statut: "archivee",
        participants: [],
        decisions: [],
        planActions: [],
        risques: [],
      },
    ]);
    const registre = await construireRegistre("revue_direction");
    expect(registre.sections?.[0]?.texte).toBe("Aucun risque consigné dans cette revue.");
    expect(registre.sections?.[0]?.lignes).toEqual([]);
    expect(registre.lignes[0]).toContain("Aucune");
  });

  it("partenariats + sous_traitants : rendent un PDF même registre vide", async () => {
    const p = await renderRegistrePdfBuffer("partenariats");
    const s = await renderRegistrePdfBuffer("sous_traitants");
    expect(p.buffer.slice(0, 4).toString("utf8")).toBe("%PDF");
    expect(s.buffer.slice(0, 4).toString("utf8")).toBe("%PDF");
    expect(p.filename).toMatch(/^registre-partenariats-/);
    expect(s.filename).toMatch(/^registre-sous-traitants-/);
  }, 30_000);

  it("incidents : sélectionne les données réelles (session liée) et rend un PDF", async () => {
    mockPrisma.incident.findMany.mockResolvedValue([
      {
        dateIncident: new Date("2026-03-12T00:00:00.000Z"),
        type: "technique",
        gravite: "majeur",
        titre: "Coupure visio 40 min",
        statut: "resolu",
        actionCorrective: "Connexion 4G de secours pour les sessions distancielles",
        resoluAt: new Date("2026-03-13T00:00:00.000Z"),
        session: { numero: "AXI-SES-2026-004" },
      },
    ]);
    const result = await renderRegistrePdfBuffer("incidents");
    expect(result.buffer.slice(0, 4).toString("utf8")).toBe("%PDF");
    expect(result.filename).toMatch(/^registre-incidents-\d{4}-\d{2}-\d{2}\.pdf$/);
    expect(mockPrisma.incident.findMany).toHaveBeenCalledTimes(1);
  }, 30_000);

  it("lève en mode stub.invalid (aucun appel Prisma)", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      await expect(renderRegistrePdfBuffer("veille")).rejects.toThrow(/stub\.invalid/);
      expect(mockPrisma.veille.findMany).not.toHaveBeenCalled();
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Dossier d'audit du 2026-09-30 — registres manquants et dates UTC
// ─────────────────────────────────────────────────────────────────────────────

describe("🔴 constat du ZIP du 2026-09-30 — appréciations, moyens et date de Paris", () => {
  // Le conteneur de production tourne en UTC : sans ce réglage, un poste de
  // développement à Paris ferait passer le test sur le code fautif.
  const tzOrigine = process.env["TZ"];
  beforeEach(() => {
    setupEmpty();
    process.env["TZ"] = "UTC";
  });
  afterEach(() => {
    if (tzOrigine === undefined) delete process.env["TZ"];
    else process.env["TZ"] = tzOrigine;
  });

  it("appréciations (ind. 30) : une ligne par appréciation, qualité, auteur, note, date de PARIS", async () => {
    mockPrisma.appreciation.findMany.mockResolvedValue([
      {
        // 23 h 30 UTC le 29 = 01 h 30 à Paris le 30.
        dateAppreciation: new Date("2026-09-29T23:30:00.000Z"),
        source: "stagiaire",
        note: 4,
        commentaire: "Questionnaire de satisfaction à chaud — note 4/5.",
        trainee: { nom: "Martin", prenom: "Camille" },
        trainer: null,
      },
      {
        dateAppreciation: new Date("2026-09-10T10:00:00.000Z"),
        source: "formateur",
        note: null,
        commentaire: "Groupe homogène",
        trainee: null,
        trainer: { nom: "Durand", prenom: "Luc" },
      },
    ]);
    const registre = await construireRegistre("appreciations");
    expect(registre.titre).toMatch(/appréciations/i);
    expect(registre.sousTitre).toMatch(/30/);
    expect(registre.lignes).toEqual([
      [
        "30/09/2026",
        "Stagiaire",
        "Camille Martin",
        "4/5",
        "Questionnaire de satisfaction à chaud — note 4/5.",
      ],
      ["10/09/2026", "Formateur", "Luc Durand", "", "Groupe homogène"],
    ]);
    const result = await renderRegistrePdfBuffer("appreciations");
    expect(result.buffer.slice(0, 4).toString("utf8")).toBe("%PDF");
    expect(result.filename).toMatch(/^registre-appreciations-\d{4}-\d{2}-\d{2}\.pdf$/);
  }, 30_000);

  it("moyens (ind. 17 / 19) : inventaire avec statut et date de vérification", async () => {
    mockPrisma.moyenPedagogique.findMany.mockResolvedValue([
      {
        categorie: "plateforme",
        libelle: "Google Meet",
        localisation: "En ligne",
        actif: true,
        dateVerification: new Date("2026-09-29T22:15:00.000Z"),
      },
      {
        categorie: "materiel",
        libelle: "Vidéoprojecteur",
        localisation: "",
        actif: false,
        dateVerification: null,
      },
    ]);
    const registre = await construireRegistre("moyens");
    expect(registre.titre).toMatch(/moyens/i);
    expect(registre.lignes).toEqual([
      ["Plateformes et outils numériques", "Google Meet", "En ligne", "Actif", "30/09/2026"],
      ["Matériel pédagogique et technique", "Vidéoprojecteur", "", "Retiré", "Jamais vérifié"],
    ]);
    const result = await renderRegistrePdfBuffer("moyens");
    expect(result.buffer.slice(0, 4).toString("utf8")).toBe("%PDF");
    expect(result.filename).toMatch(/^inventaire-moyens-\d{4}-\d{2}-\d{2}\.pdf$/);
  }, 30_000);

  it("développement des compétences (ind. 22) : intervenants qui animent seulement, statut lisible", async () => {
    mockPrisma.trainerDevelopmentAction.findMany.mockResolvedValue([
      {
        dateAction: new Date("2026-09-15T08:00:00.000Z"),
        type: "formation_suivie",
        description: "Formation « IA générative et RGPD »",
        trainer: { nom: "Jullin", prenom: "Williams", statut: "dirigeant" },
      },
    ]);
    const registre = await construireRegistre("developpement_competences");
    // Le filtre « personnes qui animent » est posé dans la requête elle-même.
    expect(mockPrisma.trainerDevelopmentAction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { trainer: { estFormateur: true } } }),
    );
    expect(registre.titre).toMatch(/développement des compétences/i);
    expect(registre.lignes).toEqual([
      [
        "15/09/2026",
        "Williams Jullin",
        "Dirigeant-formateur",
        "Formation suivie",
        "Formation « IA générative et RGPD »",
      ],
    ]);
    const result = await renderRegistrePdfBuffer("developpement_competences");
    expect(result.buffer.slice(0, 4).toString("utf8")).toBe("%PDF");
    expect(result.filename).toMatch(/^registre-developpement-competences-\d{4}-\d{2}-\d{2}\.pdf$/);
  }, 30_000);

  it("le nom de fichier porte le jour de PARIS, pas celui d'UTC (00 h 53 à Paris le 30/09)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-29T22:53:00.000Z"));
    try {
      const result = await renderRegistrePdfBuffer("veille");
      expect(result.filename).toBe("journal-veille-2026-09-30.pdf");
    } finally {
      vi.useRealTimers();
    }
  }, 30_000);

  it("les dates des lignes sont lues à Paris", async () => {
    mockPrisma.veille.findMany.mockResolvedValue([
      {
        dateVeille: new Date("2026-09-29T22:30:00.000Z"),
        type: "legale",
        titre: "Décret",
        source: "Legifrance",
        impact: "",
        actionDecidee: "",
      },
    ]);
    const registre = await construireRegistre("veille");
    expect(registre.lignes[0]![0]).toBe("30/09/2026");
  });
});
