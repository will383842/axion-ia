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
  it("retire le fragment, les identifiants, garde la requête, met l'hôte en minuscules", () => {
    expect(normaliserPageSource("https://user:pw@Exemple.FR/a/b?x=1#haut")).toBe(
      "https://exemple.fr/a/b?x=1",
    );
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
