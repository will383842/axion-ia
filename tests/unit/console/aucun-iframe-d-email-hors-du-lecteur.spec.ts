import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Lot I0 : un e-mail se lit dans `LecteurEmail` (cadre isolé, grande hauteur,
 * bascules), jamais dans un `<iframe` écrit à la main. La garde porte sur les
 * écrans déjà migrés ; un écran ajouté au lot suivant s'ajoute à cette liste.
 */
const LECTEUR = "src/components/admin/ui/LecteurEmail.tsx";
const A = "src/app/[locale]/(admin)/[adminPrefix]";
const MIGRES = [
  `${A}/emails/gabarits/[nom]/page.tsx`,
  `${A}/emails-envoyes/_components/VueDetailEmail.tsx`,
  "src/components/admin/contacts/ReplyHistory.tsx",
  "src/components/admin/apporteurs/fiche/ApercuEmail.tsx",
  "src/components/admin/contacts/IssueEchangeApporteurForm.tsx",
  "src/components/admin/contacts/IssueEchangeFormateurForm.tsx",
  "src/components/admin/apporteurs/entreprises/ReponsePresentation.tsx",
  "src/components/admin/qualiopi/FinCollaborationPanel.tsx",
  "src/components/admin/qualiopi/MiseANiveauListe.tsx",
] as const;

const lire = (f: string): string => readFileSync(f, "utf8");

/**
 * Retire les commentaires SANS se laisser tromper par une chaîne qui contient
 * `/*` ou `//` (une URL, un motif de glob) : un petit automate qui connaît les
 * chaînes simples, doubles et les gabarits. Les chaînes sont conservées.
 */
