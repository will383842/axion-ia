/**
 * Tests — rattachement d'un devis à une session (constat F8).
 *
 * 🔴 Le devis et la session ne pouvaient PAS être reliés. La colonne
 * `training_sessions.devis_id` existait et `createSessionAction` savait
 * l'écrire, mais AUCUN écran ne permettait de choisir le devis : le lien était
 * inatteignable en pratique.
 *
 * Et depuis F7, c'était bloquant — « Transformer en convention » EXIGE une
 * session rattachée, donc le bouton refusait systématiquement. Les deux
 * correctifs se bloquaient l'un l'autre.
 *
 * Ce que ces tests verrouillent, c'est la garde SERVEUR. Le formulaire filtre
 * déjà les devis par client, mais une garde d'interface ne protège que les
 * usages ordinaires : une Server Action est appelable directement. Un devis
 * appartenant à un AUTRE client produirait une convention portant le prix et
 * les conditions d'un tiers — sur une pièce contractuelle.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDevisFindUnique = vi.fn();
const mockFormationFindUnique = vi.fn();
const mockSessionCreate = vi.fn();
const mockSessionCount = vi.fn();
const mockSessionFindMany = vi.fn();

vi.mock("@/lib/prisma", () => {
  const prismaMock: Record<string, unknown> = {
    devis: { findUnique: (...a: unknown[]) => mockDevisFindUnique(...a) },
    formation: { findUnique: (...a: unknown[]) => mockFormationFindUnique(...a) },
    trainingSession: {
      create: (...a: unknown[]) => mockSessionCreate(...a),
      count: (...a: unknown[]) => mockSessionCount(...a),
      findMany: (...a: unknown[]) => mockSessionFindMany(...a),
    },
    // Écrits par la transaction de création : journées déclarées et transition
    // d'état. Sans eux, le `catch` générique masque la vraie cause.
    sessionJour: { createMany: vi.fn().mockResolvedValue({ count: 0 }) },
    sessionTransition: { create: vi.fn().mockResolvedValue({ id: "tr-1" }) },
    // L'allocation tourne DANS une transaction (`withNumberRetry`) : le mock
    // rejoue la closure avec le client lui-même, comme le fait Prisma.
  };
  prismaMock["$transaction"] = async (fn: unknown) =>
    typeof fn === "function" ? (fn as (tx: unknown) => unknown)(prismaMock) : fn;
  return { prisma: prismaMock };
});

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "admin-1", role: "super_admin" }),
  logQualiopiActivity: vi.fn().mockResolvedValue(undefined),
}));

import { createSessionAction } from "./sessions";

const CLIENT_A = "11111111-1111-4111-8111-111111111111";
const CLIENT_B = "22222222-2222-4222-8222-222222222222";
const DEVIS_ID = "33333333-3333-4333-8333-333333333333";
const FORMATION_ID = "44444444-4444-4444-8444-444444444444";

function entree(over: Record<string, unknown> = {}) {
  return {
    formationId: FORMATION_ID,
    dateDebut: new Date("2026-09-01T09:00:00Z"),
    dateFin: new Date("2026-09-01T17:00:00Z"),
    modalite: "presentiel" as const,
    nbParticipantsPrevus: 5,
    montantHtCents: 200_000,
    clientId: CLIENT_A,
    devisId: DEVIS_ID,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFormationFindUnique.mockResolvedValue({
    id: FORMATION_ID,
    titre: "IA pour bien commencer",
    numero: "AXI-FORM-2026-037",
    dureeHeures: 4,
    objectifsPedagogiques: ["Comprendre"],
    statut: "actif",
    // La garde de publication passe AVANT celle du devis : sans ce champ, tous
    // les tests seraient recalés en amont et ne verraient jamais la garde visée.
    statutGeneration: "publie",
  });
  mockDevisFindUnique.mockResolvedValue({
    id: DEVIS_ID,
    clientId: CLIENT_A,
    statut: "accepte",
  });
  mockSessionCount.mockResolvedValue(0);
  // Aucun numéro existant → la série démarre à 001 (allocateur MAX+1, L7).
  mockSessionFindMany.mockResolvedValue([]);
  mockSessionCreate.mockResolvedValue({ id: "sess-1", numero: "AXI-SESS-2026-003" });
});

describe("createSessionAction — garde sur le devis rattaché", () => {
  // Ces tests portent sur la GARDE, pas sur le pipeline de création complet —
  // celui-ci a sa propre couverture. On assère donc que la garde LAISSE PASSER,
  // pas que la transaction aboutit : mocker tout l'arbre d'écriture ferait un
  // test qui casse à chaque évolution du schéma sans rien prouver de plus.
  it("laisse passer un devis accepté appartenant au client de la session", async () => {
    const r = await createSessionAction(entree());
    expect(mockDevisFindUnique).toHaveBeenCalledWith({
      where: { id: DEVIS_ID },
      select: { id: true, clientId: true, statut: true },
    });
    if ("error" in r) {
      expect(r.error).not.toContain("autre client");
      expect(r.error).not.toContain("introuvable");
      expect(r.error).not.toContain("Seul un devis accepté");
    }
  });

  // 🔴 Le cas qui compte : la convention porterait le prix d'un tiers.
  it("refuse un devis appartenant à un AUTRE client", async () => {
    mockDevisFindUnique.mockResolvedValue({
      id: DEVIS_ID,
      clientId: CLIENT_B,
      statut: "accepte",
    });
    const r = await createSessionAction(entree());
    expect("error" in r).toBe(true);
    if ("error" in r) expect(r.error).toContain("autre client");
    expect(mockSessionCreate).not.toHaveBeenCalled();
  });

  // La FK est `SetNull` : un id périmé ne lèverait pas, le lien disparaîtrait
  // silencieusement. Échouer franchement vaut mieux qu'un rattachement fantôme.
  it("refuse un devis inexistant plutôt que de perdre le lien en silence", async () => {
    mockDevisFindUnique.mockResolvedValue(null);
    const r = await createSessionAction(entree());
    expect("error" in r).toBe(true);
    if ("error" in r) expect(r.error).toContain("introuvable");
    expect(mockSessionCreate).not.toHaveBeenCalled();
  });

  it("refuse un devis non accepté — brouillon, envoyé ou refusé", async () => {
    for (const statut of ["brouillon", "envoye", "refuse", "expire"]) {
      mockSessionCreate.mockClear();
      mockDevisFindUnique.mockResolvedValue({ id: DEVIS_ID, clientId: CLIENT_A, statut });
      const r = await createSessionAction(entree());
      expect("error" in r, `statut ${statut} devrait être refusé`).toBe(true);
      expect(mockSessionCreate).not.toHaveBeenCalled();
    }
  });

  // Idempotence : recréer la session après une erreur ne doit pas être bloqué
  // par le fait que le devis a déjà servi.
  it("tolère un devis déjà transformé en convention", async () => {
    mockDevisFindUnique.mockResolvedValue({
      id: DEVIS_ID,
      clientId: CLIENT_A,
      statut: "transforme_convention",
    });
    const r = await createSessionAction(entree());
    if ("error" in r) expect(r.error).not.toContain("Seul un devis accepté");
  });

  // Un devis sans client de session n'a rien à quoi se comparer.
  it("refuse un devis quand aucun client n'est renseigné sur la session", async () => {
    const r = await createSessionAction(entree({ clientId: undefined }));
    expect("error" in r).toBe(true);
    expect(mockSessionCreate).not.toHaveBeenCalled();
  });

  it("n'interroge même pas le devis quand aucun n'est rattaché", async () => {
    await createSessionAction(entree({ devisId: undefined }));
    expect(mockDevisFindUnique).not.toHaveBeenCalled();
  });

  // Le devis est lu AVANT toute écriture : une garde qui s'exécuterait après la
  // création laisserait une session orpheline derrière elle en cas de refus.
  it("contrôle le devis avant d'écrire quoi que ce soit", async () => {
    mockDevisFindUnique.mockResolvedValue({
      id: DEVIS_ID,
      clientId: CLIENT_B,
      statut: "accepte",
    });
    await createSessionAction(entree());
    expect(mockDevisFindUnique).toHaveBeenCalled();
    expect(mockSessionCreate).not.toHaveBeenCalled();
  });
});
