// @vitest-environment node

/**
 * UN FICHIER DE 15 MO ARRIVE ENTIER AU SERVEUR (ADR 0063, D4 ; plan §8).
 *
 * Deux limites de transport se cumulent dans Next 16.3 :
 *   · `serverActions.bodySizeLimit` (défaut 1 Mo, relevé à 10 Mo pour les CV) ;
 *   · `experimental.proxyClientMaxBodySize` (défaut 10 Mo) : la page du projet
 *     passe par `src/proxy.ts`, qui TRONQUE le corps au-delà — un fichier de
 *     12 Mo arriverait coupé et l'analyse multipart échouerait.
 * Les deux étaient à « 16mb » (15 Mo de fichier + l'enveloppe multipart) ; elles
 * sont à « 21mb » depuis le 2026-10-15 (pièces jointes du formulaire de contact,
 * 20 Mo au total) — toujours au-dessus des 15 Mo d'un document de projet.
 *
 * Mutation qui rougit : ne relever que l'une des deux.
 */

import { describe, expect, it } from "vitest";

import { TAILLE_MAX_FICHIER_OCTETS } from "../formats";
import { TAILLE_MAX_TOTALE_OCTETS } from "@/lib/contact/pieces-jointes";

describe("la limite de corps laisse passer quinze Mo", () => {
  it("bodySizeLimit et proxyClientMaxBodySize valent 21mb, au-dessus de la limite d'un fichier", async () => {
    const config = (await import("../../../../../next.config")).default as {
      experimental?: {
        serverActions?: { bodySizeLimit?: string };
        proxyClientMaxBodySize?: string;
      };
    };
    expect(config.experimental?.serverActions?.bodySizeLimit).toBe("21mb");
    expect(config.experimental?.proxyClientMaxBodySize).toBe("21mb");
    expect(21 * 1024 * 1024).toBeGreaterThan(TAILLE_MAX_FICHIER_OCTETS);
    // Pièces jointes du contact : 20 Mo de fichiers + au moins 512 Ko d'enveloppe.
    expect(21 * 1024 * 1024 - TAILLE_MAX_TOTALE_OCTETS).toBeGreaterThanOrEqual(512 * 1024);
    // Charger `next.config.ts` (Sentry, next-intl…) dépasse 5 s sur une suite chargée.
  }, 30_000);
});
