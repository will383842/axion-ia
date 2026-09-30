/**
 * ⛔ LA CONFIRMATION VISE L'ENREGISTREMENT EN ATTENTE, PAS LE DERNIER DÉPOSÉ.
 *
 * Après « Arrêter » puis une relance, une rencontre porte plusieurs
 * enregistrements déposés. Le geste de Will (« enregistrement court » ou
 * « personne sans accord ») doit marquer CELUI qui bloque la transcription,
 * désigné par son identifiant — jamais « le plus récent déposé », qui peut
 * être un autre enregistrement que Will n'a pas vérifié.
 *
 * Mutation qui rougit : revenir à `findFirst({ statut: "depose", orderBy:
 * debut desc })` sans l'identifiant → l'enregistrement récent est marqué.
 * Contre-témoin : un identifiant d'une autre rencontre est refusé.
 */

import { describe, expect, it } from "vitest";

import {
  confirmerEnregistrementCourt,
  confirmerFenetresVerifiees,
  GesteRefuse,
} from "../gestes-compte-rendu";
import { baseEspion } from "../../../../tests/outils/base-espion";

const RENCONTRE = "00000000-0000-4000-8000-0000000000f1";
const AUTRE = "00000000-0000-4000-8000-0000000000f2";
const MAINTENANT = new Date("2026-10-06T12:00:00Z");

interface Ligne {
  id: string;
  rencontreId: string;
  statut: string;
  motifArret: string;
  debut: Date;
  evenements: string | null;
}

/** Deux enregistrements déposés : l'ancien bloque, le récent a été clos par l'extension. */
function base() {
  const lignes: Ligne[] = [
    {
      id: "e-attente",
      rencontreId: RENCONTRE,
      statut: "depose",
      motifArret: "cloture_serveur",
      debut: new Date("2026-10-06T10:00:00Z"),
      evenements: null,
    },
    {
      id: "e-recent",
      rencontreId: RENCONTRE,
      statut: "depose",
      motifArret: "manuel",
      debut: new Date("2026-10-06T11:00:00Z"),
      evenements: null,
    },
  ];
  const trouver = (a: Record<string, unknown>) => {
    const w = (a["where"] ?? {}) as Partial<Ligne>;
    return (
      lignes
        .filter((l) => (w.id === undefined || l.id === w.id) && l.rencontreId === w.rencontreId)
        .filter((l) => w.statut === undefined || l.statut === w.statut)
        .sort((x, y) => y.debut.getTime() - x.debut.getTime())[0] ?? null
    );
  };
  return baseEspion({
    "enregistrement.findFirst": trouver,
    "enregistrement.findUnique": trouver,
  });
}

function marques(e: ReturnType<typeof base>): Array<{ id: unknown; evenements: string }> {
  return e.de("enregistrement", "update").map((a) => ({
    id: (a.args["where"] as { id: unknown }).id,
    evenements: String((a.args["data"] as { evenements: string }).evenements),
  }));
}

describe("la confirmation vise l'enregistrement en attente", () => {
  it("« court » marque l'enregistrement désigné, pas le plus récent", async () => {
    const e = base();
    await confirmerEnregistrementCourt(e.base, {
      rencontreId: RENCONTRE,
      enregistrementId: "e-attente",
      maintenant: MAINTENANT,
    });
    const m = marques(e);
    expect(m.map((x) => x.id)).toEqual(["e-attente"]);
    expect(m[0]!.evenements).toContain("court_confirme");
  });

  it("« personne sans accord » pose `fenetres_verifiees` sur l'enregistrement désigné", async () => {
    const e = base();
    await confirmerFenetresVerifiees(e.base, {
      rencontreId: RENCONTRE,
      enregistrementId: "e-attente",
      maintenant: MAINTENANT,
    });
    const m = marques(e);
    expect(m.map((x) => x.id)).toEqual(["e-attente"]);
    expect(m[0]!.evenements).toContain("fenetres_verifiees");
    expect(m[0]!.evenements).not.toContain("court_confirme");
  });

  it("contre-témoin : un enregistrement d'une autre rencontre est refusé", async () => {
    const e = base();
    await expect(
      confirmerFenetresVerifiees(e.base, {
        rencontreId: AUTRE,
        enregistrementId: "e-attente",
        maintenant: MAINTENANT,
      }),
    ).rejects.toBeInstanceOf(GesteRefuse);
    expect(marques(e)).toEqual([]);
  });

  it("« personne sans accord » est refusé sur un enregistrement que l'extension a clos", async () => {
    const e = base();
    await expect(
      confirmerFenetresVerifiees(e.base, {
        rencontreId: RENCONTRE,
        enregistrementId: "e-recent",
        maintenant: MAINTENANT,
      }),
    ).rejects.toBeInstanceOf(GesteRefuse);
  });
});
