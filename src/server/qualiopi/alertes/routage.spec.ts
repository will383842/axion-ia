/**
 * Lot 14 (T3b) — le routage et l'agrégation des alertes.
 *
 * Trois familles de gardes, correspondant aux trois exigences du plan §14 :
 *
 *   1. **couverture** — aucun code d'alerte ne part sans guichet, et aucun code
 *      émis par l'évaluateur n'échappe au catalogue ;
 *   2. **agrégation** — dix échéances du même type font UN message ;
 *   3. **désescalade** — une alerte dont la cause a disparu se referme.
 *
 * Chacune a été vue rouge avant livraison (cf. le corps du commit).
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ALERTE_CATALOGUE } from "./catalogue";
import {
  GUICHETS,
  LIBELLE_GUICHET,
  ROLES_PAR_GUICHET,
  cleIdempotenceLot,
  estImmediat,
  guichetPourCode,
  peutLireLesAlertes,
  regrouperAlertes,
  type AlerteARouter,
  type GuichetAlerte,
} from "./routage";
import { AdminRole } from "../../../../prisma/generated/client";

const alerte = (
  id: string,
  code: string,
  niveau: AlerteARouter["niveau"] = "important",
  cibleId?: string,
): AlerteARouter => ({
  id,
  code,
  niveau,
  titre: `titre ${code}`,
  ...(cibleId !== undefined ? { cibleId } : {}),
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. Couverture
// ─────────────────────────────────────────────────────────────────────────────

describe("🔴 aucun code d'alerte ne part sans destinataire", () => {
  it.each(Object.keys(ALERTE_CATALOGUE))("%s a un guichet", (code) => {
    // Cette garde est doublée par le TYPE (`guichet` est obligatoire sur
    // AlerteCatalogueEntry, donc TypeScript refuse déjà l'oubli). Le test la
    // rejoue à l'exécution : le typage ne protège pas d'un `as` ni d'une
    // entrée construite dynamiquement, et c'est la seule garde qui parle à
    // quelqu'un qui lit le rapport CI plutôt que le compilateur.
    const guichet = guichetPourCode(code);
    expect(
      guichet,
      `Le code « ${code} » n'a pas de guichet. Une alerte sans destinataire ` +
        `retombe sur le canal global unique que le Lot 14 supprime.`,
    ).toBeDefined();
    expect(GUICHETS).toContain(guichet);
  });

  it("les quatre guichets sont tous utilisés par au moins un code", () => {
    // 🔴 Un guichet que personne n'emprunte est un guichet inventé : il donne
    // l'illusion d'un routage fin sans qu'aucune alerte n'y passe.
    const utilises = new Set(Object.values(ALERTE_CATALOGUE).map((e) => e.guichet));
    for (const g of GUICHETS) {
      expect(utilises, `Aucun code ne route vers le guichet « ${g} »`).toContain(g);
    }
  });

  it("chaque guichet a un libellé humain", () => {
    // Le libellé apparaît en tête du message. Un guichet sans libellé enverrait
    // un e-mail dont l'objet commencerait par `undefined`.
    for (const g of GUICHETS) {
      expect(LIBELLE_GUICHET[g]).toBeTruthy();
    }
  });
});

describe("🔴 les rôles de routage sortent du SSOT des rôles", () => {
  /**
   * L'énum Prisma `AdminRole`, pas les valeurs de `HABILITATIONS`.
   *
   * 🔴 La première version de ce test lisait `HABILITATIONS` — et accusait à
   * tort le rôle `secretaire`, qui est parfaitement réel mais ne porte AUCUN
   * acte engageant, donc n'apparaît dans aucune de ses listes. `HABILITATIONS`
   * répond à « qui peut engager », pas à « quels rôles existent » : s'en servir
   * comme annuaire, c'est confondre une matrice de droits avec un registre.
   */
  const ROLES_CONNUS = new Set<string>(Object.values(AdminRole));

  it("le registre des rôles n'est pas vide", () => {
    // Si l'énum générée changeait de forme, ce describe passerait au vert en
    // ne comparant plus rien.
    expect(ROLES_CONNUS.size).toBeGreaterThanOrEqual(4);
  });

  it.each(GUICHETS.filter((g) => ROLES_PAR_GUICHET[g].length > 0))(
    "%s ne cite que des rôles qui existent vraiment",
    (guichet) => {
      // Si un rôle est renommé ou supprimé, ce test rougit AVANT qu'on ne
      // route des alertes vers un rôle que plus personne ne porte.
      for (const role of ROLES_PAR_GUICHET[guichet]) {
        expect(
          ROLES_CONNUS.has(role),
          `Le guichet « ${guichet} » route vers le rôle « ${role} », absent de l'énum AdminRole.`,
        ).toBe(true);
      }
    },
  );

  it("tout guichet interne a au moins un rôle titulaire", () => {
    // `formateur` est la seule exception, et elle est délibérée : son
    // titulaire vient de la CIBLE de l'alerte, pas d'un rôle.
    for (const g of GUICHETS) {
      if (g === "formateur") continue;
      expect(ROLES_PAR_GUICHET[g].length, `Le guichet « ${g} » n'a aucun rôle`).toBeGreaterThan(0);
    }
  });

  it("super_admin dessert tous les guichets internes", () => {
    // Sans cette règle, un guichet peut se retrouver sans aucun titulaire actif
    // et toute sa famille d'alertes bascule sur le repli. `super_admin` est le
    // filet structurel.
    for (const g of GUICHETS) {
      if (g === "formateur") continue;
      expect(ROLES_PAR_GUICHET[g]).toContain("super_admin");
    }
  });
});

