import { describe, expect, it } from "vitest";
import { friseSuivi } from "./frise";
import type { ContexteSuivi } from "./lecture";

const midi = (j: string) => new Date(`${j}T10:00:00.000Z`);

describe("frise du suivi (console)", () => {
  it("envoi, relances, réponses datées, prochaine relance ; aucun jeton ni adresse", () => {
    const c = {
      brut: { suiviEntreprise: { envoiAutomatique: true, accordFichierKey: null } },
      dossier: {
        statut: "a_monter",
        depotFaitLe: null,
        accordEcritLe: null,
        accordAt: null,
        envoyeAt: null,
        dateDebutSession: midi("2026-11-16"),
        dateLimiteDepot: null,
      },
      suivi: {
        id: "s1",
        envoyeLe: midi("2026-10-01"),
        relancesArreteesLe: null,
        refusDeclareLe: null,
        messages: [
          {
            etape: "envoi",
            rang: 0,
            question: "depot",
            jourParis: "2026-10-01",
            envoyeLe: midi("2026-10-01"),
            reponse: null,
            reponduLe: null,
          },
          {
            etape: "relance_depot",
            rang: 1,
            question: "depot",
            jourParis: "2026-10-05",
            envoyeLe: midi("2026-10-05"),
            reponse: "pas_encore",
            reponduLe: midi("2026-10-06"),
          },
        ],
      },
    } as unknown as ContexteSuivi;
    const f = friseSuivi(c, midi("2026-10-06"));
    expect(f).toMatchObject({
      envoyeLe: "2026-10-01",
      envoiAutomatique: true,
      relancesFaites: 1,
      prochaineRelance: { jour: "2026-10-08", libelle: "relance dépôt n° 2" },
    });
    expect(f!.evenements.map((e) => `${e.jour} ${e.libelle}`)).toEqual([
      "2026-10-01 Dossier envoyé",
      "2026-10-05 Relance dépôt n° 1",
      "2026-10-06 Réponse de l'entreprise : pas encore",
    ]);
    expect(JSON.stringify(f)).not.toMatch(/jeton|@/);
  });
});
