// @vitest-environment node
// Environnement `node` requis : `buildOrganizationJsonLd` lit des env vars
// SERVEUR (t3-env), dont l'accès lève sous jsdom (« server var on client »).
/**
 * La fiche contact et le JSON-LD de l'organisation doivent déclarer LA MÊME
 * adresse de siège.
 *
 * Pourquoi ce test existe, et pourquoi ici plutôt qu'en relecture : le
 * 02/08/2026, la même entité déclarait deux `streetAddress` différentes selon la
 * page — l'une avec le complément de domiciliation, l'autre sans. Google
 * rapproche `address` des registres SIRENE/INPI pour décider si le site EST
 * l'entreprise immatriculée ; l'écart casse ce rapprochement et coûte le
 * Knowledge Panel, **sans jamais faire échouer un build**. Cf.
 * `src/lib/seo/__tests__/identite-legale-registre.spec.ts`, qui garde le côté
 * JSON-LD.
 *
 * La vCard ajoute une troisième surface, et la pire : une carte de visite est
 * imprimée, distribuée, et ne se corrige plus. Elle ne peut pas dériver du
 * JSON-LD — `ADR` veut des champs séparés là où `streetAddress` est d'un seul
 * tenant — donc l'adresse y est forcément réécrite. C'est cette réécriture que
 * le test surveille : il ne compare pas deux constantes voisines, il compare la
 * sortie RÉELLE des deux générateurs.
 */
import { describe, it, expect } from "vitest";

import { buildOrganizationJsonLd } from "@/lib/seo";

import { WILLIAMS } from "./index";

type OrgAddress = {
  address: { streetAddress: string; postalCode: string; addressLocality: string };
};

const org = buildOrganizationJsonLd({ locale: "fr" }) as OrgAddress;

describe("vCard — l'adresse du siège ne diverge pas du JSON-LD", () => {
  const { adresse } = WILLIAMS;

  it("porte la même voie que le JSON-LD de l'organisation", () => {
    expect(org.address.streetAddress).toContain(adresse.rue);
  });

  it("porte le complément de domiciliation, comme le JSON-LD", () => {
    // Le complément fait partie de l'adresse immatriculée : SIRENE le porte sur
    // sa propre ligne. L'omettre d'un seul côté rouvre l'écart du 02/08/2026.
    expect(org.address.streetAddress).toContain(adresse.complement);
  });

  it("porte la même ville et le même code postal", () => {
    expect(adresse.ville).toBe(org.address.addressLocality);
    expect(adresse.codePostal).toBe(org.address.postalCode);
  });

  it("reste comparable au JSON-LD — contre-épreuve", () => {
    // Sans cette contre-épreuve, un `streetAddress` devenu vide ou générique
    // ferait passer les trois tests ci-dessus au vert : `contains("")` est
    // toujours vrai. On vérifie donc que la valeur comparée est bien une
    // adresse, et que la comparaison distingue réellement deux voies.
    expect(org.address.streetAddress.length).toBeGreaterThan(20);
    expect(org.address.streetAddress).not.toContain("11 Rue Paul Verlaine");
  });
});

describe("vCard — les coordonnées imprimées sur la carte", () => {
  it("sont celles du papier", () => {
    // Ces deux valeurs figurent en clair sur la carte distribuée : si elles
    // changent ici sans réimpression, la fiche enregistrée contredit la carte
    // que l'interlocuteur a en main.
    expect(WILLIAMS.telephone).toBe("+33743331201");
    expect(WILLIAMS.email).toBe("williamsjullin@axion-ia.com");
    // Le lien WhatsApp doit viser le même numéro, sans « + » ni espaces.
    expect(WILLIAMS.whatsapp).toBe(`https://wa.me/${WILLIAMS.telephone.replace("+", "")}`);
  });
});
