/**
 * CLIQUET — un mot par chose, à l'écran de la console.
 *
 * ## Pourquoi ce fichier existe
 *
 * Le 2026-08-26, l'écran des demandes entrantes portait DEUX mots pour la même
 * chose, à quatre lignes d'écart : le `h1` disait « Messages » (corrigé la
 * veille) et le compteur juste en dessous disait encore « 1 234 soumissions ».
 * Personne ne l'avait vu parce que **rien ne lisait ces libellés** — ni test, ni
 * garde. Le `h1` avait été corrigé ; son jumeau, non. C'est le motif de 9 lots
 * sur 11 du cahier D3.
 *
 * « soumission » est le nom d'une TABLE. « enrollment » est le nom d'un MODÈLE.
 * Aucun des deux n'est un mot que Will, une secrétaire ou un certificateur
 * doivent apprendre pour se servir de la console.
 *
 * ## Ce que cette garde vérifie, et ce qu'elle ne vérifie pas
 *
 * Elle lit les **positions d'affichage** — `itemLabel`, `label`, `aria-label`,
 * et le texte nu entre deux balises. Elle ne touche **pas** aux identifiants de
 * code (`enrollmentId`, `EnrollmentRow`, `participantsRaw`) : le lexique bannit
 * des mots **à l'écran**, pas dans le code, et les confondre déclencherait un
 * renommage massif sans aucun gain pour un lecteur.
 *
 * ## Les exceptions sont NOMMÉES, avec leur raison
 *
 * Une liste d'exceptions sans raison écrite devient, en trois mois, la liste de
 * ce que personne n'ose retirer. Chacune porte donc pourquoi elle est juste —
 * et le cas de la revue de direction est celui qui compte : y remplacer
 * « participants » par « stagiaires » écrirait une **fausseté**, parce que les
 * participants d'une revue de direction sont les présents à la réunion.
 * *Une règle juste appliquée au pluriel dispense d'examiner le voisin* — sauf
 * que le voisin n'a pas le même client (piège payé le 2026-08-24).
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const RACINE = process.cwd();

/**
 * Les deux arbres où vivent les écrans de console.
 *
 * ⚠️ PARCOURS RÉCURSIF, PAS DE GLOB. Le chemin contient `[locale]` et
 * `[adminPrefix]` : un glob y voit des **classes de caractères**, pas des noms
 * de dossiers — `[locale]` matche « l », « o », « c », « a » ou « e ».
 * Une première version en `globSync` ne lisait donc QUE `components/admin`,
 * en silence. C'est le contre-témoin ci-dessous qui l'a dit, pas la garde.
 */
const PERIMETRE = ["src/app", "src/components/admin"] as const;

/** Un mot banni, et LE mot à sa place. */
const BANNIS: ReadonlyArray<{ motif: RegExp; interdit: string; aLaPlace: string }> = [
  { motif: /soumissions?/i, interdit: "soumission", aLaPlace: "message" },
  { motif: /enrollments?/i, interdit: "enrollment", aLaPlace: "inscription" },
  { motif: /participants?/i, interdit: "participant", aLaPlace: "stagiaire" },
];

/**
 * Exceptions NOMMÉES — fichier + mot + raison. Ajouter une ligne ici est un
 * acte délibéré qui laisse une trace lisible ; le faire sans raison écrite est
 * refusé par le test du bas.
 */
const EXCEPTIONS: ReadonlyArray<{ fichier: string; mot: string; raison: string }> = [
  {
    fichier: "qualiopi/revue-direction/page.tsx",
    mot: "participant",
    raison:
      "Une revue de direction a des PARTICIPANTS : les personnes présentes à la réunion. " +
      "Ce ne sont pas des stagiaires — y appliquer la règle écrirait une fausseté.",
  },
  {
    fichier: "admin/qualiopi/RevueDirectionForm.tsx",
    mot: "participant",
    raison:
      "Même raison que l'écran de revue de direction : le formulaire saisit les personnes " +
      "présentes à la réunion de direction, jamais des stagiaires.",
  },
  {
    fichier: "admin/qualiopi/RevueDirectionRowActions.tsx",
    mot: "participant",
    raison:
      "Même raison : les actions de ligne rééditent la liste des présents à la réunion " +
      "de direction, qui ne sont pas des stagiaires.",
  },
  {
    fichier: "admin/qualiopi/BaremeOpcoForm.tsx",
    mot: "participant",
    raison:
      "« Intra (€/h/participant) » est l'UNITÉ DU BARÈME OPCO, telle que l'OPCO l'écrit " +
      "dans le document que l'opérateur recopie. Traduire l'unité en « stagiaire » ferait " +
      "que le champ ne correspond plus à sa source : on ne renomme pas le vocabulaire du " +
      "financeur dans le formulaire qui sert à le retranscrire.",
  },
];

