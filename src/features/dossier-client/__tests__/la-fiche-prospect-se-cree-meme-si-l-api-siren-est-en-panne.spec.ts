// @vitest-environment node
/**
 * La fiche prospect se crée MÊME SI l'annuaire des entreprises est en panne
 * (plan §3.17 point 4, vérification C9) : l'annuaire ne fait que PROPOSER un
 * SIREN à l'affichage ; en panne, il ne propose rien, et la fiche se crée
 * sans SIREN (« SIREN à compléter »). Aucun SIREN n'est posé sans le clic de
 * Will.
 *
 * Contre-témoin : un SIREN confirmé d'un clic est transmis à la porte, et sa
 * trace dit « gardé ».
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/qualiopi/crm/porte-client", async () => {
  const { porteSimulee } = await import("./_porte-simulee");
  return { creerOuRetrouverClient: porteSimulee };
});

import { rechercherSiren, viderCacheAnnuaire } from "../recherche-entreprises";
import { creerProspectDepuisRencontre } from "../creer-prospect";
import { assurerRencontrePourCalendly } from "../rencontre-calendly";
import { appelsPorte } from "./_porte-simulee";
import { CLE_TEST, dossierEnMemoire, rendezVousCalendly } from "./_dossier-en-memoire";

const ADMIN = "00000000-0000-4000-8000-0000000000ad";
const CLE_INITIALE = process.env["PII_ENCRYPTION_KEY"];
beforeEach(() => {
  process.env["PII_ENCRYPTION_KEY"] = CLE_TEST;
  appelsPorte.length = 0;
  viderCacheAnnuaire();
});
afterEach(() => {
  if (CLE_INITIALE === undefined) delete process.env["PII_ENCRYPTION_KEY"];
  else process.env["PII_ENCRYPTION_KEY"] = CLE_INITIALE;
});

async function scene() {
  const ev = rendezVousCalendly();
  const base = dossierEnMemoire({ calendlyEvent: [ev] });
  const a = await assurerRencontrePourCalendly(base.client as never, ev["id"] as string, {
    borne: new Date("2026-10-01T00:00:00Z"),
  });
  if (a.statut !== "creee") throw new Error("rencontre");
  return { base, rencontreId: a.rencontreId };
}

describe("la fiche prospect se crée même si l'API SIREN est en panne", () => {
  it("annuaire en panne : aucune proposition, fiche créée sans SIREN", async () => {
    const panne = vi.fn(async () => {
      throw new Error("réseau");
    });
    const annuaire = await rechercherSiren("Menuiserie Fictive", "Grenoble", {
      fetch: panne as never,
    });
    expect(annuaire.ok).toBe(false);

    const { base, rencontreId } = await scene();
    const r = await creerProspectDepuisRencontre(base.client as never, {
      rencontreId,
      raisonSociale: "Menuiserie Fictive",
      parAdminId: ADMIN,
    });
    expect(r.statut).toBe("cree");
    expect(appelsPorte[0]?.donnees["siren"]).toBeUndefined();
    expect(base.tables["client"]?.[0]?.["siren"]).toBeUndefined();
  });

  it("contre-témoin : un SIREN confirmé est transmis, et tracé « gardé »", async () => {
    const { base, rencontreId } = await scene();
    await creerProspectDepuisRencontre(
      base.client as never,
      {
        rencontreId,
        raisonSociale: "Menuiserie Fictive",
        sirenConfirme: "732 829 320",
        parAdminId: ADMIN,
      },
      { sirenPropose: "732829320" },
    );
    expect(appelsPorte[0]?.donnees["siren"]).toBe("732829320");
    const trace = base.tables["preRemplissage"]?.find((t) => t["champ"] === "client_siren");
    expect(trace?.["sort"]).toBe("garde");
  });
});
