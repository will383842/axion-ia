import { describe, expect, it, vi } from "vitest";
import { controleFidelite, type FicheConnaissance } from "../controle-fidelite";
import {
  barriereDepuisConstats,
  decisionFidelite,
  modeControleFidelite,
} from "../fidelite-branchement";

const FICHE_AI_ACT: FicheConnaissance = {
  id: "fiche-ai-act",
  titre: "Calendrier de l'AI Act",
  texte:
    "Le règlement (UE) 2026/1744 (omnibus IA) a reporté les obligations des systèmes à haut risque de l'annexe III au 2 décembre 2027 et au 2 août 2028 pour l'annexe I. La transparence (article 50) s'applique depuis le 2 août 2026.",
};

const FICHE_ADOPTION: FicheConnaissance = {
  id: "fiche-adoption",
  titre: "Adoption de l'IA dans les PME",
  texte:
    "Selon Bpifrance Le Lab (2025), 31 % des dirigeants de PME françaises utilisent déjà des outils d'intelligence artificielle générative dans leur entreprise.",
};

const FICHES = [FICHE_AI_ACT, FICHE_ADOPTION];

describe("controleFidelite — affirmations chiffrées", () => {
  it("un texte sans chiffre ni référence juridique ne produit aucun constat", () => {
    expect(controleFidelite("<p>L'IA aide les dirigeants à gagner du temps.</p>", FICHES)).toEqual(
      [],
    );
  });

  it("un pourcentage présent dans une fiche est étayé", () => {
    const texte =
      "<p>D'après Bpifrance, 31 % des dirigeants de PME utilisent déjà l'IA générative.</p>";
    expect(controleFidelite(texte, FICHES)).toEqual([]);
  });

  it("un pourcentage différent de la fiche du même sujet est CONTRADICTOIRE, avec la fiche", () => {
    const texte =
      "<p>Aujourd'hui, 62 % des dirigeants de PME françaises utilisent des outils d'intelligence artificielle générative.</p>";
    const constats = controleFidelite(texte, FICHES);
    expect(constats).toHaveLength(1);
    expect(constats[0]).toMatchObject({
      nature: "contradictoire",
      famille: "chiffre",
      ficheId: "fiche-adoption",
      ficheTitre: "Adoption de l'IA dans les PME",
      valeurFiche: "31 %",
    });
    expect(constats[0]?.affirmation).toMatch(/62\s*%/);
  });

  it("un chiffre qu'aucune fiche ne porte, hors sujet des fiches, est NON ÉTAYÉ", () => {
    const texte = "<p>Les boulangeries artisanales réduisent leurs invendus de 18 % en hiver.</p>";
    const constats = controleFidelite(texte, FICHES);
    expect(constats).toHaveLength(1);
    expect(constats[0]).toMatchObject({ nature: "non-etaye", famille: "chiffre" });
  });

  it("le prix de la Journée IA (grille tarifaire) est étayé par la garde de prix, sans fiche", () => {
    const texte = "<p>La Journée IA est proposée à 1 490 € HT.</p>";
    expect(controleFidelite(texte, [])).toEqual([]);
  });

  it("un montant inventé reste signalé (non étayé)", () => {
    const texte = "<p>Un accompagnement complet coûte 3 500 € HT.</p>";
    const constats = controleFidelite(texte, FICHES);
    expect(constats.some((c) => c.nature === "non-etaye" && /3 500/.test(c.affirmation))).toBe(
      true,
    );
  });

  it("LIMITE CONNUE — la comparaison porte sur la valeur numérique, pas sur l'unité : « 12,4 % » est validé par « 12.4 milliards »", () => {
    const fiche: FicheConnaissance = {
      id: "marche",
      titre: "Marché",
      texte: "Le marché français de l'IA atteindra 12.4 milliards en 2027, soit 1490 projets.",
    };
    const texte = "<p>Le marché français de l'IA pèse 12,4 % de plus en 2027.</p>";
    expect(controleFidelite(texte, [fiche]).filter((c) => /12,4/.test(c.affirmation))).toEqual([]);
  });
});

