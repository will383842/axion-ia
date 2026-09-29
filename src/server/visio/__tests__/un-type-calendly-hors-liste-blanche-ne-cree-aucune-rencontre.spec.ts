// @vitest-environment node
/**
 * ⛔ Un rendez-vous Calendly HORS de la liste blanche — échange apporteur,
 * entretien de candidat, type inconnu — ne crée AUCUNE rencontre au dossier
 * client (principe PA-9 du plan).
 *
 * Mutation qui fait rougir : faire rendre `true` à `estTypeDuDossier` pour
 * tout nom non vide → l'apporteur et le type inconnu créent une rencontre.
 * Contre-témoin : « Discutons de votre projet IA » en crée une.
 * Angle mort : un type client RENOMMÉ dans Calendly sort de la liste blanche
 * sans bruit (le rendez-vous reste dans l'onglet, sans dossier) — la liste
 * se relit quand un type change de nom.
 */

import { describe, expect, it } from "vitest";

import { assurerRencontrePourCalendly } from "@/features/dossier-client/rencontre-calendly";
import {
  dossierEnMemoire,
  rendezVousCalendly,
} from "@/features/dossier-client/__tests__/_dossier-en-memoire";
import { estRendezVousDuDossier, estTypeDuDossier } from "../liste-blanche-types";

const BORNE = new Date("2026-10-01T00:00:00Z");

describe("⛔ un type Calendly hors liste blanche ne crée aucune rencontre", () => {
  it.each([
    ["Échange apporteur d'affaires (15 min)", null],
    ["Entretien de recrutement", null],
    ["Type inventé demain", null],
    ["Discutons de votre projet IA", "00000000-0000-4000-8000-000000000001"],
  ])("« %s » (candidature %s) : aucune rencontre", async (nom, candidature) => {
    const ev = rendezVousCalendly({ eventTypeName: nom, linkedJobApplicationId: candidature });
    const base = dossierEnMemoire({ calendlyEvent: [ev] });
    const r = await assurerRencontrePourCalendly(base.client as never, ev["id"] as string, {
      borne: BORNE,
    });
    expect(r.statut).toBe("hors_liste_blanche");
    expect(base.tables["rencontre"] ?? []).toHaveLength(0);
    expect(base.tables["rencontreParticipant"] ?? []).toHaveLength(0);
  });

  it("contre-témoin : « Discutons de votre projet IA » crée sa rencontre", async () => {
    const ev = rendezVousCalendly({ eventTypeName: "Discutons  de votre projet IA (45 min)" });
    const base = dossierEnMemoire({ calendlyEvent: [ev] });
    const r = await assurerRencontrePourCalendly(base.client as never, ev["id"] as string, {
      borne: BORNE,
    });
    expect(r.statut).toBe("creee");
    expect(base.tables["rencontre"]).toHaveLength(1);
  });

  it("la règle, sans la base", () => {
    expect(estTypeDuDossier("Discutons de votre projet IA")).toBe(true);
    expect(estTypeDuDossier("discutons de votre projet")).toBe(true);
    expect(estTypeDuDossier("Pour info : discutons de votre projet")).toBe(false);
    expect(estTypeDuDossier("Discutons de votre projet d'apporteur")).toBe(false);
    expect(estTypeDuDossier("")).toBe(false);
    expect(estTypeDuDossier(null)).toBe(false);
    expect(
      estRendezVousDuDossier({
        eventTypeName: "Discutons de votre projet IA",
        linkedJobApplicationId: "x",
      }),
    ).toBe(false);
  });
});
