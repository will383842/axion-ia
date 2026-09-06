/**
 * Témoin de `agregerBadges` — la bulle d'un en-tête de navigation replié.
 *
 * 🔴 Ces cas sont FABRIQUÉS, jamais lus sur la base. La bulle observée en prod
 * valait 71 pour 35 alertes non lues et 1 échéance de session : trois nombres
 * VIVANTS. Un témoin qui les affirmerait rougirait demain sans qu'aucun défaut
 * n'existe — ou, pire, verdirait sur un double comptage parce que les valeurs
 * ont bougé. Il testerait la base de données, pas la fonction.
 *
 * 🔑 La valeur 71 est la PREUVE du défaut, pas la garde contre son retour. Le
 * dernier cas la reproduit donc en chiffres posés à la main (36 = 35 + 1), pour
 * que l'histoire reste lisible sans dépendre de l'état du monde.
 */

import { describe, it, expect } from "vitest";
import { agregerBadges, type BadgeAComptabiliser } from "./badge-rollup";

const total = (count: number, key = "qualiopi"): BadgeAComptabiliser => ({
  count,
  tone: "danger",
  rollup: { key, role: "total" },
});
const part = (
  count: number,
  key = "qualiopi",
  tone: "danger" | "warn" = "warn",
): BadgeAComptabiliser => ({ count, tone, rollup: { key, role: "part" } });
const libre = (count: number, tone: "danger" | "warn" = "warn"): BadgeAComptabiliser => ({
  count,
  tone,
});

describe("🔴 un agrégat et ses parties ne s'additionnent pas", () => {
  it("ne compte QUE l'agrégat quand il est présent", () => {
    // Agrégat 7 = ses deux parties 3 et 4. La somme naïve rendrait 14.
    expect(agregerBadges([total(7), part(3), part(4)])?.count).toBe(7);
  });

  it("compte l'agrégat SEUL même s'il couvre plus que ses frères visibles", () => {
    // `qualiopiCounts.total` inclut `signatures` et `sessions`, qui n'ont
    // aucune ligne de nav : l'agrégat est donc STRICTEMENT supérieur à la somme
    // des parties affichées. C'est le cas réel — et il interdit de « corriger »
    // en soustrayant les parties de l'agrégat.
    expect(agregerBadges([total(10), part(3), part(4)])?.count).toBe(10);
  });

  it("n'écarte que les parties de la MÊME clé", () => {
    // Deux agrégats indépendants dans un même groupe : chacun couvre le sien.
    const bulle = agregerBadges([total(7), part(3), total(9, "inbox"), part(5, "inbox")]);
    expect(bulle?.count).toBe(16);
  });
});

describe("🔴 contre-témoins — le drapeau ne doit pas éteindre du travail réel", () => {
  it("somme les parties quand AUCUN agrégat n'est présent", () => {
    // L'item agrégat peut être masqué : mode Simple, filtre de recherche, ou
    // compte à zéro (badgeFor rend null). Replier le groupe ne doit pas faire
    // disparaître le travail que ses parties portent encore.
    expect(agregerBadges([part(3), part(4)])?.count).toBe(7);
  });

  it("additionne toujours un badge SANS étiquette", () => {
    // « Offres à republier », « jobs en échec », « alertes ops » : autonomes,
    // aucun agrégat ne les couvre. Les écarter les rendrait invisibles.
    expect(agregerBadges([total(7), part(3), libre(2)])?.count).toBe(9);
  });

  it("rend null quand tout est à zéro", () => {
    expect(agregerBadges([])).toBeNull();
    expect(agregerBadges([libre(0)])).toBeNull();
  });
});

describe("🔴 la tonalité se lit sur les badges RETENUS", () => {
  it("reste warn quand le seul danger est une partie écartée", () => {
    // Sans cette précaution, une partie déjà comptée par son agrégat pourrait
    // teindre la bulle en rouge sans contribuer au nombre affiché — un rouge
    // que rien dans le chiffre ne justifie.
    expect(
      agregerBadges([
        { count: 5, tone: "warn", rollup: { key: "k", role: "total" } },
        part(3, "k", "danger"),
      ]),
    ).toEqual({ count: 5, tone: "warn" });
  });

  it("passe en danger dès qu'un badge compté est danger", () => {
    expect(agregerBadges([libre(1), libre(2, "danger")])?.tone).toBe("danger");
  });
});

describe("🔴 le cas de production du 2026-09-06, en chiffres posés à la main", () => {
  it("rend 36 et non 71 pour « Formations & prestations »", () => {
    // Relevé ce jour-là : « À traiter » 36, « Alertes » 35, et 36 = 35 alertes
    // + 1 échéance de session. La bulle affichait 71, soit `2 × alertes + 1`.
    const bulle = agregerBadges([total(36), part(35)]);
    expect(bulle).toEqual({ count: 36, tone: "danger" });
    expect(bulle?.count).not.toBe(71);
  });

  it("rend 4 et non 8 pour la boîte de réception", () => {
    // Même structure : « Tout » agrège appels + messages + candidatures + podcast.
    const bulle = agregerBadges([
      total(4, "inbox"),
      part(1, "inbox"),
      part(1, "inbox"),
      part(1, "inbox"),
      part(1, "inbox"),
    ]);
    expect(bulle?.count).toBe(4);
  });
});
