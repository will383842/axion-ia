// @vitest-environment node
/**
 * Devis à formules (lot 5) : garde « formule retenue », acompte = palier de l'échéancier
 * (au centime), validation d'un plan proposé. Branché sur les vraies Server Actions.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  devisFind: vi.fn(),
  planFind: vi.fn(),
  planUpdateMany: vi.fn(),
  genererFactureLibre: vi.fn(),
  actif: vi.fn(),
  log: vi.fn(),
  adminWrite: vi.fn(),
  habilitation: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    devis: { findUnique: (...a: unknown[]) => h.devisFind(...a) },
    documentSignature: { findMany: vi.fn().mockResolvedValue([]) },
    planRecurrent: {
      findUnique: (...a: unknown[]) => h.planFind(...a),
      updateMany: (...a: unknown[]) => h.planUpdateMany(...a),
    },
  },
}));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: h.adminWrite,
  requireHabilitation: h.habilitation,
  logQualiopiActivity: h.log,
}));
vi.mock("@/server/qualiopi/devis/interrupteur-formules", () => ({ formulesActives: h.actif }));
vi.mock("@/server/qualiopi/financements/facture-libre", () => ({
  genererFactureLibre: (...a: unknown[]) => h.genererFactureLibre(...a),
  genererAvoirFacture: vi.fn(),
  enregistrerPaiementFacture: vi.fn(),
}));
vi.mock("@/server/qualiopi/financements/dossier-financement", () => ({
  transitionnerDossier: vi.fn(),
  creerDossierDepuisSession: vi.fn(),
}));

import { offreFictive } from "@/server/qualiopi/devis/offre-fixtures.spec-util";
import { changerStatutPlanAction, genererFactureDepuisDevisAction } from "./facturation-hub";

const DEVIS_ID = "33333333-3333-4333-8333-333333333333";
const PLAN_ID = "55555555-5555-4555-8555-555555555555";

/** Offre achat mono-taux, échéancier 30/30/40, total 100 005 → paliers 30001 / 30001 / 40003. */
function offre() {
  const o = offreFictive();
  return {
    ...o,
    formulesProposees: ["achat" as const],
    automatisations: [],
    abonnement: undefined,
    achat: {
      ...o.achat!,
      lignes: [{ libelle: "L", quantite: 1, prixHtCents: 100005, tauxTvaBps: 2000 }],
      phases: [30, 30, 40].map((p, i) => ({
        rang: i + 1,
        libelle: `Palier ${i + 1}`,
        pourcentage: p,
        declencheur: "signature" as const,
      })),
    },
  };
}

function devis(surcharge: Record<string, unknown> = {}, nbFactures = 0) {
  return {
    id: DEVIS_ID,
    numero: "AXI-DEV-2030-001",
    statut: "accepte",
    activite: "implementation",
    refClient: null,
    clientId: "cli-1",
    lignes: [{ designation: "L", quantite: 1, prixUnitaireHtCents: 100005, tauxTvaPercent: 20 }],
    acceptedAt: new Date("2030-01-01T00:00:00Z"),
    client: { type: "entreprise" },
    offre: offre(),
    formuleRetenue: "achat",
    facturesFormation: Array.from({ length: nbFactures }, (_, i) => ({
      numero: `F${i}`,
      montantHtCents: 30001,
      montantTvaCents: 6000,
    })),
    ...surcharge,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.actif.mockResolvedValue(true);
  h.adminWrite.mockResolvedValue({ userId: "adm-1", role: "admin" });
  h.habilitation.mockResolvedValue({ userId: "adm-fact", role: "super_admin" });
  h.genererFactureLibre.mockResolvedValue({ factureId: "f", numero: "N", chorusProRequis: false });
});

describe("garde « formule retenue »", () => {
  it("offre non NULL et aucune formule retenue → refus, rien n'est facturé", async () => {
    h.devisFind.mockResolvedValue(devis({ formuleRetenue: null, lignes: [] }));
    const r = await genererFactureDepuisDevisAction({ devisId: DEVIS_ID });
    expect(r).toMatchObject({ error: expect.stringContaining("aucune formule retenue") });
    expect(h.genererFactureLibre).not.toHaveBeenCalled();
  });

  it("interrupteur éteint : la garde est inerte (comportement d'avant)", async () => {
    h.actif.mockResolvedValue(false);
    h.devisFind.mockResolvedValue(devis({ formuleRetenue: null }));
    const r = await genererFactureDepuisDevisAction({ devisId: DEVIS_ID });
    expect("data" in r).toBe(true);
    expect(h.genererFactureLibre).toHaveBeenCalledTimes(1);
  });

  it("devis classique (offre NULL) : jamais de lecture de l'interrupteur, facturation inchangée", async () => {
    h.devisFind.mockResolvedValue(devis({ offre: null, formuleRetenue: null }));
    const r = await genererFactureDepuisDevisAction({ devisId: DEVIS_ID, acomptePercent: 30 });
    expect("data" in r).toBe(true);
    expect(h.actif).not.toHaveBeenCalled();
    // Historique : round(100005 × 30 %) = 30002 (et non 30001)
    expect(h.genererFactureLibre.mock.calls[0]![0].lignes[0].prixUnitaireHtCents).toBe(30002);
  });
});

