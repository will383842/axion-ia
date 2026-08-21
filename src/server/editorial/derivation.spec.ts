/**
 * Console éditoriale — tests de l'arbre de dérivation et des recettes (lot 2).
 *
 * Le protocole nomme précisément ce qu'il attend ici :
 *
 * > « L'arbre de dérivation — unitaire, profondeur 3, et CYCLE REFUSÉ. Un
 * >   cycle bloque l'application entière. »
 *
 * Et le §7 du lot 2 ajoute deux gardes de fond : l'autorisation de droit à
 * l'image, et la spec de plateforme. Toutes deux ont ici leur cas qui passe
 * ET leur cas qui refuse.
 */

import { describe, it, expect } from "vitest";
import {
  detecterCycle,
  creeraitUnCycle,
  construireArbre,
  profondeurDe,
  aplatir,
  remonterALaSource,
  formaterSeconde,
  derivesDeRecette,
  peutProgrammer,
  peutPasserPret,
  type AssetDerivable,
} from "./derivation";

function asset(patch: Partial<AssetDerivable> & { id: string }): AssetDerivable {
  return {
    libelle: `Asset ${patch.id}`,
    type: "video",
    nature: "derive",
    statut: "a_produire",
    parentId: null,
    offsetSourceSec: null,
    familleId: null,
    dureeSec: null,
    ...patch,
  };
}

/** Un épisode → deux extraits → des shorts. Trois niveaux, comme le critère. */
function episodeComplet(): AssetDerivable[] {
  return [
    asset({ id: "episode", nature: "source", libelle: "Épisode 3 — Mme Durand", dureeSec: 3480 }),
    asset({ id: "extrait-a", parentId: "episode", offsetSourceSec: 2400, libelle: "Extrait A" }),
    asset({ id: "extrait-b", parentId: "episode", offsetSourceSec: 600, libelle: "Extrait B" }),
    asset({ id: "short-1", parentId: "extrait-a", offsetSourceSec: 750, libelle: "Short 1" }),
    asset({ id: "short-2", parentId: "extrait-a", offsetSourceSec: 30, libelle: "Short 2" }),
    asset({
      id: "variante-tiktok",
      parentId: "short-1",
      nature: "variante_plateforme",
      libelle: "Short 1 — TikTok",
      offsetSourceSec: 0,
    }),
  ];
}

describe("detecterCycle — la garde que le protocole exige", () => {
  it("ne voit aucun cycle dans un arbre sain", () => {
    expect(detecterCycle(episodeComplet())).toBeNull();
  });

  it("🔴 DÉTECTE un asset qui descend de lui-même", () => {
    const cycle = detecterCycle([asset({ id: "a", parentId: "a" })]);
    expect(cycle).not.toBeNull();
    expect(cycle?.message).toContain("ne peut pas descendre de lui-même");
  });

  it("🔴 DÉTECTE une boucle à trois maillons", () => {
    const cycle = detecterCycle([
      asset({ id: "a", parentId: "c" }),
      asset({ id: "b", parentId: "a" }),
      asset({ id: "c", parentId: "b" }),
    ]);
    expect(cycle).not.toBeNull();
    expect(cycle?.chaine.length).toBeGreaterThanOrEqual(3);
  });

  it("🔴 ne confond PAS deux chemins vers un même asset avec un cycle", () => {
    // Deux extraits du même épisode partagent leur parent : c'est normal.
    // Un simple « déjà visité » crierait au cycle et bloquerait l'écran.
    expect(
      detecterCycle([
        asset({ id: "racine" }),
        asset({ id: "x", parentId: "racine" }),
        asset({ id: "y", parentId: "racine" }),
      ]),
    ).toBeNull();
  });

  it("ne crie pas au cycle quand le parent est hors du lot chargé", () => {
    expect(detecterCycle([asset({ id: "orphelin", parentId: "absent-du-lot" })])).toBeNull();
  });
});

