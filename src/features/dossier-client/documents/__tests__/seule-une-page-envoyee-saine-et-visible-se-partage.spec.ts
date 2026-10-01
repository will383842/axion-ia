// @vitest-environment node

/**
 * R11 — SEULE UNE PAGE ENVOYÉE, SAINE ET VISIBLE SE PARTAGE (ADR 0063, D12).
 *
 * Partageable = non archivé ET « envoyé au client » ET nature « page en ligne »
 * ET format HTML ET verdict « sain ». Une seule définition (`estPartageable`),
 * lue par la console (bouton « Copier le lien client ») ET par la route
 * publique. Tout le reste répond le MÊME 404 neutre : rien ne dit pourquoi.
 *
 * Mutations qui rougissent : oublier une des cinq conditions ; servir un
 * `non_analyse` ; montrer le bouton sur un document que la route refuse.
 * Contre-témoin : la page conforme est servie et a son bouton.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { jetonDocument } from "../jeton";
import { estPartageable } from "../partage";
import { lirePagePublique } from "../page-publique";
import { baseEnMemoire, type DocEnMemoire } from "./_base-en-memoire";

const CLIENT = "11111111-1111-4111-8111-111111111111";
const PROJET = "22222222-2222-4222-8222-222222222222";
const HTML = new TextEncoder().encode("<!doctype html><p>Notre intervention</p>");

const CONFORME: Partial<DocEnMemoire> = {
  cote: "envoye_au_client",
  nature: "page_en_ligne",
  envoyeLe: new Date("2026-09-30T00:00:00Z"),
  fichierNom: "intervention.html",
  fichierFormat: "html",
  fichierTailleOctets: HTML.length,
  analyseAntivirus: "sain",
  analyseLe: new Date(),
  archiveLe: null,
};

const ECARTS: ReadonlyArray<[string, Partial<DocEnMemoire>]> = [
  ["archivé", { archiveLe: new Date() }],
  ["interne", { cote: "interne", envoyeLe: null }],
  ["nature PDF", { nature: "pdf" }],
  ["nature autre", { nature: "autre" }],
  ["format PDF", { fichierFormat: "pdf", fichierNom: "intervention.pdf" }],
  ["format texte", { fichierFormat: "txt", fichierNom: "intervention.txt" }],
  ["non analysé", { analyseAntivirus: "non_analyse", analyseLe: null }],
  ["infecté", { analyseAntivirus: "infecte", archiveLe: new Date(), analyseSignature: "x" }],
];

describe("seule une page envoyée, saine et visible se partage", () => {
  beforeEach(() => {
    vi.stubEnv("AUTH_SECRET", "secret-de-test");
    vi.stubEnv("DATABASE_URL", "postgresql://u:p@localhost:5432/axion");
  });
  afterEach(() => vi.unstubAllEnvs());

  it.each(ECARTS)("%s → pas de bouton, et le même 404 neutre", async (_cas, ecart) => {
    const { db, poser } = baseEnMemoire([{ id: PROJET, clientId: CLIENT }]);
    const doc = poser({ clientId: CLIENT, projetId: PROJET, ...CONFORME, ...ecart }, HTML);
    expect(estPartageable(doc as never)).toBe(false);
    const page = await lirePagePublique(db as never, {
      id: doc.id,
      jeton: jetonDocument(doc.id)!,
      methode: "GET",
      entetes: new Headers(),
    });
    expect(page).toBeNull();
  });

  it("un LIEN (sans fichier) envoyé « page en ligne » ne se partage pas : il est déjà en ligne", () => {
    expect(
      estPartageable({
        ...CONFORME,
        fichierFormat: null,
        analyseAntivirus: null,
      } as never),
    ).toBe(false);
  });

  it("contre-témoin : la page conforme a son bouton et est servie", async () => {
    const { db, poser } = baseEnMemoire([{ id: PROJET, clientId: CLIENT }]);
    const doc = poser({ clientId: CLIENT, projetId: PROJET, ...CONFORME }, HTML);
    expect(estPartageable(doc as never)).toBe(true);
    const page = await lirePagePublique(db as never, {
      id: doc.id,
      jeton: jetonDocument(doc.id)!,
      methode: "GET",
      entetes: new Headers(),
    });
    expect(page).not.toBeNull();
  });
});
