/**
 * Chantier QNC, L04 — ce que devient une déclaration structurée.
 *
 * Verrouille : un cas standard se consigne SEUL, sans alerte ; un cas complexe
 * lève l'alerte du référent ; la donnée de santé (type, mesure complexe,
 * commentaire) ne sort que chiffrée vers la fiche stagiaire — ni dans
 * l'alerte, ni dans la réponse consignée, ni dans le journal.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const enrollmentFindUnique = vi.fn();
const enrollmentUpdate = vi.fn((a: unknown) => a);
const traineeUpdate = vi.fn(async (_a: unknown) => ({ id: "t1" }));
const activityCreate = vi.fn((a: unknown) => a);
const transaction = vi.fn(async (ops: unknown[]) => ops);
const creerOuDedup = vi.fn(async (_a: unknown) => null);
const journaliserDeclarationBesoin = vi.fn(async (_a: unknown) => true);
const sendTelegram = vi.fn(async (_a: unknown) => true);

vi.mock("@/lib/prisma", () => ({
  prisma: {
    enrollment: {
      findUnique: (a: unknown) => enrollmentFindUnique(a),
      update: (a: unknown) => enrollmentUpdate(a),
    },
    trainee: { update: (a: unknown) => traineeUpdate(a) },
    activityLog: { create: (a: unknown) => activityCreate(a) },
    $transaction: (ops: unknown[]) => transaction(ops),
  },
}));
vi.mock("@/lib/telegram", () => ({ sendTelegram: (a: unknown) => sendTelegram(a) }));
vi.mock("@/server/qualiopi/alertes/alertes-service", () => ({
  creerOuDedup: (a: unknown) => creerOuDedup(a),
}));
vi.mock("../journal-declaration", () => ({
  journaliserDeclarationBesoin: (a: unknown) => journaliserDeclarationBesoin(a),
}));
vi.mock("@sentry/nextjs", () => ({ captureMessage: vi.fn() }));
vi.mock("@/lib/pii-crypto", () => ({
  encryptPii: (v: string) => `enc:v1:${Buffer.from(v).toString("base64")}`,
  isEncryptedPii: (v: unknown) => typeof v === "string" && v.startsWith("enc:v1:"),
}));

import { CHAMPS_DECLARATION, TYPES_BESOIN, lireDeclaration } from "./catalogue-mesures";
import { CODE_ALERTE_CAS_COMPLEXE } from "./alertes-adaptation";
import { traiterDeclarationAutomatique } from "./traiter-declaration";

const DECLARE_LE = new Date("2026-11-02T09:00:00Z");

function declaration(v: {
  types?: string[];
  mesures?: string[];
  commentaire?: string;
  consentement: boolean;
  choix: string;
}) {
  const r = lireDeclaration({
    [CHAMPS_DECLARATION.types]: v.types,
    [CHAMPS_DECLARATION.mesures]: v.mesures,
    [CHAMPS_DECLARATION.commentaire]: v.commentaire,
    [CHAMPS_DECLARATION.consentement]: v.consentement,
    [CHAMPS_DECLARATION.choix]: v.choix,
  });
  if (!r.ok) throw new Error(r.erreur);
  return r.declaration;
}

/** Tout ce qui est écrit EN CLAIR : réponse consignée, journaux, alerte. */
function ecritEnClair(): string {
  return JSON.stringify([
    enrollmentUpdate.mock.calls,
    activityCreate.mock.calls,
    creerOuDedup.mock.calls,
    sendTelegram.mock.calls,
    journaliserDeclarationBesoin.mock.calls,
  ]);
}

beforeEach(() => {
  vi.clearAllMocks();
  enrollmentFindUnique.mockResolvedValue({
    id: "e1",
    adaptationsRealisees: null,
    trainee: { id: "t1", prenom: "Camille", nom: "Martin" },
    session: {
      numero: "AXI-S-2026-010",
      titreSession: "IA générative",
      dateDebut: new Date("2026-11-20T08:00:00Z"),
      dateFin: new Date("2026-11-21T17:00:00Z"),
      statut: "planifiee",
    },
  });
});

