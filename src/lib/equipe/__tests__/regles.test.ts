import { describe, expect, it } from "vitest";
import {
  elementsDistinctifs,
  estIndexable,
  estTextePropre,
  fichePublique,
  initiales,
  nomAffiche,
  slugCollaborateur,
  slugifier,
  type FicheCollaborateur,
} from "..";

const REPONSE = "x".repeat(10);
const reponseLongue =
  `${"Camille accompagne les TPE et PME dans leurs projets d'intelligence artificielle. ".repeat(4)}`.trim();

function fiche(surcharge: Partial<FicheCollaborateur> = {}): FicheCollaborateur {
  return {
    slug: "camille",
    categorie: "specialiste-ia",
    prenom: "Camille",
    nomComplet: "Camille Dupont-Martin",
    estDirigeantPrincipal: false,
    accord: "n",
    fonction: "Spécialiste IA",
    reponseQui: reponseLongue,
    ville: "Lyon",
    departement: "69",
    afficherSurCarte: true,
    ...surcharge,
  };
}

const williams = fiche({
  slug: "williams",
  categorie: "direction",
  prenom: "Williams",
  nomComplet: "Williams Jullin",
  estDirigeantPrincipal: true,
  reponseQui: REPONSE,
  afficherSurCarte: false,
});

const riche = fiche({
  photo: {
    src: "/c.jpg",
    largeur: 800,
    hauteur: 800,
    alt: "Camille",
    consentementLe: "2026-11-01",
  },
  citations: ["Une phrase de terrain."],
  publications: 2,
  parcours: { avant: [{ annee: 2015, libelle: "Responsable data" }] },
});

describe("nomAffiche", () => {
  it("prénom seul pour un collaborateur, même avec un nom complet saisi", () => {
    expect(nomAffiche(fiche())).toBe("Camille");
  });
  it("nom complet pour Williams seulement", () => {
    expect(nomAffiche(williams)).toBe("Williams Jullin");
  });
  it("le drapeau dirigeant seul ne suffit pas sans le slug figé", () => {
    expect(nomAffiche(fiche({ estDirigeantPrincipal: true }))).toBe("Camille");
  });
  it("le slug williams seul ne suffit pas sans le drapeau", () => {
    expect(nomAffiche(fiche({ slug: "williams" }))).toBe("Camille");
  });
  it("repli sur le prénom si Williams n'a pas de nom complet", () => {
    expect(nomAffiche({ ...williams, nomComplet: "  " })).toBe("Williams");
  });
  it("prénoms composés et espaces superflus", () => {
    expect(nomAffiche(fiche({ prenom: "  Jean-Pierre  " }))).toBe("Jean-Pierre");
    expect(nomAffiche(fiche({ prenom: "Marie   Claire" }))).toBe("Marie Claire");
  });
  it("prénom vide → chaîne vide", () => {
    expect(nomAffiche(fiche({ prenom: "   " }))).toBe("");
  });
});

describe("initiales", () => {
  it("une lettre pour un collaborateur", () => {
    expect(initiales(fiche())).toBe("C");
  });
  it("accent conservé et majuscule", () => {
    expect(initiales(fiche({ prenom: "élodie" }))).toBe("É");
    expect(initiales(fiche({ prenom: "Œdipe" }))).toBe("Œ");
  });
  it("prénom composé : première lettre seulement", () => {
    expect(initiales(fiche({ prenom: "Jean-Pierre" }))).toBe("J");
  });
  it("WJ pour Williams", () => {
    expect(initiales(williams)).toBe("WJ");
  });
  it("prénom vide → « ? »", () => {
    expect(initiales(fiche({ prenom: "" }))).toBe("?");
  });
  it("n'expose pas le nom de famille d'un collaborateur", () => {
    expect(initiales(fiche({ nomComplet: "Camille Dupont" }))).not.toContain("D");
  });
});

describe("slugifier / slugCollaborateur", () => {
  it("retire accents, ligatures, apostrophes", () => {
    expect(slugifier("Élodie")).toBe("elodie");
    expect(slugifier("Chloé-Anaïs")).toBe("chloe-anais");
    expect(slugifier("Œdipe")).toBe("oedipe");
    expect(slugifier("D'Artagnan")).toBe("dartagnan");
  });
  it("prénom composé", () => {
    expect(slugCollaborateur("Jean-Pierre", null)).toBe("jean-pierre");
    expect(slugCollaborateur("Marie Claire", null)).toBe("marie-claire");
  });
  it("prénom vide ou sans lettre → null", () => {
    expect(slugCollaborateur("", "Lyon")).toBeNull();
    expect(slugCollaborateur("  ", "Lyon")).toBeNull();
    expect(slugCollaborateur("!!!", "Lyon")).toBeNull();
  });
  it("collision → prenom-ville, jamais le nom", () => {
    expect(slugCollaborateur("Camille", "Saint-Étienne", ["camille"])).toBe(
      "camille-saint-etienne",
    );
  });
  it("collision sans ville ou même ville → suffixe numérique", () => {
    expect(slugCollaborateur("Camille", null, ["camille"])).toBe("camille-2");
    expect(slugCollaborateur("Camille", "Lyon", ["camille", "camille-lyon"])).toBe(
      "camille-lyon-2",
    );
    expect(
      slugCollaborateur("Camille", "Lyon", ["camille", "camille-lyon", "camille-lyon-2"]),
    ).toBe("camille-lyon-3");
  });
  it("accepte tout itérable, n'altère pas l'entrée", () => {
    const pris = new Set(["camille"]);
    expect(slugCollaborateur("Camille", "Lyon", pris)).toBe("camille-lyon");
    expect([...pris]).toEqual(["camille"]);
  });
  it("slugs réservés : williams et manon ne sont jamais attribués", () => {
    expect(slugCollaborateur("Williams", "Lyon")).toBe("williams-lyon");
    expect(slugCollaborateur("Manon", null)).toBe("manon-2");
  });
});

