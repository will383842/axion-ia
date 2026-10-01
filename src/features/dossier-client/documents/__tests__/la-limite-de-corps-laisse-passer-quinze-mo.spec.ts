// @vitest-environment node

/**
 * UN FICHIER DE 15 MO ARRIVE ENTIER AU SERVEUR (ADR 0063, D4 ; plan §8).
 *
 * Deux limites de transport se cumulent dans Next 16.3 :
 *   · `serverActions.bodySizeLimit` (défaut 1 Mo, relevé à 10 Mo pour les CV) ;
 *   · `experimental.proxyClientMaxBodySize` (défaut 10 Mo) : la page du projet
 *     passe par `src/proxy.ts`, qui TRONQUE le corps au-delà — un fichier de
 *     12 Mo arriverait coupé et l'analyse multipart échouerait.
 * Les deux sont à « 16mb » : 15 Mo de fichier + l'enveloppe multipart.
 *
 * Mutation qui rougit : ne relever que l'une des deux.
 */

import { describe, expect, it } from "vitest";

import { TAILLE_MAX_FICHIER_OCTETS } from "../formats";

describe("la limite de corps laisse passer quinze Mo", () => {
  it("bodySizeLimit et proxyClientMaxBodySize valent 16mb, au-dessus de la limite d'un fichier", async () => {
    const config = (await import("../../../../../next.config")).default as {
      experimental?: {
        serverActions?: { bodySizeLimit?: string };
        proxyClientMaxBodySize?: string;
      };
    };
    expect(config.experimental?.serverActions?.bodySizeLimit).toBe("16mb");
    expect(config.experimental?.proxyClientMaxBodySize).toBe("16mb");
    expect(16 * 1024 * 1024).toBeGreaterThan(TAILLE_MAX_FICHIER_OCTETS);
  });
});
