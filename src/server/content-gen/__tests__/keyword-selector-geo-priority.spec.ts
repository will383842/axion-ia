/**
 * Priorité du vivier de mots-clés sur la synthèse géo.
 *
 * Défaut trouvé en production le 2026-08-15. La synthèse géo était placée en
 * TÊTE de `selectKeywordRich`, avant toute requête en base : tout job portant
 * une ville la déclenchait, et le vivier n'était donc jamais interrogé.
 *
 * Chiffres relevés en base de production ce jour-là :
 *  - 1 835 mots-clés longue traîne, dont **zéro** jamais utilisé (aucun
 *    `usage_count`, aucun `last_used_at`, aucun verrou) ;
 *  - 12 jobs sur 2 319 seulement portaient un mot-clé ;
 *  - 73 % des rejets de publication étaient « même sujet qu'un article
 *    existant » — conséquence directe d'une diversité plafonnée aux ~7 gabarits
 *    géo par verticale.
 *
 * Aucun test n'exerçait le chemin `city`, ce qui explique que le
 * court-circuit soit passé inaperçu. Ces scénarios comblent ce trou.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const queryRawMock = vi.fn<(...args: unknown[]) => Promise<unknown>>();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: (...args: unknown[]) => queryRawMock(...args),
  },
}));

import { selectKeywordRich, __resetInMemoryCounters } from "../keyword-selector";

const LYON = { name: "Lyon", regionName: "Auvergne-Rhône-Alpes" };

beforeEach(() => {
  queryRawMock.mockReset();
  __resetInMemoryCounters();
});

describe("selectKeywordRich — le vivier prime sur la synthèse géo", () => {
  it("interroge la base MÊME quand une ville est fournie (la régression)", async () => {
    queryRawMock.mockResolvedValueOnce([
      {
        term: "formation IA équipe retail luxe",
        search_intent: "sectoriel",
        cluster_id: "formation-metiers-sectorielle",
      },
    ]);

    const result = await selectKeywordRich({
      vertical: "interventions_formations",
      city: LYON,
    });

    // Avant le correctif : la base n'était jamais appelée et le terme retourné
    // était un gabarit géo du type « formation IA Lyon ».
    expect(queryRawMock).toHaveBeenCalledTimes(1);
    expect(result?.term).toBe("formation IA équipe retail luxe");
  });

  it("conserve les métadonnées du vivier (intent + cluster) malgré la ville", async () => {
    // Ces métadonnées pilotent le garde-fou d'intention et l'anti-cannibalisation.
    // La synthèse géo n'en produit aucune : les court-circuiter les perdait toutes.
    queryRawMock.mockResolvedValueOnce([
      {
        term: "quelle durée prévoir pour une formation IA ?",
        search_intent: "aeo",
        cluster_id: "formation-debutants-decouverte",
      },
    ]);

    const result = await selectKeywordRich({
      vertical: "interventions_formations",
      city: LYON,
    });

    expect(result?.searchIntent).toBe("aeo");
    expect(result?.clusterId).toBe("formation-debutants-decouverte");
  });

  it("ne retombe sur la synthèse géo QUE si le vivier est épuisé", async () => {
    queryRawMock.mockResolvedValueOnce([]);

    const result = await selectKeywordRich({ vertical: "audits", city: LYON });

    expect(queryRawMock).toHaveBeenCalledTimes(1);
    // Repli géo : le terme porte alors la ville.
    expect(result?.term).toContain("Lyon");
    // La synthèse ne produit pas de métadonnées.
    expect(result?.searchIntent).toBeNull();
    expect(result?.clusterId).toBeNull();
  });

  it("retombe aussi sur la synthèse géo si la base est injoignable", async () => {
    queryRawMock.mockRejectedValueOnce(new Error("DB down"));

    const result = await selectKeywordRich({ vertical: "audits", city: LYON });

    expect(result?.term).toContain("Lyon");
  });

  it("sans ville ni vivier, garde le repli historique en mémoire", async () => {
    queryRawMock.mockResolvedValueOnce([]);

    const result = await selectKeywordRich({ vertical: "audits" });

    expect(result?.term).toBeTruthy();
    expect(result?.term).not.toContain("Lyon");
  });
});

describe("selectKeywordRich — rotation géo déterministe", () => {
  it("deux graines différentes donnent deux gabarits différents", async () => {
    queryRawMock.mockResolvedValue([]);

    const a = await selectKeywordRich({ vertical: "audits", city: LYON, rotationSeed: 0 });
    const b = await selectKeywordRich({ vertical: "audits", city: LYON, rotationSeed: 1 });

    expect(a?.term).not.toBe(b?.term);
  });

  it("la même graine redonne le même gabarit, y compris après redémarrage", async () => {
    // C'est tout l'enjeu : le compteur en mémoire repartait de zéro à chaque
    // redémarrage du worker, si bien qu'après un redéploiement chaque ville
    // reprenait au premier gabarit et regénérait le même sujet.
    queryRawMock.mockResolvedValue([]);

    const avant = await selectKeywordRich({ vertical: "audits", city: LYON, rotationSeed: 5 });
    __resetInMemoryCounters(); // simule un redémarrage du worker
    const apres = await selectKeywordRich({ vertical: "audits", city: LYON, rotationSeed: 5 });

    expect(apres?.term).toBe(avant?.term);
  });

  it("sans graine, conserve la rotation historique en mémoire", async () => {
    queryRawMock.mockResolvedValue([]);

    const a = await selectKeywordRich({ vertical: "audits", city: LYON });
    const b = await selectKeywordRich({ vertical: "audits", city: LYON });

    expect(a?.term).not.toBe(b?.term);
  });
});
