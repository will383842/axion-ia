// @vitest-environment node
/**
 * ⛔ Une rencontre SAISIE dans la console (visio) est proposée à l'extension
 * Meet dans la liste du moment (plan V-05b). Sans cela, un client qui revient
 * pour un deuxième rendez-vous — hors Calendly — ne serait jamais
 * enregistrable. La route `GET /api/enregistreur/rencontres-du-jour` (PR 5)
 * rejoue ce test sur la même fonction.
 *
 * Mutation qui fait rougir : retirer `{ source: "saisie_manuelle", type:
 * "visio" }` du filtre de `rencontresEnregistrablesDuJour` → rouge.
 * Contre-témoins : une rencontre saisie TÉLÉPHONE n'y est pas (rien à
 * enregistrer) ; une visio de dans deux jours n'y est pas (hors fenêtre) ; un
 * rendez-vous Calendly de la liste blanche y est, sa rencontre assurée à la
 * demande.
 */

import { describe, expect, it } from "vitest";

import { rencontresEnregistrablesDuJour } from "@/server/visio/rencontres-du-jour";
import { dossierEnMemoire, fiche, id, rendezVousCalendly } from "./_dossier-en-memoire";

const MAINTENANT = new Date("2026-10-06T07:00:00Z");

function saisie(clientId: unknown, type: string, debut: Date) {
  return {
    id: id(5),
    source: "saisie_manuelle",
    type,
    titre: `Rendez-vous ${type}`,
    clientId,
    rattachementStatut: "valide",
    statut: "planifie",
    estTestInterne: false,
    debutPrevu: debut,
  };
}

describe("⛔ une rencontre saisie est proposée à l'extension", () => {
  it("la visio saisie du jour y est ; le téléphone et l'après-demain non", async () => {
    const f = fiche({ raisonSociale: "Fiche Fictive" });
    const visio = saisie(f["id"], "visio", new Date("2026-10-06T09:00:00Z"));
    const tel = saisie(f["id"], "telephone", new Date("2026-10-06T10:00:00Z"));
    const loin = saisie(f["id"], "visio", new Date("2026-10-08T09:00:00Z"));
    const cal = rendezVousCalendly({ startTime: new Date("2026-10-06T12:00:00Z") });
    const base = dossierEnMemoire({
      client: [f],
      rencontre: [visio, tel, loin],
      calendlyEvent: [cal],
    });

    const liste = await rencontresEnregistrablesDuJour(base.client as never, MAINTENANT);
    const ids = liste.map((x) => x.rencontreId);
    expect(ids).toContain(visio.id);
    expect(ids).not.toContain(tel.id);
    expect(ids).not.toContain(loin.id);
    // Le rendez-vous Calendly du jour : sa rencontre est assurée à la demande.
    expect(liste.some((x) => x.source === "calendly")).toBe(true);
    expect(liste).toHaveLength(2);
  });
});
