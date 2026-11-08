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

type OrgAddress = { address: Record<string, string> };

const org = buildOrganizationJsonLd({ locale: "fr" }) as OrgAddress;

// 2026-11-08 — décision de Williams (audit harmonie n°19) : le JSON-LD ne porte plus
// que le PAYS. L'ancienne exigence « la vCard porte la même voie / ville / code
// postal que le JSON-LD » n'a donc plus d'objet côté JSON-LD ; ce qu'il faut encore
// garder, c'est que la carte imprimée (document où l'adresse du siège est légitime,
// au même titre que les mentions légales) reste complète, et que le JSON-LD ne
// redevienne pas une seconde surface d'adresse.
describe("vCard — l'adresse du siège (JSON-LD : pays seulement, carte : adresse complète)", () => {
  const { adresse } = WILLIAMS;

  it("le JSON-LD de l'organisation ne déclare que le pays", () => {
    expect(org.address).toEqual({ "@type": "PostalAddress", addressCountry: "FR" });
  });

  it("la carte imprimée garde une adresse complète (rue, complément, ville, code postal)", () => {
    for (const champ of [adresse.rue, adresse.complement, adresse.ville, adresse.codePostal]) {
      expect(champ.trim().length).toBeGreaterThan(0);
    }
    expect(adresse.codePostal).toMatch(/^\d{5}$/);
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
