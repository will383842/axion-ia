/**
 * Tests — recherche client (`listClients({ recherche })`).
 *
 * Le formulaire est trivial ; le risque est ici. Trois invariants, et les rater
 * produit le même symptôme : « ce client n'existe pas » alors qu'il est en base,
 * suivi d'une re-création en DOUBLON — bien plus coûteuse qu'une recherche ratée.
 *
 *  1. **Les identifiants sont NORMALISÉS.** Un SIRET se lit « 123 456 789 00011 »
 *     sur un Kbis et se copie avec ses espaces ; la base le stocke sans.
 *  2. **Un SIREN retrouve son établissement.** Les 9 premiers chiffres d'un
 *     SIRET sont le SIREN : chercher l'un doit trouver l'autre.
 *  3. **La casse ne tranche pas.** Personne ne tape une raison sociale en
 *     majuscules pour retrouver sa fiche.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: { client: { findMany: vi.fn() } } }));

import { prisma } from "@/lib/prisma";
import { listClients } from "./clients";

type Mock = ReturnType<typeof vi.fn>;
const mockFindMany = (prisma as unknown as { client: { findMany: Mock } }).client.findMany;

/** Clause `where` réellement envoyée à Prisma. */
function clause(): Record<string, unknown> {
  return (mockFindMany.mock.calls[0]?.[0] as { where?: Record<string, unknown> }).where ?? {};
}

/** Sous-conditions du `OR` de recherche. */
function conditionsOu(): Array<Record<string, Record<string, unknown>>> {
  const w = clause() as { AND?: Array<{ OR?: Array<Record<string, Record<string, unknown>>> }> };
  return w.AND?.find((c) => c.OR !== undefined)?.OR ?? [];
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFindMany.mockResolvedValue([]);
});

describe("sans recherche", () => {
  it("ne pose aucun filtre — la liste complète reste la liste complète", async () => {
    await listClients();
    expect(clause()).toStrictEqual({});
  });

  it("une recherche vide ou blanche équivaut à pas de recherche", async () => {
    await listClients({ recherche: "   " });
    expect(clause()).toStrictEqual({});
  });
});

describe("🔴 identifiants légaux — normalisation", () => {
  it("un SIRET collé AVEC ses espaces retrouve la fiche", async () => {
    // C'est le geste réel : on copie « 123 456 789 00011 » depuis un Kbis ou un
    // avis de situation INSEE. Comparer la chaîne telle quelle ne trouve rien.
    await listClients({ recherche: "123 456 789 00011" });
    const siret = conditionsOu().find((c) => c["siret"] !== undefined);
    expect(siret?.["siret"]).toStrictEqual({ startsWith: "12345678900011" });
  });

  it("les séparateurs non numériques sont ignorés", async () => {
    await listClients({ recherche: "123.456.789-00011" });
    const siret = conditionsOu().find((c) => c["siret"] !== undefined);
    expect(siret?.["siret"]).toStrictEqual({ startsWith: "12345678900011" });
  });

  it("🔴 un SIREN (9 chiffres) retrouve l'établissement dont le SIRET commence par lui", async () => {
    // `startsWith` et non égalité stricte : les 9 premiers chiffres d'un SIRET
    // SONT le SIREN. Une égalité stricte ne trouverait jamais l'établissement
    // depuis le numéro de la société.
    await listClients({ recherche: "123456789" });
    const siret = conditionsOu().find((c) => c["siret"] !== undefined);
    expect(siret?.["siret"]).toStrictEqual({ startsWith: "123456789" });
  });

  it("n'interroge PAS les identifiants sur un fragment trop court", async () => {
    // « 42 » ramènerait la moitié du fichier sur le SIRET, et noierait le
    // résultat pertinent sur la raison sociale.
    await listClients({ recherche: "42" });
    expect(conditionsOu().some((c) => c["siret"] !== undefined)).toBe(false);
  });

  it("🔴 une recherche NUMÉRIQUE interroge AUSSI la raison sociale", async () => {
    // Des sociétés portent un chiffre dans leur nom (« SCI 2000 »). Restreindre
    // une saisie numérique aux seuls identifiants produirait un « aucun
    // résultat » incompréhensible.
    await listClients({ recherche: "123456789" });
    expect(conditionsOu().some((c) => c["raisonSociale"] !== undefined)).toBe(true);
  });
});

describe("🔴 raison sociale et contacts", () => {
  it("la casse ne tranche pas", async () => {
    await listClients({ recherche: "invest sun" });
    const rs = conditionsOu().find((c) => c["raisonSociale"] !== undefined);
    expect(rs?.["raisonSociale"]).toStrictEqual({ contains: "invest sun", mode: "insensitive" });
  });

  it("cherche aussi le numéro de fiche et le contact", async () => {
    await listClients({ recherche: "AXI-CLI-003" });
    const champs = conditionsOu().flatMap((c) => Object.keys(c));
    expect(champs).toContain("numero");
    expect(champs).toContain("contactNom");
    expect(champs).toContain("contactEmail");
  });

  it("le terme est débarrassé de ses espaces de bord", async () => {
    await listClients({ recherche: "  SCI INVEST SUN  " });
    const rs = conditionsOu().find((c) => c["raisonSociale"] !== undefined);
    expect(rs?.["raisonSociale"]).toStrictEqual({
      contains: "SCI INVEST SUN",
      mode: "insensitive",
    });
  });
});

describe("recherche et statut se combinent", () => {
  it("les deux filtres s'appliquent ensemble, jamais l'un à la place de l'autre", async () => {
    await listClients({ recherche: "SUN", statut: "prospect" });
    const w = clause() as { AND?: Array<Record<string, unknown>> };
    expect(w.AND).toHaveLength(2);
    expect(w.AND?.some((c) => c["statut"] === "prospect")).toBe(true);
    expect(w.AND?.some((c) => c["OR"] !== undefined)).toBe(true);
  });
});

describe("stub-safe", () => {
  it("une base indisponible rend [] au lieu de lever", async () => {
    // Contrat historique du module : le build SSG ne doit jamais casser dessus.
    mockFindMany.mockRejectedValue(new Error("base indisponible"));
    await expect(listClients({ recherche: "SUN" })).resolves.toStrictEqual([]);
  });
});