describe("controleFidelite — correctifs de fiabilité (PR de suivi #1912)", () => {
  it("« En 2026, … au 2 décembre 2027 » : l'année finale n'est plus coupée, aucun constat", () => {
    const texte =
      "<p>En 2026, les obligations de l'annexe III ont été reportées au 2 décembre 2027.</p>";
    expect(controleFidelite(texte, FICHES)).toEqual([]);
  });

  it("la valeur affichée d'une contradiction vient de la phrase de la fiche qui parle du même propos", () => {
    const fiche: FicheConnaissance = {
      id: "mixte",
      titre: "Adoption",
      texte:
        "Le budget formation moyen atteint 4 % de la masse salariale. Selon Bpifrance, 31 % des dirigeants de PME françaises utilisent déjà des outils d'intelligence artificielle générative.",
    };
    const c = controleFidelite(
      "<p>Aujourd'hui, 62 % des dirigeants de PME françaises utilisent des outils d'intelligence artificielle générative.</p>",
      [fiche],
    );
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ nature: "contradictoire", valeurFiche: "31 %" });
  });

  it("une fiche qui partage 3 mots avec l'article, répartis sur plusieurs phrases, ne rend pas « contradictoire »", () => {
    const fiche: FicheConnaissance = {
      id: "multi-phrases",
      titre: "Budget",
      texte:
        "Les boulangeries artisanales ouvrent tôt le matin. Le budget formation moyen atteint 4 % de la masse salariale.",
    };
    const c = controleFidelite(
      "<p>Les boulangeries artisanales réduisent leurs invendus de 18 % grâce au budget formation.</p>",
      [fiche],
    );
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ nature: "non-etaye", valeurFiche: null });
  });

  it("un même chiffre ne ressort qu'une seule fois", () => {
    const c = controleFidelite(
      "<p>En 2025, les boulangeries artisanales ont réduit leurs invendus de 18 % en hiver.</p>",
      FICHES,
    );
    expect(c.filter((x) => /18/.test(x.affirmation))).toHaveLength(1);
  });
});

describe("controleFidelite — affirmations juridiques", () => {
  it("une date d'application conforme à la fiche est étayée", () => {
    const texte =
      "<p>Pour l'AI Act, les obligations de l'annexe III s'appliquent au 2 décembre 2027.</p>";
    expect(controleFidelite(texte, FICHES)).toEqual([]);
  });

  it("une date d'application périmée est CONTRADICTOIRE avec la fiche du calendrier", () => {
    const texte2 =
      "<p>Le règlement impose les obligations des systèmes à haut risque de l'annexe III dès le 2 août 2027.</p>";
    const c2 = controleFidelite(texte2, FICHES);
    expect(c2).toHaveLength(1);
    expect(c2[0]).toMatchObject({
      nature: "contradictoire",
      famille: "juridique",
      ficheId: "fiche-ai-act",
    });
    expect(c2[0]?.affirmation).toMatch(/2 août 2027/);
  });

  it("un article de loi cité sans fiche est non étayé ; cité dans une fiche, il est étayé", () => {
    expect(
      controleFidelite("<p>L'article 50 du règlement impose la transparence.</p>", FICHES),
    ).toEqual([]);
    const constats = controleFidelite(
      "<p>L'article L. 6353-1 du Code du travail encadre la convention de formation.</p>",
      FICHES,
    );
    expect(constats).toHaveLength(1);
    expect(constats[0]).toMatchObject({ nature: "non-etaye", famille: "juridique" });
  });

  it("une référence de règlement (UE) est comparée telle quelle", () => {
    expect(
      controleFidelite("<p>Le règlement (UE) 2026/1744 a reporté ces obligations.</p>", FICHES),
    ).toEqual([]);
    const c = controleFidelite(
      "<p>Le règlement (UE) 2026/9999 a reporté ces obligations.</p>",
      FICHES,
    );
    expect(c.some((x) => x.famille === "juridique")).toBe(true);
  });

  it("« emploi 2024-2025 » n'est pas une loi ; « 2025 450 » ne fusionne pas", () => {
    expect(controleFidelite("<p>Le marché de l'emploi 2024-2025 évolue.</p>", FICHES)).toEqual([]);
    const fiche = { id: "f", titre: "PME", texte: "En 2025 450 PME ont adopté l'IA." };
    expect(controleFidelite("<p>En 2025, 450 PME ont adopté l'IA.</p>", [fiche])).toEqual([]);
  });

  it("une date sans contexte juridique n'est pas une affirmation juridique", () => {
    expect(controleFidelite("<p>Nous vous recevons le 3 mars 2027.</p>", FICHES)).toEqual([]);
  });
});