describe("acompte = palier de l'échéancier", () => {
  it("palier 1 : montant IMPRIMÉ par le devis (30001), pas l'arrondi historique (30002)", async () => {
    h.devisFind.mockResolvedValue(devis());
    const r = await genererFactureDepuisDevisAction({ devisId: DEVIS_ID, acomptePercent: 30 });
    expect("data" in r).toBe(true);
    expect(h.genererFactureLibre.mock.calls[0]![0].lignes[0]).toMatchObject({
      prixUnitaireHtCents: 30001,
      tauxTvaPercent: 20,
    });
  });

  it("% différent du palier suivant → refus", async () => {
    h.devisFind.mockResolvedValue(devis());
    const r = await genererFactureDepuisDevisAction({ devisId: DEVIS_ID, acomptePercent: 50 });
    expect(r).toMatchObject({ error: expect.stringContaining("palier suivant") });
    expect(h.genererFactureLibre).not.toHaveBeenCalled();
  });

  it("le palier suivant est le solde → l'acompte est refusé", async () => {
    h.devisFind.mockResolvedValue(devis({}, 2));
    const r = await genererFactureDepuisDevisAction({ devisId: DEVIS_ID, acomptePercent: 40 });
    expect(r).toMatchObject({ error: expect.stringContaining("est le solde") });
  });

  it("solde après deux acomptes : total − acomptes = palier 3 (40003), Σ = total", async () => {
    h.devisFind.mockResolvedValue(devis({}, 2));
    await genererFactureDepuisDevisAction({ devisId: DEVIS_ID });
    const lignes = h.genererFactureLibre.mock.calls[0]![0].lignes as Array<{
      prixUnitaireHtCents: number;
    }>;
    expect(lignes.reduce((s, l) => s + l.prixUnitaireHtCents * 1, 0)).toBe(40003);
  });

  it.each([0, 1])(
    "solde demandé alors que %i facture(s) émise(s) : paliers intermédiaires non sautés → refus",
    async (nb) => {
      h.devisFind.mockResolvedValue(devis({}, nb));
      const r = await genererFactureDepuisDevisAction({ devisId: DEVIS_ID });
      expect(r).toMatchObject({ error: expect.stringContaining("palier suivant") });
      expect(h.genererFactureLibre).not.toHaveBeenCalled();
    },
  );

  it("tous les paliers facturés → acompte refusé", async () => {
    h.devisFind.mockResolvedValue(devis({}, 3));
    const r = await genererFactureDepuisDevisAction({ devisId: DEVIS_ID, acomptePercent: 30 });
    expect("error" in r).toBe(true);
    expect(h.genererFactureLibre).not.toHaveBeenCalled();
  });
});

describe("validation d'un plan proposé par un devis", () => {
  it("passe actif : habilitation « facturer » exigée, valideAt + valideur posés une seule fois", async () => {
    h.planFind.mockResolvedValue({ devisId: DEVIS_ID, valideAt: null });
    h.planUpdateMany.mockResolvedValue({ count: 1 });
    const r = await changerStatutPlanAction({ planId: PLAN_ID, statut: "actif" });
    expect(r).toEqual({ data: { statut: "actif" } });
    expect(h.habilitation).toHaveBeenCalledWith("facturer");
    const data = h.planUpdateMany.mock.calls[0]![0].data;
    expect(data).toMatchObject({ statut: "actif", valideParAdminId: "adm-fact" });
    expect(data.valideAt).toBeInstanceOf(Date);
  });

  it("habilitation refusée → le plan reste en pause", async () => {
    h.planFind.mockResolvedValue({ devisId: DEVIS_ID, valideAt: null });
    h.habilitation.mockRejectedValue(new Error("forbidden"));
    await expect(changerStatutPlanAction({ planId: PLAN_ID, statut: "actif" })).rejects.toThrow(
      "forbidden",
    );
    expect(h.planUpdateMany).not.toHaveBeenCalled();
  });

  it("réactivation après une pause : la date de validation d'origine est conservée", async () => {
    h.planFind.mockResolvedValue({ devisId: DEVIS_ID, valideAt: new Date("2030-02-01") });
    h.planUpdateMany.mockResolvedValue({ count: 1 });
    await changerStatutPlanAction({ planId: PLAN_ID, statut: "actif" });
    expect(h.planUpdateMany.mock.calls[0]![0].data).toEqual({ statut: "actif" });
  });

  it("plan sans devis : comportement historique (requireAdminWrite, aucun champ de validation)", async () => {
    h.planFind.mockResolvedValue({ devisId: null, valideAt: null });
    h.planUpdateMany.mockResolvedValue({ count: 1 });
    await changerStatutPlanAction({ planId: PLAN_ID, statut: "actif" });
    expect(h.habilitation).not.toHaveBeenCalled();
    expect(h.planUpdateMany.mock.calls[0]![0].data).toEqual({ statut: "actif" });
  });

  it("mise en pause d'un plan de devis : pas de validation", async () => {
    h.planFind.mockResolvedValue({ devisId: DEVIS_ID, valideAt: null });
    h.planUpdateMany.mockResolvedValue({ count: 1 });
    await changerStatutPlanAction({ planId: PLAN_ID, statut: "pause" });
    expect(h.habilitation).not.toHaveBeenCalled();
    expect(h.planUpdateMany.mock.calls[0]![0].data).toEqual({ statut: "pause" });
  });
});
