/**
 * Chantier QNC, L11 — le ZIP « dossier de session » et son interrupteur.
 *
 *   · ÉTEINT : rien ne change — même liste de pièces, mêmes compteurs, aucun
 *     `dossier-complet/`, section indicateur 10 inchangée ;
 *   · ACTIF : le dossier complet est écrit ; l'original REMPLACÉ (rectifié
 *     sans annulation) sort des voyants (« [OK] », compteur) mais reste joint
 *     sous `documents/remplacees/` ; l'indicateur 10 n'est nominatif que pour
 *     le référent handicap ;
 *   · ESSAI : seule une session du banc d'essai est concernée ; une session
 *     réelle reste exactement comme éteinte.
 *
 * Le chargement du modèle a sa propre suite (`dossier-session/__tests__`) ;
 * ici on le double, pour tester ce que le ZIP en fait.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import JSZip from "jszip";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainingSession: { findUnique: vi.fn() },
    documentGenere: { findMany: vi.fn(async () => []) },
    emailLog: { findMany: vi.fn(async () => []) },
    activityLog: { findMany: vi.fn(async () => []) },
    sessionDossierEvenement: { findMany: vi.fn(async () => []) },
    emargementSignature: { findMany: vi.fn(async () => []) },
    emargementContresignature: { findMany: vi.fn(async () => []) },
    documentSignature: { findMany: vi.fn(async () => []) },
    questionnaire: { findMany: vi.fn(async () => []) },
    adminUser: { findMany: vi.fn(async () => []) },
  },
}));
vi.mock("@/server/qualiopi/sessions/verrou-dossier", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/qualiopi/sessions/verrou-dossier")>()),
  chargerEtatVerrou: vi.fn(async () => null),
}));
vi.mock("@/lib/r2-storage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/r2-storage")>()),
  isR2Configured: vi.fn(() => true),
  getObjectBufferR2: vi.fn(async (cle: string) => Buffer.from(`%PDF ${cle}`)),
}));
vi.mock("@/server/qualiopi/emargement/feuille-pdf", () => ({
  construireFeuillePdf: vi.fn(async () => null),
}));
vi.mock("@/server/qualiopi/documents/emargement-tirage", () => ({
  rendreTirageEmargementAJour: vi.fn(async () => ({
    ok: false,
    message: "journées non déclarées",
  })),
}));
vi.mock("@/server/qualiopi/documents/signature/registre-verification", () => ({
  verifierChaineDocument: vi.fn(async () => null),
}));
vi.mock("@/server/qualiopi/adaptation/colonne-declaration", () => ({
  colonneDeclarationDisponible: vi.fn(async () => false),
}));
vi.mock("@/server/qualiopi/dossier-session/interrupteur", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/qualiopi/dossier-session/interrupteur")>()),
  lireEtatDossierSession: vi.fn(async () => "eteint"),
}));
vi.mock("@/server/qualiopi/dossier-session/chargement", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/qualiopi/dossier-session/chargement")>()),
  chargerDossierSession: vi.fn(),
}));

vi.mock("@/server/qualiopi/positionnement/pieces-remplies", () => ({
  produirePiecesPositionnementRempli: vi.fn(async () => ({
    pieces: [
      {
        chemin: "positionnements/2026-06-10_dupont-alice_1a2b3c4d.pdf",
        buffer: Buffer.from("%PDF pos"),
        saisieOrganisme: true,
      },
    ],
    echecs: [{ chemin: "positionnements/x.pdf", motif: "rendu", saisieOrganisme: false }],
  })),
}));
vi.mock("@/server/qualiopi/satisfaction/pieces-remplies", () => ({
  produirePiecesSatisfactionRemplie: vi.fn(async () => ({
    pieces: [
      {
        chemin: "satisfactions/2026-06-10_dupont-alice_5e6f_a-chaud.pdf",
        buffer: Buffer.from("%PDF sat"),
        saisieOrganisme: false,
        moment: "chaud",
      },
    ],
    echecs: [],
  })),
}));

import { prisma } from "@/lib/prisma";
import { produirePiecesPositionnementRempli } from "@/server/qualiopi/positionnement/pieces-remplies";
import { produirePiecesSatisfactionRemplie } from "@/server/qualiopi/satisfaction/pieces-remplies";
import { lireEtatDossierSession } from "@/server/qualiopi/dossier-session/interrupteur";
import { chargerDossierSession } from "@/server/qualiopi/dossier-session/chargement";
import { MENTION_RESERVE_REFERENT } from "@/server/qualiopi/dossier-session/blocs";
import type { ModeleDossierSession } from "@/server/qualiopi/dossier-session/rendu";
import { genererDossierSessionZip } from "../dossier-session";
import { getObjectBufferR2 } from "@/lib/r2-storage";

type Fn = ReturnType<typeof vi.fn>;
const mockSession = (prisma as unknown as { trainingSession: { findUnique: Fn } }).trainingSession
  .findUnique;
const mockEtat = lireEtatDossierSession as unknown as Fn;
const mockModele = chargerDossierSession as unknown as Fn;

const CREE = new Date("2026-06-11T16:00:00Z");

function session(estTestInterne = false) {
  return {
    numero: "AXI-SESS-2026-001",
    titreSession: "Bien démarrer avec l'IA",
    financementType: null,
    estTestInterne,
    dateDebut: new Date("2026-06-10T07:00:00Z"),
    dateFin: new Date("2026-06-11T15:00:00Z"),
    documents: [
      // Rectifiée SANS annulation : seule la contre-trace la désigne.
      {
        id: "p0",
        type: "attestation",
        numero: "AXI-ATT-2026-001",
        createdAt: CREE,
        remplaceeParNumero: "AXI-ATT-2026-002",
      },
      {
        id: "p1",
        type: "attestation",
        numero: "AXI-ATT-2026-002",
        createdAt: CREE,
        remplaceeParNumero: null,
      },
    ],
    enrollments: [
      {
        id: "e1",
        tauxPresencePct: 100,
        financementType: null,
        traineeId: "t1",
        adaptationsRealisees: "pauses toutes les heures",
        questionnaires: [],
        trainee: { nom: "Dupont", prenom: "Alice", deletedAt: null, situationHandicap: true },
        presences: [],
        emargementSignatures: [],
      },
    ],
    emargementContresignatures: [],
  };
}

const MODELE: ModeleDossierSession = {
  session: { numero: "AXI-SESS-2026-001", titre: "Bien démarrer avec l'IA", estTestInterne: false },
  elements: [
    {
      cle: "piece:p0",
      nature: "piece",
      destinataire: "stagiaire",
      canal: "autre",
      date: CREE,
      titre: "AXI-ATT-2026-001 (attestation)",
      details: [],
      etiquettes: ["Remplacée par AXI-ATT-2026-002"],
      essai: false,
      horsVoyants: true,
      cheminPdf: "documents/remplacees/attestation/AXI-ATT-2026-001.pdf",
      cleStockage: "documents/2026/attestation/AXI-ATT-2026-001.pdf",
    },
    {
      cle: "piece:p1",
      nature: "piece",
      destinataire: "stagiaire",
      canal: "autre",
      date: CREE,
      titre: "AXI-ATT-2026-002 (attestation)",
      details: [],
      etiquettes: [],
      essai: false,
      horsVoyants: false,
      cheminPdf: "documents/attestation/AXI-ATT-2026-002.pdf",
      cleStockage: "documents/2026/attestation/AXI-ATT-2026-002.pdf",
    },
  ],
  blocs: [],
  horsDossier: { pieces: 0, emails: 0 },
  avertissements: [],
};

async function ouvrir(base64: string) {
  const zip = await JSZip.loadAsync(base64, { base64: true });
  const index = await zip.file("index.txt")!.async("string");
  return { zip, index, chemins: Object.keys(zip.files).sort() };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSession.mockResolvedValue(session());
  mockEtat.mockResolvedValue("eteint");
  mockModele.mockResolvedValue(MODELE);
});

describe("🔴 éteint : rien ne change", () => {
  it("même liste de pièces, mêmes compteurs, aucun dossier complet, aucun chargement", async () => {
    const r = await genererDossierSessionZip("s1", { lecteur: { role: "admin" } });
    const { index, chemins } = await ouvrir(r!.base64);
    expect(r!.nbDocuments).toBe(2);
    expect(r!.nbDocumentsJoints).toBe(2);
    expect(r!.dossierComplet).toBe(false);
    expect(r!.nbDocumentsRemplacees).toBe(0);
    expect(index).toContain("[OK]     attestation/AXI-ATT-2026-001.pdf");
    expect(index).toContain("[OK]     attestation/AXI-ATT-2026-002.pdf");
    expect(chemins.some((c) => c.startsWith("dossier-complet/"))).toBe(false);
    expect(chemins.some((c) => c.includes("remplacees"))).toBe(false);
    expect(mockModele).not.toHaveBeenCalled();
    // L'indicateur 10 reste écrit comme avant ce lot, pour tout lecteur.
    expect(index).toContain("pauses toutes les heures");
    expect(index).not.toContain(MENTION_RESERVE_REFERENT);
  });

  it("le même ZIP qu'avant ce lot, octet pour octet sur l'index, sans lecteur passé", async () => {
    const avec = await genererDossierSessionZip("s1", { lecteur: { role: "admin" } });
    const sans = await genererDossierSessionZip("s1");
    expect((await ouvrir(avec!.base64)).index).toBe((await ouvrir(sans!.base64)).index);
  });
});

describe("actif : dossier complet, original remplacé gardé hors voyants", () => {
  beforeEach(() => mockEtat.mockResolvedValue("actif"));

  it("l'original remplacé sort des voyants et reste joint sous documents/remplacees/", async () => {
    const r = await genererDossierSessionZip("s1", { lecteur: { role: "admin" } });
    const { zip, index, chemins } = await ouvrir(r!.base64);
    expect(r!.nbDocuments).toBe(1);
    expect(r!.nbDocumentsJoints).toBe(1);
    expect(index).not.toContain("[OK]     attestation/AXI-ATT-2026-001.pdf");
    expect(index).toContain("[OK]     attestation/AXI-ATT-2026-002.pdf");
    expect(chemins).toContain("documents/remplacees/attestation/AXI-ATT-2026-001.pdf");
    expect(r!.nbDocumentsRemplacees).toBe(1);
    expect(r!.dossierComplet).toBe(true);
    const complet = await zip.file("dossier-complet/index.txt")!.async("string");
    expect(complet).toContain("Remplacée par AXI-ATT-2026-002");
    expect(mockModele).toHaveBeenCalledWith("s1", { role: "admin" });
  });

  it("🔒 indicateur 10 : réservé au référent ; nominatif pour lui seul", async () => {
    const admin = await ouvrir(
      (await genererDossierSessionZip("s1", { lecteur: { role: "admin" } }))!.base64,
    );
    expect(admin.index).toContain(MENTION_RESERVE_REFERENT);
    expect(admin.index).not.toContain("pauses toutes les heures");
    expect(admin.index).not.toContain("Alice Dupont — besoin");
    const sansLecteur = await ouvrir((await genererDossierSessionZip("s1"))!.base64);
    expect(sansLecteur.index).toContain(MENTION_RESERVE_REFERENT);
    const referent = await ouvrir(
      (await genererDossierSessionZip("s1", { lecteur: { role: "super_admin" } }))!.base64,
    );
    expect(referent.index).toContain("pauses toutes les heures");
  });
});

describe("essai : le banc d'essai seul", () => {
  beforeEach(() => mockEtat.mockResolvedValue("essai"));

  it("une session réelle reste exactement comme éteinte", async () => {
    const r = await genererDossierSessionZip("s1", { lecteur: { role: "admin" } });
    const { chemins } = await ouvrir(r!.base64);
    expect(r!.dossierComplet).toBe(false);
    expect(r!.nbDocuments).toBe(2);
    expect(chemins.some((c) => c.startsWith("dossier-complet/"))).toBe(false);
  });

  it("une session du banc d'essai reçoit le dossier complet", async () => {
    mockSession.mockResolvedValue(session(true));
    const r = await genererDossierSessionZip("s1", { lecteur: { role: "admin" } });
    expect(r!.dossierComplet).toBe(true);
    expect(r!.nbDocuments).toBe(1);
  });
});

describe("🔴 modèles vierges et questionnaires remplis (dossier à 100 %)", () => {
  const avecVierge = () => {
    const sess = session();
    sess.documents.push({
      id: "pv",
      type: "positionnement",
      numero: "AXI-POS-2026-001",
      createdAt: CREE,
      remplaceeParNumero: null,
      metadata: {},
    } as never);
    return sess;
  };

  it("actif : le modèle vierge n'est pas joint, il est nommé, et les pièces remplies sont versées", async () => {
    mockEtat.mockResolvedValue("actif");
    mockSession.mockResolvedValue(avecVierge());
    const r = await genererDossierSessionZip("s1", { lecteur: { role: "admin" } });
    const { index, chemins } = await ouvrir(r!.base64);
    expect(chemins).not.toContain("documents/positionnement/AXI-POS-2026-001.pdf");
    expect(index).toContain(
      "[MODÈLE VIERGE — non joint, non probant] positionnement/AXI-POS-2026-001",
    );
    expect(chemins).toContain(
      "questionnaires-remplis/positionnements/2026-06-10_dupont-alice_1a2b3c4d.pdf",
    );
    expect(chemins).toContain(
      "questionnaires-remplis/satisfactions/2026-06-10_dupont-alice_5e6f_a-chaud.pdf",
    );
    expect(index).toContain("(saisie par l'organisme)");
    expect(index).toContain("positionnements/x.pdf");
    expect(produirePiecesPositionnementRempli).toHaveBeenCalledWith("s1");
    expect(produirePiecesSatisfactionRemplie).toHaveBeenCalledWith("s1");
    // Le vierge ne rend pas « aucun PDF joint » : les deux autres sont joints.
    expect(index).not.toContain("[ABSENT] positionnement");
  });

  it("éteint : le ZIP est inchangé, le vierge est toujours joint, rien n'est versé", async () => {
    mockEtat.mockResolvedValue("eteint");
    mockSession.mockResolvedValue(avecVierge());
    const r = await genererDossierSessionZip("s1", { lecteur: { role: "admin" } });
    const { index, chemins } = await ouvrir(r!.base64);
    expect(chemins).toContain("documents/positionnement/AXI-POS-2026-001.pdf");
    expect(index).not.toContain("MODÈLE VIERGE");
    expect(chemins.some((c) => c.startsWith("questionnaires-remplis/"))).toBe(false);
    expect(produirePiecesPositionnementRempli).not.toHaveBeenCalled();
    expect(produirePiecesSatisfactionRemplie).not.toHaveBeenCalled();
  });
});

describe("🔴 « AUCUN PDF joint » compte les documents hors modèles vierges", () => {
  it("1 vrai document introuvable + 1 vierge : le message dit 1 document, pas 2", async () => {
    mockEtat.mockResolvedValue("actif");
    const sess = session();
    sess.documents = [
      {
        id: "d1",
        type: "convention",
        numero: "AXI-CONV-2026-001",
        createdAt: CREE,
        remplaceeParNumero: null,
      },
      {
        id: "pv",
        type: "positionnement",
        numero: "AXI-POS-2026-001",
        createdAt: CREE,
        remplaceeParNumero: null,
        metadata: {},
      } as never,
    ];
    mockSession.mockResolvedValue(sess);
    (getObjectBufferR2 as unknown as Fn).mockResolvedValueOnce(null);
    const r = await genererDossierSessionZip("s1", { lecteur: { role: "admin" } });
    const msg = r!.avertissements.find((a) => a.includes("AUCUN PDF joint"));
    expect(msg).toContain("1 document en base mais AUCUN PDF joint");
  });
});
