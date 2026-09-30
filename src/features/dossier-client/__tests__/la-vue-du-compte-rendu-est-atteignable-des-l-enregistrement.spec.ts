// @vitest-environment node
/**
 * ⛔ LA VUE DU COMPTE RENDU EST ATTEIGNABLE DÈS L'ENREGISTREMENT.
 *
 * Le seul lien vers `rendez-vous?compteRendu=` n'apparaissait qu'une fois un
 * compte rendu IA rédigé. Or cette vue porte « Le client retire son accord »
 * (B2, où renvoie le refus 409 de l'enregistreur) et la réponse aux
 * enregistrements de moins de 90 s (G0b) : pendant le traitement, après un
 * échec, ou quand Will était attendu, elle était inatteignable.
 *
 * Mutation qui rougit : ne compter que les comptes rendus IA dans `aOuvrir`,
 * ou changer la règle de `attendReponseDeWill`.
 * Contre-témoin : un rendez-vous sans enregistrement n'a rien à ouvrir.
 */

import { describe, expect, it } from "vitest";

import type { PrismaClient } from "../../../../prisma/generated/client";
import { attendReponseDeWill, lireCircuitDeLaRencontre } from "../compte-rendu";

function base(o: {
  enregistrements: number;
  etapes: Array<{ etape: string; statut: string; classeErreur: string | null }>;
  crIa: number;
}): PrismaClient {
  return {
    enregistrement: { count: async () => o.enregistrements },
    traitementVisio: { findMany: async () => o.etapes },
    compteRendu: { count: async () => o.crIa },
  } as unknown as PrismaClient;
}

describe("la vue du compte rendu est atteignable dès l'enregistrement", () => {
  it("un enregistrement en traitement, sans compte rendu : la vue s'ouvre", async () => {
    const c = await lireCircuitDeLaRencontre(
      base({
        enregistrements: 1,
        etapes: [{ etape: "extraire", statut: "echec_definitif", classeErreur: "contenu" }],
        crIa: 0,
      }),
      "r1",
    );
    expect(c).toEqual({ aOuvrir: true, reponseAttendue: false });
  });

  it("un enregistrement court attend Will : la page le signale", async () => {
    const c = await lireCircuitDeLaRencontre(
      base({
        enregistrements: 1,
        etapes: [{ etape: "transcrire", statut: "suspendu", classeErreur: null }],
        crIa: 0,
      }),
      "r1",
    );
    expect(c).toEqual({ aOuvrir: true, reponseAttendue: true });
  });

  it("contre-témoin : sans enregistrement ni étape, rien à ouvrir", async () => {
    const c = await lireCircuitDeLaRencontre(
      base({ enregistrements: 0, etapes: [], crIa: 0 }),
      "r1",
    );
    expect(c).toEqual({ aOuvrir: false, reponseAttendue: false });
  });

  it("une suspension pour plafond n'est pas une question à Will", () => {
    expect(
      attendReponseDeWill({ etape: "transcrire", statut: "suspendu", classeErreur: "plafond" }),
    ).toBe(false);
  });
});
