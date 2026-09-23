/**
 * LE SÉLECTEUR « OFFRE » — ce qui remplace l'onglet « Monteur vidéo ».
 *
 * ── Pourquoi ─────────────────────────────────────────────────────────────
 * Mesuré en production le 2026-09-23 : 164 candidatures, 34 offres, dont 6
 * spontanées (`offerId IS NULL` — soit qu'aucune offre n'ait jamais été
 * visée, soit que l'offre ait depuis été supprimée, `onDelete: SetNull` du
 * lot 6). L'onglet retiré ne répondait qu'à UNE offre parmi 34 ; ce sélecteur
 * doit répondre aux 34 — mais SANS fragmenter les candidatures sans offre en
 * autant de libellés que de textes saisis à la main par chaque candidat.
 *
 * ⚠️ CE QUE CE FICHIER EXISTE POUR EMPÊCHER : un `groupBy` naïf sur
 * `(offerId, offerTitleSnap)` produirait UNE ligne de sélecteur PAR TEXTE
 * DISTINCT saisi par un candidat spontané — jusqu'à six entrées à un seul
 * candidat chacune, l'exact inverse d'un sélecteur qui doit tenir sur un
 * écran. Les candidatures sans offre doivent se regrouper sous UN SEUL
 * bucket, quel que soit le texte que chacune porte.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const groupByMock = vi.fn();
const findManyMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    jobApplication: {
      groupBy: (...a: unknown[]) => groupByMock(...a),
      findMany: (...a: unknown[]) => findManyMock(...a),
    },
  },
}));

import { AUCUNE_OFFRE_ID, getOffresAvecCandidatures } from "../reads";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getOffresAvecCandidatures", () => {
  it("regroupe TOUTES les candidatures sans offre sous UN SEUL bucket, malgré des libellés différents", async () => {
    groupByMock.mockResolvedValue([
      { offerId: "offre-redacteur", _count: { _all: 12 } },
      { offerId: null, _count: { _all: 6 } },
    ]);
    // Six candidatures spontanées, six textes DIFFÉRENTS — c'est le cas que
    // ce test protège : aucun ne doit produire sa propre ligne de sélecteur.
    findManyMock.mockResolvedValue([
      { offerId: "offre-redacteur", offerTitleSnap: "Rédacteur web" },
    ]);

    const offres = await getOffresAvecCandidatures();

    expect(offres).toHaveLength(2);
    const spontanee = offres.find((o) => o.id === AUCUNE_OFFRE_ID);
    expect(spontanee).toBeDefined();
    expect(spontanee?.count).toBe(6);
    expect(spontanee?.label).toBe("Candidature spontanée");

    const redacteur = offres.find((o) => o.id === "offre-redacteur");
    expect(redacteur?.label).toBe("Rédacteur web");
    expect(redacteur?.count).toBe(12);
  });

  it("🔑 MÊME SI la requête amont fragmentait les spontanées (bug de `by`) : la fusion JS les réabsorbe", async () => {
    // Simule le bug redouté : un `groupBy` qui grouperait par un second champ
    // (comme `getSourcesCandidatures` le fait sur un texte) rendrait ICI trois
    // groupes `offerId: null` distincts au lieu d'un seul. Le sélecteur ne
    // doit JAMAIS exposer trois lignes « spontanée ».
    groupByMock.mockResolvedValue([
      { offerId: null, _count: { _all: 1 } },
      { offerId: null, _count: { _all: 2 } },
      { offerId: null, _count: { _all: 3 } },
    ]);
    findManyMock.mockResolvedValue([]);

    const offres = await getOffresAvecCandidatures();

    expect(offres).toHaveLength(1);
    expect(offres[0]?.id).toBe(AUCUNE_OFFRE_ID);
    expect(offres[0]?.count).toBe(6);
  });

  it("trie par volume décroissant, puis alphabétique", async () => {
    groupByMock.mockResolvedValue([
      { offerId: "o-b", _count: { _all: 3 } },
      { offerId: "o-a", _count: { _all: 3 } },
      { offerId: "o-c", _count: { _all: 9 } },
    ]);
    findManyMock.mockResolvedValue([
      { offerId: "o-a", offerTitleSnap: "Alpha" },
      { offerId: "o-b", offerTitleSnap: "Bravo" },
      { offerId: "o-c", offerTitleSnap: "Charlie" },
    ]);

    const offres = await getOffresAvecCandidatures();

    expect(offres.map((o) => o.label)).toEqual(["Charlie", "Alpha", "Bravo"]);
  });

  it("aucune candidature sans offre : pas de bucket « Candidature spontanée » fantôme", async () => {
    groupByMock.mockResolvedValue([{ offerId: "o-a", _count: { _all: 4 } }]);
    findManyMock.mockResolvedValue([{ offerId: "o-a", offerTitleSnap: "Alpha" }]);

    const offres = await getOffresAvecCandidatures();

    expect(offres.some((o) => o.id === AUCUNE_OFFRE_ID)).toBe(false);
  });

  it("🔑 CONTRE-TÉMOIN — sans candidature du tout, aucune ligne, et `findMany` n'est pas appelé", async () => {
    groupByMock.mockResolvedValue([]);

    const offres = await getOffresAvecCandidatures();

    expect(offres).toEqual([]);
    expect(findManyMock).not.toHaveBeenCalled();
  });
});
