import { describe, expect, it } from "vitest";
import {
  ANCRE_MAX,
  CELLULE_MAX,
  PAGE_SOURCE_MAX,
  normaliserAncre,
  normaliserCible,
  normaliserDomaine,
  normaliserPageSource,
  tronquerCellule,
} from "../normaliser";

describe("normaliserDomaine", () => {
  it("met en minuscules et retire www., le port, le point final", () => {
    expect(normaliserDomaine("https://WWW.Exemple.FR/page")).toBe("exemple.fr");
    expect(normaliserDomaine("Exemple.fr:8080")).toBe("exemple.fr");
    expect(normaliserDomaine("exemple.fr.")).toBe("exemple.fr");
    expect(normaliserDomaine("blog.exemple.fr")).toBe("blog.exemple.fr");
  });
  it("refuse le vide, une valeur sans point, un schéma étranger, une adresse IP", () => {
    expect(normaliserDomaine("")).toBeNull();
    expect(normaliserDomaine("localhost")).toBeNull();
    expect(normaliserDomaine("ftp://exemple.fr")).toBeNull();
    expect(normaliserDomaine("http://127.0.0.1/x")).toBeNull();
    expect(normaliserDomaine("pas un domaine")).toBeNull();
  });
  it("refuse les domaines d'Axion IA (un lien interne n'est pas un lien reçu)", () => {
    expect(normaliserDomaine("https://www.axion-ia.com/fr")).toBeNull();
    expect(normaliserDomaine("axion-ia.com")).toBeNull();
    expect(normaliserDomaine("studio.axion-ia.com")).toBeNull();
  });
  it("ne confond pas un domaine qui ressemble", () => {
    expect(normaliserDomaine("faux-axion-ia.com")).toBe("faux-axion-ia.com");
    expect(normaliserDomaine("axion-ia.com.evil.fr")).toBe("axion-ia.com.evil.fr");
  });
});

describe("normaliserPageSource", () => {
  it("retire le fragment, garde la requête, met l'hôte en minuscules, refuse les identifiants", () => {
    expect(normaliserPageSource("https://Exemple.FR/a/b?x=1#haut")).toBe(
      "https://exemple.fr/a/b?x=1",
    );
    expect(normaliserPageSource("https://user:pw@Exemple.FR/a/b")).toBeNull();
  });
  it("refuse un schéma non http(s), une valeur illisible, une page d'Axion IA", () => {
    expect(normaliserPageSource("javascript:alert(1)")).toBeNull();
    expect(normaliserPageSource("mailto:a@b.fr")).toBeNull();
    expect(normaliserPageSource("pas une url")).toBeNull();
    expect(normaliserPageSource("https://axion-ia.com/fr/blog")).toBeNull();
  });
  it("refuse une URL trop longue", () => {
    expect(normaliserPageSource(`https://exemple.fr/${"a".repeat(PAGE_SOURCE_MAX)}`)).toBeNull();
  });
});

describe("normaliserCible", () => {
  it("passe par normaliserChemin", () => {
    expect(normaliserCible("https://www.axion-ia.com/fr/blog/x/?a=1")).toBe("/fr/blog/x");
    expect(normaliserCible("/fr/faq/")).toBe("/fr/faq");
  });
  it("rend null pour un hôte étranger ou une valeur vide", () => {
    expect(normaliserCible("https://exemple.fr/fr/faq")).toBeNull();
    expect(normaliserCible("")).toBeNull();
  });
  it.each([
    "/fr/blog/x?e=jean@x.fr",
    "/fr/blog/x?e=jean%40x.fr",
    "/fr/blog/x?e=jean%2540x.fr",
    "/fr/blog/jean%2540x.fr",
    // Une séquence invalide (%FF) ne doit pas bloquer le décodage de %2540.
    "/fr/blog%FF/jean%2540x.fr",
    "/fr/blog/x%FF?e=jean%2540x.fr",
  ])("refuse une adresse e-mail encodée : %s", (c) => {
    expect(normaliserCible(c)).toBeNull();
  });
});

describe("normaliserAncre et tronquerCellule", () => {
  it("replie les espaces et tronque à 200", () => {
    expect(normaliserAncre("  Axion   IA \n formation ")).toBe("Axion IA formation");
    expect(normaliserAncre("a".repeat(500))).toHaveLength(ANCRE_MAX);
  });
  it("rend null pour une ancre vide", () => {
    expect(normaliserAncre("   ")).toBeNull();
    expect(normaliserAncre(undefined)).toBeNull();
  });
  it("ne garde aucune cellule au-delà de 2 000 caractères", () => {
    expect(tronquerCellule("x".repeat(5000))).toHaveLength(CELLULE_MAX);
    expect(CELLULE_MAX).toBe(2000);
  });
});

describe("durcissements", () => {
  it("une adresse e-mail n'est pas un domaine", () => {
    expect(normaliserDomaine("jean.dupont@gmail.com")).toBeNull();
  });
  it("une page source sans hôte pointé est refusée", () => {
    expect(normaliserPageSource("intranet/page")).toBeNull();
    expect(normaliserPageSource("http://localhost/x")).toBeNull();
  });
});

describe("durcissements, tour 2", () => {
  it("garde les pages source dont le chemin contient @ (medium, youtube)", () => {
    expect(normaliserPageSource("https://medium.com/@jean/article")).toBe(
      "https://medium.com/@jean/article",
    );
    expect(normaliserPageSource("https://www.youtube.com/@chaine")).toBe(
      "https://www.youtube.com/@chaine",
    );
  });
  it("refuse une adresse e-mail comme page source", () => {
    expect(normaliserPageSource("jean.dupont@gmail.com")).toBeNull();
  });
  it("retire le point final de l'hôte", () => {
    expect(normaliserPageSource("https://exemple.fr./a")).toBe("https://exemple.fr/a");
  });
  it("refuse une cible étrangère sans schéma", () => {
    expect(normaliserCible("autre.fr/x")).toBeNull();
    expect(normaliserCible("n'importe quoi")).toBeNull();
    expect(normaliserCible("axion-ia.com/fr/faq")).toBe("/fr/faq");
  });
});

describe("tour 3", () => {
  it("plafonne cheminCible à 500 sans tronquer", () => {
    expect(normaliserCible(`/fr/${"a".repeat(800)}`)).toBeNull();
    expect(normaliserCible("/fr/ok")).toBe("/fr/ok");
  });
  it("aucune adresse e-mail gardée, avec ou sans schéma, jusque dans la requête", () => {
    expect(normaliserPageSource("https://jean@gmail.com")).toBeNull();
    expect(normaliserPageSource("https://site.fr/p?email=jean@gmail.com")).toBeNull();
  });
});

describe("tour 4 : adresse e-mail dans le chemin, erreurs sans donnée personnelle", () => {
  it.each([
    "https://site.fr/profil/jean@x.fr",
    "https://site.fr/u/jean%40x.fr",
    "https://site.fr/p?e=jean%2540x.fr",
    "https://site.fr/a%FF/jean%2540x.fr",
  ])("refuse %s", (u) => {
    expect(normaliserPageSource(u)).toBeNull();
  });
  it("garde une page ordinaire", () => {
    expect(normaliserPageSource("https://site.fr/profil/jean")).not.toBeNull();
  });
});

describe("tour 6 : e-mail dans une ancre ou un chemin cible", () => {
  it("refuse", () => {
    expect(normaliserAncre("écrivez à jean.dupont@gmail.com")).toBeNull();
    expect(normaliserCible("/fr/contact/jean@x.fr")).toBeNull();
    expect(normaliserAncre("guide IA")).toBe("guide IA");
  });
});
