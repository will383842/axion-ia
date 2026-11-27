import { describe, expect, it } from "vitest";
import {
  elementsDistinctifs,
  estIndexable,
  estTextePropre,
  fichePublique as fichePubliqueBrute,
  initiales,
  nomAffiche,
  slugCollaborateur,
  slugifier,
  validerPrenom,
  type FicheCollaborateur,
} from "..";

const fichePublique = (f: FicheCollaborateur) => fichePubliqueBrute(f)!;
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

describe("durcissements (relecture)", () => {
  it("objets imbriqués recopiés champ par champ", () => {
    const sale = {
      ...riche,
      photo: { ...riche.photo!, nomOriginal: "Dupont" },
      metiers: [{ id: "veille", nom: "Veille", auteur: "Dupont" }],
      parcours: { avant: [{ annee: 2015, libelle: "Data", chef: "Dupont" }] },
    } as unknown as FicheCollaborateur;
    expect(JSON.stringify(fichePublique(sale))).not.toContain("Dupont");
  });
  it("slug contenant le nom de famille remplacé par le prénom", () => {
    const f = fiche({ slug: "camille-dupont-martin" });
    expect(fichePublique(f).slug).toBe("camille");
  });
  it("nom de famille glissé dans le prénom", () => {
    const f = fiche({ prenom: "Camille Dupont-Martin" });
    expect(nomAffiche(f)).toBe("Camille");
    expect(initiales(f)).toBe("C");
    expect(slugCollaborateur(f.prenom, null, [], f.nomComplet)).toBe("camille");
  });
  it("prénom composé avec espace conservé", () => {
    const f = fiche({ prenom: "Marie Claire", nomComplet: "Marie Claire Dupont" });
    expect(nomAffiche(f)).toBe("Marie Claire");
  });
  it("Williams n'a jamais de point sur la carte", () => {
    expect(fichePublique({ ...williams, afficherSurCarte: true }).afficherSurCarte).toBe(false);
  });
  it("ville ou texte interdit écartés de la sortie et du slug", () => {
    const f = fiche({ ville: "Grenoble", fonction: "Expert à 100 euros" });
    expect(fichePublique(f).ville).toBeUndefined();
    expect(fichePublique(f).fonction).toBe("");
    expect(slugCollaborateur("Camille", "Grenoble", ["camille"])).toBe("camille-2");
  });
  it("textes publiés sans le nom de famille", () => {
    const f = fiche({
      reponseQui: "Camille Dupont-Martin accompagne les TPE.",
      fonction: "Spécialiste IA",
      photo: {
        src: "/equipe/camille-dupont-martin.jpg",
        largeur: 8,
        hauteur: 8,
        alt: "Portrait de Camille Dupont-Martin",
        consentementLe: "2026-11-01",
      },
      citations: ["Dupont-Martin dit oui", "Une citation saine"],
    });
    const p = fichePublique(f);
    expect(JSON.stringify(p)).not.toMatch(/Dupont|dupont/);
    expect(p.citations).toEqual(["Une citation saine"]);
    const g = fichePublique({ ...f, photo: { ...f.photo!, src: "/c.jpg" } });
    expect(g.photo?.alt).toBe("Portrait de Camille");
  });
  it("noms à particule et composés", () => {
    const f = fiche({ prenom: "Manon Le", nomComplet: "Manon Le Gall", slug: "manon-le-gall" });
    expect(nomAffiche(f)).not.toMatch(/Gall/);
    expect(JSON.stringify(fichePublique(f))).not.toMatch(/gall/i);
  });
  it("slug de remplacement : réservé ou déjà pris jamais repris", () => {
    const f = fiche({ prenom: "Manon", nomComplet: "Manon Dupont", slug: "manon-dupont" });
    expect(fichePublique(f).slug).toBe("manon-lyon");
    const g = fiche({ prenom: "Marie", nomComplet: "Marie Dupont", slug: "marie-dupont" });
    expect(fichePubliqueBrute(g, ["marie"])!.slug).toBe("marie-lyon");
    expect(
      fichePublique(fiche({ prenom: "Williams", nomComplet: "Williams Martin", slug: "williams" }))
        .slug,
    ).toBe("williams-lyon");
  });
  it("photo sans consentement : absente de la sortie", () => {
    const f = fiche({
      photo: { src: "/c.jpg", largeur: 8, hauteur: 8, alt: "x", consentementLe: null },
    });
    expect(fichePublique(f).photo).toBeUndefined();
  });
  it("les éléments non affichables ne comptent pas pour l'indexation", () => {
    const f = { ...riche, citations: ["Un prix de 100 euros"], publications: 0 };
    expect(elementsDistinctifs(f)).toBe(1);
  });
  it("prix en toutes lettres refusés", () => {
    expect(estTextePropre("Tarif 100 euros HT")).toBe(false);
    expect(estTextePropre("1 500 EUR")).toBe(false);
  });
  it("Williams : réponse non propre → non indexable", () => {
    expect(estIndexable({ ...williams, reponseQui: "Grenoble 100 €" })).toBe(false);
  });
  it("consentement invalide ≠ consentement", () => {
    expect(estIndexable({ ...riche, photo: { ...riche.photo!, consentementLe: "non" } })).toBe(
      false,
    );
  });
  it("éléments null dans les tableaux ne plantent pas", () => {
    const f = {
      ...riche,
      metiers: [null],
      parcours: { avant: [null] },
    } as unknown as FicheCollaborateur;
    expect(() => estIndexable(f)).not.toThrow();
    expect(() => fichePublique(f)).not.toThrow();
  });
  it("prénom vide → pas de fiche publique", () => {
    expect(fichePubliqueBrute(fiche({ prenom: " " }))).toBeNull();
  });
  it("accents décomposés et lettres spéciales", () => {
    expect(initiales(fiche({ prenom: "e\u0301lodie" }))).toBe("É");
    expect(slugifier("Łukasz")).toBe("lukasz");
    expect(slugifier("Ørjan")).toBe("orjan");
    expect(slugifier("Groß")).toBe("gross");
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

describe("validerPrenom", () => {
  it("accepte prénoms simples, composés, accentués, avec apostrophe", () => {
    for (const p of ["Camille", "Jean-Pierre", "Anne Sophie", "Zoé", "N'Golo", "Éloïse"]) {
      expect(validerPrenom(p, "Camille Durand")).toBeNull();
    }
  });
  it("refuse vide, nul, espaces", () => {
    expect(validerPrenom("")).toBe("vide");
    expect(validerPrenom("   ")).toBe("vide");
    expect(validerPrenom(null)).toBe("vide");
    expect(validerPrenom(undefined)).toBe("vide");
  });
  it("refuse chiffres, signes, adresse", () => {
    expect(validerPrenom("Cam1lle")).toBe("caracteres");
    expect(validerPrenom("a@b.fr")).toBe("caracteres");
    expect(validerPrenom("-Camille")).toBe("caracteres");
  });
  it("refuse plus de 40 caractères", () => {
    expect(validerPrenom("a".repeat(41))).toBe("trop-long");
  });
  it("refuse un nom de famille saisi dans le prénom", () => {
    expect(validerPrenom("Camille Durand", "Camille Durand")).toBe("contient-nom-de-famille");
    expect(validerPrenom("Durand", "Camille Durand")).toBe("contient-nom-de-famille");
  });
});

describe("repli chef-lieu", () => {
  it("ville écartée : ni ville ni département (le chef-lieu la redonnerait)", () => {
    const p = fichePubliqueBrute(fiche({ ville: "Grenoble", departement: "38" }));
    expect(p?.ville).toBeUndefined();
    expect(p?.departement).toBeUndefined();
  });
  it("sans ville : le département reste", () => {
    const { ville: _v, ...sansVille } = fiche({ departement: "38" });
    expect(fichePubliqueBrute(sansVille)?.departement).toBe("38");
  });
});

describe("3e relecture : cas limites", () => {
  it("validerPrenom : prénom composé légitime, ordre NOM Prénom", () => {
    expect(validerPrenom("Marie Claire", "Marie Claire Martin")).toBeNull();
    expect(validerPrenom("Jean", "DUPONT Jean")).toBeNull();
    expect(validerPrenom("Dupont", "DUPONT Jean")).toBe("contient-nom-de-famille");
  });
  it("ordre NOM Prénom : le nom ne fuit pas", () => {
    const p = fichePubliqueBrute(
      fiche({
        prenom: "Jean",
        nomComplet: "DUPONT Jean",
        slug: "jean",
        fonction: "Fils de Dupont",
      }),
    );
    expect(p?.fonction).toBe("");
  });
  it("nom collé : slug et texte écartés", () => {
    const p = fichePubliqueBrute(
      fiche({
        prenom: "Jean",
        nomComplet: "Jean Dupont",
        slug: "jeandupont",
        fonction: "#JeanDupont",
      }),
    );
    expect(p?.slug).toBe("jean");
    expect(p?.fonction).toBe("");
  });
  it("slug vide ou non conforme régénéré", () => {
    expect(fichePubliqueBrute(fiche({ slug: "" }))?.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(fichePubliqueBrute(fiche({ slug: "A B" }))?.slug).toMatch(/^[a-z0-9-]+$/);
  });
  it("consentement : date non ISO ou future refusée", () => {
    const photo = (d: string) => ({
      src: "/a.jpg",
      largeur: 1,
      hauteur: 1,
      alt: "x",
      consentementLe: d,
    });
    expect(fichePubliqueBrute(fiche({ photo: photo("pas une date 2026") }))?.photo).toBeUndefined();
    expect(fichePubliqueBrute(fiche({ photo: photo("2999-01-01") }))?.photo).toBeUndefined();
    expect(fichePubliqueBrute(fiche({ photo: photo("2025-03-01") }))?.photo).toBeDefined();
  });
  it("écriture non latine : le nom de famille est détecté", () => {
    const p = fichePubliqueBrute(
      fiche({ prenom: "Иван", nomComplet: "Иван Петров", slug: "ivan", fonction: "Петров dev" }),
    );
    expect(p?.fonction).toBe("");
  });
  it("nom complet d'un seul mot, différent du prénom : traité comme nom de famille", () => {
    const p = fichePubliqueBrute(
      fiche({ prenom: "Jean", nomComplet: "Dupont", fonction: "Dupont" }),
    );
    expect(p?.fonction).toBe("");
  });
  it("fragment de deux lettres", () => {
    const p = fichePubliqueBrute(
      fiche({ prenom: "Lan", nomComplet: "Lan Le Ba", slug: "lan", fonction: "Equipe Ba" }),
    );
    expect(p?.fonction).toBe("");
  });
  it("slugCollaborateur : ville égale au nom de famille ignorée", () => {
    expect(slugCollaborateur("Jean", "Nancy", ["jean"], "Jean Nancy")).toBe("jean-2");
  });
  it("estIndexable juge la fiche publiée : réponse contenant le nom → non indexable", () => {
    const f = fiche({
      reponseQui: `Dupont ${"x".repeat(300)}`,
      nomComplet: "Jean Dupont",
      prenom: "Jean",
    });
    expect(estIndexable(f)).toBe(false);
  });
  it("prix : TJM, HT, dollar, tarif, grenoblois", () => {
    for (const t of ["TJM 600", "100 HT", "50 $", "tarif réduit", "Grenobloise"]) {
      expect(estTextePropre(t)).toBe(false);
    }
  });
  it("dirigeant : aucun département publié", () => {
    const p = fichePubliqueBrute(
      fiche({
        estDirigeantPrincipal: true,
        slug: "williams",
        nomComplet: "Williams Jullin",
        prenom: "Williams",
        departement: "69",
      }),
    );
    expect(p?.departement).toBeUndefined();
  });
});
