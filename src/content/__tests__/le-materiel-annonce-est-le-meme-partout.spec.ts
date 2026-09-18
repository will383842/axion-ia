/**
 * le-materiel-annonce-est-le-meme-partout.spec.ts
 *
 * 🔴 POURQUOI CE FICHIER EXISTE.
 *
 * Mesuré le 2026-09-18 : la base (`formations.moyens_techniques`), imprimée sur
 * le programme PDF et la convocation, dit « smartphone ou poste ». Les fiches
 * publiques de 21 formations disaient « Ordinateur portable ». Le même stagiaire
 * lisait deux règles.
 *
 * Décision de Will du 2026-09-18 : smartphone OU ordinateur. Deux exceptions,
 * confirmées par Will le même jour : IA pour l'IT (environnement de
 * développement habituel) et IA pour l'automatisation (prototype construit sur
 * poste). Le séminaire n'exige aucun matériel individuel. Et, décision de Will
 * du même jour : pour les quatre formations à exercices sur tableur (finance,
 * achats, commerce, équipes), « un ordinateur est recommandé ».
 *
 * 🔴 PREMIÈRE VERSION DE CETTE GARDE : TROP ÉTROITE. Elle ne cherchait dans la
 * FAQ qu'UNE phrase exacte ; l'entrée `presentiel-distance` disait encore
 * « un ordinateur portable et une connexion internet » (publiée sur /faq, le
 * JSON-LD QAPage et llms-full.txt), et la garde passait 22/22 en vert.
 *
 * 🔴 DEUXIÈME VERSION : ENCORE TROP ÉTROITE. Elle ne reconnaissait « ordinateur
 * portable » que collé à « connexion internet » : « un ordinateur portable »
 * seul, « … avec une connexion internet », « … et d'une connexion internet »,
 * « … — et une connexion internet » passaient en exit 0 (revue sécurité
 * 5251842255).
 *
 * Ce qu'elle garantit désormais, et ce qu'elle ne garantit pas :
 *  - FAQ_GLOBAL (FR ET EN, réponses, points clés, nuances) : AUCUNE occurrence
 *    de « ordinateur portable » ni de « laptop », quelle que soit la phrase.
 *    Il n'en reste aucune légitime ; une future mention exigera de retoucher
 *    cette garde, et c'est voulu.
 *  - Fiches formation, texte AFFICHÉ (page et JSON-LD) : champs de l'objet ET
 *    sortie de CHAQUE export de `catalog-v2-facts.ts` appliqué à la fiche —
 *    défauts (matériel, prérequis, effectif, outils, méthodes…) et libellés
 *    `format*` réellement rendus (modalités, durée). Même interdiction,
 *    « PC portable », espace insécable et saut de ligne compris. Un export
 *    nouveau non classé fait échouer la garde. Exclus, avec leur motif : le
 *    matériel des deux exceptions confirmées, et les textes alternatifs et
 *    légendes de photos. Pannes fermées : R10 (`prerequisFr`), D1 (défaut du
 *    matériel absent de l'objet), S1/N1 (libellé `formatModalitesFr`), N2
 *    (prérequis par défaut écrit en dur dans la page, désormais
 *    `FORMATION_PREREQUIS_DEFAUT`).
 *  - Les entrées qui parlent du matériel (`presentiel-distance`,
 *    `competences-techniques`) doivent CONTENIR la phrase et nommer les
 *    exceptions : si la phrase disparaît, le test échoue au lieu de passer à vide.
 *  - ⚠️ LIMITE DÉCLARÉE du balayage des fichiers (src/content, src/app,
 *    src/components, src/messages) : il ne repère que la formulation
 *    « ordinateur portable » JOINTE à « connexion internet » (avec ou sans
 *    « avec », « et », « d' », tiret). Une mention isolée hors FAQ n'y est pas
 *    détectée : elle serait indiscernable des descriptions de photos
 *    (« une main au-dessus d'un ordinateur portable »), nombreuses et légitimes.
 *
 * Elle ne lit pas la base : elle vérifie que le contenu public dit la même
 * chose qu'elle.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import * as FAITS from "@/content/formations/catalog-v2-facts";
import { getFormationMateriel } from "@/content/formations/catalog-v2-facts";
import { FORMATIONS_V2 } from "@/content/formations/catalog-v2";
import { FAQ_GLOBAL } from "@/content/transversal";

/** Fiches où le smartphone serait une promesse fausse — confirmées par Will le 2026-09-18. */
const EXCEPTIONS_ORDINATEUR = new Set(["ia-pour-l-it", "ia-pour-l-automatisation"]);

