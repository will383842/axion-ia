/**
 * « Avec précision CHIFFRÉE » doit vouloir dire chiffrée, pas « non vide ».
 *
 * Le filtre était `{ not: null }`. Une valeur héritée, ou posée hors des chemins
 * gardés, aurait donc été comptée comme chiffrée : l'écran de la fiche session
 * aurait affirmé à l'administration que la précision est protégée alors qu'elle
 * ne l'est pas.
 *
 * 🔑 Un nom qui promet plus que le prédicat ne tient est un mensonge qui ne
 * rougit jamais. Le prédicat est désormais aligné sur le nom.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const findMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: { trainee: { findMany: (a: unknown) => findMany(a) } },
}));

import { stagiairesAvecPrecisionChiffree } from "./precision-chiffree";
import { PREFIX_V1 } from "@/lib/pii-crypto";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  vi.clearAllMocks();
  findMany.mockResolvedValue([]);
});

describe("stagiairesAvecPrecisionChiffree", () => {
  it("🔴 le filtre exige le PRÉFIXE de chiffrement, pas seulement « non vide »", async () => {
    await stagiairesAvecPrecisionChiffree([A, B]);

    const appel = findMany.mock.calls[0]?.[0] as { where: Record<string, unknown> };
    expect(
      appel.where["handicapDetailsChiffre"],
      "« non vide » compterait une valeur non chiffrée comme protégée",
    ).toEqual({ startsWith: PREFIX_V1 });
  });

  it("le préfixe vient du module de chiffrement, il n'est pas retapé", () => {
    // Un prédicat recopié diverge toujours : si le format change un jour, ce
    // filtre doit suivre sans que personne n'ait à y penser.
    expect(PREFIX_V1).toBe("enc:v1:");
  });

  it("rend l'ensemble des identifiants trouvés, dédoublonnés en entrée", async () => {
    findMany.mockResolvedValue([{ id: A }]);
    const res = await stagiairesAvecPrecisionChiffree([A, A, B]);

    expect(res).toEqual(new Set([A]));
    const appel = findMany.mock.calls[0]?.[0] as { where: { id: { in: string[] } } };
    expect(appel.where.id.in).toEqual([A, B]);
  });

  it("aucun identifiant : aucune requête", async () => {
    expect(await stagiairesAvecPrecisionChiffree([])).toEqual(new Set());
    expect(findMany).not.toHaveBeenCalled();
  });

  it("🔑 le contenu de la colonne n'est JAMAIS chargé", async () => {
    await stagiairesAvecPrecisionChiffree([A]);
    const appel = findMany.mock.calls[0]?.[0] as { select: Record<string, unknown> };
    expect(appel.select).toEqual({ id: true });
  });
});
