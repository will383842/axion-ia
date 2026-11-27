/**
 * Garde d'entité de Williams Jullin + builders génériques des fiches équipe.
 *
 * Les valeurs attendues sont écrites EN DUR, volontairement : un test qui relit les mêmes
 * constantes que le code ne garde rien. Si l'une de ces chaînes change, c'est l'identité
 * publiée de la personne qui change, et ça doit se voir dans le diff. Seule l'origine du
 * site (variable d'environnement, `localhost` sous Vitest) est lue, jamais le chemin.
 */
import { describe, expect, it } from "vitest";
import { BRAND, FOUNDER_PERSON_ID } from "@/lib/brand";
import { WILLIAMS_LEAD } from "@/content/equipe/williams";
import { estIndexable, fichePublique, ficheDepuisWilliams } from "@/lib/equipe";
import type { ContenuFiche, FicheCollaborateur } from "@/lib/equipe";
import {
  buildGrapheCollaborateur,
  buildPersonCollaborateurJsonLd,
  buildProfilePageCollaborateurJsonLd,
} from "@/lib/seo/collaborateur-jsonld";
import { buildPersonWilliamsJsonLd } from "@/lib/seo/williams-person";

function williams() {
  const { fiche, contenu } = ficheDepuisWilliams();
  const publique = fichePublique(fiche);
  if (!publique) throw new Error("fiche de Williams refusée");
  return { fiche, publique, contenu };
}

const SITE = BRAND.url;

describe("garde d'entité — Williams Jullin", () => {
  it("le nœud Person garde à l'identique @id, name, givenName, familyName, sameAs, image.@id, worksFor, url", () => {
    const { publique, contenu } = williams();
    const p = buildPersonCollaborateurJsonLd(publique, contenu) as Record<string, unknown>;
    expect(p["@id"]).toBe(`${SITE}/fr/equipe/williams#person`);
    expect(p.name).toBe("Williams Jullin");
    expect(p.givenName).toBe("Williams");
    expect(p.familyName).toBe("Jullin");
    expect(p.sameAs).toEqual(["https://www.linkedin.com/in/williamsjullin/"]);
    expect((p.image as Record<string, unknown>)["@id"]).toBe(`${SITE}/fr/equipe/williams#portrait`);
    expect(p.worksFor).toEqual({ "@id": `${SITE}/#organization` });
    expect(p.url).toBe(`${SITE}/fr/equipe/williams`);
  });

  it("hasOccupation.name et disambiguatingDescription restent ceux de la version précédente", () => {
    const { publique, contenu } = williams();
    const p = buildPersonCollaborateurJsonLd(publique, contenu) as {
      hasOccupation: { name: string };
      disambiguatingDescription: string;
    };
    expect(p.hasOccupation.name).toBe(
      "Consultant et formateur en intelligence artificielle d'entreprise",
    );
    expect(p.disambiguatingDescription).toBe(
      "Fondateur & CEO d'Axion-IA — Spécialiste de l'intelligence artificielle en entreprise · transformations à gains rapides et mesurables",
    );
  });

  it("le builder générique DÉLÈGUE à williams-person.ts (même objet, pas une copie)", () => {
    const { publique, contenu } = williams();
    expect(buildPersonCollaborateurJsonLd(publique, contenu)).toEqual(
      buildPersonWilliamsJsonLd("fr"),
    );
    expect(buildPersonCollaborateurJsonLd(publique, contenu)["@id"]).toBe(FOUNDER_PERSON_ID);
  });

  it("aucune ville : ni homeLocation, ni localité, ni région, ni code postal, ni rue", () => {
    const { publique, contenu } = williams();
    const json = JSON.stringify(buildPersonCollaborateurJsonLd(publique, contenu));
    expect(json).not.toMatch(
      /homeLocation|addressLocality|addressRegion|postalCode|streetAddress|Grenoble/,
    );
  });

  it("la description structurée est la réponse de tête affichée", () => {
    const { publique, contenu } = williams();
    expect(buildPersonCollaborateurJsonLd(publique, contenu).description).toBe(WILLIAMS_LEAD);
    expect(publique.reponseQui).toBe(WILLIAMS_LEAD);
  });

  it("le graphe : Person, ProfilePage, BreadcrumbList Accueil > Équipe > Williams Jullin, FAQPage", () => {
    const { fiche, publique, contenu } = williams();
    const g = buildGrapheCollaborateur(publique, contenu, { indexable: estIndexable(fiche) });
    expect(g.map((n) => n["@type"])).toEqual([
      "Person",
      "ProfilePage",
      "BreadcrumbList",
      "FAQPage",
    ]);
    const fil = g[2] as { itemListElement: Array<{ name: string; item: string }> };
    expect(fil.itemListElement.map((i) => i.name)).toEqual([
      "Accueil",
      "Équipe",
      "Williams Jullin",
    ]);
    expect(fil.itemListElement[1]?.item).toBe(`${SITE}/fr/equipe`);
    const page = g[1] as Record<string, unknown>;
    expect((page.mainEntity as Record<string, string>)["@id"]).toBe(FOUNDER_PERSON_ID);
    expect((page.breadcrumb as Record<string, string>)["@id"]).toBe(
      (g[2] as Record<string, string>)["@id"],
    );
    expect(page.dateModified).toBe(contenu.dateMiseAJour);
    expect(JSON.stringify(g[3])).toContain(FOUNDER_PERSON_ID);
  });

  it("Williams est toujours indexable", () => {
    expect(estIndexable(williams().fiche)).toBe(true);
  });
});

