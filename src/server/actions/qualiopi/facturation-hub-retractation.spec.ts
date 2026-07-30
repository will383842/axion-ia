/**
 * Art. L6353-5/L6353-6 — le délai de rétractation court depuis la SIGNATURE DU
 * CONTRAT, branchée bout en bout sur `genererFactureDepuisDevisAction`.
 *
 * ## Ce que ce fichier verrouille, et pourquoi il ne suffit pas de tester la
 * fonction pure
 *
 * Le défaut d'origine (corrigé une première fois avec le refus serveur) n'était
 * pas un mauvais calcul : le calcul était juste, personne ne l'appelait. Le
 * défaut corrigé ici est de la MÊME famille — la règle s'appliquait au bon
 * moment, mais sur le mauvais intrant : `Devis.acceptedAt`, l'acceptation d'un
 * devis, alors que l'article L6353-5 fait courir les dix jours à compter de la
 * conclusion du CONTRAT de formation (L6353-3). L'acceptation d'un devis n'a
 * aucune existence dans le code du travail.
 *
 * 🔴 Un test sur `dateEngagementParticulier` seule serait passé au vert pendant
 * que le hub continuait de lire `acceptedAt` : c'est exactement ce qui s'était
 * produit la première fois. Ces tests appellent donc la Server Action, et
 * vérifient QUELLE date le refus applique réellement.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDevisFindUnique = vi.fn();
const mockSignatureFindMany = vi.fn();
const mockGenererFactureLibre = vi.fn();
const mockLog = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    devis: { findUnique: (...a: unknown[]) => mockDevisFindUnique(...a) },
    documentSignature: { findMany: (...a: unknown[]) => mockSignatureFindMany(...a) },
  },
}));

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "admin-1", role: "super_admin" }),
  logQualiopiActivity: (...a: unknown[]) => mockLog(...a),
}));

// Émission réelle : hors sujet ici (react-pdf, R2, numérotation). Ce qui
// importe, c'est qu'elle soit APPELÉE ou NON — c'est la trace observable du
// refus. `planifierFacturationDevis` reste RÉEL : c'est un planificateur pur.
vi.mock("@/server/qualiopi/financements/facture-libre", () => ({
  genererFactureLibre: (...a: unknown[]) => mockGenererFactureLibre(...a),
  genererAvoirFacture: vi.fn(),
  enregistrerPaiementFacture: vi.fn(),
}));

vi.mock("@/server/qualiopi/financements/dossier-financement", () => ({
  transitionnerDossier: vi.fn(),
  creerDossierDepuisSession: vi.fn(),
}));

import { genererFactureDepuisDevisAction } from "./facturation-hub";

const DEVIS_ID = "33333333-3333-4333-8333-333333333333";
const CLIENT_ID = "44444444-4444-4444-8444-444444444444";
const JOUR_MS = 24 * 60 * 60 * 1000;

/** Maintenant, figé : sans horloge stable, « il y a 11 jours » n'est pas testable. */
const MAINTENANT = new Date("2026-06-01T12:00:00.000Z");
const ilYA = (jours: number): Date => new Date(MAINTENANT.getTime() - jours * JOUR_MS);