export function code(s: string): string {
  let out = "";
  let i = 0;
  while (i < s.length) {
    const c = s[i] as string;
    const n = s[i + 1];
    if (c === "/" && n === "/") {
      while (i < s.length && s[i] !== "\n") i++;
    } else if (c === "/" && n === "*") {
      const fin = s.indexOf("*/", i + 2);
      i = fin === -1 ? s.length : fin + 2;
    } else if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < s.length && s[j] !== c && (c === "`" || s[j] !== "\n")) {
        j += s[j] === "\\" ? 2 : 1;
      }
      out += s.slice(i, j + 1);
      i = j + 1;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

const RACINES = ["src/components/admin", "src/app/[locale]/(admin)"] as const;
const EXTENSIONS = /\.tsx?$/;
const EST_TEST = /(\.(test|spec)\.|__tests__)/;

function fichiers(dossier: string): string[] {
  return readdirSync(dossier, { withFileTypes: true }).flatMap((e) => {
    const p = join(dossier, e.name).replaceAll("\\", "/");
    if (e.isDirectory()) return e.name === "__tests__" ? [] : fichiers(p);
    return EXTENSIONS.test(e.name) && !EST_TEST.test(e.name) ? [p] : [];
  });
}

/**
 * Exceptions NOMMÉES : des écrans qui ne montrent pas un e-mail (cadre d'analytics,
 * aperçu d'article assaini, feuille de style du gabarit de la console…). Un écran
 * qui montre un e-mail n'a PAS sa place ici : il utilise `LecteurEmail`, et la garde
 * « importeurs » ci-dessous le vérifie toute seule, sans liste à éditer.
 */
const EXCEPTIONS = new Set<string>([
  "src/components/admin/ui/LecteurEmail.tsx",
  "src/components/admin/visio/CompteRenduVisio.tsx",
  `${A}/analytics/_v2/AnalyticsV2.tsx`,
  `${A}/connaissances/[id]/apercu/_v2/ConnaissancesApercuV2.tsx`,
  // Dossier du générateur de contenu : nom coupé en deux, la garde d'isolation
  // des zones refuse le nom entier hors de ses zones dédiées.
  `${A}/content-${"gen"}/review-queue/[id]/_v2/ReviewDetailV2.tsx`,
  `${A}/layout.tsx`,
]);

/** Importe le lecteur ou son enveloppe (import nommé, hors commentaires). */
export function importeLeLecteur(source: string): boolean {
  return /\bimport\b[^;]*\b(?:LecteurEmail|AdminApercuEmail)\b[^;]*\bfrom\b/.test(code(source));
}

/** Un `<iframe` écrit à la main, ou une injection directe de HTML. */
export function ecritUnCadre(source: string): boolean {
  return code(source).includes("<iframe");
}

describe("aucun <iframe d'e-mail hors du lecteur commun", () => {
  for (const f of MIGRES) {
    it(`${f} n'écrit pas d'iframe et utilise LecteurEmail`, () => {
      const s = code(lire(f));
      expect(s).not.toContain("<iframe");
      expect(s).toContain("<LecteurEmail");
    });
  }

  it("le nettoyeur de commentaires ne perd pas le code situé après une chaîne contenant /*", () => {
    const src = 'const g = "a/*"; <iframe src="x" />; const h = "*/";';
    expect(code(src)).toContain("<iframe");
    expect(code("// <iframe\n/* <iframe */ ok")).not.toContain("<iframe");
  });

  it("tout fichier qui importe LecteurEmail ou AdminApercuEmail est sans <iframe", () => {
    const importeurs = RACINES.flatMap((r) => fichiers(r)).filter((f) => importeLeLecteur(lire(f)));
    // Garde contre une garde vide : le lecteur a bien des appelants.
    expect(importeurs.length).toBeGreaterThan(5);
    expect(importeurs.filter((f) => ecritUnCadre(lire(f)))).toEqual([]);
  });

  it("les exceptions ne contiennent ni AdminApercuEmail ni les trois anciennes réservations", () => {
    for (const interdit of [
      "src/components/admin/ui/AdminApercuEmail.tsx",
      "src/components/admin/contacts/ReplyComposer.tsx",
      `${A}/contacts/candidatures/[id]/ComposerReponse.tsx`,
      "src/components/admin/qualiopi/EmailOutboxItem.tsx",
    ]) {
      expect(EXCEPTIONS.has(interdit), interdit).toBe(false);
    }
  });

  it("témoin synthétique : un importeur du lecteur qui écrit un <iframe est détecté", () => {
    const fautif =
      'import { LecteurEmail } from "@/x";\nexport const X = () => <iframe src="y" />;';
    const sain =
      'import { AdminApercuEmail } from "@/x";\n// <iframe\nexport const X = () => null;';
    expect(importeLeLecteur(fautif) && ecritUnCadre(fautif)).toBe(true);
    expect(importeLeLecteur(sain) && ecritUnCadre(sain)).toBe(false);
    expect(importeLeLecteur("const a = 1;")).toBe(false);
  });

  it("aucun <iframe ni dangerouslySetInnerHTML dans la console, hors exceptions nommées", () => {
    const tous = RACINES.flatMap((r) => fichiers(r));
    expect(tous.length).toBeGreaterThan(100);
    const fautifs = tous.filter((f) => {
      if (EXCEPTIONS.has(f)) return false;
      const s = code(lire(f));
      return s.includes("<iframe") || s.includes("dangerouslySetInnerHTML");
    });
    expect(fautifs).toEqual([]);
    for (const e of EXCEPTIONS) expect(() => lire(e), `exception périmée : ${e}`).not.toThrow();
  });

  it("le lecteur lui-même est isolé : sandbox vide, jamais allow-same-origin", () => {
    const s = code(lire(LECTEUR));
    expect(s).toContain('sandbox=""');
    expect(s).toContain('referrerPolicy="no-referrer"');
    expect(s).not.toContain("allow-same-origin");
    expect(s).not.toContain("allow-scripts");
    expect(s).not.toContain("dangerouslySetInnerHTML");
  });
});
