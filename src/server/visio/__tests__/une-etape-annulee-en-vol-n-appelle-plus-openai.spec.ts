// @vitest-environment node
/**
 * ⛔ UNE ÉTAPE ANNULÉE EN VOL N'APPELLE PLUS OPENAI.
 *
 * P3 (`consolider`) fait un appel OpenAI PAR PÉRIMÈTRE. Si l'étape est
 * annulée pendant le premier appel (version remplacée par un rattachement,
 * réextraction), le périmètre suivant ne doit PAS partir : il serait facturé
 * pour un résultat orphelin. `verifierArret` ne voyait l'annulation qu'au
 * battement suivant (jusqu'à 60 s) ; `verifierMain` relit la main EN BASE
 * avant chaque appel.
 *
 * Mutation qui rougit : remettre `ctx.verifierArret()` à la place de
 * `await ctx.verifierMain()` dans la boucle de `consolider` → un second appel
 * part. Contre-témoin : sans annulation, les deux périmètres sont appelés et
 * l'étape réussit. Angle mort : un appel déjà PARTI n'est pas rappelé — il
 * est payé, son résultat est jeté.
 */

import { describe, expect, it, vi } from "vitest";

import { etatInitial } from "../etat-compte-rendu";
import { executerEtape } from "../etapes";
import { consolider } from "../passes-ia";
import type { DonneesPasses } from "../port-donnees";
import { depsDeTest, FauxDepot } from "../../../../tests/outils/faux-circuit-visio";
import { fauxClient, reponseReussie } from "../../../../tests/outils/faux-openai-visio";

// Deux périmètres, chacun avec un fait du jour : la préparation réelle
// exige un jeu de faits complet, sans rapport avec ce qui est prouvé ici.
vi.mock("../consolider", async (original) => {
  const m = await original<typeof import("../consolider")>();
  return {
    ...m,
    perimetresAConsolider: () => [
      { projetId: null, libelle: "l'entreprise", evoques: [] },
      { projetId: "p2", libelle: "projet 2", evoques: [] },
    ],
    construireEntreeP3: (perimetre: { projetId: string | null }) => ({
      perimetre,
      entree: `entrée ${perimetre.projetId ?? "entreprise"}`,
      refsEnvoyees: new Set<string>(),
      faitsDuJour: new Set(["F1"]),
    }),
  };
});

const RENCONTRE = "00000000-0000-4000-8000-0000000000f1";
const T0 = new Date("2026-10-06T10:00:00Z");
const SORTIE = { relations: [], ce_qui_a_change: [] };

function donnees(): DonneesPasses {
  return {
    rencontre: {
      id: RENCONTRE,
      titre: "Diagnostic",
      source: "calendly",
      clientId: "c1",
      debut: T0,
      dureeMs: 600_000,
    },
    compteRenduId: "cr1",
    statutCompteRendu: "brouillon",
    etat: etatInitial(T0, "x"),
    faitsDuJour: [],
    projets: [],
    faitsConnus: [],
  } as unknown as DonneesPasses;
}

function monter(annulerPendantLePremierAppel: boolean) {
  const depot = new FauxDepot();
  const t = depot.ajouter({ rencontreId: RENCONTRE, etape: "consolider", compteRenduId: "cr1" });
  const f = fauxClient(undefined, {
    reponses: [reponseReussie(SORTIE), reponseReussie(SORTIE)],
  });
  const client: typeof f.client = {
    ...f.client,
    repondre: async (d) => {
      const r = await f.client.repondre(d);
      // L'annulation (`annulerEtapesDesVersions`) tombe pendant l'appel.
      if (annulerPendantLePremierAppel) depot.ligne(t.id).statut = "annule";
      return r;
    },
  };
  const deps = depsDeTest({
    depot,
    client,
    gestionnaires: { consolider },
    donnees: { pourPasses: async () => donnees(), majEtat: async () => undefined },
  });
  return { deps, t, f, depot };
}

describe("⛔ une étape annulée en vol n'appelle plus OpenAI", () => {
  it("annulée pendant le premier périmètre : aucun second appel, rien n'est écrit", async () => {
    const { deps, t, f, depot } = monter(true);
    expect(await executerEtape(deps, t.id)).not.toBe("reussie");
    expect(f.demandesReponse).toHaveLength(1);
    expect(depot.ecritures).toEqual([]);
    expect(depot.ligne(t.id).statut).toBe("annule");
  });

  it("contre-témoin : sans annulation, les deux périmètres partent et l'étape réussit", async () => {
    const { deps, t, f } = monter(false);
    expect(await executerEtape(deps, t.id)).toBe("reussie");
    expect(f.demandesReponse).toHaveLength(2);
  });
});
