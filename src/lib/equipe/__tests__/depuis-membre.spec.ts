import { describe, expect, it } from "vitest";
import { buildGrapheCollaborateur } from "@/lib/seo/collaborateur-jsonld";
import { evaluerIndexabilite } from "../donnees/indexabilite";
import { fichePublique } from "../regles";
import { ficheDepuisMembre, type MembrePublic } from "../depuis-membre";

const CONSENT = new Date("2026-11-01T10:00:00Z");

function membre(sur: Partial<MembrePublic> = {}): MembrePublic {
  return {
    slug: "camille",
    category: "specialiste_ia",
    firstName: "Camille",
    organizationName: null,
    jobTitle: "Formatrice en intelligence artificielle",
    headline: "Camille forme les équipes des TPE et PME à l'IA, sur leurs propres dossiers.",
    bioMd: null,
    skills: [],
    languages: [],
    categoryAnswers: null,
    questionnaireVersion: null,
    linkedinUrl: "https://www.linkedin.com/in/camille-durand/",
    websiteUrl: null,
    citySlug: null,
    departmentCode: "69",
    locationLabel: "Lyon",
    latitude: 45.76,
    longitude: 4.84,
    showOnMap: true,
    photoKind: "reelle",
    photoUrl256: "/api/equipe/photo/jeton/256",
    photoUrl1024: "/api/equipe/photo/jeton/1024",
    photoAlt: "Camille",
    photoConsentAt: CONSENT,
    linkedinConsentAt: CONSENT,
    publishedAt: CONSENT,
    updatedAt: CONSENT,
    ...sur,
  };
}

function graphe(m: MembrePublic) {
  const { fiche, contenu } = ficheDepuisMembre(m);
  const publique = fichePublique(fiche)!;
  const g = buildGrapheCollaborateur(publique, contenu, {
    indexable: evaluerIndexabilite(m).indexable,
  });
  return { fiche, contenu, publique, g, person: g[0] as Record<string, unknown> };
}

describe("ficheDepuisMembre : consentements", () => {
  it("avec consentements : photo, LinkedIn et lieu", () => {
    const { publique, contenu, person } = graphe(membre());
    expect(publique.photo?.src).toBe("/api/equipe/photo/jeton/1024");
    expect(publique.photo?.consentementLe).toBeTruthy();
    expect(contenu.liens.linkedin).toBe("https://www.linkedin.com/in/camille-durand/");
    expect(person.sameAs).toEqual(["https://www.linkedin.com/in/camille-durand/"]);
    expect(person.image).toBeDefined();
    expect(JSON.stringify(person)).toContain("Lyon");
  });

  it("sans consentement photo : ni photo, ni image JSON-LD", () => {
    const { publique, person } = graphe(membre({ photoConsentAt: null }));
    expect(publique.photo).toBeUndefined();
    expect(person.image).toBeUndefined();
  });

  it("photo « avatar » : pas de photo", () => {
    expect(graphe(membre({ photoKind: "avatar" })).publique.photo).toBeUndefined();
  });

  it("sans consentement LinkedIn : ni lien, ni sameAs", () => {
    const { contenu, person } = graphe(membre({ linkedinConsentAt: null }));
    expect(contenu.liens.linkedin).toBeUndefined();
    expect(person.sameAs).toBeUndefined();
    expect(JSON.stringify(person)).not.toContain("linkedin");
  });

  it("sans lieu : pas d'addressLocality", () => {
    const { person } = graphe(
      membre({ locationLabel: null, departmentCode: null, latitude: null, longitude: null }),
    );
    expect(JSON.stringify(person)).not.toContain("addressLocality");
  });
});

describe("ficheDepuisMembre : identité", () => {
  it("prénom seul, givenName seul, jamais familyName ni e-mail", () => {
    const { g, person, publique } = graphe(membre());
    expect(publique.nom).toBe("Camille");
    expect(person.name).toBe("Camille");
    expect(person.givenName).toBe("Camille");
    const json = JSON.stringify(g);
    expect(json).not.toMatch(/familyName|@[a-z0-9-]+\.[a-z]{2,}/i);
  });

  it("@id propre au slug, rattaché à l'Organization", () => {
    const { person } = graphe(membre());
    expect(String(person["@id"])).toMatch(/\/fr\/equipe\/camille#person$/);
    expect(JSON.stringify(person)).toContain("#organization");
  });

  it("un prénom qui ressemble à Williams n'usurpe pas l'entité du fondateur", () => {
    const { person } = graphe(membre({ slug: "williams-bis", firstName: "Williams" }));
    expect(String(person["@id"])).toContain("williams-bis");
    expect(person.familyName).toBeUndefined();
  });

  it("catégorie « specialiste_ia » et « autres » reconnues", () => {
    expect(ficheDepuisMembre(membre()).fiche.categorie).toBe("specialiste-ia");
    expect(() => ficheDepuisMembre(membre({ category: "autres" }))).not.toThrow();
  });

  it("aucun prix, aucune ville interdite dans le contenu rendu", () => {
    const { contenu } = ficheDepuisMembre(membre());
    expect(JSON.stringify(contenu)).not.toMatch(/€|grenoble|freelance|commission/i);
  });
});
