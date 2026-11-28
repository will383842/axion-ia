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
import { WILLIAMS_LEAD, WILLIAMS_DESCRIPTION_PERSON } from "@/content/equipe/williams";
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
    // Seul `areaServed` est ajouté par le builder générique (williams-person.ts n'est pas modifié).
    const { areaServed, ...reste } = buildPersonCollaborateurJsonLd(publique, contenu);
    expect(areaServed).toBeDefined();
    const williamsSeul = buildPersonWilliamsJsonLd("fr") as Record<string, unknown>;
    const { areaServed: dejaLa, ...attendu } = williamsSeul;
    void dejaLa;
    expect(reste).toEqual(attendu);
    expect(buildPersonCollaborateurJsonLd(publique, contenu)["@id"]).toBe(FOUNDER_PERSON_ID);
  });

  it("aucune ville : ni homeLocation, ni localité, ni région, ni code postal, ni rue", () => {
    const { publique, contenu } = williams();
    const json = JSON.stringify(buildPersonCollaborateurJsonLd(publique, contenu));
    expect(json).not.toMatch(
      /homeLocation|addressLocality|addressRegion|postalCode|streetAddress|Grenoble/,
    );
  });

  it("areaServed : France puis régions de France, sans Grenoble ; @id et sameAs inchangés", () => {
    const { publique, contenu } = williams();
    const p = buildPersonCollaborateurJsonLd(publique, contenu) as Record<string, unknown>;
    const zones = p.areaServed as Array<{ "@type": string; name: string }>;
    expect(zones[0]).toEqual({ "@type": "Country", name: "France" });
    expect(zones.length).toBeGreaterThan(5);
    expect(zones.slice(1).every((z) => z["@type"] === "AdministrativeArea")).toBe(true);
    expect(JSON.stringify(zones)).not.toMatch(/Grenoble/);
    const ref = buildPersonWilliamsJsonLd("fr") as Record<string, unknown>;
    expect(p["@id"]).toBe(ref["@id"]);
    expect(p.sameAs).toEqual(ref.sameAs);
  });

  it("la description de Person est à la 3e personne, sans « nous »", () => {
    const { publique, contenu } = williams();
    const description = buildPersonCollaborateurJsonLd(publique, contenu).description as string;
    expect(description).toBe(WILLIAMS_DESCRIPTION_PERSON);
    expect(description).not.toMatch(/\bnous\b|\bnotre\b|\bnos\b/i);
    expect(description).toMatch(/^Williams Jullin dirige Axion-IA/);
    expect(publique.reponseQui).toBe(WILLIAMS_LEAD);
  });

  it("la fonction affichée est exactement Person.jobTitle", () => {
    const { publique, contenu } = williams();
    expect(publique.fonction).toBe(buildPersonCollaborateurJsonLd(publique, contenu).jobTitle);
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

  it("le nom de famille n'apparaît nulle part (ni name, ni familyName ; givenName = prénom seul)", () => {
    expect(publique).not.toBeNull();
    const g = buildGrapheCollaborateur(publique!, contenu, { indexable: true });
    const json = JSON.stringify(g);
    expect(json).not.toMatch(/Durand|familyName/);
    const p = g[0] as Record<string, unknown>;
    expect(p.name).toBe("Camille");
    expect(p.givenName).toBe("Camille");
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

  it("areaServed : département et ville présents quand ils sont connus, jamais Grenoble", () => {
    const p = buildPersonCollaborateurJsonLd(publique!, contenu) as Record<string, unknown>;
    const json = JSON.stringify(p.areaServed);
    expect(json).toContain('"name":"Département 69"');
    expect(json).toContain('"@type":"City","name":"Lyon"');
    const grenoble = fichePublique({ ...brute, ville: "Grenoble", departement: "38" })!;
    const g = JSON.stringify(buildPersonCollaborateurJsonLd(grenoble, contenu).areaServed);
    // La fiche publique écarte déjà cette ville (et son département) : rien n'en sort.
    expect(g).not.toMatch(/Grenoble|"City"/);
  });

  it("areaServed : ni ville ni département quand ils ne sont pas renseignés", () => {
    const { ville: _v, departement: _d, ...sansVilleBrute } = brute;
    void _v;
    void _d;
    const sansLieu = fichePublique(sansVilleBrute)!;
    const zones = buildPersonCollaborateurJsonLd(sansLieu, contenu).areaServed as Array<
      Record<string, string>
    >;
    expect(zones.some((z) => z["@type"] === "City")).toBe(false);
    expect(JSON.stringify(zones)).not.toMatch(/Département/);
    expect(zones[0]).toEqual({ "@type": "Country", name: "France" });
  });

  it("un seul FAQPage, @id propre, rattaché à la ProfilePage, textes = FAQ du contenu", () => {
    const g = buildGrapheCollaborateur(publique!, contenu, { indexable: true });
    const faqs = g.filter((n) => n["@type"] === "FAQPage");
    expect(faqs).toHaveLength(1);
    const faq = faqs[0] as Record<string, unknown>;
    expect(faq["@id"]).toBe(`${SITE}/fr/equipe/camille#faq`);
    expect(faq.isPartOf).toEqual({ "@id": `${SITE}/fr/equipe/camille#profilepage` });
    const q = (faq.mainEntity as Array<{ name: string; acceptedAnswer: { text: string } }>)[0];
    expect(q?.name).toBe(contenu.faq[0]?.question);
    expect(q?.acceptedAnswer.text).toBe(contenu.faq[0]?.answer);
    expect(g.filter((n) => n["@type"] === "Organization")).toHaveLength(0);
  });

  it("knowsAbout reprend les compétences renseignées, et seulement elles", () => {
    expect(buildPersonCollaborateurJsonLd(publique!, contenu).knowsAbout).toBeUndefined();
    const avec = buildPersonCollaborateurJsonLd(publique!, {
      ...contenu,
      competences: ["Rédaction", "Devis"],
    });
    expect(avec.knowsAbout).toEqual(["Rédaction", "Devis"]);
  });

  it("le FAQPage n'est émis que si la fiche est indexable", () => {
    const sans = buildGrapheCollaborateur(publique!, contenu, { indexable: false });
    expect(sans.map((n) => n["@type"])).not.toContain("FAQPage");
    expect(buildProfilePageCollaborateurJsonLd(publique!, contenu)["@id"]).toBe(
      `${SITE}/fr/equipe/camille#profilepage`,
    );
  });
});
