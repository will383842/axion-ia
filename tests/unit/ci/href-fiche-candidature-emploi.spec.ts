/**
 * Le motif qui distingue une fiche de candidature EMPLOI d'une fiche
 * d'apporteur d'affaires.
 *
 * ── Pourquoi une garde sur un helper de test ──────────────────────────────
 * Ce motif est la seule chose qui empêche sept parcours de recrutement
 * d'ouvrir la mauvaise fiche. S'il devenait trop LARGE, ils rouvriraient une
 * fiche d'apporteur et échoueraient sur « bouton introuvable » — un message qui
 * accuse le produit. S'il devenait trop ÉTROIT, il ne matcherait plus rien, et
 * les parcours diraient « aucune fiche ouvrable », ce qui ressemble à une base
 * vide : on chercherait le défaut dans le seed.
 *
 * 🔑 Les deux dérives sont muettes. C'est exactement le cas où un motif de
 * sélection se vérifie sur ce qu'il REFUSE, pas seulement sur ce qu'il accepte.
 */

import { describe, expect, it } from "vitest";

import {
  estFicheCandidatureEmploi,
  MOTIF_FICHE_CANDIDATURE_EMPLOI,
} from "../../e2e/fixtures/href-candidature";

const PREFIXE = "/fr/admin-dev-x7k2n9";
const UUID = "ab6bec9e-bc99-46f2-b4d8-e125f8a5de4f";

describe("adresse d'une fiche de candidature emploi", () => {
  it("ACCEPTE la fiche d'une candidature emploi", () => {
    expect(estFicheCandidatureEmploi(`${PREFIXE}/contacts/candidatures/${UUID}`)).toBe(true);
  });

  it("accepte quel que soit le préfixe admin — il change d'un environnement à l'autre", () => {
    expect(estFicheCandidatureEmploi(`/fr/admin-ci-build/contacts/candidatures/${UUID}`)).toBe(
      true,
    );
  });

  it("🔴 REFUSE la fiche d'un apporteur d'affaires — c'est le défaut du 2026-09-04", () => {
    // Adresse relevée dans le rapport Playwright du run 33891475036 : les tests
    // de recrutement avaient ouvert la fiche du lead créé par le parcours de
    // capture, un écran sans entretiens ni journal.
    expect(estFicheCandidatureEmploi(`${PREFIXE}/contacts/commercial/${UUID}`)).toBe(false);
  });

  it("REFUSE l'écran de pilotage, qui vit sous le MÊME segment", () => {
    // Le piège de la sélection approximative : `/candidatures/` seul l'aurait pris.
    expect(estFicheCandidatureEmploi(`${PREFIXE}/contacts/candidatures/pilotage`)).toBe(false);
  });

  it("REFUSE la liste elle-même et les valeurs vides", () => {
    expect(estFicheCandidatureEmploi(`${PREFIXE}/contacts/candidatures`)).toBe(false);
    expect(estFicheCandidatureEmploi("")).toBe(false);
    expect(estFicheCandidatureEmploi(null)).toBe(false);
    expect(estFicheCandidatureEmploi(undefined)).toBe(false);
  });

  it("REFUSE un identifiant tronqué — sinon le motif accepterait n'importe quel segment", () => {
    expect(estFicheCandidatureEmploi(`${PREFIXE}/contacts/candidatures/ab6bec9e`)).toBe(false);
  });

  it("tolère une query, qui ne change pas la nature de la fiche", () => {
    expect(estFicheCandidatureEmploi(`${PREFIXE}/contacts/candidatures/${UUID}?from=liste`)).toBe(
      true,
    );
  });

  it("TÉMOIN — le motif est bien ancré en fin d'adresse", () => {
    // Sans ancre, `/contacts/candidatures/<uuid>/cv` (le téléchargement du CV)
    // passerait pour la fiche.
    expect(MOTIF_FICHE_CANDIDATURE_EMPLOI.test(`${PREFIXE}/contacts/candidatures/${UUID}/cv`)).toBe(
      false,
    );
  });
});
