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
  donnerAvisFormAction,
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
    expect(
      await url(
        donnerAvisFormAction(fd({ sessionId: S, commentaire: "Bon groupe, rien à dire." })),
      ),
    ).toBe("/fr/espace-formateur/connexion");
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

describe("donnerAvisFormAction", () => {
  it("note facultative, texte transmis", async () => {
    await url(donnerAvisFormAction(fd({ sessionId: S, commentaire: "Groupe motivé.", note: "" })));
    expect(avis.mock.calls[0]![0]).toMatchObject({
      sessionId: S,
      trainerId: T,
      commentaire: "Groupe motivé.",
    });
    expect(avis.mock.calls[0]![0]).not.toHaveProperty("note");
    await url(donnerAvisFormAction(fd({ sessionId: S, commentaire: "Groupe motivé.", note: "5" })));
    expect(avis.mock.calls[1]![0]).toMatchObject({ note: 5 });
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
