/**
 * Console éditoriale — tests de l'analyse (lot 3).
 *
 * Un critère domine tous les autres ici, et c'est le plus facile à rater :
 *
 * > « Une métrique absente affiche « NON DISPONIBLE », jamais `0`. »
 *
 * JavaScript pousse dans l'autre sens — `null + 5` vaut `5`, un `reduce`
 * initialisé à `0` rend `0` sur un tableau vide. Un agrégat écrit
 * naturellement REND DONC ZÉRO là où il faudrait dire « je ne sais pas ».
 *
 * La différence n'est pas cosmétique : « 0 rendez-vous » fait changer de
 * format, « non disponible » veut dire qu'on n'a rien relevé. Confondre les
 * deux, c'est arbitrer sur des chiffres inventés.
 */

import { describe, it, expect } from "vitest";
import {
  sommer,
  derniersReleves,
  analyserParFamille,
  comparerIdentites,
  partSurEchelle,
  ratioIdentite,
  formaterAgregat,
  estNonDisponible,
  METRIQUES,
  LIBELLES,
  type ReleveMetrique,
  type LignePublicationMesuree,
} from "./analyse";

function releve(patch: Partial<ReleveMetrique> & { publicationId: string }): ReleveMetrique {
  return {
    releveA: new Date("2026-09-10T10:00:00Z"),
    impressions: null,
    reactions: null,
    commentaires: null,
    partages: null,
    clics: null,
    abonnesGagnes: null,
    vuesCompletes: null,
    ouvertures: null,
    rdvAttribues: null,
    devisAttribues: null,
    ...patch,
  };
}

function publication(
  patch: Partial<LignePublicationMesuree> & { publicationId: string },
): LignePublicationMesuree {
  return {
    familleNom: "Carrousel",
    identite: "perso",
    compteLibelle: "LinkedIn — Profil",
    ...patch,
  };
}

describe("sommer — « non disponible », jamais zéro", () => {
  it("🔴 rend `null` quand AUCUN relevé ne porte la métrique", () => {
    // Le cœur du critère 4. Un `reduce` initialisé à 0 aurait rendu 0.
    const a = sommer(
      [releve({ publicationId: "p1" }), releve({ publicationId: "p2" })],
      "rdvAttribues",
    );
    expect(a.valeur).toBeNull();
    expect(estNonDisponible(a)).toBe(true);
    expect(formaterAgregat(a)).toBe("non disponible");
  });

  it("🔴 distingue « aucun relevé » de « relevé à zéro »", () => {
    // C'est LA distinction qui compte : zéro rendez-vous est une INFORMATION.
    const absent = sommer([releve({ publicationId: "p1" })], "rdvAttribues");
    const zero = sommer([releve({ publicationId: "p1", rdvAttribues: 0 })], "rdvAttribues");

    expect(absent.valeur).toBeNull();
    expect(zero.valeur).toBe(0);
    expect(formaterAgregat(absent)).toBe("non disponible");
    expect(formaterAgregat(zero)).toBe("0");
  });

  it("somme ce qui est renseigné, en ignorant le reste", () => {
    const a = sommer(
      [
        releve({ publicationId: "p1", impressions: 1200 }),
        releve({ publicationId: "p2", impressions: null }),
        releve({ publicationId: "p3", impressions: 800 }),
      ],
      "impressions",
    );
    expect(a.valeur).toBe(2000);
    expect(a.nbReleves).toBe(2);
    expect(a.nbAttendus).toBe(3);
  });

  it("🔴 un SEUL relevé renseigné suffit à produire un total", () => {
    // L'erreur inverse serait de dire « non disponible » alors qu'on sait
    // quelque chose.
    const a = sommer(
      [releve({ publicationId: "p1", clics: 7 }), releve({ publicationId: "p2" })],
      "clics",
    );
    expect(a.valeur).toBe(7);
    expect(a.nbReleves).toBe(1);
    expect(a.nbAttendus).toBe(2);
  });

  it("rend `null` sur une liste vide", () => {
    expect(sommer([], "impressions").valeur).toBeNull();
  });

  it("donne un libellé humain à chaque métrique", () => {
    for (const m of METRIQUES) {
      expect(LIBELLES[m], m).toBeTruthy();
      expect(LIBELLES[m], m).not.toBe(m);
    }
  });
});

