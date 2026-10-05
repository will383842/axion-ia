// Le texte réécrit par Will voyage jusqu'à l'envoi : Server Actions (validation), payload
// de l'e-mail, sans toucher au jobId d'idempotence.

import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
const envoyerLien = vi.fn();
const preparerLien = vi.fn();
const appliquerDecision = vi.fn();
const apercuDecision = vi.fn();
vi.mock("../verification", () => ({
  apercuDecision: (...a: unknown[]) => apercuDecision(...a),
  appliquerDecision: (...a: unknown[]) => appliquerDecision(...a),
  envoyerLien: (...a: unknown[]) => envoyerLien(...a),
  preparerLien: (...a: unknown[]) => preparerLien(...a),
  jugerPiece: vi.fn(),
  ouvrirDossierManuel: vi.fn(),
}));

import {
  apercuDecisionAction,
  appliquerDecisionAction,
  envoyerLienAction,
} from "../actions-apporteurs";
import { avecTexteLibre } from "../envois";
import { construireEnvoisReponse } from "../presentations";

const ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({ user: { id: "u1", role: "admin" } });
  envoyerLien.mockResolvedValue({ ok: true, message: "Lien envoyé." });
  appliquerDecision.mockResolvedValue({ ok: true, message: "ok" });
});

describe("Server Actions : le texte réécrit est validé puis transmis", () => {
  it("l'envoi du lien passe le texte à l'envoi", async () => {
    await envoyerLienAction({ apporteurId: ID, mot: null, texte: "Bonjour à vous.\n\nMerci." });
    expect(envoyerLien).toHaveBeenCalledWith(ID, null, "Bonjour à vous.\n\nMerci.");
  });
  it("sans texte, l'envoi du lien part comme avant", async () => {
    await envoyerLienAction({ apporteurId: ID, mot: null });
    expect(envoyerLien).toHaveBeenCalledWith(ID, null, undefined);
  });
  it("la décision passe le texte à l'envoi", async () => {
    await appliquerDecisionAction({
      apporteurId: ID,
      decision: "refuser",
      note: null,
      texte: "Non.",
    });
    expect(appliquerDecision).toHaveBeenCalledWith(ID, "refuser", "", "Non.");
  });
  it("un texte modifié mais vide est refusé, rien n'est envoyé", async () => {
    const r = await envoyerLienAction({ apporteurId: ID, mot: null, texte: "   " });
    expect(r.ok).toBe(false);
    expect(envoyerLien).not.toHaveBeenCalled();
    const d = await appliquerDecisionAction({
      apporteurId: ID,
      decision: "refuser",
      note: null,
      texte: "",
    });
    expect(d.ok).toBe(false);
    expect(appliquerDecision).not.toHaveBeenCalled();
  });
  it("un texte trop long est refusé (aperçu comme envoi)", async () => {
    const long = "a".repeat(4001);
    expect((await envoyerLienAction({ apporteurId: ID, mot: null, texte: long })).ok).toBe(false);
    const a = await apercuDecisionAction({
      apporteurId: ID,
      decision: "refuser",
      note: null,
      texte: long,
    });
    expect(a.ok).toBe(false);
    expect(envoyerLien).not.toHaveBeenCalled();
    expect(apercuDecision).not.toHaveBeenCalled();
  });
  it("refuse un compte sans rôle admin avant de regarder le texte", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "reader" } });
    const r = await envoyerLienAction({ apporteurId: ID, mot: null, texte: "x" });
    expect(r.ok).toBe(false);
    expect(envoyerLien).not.toHaveBeenCalled();
  });
});

describe("payload de l'e-mail", () => {
  it("avecTexteLibre ajoute le texte, ou laisse le payload intact", () => {
    expect(avecTexteLibre({ a: 1 }, "t")).toEqual({ a: 1, texteLibre: "t" });
    expect(avecTexteLibre({ a: 1 }, undefined)).toEqual({ a: 1 });
  });

  const donnees = {
    presentation: {
      id: "p1",
      denomination: "Acme",
      recueAt: new Date("2026-10-05T10:00:00Z"),
      personneNom: "Paul Durand",
      personneEmail: "paul@acme.fr",
    },
    apporteur: { id: "a1", prenom: "Claire", nom: "Martin", email: "claire@x.fr" },
  };
  const o = { civilite: "" as const, nomFamille: "" };

  it("la réponse « bien reçu » porte chaque texte sur son e-mail, jobId inchangés", () => {
    const sans = construireEnvoisReponse(donnees, "bien_recu", o);
    const avec = construireEnvoisReponse(donnees, "bien_recu", {
      ...o,
      textes: {
        "entreprise-prise-de-contact-apporteur": "Texte entreprise",
        "apporteur-presentation-recue": "Texte apporteur",
      },
    });
    expect(avec[0]!.payload.texteLibre).toBe("Texte entreprise");
    expect(avec[1]!.payload.texteLibre).toBe("Texte apporteur");
    expect(avec.map((e) => e.jobId)).toEqual(sans.map((e) => e.jobId));
    expect(sans[0]!.payload.texteLibre).toBeUndefined();
  });

  it("un seul e-mail réécrit : l'autre garde son texte par défaut", () => {
    const [e1, e2] = construireEnvoisReponse(donnees, "bien_recu", {
      ...o,
      textes: { "apporteur-presentation-recue": "Seulement celui-ci" },
    });
    expect(e1!.payload.texteLibre).toBeUndefined();
    expect(e2!.payload.texteLibre).toBe("Seulement celui-ci");
  });

  it("la réponse de refus porte son texte", () => {
    const [e] = construireEnvoisReponse(donnees, "deja_connue", {
      ...o,
      textes: { "apporteur-presentation-refusee": "Désolé." },
    });
    expect(e!.payload.texteLibre).toBe("Désolé.");
    expect(e!.jobId).toBe("apporteur-presentation-refusee-p1");
  });
});
