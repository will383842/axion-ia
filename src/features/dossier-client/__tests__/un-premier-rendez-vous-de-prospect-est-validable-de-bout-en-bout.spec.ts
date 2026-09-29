// @vitest-environment node
/**
 * ⛔ Un PREMIER rendez-vous de prospect est validable de bout en bout (plan
 * V5-C2, scénario 2 « prospect inconnu, note manuelle ») :
 *
 *   rendez-vous Calendly « Discutons » → rencontre « à classer » →
 *   « Créer la fiche prospect » (par la porte) → « Valider et préparer le
 *   devis » avec un NOUVEAU projet et la note → faits validés, compte rendu
 *   validé, suivi « devis » écrit dans les deux tables.
 *
 * Sans la création du projet DANS la même action, aucun fait de besoin d'un
 * premier rendez-vous ne serait validable (CHECK `faits_valide_range`).
 *
 * Mutation qui fait rougir : ne pas créer le projet dans `validerApresLAppel`
 * (mode « nouveau » ignoré) → la note refuse le besoin (« se rangent dans un
 * projet »).
 * Angle mort : les clics de l'écran (≤ 8 pour ce scénario) se comptent à la
 * main, sur la production — écrits dans la description de la PR.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/qualiopi/crm/porte-client", async () => {
  const { porteSimulee } = await import("./_porte-simulee");
  return { creerOuRetrouverClient: porteSimulee };
});

import { creerProspectDepuisRencontre } from "../creer-prospect";
import { assurerRencontrePourCalendly } from "../rencontre-calendly";
import { validerApresLAppel } from "../valider";
import { CLE_TEST, dossierEnMemoire, rendezVousCalendly } from "./_dossier-en-memoire";

const ADMIN = "00000000-0000-4000-8000-0000000000ad";
const CLE_INITIALE = process.env["PII_ENCRYPTION_KEY"];
beforeEach(() => {
  process.env["PII_ENCRYPTION_KEY"] = CLE_TEST;
});
afterEach(() => {
  if (CLE_INITIALE === undefined) delete process.env["PII_ENCRYPTION_KEY"];
  else process.env["PII_ENCRYPTION_KEY"] = CLE_INITIALE;
});

describe("⛔ un premier rendez-vous de prospect est validable de bout en bout", () => {
  it("rendez-vous → fiche prospect → projet + note + suite, validés", async () => {
    const ev = rendezVousCalendly({ inviteeEmail: "camille@gmail.com" });
    const base = dossierEnMemoire({ calendlyEvent: [ev] });

    const a = await assurerRencontrePourCalendly(base.client as never, ev["id"] as string, {
      borne: new Date("2026-10-01T00:00:00Z"),
    });
    if (a.statut !== "creee") throw new Error("rencontre");
    expect(base.tables["rencontre"]?.[0]?.["rattachementStatut"]).toBe("a_classer");

    const p = await creerProspectDepuisRencontre(base.client as never, {
      rencontreId: a.rencontreId,
      raisonSociale: "Menuiserie Fictive",
      parAdminId: ADMIN,
    });
    expect(p.statut).toBe("cree");

    const v = await validerApresLAppel(base.client as never, {
      rencontreId: a.rencontreId,
      parAdminId: ADMIN,
      projet: { mode: "nouveau", titre: "Formation IA de l'équipe" },
      faitsCoches: [],
      note: {
        activite: "Menuiserie sur mesure",
        besoin: "Former 12 personnes à l'IA",
        budget: "environ 5 000 €",
        prochaineEtape: "Envoyer le devis",
      },
      suivi: { issue: "eu_lieu", suite: "devis", suiteLe: new Date("2026-10-09T00:00:00Z") },
    });

    const t = base.tables;
    expect(v.projetId).not.toBeNull();
    expect(t["projet"]).toHaveLength(1);
    expect(t["rencontre"]?.[0]).toMatchObject({
      rattachementStatut: "valide",
      projetId: v.projetId,
    });
    const faits = t["fait"] ?? [];
    expect(faits).toHaveLength(4);
    expect(faits.every((f) => f["statut"] === "valide")).toBe(true);
    expect(faits.find((f) => f["type"] === "besoin")?.["projetId"]).toBe(v.projetId);
    expect(faits.find((f) => f["type"] === "activite")?.["portee"]).toBe("entreprise");
    expect(t["compteRendu"]?.[0]).toMatchObject({ origine: "manuel", statut: "valide" });
    expect(t["rencontreSuivi"]?.[0]?.["suite"]).toBe("devis");
    expect(t["rendezVousSuivi"]?.[0]?.["suite"]).toBe("devis");
  });
});
