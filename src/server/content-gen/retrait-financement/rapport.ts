/**
 * Retrait des mentions de financement — RAPPORT lisible (pur, sans base de données).
 *
 * Pour CHAQUE modification : le passage retiré, ~150 caractères de contexte avant et après, et le
 * texte de remplacement. Un diff par phrase, dans le corps HTML, le texte, le JSON Tiptap et les
 * FAQ (question / réponse concernées). Le rapport ne montre que des textes publics.
 */
import { htmlVersBlocs, blocsTexteJson, blocsDeSection } from "./regles";
import type { Proposition } from "./plan";
import { ambigusNonCouverts, gabaritOverrides, resume } from "./plan";

export const CONTEXTE_CARACTERES = 150;
const RETIRE_MAX = 800;

interface Bloc {
  /** Où se trouve le bloc (« question n°2 », « réponse n°2 », « JSON »…). */
  etiquette: string;
  texte: string;
}

const ressembleAHtml = (s: string): boolean => /<[a-z][\s\S]*>/i.test(s);

function blocsChaine(s: string, etiquette: string): Bloc[] {
  const textes = ressembleAHtml(s)
    ? htmlVersBlocs(s)
    : s
        .split(/\n+/)
        .map((x) => x.replace(/\s+/g, " ").trim())
        .filter((x) => x !== "");
  return textes.map((texte) => ({ etiquette, texte }));
}

function estQuestionReponse(o: unknown): o is { question: string; answer: string } {
  if (!o || typeof o !== "object") return false;
  const r = o as Record<string, unknown>;
  return typeof r.question === "string" && typeof r.answer === "string";
}

/** Découpe une valeur de champ (texte, HTML, JSON Tiptap, faqJson…) en blocs de texte. */
export function blocsDe(valeur: unknown, etiquette = ""): Bloc[] {
  if (valeur === null || valeur === undefined) return [];
  if (typeof valeur === "string") {
    const t = valeur.trim();
    if (t.startsWith("{") || t.startsWith("[")) {
      const json = blocsTexteJson(valeur);
      if (json.length > 0) return json.map((texte) => ({ etiquette: "JSON", texte }));
    }
    return blocsChaine(valeur, etiquette);
  }
  if (typeof valeur !== "object") return [{ etiquette, texte: String(valeur) }];
  if (Array.isArray(valeur) && valeur.some(estQuestionReponse)) {
    const blocs: Bloc[] = [];
    valeur.forEach((it, i) => {
      if (estQuestionReponse(it)) {
        blocs.push(...blocsChaine(it.question, `question n°${i + 1}`));
        blocs.push(...blocsChaine(it.answer, `réponse n°${i + 1}`));
      } else blocs.push(...blocsDe(it, `élément n°${i + 1}`));
    });
    return blocs;
  }
  const json = blocsTexteJson(valeur);
  if (json.length > 0) return json.map((texte) => ({ etiquette: "JSON", texte }));
  const blocs: Bloc[] = [];
  const marcher = (v: unknown, chemin: string): void => {
    if (typeof v === "string") blocs.push(...blocsChaine(v, chemin));
    else if (Array.isArray(v)) v.forEach((x, i) => marcher(x, `${chemin}[${i}]`));
    else if (v && typeof v === "object")
      for (const [k, x] of Object.entries(v)) marcher(x, chemin ? `${chemin}.${k}` : k);
  };
  marcher(valeur, etiquette);
  return blocs;
}

/** Plus longue sous-suite commune : indices des éléments communs (a[i] ≡ b[j]). */
function appariements(a: readonly string[], b: readonly string[]): Array<[number, number]> {
  const n = a.length;
  const m = b.length;
  if (n * m > 4_000_000) return [];
  const t: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      t[i]![j] = a[i] === b[j] ? t[i + 1]![j + 1]! + 1 : Math.max(t[i + 1]![j]!, t[i]![j + 1]!);
  const paires: Array<[number, number]> = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      paires.push([i, j]);
      i++;
      j++;
    } else if (t[i + 1]![j]! >= t[i]![j + 1]!) i++;
    else j++;
  }
  return paires;
}