describe("derniersReleves — l'historique se garde, il ne se somme pas", () => {
  it("🔴 ne garde que le DERNIER relevé de chaque publication", () => {
    // Le critère 1 impose de ne pas écraser : on accumule des lignes. Mais
    // additionner tous les relevés d'une publication compterait plusieurs
    // fois ses impressions — un relevé est un instantané CUMULATIF.
    const derniers = derniersReleves([
      releve({ publicationId: "p1", impressions: 500, releveA: new Date("2026-09-10T10:00:00Z") }),
      releve({ publicationId: "p1", impressions: 1200, releveA: new Date("2026-09-17T10:00:00Z") }),
      releve({ publicationId: "p2", impressions: 300, releveA: new Date("2026-09-11T10:00:00Z") }),
    ]);
    expect(derniers).toHaveLength(2);
    expect(sommer(derniers, "impressions").valeur).toBe(1500); // et non 2000
  });

  it("garde le plus récent quel que soit l'ordre d'arrivée", () => {
    const derniers = derniersReleves([
      releve({ publicationId: "p1", impressions: 999, releveA: new Date("2026-09-20T00:00:00Z") }),
      releve({ publicationId: "p1", impressions: 1, releveA: new Date("2026-09-01T00:00:00Z") }),
    ]);
    expect(derniers[0]!.impressions).toBe(999);
  });

  it("rend une liste vide sur une entrée vide", () => {
    expect(derniersReleves([])).toEqual([]);
  });
});

describe("analyserParFamille — critère 2", () => {
  const publications = [
    publication({ publicationId: "p1", familleNom: "Carrousel" }),
    publication({ publicationId: "p2", familleNom: "Carrousel" }),
    publication({ publicationId: "p3", familleNom: "Vidéo courte" }),
    publication({ publicationId: "p4", familleNom: null }),
  ];

  it("🔴 classe par RENDEZ-VOUS attribués, pas par impressions", () => {
    // Classer par impressions ferait remonter ce qui fait du bruit plutôt
    // que ce qui fait du chiffre. Ici la vidéo a 10× moins d'impressions
    // mais 3× plus de rendez-vous : elle doit passer devant.
    const releves = [
      releve({ publicationId: "p1", impressions: 50000, rdvAttribues: 1 }),
      releve({ publicationId: "p3", impressions: 5000, rdvAttribues: 3 }),
    ];
    const lignes = analyserParFamille(publications, releves);
    expect(lignes[0]!.libelle).toBe("Vidéo courte");
    expect(lignes[0]!.principal.valeur).toBe(3);
  });

  it("🔴 garde les familles NON MESURÉES, en dernier, en « non disponible »", () => {
    // Les écarter laisserait croire qu'elles n'existent pas, alors qu'elles
    // sont seulement non mesurées.
    const lignes = analyserParFamille(publications, [
      releve({ publicationId: "p1", rdvAttribues: 2 }),
    ]);
    const derniere = lignes[lignes.length - 1]!;
    expect(derniere.principal.valeur).toBeNull();
    expect(lignes.map((l) => l.libelle)).toContain("Vidéo courte");
    expect(lignes[0]!.libelle).toBe("Carrousel");
  });

  it("nomme « Texte seul » les publications sans famille", () => {
    const lignes = analyserParFamille(publications, []);
    expect(lignes.map((l) => l.libelle)).toContain("Texte seul");
  });

  it("compte les publications même sans relevé", () => {
    const lignes = analyserParFamille(publications, []);
    const carrousel = lignes.find((l) => l.libelle === "Carrousel");
    expect(carrousel?.nbPublications).toBe(2);
    expect(carrousel?.principal.valeur).toBeNull();
  });

  it("🔴 n'additionne pas deux relevés de la même publication", () => {
    const lignes = analyserParFamille(publications, [
      releve({ publicationId: "p1", rdvAttribues: 1, releveA: new Date("2026-09-10T00:00:00Z") }),
      releve({ publicationId: "p1", rdvAttribues: 4, releveA: new Date("2026-09-17T00:00:00Z") }),
    ]);
    expect(lignes[0]!.principal.valeur).toBe(4);
  });

  it("reste stable entre deux appels sur les mêmes données", () => {
    const a = analyserParFamille(publications, []).map((l) => l.libelle);
    const b = analyserParFamille([...publications].reverse(), []).map((l) => l.libelle);
    expect(a).toEqual(b);
  });
});