describe("estTextePropre", () => {
  it.each([
    "Tarif 100 €",
    "une commission",
    "frais de déplacement",
    "Top 1 %",
    "grandes écoles",
    "CAC 40",
    "Grenoble",
  ])("refuse %s", (t) => expect(estTextePropre(`Texte ${t} fin`)).toBe(false));
  it("refuse le vide, accepte un texte sain", () => {
    expect(estTextePropre("  ")).toBe(false);
    expect(estTextePropre(null)).toBe(false);
    expect(estTextePropre("Partout en France")).toBe(true);
  });
});

describe("estIndexable", () => {
  it("Williams : toujours vrai", () => {
    expect(estIndexable(williams)).toBe(true);
  });
  it("collaborateur complet : vrai", () => {
    expect(elementsDistinctifs(riche)).toBe(3);
    expect(estIndexable(riche)).toBe(true);
  });
  it("sans photo, ou photo sans consentement : faux", () => {
    expect(estIndexable({ ...riche, photo: null })).toBe(false);
    expect(estIndexable({ ...riche, photo: { ...riche.photo!, consentementLe: null } })).toBe(
      false,
    );
    expect(estIndexable({ ...riche, photo: { ...riche.photo!, consentementLe: "  " } })).toBe(
      false,
    );
  });
  it("réponse trop courte, trop longue ou non propre : faux", () => {
    expect(estIndexable({ ...riche, reponseQui: "Courte." })).toBe(false);
    expect(estIndexable({ ...riche, reponseQui: "a".repeat(451) })).toBe(false);
    expect(estIndexable({ ...riche, reponseQui: `${reponseLongue} 100 €` })).toBe(false);
  });
  it("bornes de longueur 280 et 450 incluses", () => {
    expect(estIndexable({ ...riche, reponseQui: "a".repeat(280) })).toBe(true);
    expect(estIndexable({ ...riche, reponseQui: "a".repeat(450) })).toBe(true);
    expect(estIndexable({ ...riche, reponseQui: "a".repeat(279) })).toBe(false);
  });
  it("moins de 3 éléments distinctifs : faux", () => {
    expect(estIndexable({ ...riche, publications: 0 })).toBe(false);
  });
  it("un métier de base de la catégorie ne compte pas", () => {
    const f = { ...riche, publications: 0, metiers: [{ id: "formation-ia", nom: "Formation" }] };
    expect(elementsDistinctifs(f)).toBe(2);
    const g = { ...f, metiers: [{ id: "veille-sectorielle", nom: "Veille" }] };
    expect(elementsDistinctifs(g)).toBe(3);
  });
  it("chaque famille compte une seule fois", () => {
    const f = fiche({ citations: ["a", "b", "c", "d"], publications: 0 });
    expect(elementsDistinctifs(f)).toBe(1);
  });
  it("éléments vides ignorés", () => {
    const f = fiche({
      citations: ["  "],
      parcours: { avant: [{ annee: 2015, libelle: " " }], attestations: [" "] },
    });
    expect(elementsDistinctifs(f)).toBe(0);
  });
  it("drapeau dirigeant sans slug figé : pas de passe-droit", () => {
    expect(estIndexable(fiche({ estDirigeantPrincipal: true }))).toBe(false);
  });
});

describe("confidentialité du nom de famille", () => {
  const FAMILLE = "Dupont-Martin";
  const parcours = [
    riche,
    fiche({ categorie: "apporteur" }),
    fiche({ categorie: "developpeur", nomComplet: `Camille ${FAMILLE}` }),
    fiche({ categorie: "partenaire" }),
    fiche({ categorie: "direction", estDirigeantPrincipal: true }),
  ];

  it.each(parcours.map((f, i) => [i, f] as const))(
    "aucune sortie du module ne contient le nom de famille (fiche %i)",
    (_i, f) => {
      const sorties = JSON.stringify([
        fichePublique(f),
        nomAffiche(f),
        initiales(f),
        slugCollaborateur(f.prenom, f.ville, ["camille"]),
      ]);
      expect(sorties).not.toContain(FAMILLE);
      expect(sorties).not.toContain("Dupont");
      expect(sorties).not.toContain("nomComplet");
    },
  );

  it("fichePublique ne porte ni nomComplet ni prenom brut", () => {
    const p = fichePublique(riche) as unknown as Record<string, unknown>;
    expect("nomComplet" in p).toBe(false);
    expect("prenom" in p).toBe(false);
    expect(p.nom).toBe("Camille");
  });

  it("fichePublique écarte les clés inconnues glissées dans la fiche", () => {
    const sale = { ...riche, email: "a@b.fr", nomDeNaissance: "Dupont" } as FicheCollaborateur;
    expect(JSON.stringify(fichePublique(sale))).not.toMatch(/Dupont|a@b\.fr/);
  });

  it("Williams reste nommé en entier", () => {
    expect(fichePublique(williams).nom).toBe("Williams Jullin");
    expect(fichePublique(williams).estDirigeantPrincipal).toBe(true);
  });

  it("le drapeau dirigeant d'un autre slug est neutralisé dans la sortie publique", () => {
    expect(fichePublique(fiche({ estDirigeantPrincipal: true })).estDirigeantPrincipal).toBe(false);
  });
});
