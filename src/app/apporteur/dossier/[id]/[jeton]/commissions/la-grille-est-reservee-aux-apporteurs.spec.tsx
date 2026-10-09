// La grille de référence des commissions est RÉSERVÉE AUX APPORTEURS (décision de Will,
// 2026-10-09) : elle ne s'ouvre qu'avec un lien personnel valide, jamais pour une fiche retirée
// ni pour le lien d'exemple. Contenu inchangé : l'en-tête A1.7, les six tableaux datés, aucun mot
// sur le parrainage ni Qualiopi.
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ dossier: null as Record<string, unknown> | null }));
vi.mock("server-only", () => ({}));
vi.mock("@/features/apporteurs-reseau/donnees", () => ({
  lireDossierParLien: vi.fn(async () => h.dossier),
}));

import { ID_DOSSIER_EXEMPLE } from "@/features/apporteurs-reseau/jeton";

import { GRILLE_RESERVEE } from "@/features/apporteurs-reseau/grille-reservee";

import Page, { metadata } from "./page";

const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const params = (id = ID) => ({ params: Promise.resolve({ id, jeton: "jeton-valide" }) });
const texte = (x: string) =>
  x
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ");

beforeEach(() => {
  h.dossier = { id: ID, prenom: "Ana", restreint: false };
});

/** Aucun chiffre de la grille : ni pourcentage, ni montant, ni « € ». */
const SANS_CHIFFRE = /\d\s?%|€|\d{3}/;

/** Les accès refusés : [cas, préparation du dossier, identifiant du lien]. */
const REFUS: ReadonlyArray<readonly [string, () => void, string]> = [
  [
    "lien invalide",
    (): void => {
      h.dossier = null;
    },
    ID,
  ],
  [
    "fiche retirée du réseau (mode restreint)",
    (): void => {
      h.dossier = { id: ID, prenom: "Ana", restreint: true };
    },
    ID,
  ],
  ["lien d'exemple de l'aperçu", () => undefined, ID_DOSSIER_EXEMPLE],
];

describe("accès", () => {
  it("noindex, nofollow", () => {
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
  });

  it.each(REFUS)("%s : le message sobre, AUCUN chiffre, pas de 404", async (_c, preparer, id) => {
    preparer();
    const html = renderToStaticMarkup(await Page(params(id)));
    const t = texte(html);
    expect(t).toContain(GRILLE_RESERVEE.titre);
    expect(t).not.toMatch(SANS_CHIFFRE);
    expect(t).not.toContain("Formations collectives");
  });
});

describe("contenu, pour un apporteur", () => {
  it("l'en-tête A1.7 ; les six tableaux, datés ; aucun parrainage ni Qualiopi ; retour à l'espace", async () => {
    const t = texte(renderToStaticMarkup(await Page(params())));
    expect(t).toContain("Grille de référence des commissions");
    expect(t).toContain("Produits créés après la signature de votre contrat : annexe 1, A1.7.");
    for (const titre of [
      "Formations collectives",
      "Accompagnement individuel et coaching (1-to-1)",
      "Audits",
      "Implémentations",
      "Conférences",
      "Prestations non commissionnées",
    ]) {
      expect(t).toContain(titre);
    }
    expect(t).toContain("Grille publiée le 08/10/2026");
    expect(t).not.toMatch(/parrain|qualiopi|jusqu'à/i);
    expect(renderToStaticMarkup(await Page(params()))).toContain(
      `/apporteur/dossier/${ID}/jeton-valide`,
    );
  });
});