describe("traiterDeclarationAutomatique", () => {
  it("cas STANDARD confirmé : consigné seul, aucune alerte, aucun appel", async () => {
    const r = await traiterDeclarationAutomatique({
      enrollmentId: "e1",
      declaration: declaration({
        types: ["visuel"],
        mesures: ["supports_agrandis", "place_proche"],
        consentement: true,
        choix: "confirme",
      }),
      declareLe: DECLARE_LE,
    });
    expect(r).toEqual({ precisionChiffree: true, consignee: true, alerte: false });
    expect(creerOuDedup).not.toHaveBeenCalled();
    expect(sendTelegram).not.toHaveBeenCalled();
    const ecrit = enrollmentUpdate.mock.calls[0]?.[0] as {
      data: { adaptationsRealisees: string };
    };
    expect(ecrit.data.adaptationsRealisees).toContain("Supports en grands caractères");
    // La consignation est journalisée APRÈS la déclaration (ind. 10).
    const journal = activityCreate.mock.calls
      .map((c) => c[0] as { data: { action: string; createdAt: Date } })
      .find((c) => c.data.action === "qualiopi.enrollment.adaptations");
    expect(journal?.data.createdAt.getTime()).toBeGreaterThan(DECLARE_LE.getTime());
  });

  it("cas COMPLEXE (interprète LSF) : alerte au référent, la part standard est consignée", async () => {
    const r = await traiterDeclarationAutomatique({
      enrollmentId: "e1",
      declaration: declaration({
        types: ["auditif"],
        mesures: ["sous_titrage", "interprete_lsf"],
        commentaire: "Je lis sur les lèvres.",
        consentement: true,
        choix: "confirme",
      }),
      declareLe: DECLARE_LE,
    });
    expect(r.alerte).toBe(true);
    expect(creerOuDedup).toHaveBeenCalledWith(
      expect.objectContaining({
        code: CODE_ALERTE_CAS_COMPLEXE,
        cibleType: "Enrollment",
        cibleId: "e1",
      }),
    );
    const ecrit = enrollmentUpdate.mock.calls[0]?.[0] as {
      data: { adaptationsRealisees: string };
    };
    expect(ecrit.data.adaptationsRealisees).toContain("Sous-titrage");
    expect(ecrit.data.adaptationsRealisees).not.toContain("Interprète");
  });

  it("demande d'échange : alerte, rien de consigné", async () => {
    const r = await traiterDeclarationAutomatique({
      enrollmentId: "e1",
      declaration: declaration({
        types: ["dys"],
        mesures: ["pauses"],
        consentement: true,
        choix: "echange",
      }),
      declareLe: DECLARE_LE,
    });
    expect(r).toMatchObject({ consignee: false, alerte: true });
    expect(enrollmentUpdate).not.toHaveBeenCalled();
  });

  it("sans consentement : AUCUNE précision écrite, le référent est alerté", async () => {
    const r = await traiterDeclarationAutomatique({
      enrollmentId: "e1",
      declaration: declaration({ consentement: false, choix: "echange" }),
      declareLe: DECLARE_LE,
    });
    expect(r.precisionChiffree).toBe(false);
    expect(traineeUpdate).not.toHaveBeenCalled();
    expect(creerOuDedup).toHaveBeenCalledOnce();
    const consentement = activityCreate.mock.calls
      .map((c) => c[0] as { data: { action: string; changes: { donne: boolean } } })
      .find((c) => c.data.action === "qualiopi.trainee.consentement_precision_adaptation");
    expect(consentement?.data.changes.donne).toBe(false);
  });

  it("🔴 donnée de santé invisible hors référent : seule la fiche chiffrée la porte", async () => {
    await traiterDeclarationAutomatique({
      enrollmentId: "e1",
      declaration: declaration({
        types: ["auditif", "psychique"],
        mesures: ["sous_titrage", "interprete_lsf", "materiel_specifique"],
        commentaire: "Appareillage auditif depuis 2019.",
        consentement: true,
        choix: "confirme",
      }),
      declareLe: DECLARE_LE,
    });
    const clair = ecritEnClair();
    for (const t of TYPES_BESOIN) expect(clair).not.toContain(t.libelle);
    expect(clair).not.toContain("Appareillage");
    expect(clair).not.toContain("langue des signes");
    expect(clair).not.toContain("boucle magnétique");

    // La fiche reçoit un CHIFFRÉ, jamais le clair.
    const fiche = traineeUpdate.mock.calls[0]?.[0] as {
      data: { handicapDetailsChiffre: string };
    };
    expect(fiche.data.handicapDetailsChiffre.startsWith("enc:v1:")).toBe(true);
    expect(fiche.data.handicapDetailsChiffre).not.toContain("Auditif");
    expect(Buffer.from(fiche.data.handicapDetailsChiffre.slice(7), "base64").toString()).toContain(
      "Auditif",
    );
  });

  it("une réponse déjà consignée par le référent n'est pas effacée", async () => {
    enrollmentFindUnique.mockResolvedValueOnce({
      id: "e1",
      adaptationsRealisees: "Place réservée au premier rang.",
      trainee: { id: "t1", prenom: "Camille", nom: "Martin" },
      session: {
        numero: "AXI-S-2026-010",
        titreSession: "IA générative",
        dateDebut: new Date("2026-11-20T08:00:00Z"),
        dateFin: new Date("2026-11-21T17:00:00Z"),
        statut: "planifiee",
      },
    });
    await traiterDeclarationAutomatique({
      enrollmentId: "e1",
      declaration: declaration({
        types: ["dys"],
        mesures: ["pauses"],
        consentement: true,
        choix: "confirme",
      }),
      declareLe: DECLARE_LE,
    });
    const ecrit = enrollmentUpdate.mock.calls[0]?.[0] as {
      data: { adaptationsRealisees: string };
    };
    expect(ecrit.data.adaptationsRealisees.startsWith("Place réservée au premier rang.")).toBe(
      true,
    );
    expect(ecrit.data.adaptationsRealisees).toContain("Pauses supplémentaires");
  });
});
