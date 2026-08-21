/**
 * Console éditoriale — tests des versions et des transitions (lot 1).
 *
 * Deux critères du §7 s'affrontent ici, et c'est leur OPPOSITION qui compte :
 *
 *   - « Modifier le corps d'une publication crée une version » (critère 7) ;
 *   - « Changer un statut ne crée PAS de version » (critère 8).
 *
 * Un test qui ne vérifierait que le premier passerait aussi avec un code qui
 * versionne tout — et l'historique deviendrait illisible sans que rien ne
 * rougisse.
 *
 * Le protocole exige par ailleurs, pour les transitions, « toutes les
 * transitions INTERDITES ». Elles y sont, exhaustivement.
 */

import { describe, it, expect } from "vitest";
import {
  champsModifies,
  doitVersionner,
  instantaneAvant,
  appliquer,
  transitionRedaction,
  transitionDiffusion,
  CHAMPS_VERSIONNES,
  type ContenuPublication,
  type StatutRedaction,
  type StatutDiffusion,
} from "./publication-edition";

function contenu(patch: Partial<ContenuPublication> = {}): ContenuPublication {
  return {
    accroche: "Trois signaux qu'un processus vous coûte",
    corps: "Automatiser une relance client.",
    premierCommentaire: "Le détail est ici.",
    tags: ["IAPourPME", "GainDeTemps", "ProcessusMetier"],
    ...patch,
  };
}

describe("doitVersionner — ce qui déclenche une version", () => {
  it("🔴 versionne une modification du CORPS — critère 7", () => {
    expect(doitVersionner(contenu(), { corps: "Un tout autre texte." })).toBe(true);
  });

  it("versionne l'accroche, le premier commentaire et les tags", () => {
    expect(doitVersionner(contenu(), { accroche: "Autre accroche" })).toBe(true);
    expect(doitVersionner(contenu(), { premierCommentaire: "Autre commentaire" })).toBe(true);
    expect(doitVersionner(contenu(), { tags: ["RGPD", "AIAct", "IAPourPME"] })).toBe(true);
  });

  it("🔴 NE versionne PAS un patch vide — critère 8, par sa forme la plus pure", () => {
    // Un changement de statut n'atteint jamais cette fonction : le type de
    // `ModificationContenu` ne porte aucun statut. Le patch est donc vide, et
    // aucune version n'est créée.
    expect(doitVersionner(contenu(), {})).toBe(false);
  });

  it("🔴 NE versionne PAS une sauvegarde qui ne change rien", () => {
    const avant = contenu();
    expect(doitVersionner(avant, { corps: avant.corps, accroche: avant.accroche })).toBe(false);
    expect(doitVersionner(avant, { tags: [...avant.tags] })).toBe(false);
  });

  it("traite `null` et la chaîne vide comme le même vide", () => {
    expect(doitVersionner(contenu({ corps: null }), { corps: "" })).toBe(false);
    expect(doitVersionner(contenu({ corps: "" }), { corps: null })).toBe(false);
  });

  it("🔴 versionne un simple RÉORDONNANCEMENT de tags", () => {
    // L'ordre s'affiche sous le post ; le §6 précise que l'import le garde.
    expect(
      doitVersionner(contenu(), { tags: ["GainDeTemps", "IAPourPME", "ProcessusMetier"] }),
    ).toBe(true);
  });

  it("ne versionne QUE les quatre champs de contenu", () => {
    expect([...CHAMPS_VERSIONNES]).toEqual(["accroche", "corps", "premierCommentaire", "tags"]);
  });
});

describe("champsModifies", () => {
  it("nomme précisément ce qui change", () => {
    expect(champsModifies(contenu(), { corps: "neuf", accroche: "neuve" }).sort()).toEqual([
      "accroche",
      "corps",
    ]);
  });

  it("ignore un champ absent du patch", () => {
    expect(champsModifies(contenu(), { corps: "neuf" })).toEqual(["corps"]);
  });
});

