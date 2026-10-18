/**
 * Chantier QNC, L04 — l'action du portail et l'interrupteur
 * `qualiopi.adaptation.actif`.
 *
 * Verrouille :
 *   · ÉTEINT = INCHANGÉ : le circuit de toujours (alerte du geste), et les
 *     champs de la déclaration structurée ne sont jamais écrits ;
 *   · allumé : la précision devient OBLIGATOIRE, et la réponse écrite ne porte
 *     que le consentement et le choix — jamais le type, les mesures, le
 *     commentaire ;
 *   · après la formation, la question d'utilité est exigée quand elle est due,
 *     et un « non » ouvre l'examen.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/qualiopi/sessions/verrou-dossier-garde", () => ({
  assertDossierOuvert: async () => ({ ok: true, sessionId: null }),
  assertDossierOuvertSiRegeneration: async () => ({ ok: true, sessionId: null }),
}));

const questionnaireFindUnique = vi.fn();
const traineeFindUnique = vi.fn();
const creerOuDedup = vi.fn(async (_a: unknown) => null);
const soumettreReponses = vi.fn(async (_a: unknown) => ({ id: "q1" }));
const adaptationAuto = vi.fn(async (_id: string) => false);
const utiliteDue = vi.fn(async (_id: string) => false);
const traiter = vi.fn(async (_a: unknown) => ({
  precisionChiffree: true,
  consignee: true,
  alerte: false,
}));
const signalerNonUtiles = vi.fn(async (_id: string, _d: Date) => undefined);

vi.mock("@/lib/prisma", () => ({
  prisma: {
    questionnaire: { findUnique: (a: unknown) => questionnaireFindUnique(a) },
    trainee: { findUnique: (a: unknown) => traineeFindUnique(a), update: vi.fn() },
    activityLog: { create: vi.fn() },
  },
}));
vi.mock("@/lib/telegram", () => ({ sendTelegram: vi.fn(async () => true) }));
vi.mock("@/server/qualiopi/alertes/alertes-service", () => ({
  creerOuDedup: (a: unknown) => creerOuDedup(a),
}));
vi.mock("@/server/qualiopi/adaptation/journal-declaration", () => ({
  journaliserDeclarationBesoin: vi.fn(async () => true),
}));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn(),
  requireSuperAdmin: vi.fn(),
  logQualiopiActivity: vi.fn(),
}));
vi.mock("@/server/qualiopi/portail/cookie", () => ({
  getPortailToken: async () => "jeton",
  setPortailCookie: vi.fn(),
  clearPortailCookie: vi.fn(),
}));
vi.mock("@/server/qualiopi/portail/portail-service", () => ({
  verifierToken: async () => ({ traineeId: "t1" }),
  creerAcces: vi.fn(),
  revoquerAcces: vi.fn(),
  demanderAccesParEmail: vi.fn(),
}));
vi.mock("@/server/qualiopi/portail/rgpd-service", () => ({ creerDemandeRgpd: vi.fn() }));
vi.mock("@/server/qualiopi/satisfaction/satisfaction-service", () => ({
  soumettreReponses: (a: unknown) => soumettreReponses(a),
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true, count: 1, remaining: 4 })),
}));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Map()) }));
vi.mock("@/lib/pii-crypto", () => ({
  encryptPii: (v: string) => `enc:${v}`,
  decryptPii: (v: string | null) => v,
  isEncryptedPii: (v: unknown) => typeof v === "string" && v.startsWith("enc:"),
  PII_DECRYPT_PLACEHOLDER: "[encrypted — key missing]",
}));
vi.mock("@/server/qualiopi/adaptation/automatique/portee", () => ({
  adaptationAutomatiquePourInscription: (id: string) => adaptationAuto(id),
}));
vi.mock("@/server/qualiopi/adaptation/automatique/traiter-declaration", () => ({
  traiterDeclarationAutomatique: (a: unknown) => traiter(a),
}));
vi.mock("@/server/qualiopi/adaptation/automatique/utilite", async () => {
  const pur = await vi.importActual<object>(
    "@/server/qualiopi/adaptation/automatique/utilite-question",
  );
  return {
    ...pur,
    questionUtiliteDuePourInscription: (id: string) => utiliteDue(id),
    signalerAmenagementsNonUtiles: (id: string, d: Date) => signalerNonUtiles(id, d),
  };
});

import { soumettreSatisfactionPortailAction } from "./portail";

const QID = "11111111-2222-4333-8444-555555555555";
const DECLARATION = {
  adaptationTypes: ["auditif"],
  adaptationMesures: ["sous_titrage"],
  adaptationCommentaire: "Je lis sur les lèvres.",
  adaptationConsentement: true,
  adaptationChoix: "confirme",
};

function positionnement(extra: Record<string, unknown>) {
  return soumettreSatisfactionPortailAction({
    questionnaireId: QID,
    reponses: { besoinAdaptation: true, besoinAdaptationRepondu: true, attentes: "a", ...extra },
  });
}

function reponsesEcrites(): Record<string, unknown> {
  return (soumettreReponses.mock.calls[0]?.[0] as { reponses: Record<string, unknown> }).reponses;
}

beforeEach(() => {
  vi.clearAllMocks();
  questionnaireFindUnique.mockResolvedValue({
    type: "positionnement",
    enrollment: { id: "e1", traineeId: "t1" },
  });
  traineeFindUnique.mockResolvedValue({ id: "t1", prenom: "Camille", nom: "Martin" });
});

describe("positionnement — interrupteur ÉTEINT : inchangé", () => {
  it("circuit de toujours, et la déclaration structurée n'est jamais écrite", async () => {
    const r = await positionnement(DECLARATION);
    expect(r).toEqual({ data: { id: "q1" } });
    expect(traiter).not.toHaveBeenCalled();
    expect(creerOuDedup).toHaveBeenCalledWith(
      expect.objectContaining({ code: "besoin_adaptation_declare" }),
    );
    expect(reponsesEcrites()).toEqual({ besoinAdaptation: true, attentes: "a" });
  });
});

describe("positionnement — interrupteur ALLUMÉ", () => {
  beforeEach(() => adaptationAuto.mockResolvedValue(true));

  it("la précision est obligatoire : sans type, rien n'est enregistré", async () => {
    const r = await positionnement({ adaptationConsentement: true, adaptationChoix: "confirme" });
    expect(r).toHaveProperty("error");
    expect(soumettreReponses).not.toHaveBeenCalled();
  });

  it("la réponse écrite ne porte que le consentement et le choix ; le reste part au traitement", async () => {
    const r = await positionnement(DECLARATION);
    expect(r).toEqual({ data: { id: "q1" } });
    expect(reponsesEcrites()).toEqual({
      besoinAdaptation: true,
      attentes: "a",
      consentementPrecisionAdaptation: true,
      choixAdaptation: "confirme",
    });
    expect(JSON.stringify(reponsesEcrites())).not.toContain("auditif");
    expect(traiter).toHaveBeenCalledWith(
      expect.objectContaining({
        enrollmentId: "e1",
        declaration: expect.objectContaining({ types: ["auditif"], casComplexe: false }),
      }),
    );
    // Cas standard : l'ancienne alerte du geste ne part plus.
    expect(creerOuDedup).not.toHaveBeenCalled();
  });

  it("un client ne forge pas les clés du serveur", async () => {
    await positionnement({
      ...DECLARATION,
      consentementPrecisionAdaptation: true,
      choixAdaptation: "echange",
      adaptationConsentement: false,
      adaptationChoix: "echange",
    });
    expect(reponsesEcrites()).toMatchObject({
      consentementPrecisionAdaptation: false,
      choixAdaptation: "echange",
    });
  });

  it("aucun besoin déclaré : rien à traiter", async () => {
    await soumettreSatisfactionPortailAction({
      questionnaireId: QID,
      reponses: { besoinAdaptation: false, besoinAdaptationRepondu: true },
    });
    expect(traiter).not.toHaveBeenCalled();
    expect(reponsesEcrites()).toEqual({ besoinAdaptation: false });
  });
});

describe("satisfaction à chaud — « les aménagements vous ont-ils été utiles ? »", () => {
  beforeEach(() => {
    questionnaireFindUnique.mockResolvedValue({
      type: "satisfaction_chaud",
      enrollment: { id: "e1", traineeId: "t1" },
    });
  });

  it("question non due : la clé est retirée, rien ne s'ouvre", async () => {
    await soumettreSatisfactionPortailAction({
      questionnaireId: QID,
      reponses: { amenagementsUtiles: false },
      noteGlobale: 4,
    });
    expect(reponsesEcrites()).toEqual({});
    expect(signalerNonUtiles).not.toHaveBeenCalled();
  });

  it("question due : la réponse est exigée, et un « non » ouvre l'examen", async () => {
    utiliteDue.mockResolvedValue(true);
    const sans = await soumettreSatisfactionPortailAction({
      questionnaireId: QID,
      reponses: {},
      noteGlobale: 4,
    });
    expect(sans).toHaveProperty("error");

    await soumettreSatisfactionPortailAction({
      questionnaireId: QID,
      reponses: { amenagementsUtiles: false },
      noteGlobale: 4,
    });
    expect(reponsesEcrites()).toEqual({ amenagementsUtiles: false });
    expect(signalerNonUtiles).toHaveBeenCalledWith("e1", expect.any(Date));
  });
});

describe("satisfaction à chaud v2 (L08) — L04 et L08 allumés", () => {
  beforeEach(() => {
    adaptationAuto.mockResolvedValue(true);
    utiliteDue.mockResolvedValue(true);
    questionnaireFindUnique.mockResolvedValue({
      type: "satisfaction_chaud",
      version: { version: 2 },
      enrollment: { id: "e1", traineeId: "t1" },
    });
  });

  it("un stagiaire ayant déclaré un aménagement envoie son questionnaire v2, et la clé survit à l'assainissement", async () => {
    const r = await soumettreSatisfactionPortailAction({
      questionnaireId: QID,
      reponses: {
        commentaire: "Très clair",
        acquisParObjectif: { "Rédiger un prompt": 3 },
        amenagementsUtiles: true,
        // Hors contenu v2 : retiré par `assainirReponses`.
        champInconnu: "x",
      },
      noteGlobale: 5,
    });
    expect(r).toEqual({ data: { id: "q1" } });
    expect(reponsesEcrites()).toEqual({
      commentaire: "Très clair",
      acquisParObjectif: { "Rédiger un prompt": 3 },
      amenagementsUtiles: true,
    });
    expect(signalerNonUtiles).not.toHaveBeenCalled();
  });

  it("v2 : la réponse est exigée comme en v1, et un « non » ouvre l'examen", async () => {
    const sans = await soumettreSatisfactionPortailAction({
      questionnaireId: QID,
      reponses: { commentaire: "ok" },
      noteGlobale: 4,
    });
    expect(sans).toHaveProperty("error");
    expect(soumettreReponses).not.toHaveBeenCalled();

    await soumettreSatisfactionPortailAction({
      questionnaireId: QID,
      reponses: { amenagementsUtiles: false },
      noteGlobale: 4,
    });
    expect(reponsesEcrites()).toEqual({ amenagementsUtiles: false });
    expect(signalerNonUtiles).toHaveBeenCalledWith("e1", expect.any(Date));
  });
});
