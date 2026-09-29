/**
 * ⛔ UN QUOTA ÉPUISÉ SUSPEND TOUTES LES ÉTAPES (ADR 0055 §1.4).
 *
 * OpenAI répond 429 `insufficient_quota` (crédit du compte épuisé) : réessayer
 * ne peut pas réussir tant qu'un humain n'a pas rechargé. L'étape passe
 * `suspendu` (classe `quota`), toutes les étapes en attente aussi, une alerte
 * critique part ; AUCUNE reprise automatique n'est programmée.
 *
 * Mutation qui rougit : classer `quota_exhausted` en `passagere` dans
 * `erreurs.ts` → l'étape repart en `a_faire` avec une date de reprise.
 * Contre-témoin : un 429 « limite de débit » reste passager (reprise à +5 min).
 * Angle mort : la forme exacte du 429 d'OpenAI est celle que content-gen a
 * relevée en production (21/07, 01/09) ; une troisième forme passerait.
 */

import OpenAI from "openai";
import { describe, expect, it } from "vitest";

import { executerEtape, type Gestionnaire } from "../../etapes";
import { classerErreurOpenAI } from "../erreurs";
import { depsDeTest, FauxDepot } from "../../../../../tests/outils/faux-circuit-visio";

function erreur429(type: string, code: string): Error {
  return OpenAI.APIError.generate(429, { error: { type, code, message: "x" } }, "x", {});
}

describe("un quota épuisé suspend toutes les étapes", () => {
  it("quota : l'étape et tout ce qui attend sont suspendus, sans reprise programmée", async () => {
    const depot = new FauxDepot();
    const cible = depot.ajouter({ rencontreId: "r1", etape: "transcrire" });
    const autres = [
      depot.ajouter({ rencontreId: "r2", etape: "transcrire" }),
      depot.ajouter({ rencontreId: "r3", etape: "extraire" }),
    ];
    const g: Gestionnaire = async () => {
      throw classerErreurOpenAI(erreur429("insufficient_quota", "insufficient_quota"));
    };
    const deps = depsDeTest({ depot, gestionnaires: { transcrire: g } });
    expect(await executerEtape(deps, cible.id)).toBe("suspendue");
    expect(depot.ligne(cible.id)).toMatchObject({
      statut: "suspendu",
      classeErreur: "quota",
      prochaineTentativeLe: null,
    });
    expect(autres.map((a) => depot.ligne(a.id).statut)).toEqual(["suspendu", "suspendu"]);
    expect(deps.alertes[0]).toMatchObject({ code: "visio.circuit_suspendu", niveau: "critique" });
  });

  it("contre-témoin : une limite de débit reste passagère", () => {
    expect(classerErreurOpenAI(erreur429("requests", "rate_limit_exceeded"))).toMatchObject({
      classe: "passagere",
      code: "limite_debit",
    });
    expect(
      classerErreurOpenAI(erreur429("insufficient_quota", "credit_balance_exhausted")),
    ).toMatchObject({ classe: "quota" });
  });
});