describe("creeraitUnCycle — le contrôle AVANT écriture", () => {
  const lot = episodeComplet();

  it("autorise un rattachement descendant normal", () => {
    expect(creeraitUnCycle(lot, "short-2", "extrait-b")).toBe(false);
  });

  it("🔴 REFUSE de rattacher un asset à lui-même", () => {
    expect(creeraitUnCycle(lot, "episode", "episode")).toBe(true);
  });

  it("🔴 REFUSE de rattacher un ANCÊTRE à son descendant", () => {
    // Rattacher l'épisode sous un de ses shorts boucle l'arbre.
    expect(creeraitUnCycle(lot, "episode", "short-1")).toBe(true);
    expect(creeraitUnCycle(lot, "extrait-a", "variante-tiktok")).toBe(true);
  });
});

describe("construireArbre — les trois niveaux du critère", () => {
  it("🔴 atteint la profondeur 3 : épisode → extrait → short → variante", () => {
    const arbre = construireArbre(episodeComplet(), "episode");
    expect(arbre).not.toBeNull();
    expect(profondeurDe(arbre!)).toBe(3);
  });

  it("range tout l'épisode sous sa racine", () => {
    const arbre = construireArbre(episodeComplet(), "episode");
    expect(aplatir(arbre!)).toHaveLength(6);
  });

  it("ordonne de façon STABLE — un arbre qui bouge à chaque rendu est illisible", () => {
    const a = aplatir(construireArbre(episodeComplet(), "episode")!).map((n) => n.asset.id);
    const melange = [...episodeComplet()].reverse();
    const b = aplatir(construireArbre(melange, "episode")!).map((n) => n.asset.id);
    expect(a).toEqual(b);
  });

  it("rend `null` pour une racine absente", () => {
    expect(construireArbre(episodeComplet(), "inexistant")).toBeNull();
  });

  it("🔴 ne déborde PAS la pile même si un cycle a échappé à la détection", () => {
    // Une garde qui dépend d'une autre garde n'est pas une garde : la borne
    // de profondeur tient toute seule.
    const cyclique = [asset({ id: "a", parentId: "b" }), asset({ id: "b", parentId: "a" })];
    expect(() => construireArbre(cyclique, "a", 5)).not.toThrow();
  });
});

describe("remonterALaSource — « à l'épisode ET à la seconde »", () => {
  it("remonte d'une variante jusqu'à l'épisode", () => {
    const chemin = remonterALaSource(episodeComplet(), "variante-tiktok");
    expect(chemin?.racine.id).toBe("episode");
    expect(chemin?.chaine.map((a) => a.id)).toEqual([
      "variante-tiktok",
      "short-1",
      "extrait-a",
      "episode",
    ]);
  });

  it("🔴 ADDITIONNE les offsets le long du chemin", () => {
    // Short 1 est à 750 s de l'extrait A, lui-même à 2400 s de l'épisode.
    // La bonne réponse est 3150 s, pas 750 : lire le dernier offset
    // enverrait le monteur à 12 min 30 d'un fichier de 58 minutes.
    const chemin = remonterALaSource(episodeComplet(), "short-1");
    expect(chemin?.secondeDansLaRacine).toBe(3150);
  });

  it("cumule aussi sur trois niveaux", () => {
    // variante (0) + short-1 (750) + extrait-a (2400) = 3150
    expect(remonterALaSource(episodeComplet(), "variante-tiktok")?.secondeDansLaRacine).toBe(3150);
  });

  it("🔴 rend `null` plutôt qu'une position FAUSSE si un maillon manque d'offset", () => {
    // Mieux vaut ne rien dire que d'envoyer quelqu'un au mauvais endroit.
    const lot = [
      asset({ id: "ep", nature: "source" }),
      asset({ id: "ex", parentId: "ep", offsetSourceSec: null }),
      asset({ id: "sh", parentId: "ex", offsetSourceSec: 60 }),
    ];
    expect(remonterALaSource(lot, "sh")?.secondeDansLaRacine).toBeNull();
  });

  it("rend `null` sur une racine — elle n'a pas de position dans elle-même", () => {
    expect(remonterALaSource(episodeComplet(), "episode")?.secondeDansLaRacine).toBeNull();
  });

  it("ne boucle pas sur un arbre cyclique", () => {
    const cyclique = [asset({ id: "a", parentId: "b" }), asset({ id: "b", parentId: "a" })];
    expect(() => remonterALaSource(cyclique, "a")).not.toThrow();
  });
});

