/**
 * LE JETON OUVRE UN SEUL QUESTIONNAIRE (questionnaire en ligne, 2026-10-01).
 *
 * `jeton = base64url(HMAC-SHA256(clé dérivée d'AUTH_SECRET, domaine + id))`,
 * comparé à temps constant. Rien n'est stocké.
 *
 * Mutation qui rougit : comparer par `===` sur un préfixe ; ne pas lier le
 * jeton à l'identifiant (un jeton ouvrirait tous les questionnaires) ; garder
 * une clé de développement connue en production sans `AUTH_SECRET`.
 * Contre-témoin : le jeton fabriqué pour un questionnaire l'ouvre bien — sans
 * lui, « tout est refusé » passerait pour « tout est vérifié ».
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { SITE_URL } from "@/lib/site-url";
import { cheminQuestionnaire, jetonQuestionnaire, jetonValide, urlQuestionnaire } from "../jeton";

const A = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const B = "0a1b2c3d-4e5f-4a6b-8c7d-8e9fa0b1c2d3";

afterEach(() => {
  vi.unstubAllEnvs();
});

/** Le même jeton avec UN caractère changé (même longueur, même alphabet). */
function altere(jeton: string): string {
  const i = 10;
  const c = jeton[i] === "A" ? "B" : "A";
  return `${jeton.slice(0, i)}${c}${jeton.slice(i + 1)}`;
}

describe("le jeton ouvre un seul questionnaire", () => {
  it("contre-témoin : le jeton d'un questionnaire l'ouvre", () => {
    vi.stubEnv("AUTH_SECRET", "secret-de-test-assez-long-pour-l-exemple");
    const j = jetonQuestionnaire(A);
    expect(j).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(jetonValide(A, j as string)).toBe(true);
    // L'identifiant en majuscules est le même questionnaire.
    expect(jetonValide(A.toUpperCase(), j as string)).toBe(true);
  });

  it("un jeton altéré d'un seul caractère est refusé", () => {
    vi.stubEnv("AUTH_SECRET", "secret-de-test-assez-long-pour-l-exemple");
    const j = jetonQuestionnaire(A) as string;
    expect(jetonValide(A, altere(j))).toBe(false);
  });

  it("le jeton d'un questionnaire n'ouvre pas un autre questionnaire", () => {
    vi.stubEnv("AUTH_SECRET", "secret-de-test-assez-long-pour-l-exemple");
    expect(jetonValide(B, jetonQuestionnaire(A) as string)).toBe(false);
  });

  it("une forme inattendue est refusée (longueur, alphabet, identifiant)", () => {
    vi.stubEnv("AUTH_SECRET", "secret-de-test-assez-long-pour-l-exemple");
    const j = jetonQuestionnaire(A) as string;
    expect(jetonValide(A, j.slice(0, 42))).toBe(false);
    expect(jetonValide(A, `${j}x`)).toBe(false);
    expect(jetonValide(A, `${j.slice(0, 42)}=`)).toBe(false);
    expect(jetonValide(A, "")).toBe(false);
    expect(jetonValide("pas-un-uuid", j)).toBe(false);
    expect(jetonQuestionnaire("pas-un-uuid")).toBeNull();
  });

  it("changer de secret invalide tous les liens", () => {
    vi.stubEnv("AUTH_SECRET", "premier-secret-de-test-assez-long");
    const j = jetonQuestionnaire(A) as string;
    vi.stubEnv("AUTH_SECRET", "second-secret-de-test-assez-long");
    expect(jetonValide(A, j)).toBe(false);
  });

  it("⛔ en production sans AUTH_SECRET : aucun lien fabriqué, aucun lien valide", () => {
    vi.stubEnv("AUTH_SECRET", "");
    vi.stubEnv("NODE_ENV", "development");
    const jetonDeDev = jetonQuestionnaire(A) as string;
    expect(jetonValide(A, jetonDeDev)).toBe(true); // témoin : la clé de dev existe hors production
    vi.stubEnv("NODE_ENV", "production");
    expect(jetonQuestionnaire(A)).toBeNull();
    expect(urlQuestionnaire(A)).toBeNull();
    expect(jetonValide(A, jetonDeDev)).toBe(false);
  });

  it("l'URL est celle du site (SITE_URL), sous /questionnaire/<id>/<jeton>", () => {
    vi.stubEnv("AUTH_SECRET", "secret-de-test-assez-long-pour-l-exemple");
    const j = jetonQuestionnaire(A) as string;
    expect(cheminQuestionnaire(A)).toBe(`/questionnaire/${A}/${j}`);
    expect(urlQuestionnaire(A)).toBe(`${SITE_URL.replace(/\/+$/, "")}/questionnaire/${A}/${j}`);
  });
});