/** Exercices sur tableur : smartphone ou ordinateur, ordinateur recommandé (Will, 2026-09-18). */
const FORMATIONS_TABLEUR = new Set([
  "ia-pour-la-finance",
  "ia-pour-les-achats",
  "ia-pour-le-commerce",
  "ia-pour-les-equipes",
]);

/**
 * Un ordinateur portable présenté comme MATÉRIEL REQUIS : il est suivi (ou
 * précédé) de la connexion internet. Les descriptions de photos (« une main
 * au-dessus d'un ordinateur portable ») ne le sont pas, et ne sont pas visées.
 */
const LIEN = String.raw`\s*(?:[,;—–-]\s*)?(?:et|avec)?\s*(?:d'|de\s+)?(?:une?\s+)?`;
const ORDINATEUR_COMME_MATERIEL = new RegExp(
  String.raw`ordinateur portable${LIEN}connexion internet|connexion internet${LIEN}ordinateur portable`,
  "i",
);

/**
 * Aucune occurrence n'est tolérée, dans aucune langue : « ordinateur portable »,
 * « PC portable », « laptop » — espace ordinaire ou insécable.
 */
const ORDINATEUR_PORTABLE_OU_LAPTOP = /(?:ordinateurs?|pc)[\s\u00a0\u202f]+portables?|laptops?/i;

/**
 * Ce que la fiche AFFICHE (page et JSON-LD), dérivé MÉCANIQUEMENT de tout le
 * module `catalog-v2-facts.ts`, et non d'une liste tapée à la main.
 *
 * Historique de l'escalade, pour ne pas la rejouer : l'objet seul ne voyait pas
 * les défauts (panne D1, revue sécurité 5252455088) ; une liste de `get*` tapée
 * à la main ne voyait pas les libellés `format*` réellement rendus (panne S1,
 * revue simplicité 5253007780 : « Présentiel — ordinateur portable obligatoire »
 * dans `formatModalitesFr` restait vert).
 *
 * Règle : chaque export du module est classé ci-dessous, et un test échoue si
 * un export nouveau n'entre dans aucune classe.
 *  - fonction d'arité 1 → appelée sur la fiche ;
 *  - `format*` dont l'argument est la SORTIE d'un `get*` → appelée sur cette
 *    sortie (table `FORMATEURS_SUR_SORTIE`) ;
 *  - constante → sérialisée telle quelle ;
 *  - exclus, avec leur motif (`EXCLUS`).
 */
const FORMATEURS_SUR_SORTIE: Record<string, string> = {
  formatModalitesFr: "getFormationModalites",
};

/** Exports exclus, et pourquoi. Tout ajout ici doit se justifier. */
const EXCLUS: Record<string, string> = {
  // ⚠️ Ces textes servent AUSSI de légende (`caption`) dans le JSON-LD de la
  // fiche. Ils restent exclus parce qu'au 2026-09-19 deux d'entre eux décrivent
  // une photo où figure un laptop (IA pour les équipes, IA pour le marketing) :
  // ce n'est pas une exigence de matériel. `imageAltFr` propre à une fiche, lui,
  // reste contrôlé (aucune valeur actuelle ne parle de laptop).
  getFormationImage: "texte alternatif et légende de photo (« people around a laptop »)",
  getFormationImageCredit: "nom et lien du photographe",
  getFormationScenePhotos: "textes alternatifs de photos",
  FORMATION_GAMME_IMAGE: "textes alternatifs de photos",
};

