import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  client: { findUnique: vi.fn(async () => null) },
  $transaction: vi.fn(async () => {
    throw new Error("arrêt-du-test");
  }),
}));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "admin-1", role: "super_admin" }),
  requireHabilitation: vi.fn().mockResolvedValue({ userId: "admin-1", role: "super_admin" }),
  logQualiopiActivity: vi.fn(),
}));
vi.mock("@/server/actions/qualiopi/documents", () => ({ genererConventionAction: vi.fn() }));
vi.mock("@/server/qualiopi/devis/interrupteur-formules", () => ({
  formulesActives: vi.fn(async () => true),
}));
vi.mock("@/server/qualiopi/numbering/allocate", () => ({ nextNumero: vi.fn(async () => "N-1") }));
vi.mock("@/server/qualiopi/numbering/retry", () => ({
  withNumberRetry: (f: () => unknown) => f(),
}));
vi.mock("@/server/qualiopi/config/site-settings", () => ({
  getQualiopiConfig: vi.fn(async () => "assujetti"),
}));

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { creerDevisFormulesAction } from "@/server/actions/qualiopi/devis-formules";
import { createDevisAction } from "@/server/actions/qualiopi/devis";
import { sha256Offre } from "@/server/qualiopi/devis/offre-calculs";
import { offreDevisV1, type OffreDevisV1 } from "@/server/qualiopi/devis/offre-devis";
import { offreFictive } from "@/server/qualiopi/devis/offre-fixtures.spec-util";
import { payloadVide, type PayloadAssistantV1 } from "../payload";
import {
  devisVersPayload,
  payloadVersCreation,
  type ContexteConversion,
  type DevisPourAssistant,
} from "../conversion";

const CLIENT = "11111111-1111-4111-8111-111111111111";
const PROJET = "22222222-2222-4222-8222-222222222222";
const CTX: ContexteConversion = {
  formulesActives: true,
  typeClient: "entreprise",
  maintenant: new Date("2026-11-08T10:00:00Z"),
  tauxStandard: 20,
};

function base(): PayloadAssistantV1 {
  const p = payloadVide(20);
  p.clientId = CLIENT;
  p.activite = "implementation";
  p.lignesClassiques = [
    { designation: "Assistant de réponse", quantite: "1", prixEur: "2 400" },
    { designation: "Relance des factures", quantite: "1", prixEur: "1800,00" },
    { designation: "Formation", quantite: "2,3", prixEur: "123,45", offreCode: "AXI-OFF-001" },
  ];
  return p;
}
function formules(m: "A" | "B" | "AB"): PayloadAssistantV1 {
  const p = base();
  p.typeDevis = "formules";
  p.formules.formules = { achat: m !== "B", abonnement: m !== "A" };
  p.formules.achat.maintenance.mensuelEur = "190,00";
  p.formules.abonnement.mensuelCatalogueEur = "199,99";
  p.formules.abonnement.periodes = [
    { mois: 1, remisePct: "0" },
    { mois: 12, remisePct: "5" },
  ];
  p.formules.abonnement.engagementMois = 12;
  p.formules.abonnement.indemniteTauxPct = "50";
  p.formules.abonnement.lignes = [
    { libelle: "Mise en service et adaptation", quantite: "1", prixEur: "1 900", tauxTvaPct: "20" },
  ];
  return p;
}
const creation = (p: PayloadAssistantV1, ctx = CTX) => {
  const r = payloadVersCreation(p, ctx);
  if ("erreurs" in r) throw new Error(JSON.stringify(r.erreurs));
  return r;
};

beforeEach(() => vi.clearAllMocks());

describe("classique", () => {
  it("entrée sans taux de TVA, montants en centimes, acceptée par le VRAI createDevisAction", async () => {
    const p = base();
    p.typeDevis = "classique";
    p.refClient = " BC-12 ";
    const r = creation(p);
    if (r.type !== "classique") throw new Error("type");
    expect(r.input.lignes.map((l) => l.prixUnitaireHtCents)).toEqual([240000, 180000, 12345]);
    expect(r.input.lignes[2]).toMatchObject({ quantite: 2.3, offreCode: "AXI-OFF-001" });
    expect(r.input.refClient).toBe("BC-12");
    for (const l of r.input.lignes) expect(l).not.toHaveProperty("tauxTvaPercent");
    const res = await createDevisAction(r.input as never).catch(() => ({ error: "arrêt" }));
    expect((res as { error?: string }).error).not.toBe("Données invalides");
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });

  it("OPCO : valeurs relues en nombres, enveloppe en centimes ; illisible refusé", () => {
    const p = base();
    p.typeDevis = "classique";
    p.opco = {
      financementSuggere: "opco",
      nbParticipants: "3",
      dureeHeures: "7,5",
      modaliteOpco: "intra",
      enveloppeRestanteEur: "1 190,50",
    };
    const r = creation(p);
    if (r.type !== "classique") throw new Error("type");
    expect(r.input).toMatchObject({
      nbParticipants: 3,
      dureeHeures: 7.5,
      opcoEnveloppeRestanteCents: 119050,
    });
    p.opco.nbParticipants = "trois";
    expect(payloadVersCreation(p, CTX)).toHaveProperty("erreurs");
  });

  it("projetId omis si le client n'est pas celui du projet, transmis sinon", () => {
    const p = base();
    p.typeDevis = "classique";
    p.projetId = PROJET;
    const sans = creation(p, { ...CTX, clientIdDuProjet: "autre" });
    const sansLecture = creation(p);
    const avec = creation(p, { ...CTX, clientIdDuProjet: CLIENT });
    expect(sans.input).not.toHaveProperty("projetId");
    expect(sansLecture.input).not.toHaveProperty("projetId");
    expect(avec.input).toHaveProperty("projetId", PROJET);
  });

  it("payload invalide : erreurs de validation, aucune entrée", () => {
    const p = base();
    p.typeDevis = "classique";
    p.clientId = null;
    expect(payloadVersCreation(p, CTX)).toHaveProperty("erreurs");
  });
});

