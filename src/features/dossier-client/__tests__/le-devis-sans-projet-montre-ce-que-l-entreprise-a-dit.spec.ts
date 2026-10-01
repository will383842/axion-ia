/**
 * m-8 (2e vérification du chantier visio) — « Après l'appel », suite
 * « devis », choix « Aucun projet » : le devis s'ouvrait SANS le panneau
 * « Ce que le client a dit », alors que des faits « entreprise » existent ; et
 * la page du devis n'avait aucun chemin de retour vers le rendez-vous.
 *
 *   · sans `projetId`, un rôle habilité reçoit la partie ENTREPRISE de l'aide
 *     (`titre: null`) — rien si elle est vide (la page reste étroite) ;
 *   · « Valider et ouvrir le devis » transmet le rendez-vous, et la page du
 *     devis affiche « ← Rendez-vous ».
 *
 * Mutation qui rougit : rendre `aide: null` dès que `projetId` manque.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/dossier-client/queries", () => ({
  lireProjetsDuClient: vi.fn(),
  lireFaitsDuClient: vi.fn(),
  lireCitationsDesFaits: vi.fn(),
}));
vi.mock("@/auth", () => ({ auth: vi.fn() }));

import { chargerAideDuProjet, type LecteursAide } from "../aide-du-projet";
import { fait } from "./_faits";

const MAINTENANT = new Date("2026-10-02T09:00:00Z");

function lecteurs(faits: unknown[]) {
  const l = {
    projets: vi.fn().mockResolvedValue([]),
    faits: vi.fn().mockResolvedValue(faits),
    citations: vi.fn().mockResolvedValue(new Map()),
  };
  return { l, lire: l as unknown as LecteursAide };
}

// Un besoin dit pour toute l'entreprise (portée « entreprise »), validé.
const besoin = fait({ type: "besoin", enonce: "Former l'équipe à l'IA", texteCourt: "Former" });

describe("m-8 — un devis sans projet montre ce que l'entreprise a dit", () => {
  it("sans projet : la partie entreprise, sans titre de projet", async () => {
    const { lire } = lecteurs([besoin]);
    const r = await chargerAideDuProjet(
      { role: "admin", clientId: "cl", projetId: undefined, maintenant: MAINTENANT },
      lire,
    );
    expect(r.projetId).toBeNull();
    expect(r.aide?.titre).toBeNull();
    expect(r.aide?.aide.vide).toBe(false);
  });

  it("contre-témoin : rien de validé pour l'entreprise — pas de panneau", async () => {
    const { lire } = lecteurs([]);
    const r = await chargerAideDuProjet(
      { role: "admin", clientId: "cl", projetId: undefined, maintenant: MAINTENANT },
      lire,
    );
    expect(r).toEqual({ projetId: null, aide: null });
  });

  it("contre-témoin : rôle non habilité, rien n'est lu", async () => {
    const { l, lire } = lecteurs([besoin]);
    const r = await chargerAideDuProjet(
      { role: "reader", clientId: "cl", projetId: undefined },
      lire,
    );
    expect(r).toEqual({ projetId: null, aide: null });
    expect(l.faits).not.toHaveBeenCalled();
  });

  it("le devis ouvert depuis « Après l'appel » mène au rendez-vous", () => {
    const action = readFileSync("src/features/dossier-client/actions-rencontres.ts", "utf8");
    expect(action).toMatch(/q\.set\("rencontreId", rencontreId\)/);
    const page = readFileSync(
      "src/app/[locale]/(admin)/[adminPrefix]/qualiopi/devis/new/page.tsx",
      "utf8",
    );
    expect(page).toContain("← Rendez-vous");
    expect(page).toMatch(/isUuid\(sp\.rencontreId\)/);
  });
});
