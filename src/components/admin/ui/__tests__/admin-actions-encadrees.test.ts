// Les actions de ligne doivent être ENCADRÉES — 2026-08-02.
//
// POURQUOI CE TEST EXISTE
// -----------------------
// Loi posée par Will après revue de la console en production : « Chaque bouton
// doit être réellement visible et idéalement dans un encadré et pas un texte
// cliquable qui ne se voit que très peu. »
//
// Le cas qui l'a déclenchée : la colonne Actions de `qualiopi/sessions` empilait
// QUATRE liens soulignés en 12px (« Ouvrir », « Émargement », « Évaluations »,
// « Financement »). Rien ne signalait qu'il s'agissait de commandes ; la même
// forme existait sur `qualiopi/formations`. Un lien souligné se lit comme de la
// note de bas de page, pas comme un geste.
//
// CE QUE CE TEST N'INTERDIT PAS
// -----------------------------
// Un lien sur le NOM d'une entité (le client, la formation) reste un lien
// souligné : l'encadrer en ferait un faux bouton, et une ligne de tableau
// deviendrait une rangée de boutons sans hiérarchie. Le test ne regarde donc
// que les CELLULES qui empilent plusieurs liens nus — la signature d'une
// colonne d'actions, jamais celle d'une colonne de contenu.
//
// QUE FAIRE SI CE TEST ÉCHOUE
// ---------------------------
// La cellule listée empile 2 liens ou plus sans cadre. Donnez-leur
// `admin-button-secondary` (l'action attendue) et `admin-button-ghost` (les
// autres) — le fantôme porte déjà un fond tonal et une bordure, sa définition
// dans `admin.css` dit littéralement « actions de ligne ».
//
// ⚠️ PIÈGE : les classes `.admin-*` vivent HORS COUCHE, donc toute utilitaire
// Tailwind accolée serait INERTE. On REMPLACE la className, on n'ajoute pas.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(__dirname, "../../../../..");
const SCAN_DIRS = [join(ROOT, "src/app/[locale]/(admin)"), join(ROOT, "src/components/admin")];

function fichiersTsx(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) fichiersTsx(p, out);
    else if (e.name.endsWith(".tsx") && !/\.(test|spec)\.tsx$/.test(e.name)) out.push(p);
  }
  return out;
}

/** Une classe qui pose une bordure, un rayon ou un fond = déjà encadré. */
const ENCADRE = /\b(border|rounded|admin-button|bg-)/;

function cellulesFautives(source: string): string[] {
  const trouvees: string[] = [];
  for (const cellule of source.match(/<td\b[\s\S]*?<\/td>/g) ?? []) {
    const liens = [...cellule.matchAll(/<(Link|a|button)\b([^>]*?)>\s*([^<>{}]+?)\s*<\/\1>/g)];
    const nus = liens.filter((m) => {
      const cls = /className="([^"]*)"/.exec(m[2] ?? "");
      return cls === null || !ENCADRE.test(cls[1] ?? "");
    });
    if (nus.length >= 2) trouvees.push(nus.map((m) => (m[3] ?? "").trim()).join(" · "));
  }
  return trouvees;
}

describe("actions de ligne encadrées", () => {
  it("aucune cellule de tableau n'empile plusieurs liens sans cadre", () => {
    const fautes: string[] = [];
    for (const dir of SCAN_DIRS) {
      for (const f of fichiersTsx(dir)) {
        for (const libelles of cellulesFautives(readFileSync(f, "utf8"))) {
          fautes.push(`${f.slice(ROOT.length + 1).replace(/\\/g, "/")} → ${libelles}`);
        }
      }
    }
    expect(fautes, `Cellules d'actions en texte nu :\n${fautes.join("\n")}`).toEqual([]);
  });
});
