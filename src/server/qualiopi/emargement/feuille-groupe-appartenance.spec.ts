/**
 * 🔴 UN FORMATEUR NE LIT QUE LES SESSIONS QU'IL ANIME.
 *
 * ## Le défaut
 *
 * `lireFeuilleGroupe` recevait déjà `trainerId` — mais ne s'en servait **que**
 * pour filtrer les contresignatures déjà posées. Elle rendait donc les noms des
 * inscrits et les créneaux de **n'importe quelle** session.
 *
 * Elle était sûre uniquement parce que son unique appelant gardait *avant* de
 * l'appeler.
 *
 * ## Pourquoi ce n'est pas « théorique »
 *
 * ⚠️ Une sécurité qui repose sur l'**ordre d'appel** tient tant qu'il n'y a
 * qu'un appelant. Le Lot 7 (« l'espace formateur comme poste de pilotage ») va
 * précisément en multiplier. Le second appelant qui inverserait l'ordre
 * ouvrirait la fuite **sans qu'aucun test ne bouge** — le premier continuant de
 * passer.
 *
 * Et la fuite serait la pire du produit : les stagiaires d'une entreprise
 * lisibles par un formateur qui travaille pour un concurrent.
 *
 * ## Pourquoi ce fichier existe
 *
 * Aucun test ne couvrait l'appartenance ici. Vérifié en désarmant la garde
 * nouvellement posée : la suite entière restait **verte**. Une garde que rien
 * ne fait rougir ne garde rien.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

const mockFindFirst = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: { trainingSession: { findFirst: (...a: unknown[]) => mockFindFirst(...a) } },
}));

import { lireFeuilleGroupe } from "./feuille-groupe";

const SESSION = "11111111-1111-1111-1111-111111111111";
const FORMATEUR = "22222222-2222-2222-2222-222222222222";
const MAINTENANT = new Date("2026-08-17T10:00:00Z");

beforeEach(() => {
  mockFindFirst.mockReset();
  // La lecture ne trouve rien : c'est ce que Prisma rend quand le `where`
  // combine l'identifiant ET l'appartenance, et que celle-ci échoue.
  mockFindFirst.mockResolvedValue(null);
});

describe("🔴 la garde d'appartenance est DANS la lecture", () => {
  it("le `where` combine l'identifiant de session ET l'appartenance", async () => {
    await lireFeuilleGroupe(SESSION, MAINTENANT, "Axion IA", FORMATEUR);

    const where = (mockFindFirst.mock.calls[0]?.[0] as { where: Record<string, unknown> }).where;
    expect(where["id"]).toBe(SESSION);

    // 🔴 Le cœur du test : sans cette clause, la requête rendrait la session de
    // n'importe qui. On vérifie la FORME exacte du SSOT `whereSessionsDuFormateur`
    // — formateur principal OU membre de l'équipe — plutôt qu'une recopie.
    const or = where["OR"] as Array<Record<string, unknown>>;
    expect(Array.isArray(or)).toBe(true);
    expect(or).toHaveLength(2);
    expect(or[0]).toEqual({ formateurPrincipalId: FORMATEUR });
    expect(or[1]).toEqual({ sessionFormateurs: { some: { trainerId: FORMATEUR } } });
  });

  it("session non trouvée (ou pas la sienne) → null, pas une feuille vide", async () => {
    // ⚠️ `null` et non `[]` : une liste vide se lirait « cette session n'a
    // aucune demi-journée », ce qui est une information FAUSSE sur une session
    // qui ne le regarde pas. `null` est indiscernable de « pas de feuille ».
    expect(await lireFeuilleGroupe(SESSION, MAINTENANT, "Axion IA", FORMATEUR)).toBeNull();
  });

  it("elle interroge `findFirst`, jamais `findUnique`", async () => {
    // `findUnique` n'accepte QUE des champs uniques dans son `where` : il ne
    // peut pas porter la clause d'appartenance. Revenir à `findUnique` serait
    // donc revenir au défaut — et ce test le dirait.
    await lireFeuilleGroupe(SESSION, MAINTENANT, "Axion IA", FORMATEUR);
    expect(mockFindFirst).toHaveBeenCalledTimes(1);
  });
});
