/**
 * Lot G2 — les gestes du bilan de fin de formation dans l'espace formateur.
 *
 *   · la session vient du COOKIE, par la garde commune de l'espace
 *     (`getFormateurSession`, qui refuse après une fin de collaboration) — jamais d'un
 *     champ du formulaire ;
 *   · un identifiant forgé (pas un UUID) ne touche à rien ;
 *   · retour sur la page EXISTANTE de la session, au bloc « Fin de formation ».
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.fn();
const evaluer = vi.fn();
const avis = vi.fn();
const terminer = vi.fn();
const redirect = vi.fn((u: string) => {
  throw new Error(`NEXT_REDIRECT ${u}`);
});

vi.mock("@/server/formateur/guard", () => ({ getFormateurSession: () => session() }));
vi.mock("@/server/qualiopi/formateurs-independants/bilan-fin-formation/service", () => ({
  enregistrerEvaluationFinaleFormateur: (...a: unknown[]) => evaluer(...a),
  enregistrerAvisFormateur: (...a: unknown[]) => avis(...a),
  terminerBilanFormateur: (...a: unknown[]) => terminer(...a),
}));
vi.mock("next/navigation", () => ({ redirect: (u: string) => redirect(u) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  donnerAvisAction,
  evaluerStagiaireFormAction,
  terminerBilanFormAction,
} from "../bilan-fin-formation.actions";

const T = "22222222-2222-4222-8222-222222222222";
const S = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const E = "33333333-3333-4333-8333-333333333333";
const PAGE = `/fr/espace-formateur/sessions/${S}`;

function fd(champs: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(champs)) f.set(k, v);
  return f;
}
async function url(p: Promise<unknown>): Promise<string> {
  await expect(p).rejects.toThrow(/NEXT_REDIRECT/);
  return String(redirect.mock.calls.at(-1)![0]);
}

beforeEach(() => {
  vi.clearAllMocks();
  session.mockResolvedValue({ trainerId: T, nom: "N", prenom: "P", email: "e" });
  evaluer.mockResolvedValue("ok");
  avis.mockResolvedValue("ok");
  terminer.mockResolvedValue("ok");
});

describe("garde commune de l'espace", () => {
  it("sans session (ou collaboration finie) : connexion, rien n'est écrit", async () => {
    session.mockResolvedValue(null);
    expect(
      await url(evaluerStagiaireFormAction(fd({ sessionId: S, enrollmentId: E, "note-0": "3" }))),
    ).toBe("/fr/espace-formateur/connexion");
    // V2-N-3 — l'avis ne redirige pas : le texte écrit resterait derrière la connexion.
    expect(
      await donnerAvisAction(null, fd({ sessionId: S, commentaire: "Bon groupe, rien à dire." })),
    ).toMatchObject({
      ok: false,
      message: expect.stringMatching(/connexion a expiré/),
      commentaire: "Bon groupe, rien à dire.",
    });
    expect(await url(terminerBilanFormAction(fd({ sessionId: S })))).toBe(
      "/fr/espace-formateur/connexion",
    );
    expect(evaluer).not.toHaveBeenCalled();
    expect(avis).not.toHaveBeenCalled();
    expect(terminer).not.toHaveBeenCalled();
  });
});

describe("evaluerStagiaireFormAction", () => {
  it("le formateur CONNECTÉ, les notes dans l'ordre des objectifs", async () => {
    const u = await url(
      evaluerStagiaireFormAction(
        fd({ sessionId: S, enrollmentId: E, "note-0": "3", "note-1": "1", trainerId: "forge" }),
      ),
    );
    expect(evaluer.mock.calls[0]![0]).toMatchObject({
      sessionId: S,
      trainerId: T,
      enrollmentId: E,
      notes: [3, 1],
    });
    expect(u).toBe(`${PAGE}?bilan=ok#fin-de-formation`);
  });

  it("identifiants forgés : rien n'est transmis", async () => {
    await url(evaluerStagiaireFormAction(fd({ sessionId: "x", enrollmentId: E, "note-0": "3" })));
    await url(
      evaluerStagiaireFormAction(fd({ sessionId: S, enrollmentId: "../x", "note-0": "3" })),
    );
    expect(evaluer).not.toHaveBeenCalled();
  });

  it("le refus du service revient tel quel dans l'adresse", async () => {
    evaluer.mockResolvedValue("stagiaire_inconnu");
    expect(
      await url(evaluerStagiaireFormAction(fd({ sessionId: S, enrollmentId: E, "note-0": "3" }))),
    ).toBe(`${PAGE}?bilan=stagiaire_inconnu#fin-de-formation`);
  });
});

describe("donnerAvisAction", () => {
  it("note facultative, texte transmis ; succès : retour au bloc", async () => {
    expect(
      await url(
        donnerAvisAction(null, fd({ sessionId: S, commentaire: "Groupe motivé.", note: "" })),
      ),
    ).toBe(`${PAGE}?bilan=ok#fin-de-formation`);
    expect(avis.mock.calls[0]![0]).toMatchObject({
      sessionId: S,
      trainerId: T,
      commentaire: "Groupe motivé.",
    });
    expect(avis.mock.calls[0]![0]).not.toHaveProperty("note");
    await url(
      donnerAvisAction(null, fd({ sessionId: S, commentaire: "Groupe motivé.", note: "5" })),
    );
    expect(avis.mock.calls[1]![0]).toMatchObject({ note: 5 });
  });

  it("V2-N-3 — un refus du service rend le message ET la saisie, sans rediriger", async () => {
    avis.mockResolvedValue("dossier_clos");
    const etat = await donnerAvisAction(
      null,
      fd({ sessionId: S, commentaire: "Salle trop petite.", note: "4" }),
    );
    expect(redirect).not.toHaveBeenCalled();
    expect(etat).toEqual({
      ok: false,
      essai: 1,
      message: expect.stringMatching(/dossier de cette session est clos/),
      commentaire: "Salle trop petite.",
      note: "4",
    });
    // Deux refus de suite : un rang nouveau, pour remonter les champs à chaque fois.
    expect((await donnerAvisAction(etat, fd({ sessionId: S, commentaire: "x" }))).essai).toBe(2);
  });

  it("identifiant de session forgé : rien n'est transmis, la saisie revient", async () => {
    expect(
      await donnerAvisAction(null, fd({ sessionId: "../x", commentaire: "Groupe motivé." })),
    ).toMatchObject({ ok: false, commentaire: "Groupe motivé." });
    expect(avis).not.toHaveBeenCalled();
  });
});

describe("terminerBilanFormAction", () => {
  it("termine pour le formateur connecté ; écran de fin", async () => {
    expect(await url(terminerBilanFormAction(fd({ sessionId: S })))).toBe(
      `${PAGE}?bilan=termine_ok#fin-de-formation`,
    );
    expect(terminer.mock.calls[0]![0]).toMatchObject({ sessionId: S, trainerId: T });
  });
});