/** Les positions où un mot est LU par un humain. */
const POSITIONS: ReadonlyArray<RegExp> = [
  /\b(?:itemLabel|itemLabelPluriel|label|aria-label|title|placeholder|header)\s*=\s*"([^"]*)"/g,
  />\s*([A-Za-zÀ-ÿ][^<>{}\n]{0,60}?)\s*</g,
];

function parcourir(relatif: string, acc: string[]): string[] {
  let entrees;
  try {
    entrees = readdirSync(join(RACINE, relatif), { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entrees) {
    const chemin = `${relatif}/${e.name}`;
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === "__tests__") continue;
      parcourir(chemin, acc);
    } else if (e.name.endsWith(".tsx") && !/\.(spec|test)\.tsx$/.test(e.name)) {
      acc.push(chemin);
    }
  }
  return acc;
}

/**
 * Les écrans de CONSOLE seulement. `src/app` contient aussi les pages
 * publiques, où « participant » reste licite côté marketing — d'où le filtre
 * sur `(admin)`.
 */
function fichiersConsole(): string[] {
  const tous = PERIMETRE.flatMap((racine) => parcourir(racine, []));
  return tous.filter((f) => f.includes("(admin)") || f.includes("components/admin"));
}

type Violation = { fichier: string; mot: string; extrait: string };

function violations(): Violation[] {
  const trouvees: Violation[] = [];
  for (const fichier of fichiersConsole()) {
    const source = readFileSync(join(RACINE, fichier), "utf8")
      // Les commentaires racontent souvent le défaut qu'ils ont corrigé : les
      // lire ferait rougir la garde sur son propre récit.
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");

    for (const position of POSITIONS) {
      position.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = position.exec(source)) !== null) {
        const texte = m[1];
        if (!texte) continue;
        for (const { motif, interdit } of BANNIS) {
          if (!motif.test(texte)) continue;
          const excuse = EXCEPTIONS.some(
            (e) => fichier.replace(/\\/g, "/").endsWith(e.fichier) && e.mot === interdit,
          );
          if (excuse) continue;
          trouvees.push({ fichier: fichier.replace(/\\/g, "/"), mot: interdit, extrait: texte });
        }
      }
    }
  }
  return trouvees;
}

describe("le lexique de la console — un mot par chose", () => {
  it("🔑 CONTRE-TÉMOIN : la garde lit bien des fichiers", () => {
    // Sans ceci, un périmètre devenu faux (dossier renommé, glob cassé) rendrait
    // « 0 violation » sur 0 fichier lu — le vert le plus dangereux qui soit.
    // Payé en séance le 2026-08-26 : une mesure de lexique portait sur
    // `messages/fr.json`, un chemin qui n'existe pas.
    const fichiers = fichiersConsole();
    expect(fichiers.length).toBeGreaterThan(400);
    expect(fichiers.some((f) => f.includes("submissions"))).toBe(true);
  });

  it("aucun mot de table ni de modèle ne s'affiche à l'écran", () => {
    const trouvees = violations();
    const rapport = trouvees
      .map(
        (v) =>
          `  ${v.fichier}\n    « ${v.extrait} » porte « ${v.mot} » — ` +
          `le mot est « ${BANNIS.find((b) => b.interdit === v.mot)?.aLaPlace} » ` +
          `(cf. _AUDIT/RESERVATION-2026-08-26/LEXIQUE.md)`,
      )
      .join("\n");
    expect(trouvees, `Libellés hors lexique :\n${rapport}`).toEqual([]);
  });

  it("🔴 chaque exception porte une raison, pas seulement un chemin", () => {
    // Une liste d'exceptions sans raison devient la liste de ce que personne
    // n'ose retirer.
    for (const e of EXCEPTIONS) {
      expect(e.raison.length, `l'exception ${e.fichier} n'explique pas pourquoi`).toBeGreaterThan(
        60,
      );
    }
  });
});
