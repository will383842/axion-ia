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
 * JSON-LD QAPage et llms-full.txt), et la garde passait 22/22 en vert. Elle
 * balaie désormais TOUT le contenu public source, pas une formulation.
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
const ORDINATEUR_COMME_MATERIEL =
  /ordinateur portable\s*(?:,|;|et)\s*(?:une\s+)?connexion internet|connexion internet\s*(?:,|;|et)\s*(?:un\s+)?ordinateur portable/i;

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

  it("les exceptions existent et restent sur ordinateur", () => {
    for (const id of EXCEPTIONS_ORDINATEUR) {
      const f = formations.find((x) => x.id === id);
      expect(f, id).toBeDefined();
      expect(getFormationMateriel(f!)).toMatch(/^ordinateur portable/i);
    }
  });

  it("aucune entrée de la FAQ (réponses et points clés, FR et EN) n'exige l'ordinateur portable", () => {
    const fautives = FAQ_GLOBAL.filter((e) =>
      ORDINATEUR_COMME_MATERIEL.test(JSON.stringify(e)),
    ).map((e) => e.id);
    expect(fautives).toEqual([]);
  });

  it("la FAQ qui parle du matériel nomme les deux exceptions", () => {
    const texte = JSON.stringify(FAQ_GLOBAL);
    for (const m of texte.matchAll(/smartphone ou un ordinateur[^"]{0,260}/gi)) {
      expect(m[0]).toMatch(/IA pour l'IT et IA pour l'automatisation/);
      expect(m[0]).toMatch(/tableur/);
    }
  });

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
