// @vitest-environment node
/**
 * 🔴 QNC L02 — UN ESSAI N'ATTEINT AUCUN CANAL EXTERNE.
 *
 * Chaque porte de sortie est exercée deux fois : avec une pièce d'ESSAI (rien
 * ne sort, le refus est journalisé) et avec la même pièce RÉELLE (elle sort,
 * comme avant ce lot — c'est le témoin qui prouve que la garde est bien celle
 * qui arrête l'essai, et pas une panne du décor).
 *
 * Canaux : e-mail (`enqueueEmail`, liste blanche), facture électronique
 * (Plateforme Agréée), facture automatique du lendemain, Axion Partners,
 * commissions d'apporteur, autofacture formateur, alertes Telegram.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { correspond, fauxPrisma, type Ligne } from "./_base-en-memoire";

const etat = vi.hoisted(() => ({ tables: {} as Record<string, Record<string, unknown>[]> }));
const file = vi.hoisted(() => ({ add: vi.fn(), garer: vi.fn(), journalEmail: vi.fn() }));

vi.mock("@/lib/prisma", async () => {
  const { fauxPrisma } = await import("./_base-en-memoire");
  return { prisma: fauxPrisma(new Proxy({}, { get: (_c, k: string) => etat.tables[k] })) };
});
vi.mock("bullmq", () => ({
  Queue: class {
    readonly name: string;
    constructor(name: string) {
      this.name = name;
    }
    add = file.add;
    removeRepeatable = vi.fn();
    getRepeatableJobs = vi.fn().mockResolvedValue([]);
  },
}));
vi.mock("@/server/queue/connection", () => ({
  getBullConnection: () => ({ host: "doublure" }),
  getBullConnectionOrThrow: () => ({ host: "doublure" }),
  isBullmqDisabled: () => false,
}));
vi.mock("@/server/email/outbox-service", () => ({
  resoudreMode: async () => "auto",
  garerPourValidation: (...a: unknown[]) => file.garer(...a),
}));
vi.mock("@/server/email/email-log", () => ({
  journaliserEnAttente: (...a: unknown[]) => file.journalEmail(...a),
  marquerEchecMiseEnFile: vi.fn(),
}));
vi.mock("@/server/email/suppression", () => ({
  verdictAvantEnvoi: async () => ({ retenu: false }),
  signalerRetenue: vi.fn(),
}));
vi.mock("@/lib/email/templates", () => ({ sujetDuGabarit: () => "Convocation" }));
vi.mock("@/server/qualiopi/documents/documents-service", () => ({
  generateDocument: vi.fn(async () => {
    throw new Error("aucune pièce ne doit être générée pour un essai");
  }),
}));
vi.mock("@/server/qualiopi/documents/organisme", () => ({
  getOrganismeIdentite: vi.fn(async () => ({})),
}));
vi.mock("@/server/qualiopi/remuneration/verrou-emission-autofacture", () => ({
  avecVerrouEmissionAutofacture: async (fn: () => Promise<unknown>) => ({
    acquis: true,
    valeur: await fn(),
  }),
}));

import { enqueueEmail } from "@/server/queue/queues";
import {
  avecGardeEssai,
  type PlateformeAgreeeAdapter,
} from "@/server/qualiopi/financements/e-invoicing/pa-adapter";
import {
  deciderFactureAuto,
  type SessionFactureAuto,
} from "@/server/qualiopi/financements/facture-auto-regles";
import { emettreFaitFacture } from "@/server/partners-sync/producteurs/facturation";
import { emettreAutofacture } from "@/server/qualiopi/remuneration/autofacture-emission";
import { sortieSaufEssai } from "@/server/qualiopi/essai/sorties";
import { CLE_ADRESSES_ESSAI } from "@/server/qualiopi/essai/liste-blanche";
import { FACTURE_HORS_ESSAI } from "@/server/qualiopi/essai/perimetre";
import type { Prisma } from "../../../../../prisma/generated/client";

const S_REELLE = "5e000000-0000-4000-8000-000000000001";
const S_ESSAI = "5e000000-0000-4000-8000-0000000000e1";
const E_REELLE = "e0000000-0000-4000-8000-000000000001";
const E_ESSAI = "e0000000-0000-4000-8000-0000000000e1";
const ENTREPRISE = "7c000000-0000-4000-8000-000000000005";

function sessionLigne(id: string, essai: boolean): Ligne {
  return {
    id,
    numero: essai ? "AXI-SESS-ESSAI-2026-0A0B0C" : "AXI-SESS-2026-001",
    estTestInterne: essai,
    clientId: ENTREPRISE,
  };
}

function facture(id: string, s: Ligne, numero: string): Ligne {
  return {
    id,
    numero,
    activite: "formation",
    clientId: ENTREPRISE,
    sessionId: s["id"],
    enrollmentId: null,
    coachingContractId: null,
    dossierFinancementId: null,
    destinataire: "entreprise",
    destinataireSiret: "12345678200010",
    montantHtCents: 100_000,
    montantTvaCents: 20_000,
    montantTtcCents: 120_000,
    regimeTva: "assujetti",
    subrogation: false,
    avoirDeId: null,
    devisId: null,
    statut: "emise",
    emiseAt: new Date("2026-03-01T09:00:00.000Z"),
    echeanceAt: new Date("2026-03-31T09:00:00.000Z"),
    paidAt: null,
    createdAt: new Date("2026-03-01T09:00:00.000Z"),
    updatedAt: new Date("2026-03-01T09:00:00.000Z"),
    session: s,
    enrollment: null,
    dossierFinancement: null,
  };
}

const journal = () =>
  (etat.tables["activityLog"] ?? []).filter((l) => l["action"] === "qualiopi.essai.sortie_bloquee");

beforeEach(() => {
  process.env["DATABASE_URL"] = "postgresql://essai@localhost:5432/essai";
  process.env["PARTNERS_SYNC_ENABLED"] = "true";
  file.add.mockReset().mockResolvedValue({ id: "job" });
  file.garer.mockReset().mockResolvedValue("outbox-1");
  file.journalEmail.mockReset().mockResolvedValue("ligne-1");
  const reelle = sessionLigne(S_REELLE, false);
  const essai = sessionLigne(S_ESSAI, true);
  etat.tables = {
    trainingSession: [reelle, essai],
    enrollment: [
      { id: E_REELLE, estTestInterne: false, session: reelle },
      { id: E_ESSAI, estTestInterne: true, session: essai },
    ],
    setting: [{ key: CLE_ADRESSES_ESSAI, value: { adresses: ["testeur@axion-ia.test"] } }],
    activityLog: [],
    client: [
      {
        id: ENTREPRISE,
        numero: "AXI-CLI-005",
        type: "entreprise",
        raisonSociale: "Entreprise formée",
        siren: "123456782",
        siret: "12345678200010",
        nafCode: "6201Z",
        secteur: "Informatique",
        taille: "pme_10_49",
        createdAt: new Date("2026-01-02T10:00:00.000Z"),
        updatedAt: new Date("2026-01-02T10:00:00.000Z"),
      },
    ],
    factureFormation: [
      facture("fa000000-0000-4000-8000-000000000001", reelle, "AXI-FACT-2026-001"),
      facture("fa000000-0000-4000-8000-0000000000e1", essai, "AXI-FACT-ESSAI-2026-0F0F0F"),
    ],
    partnersSyncOutbox: [],
    dossierPayeur: [],
  };
});

// ─────────────────────────────────────────────────────────────────────────────

describe("e-mail — liste blanche des adresses d'essai", () => {
  it("🔴 une convocation d'ESSAI vers une vraie adresse n'est pas enfilée, et le refus est journalisé", async () => {
    const r = await enqueueEmail(
      "qualiopi-convocation",
      "client@entreprise.fr",
      "fr",
      {},
      {
        entityType: "Enrollment",
        entityId: E_ESSAI,
      },
    );
    expect(r).toEqual({ enqueued: false, essaiBloque: true });
    expect(file.add).not.toHaveBeenCalled();
    expect(file.journalEmail).not.toHaveBeenCalled();
    const [ligne] = journal();
    expect(ligne?.["changes"]).toMatchObject({ canal: "email", objet: "qualiopi-convocation" });
    // Jamais l'adresse en clair dans le journal : une empreinte.
    expect(JSON.stringify(journal())).not.toContain("client@entreprise.fr");
  });

  it("🔴 la corbeille ne la rattrape pas : un e-mail d'essai « à valider » est bloqué AVANT d'être garé", async () => {
    const r = await enqueueEmail(
      "facture-envoi",
      "compta@entreprise.fr",
      "fr",
      {},
      {
        entityType: "TrainingSession",
        entityId: S_ESSAI,
        exigerValidation: true,
      },
    );
    expect(r.essaiBloque).toBe(true);
    expect(file.garer).not.toHaveBeenCalled();
  });

  it("une adresse de la liste blanche reçoit l'e-mail d'essai (casse et espaces ignorés)", async () => {
    const r = await enqueueEmail(
      "qualiopi-convocation",
      " Testeur@Axion-IA.test ",
      "fr",
      {},
      {
        entityType: "Enrollment",
        entityId: E_ESSAI,
      },
    );
    expect(r.enqueued).toBe(true);
    expect(file.add).toHaveBeenCalledTimes(1);
  });

  it("liste blanche absente : TOUT e-mail d'essai est bloqué", async () => {
    etat.tables["setting"] = [];
    const r = await enqueueEmail(
      "qualiopi-convocation",
      "testeur@axion-ia.test",
      "fr",
      {},
      {
        entityType: "Enrollment",
        entityId: E_ESSAI,
      },
    );
    expect(r.essaiBloque).toBe(true);
  });

  it("témoin — la même convocation RÉELLE part, hors liste blanche, comme avant", async () => {
    const r = await enqueueEmail(
      "qualiopi-convocation",
      "client@entreprise.fr",
      "fr",
      {},
      {
        entityType: "Enrollment",
        entityId: E_REELLE,
      },
    );
    expect(r.enqueued).toBe(true);
    expect(journal()).toHaveLength(0);
  });
});

describe("facture électronique — Plateforme Agréée", () => {
  function adaptateurEspion() {
    const deposer = vi.fn(async () => ({ depotId: "pa-1", statut: "deposee" as const }));
    const adapter: PlateformeAgreeeAdapter = { nom: "espion", deposerFacture: deposer };
    return { adapter: avecGardeEssai(adapter), deposer };
  }

  it("🔴 une facture d'ESSAI n'est jamais déposée, quel que soit l'adaptateur", async () => {
    const { adapter, deposer } = adaptateurEspion();
    const r = await adapter.deposerFacture({
      xml: "<x/>",
      numero: "AXI-FACT-ESSAI-2026-0F0F0F",
      acheteurSiret: "12345678200010",
    });
    expect(r.statut).toBe("rejetee");
    expect(deposer).not.toHaveBeenCalled();
    expect(journal()[0]?.["changes"]).toMatchObject({ canal: "facture_electronique" });
  });

  it("témoin — une facture réelle est déposée", async () => {
    const { adapter, deposer } = adaptateurEspion();
    await adapter.deposerFacture({ xml: "<x/>", numero: "AXI-FACT-2026-001", acheteurSiret: "1" });
    expect(deposer).toHaveBeenCalledTimes(1);
  });
});

describe("facture automatique du lendemain", () => {
  const fin = new Date("2026-10-05T14:00:00.000Z");
  const lendemain = new Date("2026-10-06T08:00:00.000Z");
  const s = (estTestInterne: boolean): SessionFactureAuto => ({
    id: S_ESSAI,
    estTestInterne,
    numero: "AXI-SESS-ESSAI-2026-0A0B0C",
    titreSession: "Essai",
    statut: "realisee",
    dateFin: fin,
    montantHtCents: 150_000,
    interEntreprises: false,
    financementType: "direct",
    opcoSubrogation: false,
    client: {
      type: "entreprise",
      raisonSociale: "Acme",
      siret: "12345678900011",
      adresse: "1 rue de l'Exemple, 00000 Ville",
      adresseRue: null,
      adresseCodePostal: null,
      adresseVille: null,
      tvaIntracom: null,
      opcoIdentifie: null,
      contactEmail: "compta@acme.test",
    },
    facturesFormation: [],
    dossiersFinancement: [],
  });

  it("🔴 une session d'ESSAI n'est jamais facturée par l'automate", () => {
    expect(deciderFactureAuto(s(true), lendemain)).toEqual({
      verdict: "hors_champ",
      raison: "session_d_essai",
    });
  });

  it("témoin — la même session réelle est facturée le lendemain", () => {
    expect(deciderFactureAuto(s(false), lendemain).verdict).toBe("emettre");
  });
});

describe("Axion Partners", () => {
  const tx = () => fauxPrisma(etat.tables) as unknown as Prisma.TransactionClient;

  it("🔴 une facture d'ESSAI ne produit aucun fait dans la file Partners", async () => {
    const id = await emettreFaitFacture(tx(), "fa000000-0000-4000-8000-0000000000e1");
    expect(id).toBeNull();
    expect(etat.tables["partnersSyncOutbox"]).toHaveLength(0);
    expect(journal()[0]?.["changes"]).toMatchObject({ canal: "partners", objet: "facture.emise" });
  });

  it("🔴 l'AVOIR d'une facture d'essai (sans session) ne part pas non plus", async () => {
    etat.tables["factureFormation"]!.push({
      ...facture("fa000000-0000-4000-8000-0000000000a1", {}, "AXI-AVO-ESSAI-2026-0A0A0A"),
      sessionId: null,
      session: null,
      avoirDeId: "fa000000-0000-4000-8000-0000000000e1",
      montantHtCents: -100_000,
      montantTvaCents: -20_000,
      montantTtcCents: -120_000,
    });
    const id = await emettreFaitFacture(tx(), "fa000000-0000-4000-8000-0000000000a1");
    expect(id).toBeNull();
    expect(etat.tables["partnersSyncOutbox"]).toHaveLength(0);
  });

  it("témoin — la facture réelle produit son fait `facture.emise`", async () => {
    const id = await emettreFaitFacture(tx(), "fa000000-0000-4000-8000-000000000001");
    expect(id).not.toBeNull();
    expect(etat.tables["partnersSyncOutbox"]).toHaveLength(1);
    expect(journal()).toHaveLength(0);
  });
});

describe("commissions d'apporteur — la facture d'essai ne fonde rien", () => {
  it("🔴 le filtre des factures payées écarte la facture d'essai et son avoir, garde la réelle", () => {
    const lignes = etat.tables["factureFormation"]!;
    lignes.push({
      ...facture("fa000000-0000-4000-8000-0000000000a1", {}, "AXI-AVO-ESSAI-2026-0A0A0A"),
      session: null,
    });
    const retenues = lignes.filter((l) =>
      correspond(l, FACTURE_HORS_ESSAI as Record<string, unknown>),
    );
    expect(retenues.map((l) => l["numero"])).toEqual(["AXI-FACT-2026-001"]);
  });
});

describe("autofacture formateur", () => {
  it("🔴 un relevé qui porte une prestation d'ESSAI n'est jamais autofacturé ni transmis", async () => {
    etat.tables["trainerStatement"] = [
      {
        id: "51000000-0000-4000-8000-000000000001",
        feeLines: [{ nature: "honoraire_du", montantHtCents: 50_000, sessionId: S_ESSAI }],
      },
    ];
    const journaliser = vi.fn();
    const r = await emettreAutofacture("51000000-0000-4000-8000-000000000001", journaliser);
    expect(r).toMatchObject({ code: "session_d_essai" });
    expect(journaliser).not.toHaveBeenCalled();
    expect(journal()[0]?.["changes"]).toMatchObject({ canal: "autofacture" });
  });
});

describe("alertes Telegram", () => {
  it("🔴 une alerte d'essai n'est pas envoyée et le refus est journalisé", async () => {
    const envoyer = vi.fn(async () => true);
    const r = await sortieSaufEssai(
      true,
      { canal: "telegram", cibleType: "TrainingSession", cibleId: S_ESSAI, objet: "signature" },
      envoyer,
    );
    expect(r).toBeNull();
    expect(envoyer).not.toHaveBeenCalled();
    expect(journal()[0]?.["changes"]).toMatchObject({ canal: "telegram" });
  });

  it("témoin — une alerte réelle part", async () => {
    const envoyer = vi.fn(async () => true);
    await sortieSaufEssai(false, { canal: "telegram", cibleType: "x" }, envoyer);
    expect(envoyer).toHaveBeenCalledTimes(1);
  });
});
