// @vitest-environment node
/**
 * P-6 : « Créer la fiche prospect » a créé la fiche et rangé le rendez-vous,
 * puis la relance du compte rendu (P2 à P5) échoue (base indisponible un
 * instant). Le message ne doit pas faire croire que rien n'est fait : il dit
 * que la fiche existe et quel geste reprend le compte rendu.
 *
 * Mutation qui fait rougir : rendre l'erreur brute de la relance.
 * Contre-témoin : une relance réussie revient sur « Après l'appel » sans erreur.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const relancer = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { url, digest: "NEXT_REDIRECT" });
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("../acces", () => ({
  // `message-affichable` range `AccesRefuse` parmi les erreurs métier.
  AccesRefuse: class AccesRefuse extends Error {},
  exigerAccesEchanges: vi.fn(async () => ({ userId: "admin-1", role: "admin" })),
}));
vi.mock("../creer-prospect", () => ({
  ErreurCreerProspect: class ErreurCreerProspect extends Error {},
  creerProspectDepuisRencontre: vi.fn(async () => ({
    statut: "cree",
    clientId: "c-1",
    numero: "AXI-CLI-001",
  })),
}));
vi.mock("../rattacher", () => ({
  ErreurRattachement: class ErreurRattachement extends Error {},
  relancerApresRattachement: (...a: unknown[]) => relancer(...a),
  validerRattachement: vi.fn(),
}));

import { creerProspectAction } from "../actions-rencontres";

const RENCONTRE = "00000000-0000-4000-8000-000000000005";

async function adresseApres(): Promise<string> {
  const fd = new FormData();
  fd.set("rencontreId", RENCONTRE);
  fd.set("raisonSociale", "Fiche Fictive");
  try {
    await creerProspectAction(fd);
  } catch (e) {
    if ((e as { url?: string }).url === undefined) throw e;
    return decodeURIComponent(String((e as { url?: string }).url));
  }
  throw new Error("aucune redirection");
}

describe("une relance échouée après la création dit que la fiche existe", () => {
  beforeEach(() => {
    relancer.mockReset();
  });

  it("le message dit « fiche créée » et le geste qui reprend", async () => {
    relancer.mockRejectedValue(new Error("connexion perdue"));
    const url = await adresseApres();
    expect(url).toContain("erreur=");
    expect(url).toContain("La fiche est créée");
    expect(url).toContain("Compléter avec la fiche client");
    expect(url).not.toContain("connexion perdue");
  });

  it("contre-témoin : relance réussie, aucune erreur", async () => {
    relancer.mockResolvedValue(undefined);
    const url = await adresseApres();
    expect(url).toContain(`rendez-vous/rencontres/${RENCONTRE}?vue=apres-l-appel`);
    expect(url).not.toContain("erreur=");
  });
});