describe("formaterSeconde — lisible par un monteur", () => {
  it("passe en heures au-delà de 3600 s", () => {
    expect(formaterSeconde(3150)).toBe("52 min 30 s");
    expect(formaterSeconde(3720)).toBe("1 h 02 min 00 s");
  });

  it("complète sur deux chiffres, pour que ça se lise comme un time-code", () => {
    expect(formaterSeconde(65)).toBe("1 min 05 s");
  });
});

describe("derivesDeRecette — critère 1 du lot 2", () => {
  const lignes = [
    { familleId: "f-short", familleNom: "Short vertical", quantite: 3, compteId: "c1", note: null },
    {
      familleId: "f-extrait",
      familleNom: "Extrait vidéo",
      quantite: 1,
      compteId: null,
      note: null,
    },
  ];

  it("crée le bon nombre de dérivés", () => {
    expect(derivesDeRecette("Épisode 3", lignes)).toHaveLength(4);
  });

  it("🔴 les crée en `a_produire`, JAMAIS en `pret`", () => {
    // La recette dit ce qu'il FAUDRA faire. Les créer prêts ferait
    // disparaître le travail à faire des files et des alertes.
    for (const d of derivesDeRecette("Épisode 3", lignes)) {
      expect(d.statut).toBe("a_produire");
      expect(d.nature).toBe("derive");
    }
  });

  it("numérote quand la quantité dépasse un", () => {
    const noms = derivesDeRecette("Épisode 3", lignes).map((d) => d.libelle);
    expect(noms).toContain("Épisode 3 — Short vertical 1/3");
    expect(noms).toContain("Épisode 3 — Short vertical 3/3");
    // Pas de « 1/1 » quand il n'y en a qu'un : ce serait du bruit.
    expect(noms).toContain("Épisode 3 — Extrait vidéo");
  });

  it("reporte le compte visé quand la ligne en désigne un", () => {
    const shorts = derivesDeRecette("Ep", lignes).filter((d) => d.familleId === "f-short");
    expect(shorts.every((d) => d.compteId === "c1")).toBe(true);
  });

  it("🔴 borne une quantité absurde au lieu de vider la médiathèque de sens", () => {
    const enorme = [
      { familleId: "f", familleNom: "F", quantite: 100000, compteId: null, note: null },
    ];
    expect(derivesDeRecette("Ep", enorme).length).toBeLessThanOrEqual(100);
  });

  it("ne produit rien sur une quantité nulle ou négative", () => {
    expect(
      derivesDeRecette("Ep", [
        { familleId: "f", familleNom: "F", quantite: 0, compteId: null, note: null },
      ]),
    ).toHaveLength(0);
    expect(
      derivesDeRecette("Ep", [
        { familleId: "f", familleNom: "F", quantite: -5, compteId: null, note: null },
      ]),
    ).toHaveLength(0);
  });
});

