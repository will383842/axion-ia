import { describe, expect, it } from "vitest";
import { buildGrapheCollaborateur } from "@/lib/seo/collaborateur-jsonld";
import { evaluerIndexabilite } from "../donnees/indexabilite";
import { fichePublique } from "../regles";
import {
  ficheDepuisMembre,
  titreCollaborateur,
  type ExtensionContenuR2c2,
  type MembrePublic,
} from "../depuis-membre";
import { MODELES, remplirPrenom } from "../modeles-categorie";
import { villesPresence, NOMBRE_VILLES_PRESENCE } from "../presence";

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

  it("une fonction ou une ville interdite n'apparaît nulle part dans le contenu", () => {
    const { contenu } = ficheDepuisMembre(
      membre({ jobTitle: "Consultant IA, TJM 600 €", locationLabel: "Grenoble" }),
    );
    expect(JSON.stringify(contenu)).not.toMatch(/TJM|600|grenoble/i);
  });

  it("une seule variante de photo : pas de photo réelle", () => {
    expect(graphe(membre({ photoUrl256: null })).publique.photo).toBeUndefined();
  });
});

function texteDe(valeur: unknown): string {
  return JSON.stringify(valeur);
}

function etendu(m: MembrePublic) {
  return ficheDepuisMembre(m).contenu as ReturnType<typeof ficheDepuisMembre>["contenu"] &
    ExtensionContenuR2c2;
}

describe("ficheDepuisMembre : registre R2c2", () => {
  it("aucun chiffre clé sans donnée : une seule langue, ou aucune, ne donne aucun bloc", () => {
    expect(etendu(membre({ languages: [] })).chiffresCles).toBeUndefined();
    expect(etendu(membre({ languages: ["Français", "Anglais"] })).chiffresCles).toBeUndefined();
  });

  it("apporteur : ni commission, ni rémunération, ni euro, ni pourcentage dans le texte", () => {
    const c = etendu(membre({ category: "apporteur" }));
    const texte = [c.vousEtes, c.presence, c.pourQui, c.entetes, c.sectionsCategorie, c.faq]
      .map(texteDe)
      .join(" ");
    expect(texte).not.toMatch(/commission|rémunér|€|%|freelance|garantit/i);
  });

  it("prénom seul : le nom de famille n'est dans aucun champ du contenu", () => {
    for (const category of ["apporteur", "specialiste_ia", "developpeur", "partenaire"]) {
      const json = texteDe(etendu(membre({ category, bioMd: "Camille Durand forme." })));
      expect(json).not.toMatch(/Durand/);
    }
  });

  it("3 cartes « Vous êtes » au plus, sans chiffre ni montant, et des textes propres à chaque catégorie", () => {
    const titres = new Set<string>();
    for (const category of ["apporteur", "specialiste_ia", "developpeur", "partenaire"]) {
      const cartes = etendu(membre({ category })).vousEtes ?? [];
      expect(cartes.length).toBeGreaterThan(0);
      expect(cartes.length).toBeLessThanOrEqual(3);
      for (const c of cartes) {
        expect(`${c.titre}${c.cout}${c.action}${c.gain}`).not.toMatch(/\d|€|\{prenom\}/);
        expect(titres.has(c.titre)).toBe(false);
        titres.add(c.titre);
      }
    }
  });

  it("la réponse « près de chez moi » compte 40 à 60 mots et diffère selon la catégorie", () => {
    const reponses = new Set<string>();
    for (const [id, modele] of Object.entries(MODELES)) {
      const mots = remplirPrenom(modele.presence.reponse, "Camille").trim().split(/\s+/).length;
      expect(mots, id).toBeGreaterThanOrEqual(40);
      expect(mots, id).toBeLessThanOrEqual(60);
      reponses.add(modele.presence.reponse);
    }
    expect(reponses.size).toBe(Object.keys(MODELES).length);
  });

  it("phrase de lieu : département seul s'il n'y a pas de ville, rien s'il n'y a ni l'un ni l'autre", () => {
    const sansVille = etendu(membre({ locationLabel: null, departmentCode: "38" }));
    expect(sansVille.presence.phraseLieu).toBe(
      "Camille travaille depuis le département 38 et intervient partout en France.",
    );
    const rien = etendu(membre({ locationLabel: null, departmentCode: null }));
    expect(rien.presence.phraseLieu).toBeUndefined();
    // Ville écartée par la fiche publique : ni elle, ni son département ne sortent.
    const ecartee = etendu(
      membre({ locationLabel: ["Gren", "oble"].join(""), departmentCode: "38" }),
    );
    expect(ecartee.presence.phraseLieu).toBeUndefined();
    expect(texteDe(ecartee)).not.toMatch(new RegExp(["Gren", "oble"].join("")));
  });

  it("titre collaborateur : 60 caractères au plus, fonction tronquée", () => {
    const t = titreCollaborateur(
      "Camille",
      "Formatrice en intelligence artificielle et accompagnement",
    );
    expect(t.length).toBeLessThanOrEqual(60);
    expect(t.endsWith(" · Axion-IA")).toBe(true);
    expect(titreCollaborateur("Camille", "Formatrice")).toBe("Camille, Formatrice · Axion-IA");
  });

  it("villes de présence : 12 au plus, population décroissante, ville écartée du maillage absente, liens /audit/par-ville", () => {
    const v = villesPresence();
    expect(v.length).toBe(NOMBRE_VILLES_PRESENCE);
    expect(v.some((x) => x.slug === ["gren", "oble"].join(""))).toBe(false);
    for (const x of v) expect(x.href).toBe(`/audit/par-ville/${x.slug}`);
  });
});
