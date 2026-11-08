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
import { montantsDevis } from "@/server/qualiopi/devis/montants-devis";
import { computeTotauxFacture } from "@/server/qualiopi/legal/tva";
import { payloadVersCreation } from "../conversion";
import { calculerApercu, type ContexteApercu } from "../apercu";
import { payloadVide, type PayloadAssistantV1 } from "../payload";

const CLIENT = "11111111-1111-4111-8111-111111111111";
const DEVIS = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const CTX: ContexteApercu = {
  regime: "assujetti",
  tauxStandard: 20,
  formulesActives: true,
  typeClient: "entreprise",
  maintenant: new Date("2026-11-08T10:00:00Z"),
};

function base(): PayloadAssistantV1 {
  const p = payloadVide(20);
  p.clientId = CLIENT;
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

  it("régime franchise : vue === donneesPdfDevis avec le même régime", () => {
    const p = formules("AB");
    const ap = calculerApercu(p, { ...CTX, regime: "franchise_293b" });
    const r = payloadVersCreation(p, {
      formulesActives: true,
      typeClient: "entreprise",
      maintenant: CTX.maintenant!,
      tauxStandard: 20,
    });
    if (!("type" in r) || r.type !== "formules") throw new Error("type");
    const devis = {
      numero: "N",
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
      regimeTva: "franchise_293b",
      tauxStandard: 20,
      certificationObtenue: false,
      formulesActives: true,
    } as ContextePdfDevis;
    expect(ap.formules).toStrictEqual(
      donneesPdfDevis(devis, contexte, new Date("2026-11-08")).formules,
    );
    const assujetti = calculerApercu(p, CTX);
    expect(JSON.stringify(ap.formules)).not.toBe(JSON.stringify(assujetti.formules));
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

/** Cas chiffrés de l'architecte (DECISIONS-D1-D2 §4), lus dans l'aperçu serveur. */
describe("cas chiffrés de l'architecte (T1, T2, T3, T5)", () => {
  const versements = (ap: ReturnType<typeof calculerApercu>, i = 0) =>
    ap.formules!.formules[i]!.phases.map((x) => x.montantHtCents);
  const totaux = (ap: ReturnType<typeof calculerApercu>, i = 0) => {
    const f = ap.formules!.formules[i]!;
    return [f.totalHtCents, f.totalTvaCents, f.totalTtcCents];
  };
  const offreDe = (p: PayloadAssistantV1) => {
    const r = payloadVersCreation(p, {
      formulesActives: true,
      typeClient: "entreprise",
      maintenant: CTX.maintenant!,
      tauxStandard: 20,
    });
    if (!("type" in r) || r.type !== "formules") throw new Error("type");
    return r.input.offre;
  };
  const lignes1900 = (p: PayloadAssistantV1) => {
    p.lignesClassiques = [{ designation: "Mise en service", quantite: "1", prixEur: "1 900" }];
    return p;
  };

  it("T1 : A seule 30/30/40 → 134 517 / 134 517 / 179 359 ; HT 448 393, TVA 89 679, TTC 538 072", () => {
    const ap = calculerApercu(formules("A"), CTX);
    expect(versements(ap)).toEqual([134517, 134517, 179359]);
    expect(totaux(ap)).toEqual([448393, 89679, 538072]);
    expect(ap.formules!.formules[0]!.lignes[2]!.totalHtCents).toBe(28393);
  });

  it("T1 : variante 20/20/20/15/15/10 → 89 678 ×3, 67 258 ×2, 44 843 (le dernier absorbe le reste)", () => {
    const p = formules("A");
    p.formules.achat.phases = [20, 20, 20, 15, 15, 10].map((pct, i) => ({
      libelle: `Phase ${i + 1}`,
      pourcentage: String(pct),
      declencheur: i === 0 ? "signature" : i === 5 ? "livraison" : "avancement",
    }));
    const v = versements(calculerApercu(p, CTX));
    expect(v).toEqual([89678, 89678, 89678, 67258, 67258, 44843]);
    expect(v.reduce((a, b) => a + b, 0)).toBe(448393);
  });

  it("T2 : B seule (1 × 1 900 €, 50/50) → 190 000 / 38 000 / 228 000 ; versements 95 000 ×2", () => {
    const ap = calculerApercu(lignes1900(formules("B")), CTX);
    expect(ap.erreurs).toEqual([]);
    expect(totaux(ap)).toEqual([190000, 38000, 228000]);
    expect(versements(ap)).toEqual([95000, 95000]);
  });

  it("T2 : mensuel net à 12 mois 18 999 ; période de 12 mois 227 988 HT ; indemnité maximale 119 994 ; 1 mois = 19 999", () => {
    const ab = calculerApercu(lignes1900(formules("B")), CTX).formules!.formules[0]!.abonnement!;
    const p12 = ab.periodes.find((x) => x.mois === 12)!;
    expect(p12.mensuelNetHtCents).toBe(18999);
    expect(p12.prixPeriodeHtCents).toBe(227988);
    expect(ab.periodes.find((x) => x.mois === 1)!.prixPeriodeHtCents).toBe(19999);
    expect(ab.indemniteSortieMaxHtCents).toBe(119994);
  });

  it("T3 : A + B — avant le choix 0 ; choix A 448 393 / 89 679 / 538 072 ; choix B 190 000 / 38 000 / 228 000, sans ligne de L", () => {
    const p = formules("AB");
    const ap = calculerApercu(p, CTX);
    expect(ap.erreurs).toEqual([]);
    expect(totaux(ap, 0)).toEqual([448393, 89679, 538072]);
    expect(totaux(ap, 1)).toEqual([190000, 38000, 228000]);
    const offre = offreDe(p);
    const vide = { offre, lignes: [], montantTotalHtCents: 0 };
    expect(montantsDevis(vide)).toEqual({ lignes: [], montantTotalHtCents: 0 });
    const a = montantsDevis({ ...vide, choix: { formule: "achat", automatisationsRetenues: [] } });
    expect(a.montantTotalHtCents).toBe(448393);
    const b = montantsDevis({
      ...vide,
      choix: { formule: "abonnement", automatisationsRetenues: [] },
    });
    expect(b.montantTotalHtCents).toBe(190000);
    expect(b.lignes).toHaveLength(1);
    expect(b.lignes[0]).toMatchObject({ quantite: 1, prixUnitaireHtCents: 190000 });
    expect(offre.abonnement!.miseEnServiceLignes).toHaveLength(1);
  });

  it("T5 : bascule A + B → B seule — B = 448 393 / 89 679 / 538 072, versements 224 196 / 224 197 ; « 1 900 » gardé ; retour A + B = 190 000", () => {
    const p = formules("AB");
    p.formules.formules = { achat: false, abonnement: true };
    const ap = calculerApercu(p, CTX);
    expect(ap.erreurs).toEqual([]);
    expect(totaux(ap)).toEqual([448393, 89679, 538072]);
    expect(versements(ap)).toEqual([224196, 224197]);
    expect(p.formules.abonnement.lignes[0]!.prixEur).toBe("1 900");
    p.formules.formules = { achat: true, abonnement: true };
    expect(totaux(calculerApercu(p, CTX), 1)).toEqual([190000, 38000, 228000]);
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
    p.sync.devisId = DEVIS;
    prismaMock.devis.findUnique.mockResolvedValue({
      offre: { automatisations: [auto] },
      statut: "brouillon",
      clientId: CLIENT,
    });
    const heritee = await apercuAssistantAction(JSON.parse(JSON.stringify(p)));
    expect("data" in heritee && heritee.data.erreurs).toEqual([]);
  });
  it("identifiants mal formés : { error }, aucune requête, aucune levée", async () => {
    const mal = formules("A");
    mal.clientId = "pas-un-uuid";
    expect(await apercuAssistantAction(JSON.parse(JSON.stringify(mal)))).toEqual({
      error: "Client invalide.",
    });
    const mal2 = formules("A");
    mal2.sync.devisId = "x'; DROP";
    expect(await apercuAssistantAction(JSON.parse(JSON.stringify(mal2)))).toEqual({
      error: "Devis invalide.",
    });
    expect(prismaMock.client.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.devis.findUnique).not.toHaveBeenCalled();
  });
  it("sync.devisId du navigateur non cru : devis relu ; envoyé ou d'un autre client = aucun héritage", async () => {
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
    p.sync.devisId = DEVIS;
    for (const relu of [
      { statut: "envoye", clientId: CLIENT },
      { statut: "brouillon", clientId: "99999999-9999-4999-8999-999999999999" },
    ]) {
      prismaMock.devis.findUnique.mockResolvedValue({
        offre: { automatisations: [auto] },
        ...relu,
      });
      const r = await apercuAssistantAction(JSON.parse(JSON.stringify(p)));
      expect("data" in r && r.data.erreurs.length, JSON.stringify(relu)).toBeGreaterThan(0);
    }
    expect(prismaMock.devis.findUnique.mock.calls[0]![0].where).toEqual({ id: DEVIS });
  });
  it("pas de prisma dans apercu.ts (données pures)", () => {
    expect(readFileSync(resolve(__dirname, "../apercu.ts"), "utf8")).not.toMatch(/@\/lib\/prisma/);
  });
});