describe("formules (D1)", () => {
  it.each(["A", "B", "AB"] as const)(
    "cas %s : offre acceptée par offreDevisV1 et par le VRAI creerDevisFormulesAction",
    async (m) => {
      const r = creation(formules(m));
      if (r.type !== "formules") throw new Error("type");
      expect(offreDevisV1.safeParse(r.input.offre).success).toBe(true);
      expect(r.input.offre.automatisations).toEqual([]);
      mockPrisma.client.findUnique.mockResolvedValueOnce({ type: "entreprise" } as never);
      const res = await creerDevisFormulesAction(r.input as never).catch(() => ({
        error: "arrêt",
      }));
      expect((res as { error?: string }).error).not.toBe("Données invalides");
      expect((res as { error?: string }).error).not.toMatch(/^Offre invalide/);
    },
  );

  it("A seule : lignes de l'étape 1 → achat.lignes (2,3 × 123,45 = 28 393 via le moteur)", () => {
    const r = creation(formules("A"));
    if (r.type !== "formules") throw new Error("type");
    expect(r.input.offre.achat!.lignes.map((l) => l.prixHtCents)).toEqual([240000, 180000, 12345]);
    expect(r.input.offre.achat!.lignes.every((l) => l.tauxTvaBps === 2000)).toBe(true);
    expect(r.input.offre.abonnement).toBeUndefined();
  });

  it("B seule : lignes de l'étape 1 → miseEnServiceLignes", () => {
    const r = creation(formules("B"));
    if (r.type !== "formules") throw new Error("type");
    expect(r.input.offre.abonnement!.miseEnServiceLignes).toHaveLength(3);
    expect(r.input.offre.achat).toBeUndefined();
  });

  it("A + B : mise en service B = UNE ligne saisie (1 900 → 190 000), aucune ligne de l'étape 1 dans B", () => {
    const r = creation(formules("AB"));
    if (r.type !== "formules") throw new Error("type");
    expect(r.input.offre.abonnement!.miseEnServiceLignes).toEqual([
      {
        libelle: "Mise en service et adaptation",
        quantite: 1,
        prixHtCents: 190000,
        tauxTvaBps: 2000,
      },
    ]);
    expect(r.input.offre.achat!.lignes).toHaveLength(3);
  });

  it("A + B, champ vide : aucune ligne (jamais une ligne à 0 €)", () => {
    const p = formules("AB");
    p.formules.abonnement.lignes[0]!.prixEur = "";
    const r = creation(p);
    if (r.type !== "formules") throw new Error("type");
    expect(r.input.offre.abonnement!.miseEnServiceLignes).toEqual([]);
  });

  it("bascule T5 : B seule garde la saisie 1 900 dans le brouillon, retour A + B la réactive", () => {
    const p = formules("AB");
    p.formules.formules = { achat: false, abonnement: true };
    const b = creation(p);
    if (b.type !== "formules") throw new Error("type");
    expect(b.input.offre.abonnement!.miseEnServiceLignes).toHaveLength(3);
    expect(p.formules.abonnement.lignes[0]!.prixEur).toBe("1 900");
    p.formules.formules = { achat: true, abonnement: true };
    const ab = creation(p);
    if (ab.type !== "formules") throw new Error("type");
    expect(ab.input.offre.abonnement!.miseEnServiceLignes[0]!.prixHtCents).toBe(190000);
  });

  it("taux = taux standard reçu, jamais saisi ; modeAvance non écrite par l'assistant", () => {
    const p = formules("AB");
    p.formules.abonnement.lignes[0]!.tauxTvaPct = "5.5";
    p.formules.achat.lignes[0]!.tauxTvaPct = "0";
    const r = creation(p);
    if (r.type !== "formules") throw new Error("type");
    expect(r.input.offre.achat!.lignes.every((l) => l.tauxTvaBps === 2000)).toBe(true);
    expect(r.input.offre.abonnement!.tauxTvaBps).toBe(2000);
    expect(r.input.offre.abonnement!.miseEnServiceLignes[0]!.tauxTvaBps).toBe(2000);
    // défaut du schéma
    expect(r.input.offre.abonnement!.modeAvance).toBe("premiere_periode_seulement");
  });

  it("textes D1 : récit injecté comme textes actifs, sans doublon, seulement pour les formules", () => {
    const p = formules("A");
    p.recit = {
      intitule: "Assistant client",
      besoinClient: "Répondre vite",
      resultatVise: " ",
      valeurClient: "12 000 €",
    };
    p.nonImprime = { phraseGarantie: "Garantie 30 jours" };
    p.textes = [{ texte: "Répondre vite", actif: true }];
    const r = creation(p);
    if (r.type !== "formules") throw new Error("type");
    expect(r.input.offre.textes.map((t) => t.texte)).toEqual([
      "Répondre vite",
      "Assistant client",
      "Garantie 30 jours",
    ]);
    expect(r.input.offre.textes.every((t) => t.actif)).toBe(true);
    // jamais la valeur chiffrée
    expect(JSON.stringify(r.input.offre.textes)).not.toContain("12 000");
    const c = base();
    c.typeDevis = "classique";
    c.recit = p.recit;
    expect(JSON.stringify(creation(c))).not.toContain("Assistant client");
  });
});

