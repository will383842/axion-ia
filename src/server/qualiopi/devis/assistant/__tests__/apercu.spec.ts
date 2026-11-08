import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  client: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  devis: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
  },
  $transaction: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn(async () => ({ userId: "adm-1" })),
}));
vi.mock("@/server/qualiopi/devis/interrupteur-formules", () => ({
  formulesActives: vi.fn(async () => true),
}));
const config = vi.hoisted(() => vi.fn());
vi.mock("@/server/qualiopi/config/site-settings", () => ({ getQualiopiConfig: config }));

import { apercuAssistantAction } from "@/server/actions/qualiopi/devis-assistant-apercu";
import {
  donneesPdfDevis,
  type ContextePdfDevis,
  type DevisPourPdf,
} from "@/server/qualiopi/documents/donnees-pdf-devis";
import { computeTotauxFacture } from "@/server/qualiopi/legal/tva";
import { payloadVersCreation } from "../conversion";
import { calculerApercu, type ContexteApercu } from "../apercu";
import { payloadVide, type PayloadAssistantV1 } from "../payload";

const CTX: ContexteApercu = {
  regime: "assujetti",
  tauxStandard: 20,
  formulesActives: true,
  typeClient: "entreprise",
  maintenant: new Date("2026-11-08T10:00:00Z"),
};

function base(): PayloadAssistantV1 {
  const p = payloadVide(20);
  p.clientId = "c1";
  p.activite = "implementation";
  p.lignesClassiques = [
    { designation: "Assistant de réponse", quantite: "1", prixEur: "2 400" },
    { designation: "Relance des factures", quantite: "1", prixEur: "1800,00" },
    { designation: "Formation", quantite: "2,3", prixEur: "123,45" },
  ];
  return p;
}
function formules(m: "A" | "B" | "AB"): PayloadAssistantV1 {
  const p = base();
  p.typeDevis = "formules";
  p.formules.formules = { achat: m !== "B", abonnement: m !== "A" };
  p.formules.achat.maintenance.mensuelEur = "190,00";
  p.formules.achat.phases = [
    { libelle: "Signature", pourcentage: "30", declencheur: "signature" },
    { libelle: "Avancement", pourcentage: "30", declencheur: "avancement" },
    { libelle: "Livraison", pourcentage: "40", declencheur: "livraison" },
  ];
  p.formules.abonnement.mensuelCatalogueEur = "199,99";
  p.formules.abonnement.periodes = [
    { mois: 1, remisePct: "0" },
    { mois: 12, remisePct: "5" },
  ];
  p.formules.abonnement.engagementMois = 12;
  p.formules.abonnement.indemniteTauxPct = "50";
  p.formules.abonnement.phases = [
    { libelle: "Signature", pourcentage: "50", declencheur: "signature" },
    { libelle: "Livraison", pourcentage: "50", declencheur: "livraison" },
  ];
  p.formules.abonnement.lignes = [
    { libelle: "Mise en service et adaptation", quantite: "1", prixEur: "1 900", tauxTvaPct: "20" },
  ];
  return p;
}

describe("égalité avec le PDF (donneesPdfDevis)", () => {
  it.each(["A", "B", "AB"] as const)("formules %s : vue === donneesPdfDevis(...).formules", (m) => {
    const p = formules(m);
    const ap = calculerApercu(p, CTX);
    expect(ap.erreurs).toEqual([]);
    const r = payloadVersCreation(p, {
      formulesActives: true,
      typeClient: "entreprise",
      maintenant: CTX.maintenant!,
      tauxStandard: 20,
    });
    if (!("type" in r) || r.type !== "formules") throw new Error("type");
    const devis = {
      numero: "AXI-DEV-1",
      lignes: [],
      activite: "implementation",
      refClient: null,
      financementSuggere: null,
      montantOpcoEstimeCents: null,
      resteAChargeCents: null,
      dateValidite: new Date("2026-12-01"),
      offre: r.input.offre,
      client: {
        type: "entreprise",
        raisonSociale: "X",
        siret: null,
        adresse: null,
        adresseRue: null,
        adresseCodePostal: null,
        adresseVille: null,
        contactEmail: null,
      },
    } as unknown as DevisPourPdf;
    const contexte = {
      identite: {} as never,
      regimeTva: "assujetti",
      tauxStandard: 20,
      certificationObtenue: false,
      formulesActives: true,
    } as ContextePdfDevis;
    const pdf = donneesPdfDevis(devis, contexte, new Date("2026-11-08"));
    expect(ap.formules).toStrictEqual(pdf.formules);
    expect(ap.formules).toBeDefined();
  });

  it("T1 : versements 30/30/40 de A = 134 517 / 134 517 / 179 359 (HT 448 393)", () => {
    const ap = calculerApercu(formules("A"), CTX);
    const json = JSON.stringify(ap.formules);
    for (const c of ["134517", "179359"]) expect(json).toContain(c);
  });

  it("A + B : alerte « total dépend du choix »", () => {
    expect(calculerApercu(formules("AB"), CTX).alertes.join(" ")).toMatch(/choix du client/);
  });
});