type Fonction = (x: unknown) => unknown;

function classer(nom: string, valeur: unknown): "fiche" | "sortie" | "constante" | "exclu" | null {
  if (nom in EXCLUS) return "exclu";
  if (nom in FORMATEURS_SUR_SORTIE) return "sortie";
  if (typeof valeur === "function") return (valeur as Fonction).length === 1 ? "fiche" : null;
  return "constante";
}

/** Espaces et sauts de ligne normalisés : « ordinateur⏎portable » est cherché comme tel. */
function normaliser(texte: string): string {
  // `\\[nrt]` : les sauts de ligne tels que JSON.stringify les \u00e9crit (barre
  // oblique inverse suivie d'une lettre), pas des caract\u00e8res de contr\u00f4le.
  return texte.replace(/\\[nrt]/g, " ").replace(/[\s\u00a0\u202f]+/g, " ");
}

function texteAffiche(f: (typeof FORMATIONS_V2)[number]): string {
  const exception = EXCEPTIONS_ORDINATEUR.has(f.id);
  const morceaux: unknown[] = [{ ...f, materielFr: undefined }];
  for (const [nom, valeur] of Object.entries(FAITS)) {
    const classe = classer(nom, valeur);
    if (classe === "exclu" || classe === null) continue;
    if (classe === "constante") {
      // Les constantes de matériel sont lues via la fiche : pour une exception,
      // son texte propre remplace le défaut, qui n'est alors pas affiché.
      morceaux.push(valeur);
    } else if (classe === "fiche") {
      if (exception && nom === "getFormationMateriel") continue;
      morceaux.push((valeur as Fonction)(f));
    } else {
      const source = (FAITS as Record<string, unknown>)[FORMATEURS_SUR_SORTIE[nom]!] as Fonction;
      morceaux.push((valeur as Fonction)(source(f)));
    }
  }
  return normaliser(JSON.stringify(morceaux));
}

/** Entrées de la FAQ qui énoncent le matériel, en FR et en EN. */
const FAQ_MATERIEL = ["presentiel-distance", "competences-techniques"] as const;

const RACINE = path.resolve(__dirname, "../../..");

function fichiers(dir: string): string[] {
  const out: string[] = [];
  for (const nom of readdirSync(dir)) {
    const p = path.join(dir, nom);
    if (statSync(p).isDirectory()) {
      if (nom === "__tests__" || nom === "node_modules") continue;
      out.push(...fichiers(p));
    } else if (/\.(ts|tsx|json)$/.test(nom) && !/\.(spec|test)\.tsx?$/.test(nom)) {
      out.push(p);
    }
  }
  return out;
}