function devisParticulier(acceptedAt: Date | null) {
  return {
    id: DEVIS_ID,
    numero: "AXI-DEV-2026-001",
    statut: "accepte",
    activite: "formation",
    refClient: null,
    clientId: CLIENT_ID,
    lignes: [{ designation: "Formation IA", quantite: 1, prixUnitaireHtCents: 200_000 }],
    acceptedAt,
    client: { type: "particulier" },
    facturesFormation: [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(MAINTENANT);
  mockSignatureFindMany.mockResolvedValue([]);
  mockGenererFactureLibre.mockResolvedValue({
    factureId: "fac-1",
    numero: "AXI-FAC-2026-001",
    chorusProRequis: false,
  });
  mockLog.mockResolvedValue(undefined);
});

describe("garde L6353-6 — la date retenue est celle du CONTRAT signé", () => {
  it("AUTORISE quand le contrat est signé depuis plus de dix jours", async () => {
    mockDevisFindUnique.mockResolvedValue(devisParticulier(ilYA(200)));
    mockSignatureFindMany.mockResolvedValue([{ signeAt: ilYA(11), revokedAt: null }]);

    const r = await genererFactureDepuisDevisAction({ devisId: DEVIS_ID });

    expect(r).toEqual({
      data: { factureId: "fac-1", numero: "AXI-FAC-2026-001", chorusProRequis: false },
    });
    expect(mockGenererFactureLibre).toHaveBeenCalledTimes(1);
  });

  it("🔴 REFUSE quand le contrat est signé depuis moins de dix jours, MÊME si le devis est accepté depuis des mois", async () => {
    // Le cas qui prouve que l'intrant a changé. Avant ce correctif, un devis
    // accepté 200 jours plus tôt passait : la facture partait alors que le
    // particulier était encore dans son délai de rétractation contractuel.
    // C'est un RESSERREMENT assumé du garde-fou, pas un assouplissement.
    mockDevisFindUnique.mockResolvedValue(devisParticulier(ilYA(200)));
    mockSignatureFindMany.mockResolvedValue([{ signeAt: ilYA(2), revokedAt: null }]);

    const r = await genererFactureDepuisDevisAction({ devisId: DEVIS_ID });

    expect("error" in r).toBe(true);
    if ("error" in r) {
      expect(r.error).toContain("L6353-6");
      // Le message doit NOMMER la source : un refus qu'on ne peut pas recouper
      // avec une pièce du dossier n'est pas auditable.
      expect(r.error).toContain("contrat de formation a été signé");
    }
    expect(mockGenererFactureLibre).not.toHaveBeenCalled();
  });

  it("🔴 retient la CONTRESIGNATURE : le contrat n'est conclu qu'à la dernière signature", async () => {
    // Bénéficiaire signé il y a 12 jours (délai écoulé), organisme il y a 3
    // (délai en cours). Retenir la signature du bénéficiaire aurait autorisé la
    // facture ; on retient la plus tardive, la plus protectrice.
    mockDevisFindUnique.mockResolvedValue(devisParticulier(null));
    mockSignatureFindMany.mockResolvedValue([
      { signeAt: ilYA(12), revokedAt: null },
      { signeAt: ilYA(3), revokedAt: null },
    ]);

    const r = await genererFactureDepuisDevisAction({ devisId: DEVIS_ID });

    expect("error" in r).toBe(true);
    expect(mockGenererFactureLibre).not.toHaveBeenCalled();
  });

  it("🔴 IGNORE une signature révoquée et applique la signature valable", async () => {
    // La révoquée date de 60 jours : la compter ferait expirer le délai
    // rétroactivement, alors que la seule preuve encore au dossier a 2 jours.
    mockDevisFindUnique.mockResolvedValue(devisParticulier(null));
    mockSignatureFindMany.mockResolvedValue([
      { signeAt: ilYA(60), revokedAt: ilYA(5) },
      { signeAt: ilYA(2), revokedAt: null },
    ]);

    const r = await genererFactureDepuisDevisAction({ devisId: DEVIS_ID });

    expect("error" in r).toBe(true);
    expect(mockGenererFactureLibre).not.toHaveBeenCalled();
  });

  it("REPLI sur l'acceptation du devis quand aucun contrat n'est signé", async () => {
    // Comportement INCHANGÉ pour tout l'historique antérieur au registre de
    // signatures : sans ce repli, le correctif bloquerait d'un coup toute la
    // facturation des particuliers.
    mockDevisFindUnique.mockResolvedValue(devisParticulier(ilYA(30)));
    mockSignatureFindMany.mockResolvedValue([]);

    const r = await genererFactureDepuisDevisAction({ devisId: DEVIS_ID });

    expect("data" in r).toBe(true);
    expect(mockGenererFactureLibre).toHaveBeenCalledTimes(1);
  });

  it("REPLI : refuse quand l'acceptation du devis date de moins de dix jours", async () => {
    mockDevisFindUnique.mockResolvedValue(devisParticulier(ilYA(4)));

    const r = await genererFactureDepuisDevisAction({ devisId: DEVIS_ID });

    expect("error" in r).toBe(true);
    if ("error" in r) expect(r.error).toContain("à titre de repli");
    expect(mockGenererFactureLibre).not.toHaveBeenCalled();
  });

  it("🔴 ni signature ni acceptation ⇒ REFUS, jamais un laissez-passer", async () => {
    // L'absence de donnée est précisément le cas où l'on ne peut rien prouver
    // devant un contrôle. Autoriser « faute de savoir » en ferait un passe-droit.
    mockDevisFindUnique.mockResolvedValue(devisParticulier(null));

    const r = await genererFactureDepuisDevisAction({ devisId: DEVIS_ID });

    expect("error" in r).toBe(true);
    if ("error" in r) expect(r.error).toContain("incalculable");
    expect(mockGenererFactureLibre).not.toHaveBeenCalled();
  });

  it("la recherche des signatures est BORNÉE au contrat de CE devis", async () => {
    // Remonter par `clientId` serait plus large donc plus permissif : un contrat
    // ancien du même client ferait expirer le délai d'un tout autre engagement.
    mockDevisFindUnique.mockResolvedValue(devisParticulier(ilYA(30)));

    await genererFactureDepuisDevisAction({ devisId: DEVIS_ID });

    expect(mockSignatureFindMany).toHaveBeenCalledWith({
      where: { documentGenere: { type: "contrat", session: { devisId: DEVIS_ID } } },
      select: { signeAt: true, revokedAt: true },
    });
  });

  it("une ENTREPRISE n'est pas concernée : aucun délai, aucune lecture de signatures", async () => {
    // L6353-3 à L6353-7 visent la personne physique qui finance elle-même sa
    // formation. Étendre le délai aux personnes morales bloquerait la
    // facturation B2B sans aucun fondement.
    mockDevisFindUnique.mockResolvedValue({
      ...devisParticulier(null),
      client: { type: "entreprise" },
    });

    const r = await genererFactureDepuisDevisAction({ devisId: DEVIS_ID });

    expect("data" in r).toBe(true);
    expect(mockSignatureFindMany).not.toHaveBeenCalled();
  });
});