/** Groupes de différences : [début avant, fin avant, début après, fin après[. */
function groupes(
  a: readonly string[],
  b: readonly string[],
): Array<[number, number, number, number]> {
  const paires = appariements(a, b);
  const out: Array<[number, number, number, number]> = [];
  let i = 0;
  let j = 0;
  for (const [pi, pj] of [...paires, [a.length, b.length] as [number, number]]) {
    if (pi > i || pj > j) out.push([i, pi, j, pj]);
    i = pi + 1;
    j = pj + 1;
  }
  return out;
}

interface PhraseSituee {
  texte: string;
  debut: number;
}

function phrasesSituees(texte: string, debutBloc: number): PhraseSituee[] {
  const morceaux = texte.split(/(?<=[.!?…])\s+/).filter((x) => x !== "");
  const sortie: PhraseSituee[] = [];
  let curseur = 0;
  for (const m of morceaux) {
    const pos = texte.indexOf(m, curseur);
    sortie.push({ texte: m, debut: debutBloc + (pos < 0 ? curseur : pos) });
    curseur = (pos < 0 ? curseur : pos) + m.length;
  }
  return sortie;
}

const estLettre = (c: string | undefined): boolean => !!c && /[\p{L}\p{N}]/u.test(c);

export interface Passage {
  etiquette: string;
  avantContexte: string;
  retire: string;
  remplace: string;
  apresContexte: string;
}

/** Retire le préfixe et le suffixe communs (sur des frontières de mots) : reste le passage modifié. */
function reduire(
  retire: string,
  ajoute: string,
): { debut: number; retire: string; ajoute: string } {
  let p = 0;
  const max = Math.min(retire.length, ajoute.length);
  while (p < max && retire[p] === ajoute[p]) p++;
  while (p > 0 && estLettre(retire[p - 1]) && (estLettre(retire[p]) || estLettre(ajoute[p]))) p--;
  let s = 0;
  while (s < max - p && retire[retire.length - 1 - s] === ajoute[ajoute.length - 1 - s]) s++;
  while (s > 0 && estLettre(retire[retire.length - s]) && estLettre(retire[retire.length - s - 1]))
    s--;
  return {
    debut: p,
    retire: retire.slice(p, retire.length - s),
    ajoute: ajoute.slice(p, ajoute.length - s),
  };
}

/** Passages modifiés entre deux valeurs : diff par bloc, puis par phrase, puis par fragment. */
export function passagesModifies(avant: unknown, apres: unknown): Passage[] {
  const ba = blocsDe(avant);
  const bb = blocsDe(apres);
  const plat = ba.map((b) => b.texte).join("\n");
  const debuts: number[] = [];
  let pos = 0;
  for (const b of ba) {
    debuts.push(pos);
    pos += b.texte.length + 1;
  }
  const passages: Passage[] = [];
  for (const [i0, i1, j0, j1] of groupes(
    ba.map((b) => b.texte),
    bb.map((b) => b.texte),
  )) {
    const sa = ba.slice(i0, i1).flatMap((b, k) => phrasesSituees(b.texte, debuts[i0 + k]!));
    const sb = bb.slice(j0, j1).flatMap((b) => phrasesSituees(b.texte, 0));
    const etiquette = [
      ...new Set(
        [...ba.slice(i0, i1), ...bb.slice(j0, j1)].map((b) => b.etiquette).filter((x) => x !== ""),
      ),
    ].join(", ");
    for (const [a0, a1, b0, b1] of groupes(
      sa.map((x) => x.texte),
      sb.map((x) => x.texte),
    )) {
      const avantSeg = sa.slice(a0, a1);
      const debutRetire = avantSeg[0]?.debut ?? debuts[i1] ?? plat.length;
      const retireBrut =
        avantSeg.length > 0
          ? plat.slice(
              debutRetire,
              avantSeg[avantSeg.length - 1]!.debut + avantSeg[avantSeg.length - 1]!.texte.length,
            )
          : "";
      const ajouteBrut = sb
        .slice(b0, b1)
        .map((x) => x.texte)
        .join(" ");
      // Texte réécrit qui garde l'essentiel (≥ 30 caractères communs) : seul le fragment modifié
      // est montré ; un remplacement complet (phrase standard) est montré en entier.
      const entier = retireBrut.replace(/\n/g, " ");
      const reduit = ajouteBrut === "" ? null : reduire(entier, ajouteBrut);
      const r =
        reduit && entier.length - reduit.retire.length >= 30
          ? reduit
          : { debut: 0, retire: entier, ajoute: ajouteBrut };
      // A9 : un « retiré » et un « remplacé par » qui ne diffèrent que par des espaces est un faux signal.
      if (r.retire.replace(/\s+/g, "") === r.ajoute.replace(/\s+/g, "")) continue;
      const debut = debutRetire + r.debut;
      const apresPos = debut + r.retire.length;
      const ctx = (s: string) => s.replace(/\n/g, " ¶ ").trim();
      const c = CONTEXTE_CARACTERES;
      passages.push({
        etiquette,
        avantContexte: ctx(plat.slice(Math.max(0, debut - c), debut)),
        retire: r.retire.trim(),
        remplace: r.ajoute.trim(),
        apresContexte: ctx(plat.slice(apresPos, apresPos + c)),
      });
    }
  }
  return passages;
}

