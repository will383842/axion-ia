/**
 * Nœud JSON-LD `Book` d'un livre du catalogue.
 *
 * **Ce que ce fichier existe pour empêcher.** Un `Book` mal balisé n'est pas neutre : il
 * affirme des choses. Trois pièges, tous évités ici plutôt que documentés ailleurs.
 *
 * 1. `datePublished` n'est émis QUE si le livre est réellement en vente. BookForge date le
 *    paquet web du jour de FABRICATION — reprendre cette date sur un livre non publié
 *    daterait la parution d'un ouvrage que personne ne peut acheter.
 * 2. `offers` n'est émis QUE s'il existe une URL d'achat. Une offre sans destination est
 *    une offre fausse, et Google la traite comme telle.
 * 3. L'auteur est CITÉ par son `@id`, jamais redécrit. C'est ce qui rattache le livre à
 *    l'entité `Person` du site au lieu d'en créer une homonyme (cf. `FOUNDER_PERSON_ID`).
 */

import { BRAND } from "@/lib/brand";
import type { Livre } from "@/content/livres";
import { estPublie } from "@/content/livres";

/** URL absolue de la fiche produit d'un livre. */
export function livreUrl(livre: Livre): string {
  return `${BRAND.url}/${livre.language}/livres/${livre.slug}`;
}

export function buildLivreJsonLd(livre: Livre): Record<string, unknown> {
  const url = livreUrl(livre);
  const publie = estPublie(livre);

  return {
    "@context": "https://schema.org",
    "@type": "Book",
    "@id": `${url}#book`,
    url,
    name: livre.title,
    alternativeHeadline: livre.subtitle,
    description: livre.summary.join("\n\n"),
    inLanguage: livre.language,
    bookEdition: livre.editionLabel,
    bookFormat: "https://schema.org/EBook",
    image: `${BRAND.url}${livre.jackets.product.webp}`,
    ...(livre.pageCount === null ? {} : { numberOfPages: livre.pageCount }),
    // Cité, pas redécrit : l'`@id` rattache le livre à l'auteur du site.
    author: {
      "@type": "Person",
      "@id": livre.author.personId,
      name: livre.author.name,
      ...(livre.author.url === null ? {} : { url: `${BRAND.url}${livre.author.url}` }),
    },
    publisher: { "@id": `${BRAND.url}/#organization` },
    ...(livre.publication.datePublished === null
      ? {}
      : { datePublished: livre.publication.datePublished }),
    ...(livre.publication.printIsbn === null ? {} : { isbn: livre.publication.printIsbn }),
    ...(livre.publication.asin === null
      ? {}
      : {
          identifier: {
            "@type": "PropertyValue",
            propertyID: "ASIN",
            value: livre.publication.asin,
          },
        }),
    ...(publie && livre.publication.amazonUrl !== null
      ? {
          offers: {
            "@type": "Offer",
            url: livre.publication.amazonUrl,
            availability: "https://schema.org/InStock",
          },
        }
      : {}),
  };
}