describe("instantaneAvant — ce qu'on archive", () => {
  it("🔴 archive l'ANCIEN contenu, pas le nouveau", () => {
    // C'est ce qui rend « l'ancienne version reste consultable » vrai.
    const avant = contenu({ corps: "le texte d'origine" });
    const snap = instantaneAvant(avant, 1, "réécriture de l'accroche");
    expect(snap.corps).toBe("le texte d'origine");
    expect(snap.version).toBe(1);
    expect(snap.motif).toBe("réécriture de l'accroche");
  });

  it("copie les tags au lieu de les partager", () => {
    const avant = contenu();
    const snap = instantaneAvant(avant, 1);
    avant.tags.push("Ajouté après coup");
    expect(snap.tags).toHaveLength(3);
  });

  it("accepte un motif absent — il est encouragé, pas obligatoire", () => {
    expect(instantaneAvant(contenu(), 2).motif).toBeNull();
  });
});

describe("appliquer", () => {
  it("ne touche que les champs présents dans le patch", () => {
    const apres = appliquer(contenu(), { corps: "neuf" });
    expect(apres.corps).toBe("neuf");
    expect(apres.accroche).toBe("Trois signaux qu'un processus vous coûte");
    expect(apres.tags).toHaveLength(3);
  });

  it("sait vider un champ explicitement", () => {
    expect(appliquer(contenu(), { premierCommentaire: null }).premierCommentaire).toBeNull();
  });
});

describe("transitions de RÉDACTION", () => {
  const tous: StatutRedaction[] = ["idee", "redige", "valide"];
  const AUTORISEES = new Set(["idee>redige", "redige>valide", "redige>idee", "valide>redige"]);

  // Les neuf combinaisons, sans en oublier une seule.
  for (const de of tous) {
    for (const vers of tous) {
      const attendu = de === vers || AUTORISEES.has(`${de}>${vers}`);
      it(`${attendu ? "autorise" : "🔴 REFUSE"} « ${de} » → « ${vers} »`, () => {
        expect(transitionRedaction(de, vers).autorisee).toBe(attendu);
      });
    }
  }

  it("🔴 REFUSE de valider une idée jamais rédigée", () => {
    const v = transitionRedaction("idee", "valide");
    expect(v.autorisee).toBe(false);
    expect(v.message).toContain("idee");
    expect(v.message).toContain("valide");
  });

  it("autorise de rouvrir une publication validée", () => {
    expect(transitionRedaction("valide", "redige").autorisee).toBe(true);
  });

  it("cite la règle dans chaque refus", () => {
    for (const de of tous) {
      for (const vers of tous) {
        const v = transitionRedaction(de, vers);
        if (!v.autorisee) expect(v.message.length, `${de}>${vers}`).toBeGreaterThan(30);
      }
    }
  });
});

describe("transitions de DIFFUSION", () => {
  const tous: StatutDiffusion[] = ["non_programme", "programme", "publie", "annule"];
  const AUTORISEES = new Set([
    "non_programme>programme",
    "non_programme>annule",
    "programme>publie",
    "programme>non_programme",
    "programme>annule",
    "annule>non_programme",
  ]);

  // Les seize combinaisons.
  for (const de of tous) {
    for (const vers of tous) {
      const attendu = de === vers || AUTORISEES.has(`${de}>${vers}`);
      it(`${attendu ? "autorise" : "🔴 REFUSE"} « ${de} » → « ${vers} »`, () => {
        expect(transitionDiffusion(de, vers).autorisee).toBe(attendu);
      });
    }
  }

  it("🔴 « publie » est TERMINAL — ce qui est en ligne le reste", () => {
    for (const vers of tous.filter((s) => s !== "publie")) {
      const v = transitionDiffusion("publie", vers);
      expect(v.autorisee, `publie>${vers}`).toBe(false);
      expect(v.message).toContain("terminal");
    }
  });

  it("🔴 REFUSE de publier ce qui n'a jamais été programmé", () => {
    expect(transitionDiffusion("non_programme", "publie").autorisee).toBe(false);
  });

  it("autorise de déprogrammer, et de réactiver un annulé", () => {
    expect(transitionDiffusion("programme", "non_programme").autorisee).toBe(true);
    expect(transitionDiffusion("annule", "non_programme").autorisee).toBe(true);
  });
});