describe("comparerIdentites — critère 3, « la même échelle »", () => {
  const publications = [
    publication({ publicationId: "p1", identite: "perso" }),
    publication({ publicationId: "p2", identite: "perso" }),
    publication({ publicationId: "p3", identite: "pro" }),
  ];

  it("rend les deux séries, même si l'une est vide", () => {
    const c = comparerIdentites(publications, []);
    expect(c.series.map((s) => s.identite)).toEqual(["perso", "pro"]);
    expect(c.series[0]!.nbPublications).toBe(2);
    expect(c.series[1]!.nbPublications).toBe(1);
  });

  it("🔴 calcule une échelle COMMUNE aux deux identités", () => {
    // Sans base commune, chaque barre serait normalisée sur son propre
    // maximum, et deux séries très inégales paraîtraient équivalentes.
    const c = comparerIdentites(publications, [
      releve({ publicationId: "p1", impressions: 1000 }),
      releve({ publicationId: "p3", impressions: 100 }),
    ]);
    expect(c.echelle.impressions).toBe(1000);
    expect(partSurEchelle(c.series[0]!.agregats.impressions.valeur, c.echelle.impressions)).toBe(
      100,
    );
    expect(partSurEchelle(c.series[1]!.agregats.impressions.valeur, c.echelle.impressions)).toBe(
      10,
    );
  });

  it("🔴 rend une échelle `null` quand rien n'est mesuré", () => {
    const c = comparerIdentites(publications, []);
    expect(c.echelle.rdvAttribues).toBeNull();
    expect(c.series[0]!.agregats.rdvAttribues.valeur).toBeNull();
  });

  it("couvre TOUTES les métriques, sans en oublier une", () => {
    const c = comparerIdentites(publications, []);
    for (const m of METRIQUES) {
      expect(c.series[0]!.agregats[m], m).toBeDefined();
      expect(m in c.echelle, m).toBe(true);
    }
  });
});

describe("partSurEchelle", () => {
  it("rend le pourcentage attendu", () => {
    expect(partSurEchelle(50, 200)).toBe(25);
    expect(partSurEchelle(200, 200)).toBe(100);
  });

  it("🔴 rend `null` sur une valeur absente — une barre nulle se confondrait avec un zéro", () => {
    expect(partSurEchelle(null, 200)).toBeNull();
    expect(partSurEchelle(50, null)).toBeNull();
  });

  it("ne divise pas par zéro", () => {
    expect(partSurEchelle(0, 0)).toBeNull();
  });

  it("rend 0 % pour une mesure à zéro sur une échelle non nulle", () => {
    // Ici, 0 est une VRAIE mesure : la barre doit être vide, pas absente.
    expect(partSurEchelle(0, 200)).toBe(0);
  });
});

describe("ratioIdentite — ce qui arme l'alerte de dérive", () => {
  it("rend les deux parts, qui totalisent 100", () => {
    const r = ratioIdentite([
      publication({ publicationId: "a", identite: "perso" }),
      publication({ publicationId: "b", identite: "perso" }),
      publication({ publicationId: "c", identite: "pro" }),
      publication({ publicationId: "d", identite: "pro" }),
    ]);
    expect(r).toEqual({ perso: 50, pro: 50 });
  });

  it("🔴 rend `null` sur zéro publication — un ratio sur zéro n'existe pas", () => {
    expect(ratioIdentite([])).toBeNull();
  });

  it("reflète le dossier importé : 61 perso pour 13 pro", () => {
    const dossier = [
      ...Array.from({ length: 61 }, (_, i) =>
        publication({ publicationId: `perso-${i}`, identite: "perso" }),
      ),
      ...Array.from({ length: 13 }, (_, i) =>
        publication({ publicationId: `pro-${i}`, identite: "pro" }),
      ),
    ];
    expect(ratioIdentite(dossier)).toEqual({ perso: 82, pro: 18 });
  });
});