const coupe = (s: string, max: number): string => (s.length > max ? `${s.slice(0, max)}…` : s);

const STATUTS: Record<string, string> = {
  published: "publiée",
  archived: "archivée",
  draft: "brouillon",
};
const libelleStatut = (v: unknown): string => STATUTS[String(v)] ?? String(v);

/** Lignes Markdown du rapport pour un champ modifié. */
export function lignesModification(
  cle: string,
  champ: string,
  avant: unknown,
  apres: unknown,
): string[] {
  if (champ === "status")
    return [`- \`${cle}\` · statut : ${libelleStatut(avant)} → ${libelleStatut(apres)}`];
  const passages = passagesModifies(avant, apres);
  if (passages.length === 0) {
    // Espaces seuls (A9) : rien à relire, rien à afficher.
    const t = (v: unknown): string =>
      blocsDe(v)
        .map((b) => b.texte.replace(/\s+/g, ""))
        .join("");
    return t(avant) === t(apres)
      ? []
      : [`- \`${cle}\` · ${champ} : modifié (aucune différence de texte visible)`];
  }
  const lignes: string[] = [];
  for (const p of passages) {
    lignes.push(`- \`${cle}\` · ${champ}${p.etiquette ? ` (${p.etiquette})` : ""}`);
    lignes.push(`  - contexte avant : « …${p.avantContexte} »`);
    lignes.push(`  - retiré : « ${coupe(p.retire, RETIRE_MAX)} »`);
    lignes.push(
      `  - remplacé par : ${p.remplace === "" ? "(rien)" : `« ${coupe(p.remplace, RETIRE_MAX)} »`}`,
    );
    lignes.push(`  - contexte après : « ${p.apresContexte}… »`);
  }
  return lignes;
}

/** Passage ambigu COMPLET : le bloc de texte qui contient l'extrait cité, sinon tout le champ. */
function texteComplet(valeur: unknown, message: string): string[] {
  // Ambigu de SECTION : seule la section est imprimée, jamais l'article entier (A9).
  const titre = /^(?:section|titre H\d)\s*«\s*([^»]+?)\s*»/.exec(message)?.[1];
  if (titre && typeof valeur === "string" && /<h[2-4][\s>]/i.test(valeur)) {
    const sec = blocsDeSection(valeur, titre);
    if (sec.length > 0) return sec;
  }
  const blocs = blocsDe(valeur).map((b) => b.texte);
  const cite = /«\s*([\s\S]*?)\s*(?:»|…)?\s*$/.exec(message)?.[1]?.replace(/…$/, "") ?? "";
  const amorce = cite.slice(0, 60);
  const trouves = amorce.length >= 8 ? blocs.filter((b) => b.includes(amorce)) : [];
  return trouves.length > 0 ? trouves : blocs;
}