describe("🔴 la frontière du Lot 10 se retrouve dans le routage", () => {
  // Les alertes qui réclament un acte ENGAGEANT (contresigner, conclure,
  // facturer, déposer une demande au nom du client) ne peuvent pas atterrir au
  // secrétariat : ce serait demander à quelqu'un un geste qu'il n'a pas le
  // droit de poser — et l'écran le lui refuserait.
  const CODES_ACTE_ENGAGEANT = [
    "signature_contreseing_du",
    "devis_sans_reponse",
    "devis_expire_j7",
    "facture_impayee_j30",
    "facture_impayee_j60",
    "facture_sans_echeance",
    "opco_sans_accord",
    "opco_formation_demarree_sans_accord",
    "convention_tripartite_manquante",
    "convention_formation_manquante",
    "dossier_financement_sans_reponse",
    "financeur_paiement_en_retard",
  ] as const;

  it.each(CODES_ACTE_ENGAGEANT)("%s ne va jamais au secrétariat", (code) => {
    expect(
      guichetPourCode(code),
      `« ${code} » réclame un acte qui engage l'organisme ; le secrétariat ne peut pas le poser.`,
    ).not.toBe("administratif" satisfies GuichetAlerte);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Agrégation
// ─────────────────────────────────────────────────────────────────────────────

describe("🔴 dix échéances du même type font UN message, pas dix", () => {
  it("groupe dix factures impayées en un seul lot", () => {
    const dix = Array.from({ length: 10 }, (_, i) =>
      alerte(`a${i}`, "facture_impayee_j30", "important", `facture-${i}`),
    );
    const { lots, sansGuichet } = regrouperAlertes(dix);

    expect(sansGuichet).toEqual([]);
    expect(
      lots,
      "Dix alertes du même code doivent produire UN message. Dix messages, " +
        "c'est le canal global d'avant avec plus d'adresses.",
    ).toHaveLength(1);
    expect(lots[0]!.alertes).toHaveLength(10);
    expect(lots[0]!.guichet).toBe("direction");
  });

  it("ne mélange PAS deux situations dans le même message", () => {
    // Même guichet, codes différents → deux messages. Un message qui
    // mélangerait « certification expirée » et « devis expiré » obligerait le
    // lecteur à trier — et le tri est précisément ce qu'on lui enlève.
    const { lots } = regrouperAlertes([
      alerte("a", "facture_impayee_j30"),
      alerte("b", "devis_expire"),
    ]);
    expect(lots).toHaveLength(2);
    expect(new Set(lots.map((l) => l.guichet))).toEqual(new Set(["direction"]));
  });

  it("sépare deux guichets même à code identique impossible — un code, un guichet", () => {
    // Corollaire de la couverture : le guichet est porté par le CODE, donc
    // deux alertes de même code ne peuvent pas diverger de guichet. Ce test
    // fige l'invariant : si un jour le guichet devenait dépendant de la cible,
    // `regrouperAlertes` devrait changer de clé, et ceci le signalerait.
    const { lots } = regrouperAlertes([
      alerte("a", "cv_formateur_perime", "important", "f1"),
      alerte("b", "cv_formateur_perime", "important", "f2"),
    ]);
    expect(lots).toHaveLength(1);
    expect(lots[0]!.guichet).toBe("formateur");
  });

  it("le lot prend le niveau LE PLUS HAUT de ses membres", () => {
    // 🔴 Prendre le niveau de la première ferait dépendre l'urgence de l'ordre
    // de lecture en base : une alerte critique attendrait le résumé du
    // lendemain parce qu'une alerte `info` du même code est arrivée avant.
    const { lots } = regrouperAlertes([
      alerte("a", "emargement_manquant", "info"),
      alerte("b", "emargement_manquant", "critique"),
      alerte("c", "emargement_manquant", "important"),
    ]);
    expect(lots).toHaveLength(1);
    expect(lots[0]!.niveau).toBe("critique");
    expect(lots[0]!.immediat).toBe(true);
  });

  it("un critique part tout de suite, le reste attend le résumé", () => {
    expect(estImmediat("critique")).toBe(true);
    expect(estImmediat("important")).toBe(false);
    expect(estImmediat("info")).toBe(false);
  });

  it("un code hors catalogue n'est pas silencieux", () => {
    // 🔴 Le défaut du 2026-08-05 était exactement ça, côté résolution : des
    // codes émis sans entrée de catalogue restaient ouverts pour toujours. Le
    // taire côté envoi le referait, dans l'autre sens.
    const { lots, sansGuichet } = regrouperAlertes([
      alerte("x", "code_qui_nexiste_pas"),
      alerte("y", "emargement_manquant"),
    ]);
    expect(lots).toHaveLength(1);
    expect(sansGuichet.map((a) => a.id)).toEqual(["x"]);
  });

  it("l'ordre de sortie est déterministe", () => {
    // Sans tri stable, deux exécutions produiraient deux ordres et aucun test
    // d'envoi ne tiendrait.
    const entree = [
      alerte("a", "facture_impayee_j30"),
      alerte("b", "emargement_manquant"),
      alerte("c", "cv_formateur_perime"),
    ];
    const premier = regrouperAlertes(entree).lots.map((l) => `${l.guichet}::${l.code}`);
    const second = regrouperAlertes([...entree].reverse()).lots.map(
      (l) => `${l.guichet}::${l.code}`,
    );
    expect(premier).toEqual(second);
    expect(premier).toEqual([...premier].sort());
  });

  it("une entrée vide ne produit aucun message", () => {
    expect(regrouperAlertes([])).toEqual({ lots: [], sansGuichet: [] });
  });
});

describe("🔴 l'idempotence suit le LOT, pas l'alerte", () => {
  it("deux passages le même jour sur le même lot donnent la même clé", () => {
    const lot = regrouperAlertes([
      alerte("a", "facture_impayee_j30"),
      alerte("b", "facture_impayee_j30"),
    ]).lots[0]!;
    expect(cleIdempotenceLot(lot, "20260816")).toBe(cleIdempotenceLot(lot, "20260816"));
  });

  it("une alerte de plus dans la journée fait repartir le message", () => {
    // 🔴 Sans le compteur dans la clé, le résumé de dix factures bloquerait
    // l'envoi du résumé de onze jusqu'au lendemain : la déduplication
    // quotidienne masquerait l'aggravation.
    const deux = regrouperAlertes([
      alerte("a", "facture_impayee_j30"),
      alerte("b", "facture_impayee_j30"),
    ]).lots[0]!;
    const trois = regrouperAlertes([
      alerte("a", "facture_impayee_j30"),
      alerte("b", "facture_impayee_j30"),
      alerte("c", "facture_impayee_j30"),
    ]).lots[0]!;
    expect(cleIdempotenceLot(deux, "20260816")).not.toBe(cleIdempotenceLot(trois, "20260816"));
  });

  it("le lendemain, le même lot repart", () => {
    const lot = regrouperAlertes([alerte("a", "facture_impayee_j30")]).lots[0]!;
    expect(cleIdempotenceLot(lot, "20260816")).not.toBe(cleIdempotenceLot(lot, "20260817"));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Désescalade — l'exigence §14.3
// ─────────────────────────────────────────────────────────────────────────────

describe("🔴 une alerte dont la cause a disparu doit pouvoir se refermer", () => {
  /**
   * L'invariant réel n'est PAS « tout doit s'auto-résoudre ». Il est double, et
   * il se lit dans `synchroniserAlertes` :
   *
   *   - un code que **l'évaluateur quotidien** réémet tant que sa cause dure
   *     doit être auto-résoluble ; sinon son alerte reste ouverte pour toujours
   *     et la liste décrit l'historique au lieu de l'état — le défaut exact
   *     corrigé le 2026-08-05 sur trois codes ;
   *   - un code levé **ailleurs** (geste d'un bénéficiaire, échec d'un job,
   *     sonde de santé e-mail) ne DOIT PAS l'être : il n'apparaît jamais parmi
   *     les `candidates`, donc `synchroniserAlertes` le résoudrait au premier
   *     tour, avant que quiconque l'ait lu.
   *
   * Les deux familles se dérivent du CODE SOURCE de l'évaluateur, pas d'une
   * liste tenue à la main : une liste manuelle diverge le jour où l'on déplace
   * une règle, et c'est précisément ce jour-là qu'on aurait besoin d'elle.
   *
   * ⚠️ Piège déjà payé dans ce dépôt : un test statique retrouve ses propres
   * citations. On dépouille donc les commentaires AVANT de chercher les
   * émissions — sans quoi un code seulement MENTIONNÉ dans une note de bas de
   * règle compterait comme émis.
   */
  const sourceEvaluateur = readFileSync(
    resolve(process.cwd(), "src/server/qualiopi/alertes/evaluateur.ts"),
    "utf-8",
  )
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

  // 🔴 On cherche TOUTE citation littérale d'un code du catalogue, pas la seule
  // forme `code: "…"`. L'évaluateur en émet deux par un ternaire
  // (`code: p.statutSignature === "partielle" ? "a" : "b"`), et la forme étroite
  // les manquait : le test accusait alors deux codes parfaitement corrects.
  // Un test qui se trompe sur le code qu'il lit est pire qu'un test absent.
  /**
   * 🔴 2026-08-19 — CETTE EXTRACTION A ÉTÉ RÉÉCRITE, et c'est tout l'objet du
   * correctif.
   *
   * Elle était : `matchAll(/"([a-z0-9_]+)"/g).filter((c) => c in ALERTE_CATALOGUE)`.
   * Autrement dit, l'ensemble était construit **en filtrant sur la propriété que
   * le test suivant allait vérifier** — `inconnus` était donc vide PAR
   * CONSTRUCTION, et « tout code émis par le balayage est au catalogue » passait
   * au vert quoi qu'il arrive.
   *
   * Ce n'était pas un excès de prudence : le filtre était NÉCESSAIRE avec cette
   * regex, qui attrape toutes les chaînes minuscules du fichier — `"realisee"`,
   * `"convention"`, `"en_attente"`… Sans lui, le test aurait crié sur des
   * centaines de faux positifs. Le défaut est d'avoir rendu la garde vaine pour
   * la rendre silencieuse, au lieu de rendre l'extraction PRÉCISE.
   *
   * Ce qu'elle laissait passer, mesuré le 2026-08-19 : **quatre codes émis par le
   * balayage et absents du catalogue** — `kit_sorties_non_pretes`,
   * `vigilance_urssaf_absente`, `vigilance_urssaf_perimee`,
   * `vigilance_urssaf_expire_j30`. Sans entrée au catalogue, ils n'ont ni guichet
   * (donc n'arrivent dans aucune boîte, `envoi-groupe.ts` les range en
   * `sansGuichet`) ni résolution automatique (donc restent ouverts pour
   * toujours). La vigilance URSSAF engage la responsabilité solidaire de
   * l'organisme sur les cotisations du sous-traitant — art. L.8222-1.
   *
   * Le message d'échec de la garde citait pourtant nommément « le défaut du
   * 2026-08-05, qui laissait des alertes ouvertes pour toujours ». C'est ce
   * défaut-là qui était présent, sous la garde qui prétendait l'interdire.
   *
   * ## L'extraction précise
   *
   * On part de la POSITION SYNTAXIQUE `code:` plutôt que de la forme du littéral,
   * et on prend la fin de ligne — ce qui couvre les deux écritures réellement
   * présentes : `code: "x"` et le ternaire `code: c ? "a" : "b"` (les deux codes
   * URSSAF, qu'une regex sur `code:\s*"…"` aurait manqués).
   */
  const EMIS_PAR_LE_BALAYAGE = new Set(
    [...sourceEvaluateur.matchAll(/\bcode:\s*([^\n]*)/g)].flatMap((m) =>
      [...(m[1] ?? "").matchAll(/"([a-z0-9_]+)"/g)].map((q) => q[1]!),
    ),
  );

  /**
   * Codes RETIRÉS de l'évaluateur mais gardés au catalogue exprès.
   *
   * `facture_impayee_j30` : son émission a été supprimée (elle doublait la
   * relance J30 déjà proposée pour le même impayé — deux signaux concurrents,
   * deux cycles de vie à tenir). Le code reste au catalogue **précisément
   * parce que** `resolutionAuto: true` est le seul mécanisme qui permette aux
   * alertes déjà ouvertes en base de se refermer. Le raisonnement est écrit
   * dans `evaluateur.ts`, au-dessus de `regleFacturesImpayees`.
   *
   * ⚠️ Une entrée ici est une DETTE : le jour où la base n'en porte plus, le
   * code doit disparaître du catalogue. Elle n'est pas un endroit où ranger un
   * code qu'on n'a pas envie de trancher.
   */
  const RETIRES_MAIS_A_VIDANGER = new Set(["facture_impayee_j30"]);

  it("l'évaluateur émet bien des codes — le dépouillement n'a pas tout mangé", () => {
    // 🔴 Sans cette garde, une évolution du style d'écriture de l'évaluateur
    // (codes construits, énumérés ailleurs) viderait `EMIS_PAR_LE_BALAYAGE` et
    // TOUS les tests ci-dessous passeraient au vert en ne vérifiant plus rien.
    // Une garde qui ne garde rien est pire qu'une garde absente : elle rassure.
    expect(EMIS_PAR_LE_BALAYAGE.size).toBeGreaterThan(20);
  });

  it("🔴 tout rôle destinataire d'un guichet peut OUVRIR l'écran des alertes", () => {
    // Constat `D5-4-02`. `responsable_qualite` et `secretaire` recevaient les
    // alertes de leur guichet par e-mail, puis étaient redirigés vers l'écran de
    // connexion en cliquant sur le lien du message. Le Lot 10 a créé les rôles,
    // le Lot 14 leur a routé les alertes, et les deux surfaces de lecture sont
    // restées sur la garde d'avant (`admin` / `super_admin` seulement).
    for (const roles of Object.values(ROLES_PAR_GUICHET)) {
      for (const role of roles) {
        expect(
          peutLireLesAlertes(role),
          `« ${role} » reçoit des alertes mais ne pourrait pas ouvrir l'écran.`,
        ).toBe(true);
      }
    }
  });

  it("un rôle qui ne reçoit AUCUNE alerte n'entre pas — et l'absence de rôle non plus", () => {
    // Témoin discriminant : sans lui, `peutLireLesAlertes` pourrait rendre `true`
    // pour tout le monde et le test au-dessus passerait.
    expect(peutLireLesAlertes("reader")).toBe(false);
    expect(peutLireLesAlertes("editor")).toBe(false);
    expect(peutLireLesAlertes(null)).toBe(false);
    expect(peutLireLesAlertes(undefined)).toBe(false);
  });

  it("l'extraction attrape les DEUX écritures de `code:` — littéral ET ternaire", () => {
    // 🔴 Témoin de précision, pas de volume. Le test au-dessus vérifie que
    // l'ensemble n'est pas vide ; celui-ci vérifie qu'il n'est pas AMPUTÉ.
    //
    // Les deux codes de vigilance URSSAF sont émis par un ternaire
    // (`code: doc === null ? "…absente" : "…perimee"`). Une extraction sur
    // `code:\s*"…"` les manquerait en silence — et c'est précisément le genre de
    // trou qui a laissé passer le défaut que cette suite existe pour attraper.
    expect(EMIS_PAR_LE_BALAYAGE).toContain("emargement_manquant"); // littéral
    expect(EMIS_PAR_LE_BALAYAGE).toContain("vigilance_urssaf_absente"); // ternaire
    expect(EMIS_PAR_LE_BALAYAGE).toContain("vigilance_urssaf_perimee"); // ternaire
  });

  it("tout code émis par le balayage est au catalogue", () => {
    const inconnus = [...EMIS_PAR_LE_BALAYAGE].filter((c) => !(c in ALERTE_CATALOGUE));
    expect(
      inconnus,
      `Ces codes sont émis mais absents du catalogue : ils n'ont ni guichet, ni ` +
        `résolution automatique. C'est le défaut du 2026-08-05, qui laissait des ` +
        `alertes ouvertes pour toujours.`,
    ).toEqual([]);
  });

  it.each([...EMIS_PAR_LE_BALAYAGE].filter((c) => c in ALERTE_CATALOGUE).sort())(
    "%s — émis par le balayage, donc il doit se refermer OU dire pourquoi il ne le fait pas",
    (code) => {
      const entree = ALERTE_CATALOGUE[code]!;
      if (entree.resolutionAuto) return;
      // Le refus de se refermer est permis, jamais muet : c'est le type qui
      // l'exige (union `ResolutionAuto`), et ce test le rejoue à l'exécution
      // pour que le rapport CI nomme le code, pas seulement le compilateur.
      expect(
        entree.motifSansResolutionAuto,
        `« ${code} » est réémis par le balayage quotidien et ne se referme pas. ` +
          `Si c'est voulu, le motif doit être écrit ; sinon son alerte restera ` +
          `ouverte après la disparition de sa cause.`,
      ).toMatch(/\S/);
    },
  );

  it("la dette de vidange ne grossit pas en silence", () => {
    // Toute entrée de RETIRES_MAIS_A_VIDANGER est une exception au test
    // suivant. Les compter ici force à les voir : une liste d'exceptions qui
    // s'allonge sans qu'on la regarde finit par désarmer la garde qu'elle sert.
    expect(RETIRES_MAIS_A_VIDANGER.size).toBeLessThanOrEqual(1);
    for (const code of RETIRES_MAIS_A_VIDANGER) {
      expect(
        code in ALERTE_CATALOGUE,
        `« ${code} » a quitté le catalogue : retirer l'exception`,
      ).toBe(true);
    }
  });

  it.each(
    Object.keys(ALERTE_CATALOGUE).filter(
      (c) => !EMIS_PAR_LE_BALAYAGE.has(c) && !RETIRES_MAIS_A_VIDANGER.has(c),
    ),
  )("%s — levé hors du balayage, donc il ne doit PAS s'auto-résoudre", (code) => {
    // 🔴 Le sens inverse, et il compte autant : ces codes n'apparaissent
    // jamais parmi les `candidates`. Les passer à `true` les ferait résoudre
    // au premier `synchroniserAlertes`, avant lecture — une alerte effacée
    // par la mécanique censée la tenir à jour.
    expect(
      ALERTE_CATALOGUE[code]!.resolutionAuto,
      `« ${code} » n'est pas émis par l'évaluateur. À \`resolutionAuto: true\`, ` +
        `\`synchroniserAlertes\` le résoudrait dès le tour suivant, sans que ` +
        `personne ne l'ait vu.`,
    ).toBe(false);
  });
});