describe("classique", () => {
  it("totaux = computeTotauxFacture (T1 : HT 448 393, TVA 89 679, TTC 538 072 ; ligne 3 = 28 393)", () => {
    const p = base();
    p.typeDevis = "classique";
    const ap = calculerApercu(p, CTX);
    expect(ap.classique!.totaux).toEqual(
      computeTotauxFacture(
        [
          { quantite: 1, prixUnitaireHtCents: 240000 },
          { quantite: 1, prixUnitaireHtCents: 180000 },
          { quantite: 2.3, prixUnitaireHtCents: 12345 },
        ],
        "assujetti",
        20,
      ),
    );
    expect(ap.classique!.totaux).toMatchObject({
      totalHtCents: 448393,
      totalTvaCents: 89679,
      totalTtcCents: 538072,
    });
    expect(ap.classique!.lignes.map((l) => l.totalHtCents)).toEqual([240000, 180000, 28393]);
  });

  it("T4 : TVA par groupe de taux (31 402 → 6 280 / 37 682)", () => {
    const p = base();
    p.typeDevis = "classique";
    p.lignesClassiques = [
      ...[1, 2, 3].map((i) => ({ designation: `L${i}`, quantite: "1", prixEur: "10,03" })),
      { designation: "F", quantite: "2,3", prixEur: "123,45" },
    ];
    expect(calculerApercu(p, CTX).classique!.totaux).toMatchObject({
      totalHtCents: 31402,
      totalTvaCents: 6280,
      totalTtcCents: 37682,
    });
  });

  it("régime non assujetti traité comme le moteur : mention et TVA du moteur", () => {
    const p = base();
    p.typeDevis = "classique";
    const ap = calculerApercu(p, { ...CTX, regime: "franchise_293b" });
    expect(ap.regimeTva).toBe("franchise_293b");
    expect(ap.mentionTva).not.toBeNull();
    expect(ap.classique!.totaux.totalTvaCents).toBe(
      computeTotauxFacture([{ quantite: 1, prixUnitaireHtCents: 448393 }], "franchise_293b", 20)
        .totalTvaCents,
    );
  });
});

describe("offre invalide", () => {
  it("erreurs renseignées, aucun chiffre", () => {
    const p = formules("A");
    p.formules.achat.phases = [{ libelle: "Solde", pourcentage: "60", declencheur: "signature" }];
    const ap = calculerApercu(p, CTX);
    expect(ap.erreurs.length).toBeGreaterThan(0);
    expect(ap.formules).toBeUndefined();
    expect(ap.classique).toBeUndefined();
    expect(ap.alertes.join(" ")).toMatch(/100/);
  });
  it("total 0 € : erreur et alerte, aucun chiffre", () => {
    const p = base();
    p.typeDevis = "classique";
    p.lignesClassiques = [{ designation: "x", quantite: "1", prixEur: "0" }];
    const ap = calculerApercu(p, CTX);
    expect(ap.classique).toBeUndefined();
    expect(ap.alertes.join(" ")).toMatch(/0 €/);
  });
});

describe("apercuAssistantAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    config.mockImplementation(async (k: string) => (k === "regime_tva" ? "assujetti" : 20));
    prismaMock.client.findUnique.mockResolvedValue({ type: "entreprise" });
    prismaMock.devis.findUnique.mockResolvedValue(null);
  });
  it("lecture seule : aucune écriture prisma", async () => {
    const r = await apercuAssistantAction(JSON.parse(JSON.stringify(formules("A"))));
    expect("data" in r && r.data.erreurs).toEqual([]);
    for (const t of [prismaMock.client, prismaMock.devis])
      for (const m of ["create", "update", "updateMany", "delete"] as const)
        if (m in t)
          expect((t as Record<string, { mock: { calls: unknown[] } }>)[m]!.mock.calls).toHaveLength(
            0,
          );
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
  it("charge illisible : erreur", async () => {
    expect(await apercuAssistantAction({ v: 2 })).toHaveProperty("error");
  });
  it("client particulier : formules refusées dans les erreurs", async () => {
    prismaMock.client.findUnique.mockResolvedValue({ type: "particulier" });
    const r = await apercuAssistantAction(JSON.parse(JSON.stringify(formules("A"))));
    expect("data" in r && r.data.erreurs.some((e) => /particulier/.test(e.message))).toBe(true);
  });
  it("automatisation du devis rouvert acceptée, neuve refusée", async () => {
    const auto = {
      code: "a",
      libelle: "A",
      facultative: true,
      dependDe: [],
      prixHtCents: 5000,
      tauxTvaBps: 2000,
      modeIA: "client_direct",
    };
    const p = formules("A");
    p.formules.automatisations = [auto as never];
    prismaMock.devis.findUnique.mockResolvedValue(null);
    const neuf = await apercuAssistantAction(JSON.parse(JSON.stringify(p)));
    expect("data" in neuf && neuf.data.erreurs.length).toBeGreaterThan(0);
    p.sync.devisId = "d1";
    prismaMock.devis.findUnique.mockResolvedValue({ offre: { automatisations: [auto] } });
    const heritee = await apercuAssistantAction(JSON.parse(JSON.stringify(p)));
    expect("data" in heritee && heritee.data.erreurs).toEqual([]);
  });
  it("pas de prisma dans apercu.ts (données pures)", () => {
    expect(readFileSync(resolve(__dirname, "../apercu.ts"), "utf8")).not.toMatch(/@\/lib\/prisma/);
  });
});