describe("peutProgrammer — critère 4, une règle de DROIT", () => {
  const diffusion = new Date("2026-10-15T00:00:00Z");

  it("autorise sur une autorisation signée et valable", () => {
    expect(
      peutProgrammer(
        [{ inviteNom: "Mme Durand", statut: "signee", valableJusquA: null }],
        diffusion,
      ).autorise,
    ).toBe(true);
  });

  it("🔴 REFUSE sur une autorisation seulement ENVOYÉE", () => {
    // Le cas le plus dangereux : il ressemble à un accord.
    const v = peutProgrammer(
      [{ inviteNom: "Mme Durand", statut: "envoyee", valableJusquA: null }],
      diffusion,
    );
    expect(v.autorise).toBe(false);
    expect(v.message).toContain("Mme Durand");
    expect(v.message).toContain("ne vaut pas consentement");
  });

  it("REFUSE sur « non_demandee » et « refusee »", () => {
    for (const statut of ["non_demandee", "refusee"]) {
      expect(
        peutProgrammer([{ inviteNom: "X", statut, valableJusquA: null }], diffusion).autorise,
        statut,
      ).toBe(false);
    }
  });

  it("🔴 REFUSE une autorisation signée mais EXPIRÉE", () => {
    // Une cession de droits a une fin : diffuser après, c'est diffuser sans
    // droit, même avec une signature au dossier.
    const v = peutProgrammer(
      [
        {
          inviteNom: "Mme Durand",
          statut: "signee",
          valableJusquA: new Date("2026-09-30T00:00:00Z"),
        },
      ],
      diffusion,
    );
    expect(v.autorise).toBe(false);
    expect(v.message).toContain("expire");
  });

  it("autorise quand la cession court encore", () => {
    expect(
      peutProgrammer(
        [{ inviteNom: "X", statut: "signee", valableJusquA: new Date("2027-01-01T00:00:00Z") }],
        diffusion,
      ).autorise,
    ).toBe(true);
  });

  it("🔴 REFUSE dès qu'UN invité sur trois manque à l'appel", () => {
    const v = peutProgrammer(
      [
        { inviteNom: "A", statut: "signee", valableJusquA: null },
        { inviteNom: "B", statut: "envoyee", valableJusquA: null },
        { inviteNom: "C", statut: "signee", valableJusquA: null },
      ],
      diffusion,
    );
    expect(v.autorise).toBe(false);
    expect(v.message).toContain("B");
  });

  it("autorise une publication sans aucun invité", () => {
    expect(peutProgrammer([], diffusion).autorise).toBe(true);
  });
});

describe("peutPasserPret — critère 5, la spec de plateforme", () => {
  const specShort = { dureeMinSec: 1, dureeMaxSec: 60, plateforme: "youtube" };

  it("autorise dans les bornes", () => {
    expect(peutPasserPret({ libelle: "Short", dureeSec: 45 }, specShort).autorise).toBe(true);
  });

  it("autorise PILE à la borne", () => {
    expect(peutPasserPret({ libelle: "Short", dureeSec: 60 }, specShort).autorise).toBe(true);
  });

  it("🔴 REFUSE un dépassement de DEUX SECONDES — la passe adversariale", () => {
    const v = peutPasserPret({ libelle: "Short 1", dureeSec: 62 }, specShort);
    expect(v.autorise).toBe(false);
    expect(v.message).toContain("Short 1");
    expect(v.message).toContain("youtube");
  });

  it("REFUSE un asset trop COURT", () => {
    expect(
      peutPasserPret({ libelle: "Trop bref", dureeSec: 0 }, { ...specShort, dureeMinSec: 3 })
        .autorise,
    ).toBe(false);
  });

  it("🔴 une durée INCONNUE ne bloque pas, mais ne vaut pas conformité", () => {
    // Sans `ffprobe`, une vidéo déposée n'a pas de durée. Bloquer rendrait la
    // fonction inutilisable ; déclarer conforme serait mentir.
    const v = peutPasserPret({ libelle: "Vidéo", dureeSec: null }, specShort);
    expect(v.autorise).toBe(true);
    expect(v.indetermine).toBe(true);
    expect(v.message).toContain("Durée inconnue");
  });

  it("laisse passer quand aucune spec ne s'applique", () => {
    expect(peutPasserPret({ libelle: "X", dureeSec: 99999 }, null).autorise).toBe(true);
  });
});