describe("le matériel annoncé est le même partout", () => {
  const formations = FORMATIONS_V2.filter((f) => !f.seminaire);

  it("porte sur les 21 formations hors séminaire", () => {
    expect(formations.length).toBe(21);
  });

  it.each(
    formations.filter((f) => !EXCEPTIONS_ORDINATEUR.has(f.id)).map((f) => [f.id, f] as const),
  )("%s annonce « smartphone ou ordinateur »", (_id, f) => {
    const materiel = getFormationMateriel(f);
    expect(materiel).toMatch(/^smartphone ou ordinateur/i);
    expect(materiel).not.toMatch(ORDINATEUR_COMME_MATERIEL);
  });

  it.each([...FORMATIONS_TABLEUR])("%s recommande l'ordinateur pour le tableur", (id) => {
    const f = formations.find((x) => x.id === id);
    expect(f, id).toBeDefined();
    expect(getFormationMateriel(f!)).toMatch(
      /^smartphone ou ordinateur.*un ordinateur est recommandé pour les exercices sur tableur/i,
    );
  });

  it("chaque export de catalog-v2-facts.ts est couvert par texteAffiche, ou exclu avec un motif", () => {
    const nonClasses = Object.entries(FAITS)
      .filter(([nom, valeur]) => classer(nom, valeur) === null)
      .map(([nom]) => nom);
    expect(nonClasses).toEqual([]);
    for (const [nom, source] of Object.entries(FORMATEURS_SUR_SORTIE)) {
      expect(typeof (FAITS as Record<string, unknown>)[nom], nom).toBe("function");
      expect(typeof (FAITS as Record<string, unknown>)[source], source).toBe("function");
    }
    for (const nom of Object.keys(EXCLUS)) expect(nom in FAITS, nom).toBe(true);
  });

  it.each(FORMATIONS_V2.map((f) => [f.id, f] as const))(
    "%s n'affiche ni ordinateur portable ni laptop, défauts centralisés compris",
    (_id, f) => {
      expect(texteAffiche(f)).not.toMatch(ORDINATEUR_PORTABLE_OU_LAPTOP);
    },
  );

  it("les exceptions existent et restent sur ordinateur", () => {
    for (const id of EXCEPTIONS_ORDINATEUR) {
      const f = formations.find((x) => x.id === id);
      expect(f, id).toBeDefined();
      expect(getFormationMateriel(f!)).toMatch(/^ordinateur portable/i);
    }
  });

  it("aucune entrée de la FAQ, en FR comme en EN, ne mentionne l'ordinateur portable ni le laptop", () => {
    const fautives = FAQ_GLOBAL.flatMap((e) =>
      (["fr", "en"] as const)
        .filter((langue) =>
          ORDINATEUR_PORTABLE_OU_LAPTOP.test(normaliser(JSON.stringify(e[langue]))),
        )
        .map((langue) => `${e.id}:${langue}`),
    );
    expect(fautives).toEqual([]);
  });

  it.each([...FAQ_MATERIEL])(
    "%s énonce le matériel en FR et en EN, avec les exceptions et le tableur",
    (id) => {
      const e = FAQ_GLOBAL.find((x) => x.id === id);
      expect(e, id).toBeDefined();
      const fr = JSON.stringify(e!.fr);
      const en = JSON.stringify(e!.en);
      // Pas de passage à vide : la phrase doit être là.
      expect(fr).toMatch(/smartphone ou un ordinateur/i);
      expect(fr).toMatch(/IA pour l'IT et IA pour l'automatisation/);
      expect(fr).toMatch(/tableur/);
      expect(en).toMatch(/smartphone or a computer/i);
      expect(en).toMatch(/AI for IT and AI for automation/);
      expect(en).toMatch(/spreadsheet/);
    },
  );

  it("aucun fichier de contenu public n'exige l'ordinateur portable hors des deux exceptions", () => {
    const racines = ["src/content", "src/app", "src/components", "src/messages"]
      .map((r) => path.join(RACINE, r))
      .filter((r) => existsSync(r));
    expect(racines.length).toBeGreaterThanOrEqual(3);
    const trouvailles: string[] = [];
    for (const f of racines.flatMap(fichiers)) {
      readFileSync(f, "utf8")
        .split("\n")
        .forEach((ligne, i) => {
          if (ORDINATEUR_COMME_MATERIEL.test(ligne)) {
            trouvailles.push(`${path.relative(RACINE, f).replace(/\\/g, "/")}:${i + 1}`);
          }
        });
    }
    // Les deux seules lignes admises : les surcharges `materielFr` des exceptions.
    const admises = trouvailles.filter((t) =>
      t.startsWith("src/content/formations/catalog-v2.ts:"),
    );
    expect(trouvailles.filter((t) => !admises.includes(t))).toEqual([]);
    expect(admises).toHaveLength(EXCEPTIONS_ORDINATEUR.size);
  });
});