/** Section des ambigus : identifiant, champ, texte complet, puis gabarit d'overrides. */
function sectionAmbigus(propositions: readonly Proposition[]): string[] {
  const restants = ambigusNonCouverts(propositions);
  const l = [
    "",
    "## Cas ambigus (à trancher dans `retrait-financement-overrides.json`)",
    "",
    restants.length === 0
      ? "Aucun ambigu restant : `--apply` est possible."
      : `⛔ ${restants.length} ambigu(s) non couvert(s) : \`--apply\` est REFUSÉ tant qu'il en reste.`,
  ];
  for (const a of restants) {
    const p = propositions.find((x) => x.cle === a.cle);
    l.push("", `- identifiant \`${a.cle}\` · champ \`${a.champ}\` : ${a.message}`);
    l.push("  - texte complet du passage :");
    for (const t of texteComplet(p?.avant[a.champ], a.message)) l.push(`    > ${t}`);
  }
  if (restants.length > 0) {
    l.push(
      "",
      "Gabarit à copier dans `scripts/content-gen/retrait-financement-overrides.json` (`valeur` = texte FINAL du champ, à écrire ; une valeur vide est ignorée) :",
      "",
      "```json",
      JSON.stringify(gabaritOverrides(propositions), null, 2),
      "```",
    );
  }
  return l;
}

/** Rapport complet de l'essai à blanc / de l'application. */
export function construireRapport(
  mode: string,
  propositions: readonly Proposition[],
  ignores: readonly string[],
  sha: string,
): string {
  const l: string[] = [
    `# Retrait des mentions de financement — ${mode}`,
    "",
    `Empreinte du plan : \`${sha}\``,
    "",
  ];
  const r = resume(propositions);
  l.push(
    `Contenus concernés : ${r.total} · à réécrire : ${r.a_reecrire}${r.partiels > 0 ? ` + ${r.partiels} partiels` : ""} · ambigus : ${r.ambigus}`,
    "",
  );
  l.push("## Modifications (passage retiré, contexte, remplacement)");
  for (const x of propositions)
    for (const c of Object.keys(x.apres))
      l.push(...lignesModification(x.cle, c, x.avant[c], x.apres[c]));
  l.push("", "## Règles ciblées appliquées (fragments, décomptes, cellules, questions)");
  for (const x of propositions) for (const g of x.regles ?? []) l.push(`- \`${x.cle}\` · ${g}`);
  l.push(...sectionAmbigus(propositions));
  const avecPertes = propositions.filter((x) => Object.keys(x.pertes ?? {}).length > 0);
  if (avecPertes.length > 0) {
    l.push("", "## Pertes acceptées par les overrides (mots non financiers, relues par un humain)");
    for (const x of avecPertes)
      for (const [c, mots] of Object.entries(x.pertes ?? {}))
        l.push(`- \`${x.cle}\` · ${c} : ${mots.join(", ")}`);
  }
  const conserves = propositions.filter(
    (x) => Object.keys(x.conservesSurDecision ?? {}).length > 0,
  );
  if (conserves.length > 0) {
    l.push(
      "",
      "## Conservés sur décision du dirigeant",
      "",
      "Champs laissés TELS QUELS : la porte 2 y refuse un terme sans rapport avec le financement de la formation (entrée `admis` du fichier d'overrides). Rien n'est écrit pour eux. Sous chaque champ : les phrases qui restent en ligne.",
      "",
    );
    for (const x of conserves)
      for (const [c, termes] of Object.entries(x.conservesSurDecision ?? {})) {
        l.push(`- \`${x.cle}\` · ${c} : termes admis : ${termes.join(", ")}`);
        // Les PHRASES qui restent en ligne, une par ligne : un terme admis couvre toutes celles du champ.
        for (const phrase of x.phrasesConservees?.[c] ?? [])
          l.push(`  - phrase conservée — ${phrase}`);
      }
  }
  l.push("", "## « prise en charge » conservées (hors financement)");
  for (const x of propositions) for (const c of x.conserves) l.push(`- \`${x.cle}\` : ${c}`);
  if (ignores.length > 0) l.push("", "## Overrides ignorés", ...ignores.map((i) => `- ${i}`));
  l.push(
    "",
    "## Hors périmètre (listés, non traités)",
    "- texte dans les images ; titres d'ExternalReference ; slugs contenant « opco » / « certification » (inchangés).",
  );
  return `${l.join("\n")}\n`;
}
