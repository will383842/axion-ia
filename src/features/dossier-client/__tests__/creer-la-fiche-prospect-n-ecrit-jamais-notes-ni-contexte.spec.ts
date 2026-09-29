// @vitest-environment node
/**
 * « Créer la fiche prospect depuis ce rendez-vous » n'écrit JAMAIS `notes`,
 * `contexteIa` ni `besoinsIdentifies` : ce que le client a dit va dans des
 * faits, chiffrés et effaçables un par un — pas dans un texte libre de la
 * fiche (plan §3.13 point 1).
 *
 * Et elle passe PAR LA PORTE UNIQUE (anti-doublon B18), crée la personne du
 * titulaire Calendly (origine `calendly`), range la rencontre et relie le
 * participant — dans une transaction ; elle trace ce qui a été proposé et
 * retenu (`PreRemplissage`, chiffré).
 *
 * Mutation qui fait rougir : ajouter `notes: …` à `donneesDeLaFicheProspect`.
 * Contre-témoin : la raison sociale et la ville saisies, elles, sont écrites.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/qualiopi/crm/porte-client", async () => {
  const { porteSimulee } = await import("./_porte-simulee");
  return { creerOuRetrouverClient: porteSimulee };
});

import { creerProspectDepuisRencontre, donneesDeLaFicheProspect } from "../creer-prospect";
import { assurerRencontrePourCalendly } from "../rencontre-calendly";
import { appelsPorte } from "./_porte-simulee";
import { CLE_TEST, dossierEnMemoire, rendezVousCalendly } from "./_dossier-en-memoire";

const ADMIN = "00000000-0000-4000-8000-0000000000ad";
const CLE_INITIALE = process.env["PII_ENCRYPTION_KEY"];
beforeEach(() => {
  process.env["PII_ENCRYPTION_KEY"] = CLE_TEST;
  appelsPorte.length = 0;
});
afterEach(() => {
  if (CLE_INITIALE === undefined) delete process.env["PII_ENCRYPTION_KEY"];
  else process.env["PII_ENCRYPTION_KEY"] = CLE_INITIALE;
});

describe("créer la fiche prospect n'écrit jamais notes ni contexte", () => {
  it("les données de la fiche : nom, ville, type, source — rien d'autre", () => {
    const d = donneesDeLaFicheProspect({
      rencontreId: "r",
      raisonSociale: "  Menuiserie Fictive ",
      ville: "Grenoble",
      parAdminId: ADMIN,
    });
    expect(d).toEqual({
      type: "entreprise",
      raisonSociale: "Menuiserie Fictive",
      adresseVille: "Grenoble",
      source: "rendez-vous",
    });
    expect(Object.keys(d)).not.toEqual(expect.arrayContaining(["notes"]));
  });

  it("de bout en bout : par la porte, la rencontre rangée, le participant relié", async () => {
    const ev = rendezVousCalendly({
      rawPayload: {
        invitee: {
          questions_and_answers: [
            { question: "Nom de l'entreprise", answer: "Menuiserie Fictive" },
            { question: "Ville de l'entreprise", answer: "Grenoble" },
          ],
        },
      },
    });
    const base = dossierEnMemoire({ calendlyEvent: [ev] });
    const a = await assurerRencontrePourCalendly(base.client as never, ev["id"] as string, {
      borne: new Date("2026-10-01T00:00:00Z"),
    });
    if (a.statut !== "creee") throw new Error("rencontre");

    const r = await creerProspectDepuisRencontre(base.client as never, {
      rencontreId: a.rencontreId,
      raisonSociale: "Menuiserie Fictive",
      ville: "Grenoble",
      parAdminId: ADMIN,
    });
    expect(r.statut).toBe("cree");
    expect(appelsPorte).toHaveLength(1);
    expect(appelsPorte[0]?.options["origineContact"]).toBe("calendly");

    const fiche = base.tables["client"]?.[0];
    for (const interdit of ["notes", "contexteIa", "besoinsIdentifies"]) {
      expect(fiche?.[interdit]).toBeUndefined();
    }
    const rencontre = base.tables["rencontre"]?.[0];
    expect(rencontre?.["clientId"]).toBe(fiche?.["id"]);
    expect(rencontre?.["rattachementStatut"]).toBe("valide");
    const titulaire = base.tables["rencontreParticipant"]?.find((p) => p["role"] === "client");
    expect(titulaire?.["contactId"]).toBe(base.tables["clientContact"]?.[0]?.["id"]);

    const traces = base.tables["preRemplissage"] ?? [];
    expect(traces.map((t) => t["champ"]).sort()).toEqual(["client_raison_sociale", "client_ville"]);
    expect(traces.every((t) => String(t["valeurProposee"]).startsWith("enc:v1:"))).toBe(true);
  });
});
