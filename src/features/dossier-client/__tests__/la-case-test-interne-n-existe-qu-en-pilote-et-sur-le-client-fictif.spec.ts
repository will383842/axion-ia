// @vitest-environment node
/**
 * ⛔ La case « test interne » n'existe qu'EN PILOTE et SUR LE CLIENT FICTIF
 * (plan §3.16, vérifications C05, C15) — à l'écran ET dans l'action :
 *
 *   · `caseTestInterneVisible` : les deux conditions, jamais une seule ;
 *   · `creerRencontre` REFUSE un rendez-vous de test ailleurs (une action
 *     s'appelle directement : masquer la case n'est pas interdire) ;
 *   · le formulaire « Nouveau rendez-vous » ne REND la case que si elle est
 *     visible.
 *
 * Mutation qui fait rougir : faire rendre `e.modePilote || e.surLeClientFictif`
 * à `caseTestInterneVisible` → rouge.
 * Contre-témoin : sur le client fictif, en pilote, la rencontre de test se crée.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/dossier-client/actions-rencontres", () => ({
  creerRencontreAction: vi.fn(),
}));

import { NouveauRendezVous } from "@/components/admin/dossier-client/NouveauRendezVous";
import { caseTestInterneVisible } from "../client-test";
import { creerRencontre } from "../creer-rencontre";
import { dossierEnMemoire, fiche } from "./_dossier-en-memoire";

const ADMIN = "00000000-0000-4000-8000-0000000000ad";

function entree(clientId: string) {
  return {
    clientId,
    type: "visio" as const,
    debut: new Date("2026-10-06T08:00:00Z"),
    dureeMin: 30,
    testInterne: true,
    parAdminId: ADMIN,
  };
}

describe("⛔ la case « test interne » n'existe qu'en pilote et sur le client fictif", () => {
  it("les deux conditions, jamais une seule", () => {
    expect(caseTestInterneVisible({ modePilote: true, surLeClientFictif: true })).toBe(true);
    expect(caseTestInterneVisible({ modePilote: true, surLeClientFictif: false })).toBe(false);
    expect(caseTestInterneVisible({ modePilote: false, surLeClientFictif: true })).toBe(false);
  });

  it("hors pilote, l'action refuse un rendez-vous de test", async () => {
    const f = fiche({ raisonSociale: "Vraie Fiche" });
    const base = dossierEnMemoire({ client: [f] });
    await expect(creerRencontre(base.client as never, entree(f["id"] as string))).rejects.toThrow(
      /mode pilote/,
    );
    expect(base.tables["rencontre"] ?? []).toHaveLength(0);
  });

  it("en pilote, sur une AUTRE fiche que le client fictif : refus", async () => {
    const fictif = fiche({ raisonSociale: "Atelier Test Fictif" });
    const vraie = fiche({ raisonSociale: "Vraie Fiche" });
    const base = dossierEnMemoire({
      client: [fictif, vraie],
      clientTestInterne: [{ clientId: fictif["id"] }],
    });
    await expect(
      creerRencontre(base.client as never, entree(vraie["id"] as string)),
    ).rejects.toThrow(/client fictif/);
  });

  it("contre-témoin : sur le client fictif, en pilote, la rencontre de test se crée", async () => {
    const fictif = fiche({ raisonSociale: "Atelier Test Fictif" });
    const base = dossierEnMemoire({
      client: [fictif],
      clientTestInterne: [{ clientId: fictif["id"] }],
    });
    const r = await creerRencontre(base.client as never, entree(fictif["id"] as string));
    const rencontre = base.tables["rencontre"]?.find((x) => x["id"] === r.rencontreId);
    expect(rencontre?.["estTestInterne"]).toBe(true);
    expect(rencontre?.["source"]).toBe("saisie_manuelle");
  });

  it("le formulaire ne rend la case que si elle est visible", () => {
    const sans = renderToStaticMarkup(
      NouveauRendezVous({
        clientId: "c",
        projetId: null,
        personnes: [],
        caseTestVisible: false,
        debutParDefaut: "2026-10-06T10:00",
      }),
    );
    const avec = renderToStaticMarkup(
      NouveauRendezVous({
        clientId: "c",
        projetId: null,
        personnes: [],
        caseTestVisible: true,
        debutParDefaut: "2026-10-06T10:00",
      }),
    );
    expect(sans).not.toContain('name="testInterne"');
    expect(avec).toContain('name="testInterne"');
  });
});
