/**
 * ⛔ MODIFIER UNE FICHE VERS UN SIREN DÉJÀ PRIS EST REFUSÉ (B18, plan §3.17).
 *
 * La porte refusait déjà de CRÉER une seconde fiche au même SIREN. Mais une
 * fiche créée SANS SIREN (adresse gmail, annuaire en panne) pouvait ensuite en
 * recevoir un par « C'est elle » (SIREN de l'annuaire) ou par un SIRET saisi
 * dans « Éditer » — deux chemins qui passent par `updateClientAction`. Deux
 * fiches vivantes au même SIREN, sans refus ni trace : ce que B18 interdit, et
 * ce sur quoi Partners rattache ses apporteurs.
 *
 * On exécute la VRAIE `updateClientAction`, sur la base en mémoire de la porte.
 *
 * Mutations qui font rougir :
 *   · retirer l'appel à `exigerSirenLibre` de `updateClientAction` : la fiche B
 *     prend le SIREN de A ;
 *   · retirer le `pg_advisory_xact_lock` de `exigerSirenLibre` : le test du
 *     verrou rougit.
 * Contre-témoins : une fiche ABSORBÉE ne bloque pas ; ré-enregistrer une fiche
 * avec SON propre SIREN ne bloque pas ; un SIREN libre s'écrit.
 * Angle mort : deux modifications SIMULTANÉES ne se prouvent que sur une vraie
 * base (le verrou est le même que celui de la création, prouvé en Gate D).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { baseEnMemoire as BaseEnMemoire } from "./_base-en-memoire";

vi.mock("@/lib/prisma", async () => {
  const m = await import("./_base-en-memoire");
  return { prisma: m.baseEnMemoire() };
});
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "admin-1", role: "editor" }),
  logQualiopiActivity: vi.fn(),
}));

const { prisma } = (await import("@/lib/prisma")) as unknown as {
  prisma: ReturnType<typeof BaseEnMemoire>;
};
const { updateClientAction } = await import("@/server/actions/qualiopi/clients");
const { ficheClient } = await import("./_base-en-memoire");

// Fictifs, clé de Luhn valide (le dépôt est public : aucun vrai SIREN).
const SIREN_A = "732829320";
const SIRET_A = "73282932000074";
const SIREN_LIBRE = "552100554";

let a: ReturnType<typeof ficheClient>;
let b: ReturnType<typeof ficheClient>;

beforeEach(() => {
  a = ficheClient({ numero: "AXI-CLI-004", raisonSociale: "Martin Industrie", siren: SIREN_A });
  b = ficheClient({ numero: "AXI-CLI-009", raisonSociale: "Martin (gmail)" });
  prisma.etat.clients = [a, b];
  prisma.etat.fusionsVivantes.clear();
  prisma.verrous.length = 0;
});

describe("⛔ modifier une fiche vers un SIREN déjà pris est refusé", () => {
  it("« C'est elle » (SIREN seul) sur la fiche B : refus qui nomme la fiche A", async () => {
    const r = await updateClientAction({ id: b.id, siren: SIREN_A });
    expect(r).toEqual({ error: expect.stringContaining("AXI-CLI-004") });
    expect(prisma.etat.clients.find((c) => c.id === b.id)?.siren).toBeNull();
  });

  it("un SIRET saisi dans « Éditer » dont le SIREN est pris : refus, rien n'est écrit", async () => {
    const r = await updateClientAction({ id: b.id, siret: SIRET_A });
    expect("error" in r).toBe(true);
    const apres = prisma.etat.clients.find((c) => c.id === b.id);
    expect(apres?.siren).toBeNull();
    expect(apres?.siret).toBeNull();
  });

  it("le verrou du SIREN (le même qu'à la création) est pris", async () => {
    await updateClientAction({ id: b.id, siren: SIREN_A });
    expect(prisma.verrous[0]).toContain("pg_advisory_xact_lock(hashtext(");
    expect(prisma.verrous[0]).toContain(`client-siren:${SIREN_A}`);
  });

  it("contre-témoin : un SIREN libre s'écrit", async () => {
    const r = await updateClientAction({ id: b.id, siren: SIREN_LIBRE });
    expect(r).toEqual({ data: { id: b.id } });
    expect(prisma.etat.clients.find((c) => c.id === b.id)?.siren).toBe(SIREN_LIBRE);
  });

  it("contre-témoin : une fiche absorbée par une fusion vivante ne bloque pas", async () => {
    prisma.etat.fusionsVivantes.add(a.id);
    const r = await updateClientAction({ id: b.id, siren: SIREN_A });
    expect(r).toEqual({ data: { id: b.id } });
  });

  it("contre-témoin : ré-enregistrer une fiche avec son propre SIREN ne bloque pas", async () => {
    const r = await updateClientAction({ id: a.id, siren: SIREN_A });
    expect(r).toEqual({ data: { id: a.id } });
  });
});
