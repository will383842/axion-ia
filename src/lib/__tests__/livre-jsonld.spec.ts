/**
 * Le catalogue des livres, et surtout son état NON PUBLIÉ.
 *
 * La route `/livres` a été construite avant que le premier ouvrage soit en vente, pour
 * qu'il ne reste plus qu'à saisir l'ASIN le jour venu. Ce choix a un risque précis : une
 * fiche produit qui s'indexe trop tôt, annonce une date de parution inventée, ou déclare
 * une offre sans destination. Ces tests tiennent les trois.
 */

import { describe, it, expect } from "vitest";
import { LIVRES, estPublie, livreParSlug, livresPublies, type Livre } from "@/content/livres";
import { buildLivreJsonLd, livreUrl } from "@/lib/seo/livre-jsonld";
import { FOUNDER_PERSON_ID } from "@/lib/brand";

const leSecond = livreParSlug("le-second") as Livre;

/** Un exemplaire publié, sans toucher au catalogue réel. */
const publie: Livre = {
  ...leSecond,
  publication: {
    asin: "B0ABCDEFGH",
    amazonUrl: "https://www.amazon.fr/dp/B0ABCDEFGH",
    printIsbn: "978-2-9600000-0-0",
    datePublished: "2026-09-01",
  },
};

describe("catalogue des livres", () => {
  it("« Le Second » est au catalogue et n'est PAS encore publié", () => {
    expect(leSecond).toBeDefined();
    expect(estPublie(leSecond)).toBe(false);
    expect(livresPublies()).toHaveLength(0);
  });

  it("chaque slug est unique — deux fiches au même chemin s'écraseraient en silence", () => {
    expect(new Set(LIVRES.map((l) => l.slug)).size).toBe(LIVRES.length);
  });

  it("la fiche vit sous /fr/livres/<slug>, le chemin que le JSON-LD du livre annonce", () => {
    expect(livreUrl(leSecond)).toMatch(/\/fr\/livres\/le-second$/);
  });
});

describe("JSON-LD Book — ce qu'il refuse d'affirmer tant que le livre n'est pas en vente", () => {
  const nonPublie = buildLivreJsonLd(leSecond);

  /**
   * BookForge date le paquet web du jour de FABRICATION. Reprendre cette date daterait la
   * parution d'un ouvrage que personne ne peut acheter.
   */
  it("n'annonce AUCUNE date de parution", () => {
    expect(nonPublie).not.toHaveProperty("datePublished");
  });

  it("n'annonce AUCUNE offre — une offre sans destination est une offre fausse", () => {
    expect(nonPublie).not.toHaveProperty("offers");
  });

  it("n'annonce ni ASIN ni ISBN tant qu'Amazon ne les a pas attribués", () => {
    expect(nonPublie).not.toHaveProperty("identifier");
    expect(nonPublie).not.toHaveProperty("isbn");
  });

  it("décrit tout de même le livre : titre, sous-titre, édition, langue, couverture", () => {
    expect(nonPublie["@type"]).toBe("Book");
    expect(nonPublie.name).toBe("Le Second");
    expect(nonPublie.alternativeHeadline).toBe("L'employé IA qui ne dort jamais");
    expect(nonPublie.bookEdition).toBe("1.3");
    expect(nonPublie.inLanguage).toBe("fr");
    expect(String(nonPublie.image)).toContain("/livres/le-second/");
  });

  /**
   * Le point de toute l'opération : le livre CITE l'entité de son auteur au lieu d'en
   * créer une homonyme. Sans cet `@id`, la publication n'ajoute rien à l'autorité de la
   * personne — elle la concurrence.
   */
  it("cite l'auteur par son `@id` canonique, celui de la fiche du site", () => {
    const author = nonPublie.author as { "@id": string; name: string };
    expect(author["@id"]).toBe(FOUNDER_PERSON_ID);
    expect(author.name).toBe("Williams Jullin");
  });

  it("le publisher est CITÉ, pas redécrit — un second nœud Organization le dupliquerait", () => {
    expect(nonPublie.publisher).toEqual({ "@id": expect.stringContaining("#organization") });
  });
});

describe("JSON-LD Book — une fois le livre en vente", () => {
  const jsonLd = buildLivreJsonLd(publie);

  it("émet l'offre, la date, l'ASIN et l'ISBN", () => {
    expect(jsonLd.offers).toEqual({
      "@type": "Offer",
      url: "https://www.amazon.fr/dp/B0ABCDEFGH",
      availability: "https://schema.org/InStock",
    });
    expect(jsonLd.datePublished).toBe("2026-09-01");
    expect(jsonLd.isbn).toBe("978-2-9600000-0-0");
    expect(jsonLd.identifier).toMatchObject({ propertyID: "ASIN", value: "B0ABCDEFGH" });
  });

  it("saisir l'URL d'achat SUFFIT à basculer l'état publié — aucun code à toucher", () => {
    expect(estPublie(publie)).toBe(true);
  });
});
