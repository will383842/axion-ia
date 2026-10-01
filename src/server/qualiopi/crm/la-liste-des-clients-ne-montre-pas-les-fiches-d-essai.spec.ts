/**
 * R3 (2e vérification du chantier visio) — une fiche d'ESSAI du pilote
 * (inscrite dans `clients_test_interne`, par exemple créée depuis un faux
 * « Discutons ») ne figure pas dans la liste des clients montrée à
 * l'auditeur Qualiopi. Elle reste trouvable par la recherche (Will doit
 * pouvoir rouvrir la fiche fictive du pilote).
 *
 * Mutation qui rougit : retirer le filtre `horsFichesDEssai` de `listClients`,
 * ou ne plus le demander dans la page de la liste.
 */

import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: { client: { findMany: vi.fn() } } }));

import { prisma } from "@/lib/prisma";
import { listClients } from "./clients";

const findMany = (prisma as unknown as { client: { findMany: ReturnType<typeof vi.fn> } }).client
  .findMany;

beforeEach(() => {
  vi.clearAllMocks();
  findMany.mockResolvedValue([]);
});

describe("R3 — la liste des clients ne montre pas les fiches d'essai", () => {
  it("`horsFichesDEssai` écarte les fiches de `clients_test_interne`", async () => {
    await listClients({ horsFichesDEssai: true });
    expect(findMany.mock.calls[0]?.[0]).toMatchObject({
      where: { AND: [{ testInterne: { is: null } }] },
    });
  });

  it("contre-témoin : sans l'option, aucune fiche n'est écartée", async () => {
    await listClients();
    expect((findMany.mock.calls[0]?.[0] as { where?: unknown }).where).toBeUndefined();
  });

  it("la page de la liste les écarte hors recherche", () => {
    const src = readFileSync(
      "src/app/[locale]/(admin)/[adminPrefix]/qualiopi/clients/page.tsx",
      "utf8",
    );
    expect(src).toContain('recherche === "" ? { horsFichesDEssai: true }');
  });
});
