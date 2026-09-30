/**
 * ADR 0060 (D8) — CE QUE VOIT LE CERTIFICATEUR.
 *
 * Jeu de test qui reproduit AXI-SESS-2026-001 (réalisée, attestation émise),
 * ROUVERT pour corriger une attestation puis CLOS à nouveau. Le ZIP du dossier
 * de session doit dire, sans que personne n'ait à le demander :
 *   - la réouverture : type, date ET heure de Paris, NOM de l'auteur, motif
 *     intégral ; les actions du journal menées pendant l'ouverture ; la date du
 *     reverrouillage ;
 *   - un avertissement dans l'index ;
 *   - les signatures révoquées (motif, date, auteur) ;
 *   - l'origine des réponses aux questionnaires (stagiaire, organisme, non tracée).
 * Et le manifeste global doit porter `reouverturesSessions` et sa ligne
 * récapitulative.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import JSZip from "jszip";

const h = vi.hoisted(() => {
  process.env["DATABASE_URL"] = "postgresql://test:test@localhost:5432/test";
  const reponses = new Map<string, unknown>();
  const modeles = new Map<string, unknown>();
  function modele(nom: string): unknown {
    return new Proxy(
      {},
      {
        get(_c, methode) {
          if (typeof methode !== "string" || methode === "then") return undefined;
          return async () => {
            const cle = `${nom}.${methode}`;
            if (reponses.has(cle)) return reponses.get(cle);
            if (methode === "findMany" || methode === "groupBy") return [];
            if (methode === "count") return 0;
            return null;
          };
        },
      },
    );
  }
  const prisma = new Proxy(
    {},
    {
      get(_c, nom) {
        if (typeof nom !== "string" || nom === "then") return undefined;
        if (!modeles.has(nom)) modeles.set(nom, modele(nom));
        return modeles.get(nom);
      },
    },
  );
  return { prisma, reponses };
});

vi.mock("@/lib/prisma", () => ({ prisma: h.prisma }));
vi.mock("@/lib/r2-storage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/r2-storage")>()),
  isR2Configured: () => false,
  getObjectBufferR2: async () => null,
}));
vi.mock("@/server/qualiopi/documents/signature/registre-verification", () => ({
  verifierChaineDocument: async () => null,
}));
vi.mock("@/server/qualiopi/emargement/feuille-pdf", () => ({
  construireFeuillePdf: async () => null,
}));
vi.mock("@/server/qualiopi/documents/emargement-tirage", () => ({
  rendreTirageEmargementAJour: async () => ({ ok: false as const, message: "non modélisé" }),
}));
vi.mock("@/server/qualiopi/adaptation/colonne-declaration", () => ({
  colonneDeclarationDisponible: async () => false,
}));
vi.mock("@/server/qualiopi/adaptation/journal-consignation", () => ({
  lireCircuitAdaptation: async () => new Map(),
}));
vi.mock("@/server/qualiopi/adaptation/dossier-adaptation", () => ({
  sectionIndicateur10: () => ({ lignes: [], nbAConsigner: 0 }),
}));
vi.mock("@/server/qualiopi/conformite/conformite-service", () => ({
  evaluerConformite: async () => ({
    indicateurs: [],
    nbCouverts: 0,
    nbApplicables: 0,
    scorePct: 0,
  }),
}));
vi.mock("@/server/qualiopi/config/site-settings", () => ({ getQualiopiConfig: async () => "" }));
vi.mock("@/server/qualiopi/sessions/verrou-dossier", async (importOriginal) => {
  const reel = await importOriginal<typeof import("../verrou-dossier")>();
  return {
    ...reel,
    chargerEtatVerrou: async () => ({
      statut: "realisee",
      etat: { etat: "clos", depuis: new Date("2026-09-30T13:30:00Z") },
      entree: {},
    }),
  };
});

import { genererDossierSessionZip } from "@/server/qualiopi/conformite/dossier-session";
import { genererManifesteAudit } from "@/server/qualiopi/conformite/audit-dossier";

const SESSION = "00000000-0000-4000-8000-000000000001";
const ENROLLMENT = "00000000-0000-4000-8000-000000000002";
const DOC_ATT = "00000000-0000-4000-8000-000000000003";

const REOUVERTURE = new Date("2026-09-30T12:05:00Z"); // 14:05 à Paris
const CORRECTION = new Date("2026-09-30T12:20:00Z"); // 14:20 à Paris
const REVERROUILLAGE = new Date("2026-09-30T13:30:00Z"); // 15:30 à Paris
const MOTIF =
  "Le nom de la stagiaire est mal orthographié sur l'attestation AXI-ATT-2026-004 : rectification demandée par l'entreprise le 29/09.";

function jeuAxiSess2026001(): void {
  h.reponses.clear();
  h.reponses.set("trainingSession.findUnique", {
    numero: "AXI-SESS-2026-001",
    titreSession: "Initiation à l'IA générative",
    dateDebut: new Date("2026-09-10T07:00:00Z"),
    dateFin: new Date("2026-09-10T15:00:00Z"),
    financementType: "direct",
    documents: [
      { id: DOC_ATT, type: "attestation", numero: "AXI-ATT-2026-005", createdAt: CORRECTION },
    ],
    enrollments: [
      {
        id: ENROLLMENT,
        tauxPresencePct: 100,
        financementType: null,
        traineeId: "t-1",
        adaptationsRealisees: null,
        besoinAdaptationDeclareAt: null,
        questionnaires: [],
        trainee: { nom: "Blanc", prenom: "Simone", deletedAt: null, situationHandicap: false },
        presences: [],
        emargementSignatures: [],
      },
    ],
    emargementContresignatures: [],
  });
  h.reponses.set("sessionDossierEvenement.findMany", [
    { type: "reouverture", createdAt: REOUVERTURE, auteurNom: "Williams Jullin", motif: MOTIF },
    {
      type: "reverrouillage",
      createdAt: REVERROUILLAGE,
      auteurNom: "Williams Jullin",
      motif: null,
    },
  ]);
  h.reponses.set("activityLog.findMany", [
    {
      createdAt: CORRECTION,
      action: "qualiopi.attestation.generer",
      targetType: "Enrollment",
      targetId: ENROLLMENT,
      changes: { avant: { numero: "AXI-ATT-2026-004" }, apres: { numero: "AXI-ATT-2026-005" } },
      adminUser: { name: "Williams Jullin" },
    },
  ]);
  h.reponses.set("emargementSignature.findMany", [
    {
      signataireNom: "Simone Blanc",
      signeAt: new Date("2026-09-10T07:10:00Z"),
      revokedAt: new Date("2026-09-30T12:10:00Z"),
      revokedMotif: "Signature apposée sur le mauvais créneau",
      revokedById: "admin-1",
    },
  ]);
  h.reponses.set("adminUser.findMany", [{ id: "admin-1", name: "Williams Jullin" }]);
  h.reponses.set("questionnaire.findMany", [
    { type: "satisfaction_chaud", origineReponse: "stagiaire" },
    { type: "positionnement", origineReponse: "organisme" },
    { type: "satisfaction_froid", origineReponse: null },
  ]);
}

async function indexDuZip(): Promise<{ index: string; avertissements: string[] }> {
  const r = await genererDossierSessionZip(SESSION);
  if (r === null) throw new Error("dossier nul");
  const zip = await JSZip.loadAsync(r.base64, { base64: true });
  const index = await zip.file("index.txt")?.async("string");
  if (index === undefined) throw new Error("index.txt absent");
  return { index, avertissements: r.avertissements };
}

describe("ADR 0060 — dossier de session AXI-SESS-2026-001 rouvert puis reclos", () => {
  beforeEach(jeuAxiSess2026001);

  it("la section « Historique du dossier » dit type, date et heure de Paris, auteur, motif intégral, actions et reverrouillage", async () => {
    const { index } = await indexDuZip();
    expect(index).toContain("Historique du dossier : verrouillage et réouvertures");
    expect(index).toContain(
      "Réouverture n°1 — le 30/09/2026 à 14:05 (heure de Paris), par Williams Jullin",
    );
    expect(index).toContain(`Motif : « ${MOTIF} »`);
    expect(index).toContain(
      "30/09/2026 à 14:20 (heure de Paris) — qualiopi.attestation.generer — par Williams Jullin",
    );
    expect(index).toContain("AXI-ATT-2026-004");
    expect(index).toContain(
      "Reverrouillage — le 30/09/2026 à 15:30 (heure de Paris), par Williams Jullin",
    );
    expect(index).toContain("meilleur effort");
    // L'état est dit avec le texte même du bandeau de l'écran.
    expect(index).toContain("État à la date de ce dossier : Dossier clos le 30/09/2026");
  });

  it("l'index porte un AVERTISSEMENT de réouverture", async () => {
    const { index, avertissements } = await indexDuZip();
    expect(avertissements.some((a) => a.includes("rouvert 1 fois"))).toBe(true);
    expect(index).toMatch(/AVERTISSEMENTS :[\s\S]*rouvert 1 fois/);
  });

  it("la section « Signatures révoquées » nomme motif, date et auteur", async () => {
    const { index } = await indexDuZip();
    expect(index).toContain("Signatures révoquées (1)");
    expect(index).toContain(
      "émargement — Simone Blanc — signée le 2026-09-10 — révoquée le 30/09/2026 à 14:10 (heure de Paris) par Williams Jullin — motif : « Signature apposée sur le mauvais créneau »",
    );
  });

  it("la section « Origine des réponses » distingue stagiaire, organisme et non tracée", async () => {
    const { index } = await indexDuZip();
    expect(index).toContain("Origine des réponses aux questionnaires (3)");
    expect(index).toContain("1 répondue par le stagiaire lui-même");
    expect(index).toContain("1 saisie par l'organisme à sa place");
    expect(index).toContain("1 origine non tracée (réponse antérieure au 30/09/2026)");
  });

  it("un dossier jamais rouvert le dit, sans avertissement", async () => {
    h.reponses.set("sessionDossierEvenement.findMany", []);
    const { index, avertissements } = await indexDuZip();
    expect(index).toContain("Aucune réouverture");
    expect(avertissements.some((a) => a.includes("rouvert"))).toBe(false);
  });

  it("un stagiaire anonymisé est dit, daté, avec ses preuves conservées", async () => {
    const s = h.reponses.get("trainingSession.findUnique") as {
      enrollments: Array<{ trainee: { deletedAt: Date | null } }>;
    };
    (s.enrollments[0] as { trainee: { deletedAt: Date | null } }).trainee.deletedAt = new Date(
      "2026-09-25T10:00:00Z",
    );
    const { index } = await indexDuZip();
    expect(index).toContain(
      "Stagiaire anonymisé le 2026-09-25 (art. 17 §3 b), preuves conservées.",
    );
  });
});

describe("ADR 0060 — manifeste global", () => {
  beforeEach(() => {
    h.reponses.clear();
    h.reponses.set("sessionDossierEvenement.findMany", [
      {
        sessionId: SESSION,
        type: "reouverture",
        createdAt: REOUVERTURE,
        auteurNom: "Williams Jullin",
        motif: MOTIF,
        session: { numero: "AXI-SESS-2026-001", titreSession: "Initiation à l'IA générative" },
      },
      {
        sessionId: SESSION,
        type: "reverrouillage",
        createdAt: REVERROUILLAGE,
        auteurNom: "Williams Jullin",
        motif: null,
        session: { numero: "AXI-SESS-2026-001", titreSession: "Initiation à l'IA générative" },
      },
    ]);
  });

  it("manifeste.json porte reouverturesSessions, et le markdown sa ligne récapitulative", async () => {
    const m = await genererManifesteAudit();
    expect(m.json.reouverturesRegistreLu).toBe(true);
    expect(m.json.reouverturesSessions).toEqual([
      {
        sessionId: SESSION,
        numero: "AXI-SESS-2026-001",
        titre: "Initiation à l'IA générative",
        reouvertures: [
          {
            le: REOUVERTURE.toISOString(),
            par: "Williams Jullin",
            motif: MOTIF,
            reverrouilleLe: REVERROUILLAGE.toISOString(),
          },
        ],
        toujoursRouvert: false,
      },
    ]);
    expect(m.markdown).toContain("**1 session rouverte** après clôture");
    expect(m.markdown).toContain(
      "AXI-SESS-2026-001 — rouverte le 30/09/2026 à 14:05 (heure de Paris) par Williams Jullin",
    );
    expect(m.markdown).toContain("close à nouveau le 30/09/2026");
  });

  it("aucune réouverture : « 0 session rouverte », jamais le silence", async () => {
    h.reponses.set("sessionDossierEvenement.findMany", []);
    const m = await genererManifesteAudit();
    expect(m.json.reouverturesSessions).toEqual([]);
    expect(m.markdown).toContain("**0 session rouverte**");
  });
});