describe("builders génériques — autre collaborateur", () => {
  const brute: FicheCollaborateur = {
    slug: "camille",
    categorie: "specialiste-ia",
    prenom: "Camille",
    nomComplet: "Camille Durand",
    estDirigeantPrincipal: false,
    accord: "f",
    fonction: "Formatrice en intelligence artificielle",
    reponseQui: "Camille forme les équipes des TPE et PME à l'IA, sur leurs propres dossiers.",
    ville: "Lyon",
    departement: "69",
    afficherSurCarte: true,
  };
  const contenu: ContenuFiche = {
    titreSeo: "Camille",
    metaDescription: "Camille",
    sousTitre: "Formatrice",
    dateMiseAJour: "2026-11-27T00:00:00.000Z",
    pastilles: [],
    identite: [],
    faq: [{ id: "q", question: "Qui est Camille ?", answer: "Une formatrice." }],
    appelFinal: { titre: "t", texte: "t", bouton: "b", boutonSecondaire: "s" },
    liens: {},
  };
  const publique = fichePublique(brute);

  it("le nom de famille n'apparaît nulle part (ni name, ni familyName, ni givenName)", () => {
    expect(publique).not.toBeNull();
    const g = buildGrapheCollaborateur(publique!, contenu, { indexable: true });
    const json = JSON.stringify(g);
    expect(json).not.toMatch(/Durand|familyName|givenName/);
    const p = g[0] as Record<string, unknown>;
    expect(p.name).toBe("Camille");
    expect(p["@id"]).toBe(`${SITE}/fr/equipe/camille#person`);
    expect(p.worksFor).toEqual({ "@id": `${SITE}/#organization` });
  });

  it("une personne sans photo n'émet aucune image ; un partenaire est affilié, il ne « travaille pas pour »", () => {
    const sans = buildPersonCollaborateurJsonLd(publique!, contenu);
    expect(sans.image).toBeUndefined();
    const partenaire = fichePublique({ ...brute, categorie: "partenaire", slug: "camille" })!;
    const p = buildPersonCollaborateurJsonLd(partenaire, contenu);
    expect(p.affiliation).toEqual({ "@id": `${SITE}/#organization` });
    expect(p.worksFor).toBeUndefined();
  });

  it("le FAQPage n'est émis que si la fiche est indexable", () => {
    const sans = buildGrapheCollaborateur(publique!, contenu, { indexable: false });
    expect(sans.map((n) => n["@type"])).not.toContain("FAQPage");
    expect(buildProfilePageCollaborateurJsonLd(publique!, contenu)["@id"]).toBe(
      `${SITE}/fr/equipe/camille#profilepage`,
    );
  });
});
