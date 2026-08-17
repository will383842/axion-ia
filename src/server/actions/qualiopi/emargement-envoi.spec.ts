/**
 * L'ENVOI du lien d'émargement — le maillon qui n'existait pas.
 *
 * 🔴 Ces tests portent le CÂBLAGE, pas une décision pure. C'est délibéré :
 * le défaut d'origine n'était pas une règle fausse, c'était un `enqueueEmail`
 * absent. Un test qui vérifie une fonction de décision bien écrite ne l'aurait
 * jamais vu — l'écran affichait un lien, la base contenait un jeton, tout avait
 * l'air correct. Seul « quelque chose part-il vraiment ? » attrape ce défaut-là.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ⚠️ La classe d'erreur simulée vit DANS `vi.hoisted` : les fabriques `vi.mock`
// sont remontées en tête de fichier, donc une classe déclarée plus bas n'existe
// pas encore quand elles s'exécutent (« Cannot access before initialization »).
const { mockSessionFind, mockEnqueue, mockCreerToken, mockLog, TokenEmargementErreurSimulee } =
  vi.hoisted(() => {
    class TokenEmargementErreurSimulee extends Error {
      readonly motif = "session_sans_jours";
      constructor(message: string) {
        super(message);
        this.name = "TokenEmargementError";
      }
    }
    return {
      mockSessionFind: vi.fn(),
      mockEnqueue: vi.fn(),
      mockCreerToken: vi.fn(),
      mockLog: vi.fn(),
      TokenEmargementErreurSimulee,
    };
  });

vi.mock("@/lib/prisma", () => ({
  prisma: { trainingSession: { findUnique: mockSessionFind } },
}));

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "admin", role: "super_admin" }),
  logQualiopiActivity: mockLog,
}));

vi.mock("@/server/queue/queues", () => ({ enqueueEmail: mockEnqueue }));

vi.mock("@/server/qualiopi/documents/qr", () => ({ qrDataUrl: vi.fn() }));

vi.mock("@/server/qualiopi/emargement/token-service", () => ({
  creerTokenInscription: mockCreerToken,
  revoquerTokensInscription: vi.fn(),
  TokenEmargementError: TokenEmargementErreurSimulee,
}));

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { envoyerLiensEmargementAction } from "./emargement-liens";

const SESSION_ID = "33333333-3333-4333-8333-333333333333";
const INSCRIPTION_A = "44444444-4444-4444-8444-444444444444";
const INSCRIPTION_B = "55555555-5555-4555-8555-555555555555";

function sessionAvecDeuxInscrits() {
  return {
    numero: "AXI-SESS-2026-005",
    titreSession: "IA pour la finance",
    dateDebut: new Date("2026-08-16T07:00:00Z"),
    dateFin: new Date("2026-08-16T15:00:00Z"),
    enrollments: [
      {
        id: INSCRIPTION_A,
        trainee: { email: "simone@example.invalid", nom: "Blanc", prenom: "Simone" },
      },
      {
        id: INSCRIPTION_B,
        trainee: { email: "marc@example.invalid", nom: "Durand", prenom: "Marc" },
      },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSessionFind.mockResolvedValue(sessionAvecDeuxInscrits());
  mockCreerToken.mockResolvedValue({
    token: "jeton-clair",
    tokenId: "t-1",
    expiresAt: new Date("2026-08-18T15:00:00Z"),
  });
  mockEnqueue.mockResolvedValue(undefined);
  mockLog.mockResolvedValue(undefined);
});

describe("🔴 le lien PART — c'est tout le défaut", () => {
  it("un e-mail par stagiaire actif", async () => {
    const r = await envoyerLiensEmargementAction({ sessionId: SESSION_ID });
    expect("data" in r, `échec : ${JSON.stringify(r)}`).toBe(true);
    expect(mockEnqueue, "aucun e-mail n'a été enfilé").toHaveBeenCalledTimes(2);
    if ("data" in r) expect(r.data.envoyes).toBe(2);
  });

  it("🔴 avec le gabarit DÉDIÉ, jamais un gabarit d'emprunt", async () => {
    // Le 15/08, le positionnement partait via `qualiopi-portail-acces` — un
    // message qui disait « vous pouvez ignorer cet email » à quelqu'un qui
    // n'avait rien demandé. Un gabarit hors de sa finalité ment.
    await envoyerLiensEmargementAction({ sessionId: SESSION_ID });
    expect(mockEnqueue.mock.calls[0]?.[0]).toBe("qualiopi-emargement-lien");
  });

  it("le lien envoyé est le lien PERSONNEL du portail", async () => {
    await envoyerLiensEmargementAction({ sessionId: SESSION_ID });
    const payload = mockEnqueue.mock.calls[0]?.[3] as Record<string, unknown>;
    expect(payload["lienEmargement"]).toContain("/fr/portail/emarger/jeton-clair");
  });

  it("le message nomme la formation et sa date — sinon il ne veut rien dire", async () => {
    await envoyerLiensEmargementAction({ sessionId: SESSION_ID });
    const payload = mockEnqueue.mock.calls[0]?.[3] as Record<string, unknown>;
    expect(payload["titreFormation"]).toBe("IA pour la finance");
    expect(payload["numeroSession"]).toBe("AXI-SESS-2026-005");
    expect(String(payload["dateDebutFormation"])).toContain("2026");
  });

  it("l'e-mail va bien à l'adresse du stagiaire visé", async () => {
    await envoyerLiensEmargementAction({ sessionId: SESSION_ID });
    expect(mockEnqueue.mock.calls[0]?.[1]).toBe("simone@example.invalid");
    expect(mockEnqueue.mock.calls[1]?.[1]).toBe("marc@example.invalid");
  });

  it("🔴 le jobId est HORODATÉ — sans quoi un renvoi serait silencieusement ignoré", async () => {
    // Le cas d'usage principal EST le renvoi : un stagiaire qui a perdu son
    // lien. Un jobId stable ferait dédoublonner BullMQ, l'admin verrait
    // « envoyé » et rien ne partirait.
    await envoyerLiensEmargementAction({ sessionId: SESSION_ID });
    const opts = mockEnqueue.mock.calls[0]?.[4] as { jobId: string };
    expect(opts.jobId).toMatch(new RegExp(`^qualiopi-emargement-lien-${INSCRIPTION_A}-\\d+$`));
  });
});

describe("cibler un seul stagiaire", () => {
  it("n'envoie qu'à lui", async () => {
    mockSessionFind.mockResolvedValue({
      ...sessionAvecDeuxInscrits(),
      enrollments: [sessionAvecDeuxInscrits().enrollments[0]!],
    });
    await envoyerLiensEmargementAction({ sessionId: SESSION_ID, enrollmentId: INSCRIPTION_A });
    expect(mockEnqueue).toHaveBeenCalledTimes(1);
    // Le filtrage se fait en base, pas en mémoire : on vérifie le `where`.
    const where = mockSessionFind.mock.calls[0]?.[0] as {
      select: { enrollments: { where: Record<string, unknown> } };
    };
    expect(where.select.enrollments.where["id"]).toBe(INSCRIPTION_A);
  });

  it("sans cible, aucun filtre d'inscription n'est posé", async () => {
    await envoyerLiensEmargementAction({ sessionId: SESSION_ID });
    const where = mockSessionFind.mock.calls[0]?.[0] as {
      select: { enrollments: { where: Record<string, unknown> } };
    };
    expect(where.select.enrollments.where["id"]).toBeUndefined();
  });
});

describe("🔴 les refus NOMMENT qui n'a rien reçu", () => {
  it("un échec partiel rend le nom du stagiaire, pas « une erreur est survenue »", async () => {
    // Sur une pièce probante, savoir QUE ça a échoué sans savoir POUR QUI est
    // le pire silence possible : l'admin ne peut ni rattraper ni consigner.
    mockCreerToken
      .mockResolvedValueOnce({ token: "ok", tokenId: "t", expiresAt: new Date() })
      .mockRejectedValueOnce(
        new TokenEmargementErreurSimulee("Déclarez les journées de la session avant d'émettre."),
      );

    const r = await envoyerLiensEmargementAction({ sessionId: SESSION_ID });
    expect("data" in r).toBe(true);
    if (!("data" in r)) return;
    expect(r.data.envoyes).toBe(1);
    expect(r.data.echecs).toEqual([
      {
        stagiaireNom: "Marc Durand",
        motif: "Déclarez les journées de la session avant d'émettre.",
      },
    ]);
  });

  it("🔴 aucune journée déclarée : le refus REPREND le message actionnable du service", async () => {
    // C'est le cas nominal du dossier réel AXI-SESS-2026-005 : les liens
    // partaient sur une session sans créneaux, et le stagiaire voyait
    // « Aucune demi-journée à signer ».
    mockCreerToken.mockRejectedValue(
      new TokenEmargementErreurSimulee("Déclarez les journées réellement animées."),
    );
    const r = await envoyerLiensEmargementAction({ sessionId: SESSION_ID });
    expect("error" in r).toBe(true);
    if (!("error" in r)) return;
    expect(r.error).toBe("Déclarez les journées réellement animées.");
    expect(mockEnqueue, "un e-mail est parti malgré l'échec d'émission").not.toHaveBeenCalled();
  });

  it("session introuvable", async () => {
    mockSessionFind.mockResolvedValue(null);
    expect(await envoyerLiensEmargementAction({ sessionId: SESSION_ID })).toEqual({
      error: "Session introuvable",
    });
  });

  it("aucun inscrit actif — et le message le DIT autrement selon la cible", async () => {
    mockSessionFind.mockResolvedValue({ ...sessionAvecDeuxInscrits(), enrollments: [] });
    const tous = await envoyerLiensEmargementAction({ sessionId: SESSION_ID });
    const un = await envoyerLiensEmargementAction({
      sessionId: SESSION_ID,
      enrollmentId: INSCRIPTION_A,
    });
    expect(tous).toEqual({ error: "Aucun stagiaire actif inscrit à cette session." });
    expect(un).toEqual({ error: "Ce stagiaire n'est plus inscrit à cette session." });
  });

  it("refuse un identifiant qui n'est pas un UUID", async () => {
    expect(await envoyerLiensEmargementAction({ sessionId: "pas-un-uuid" })).toEqual({
      error: "Données invalides",
    });
    expect(mockEnqueue).not.toHaveBeenCalled();
  });
});

describe("la trace", () => {
  it("l'envoi est journalisé avec son compte et sa cible", async () => {
    await envoyerLiensEmargementAction({ sessionId: SESSION_ID });
    const arg = mockLog.mock.calls[0]?.[0] as { action: string; changes: Record<string, unknown> };
    expect(arg.action).toBe("qualiopi.emargement.liens.envoyer");
    expect(arg.changes["envoyes"]).toBe(2);
    expect(arg.changes["cible"]).toBe("tous");
  });
});
