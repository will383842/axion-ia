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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
          return async (...args: unknown[]) => {
            const cle = `${nom}.${methode}`;
            if (reponses.has(cle)) {
              const r = reponses.get(cle);
              // Une réponse FONCTION lit la requête : c'est ce qui permet au
              // double du journal d'appliquer vraiment son `where`.
              return typeof r === "function" ? (r as (a: unknown) => unknown)(args[0]) : r;
            }
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
  h.reponses.set("enrollment.findMany", [{ id: ENROLLMENT, trainee: { deletedAt: null } }]);
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
  // Les tables servent à deux requêtes : la section du dossier (champs
  // métier) et la recherche des cibles du journal (identifiants) — le double
  // répond selon ce qui est demandé.
  h.reponses.set("emargementSignature.findMany", (a: { select: Record<string, unknown> }) =>
    "revokedAt" in a.select
      ? [
          {
            signataireNom: "Simone Blanc",
            signeAt: new Date("2026-09-10T07:10:00Z"),
            revokedAt: new Date("2026-09-30T12:10:00Z"),
            revokedMotif: "Signature apposée sur le mauvais créneau",
            revokedById: "admin-1",
          },
        ]
      : [],
  );
  h.reponses.set("adminUser.findMany", [{ id: "admin-1", name: "Williams Jullin" }]);
  h.reponses.set("questionnaire.findMany", (a: { select: Record<string, unknown> }) =>
    "origineReponse" in a.select
      ? [
          { type: "satisfaction_chaud", origineReponse: "stagiaire" },
          { type: "positionnement", origineReponse: "organisme" },
          { type: "satisfaction_froid", origineReponse: null },
        ]
      : [],
  );
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

  it("l'index SIGNALE la réouverture en tête, sans la compter comme un avertissement (le dossier n'en devient pas incomplet)", async () => {
    const { index, avertissements } = await indexDuZip();
    const lignes = index.split("\n");
    expect(lignes[3]).toContain("rouvert 1 fois après sa clôture");
    // Revue PR #1245 : versé dans `avertissements`, il rendait `incomplet`
    // vrai, et un dossier rouvert, reclos et complet s'affichait INCOMPLET.
    expect(avertissements.some((a) => a.includes("rouvert"))).toBe(false);
    expect(index).not.toMatch(/AVERTISSEMENTS :[\s\S]*rouvert 1 fois/);
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

// ─────────────────────────────────────────────────────────────────────────────
// Revue de la PR #1245 — le journal de l'ouverture doit être COMPLET
// ─────────────────────────────────────────────────────────────────────────────

interface LigneJournal {
  createdAt: Date;
  action: string;
  targetType: string;
  targetId: string;
  changes: Record<string, unknown> | null;
  adminUser: { name: string };
}

/**
 * Un double de `activityLog.findMany` qui APPLIQUE son `where` (la version
 * précédente rendait la même liste quel que soit le filtre, et ne pouvait donc
 * pas voir qu'une action manquait). Une clé inconnue fait échouer le test :
 * changer la forme du filtre oblige à relire ce double.
 */
function journalFiltrant(lignes: LigneJournal[]) {
  return (args: unknown): LigneJournal[] => {
    const where = (args as { where: Record<string, unknown> }).where;
    for (const k of Object.keys(where)) {
      if (k !== "createdAt" && k !== "OR") throw new Error(`clé de filtre inconnue : ${k}`);
    }
    const periode = where["createdAt"] as { gte?: Date; lte?: Date } | undefined;
    const ou = where["OR"] as Array<Record<string, unknown>>;
    return lignes.filter((l) => {
      const t = l.createdAt.getTime();
      if (periode?.gte !== undefined && t < periode.gte.getTime()) return false;
      if (periode?.lte !== undefined && t > periode.lte.getTime()) return false;
      return ou.some((c) => {
        if ("targetId" in c) return (c["targetId"] as { in: string[] }).in.includes(l.targetId);
        if ("changes" in c) {
          const f = c["changes"] as { path: string[]; equals: unknown };
          return l.changes !== null && l.changes[f.path[0] as string] === f.equals;
        }
        throw new Error(`condition inconnue : ${Object.keys(c).join(",")}`);
      });
    });
  };
}

const CRENEAU = "00000000-0000-4000-8000-0000000000c1";
const SIG_EMARGEMENT = "00000000-0000-4000-8000-0000000000c2";
const SIG_PIECE = "00000000-0000-4000-8000-0000000000c3";
const EVALUATION = "00000000-0000-4000-8000-0000000000c4";
const QUESTIONNAIRE = "00000000-0000-4000-8000-0000000000c5";
const RELEVE = "00000000-0000-4000-8000-0000000000c6";
const INCIDENT = "00000000-0000-4000-8000-0000000000c7";
const INCIDENT_SUPPRIME = "00000000-0000-4000-8000-0000000000c8";
const AUTRE_SESSION_CRENEAU = "00000000-0000-4000-8000-0000000000d1";

function ligne(
  minute: number,
  action: string,
  targetType: string,
  targetId: string,
  changes: Record<string, unknown> | null = null,
): LigneJournal {
  return {
    createdAt: new Date(REOUVERTURE.getTime() + minute * 60_000),
    action,
    targetType,
    targetId,
    changes,
    adminUser: { name: "Williams Jullin" },
  };
}

/** Les objets du dossier, tels que la base les rend (identifiants seulement). */
function objetsDuDossier(anonyme = false): void {
  const trainee = { deletedAt: anonyme ? new Date("2026-09-25T10:00:00Z") : null };
  const viaInscription = (id: string) => [{ id, enrollment: { trainee } }];
  h.reponses.set("enrollment.findMany", [{ id: ENROLLMENT, trainee }]);
  h.reponses.set("presenceCreneau.findMany", viaInscription(CRENEAU));
  h.reponses.set("evaluationAcquis.findMany", viaInscription(EVALUATION));
  h.reponses.set("releveConnexionImport.findMany", [{ id: RELEVE }]);
  h.reponses.set("incident.findMany", [{ id: INCIDENT }]);
  h.reponses.set("documentSignature.findMany", (a: { select: Record<string, unknown> }) =>
    "revokedAt" in a.select ? [] : [{ id: SIG_PIECE, documentGenere: { trainee } }],
  );
  // `emargementSignature` et `questionnaire` servent aussi aux sections
  // « Signatures révoquées » et « Origine des réponses » : on répond selon la
  // requête.
  const revoquees = h.reponses.get("emargementSignature.findMany") as (a: unknown) => unknown;
  h.reponses.set("emargementSignature.findMany", (a: { select: Record<string, unknown> }) =>
    "revokedAt" in a.select ? revoquees(a) : viaInscription(SIG_EMARGEMENT),
  );
  h.reponses.set("questionnaire.findMany", (a: { select: Record<string, unknown> }) =>
    "origineReponse" in a.select ? [] : viaInscription(QUESTIONNAIRE),
  );
}

describe("ADR 0060 — revue PR #1245 : TOUTES les actions de l'ouverture sont au dossier", () => {
  beforeEach(() => {
    // Le journal est lu jusqu'à « maintenant » : on se place après la scène.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-01T08:00:00Z"));
    jeuAxiSess2026001();
    objetsDuDossier();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("🔴 présence corrigée, émargement révoqué, questionnaire saisi, évaluation, relevé, incident (même supprimé), signature de pièce : tout apparaît", async () => {
    h.reponses.set(
      "activityLog.findMany",
      journalFiltrant([
        ligne(5, "qualiopi.presence.creneau.manual", "PresenceCreneau", CRENEAU, {
          present: false,
        }),
        ligne(6, "qualiopi.emargement.signature_revoquee", "EmargementSignature", SIG_EMARGEMENT, {
          motif: "Mauvais créneau",
        }),
        ligne(7, "qualiopi.satisfaction.saisir_reponses", "Questionnaire", QUESTIONNAIRE),
        ligne(8, "qualiopi.evaluation.create", "EvaluationAcquis", EVALUATION),
        ligne(9, "qualiopi.presence.releve.import", "ReleveConnexionImport", RELEVE),
        ligne(10, "qualiopi.incident.update", "Incident", INCIDENT),
        ligne(11, "qualiopi.incident.delete", "Incident", INCIDENT_SUPPRIME, {
          titre: "Retard",
          dossierSessionId: SESSION,
        }),
        ligne(12, "qualiopi.signature.revocation", "DocumentSignature", SIG_PIECE),
        // Témoin : une action d'une AUTRE session ne doit pas s'y glisser.
        ligne(13, "qualiopi.presence.creneau.manual", "PresenceCreneau", AUTRE_SESSION_CRENEAU),
      ]),
    );
    const { index } = await indexDuZip();
    expect(index).not.toContain("aucune au journal d'activité");
    expect(index).toContain("Actions menées pendant l'ouverture (8, journal d'activité)");
    for (const action of [
      "qualiopi.presence.creneau.manual — par Williams Jullin — PresenceCreneau 00000000",
      "qualiopi.emargement.signature_revoquee",
      "qualiopi.satisfaction.saisir_reponses",
      "qualiopi.evaluation.create",
      "qualiopi.presence.releve.import",
      "qualiopi.incident.update",
      "qualiopi.incident.delete",
      "qualiopi.signature.revocation",
    ]) {
      expect(index, action).toContain(action);
    }
    expect(index.match(/qualiopi\.presence\.creneau\.manual/g)).toHaveLength(1);
  });

  it("une action d'un stagiaire ANONYMISÉ reste au dossier, sans son détail libre (RGPD)", async () => {
    objetsDuDossier(true);
    h.reponses.set(
      "activityLog.findMany",
      journalFiltrant([
        ligne(5, "qualiopi.enrollment.retour_de_sortie", "Enrollment", ENROLLMENT, {
          avant: { sortieMotif: "Maladie" },
        }),
      ]),
    );
    const { index } = await indexDuZip();
    expect(index).toContain("qualiopi.enrollment.retour_de_sortie");
    expect(index).toContain("détail masqué : stagiaire anonymisé");
    expect(index).not.toContain("Maladie");
  });

  it("une écriture inscrite juste APRÈS le reverrouillage (garde hors transaction) est listée et signalée", async () => {
    const apres = (REVERROUILLAGE.getTime() - REOUVERTURE.getTime()) / 60_000 + 1;
    h.reponses.set(
      "activityLog.findMany",
      journalFiltrant([
        ligne(apres, "qualiopi.presence.creneau.manual", "PresenceCreneau", CRENEAU),
      ]),
    );
    const { index } = await indexDuZip();
    expect(index).toContain("qualiopi.presence.creneau.manual");
    expect(index).toContain("inscrite APRÈS le reverrouillage");
  });
});
