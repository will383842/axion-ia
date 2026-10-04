/**
 * Lot OPCO A8 — alertes « à appeler » : le texte nomme l'entreprise et donne
 * le téléphone du contact (lien `tel:` en console seulement), la cible mène à
 * la session.
 */

import { describe, expect, it } from "vitest";
import type { ContexteSuivi } from "@/server/qualiopi/financements/suivi-entreprise/lecture";
import { candidatsSuiviEntreprise } from "./regle-suivi-entreprise-opco";
import { segmentsAvecTelephone } from "./telephone-message";

const midi = (j: string) => new Date(`${j}T10:00:00.000Z`);

function contexte(tel: string | null, relances: number): ContexteSuivi {
  const messages = [
    { etape: "envoi" as const, rang: 0, jourParis: "2026-10-01" },
    ...Array.from({ length: relances }, (_, i) => ({
      etape: "relance_depot" as const,
      rang: i + 1,
      jourParis: `2026-10-0${i + 5}`,
    })),
  ].map((m) => ({
    ...m,
    question: "depot" as const,
    envoyeLe: midi(m.jourParis),
    reponse: null,
    reponduLe: null,
  }));
  return {
    brut: {} as ContexteSuivi["brut"],
    sessionId: "t1",
    numeroSession: "AXI-SESS-2026-042",
    intituleFormation: "IA",
    dateDebutSession: midi("2026-11-16"),
    entreprise: {
      id: "c1",
      raisonSociale: "ACME SAS",
      contactNom: "Claire Martin",
      contactEmail: "rh@acme.fr",
      contactTelephone: tel,
    },
    opco: "atlas",
    nomOpco: "Atlas",
    dateLimiteDepot: null,
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
      messages,
    },
  };
}

describe("alertes « à appeler »", () => {
  it("🔴 après trois relances : nom de l'entreprise, téléphone, cible session", () => {
    const [a] = candidatsSuiviEntreprise([contexte("06 12 34 56 78", 3)], midi("2026-10-14"));
    expect(a).toMatchObject({
      code: "entreprise_a_appeler_depot",
      cibleType: "TrainingSession",
      cibleId: "t1",
    });
    expect(a!.message).toContain("ACME SAS");
    expect(a!.message).toContain("06 12 34 56 78");
    expect(a!.message).toContain("page Financement");
    // Le nom de la personne n'est pas nécessaire : l'entreprise et le numéro suffisent.
    expect(a!.message).not.toContain("Claire Martin");
  });

  it("sans téléphone en base : le message le dit", () => {
    const [a] = candidatsSuiviEntreprise([contexte(null, 3)], midi("2026-10-14"));
    expect(a!.message).toContain("aucun téléphone sur la fiche client");
  });

  it("deux relances : pas encore d'alerte", () => {
    expect(candidatsSuiviEntreprise([contexte("06 12 34 56 78", 2)], midi("2026-10-14"))).toEqual(
      [],
    );
  });

  it("console : le numéro devient un lien tel:, seulement pour ces codes", () => {
    const s = segmentsAvecTelephone(
      "entreprise_a_appeler_depot",
      "Appelez le contact au 06 12 34 56 78, puis…",
    );
    expect(s.find((x) => x.tel)).toEqual({ texte: "06 12 34 56 78", tel: "0612345678" });
    expect(segmentsAvecTelephone("autre_code", "SIRET 01234567890123")).toEqual([
      { texte: "SIRET 01234567890123", tel: null },
    ]);
    expect(
      segmentsAvecTelephone("opco_refus_a_traiter", "SIRET 01234567890123").some((x) => x.tel),
    ).toBe(false);
  });
});