function devisDepuis(offre: OffreDevisV1): DevisPourAssistant {
  return {
    id: "dev-1",
    clientId: CLIENT,
    refClient: null,
    activite: "implementation",
    dateValidite: new Date("2026-12-01T00:00:00Z"),
    updatedAt: new Date("2026-11-08T09:00:00Z"),
    offre,
    lignes: [],
  };
}
/** Offre conforme à l'assistant (taux standard partout, une ligne de mise en service). */
function offreStandard(): OffreDevisV1 {
  const o = offreFictive();
  o.achat!.lignes = o.achat!.lignes.map((l) => ({ ...l, tauxTvaBps: 2000 }));
  return o;
}

describe("devisVersPayload → payloadVersCreation (non-régression sha256Offre)", () => {
  it("offre héritée AVEC automatisations (A + B) : même sha256Offre, automatisations intactes", () => {
    const o = offreStandard();
    expect(o.automatisations).toHaveLength(1);
    const p = devisVersPayload(devisDepuis(o), 20);
    expect(p.sync).toEqual({ devisId: "dev-1", devisMajLe: "2026-11-08T09:00:00.000Z" });
    const r = creation(p, { ...CTX, automatisationsHeritees: o.automatisations });
    if (r.type !== "formules") throw new Error("type");
    expect(r.input.offre.automatisations).toEqual(o.automatisations);
    expect(sha256Offre(r.input.offre)).toBe(sha256Offre(o));
  });

  it("sans l'héritage déclaré, ces automatisations sont refusées (aucune automatisation neuve)", () => {
    const p = devisVersPayload(devisDepuis(offreStandard()), 20);
    expect(payloadVersCreation(p, CTX)).toHaveProperty("erreurs");
  });

  it("A seule et B seule : même sha256Offre", () => {
    const a = offreStandard();
    delete a.abonnement;
    a.formulesProposees = ["achat"];
    const b = offreStandard();
    delete b.achat;
    b.formulesProposees = ["abonnement"];
    for (const o of [a, b]) {
      const r = creation(devisVersPayload(devisDepuis(o), 20), {
        ...CTX,
        automatisationsHeritees: o.automatisations,
      });
      if (r.type !== "formules") throw new Error("type");
      expect(sha256Offre(r.input.offre)).toBe(sha256Offre(o));
    }
  });

  it("devis classique : lignes relues, offreCode / offreTierId recopiés tels quels", () => {
    const d: DevisPourAssistant = {
      ...devisDepuis(offreFictive()),
      offre: null,
      lignes: [
        {
          designation: "Formation",
          quantite: 2.5,
          prixUnitaireHtCents: 123405,
          offreTierId: "AXI-OFF-009",
        },
        { designation: "Audit", quantite: 1, prixUnitaireHtCents: 50000 },
      ],
    };
    const p = devisVersPayload(d, 20);
    expect(p.typeDevis).toBe("classique");
    expect(p.lignesClassiques).toEqual([
      { designation: "Formation", quantite: "2.5", prixEur: "1234.05", offreTierId: "AXI-OFF-009" },
      { designation: "Audit", quantite: "1", prixEur: "500" },
    ]);
    const r = creation(p);
    if (r.type !== "classique") throw new Error("type");
    expect(r.input.lignes[0]).toMatchObject({
      prixUnitaireHtCents: 123405,
      offreTierId: "AXI-OFF-009",
    });
    expect(r.input.lignes[1]!.prixUnitaireHtCents).toBe(50000);
  });
});

describe("pureté", () => {
  it("aucun import prisma ni module Node dans conversion.ts", () => {
    const src = readFileSync(resolve(__dirname, "../conversion.ts"), "utf8");
    expect(src).not.toMatch(/@\/lib\/prisma|node:|offre-calculs/);
  });
});