describe("branchement — interrupteur et barrière de relecture", () => {
  it("l'interrupteur est ÉTEINT par défaut", () => {
    expect(modeControleFidelite({})).toBe("eteint");
    expect(modeControleFidelite({ CONTENT_FIDELITY_CHECK: "false" })).toBe("eteint");
    expect(modeControleFidelite({ CONTENT_FIDELITY_CHECK: "n'importe quoi" })).toBe("eteint");
  });

  it("« true » l'active, « dry-run » le passe en essai à blanc", () => {
    expect(modeControleFidelite({ CONTENT_FIDELITY_CHECK: "true" })).toBe("actif");
    expect(modeControleFidelite({ CONTENT_FIDELITY_CHECK: "dry-run" })).toBe("essai-a-blanc");
  });

  it("aucun constat → aucune barrière", () => {
    expect(barriereDepuisConstats([])).toBeNull();
  });

  it("des constats → une barrière de RELECTURE qui liste affirmations et fiches", () => {
    const constats = controleFidelite(
      "<p>Aujourd'hui, 62 % des dirigeants de PME françaises utilisent des outils d'intelligence artificielle générative.</p>",
      FICHES,
    );
    const b = barriereDepuisConstats(constats);
    expect(b?.code).toBe("fidelite-kb");
    expect(b?.libelle).toMatch(/base de connaissances/);
    expect(b?.detail?.["constats"]).toEqual([
      expect.objectContaining({
        affirmation: expect.stringMatching(/62/),
        fiche_id: "fiche-adoption",
      }),
    ]);
  });
});

describe("branchement worker — décision pure", () => {
  const fiches: FicheConnaissance[] = [FICHE_ADOPTION];
  const corps =
    "<p>Aujourd'hui, 62 % des dirigeants de PME françaises utilisent des outils d'intelligence artificielle générative.</p>";

  it("éteint : aucune lecture des fiches, aucune barrière", async () => {
    const lireFiches = vi.fn(async () => fiches);
    const d = await decisionFidelite({
      mode: "eteint",
      kbEntryIds: ["a"],
      bodyHtml: corps,
      lireFiches,
    });
    expect(lireFiches).not.toHaveBeenCalled();
    expect(d).toMatchObject({ executee: false, barriere: null, aAjouter: null });
  });

  it("essai à blanc : constats calculés, aucune barrière ajoutée", async () => {
    const lireFiches = vi.fn(async () => fiches);
    const d = await decisionFidelite({
      mode: "essai-a-blanc",
      kbEntryIds: ["a"],
      bodyHtml: corps,
      lireFiches,
    });
    expect(lireFiches).toHaveBeenCalledOnce();
    expect(d.executee).toBe(true);
    expect(d.barriere?.code).toBe("fidelite-kb");
    expect(d.aAjouter).toBeNull();
  });

  it("actif : la barrière fidelite-kb est à ajouter", async () => {
    const d = await decisionFidelite({
      mode: "actif",
      kbEntryIds: ["a"],
      bodyHtml: corps,
      lireFiches: async () => fiches,
    });
    expect(d.aAjouter?.code).toBe("fidelite-kb");
  });

  it("actif sans fiche source : rien n'est lu", async () => {
    const lireFiches = vi.fn(async () => fiches);
    const d = await decisionFidelite({
      mode: "actif",
      kbEntryIds: [],
      bodyHtml: corps,
      lireFiches,
    });
    expect(lireFiches).not.toHaveBeenCalled();
    expect(d.executee).toBe(false);
  });
});
