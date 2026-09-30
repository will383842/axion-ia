/**
 * ⛔ L'AIDE DU PROJET NE LIT RIEN POUR UN RÔLE NON HABILITÉ (PR 7, A2).
 *
 * Le devis et la vente guidée ouverts depuis un projet passent par UN chargeur,
 * `chargerAideDuProjet` : la garde d'accès et le filtre des citations n'y sont
 * écrits qu'une fois (ils étaient recopiés dans les deux pages).
 *
 *   · rôle non habilité : AUCUNE lecture du dossier, le lien au projet reste ;
 *   · identifiant mal formé ou sans client reconnu : rien ;
 *   · projet absent chez ce client : ni lien ni aide.
 *
 * Mutation qui rougit : lire les projets avant `peutVoirLesEchanges` ; accepter
 * un `projetId` qui n'est pas un UUID ; lier un projet d'un autre client.
 * Contre-témoin : un rôle habilité reçoit l'aide et le titre du projet.
 * Et les deux pages appellent ce chargeur (aucune ne recalcule l'aide).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/dossier-client/queries", () => ({
  lireProjetsDuClient: vi.fn(),
  lireFaitsDuClient: vi.fn(),
  lireCitationsDesFaits: vi.fn(),
}));
vi.mock("@/auth", () => ({ auth: vi.fn() }));

import { chargerAideDuProjet, type LecteursAide } from "../aide-du-projet";

const PROJET = "8b0f6a3e-2c4d-4e5f-9a1b-2c3d4e5f6a7b";

function lecteurs() {
  const l = {
    projets: vi
      .fn()
      .mockResolvedValue([
        { id: PROJET, titre: "Former l'équipe commerciale", derniereReouvertureLe: null },
      ]),
    faits: vi.fn().mockResolvedValue([]),
    citations: vi.fn().mockResolvedValue(new Map()),
  };
  return { l, lire: l as unknown as LecteursAide };
}

describe("⛔ l'aide du projet ne lit rien pour un rôle non habilité", () => {
  it("rôle non habilité : aucune lecture, le lien au projet reste", async () => {
    const { l, lire } = lecteurs();
    const r = await chargerAideDuProjet({ role: "reader", clientId: "cl", projetId: PROJET }, lire);
    expect(r).toEqual({ projetId: PROJET, aide: null });
    expect(l.projets).not.toHaveBeenCalled();
    expect(l.faits).not.toHaveBeenCalled();
    expect(l.citations).not.toHaveBeenCalled();
  });

  it("identifiant mal formé, ou client non reconnu : rien", async () => {
    const { l, lire } = lecteurs();
    expect(
      await chargerAideDuProjet({ role: "admin", clientId: "cl", projetId: "abc" }, lire),
    ).toEqual({ projetId: null, aide: null });
    expect(
      await chargerAideDuProjet({ role: "admin", clientId: undefined, projetId: PROJET }, lire),
    ).toEqual({ projetId: null, aide: null });
    expect(l.projets).not.toHaveBeenCalled();
  });

  it("projet absent chez ce client : ni lien ni aide", async () => {
    const { l, lire } = lecteurs();
    l.projets.mockResolvedValue([]);
    const r = await chargerAideDuProjet({ role: "admin", clientId: "cl", projetId: PROJET }, lire);
    expect(r).toEqual({ projetId: null, aide: null });
    expect(l.faits).not.toHaveBeenCalled();
  });

  it("contre-témoin : rôle habilité, l'aide et le titre du projet", async () => {
    const { lire } = lecteurs();
    const r = await chargerAideDuProjet({ role: "admin", clientId: "cl", projetId: PROJET }, lire);
    expect(r.projetId).toBe(PROJET);
    expect(r.aide?.titre).toBe("Former l'équipe commerciale");
  });

  it.each([
    "src/app/[locale]/(admin)/[adminPrefix]/qualiopi/devis/new/page.tsx",
    "src/app/[locale]/(admin)/[adminPrefix]/qualiopi/vente/new/page.tsx",
  ])("%s passe par le chargeur, sans recalculer l'aide", (page) => {
    const s = readFileSync(join(process.cwd(), page), "utf8");
    expect(s).toContain("chargerAideDuProjet(");
    expect(s).not.toMatch(/aideAuDevis\(|consoliderFaits\(|lireCitationsDesFaits\(|const UUID/);
  });
});
