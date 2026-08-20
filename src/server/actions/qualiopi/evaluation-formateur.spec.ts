/**
 * `D4-1-C` — l'évaluation des acquis, acte propre du formateur, n'existait nulle
 * part sur ses écrans.
 *
 * Le moteur était complet ; la seule porte exigeait une session **admin**, et le
 * formateur s'authentifie autrement. Une fois de plus : l'outil est écrit, le
 * câblage manque.
 *
 * 🔑 Ce que ces tests gardent avant tout, ce sont les DEUX contrôles
 * d'habilitation — et le second est celui qu'on oublie : vérifier que le
 * formateur intervient sur la session ne dit RIEN sur le fait que l'inscription
 * lui appartienne.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const requireFormateurAction = vi.fn();
const estMembreDeSession = vi.fn();
const createEvaluation = vi.fn();
const enrollmentFindUnique = vi.fn();

vi.mock("@/server/formateur/guard", () => ({
  requireFormateurAction: () => requireFormateurAction(),
}));
vi.mock("@/server/formateur/membre-de-session", () => ({
  estMembreDeSession: (...a: unknown[]) => estMembreDeSession(...a),
}));
vi.mock("@/server/qualiopi/evaluations/evaluations-service", () => ({
  createEvaluation: (...a: unknown[]) => createEvaluation(...a),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { enrollment: { findUnique: (...a: unknown[]) => enrollmentFindUnique(...a) } },
}));

import { enregistrerEvaluationFormateurAction } from "./evaluation-formateur";

const SESSION = "11111111-1111-4111-8111-111111111111";
const INSCRIPTION = "22222222-2222-4222-8222-222222222222";
const FORMATEUR = "33333333-3333-4333-8333-333333333333";

function entree(over: Record<string, unknown> = {}) {
  return {
    sessionId: SESSION,
    enrollmentId: INSCRIPTION,
    type: "finale" as const,
    dateEvaluation: "2026-08-20",
    competences: [{ libelle: "Rédiger une invite structurée", note: 3 as const }],
    ...over,
  };
}

describe("enregistrerEvaluationFormateurAction", () => {
  beforeEach(() => {
    requireFormateurAction.mockReset().mockResolvedValue({ trainerId: FORMATEUR });
    estMembreDeSession.mockReset().mockResolvedValue(true);
    enrollmentFindUnique.mockReset().mockResolvedValue({ sessionId: SESSION });
    createEvaluation.mockReset().mockResolvedValue({ id: "eval-1" });
  });

  it("le formateur de la session enregistre l'évaluation", async () => {
    const res = await enregistrerEvaluationFormateurAction(entree());
    expect(res).toEqual({ ok: true, id: "eval-1" });
  });

  // ── Les deux contrôles d'habilitation ──────────────────────────────────────

  it("🔴 un formateur qui n'intervient PAS sur la session est refusé", async () => {
    estMembreDeSession.mockResolvedValue(false);
    const res = await enregistrerEvaluationFormateurAction(entree());
    expect(res.ok).toBe(false);
    expect(createEvaluation, "rien n'est écrit").not.toHaveBeenCalled();
  });

  it("🔴 une inscription d'une AUTRE session est refusée", async () => {
    // 🔑 Le contrôle qu'on oublie. Le formateur est légitime sur la session A ;
    // changer `enrollmentId` évaluerait un stagiaire de la session B — dont il
    // n'a jamais eu la charge, et qui peut travailler chez un concurrent.
    enrollmentFindUnique.mockResolvedValue({ sessionId: "99999999-9999-4999-8999-999999999999" });
    const res = await enregistrerEvaluationFormateurAction(entree());
    expect(res.ok).toBe(false);
    expect(createEvaluation).not.toHaveBeenCalled();
  });

  it("🔴 une inscription INTROUVABLE rend le MÊME message qu'une inscription d'ailleurs", async () => {
    // ⚠️ Anti-énumération : distinguer les deux cas apprendrait au formateur
    // quels identifiants existent.
    enrollmentFindUnique.mockResolvedValue({ sessionId: "99999999-9999-4999-8999-999999999999" });
    const autre = await enregistrerEvaluationFormateurAction(entree());
    enrollmentFindUnique.mockResolvedValue(null);
    const absente = await enregistrerEvaluationFormateurAction(entree());

    expect(absente.ok).toBe(false);
    expect(autre.ok).toBe(false);
    if (!absente.ok && !autre.ok) expect(absente.message).toBe(autre.message);
  });

  it("l'appartenance est vérifiée AVANT de lire l'inscription", async () => {
    // 🔑 Non-vacuité de l'ordre : lire d'abord ferait exécuter la requête pour
    // n'importe quel formateur authentifié, sur n'importe quel identifiant.
    estMembreDeSession.mockResolvedValue(false);
    await enregistrerEvaluationFormateurAction(entree());
    expect(enrollmentFindUnique).not.toHaveBeenCalled();
  });

  // ── Ce qui est transmis au moteur ──────────────────────────────────────────

  it("🔴 l'auteur transmis est le TRAINER, pas un compte admin", async () => {
    // Sans cela, impossible de démontrer qui a évalué quand plusieurs
    // formateurs interviennent sur la même session.
    await enregistrerEvaluationFormateurAction(entree());
    expect(createEvaluation.mock.calls[0]![0]).toMatchObject({ evalueParId: FORMATEUR });
  });

  it("le calcul du score n'est PAS fait ici — il est délégué au moteur", async () => {
    // 🔑 Deux calculs pour le même chiffre donneraient deux vérités, et celle
    // qui s'afficherait serait la moins fiable.
    await enregistrerEvaluationFormateurAction(entree());
    const args = createEvaluation.mock.calls[0]![0] as Record<string, unknown>;
    for (const interdit of ["scoreObtenu", "scorePct", "niveauGlobal", "reussite"]) {
      expect(args, `« ${interdit} » ne se décide pas côté action`).not.toHaveProperty(interdit);
    }
  });

  it("🔴 une grille SANS aucune compétence est refusée", async () => {
    const res = await enregistrerEvaluationFormateurAction(entree({ competences: [] }));
    expect(res.ok).toBe(false);
    expect(createEvaluation).not.toHaveBeenCalled();
  });

  it("le message d'erreur du MOTEUR remonte tel quel", async () => {
    // ⚠️ Le service porte des gardes métier qui parlent — date antérieure au
    // début de session (ind. 4). Les remplacer par un « erreur » opaque
    // laisserait le formateur sans rien à corriger.
    createEvaluation.mockImplementation(async () => {
      throw new Error("La date d'évaluation précède le début de la session.");
    });
    const res = await enregistrerEvaluationFormateurAction(entree());
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toContain("précède le début");
  });
});
