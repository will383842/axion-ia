/**
 * ⛔ TOUTES LES PORTES DE CRÉATION D'UNE FICHE PASSENT PAR LA MÊME
 * VÉRIFICATION (plan §3.17, constat E4 : trois portes, dont deux ne vérifiaient
 * rien).
 *
 * Les portes de l'écran — « Nouveau client » (`ClientForm`) et l'assistant
 * de vente (`VenteWizard`) — appellent `createClientAction` ; celle-ci appelle
 * `creerOuRetrouverClient`, et rien d'autre ne crée une fiche. « Convertir »
 * (`ConvertirEntreeForm`, `convertirEntreeEnClientAction`), mort depuis la
 * redirection de « Entrées récentes », est SUPPRIMÉ (correction anti-doublon
 * A2 : doublon de `creerProspect`, chantier visio PR 4). On le prouve deux fois :
 *   · en EXÉCUTANT l'action serveur, porte doublée : elle l'appelle ;
 *   · en LISANT les écrans : aucun n'écrit la base lui-même.
 *
 * Mutation qui fait rougir : dans `createClientAction`, revenir à
 * `prisma.client.create`.
 * Contre-témoin : un refus de la porte (même SIREN) remonte tel quel à l'écran,
 * avec la fiche à ouvrir.
 * Angle mort : une QUATRIÈME porte écrite demain directement en base est la
 * cible de `tests/unit/ci/aucun-ecrivain-de-client-hors-de-la-porte-unique.spec.ts`.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => ({ porte: vi.fn(), log: vi.fn() }));

vi.mock("@/lib/prisma", () => ({ prisma: { client: {}, $transaction: vi.fn() } }));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "admin-1", role: "admin" }),
  logQualiopiActivity: (...a: unknown[]) => d.log(...a),
}));
vi.mock("@/server/qualiopi/crm/porte-client", () => ({
  creerOuRetrouverClient: (...a: unknown[]) => d.porte(...a),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { createClientAction } from "@/server/actions/qualiopi/clients";

beforeEach(() => {
  vi.clearAllMocks();
  d.porte.mockResolvedValue({
    statut: "cree",
    id: "00000000-0000-4000-8000-000000000001",
    numero: "AXI-CLI-050",
    proches: [],
    creationForcee: false,
  });
});

describe("⛔ toutes les portes de création passent par la même vérification", () => {
  it("« Nouveau client » et l'assistant de vente : createClientAction → la porte", async () => {
    const r = await createClientAction({
      raisonSociale: "Fictive SAS",
      contactNom: "Anne Fictive",
      contactEmail: "anne@fictive.example",
      adresseVille: "Lyon",
    });
    expect(r).toEqual({
      data: { id: "00000000-0000-4000-8000-000000000001", numero: "AXI-CLI-050" },
    });
    expect(d.porte).toHaveBeenCalledOnce();
    const [, donnees, personne, options] = d.porte.mock.calls[0] ?? [];
    expect(donnees).toEqual(
      expect.objectContaining({ raisonSociale: "Fictive SAS", adresseVille: "Lyon" }),
    );
    // La personne passe à part : la porte la confie à `definirContactFacturation`.
    expect(donnees).not.toHaveProperty("contactEmail");
    expect(personne).toEqual({ nom: "Anne Fictive", email: "anne@fictive.example" });
    expect(options).toEqual(expect.objectContaining({ parAdminId: "admin-1" }));
  });

  it("contre-témoin : le refus de la porte (même SIREN) remonte avec la fiche à ouvrir", async () => {
    d.porte.mockResolvedValue({
      statut: "refuse_siren",
      fiche: {
        ficheId: "f-4",
        numero: "AXI-CLI-004",
        raisonSociale: "Fictive",
        signal: "siren",
        force: "bloquant",
      },
      message: "Cette entreprise a déjà la fiche AXI-CLI-004",
    });
    const r = await createClientAction({ raisonSociale: "Fictive", siren: "732829320" });
    expect(r).toEqual({
      error: "Cette entreprise a déjà la fiche AXI-CLI-004",
      proches: [expect.objectContaining({ numero: "AXI-CLI-004" })],
    });
    expect(d.log).not.toHaveBeenCalled();
  });

  it("les écrans passent par les actions, jamais par la base", () => {
    const lire = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");
    const formulaire = lire("src/components/admin/qualiopi/ClientForm.tsx");
    const assistant = lire("src/components/admin/qualiopi/VenteWizard.tsx");
    const action = lire("src/server/actions/qualiopi/clients.ts");

    expect(formulaire).toContain("createClientAction(");
    expect(assistant).toContain("createClientAction(");
    expect(action).toContain("creerOuRetrouverClient(");
    for (const [nom, source] of [
      ["ClientForm", formulaire],
      ["VenteWizard", assistant],
      ["clients", action],
    ] as const) {
      expect(source, `${nom} écrit la table clients lui-même`).not.toMatch(
        /\.client\.(create|upsert|createMany)\s*\(/,
      );
    }
  });
});
