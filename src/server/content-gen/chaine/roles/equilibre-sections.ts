/**
 * Mesures d'équilibre des sections (addendum § 7.4), calculées par le CODE et données à R5 (qui
 * juge « remplissage ? » et « que manque-t-il ? ») et à R7 (qui renvoie à R4 ce qui relève du fond).
 *
 *  - L-1 : une section informative ou « phase » compte au moins 80 mots ;
 *  - L-2 : aucune section ne dépasse 35 % des mots (au moins 4 H2) ou 50 % (en dessous),
 *          sauf guide pilier et actualité ;
 *  - L-3 : part des 5-grammes de la section la plus courte retrouvée dans l'autre < 0,20.
 * Module pur.
 */

import type { Correction } from "./commun";
import {
  compterMotsContenu,
  normaliserTitre,
  type Gabarit,
  type TypeSection,
} from "./structure-hn";

const sansBalises = (h: string) =>
  h
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function decouper(body: string): string[] {
  const pos = [...body.matchAll(/<h2[\s>]/gi)].map((m) => m.index ?? 0);
  return pos.map((d, i) => body.slice(d, pos[i + 1] ?? body.length));
}

function cinqGrammes(texte: string): Set<string> {
  const m = normaliserTitre(texte).split(" ").filter(Boolean);
  const s = new Set<string>();
  for (let i = 0; i + 5 <= m.length; i++) s.add(m.slice(i, i + 5).join(" "));
  return s;
}

export function mesurerEquilibre(
  bodyHtml: string,
  types: ReadonlyArray<TypeSection>,
  gabarit: Gabarit,
): Correction[] {
  const sections = decouper(bodyHtml).map((s) =>
    sansBalises(s.replace(/<h2[^>]*>[\s\S]*?<\/h2>/i, "")),
  );
  const mots = sections.map(compterMotsContenu);
  const total = mots.reduce((a, b) => a + b, 0);
  const pb: Correction[] = [];

  sections.forEach((_, i) => {
    const t = types[i] ?? "informatif";
    if ((t === "informatif" || t === "phase") && mots[i]! < 80) {
      pb.push({
        section: i,
        probleme: "section_trop_courte",
        attendu: "Au moins 80 mots (réponse complète à la question du titre)",
      });
    }
  });

  if (gabarit !== "guide-pilier" && gabarit !== "actualite" && total > 0) {
    const seuil = sections.length >= 4 ? 0.35 : 0.5;
    mots.forEach((n, i) => {
      if (n / total > seuil) {
        pb.push({
          section: i,
          probleme: "section_dominante",
          attendu: `Pas plus de ${Math.round(seuil * 100)} % des mots de l'article`,
        });
      }
    });
  }

  const grammes = sections.map(cinqGrammes);
  for (let a = 0; a < sections.length; a++) {
    for (let b = a + 1; b < sections.length; b++) {
      const [courte, longue] = mots[a]! <= mots[b]! ? [a, b] : [b, a];
      const g = grammes[courte]!;
      if (g.size === 0) continue;
      let communs = 0;
      for (const x of g) if (grammes[longue]!.has(x)) communs++;
      if (communs / g.size >= 0.2) {
        pb.push({
          section: courte,
          probleme: "redite",
          attendu: `Reprend la section ${longue} : dire autre chose ou fusionner`,
        });
      }
    }
  }
  return pb;
}
