// @vitest-environment node
/**
 * « Valider et préparer le devis » écrit, dans UNE transaction, la note
 * (faits validés + compte rendu `manuel` validé), le suivi de la rencontre,
 * et sa recopie dans l'onglet « Rendez-vous » si le lien Calendly vit.
 *
 * Contre-témoin (tout ou rien) : si le suivi est refusé (« A eu lieu » sans
 * suite), la note n'est PAS écrite non plus.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { validerApresLAppel } from "../valider";
import { CLE_TEST, dossierEnMemoire, fiche, id, rendezVousCalendly } from "./_dossier-en-memoire";

const ADMIN = "00000000-0000-4000-8000-0000000000ad";
const CLE_INITIALE = process.env["PII_ENCRYPTION_KEY"];
beforeEach(() => {
  process.env["PII_ENCRYPTION_KEY"] = CLE_TEST;
});
afterEach(() => {
  if (CLE_INITIALE === undefined) delete process.env["PII_ENCRYPTION_KEY"];
  else process.env["PII_ENCRYPTION_KEY"] = CLE_INITIALE;
});

function scene() {
  const f = fiche({ raisonSociale: "Fiche Fictive" });
  const ev = rendezVousCalendly();
  const rencontreId = id(5);
  const base = dossierEnMemoire({
    client: [f],
    calendlyEvent: [ev],
    rencontre: [
      {
        id: rencontreId,
        source: "calendly",
        type: "visio",
        titre: "Discutons de votre projet IA",
        calendlyEventId: ev["id"],
        clientId: f["id"],
        rattachementStatut: "valide",
        statut: null,
        estTestInterne: false,
        projetId: null,
        debutPrevu: ev["startTime"],
      },
    ],
  });
  return { base, ev, rencontreId };
}

describe("valider et préparer écrit le suivi dans la même action", () => {
  it("note, compte rendu, suivi et recopie Calendly, ensemble", async () => {
    const { base, ev, rencontreId } = scene();
    const r = await validerApresLAppel(base.client as never, {
      rencontreId,
      parAdminId: ADMIN,
      projet: { mode: "nouveau", titre: "Formation IA" },
      faitsCoches: [],
      note: { besoin: "Former 12 personnes", prochaineEtape: "Envoyer le devis" },
      suivi: { issue: "eu_lieu", suite: "devis", suiteLe: new Date("2026-10-09T00:00:00Z") },
    });
    expect(r.compteRenduId).not.toBeNull();
    const cr = base.tables["compteRendu"]?.[0];
    expect(cr?.["origine"]).toBe("manuel");
    expect(cr?.["statut"]).toBe("valide");
    expect(String(cr?.["contenu"])).toMatch(/^enc:v1:/);
    const faits = base.tables["fait"] ?? [];
    expect(faits).toHaveLength(2);
    expect(faits.every((f) => f["statut"] === "valide" && f["source"] === "saisie_manuelle")).toBe(
      true,
    );
    expect(faits.every((f) => String(f["enonce"]).startsWith("enc:v1:"))).toBe(true);
    expect(base.tables["rencontreSuivi"]?.[0]?.["suite"]).toBe("devis");
    expect(base.tables["rendezVousSuivi"]?.[0]?.["calendlyEventId"]).toBe(ev["id"]);
    expect(base.transactions).toBe(1);
  });

  it("contre-témoin : suivi refusé ⇒ la note n'est pas écrite", async () => {
    const { base, rencontreId } = scene();
    await expect(
      validerApresLAppel(base.client as never, {
        rencontreId,
        parAdminId: ADMIN,
        projet: { mode: "nouveau", titre: "Formation IA" },
        faitsCoches: [],
        note: { besoin: "Former 12 personnes" },
        suivi: { issue: "eu_lieu", suite: null, suiteLe: null },
      }),
    ).rejects.toThrow(/suite/);
    expect(base.tables["compteRendu"] ?? []).toHaveLength(0);
    expect(base.tables["fait"] ?? []).toHaveLength(0);
    expect(base.tables["projet"] ?? []).toHaveLength(0);
    expect(base.tables["rendezVousSuivi"] ?? []).toHaveLength(0);
  });
});
