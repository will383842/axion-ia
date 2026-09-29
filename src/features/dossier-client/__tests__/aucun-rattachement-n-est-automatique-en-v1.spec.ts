// @vitest-environment node
/**
 * ⛔ Décision A4 de Will : « un rendez-vous n'est jamais rangé
 * automatiquement chez un client ; il est proposé, Will valide en un clic ».
 *
 * Même quand l'adresse de l'invité est EXACTEMENT celle d'une fiche, la
 * rencontre reste sans client (`clientId` nul) : la fiche est PROPOSÉE
 * (`clientProposeId`, statut `propose`, motif), et journalisée comme telle.
 *
 * Mutation qui fait rougir : dans `proposerRattachement`, écrire aussi
 * `clientId: proposition.clientId` → le premier test rougit.
 * Contre-témoin : `validerRattachement` (le clic de Will) pose bien `clientId`.
 * Angle mort : une rencontre saisie dans la console naît rangée — c'est Will
 * qui la crée sur une fiche, ce n'est pas un rangement automatique.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { assurerRencontrePourCalendly } from "../rencontre-calendly";
import { validerRattachement } from "../rattacher";
import { dossierEnMemoire, fiche, rendezVousCalendly } from "./_dossier-en-memoire";

const BORNE = new Date("2026-10-01T00:00:00Z");

describe("⛔ aucun rattachement n'est automatique en V1", () => {
  it("une adresse identique PROPOSE la fiche, sans la ranger", async () => {
    const f = fiche({
      raisonSociale: "Atelier Exemple",
      contactEmail: "camille@exemple-fictif.fr",
    });
    const ev = rendezVousCalendly();
    const base = dossierEnMemoire({ client: [f], calendlyEvent: [ev] });

    await assurerRencontrePourCalendly(base.client as never, ev["id"] as string, { borne: BORNE });

    const r = base.tables["rencontre"]?.[0];
    expect(r?.["clientId"]).toBeNull();
    expect(r?.["rattachementStatut"]).toBe("propose");
    expect(r?.["clientProposeId"]).toBe(f["id"]);
    expect(r?.["motifProposition"]).toBe("email_calendly");
    expect(base.tables["rencontreRattachementEvenement"]?.map((e) => e["action"])).toEqual([
      "propose",
    ]);
  });

  it("une entreprise déclarée identique propose aussi — sans ranger", async () => {
    const f = fiche({ raisonSociale: "Menuiserie Fictive SARL" });
    const ev = rendezVousCalendly({
      inviteeEmail: "quelquun@exemple-sans-fiche.fr",
      rawPayload: {
        invitee: {
          questions_and_answers: [
            { question: "Nom de l'entreprise", answer: "Menuiserie Fictive" },
          ],
        },
      },
    });
    const base = dossierEnMemoire({ client: [f], calendlyEvent: [ev] });
    await assurerRencontrePourCalendly(base.client as never, ev["id"] as string, { borne: BORNE });
    const r = base.tables["rencontre"]?.[0];
    expect(r?.["clientId"]).toBeNull();
    expect(r?.["motifProposition"]).toBe("entreprise_declaree");
  });

  it("contre-témoin : le clic de Will range la rencontre", async () => {
    const f = fiche({
      raisonSociale: "Atelier Exemple",
      contactEmail: "camille@exemple-fictif.fr",
    });
    const ev = rendezVousCalendly();
    const base = dossierEnMemoire({ client: [f], calendlyEvent: [ev] });
    const res = await assurerRencontrePourCalendly(base.client as never, ev["id"] as string, {
      borne: BORNE,
    });
    if (res.statut !== "creee") throw new Error("rencontre non créée");
    await base.client.$transaction((tx) =>
      validerRattachement(tx as never, {
        rencontreId: res.rencontreId,
        clientId: f["id"] as string,
        parAdminId: "00000000-0000-4000-8000-00000000000a",
      }),
    );
    const r = base.tables["rencontre"]?.[0];
    expect(r?.["clientId"]).toBe(f["id"]);
    expect(r?.["rattachementStatut"]).toBe("valide");
  });

  it("la proposition n'écrit jamais `clientId` (lecture du code)", () => {
    const src = readFileSync(
      join(process.cwd(), "src/features/dossier-client/rattacher.ts"),
      "utf8",
    );
    const debut = src.indexOf("export async function proposerRattachement(");
    const fin = src.indexOf("export class ErreurRattachement");
    const corps = src.slice(debut, fin);
    expect(debut).toBeGreaterThan(-1);
    expect(corps).not.toMatch(/\bclientId\s*:/);
  });
});
