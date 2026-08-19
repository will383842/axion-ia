/**
 * La surcharge doit gagner sur le code, et n'exister que si elle est posée.
 *
 * 🔴 CE QUE CETTE GARDE PROTÈGE — recensement OG du 2026-08-17.
 *
 * Trois promesses, toutes cassables en silence :
 *
 *   1. **Une page sans surcharge rend EXACTEMENT ce qu'elle rendait avant.**
 *      C'est la condition posée pour ne pas casser les 150 `generateMetadata`
 *      existants. Un défaut ici ne se verrait pas en développement — il se
 *      verrait en production, sur 1 667 URLs.
 *   2. **La portée `route` bat la portée `modele`.** Sans cette règle, poser
 *      une exception sur une ville précise deviendrait impossible dès qu'un
 *      modèle couvre la famille.
 *   3. **Sous `stub.invalid`, aucune requête.** Le build GitHub Actions n'a pas
 *      de base ; une lecture non gardée ferait échouer le pré-rendu de
 *      17 629 routes (cf. AGENTS.md, ADR 0026).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { modeleMatche, choisirSurcharge } from "@/server/seo/og-overrides";

const VIDE = {
  ogTitle: null,
  ogDescription: null,
  ogImage: null,
  ogImageWidth: null,
  ogImageHeight: null,
  ogEyebrow: null,
};

describe("correspondance d'un modèle", () => {
  it("un segment entre crochets accepte n'importe quelle valeur", () => {
    expect(modeleMatche("/fr/audit/par-ville/[ville]", "/fr/audit/par-ville/lyon")).toBe(true);
    expect(modeleMatche("/fr/audit/par-ville/[ville]", "/fr/audit/par-ville/ablon-sur-seine")).toBe(
      true,
    );
  });

  it("🔑 le nombre de segments doit correspondre", () => {
    // Sans cette règle, `/fr/audit/[x]` avalerait `/fr/audit/par-ville/lyon`,
    // et une surcharge posée sur une famille déborderait sur une autre.
    expect(modeleMatche("/fr/audit/[x]", "/fr/audit/par-ville/lyon")).toBe(false);
    expect(modeleMatche("/fr/audit/par-ville/[ville]", "/fr/audit")).toBe(false);
  });

  it("un segment littéral doit correspondre à l'identique", () => {
    expect(modeleMatche("/fr/audit/par-ville/[ville]", "/fr/formations/par-ville/lyon")).toBe(
      false,
    );
  });
});

describe("choix de la surcharge applicable", () => {
  const parModele = {
    ...VIDE,
    portee: "modele" as const,
    cible: "/fr/audit/par-ville/[ville]",
    ogTitle: "Audit IA près de chez vous",
  };
  const parRoute = {
    ...VIDE,
    portee: "route" as const,
    cible: "/fr/audit/par-ville/lyon",
    ogTitle: "Audit IA à Lyon",
  };

  it("🔑 la route précise l'emporte sur le modèle — le particulier bat le général", () => {
    // Ordre inversé volontairement : le choix ne doit pas dépendre de l'ordre
    // de lecture en base.
    const choix = choisirSurcharge([parModele, parRoute], "/fr/audit/par-ville/lyon");

    expect(choix?.ogTitle).toBe("Audit IA à Lyon");
  });

  it("le modèle s'applique aux 10 162 autres villes", () => {
    const choix = choisirSurcharge([parModele, parRoute], "/fr/audit/par-ville/ablon-sur-seine");

    expect(choix?.ogTitle).toBe("Audit IA près de chez vous");
  });

  it("aucune surcharge posée : on ne renvoie RIEN, la page garde son calcul", () => {
    expect(choisirSurcharge([parModele, parRoute], "/fr/contact")).toBeNull();
    expect(choisirSurcharge([], "/fr/audit")).toBeNull();
  });
});

describe("contrat stub.invalid (build GitHub Actions)", () => {
  const memoire = process.env["DATABASE_URL"];

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    if (memoire === undefined) delete process.env["DATABASE_URL"];
    else process.env["DATABASE_URL"] = memoire;
    vi.resetModules();
  });

  it("🔴 sous les URLs stub, AUCUNE surcharge et AUCUN accès base", async () => {
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";

    // Si le module tentait d'atteindre la base, ce mock exploserait — le point
    // du contrat est qu'on sort AVANT même d'instancier le client.
    vi.doMock("@/lib/prisma", () => ({
      get prisma(): never {
        throw new Error("client Prisma instancié sous stub.invalid");
      },
    }));

    const { surchargeOgPour } = await import("@/server/seo/og-overrides");

    await expect(surchargeOgPour("/fr/audit")).resolves.toBeNull();
  });

  it("une base indisponible ne fait pas tomber le rendu : pas de surcharge, pas d'erreur", async () => {
    process.env["DATABASE_URL"] = "postgresql://reel@localhost:5432/axionia";

    vi.doMock("@/lib/prisma", () => ({
      prisma: {
        ogOverride: {
          findMany: () => Promise.reject(new Error("connexion refusée")),
        },
      },
    }));

    const { surchargeOgPour } = await import("@/server/seo/og-overrides");

    await expect(surchargeOgPour("/fr/audit")).resolves.toBeNull();
  });
});
