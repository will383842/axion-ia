// La RECHERCHE libre du sélecteur de rattachement (2026-10-07, cas « Krafft »).
//
// Un échange réservé sous un nom d'un seul mot, avec une autre adresse que la
// candidature, et une fiche vieille de plusieurs semaines : aucun groupe du
// sélecteur ne la retrouvait. La recherche lit TOUTES les fiches du même public,
// sur le nom, l'adresse et le téléphone, un seul mot accepté.
import { beforeEach, describe, expect, it, vi } from "vitest";

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { submission: { findMany } } }));
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: string) => v }));
vi.mock("@/lib/security/email-hash", () => ({ hashEmailForLookup: () => null }));

import {
  ficheCorrespond,
  normaliserRecherche,
  rechercherFichesRattachables,
} from "../fiches-rattachables";

const APPORTEUR = { unifiedType: "recrutement", subType: "candidature-commerciale" };
const ligne = (i: number, nom: string, email: string, tel: string | null = null) => ({
  id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
  type: "contact",
  details: APPORTEUR,
  submittedAt: new Date("2026-09-10T10:00:00Z"),
  contactName: nom,
  contactEmail: email,
  contactPhone: tel,
});

beforeEach(() => findMany.mockReset());

describe("ficheCorrespond", () => {
  const f = {
    nom: "Babak Krafft",
    email: "babak.k@indeedemail.com",
    telephone: "+33 6 12 34 56 78",
  };
  it("un seul mot, sans accents ni casse", () => {
    expect(ficheCorrespond([normaliserRecherche("KRAFFT")], f)).toBe(true);
    expect(ficheCorrespond([normaliserRecherche("Élodie")], f)).toBe(false);
  });
  it("une partie de l'adresse, ou le téléphone sous une autre forme", () => {
    expect(ficheCorrespond(["indeedemail"], f)).toBe(true);
    expect(ficheCorrespond(["0612345678"], f)).toBe(true);
  });
  it("tous les termes doivent correspondre", () => {
    expect(ficheCorrespond(["babak", "krafft"], f)).toBe(true);
    expect(ficheCorrespond(["babak", "dupont"], f)).toBe(false);
  });
});

describe("rechercherFichesRattachables", () => {
  it("🔴 retrouve « Krafft » au-delà des 25 fiches récentes, avec son adresse au libellé", async () => {
    const autres = Array.from({ length: 40 }, (_, i) =>
      ligne(i + 1, `Candidat ${i}`, `c${i}@exemple.fr`),
    );
    findMany.mockResolvedValue([...autres, ligne(99, "Babak Krafft", "babak.k@indeedemail.com")]);
    const r = await rechercherFichesRattachables("krafft", true);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ groupe: "recherche", intitule: "Résultats de la recherche" });
    expect(r[0]!.libelle).toContain("babak.k@indeedemail.com");
    // Lecture sur TOUTES les fiches apporteur, pas une fenêtre de dates.
    const where = findMany.mock.calls[0]![0].where;
    expect(where.submittedAt).toBeUndefined();
  });

  it("moins de deux lettres : aucune lecture", async () => {
    expect(await rechercherFichesRattachables("k", true)).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("un échange apporteur ne propose pas de fiche client", async () => {
    findMany.mockResolvedValue([
      { ...ligne(1, "Krafft SARL", "x@y.fr"), details: { unifiedType: "audit" } },
    ]);
    expect(await rechercherFichesRattachables("krafft", true)).toEqual([]);
  });
});
