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
 *  - Fiches formation, TOUS les champs (prérequis affichés sur la fiche et dans
 *    son JSON-LD, public visé, programme, textes EN) : même interdiction, sauf
 *    le champ `materielFr` des deux exceptions confirmées (revue exactitude
 *    5251895268, panne R10 : « Un ordinateur portable est obligatoire » dans
 *    `prerequisFr` passait en vert).
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

/** Dans la FAQ, aucune occurrence n'est tolérée, dans aucune langue. */
const ORDINATEUR_PORTABLE_OU_LAPTOP = /ordinateurs? portables?|laptops?/i;

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

  it("aucune fiche ne mentionne l'ordinateur portable ou le laptop hors du champ matériel des exceptions", () => {
    // Tous les champs de la fiche : prérequis (affichés sur la fiche et dans son
    // JSON-LD), public visé, programme, textes EN… Seul `materielFr` des deux
    // exceptions confirmées peut en parler.
    const fautives = FORMATIONS_V2.filter((f) => {
      const champs = EXCEPTIONS_ORDINATEUR.has(f.id) ? { ...f, materielFr: undefined } : f;
      return ORDINATEUR_PORTABLE_OU_LAPTOP.test(JSON.stringify(champs));
    }).map((f) => f.id);
    expect(fautives).toEqual([]);
  });

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
        .filter((langue) => ORDINATEUR_PORTABLE_OU_LAPTOP.test(JSON.stringify(e[langue])))
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
