/**
 * Le « squelette » du questionnaire déposé, lu dans son HTML (2026-10-27) — module PUR.
 *
 * Besoin : dire, pour chaque parcours (dirigeant, collaborateur, référent informatique), quelles
 * questions une personne voit SANS cliquer sur « Aller plus loin » (les questions « essentielles »),
 * afin de calculer un taux de réponse honnête. L'ancien calcul divisait par tous les identifiants
 * du fichier, tous parcours et tous niveaux confondus.
 *
 * Le HTML de Will est du JavaScript, pas du JSON : on le lit avec un petit lecteur qui saute les
 * chaînes, les commentaires et les expressions régulières littérales. Ce qu'il ne sait pas
 * analyser (expression calculée, assistant à paramètres…) est COMPTÉ (`nonAnalysables`) et rend le
 * taux « estimé » ; jamais deviné. Toute exception rend `null` : l'appelant n'affiche pas de taux.
 *
 * Lecture seule, aucune base, aucun journal.
 */

export type ParcoursSquelette = "main" | "emp" | "it";

export interface SqueletteParcours {
  /** Questions sans condition, vues sans « Aller plus loin » (tout le parcours pour le référent). */
  readonly essentielles: ReadonlySet<string>;
  /** Même niveau, mais n'apparaissent que selon une réponse (clé `show`). */
  readonly essentiellesConditionnelles: ReadonlySet<string>;
  /** Toutes les questions du parcours, tous niveaux. */
  readonly toutes: ReadonlySet<string>;
  /** Éléments que le lecteur n'a pas su analyser : le taux est alors une estimation. */
  readonly nonAnalysables: number;
}

export interface Squelette {
  readonly parcours: Readonly<Record<ParcoursSquelette, SqueletteParcours>>;
  /** Vrai si la liste des questions de niveau 1 (`LVL1`) a été trouvée dans le fichier. */
  readonly niveauxConnus: boolean;
}

const PARCOURS: ReadonlyArray<ParcoursSquelette> = ["main", "emp", "it"];
const PROFONDEUR_MAX_ASSISTANTS = 3;

// ── Lecteur de blocs ────────────────────────────────────────────────────────

const AVANT_REGEX = new Set(["(", ",", "=", ":", "[", "!", "&", "|", "?", "{", "}", ";", ">"]);

/** Dernier caractère non blanc avant `k` (ou `""`). */
function dernierNonBlanc(s: string, k: number): { c: string; pos: number } {
  for (let p = k - 1; p >= 0; p--) {
    const c = s[p] as string;
    if (!/\s/.test(c)) return { c, pos: p };
  }
  return { c: "", pos: -1 };
}

function estDebutDeRegex(s: string, k: number): boolean {
  const n = s[k + 1];
  if (n === "/" || n === "*") return false;
  const { c, pos } = dernierNonBlanc(s, k);
  if (c === "") return true;
  if (AVANT_REGEX.has(c)) return true;
  // Le mot « return » (ou « typeof ») juste avant.
  const mot = /([A-Za-z_$][\w$]*)$/.exec(s.slice(Math.max(0, pos - 12), pos + 1));
  return mot !== null && (mot[1] === "return" || mot[1] === "typeof");
}

/**
 * Si `s[k]` ouvre une chaîne, un modèle, un commentaire ou une regex littérale, rend l'indice de
 * son DERNIER caractère ; sinon `-1`. Une construction non fermée rend la fin du texte.
 */
function sauter(s: string, k: number): number {
  const c = s[k];
  if (c === '"' || c === "'") {
    let i = k + 1;
    while (i < s.length && s[i] !== c) {
      if (s[i] === "\\") i++;
      i++;
    }
    return Math.min(i, s.length - 1);
  }
  if (c === "`") {
    let i = k + 1;
    while (i < s.length && s[i] !== "`") {
      if (s[i] === "\\") {
        i += 2;
        continue;
      }
      if (s[i] === "$" && s[i + 1] === "{") {
        const f = finDuBloc(s, i + 1);
        if (f === -1) return s.length - 1;
        i = f + 1;
        continue;
      }
      i++;
    }
    return Math.min(i, s.length - 1);
  }
  if (c === "/" && s[k + 1] === "/") {
    const f = s.indexOf("\n", k);
    return f === -1 ? s.length - 1 : f;
  }
  if (c === "/" && s[k + 1] === "*") {
    const f = s.indexOf("*/", k + 2);
    return f === -1 ? s.length - 1 : f + 1;
  }
  if (c === "/" && estDebutDeRegex(s, k)) {
    let i = k + 1;
    let classe = false;
    while (i < s.length) {
      const d = s[i];
      if (d === "\\") {
        i += 2;
        continue;
      }
      if (d === "\n") return k; // pas une regex : on ne saute rien de plus
      if (d === "[") classe = true;
      else if (d === "]") classe = false;
      else if (d === "/" && !classe) return i;
      i++;
    }
    return k;
  }
  return -1;
}

/** Indice du `] ) }` qui ferme l'ouvrant placé en `i`, ou `-1`. */
export function finDuBloc(s: string, i: number): number {
  let profondeur = 0;
  for (let k = i; k < s.length; k++) {
    const saut = sauter(s, k);
    if (saut !== -1) {
      k = saut;
      continue;
    }
    const c = s[k];
    if (c === "[" || c === "(" || c === "{") profondeur++;
    else if (c === "]" || c === ")" || c === "}") {
      profondeur--;
      if (profondeur === 0) return k;
    }
  }
  return -1;
}

// Retire les commentaires de bloc et de ligne placés en tête d'un élément.
function sansCommentairesEnTete(e: string): string {
  let t = e.trim();
  for (;;) {
    if (t.startsWith("/*")) {
      const f = t.indexOf("*/", 2);
      if (f === -1) return "";
      t = t.slice(f + 2).trim();
    } else if (t.startsWith("//")) {
      const f = t.indexOf("\n");
      if (f === -1) return "";
      t = t.slice(f + 1).trim();
    } else return t;
  }
}

/** Découpe un corps aux virgules de profondeur 0 (éléments vides ignorés, commentaires de tête ôtés). */
export function elementsDeNiveau1(corps: string): string[] {
  const out: string[] = [];
  let profondeur = 0;
  let debut = 0;
  for (let k = 0; k < corps.length; k++) {
    const saut = sauter(corps, k);
    if (saut !== -1) {
      k = saut;
      continue;
    }
    const c = corps[k];
    if (c === "[" || c === "(" || c === "{") profondeur++;
    else if (c === "]" || c === ")" || c === "}") profondeur--;
    else if (c === "," && profondeur === 0) {
      out.push(corps.slice(debut, k).trim());
      debut = k + 1;
    }
  }
  out.push(corps.slice(debut).trim());
  return out.map(sansCommentairesEnTete).filter((e) => e !== "");
}

/** Premier `car` de profondeur 0 (hors chaînes et commentaires), ou `-1`. */
function premierADeProfondeurZero(s: string, car: string): number {
  let profondeur = 0;
  for (let k = 0; k < s.length; k++) {
    const saut = sauter(s, k);
    if (saut !== -1) {
      k = saut;
      continue;
    }
    const c = s[k];
    if (c === "[" || c === "(" || c === "{") profondeur++;
    else if (c === "]" || c === ")" || c === "}") profondeur--;
    else if (c === car && profondeur === 0) return k;
  }
  return -1;
}

// ── Lecture du fichier ──────────────────────────────────────────────────────

type Assistants = Map<string, string>;

function assistantsDuHtml(html: string): Assistants {
  const out: Assistants = new Map();
  for (const re of [/const ([A-Za-z0-9_]+) = \(\) => \[/g, /const ([A-Za-z0-9_]+) = \[/g]) {
    for (const m of html.matchAll(re)) {
      const nom = m[1] as string;
      if (out.has(nom)) continue; // la première définition gagne
      const ouvrant = m.index + m[0].length - 1;
      const fin = finDuBloc(html, ouvrant);
      if (fin === -1) continue;
      out.set(nom, html.slice(ouvrant + 1, fin));
    }
  }
  return out;
}

function niveau1DuHtml(html: string): ReadonlySet<string> | null {
  const m = /const LVL1\s*=\s*new Set\(\[([\s\S]*?)\]\)/.exec(html);
  if (m === null) return null;
  return new Set([...(m[1] as string).matchAll(/["']([^"']+)["']/g)].map((x) => x[1] as string));
}

interface Section {
  id: string | null;
  only: string | null;
  it: boolean;
  lvl: number | null;
  corps: string;
}

/** Valeur littérale d'une clé d'objet : `cle: valeur`. */
function valeurDeLaCle(element: string, cle: string): string | null {
  const m = new RegExp(String.raw`^${cle}\s*:\s*([\s\S]*)$`).exec(element);
  return m === null ? null : (m[1] as string).trim();
}

function texteLitteral(v: string | null): string | null {
  if (v === null) return null;
  const m = /^["']([^"']*)["']$/.exec(v);
  return m === null ? null : (m[1] as string);
}

function lireSection(element: string): Section | null {
  if (!element.startsWith("{")) return null;
  const fin = finDuBloc(element, 0);
  if (fin === -1) return null;
  const sec: Section = { id: null, only: null, it: false, lvl: null, corps: "" };
  for (const e of elementsDeNiveau1(element.slice(1, fin))) {
    const id = texteLitteral(valeurDeLaCle(e, "id"));
    if (id !== null) sec.id = id;
    const only = texteLitteral(valeurDeLaCle(e, "only"));
    if (only !== null) sec.only = only;
    const it = valeurDeLaCle(e, "it");
    if (it !== null && (it === "true" || it === "1")) sec.it = true;
    const lvl = valeurDeLaCle(e, "lvl");
    if (lvl !== null && /^\d$/.test(lvl)) sec.lvl = Number(lvl);
    const fields = valeurDeLaCle(e, "fields");
    if (fields !== null && fields.startsWith("[")) {
      const f = finDuBloc(fields, 0);
      if (f !== -1) sec.corps = fields.slice(1, f);
    }
  }
  return sec;
}

interface ChampLu {
  readonly conditionnel: boolean;
  readonly niveau: number;
}

const TYPES_IGNORES: ReadonlySet<string> = new Set(["head", "deleg", "calc", "day"]);

/** Clé présente dans un objet d'options : `cle: …`, `cle(…)` ou forme courte `cle`. */
function aLaCle(options: ReadonlyArray<string>, cle: string): boolean {
  return options.some((x) => x === cle || new RegExp(String.raw`^${cle}\s*[:(]`).test(x));
}

function analyserChamps(
  corps: string,
  mode: ParcoursSquelette,
  sec: Section,
  niveau1: ReadonlySet<string> | null,
  assistants: Assistants,
  sortie: Map<string, ChampLu>,
  compteur: { n: number },
  profondeur: number,
): void {
  for (const e of elementsDeNiveau1(corps)) {
    if (e.startsWith("...")) {
      suivreSpread(e.slice(3).trim(), mode, sec, niveau1, assistants, sortie, compteur, profondeur);
      continue;
    }
    const appel = /^F\(\s*"([a-z_]+)"\s*,\s*(.*)$/s.exec(e);
    if (appel === null) {
      compteur.n++;
      continue;
    }
    const type = appel[1] as string;
    if (TYPES_IGNORES.has(type)) continue;
    const fin = finDuBloc(e, 1);
    if (fin === -1) {
      compteur.n++;
      continue;
    }
    const args = elementsDeNiveau1(e.slice(2, fin));
    const id = texteLitteral((args[1] ?? "").trim());
    if (id === null || !/^[A-Za-z0-9_]+$/.test(id)) {
      compteur.n++;
      continue;
    }
    const brutOptions = (args[3] ?? "").trim();
    let options: string[] = [];
    if (brutOptions.startsWith("{")) {
      const f = finDuBloc(brutOptions, 0);
      if (f !== -1) options = elementsDeNiveau1(brutOptions.slice(1, f));
    }
    let only: string | null = null;
    for (const o of options) {
      const v = texteLitteral(valeurDeLaCle(o, "only"));
      if (v !== null) only = v;
    }
    if (only !== null && only !== mode) continue;
    if (sortie.has(id)) continue; // le premier id gagne
    const lvl3 = aLaCle(options, "lvl3");
    const niveau = niveau1?.has(id)
      ? 1
      : only === "it" || lvl3
        ? 3
        : (sec.lvl ?? 2);
    sortie.set(id, { conditionnel: aLaCle(options, "show"), niveau });
  }
}

function suivreSpread(
  r: string,
  mode: ParcoursSquelette,
  sec: Section,
  niveau1: ReadonlySet<string> | null,
  assistants: Assistants,
  sortie: Map<string, ChampLu>,
  compteur: { n: number },
  profondeur: number,
): void {
  // ...(MODE === "x" ? [A] : [B])
  const ternaire = /^\(\s*MODE\s*===\s*"([a-z]+)"\s*\?/.exec(r);
  if (ternaire !== null && r.startsWith("(")) {
    const fin = finDuBloc(r, 0);
    if (fin === r.length - 1) {
      const interieur = r.slice(1, fin);
      const q = premierADeProfondeurZero(interieur, "?");
      const reste = interieur.slice(q + 1).trim();
      if (q !== -1 && reste.startsWith("[")) {
        const a = finDuBloc(reste, 0);
        const apres = a === -1 ? "" : reste.slice(a + 1).trim();
        if (a !== -1 && apres.startsWith(":")) {
          const b = apres.slice(1).trim();
          const finB = b.startsWith("[") ? finDuBloc(b, 0) : -1;
          if (finB !== -1) {
            const branche = ternaire[1] === mode ? reste.slice(1, a) : b.slice(1, finB);
            analyserChamps(branche, mode, sec, niveau1, assistants, sortie, compteur, profondeur);
            return;
          }
        }
      }
    }
    compteur.n++;
    return;
  }
  const nom = /^([A-Za-z0-9_]+)(\(\))?$/.exec(r);
  if (nom !== null && assistants.has(nom[1] as string) && profondeur < PROFONDEUR_MAX_ASSISTANTS) {
    analyserChamps(
      assistants.get(nom[1] as string) as string,
      mode,
      sec,
      niveau1,
      assistants,
      sortie,
      compteur,
      profondeur + 1,
    );
    return;
  }
  compteur.n++;
}

/**
 * Le squelette du questionnaire contenu dans ce HTML, ou `null` si `SECTIONS` est introuvable ou
 * si la lecture échoue (aucun taux n'est alors affiché).
 */
export function squeletteDuHtml(html: string): Squelette | null {
  try {
    const depart = html.indexOf("const SECTIONS = [");
    if (depart === -1) return null;
    const ouvrant = depart + "const SECTIONS = ".length;
    const fin = finDuBloc(html, ouvrant);
    if (fin === -1) return null;
    const niveau1 = niveau1DuHtml(html);
    const assistants = assistantsDuHtml(html);
    const sections = elementsDeNiveau1(html.slice(ouvrant + 1, fin))
      .map(lireSection)
      .filter((s): s is Section => s !== null && s.id !== "send");

    const parcours = {} as Record<ParcoursSquelette, SqueletteParcours>;
    for (const mode of PARCOURS) {
      const champs = new Map<string, ChampLu>();
      const compteur = { n: 0 };
      for (const sec of sections) {
        const visible = mode === "it" ? sec.it || sec.only === "it" : !sec.only || sec.only === mode;
        if (!visible) continue;
        analyserChamps(sec.corps, mode, sec, niveau1, assistants, champs, compteur, 0);
      }
      const essentielles = new Set<string>();
      const conditionnelles = new Set<string>();
      for (const [id, c] of champs) {
        if (mode !== "it" && c.niveau !== 1) continue;
        (c.conditionnel ? conditionnelles : essentielles).add(id);
      }
      parcours[mode] = {
        essentielles,
        essentiellesConditionnelles: conditionnelles,
        toutes: new Set(champs.keys()),
        nonAnalysables: compteur.n,
      };
    }
    return { parcours, niveauxConnus: niveau1 !== null };
  } catch {
    return null;
  }
}

// ── Taux de réponses ────────────────────────────────────────────────────────

/**
 * Une valeur « remplie » POUR LA PAGE : texte non vide, nombre fini, case cochée, liste avec au
 * moins un élément rempli, objet avec au moins une valeur remplie en IGNORANT `id` et les clés
 * `_…` (une ligne d'équipe réduite à son code n'est pas une réponse).
 */
export function estRempliePourLaPage(v: unknown): boolean {
  if (v === null || v === undefined || v === false) return false;
  if (typeof v === "string") return v.trim() !== "";
  if (typeof v === "number") return Number.isFinite(v);
  if (v === true) return true;
  if (Array.isArray(v)) return v.some(estRempliePourLaPage);
  if (typeof v === "object") {
    return Object.entries(v as Record<string, unknown>).some(
      ([k, x]) => k !== "id" && !k.startsWith("_") && estRempliePourLaPage(x),
    );
  }
  return false;
}

export interface TauxDeReponses {
  readonly essentiellesRemplies: number;
  readonly essentiellesTotal: number;
  /** `null` : pas de squelette ou aucune question essentielle. 99 tant qu'il en manque une. */
  readonly pourcentage: number | null;
  /** Questions remplies en dehors des essentielles (niveaux 2 et 3, conditionnelles non comptées). */
  readonly reponsesEnPlus: number;
  /** Vrai si le fichier n'a pas été lu en entier : le chiffre est une estimation. */
  readonly estimation: boolean;
}

/**
 * Le taux de réponses d'une personne. `valeurs` : les réponses (champ → valeur) ; `exclus` : champs
 * préremplis par Axion IA (`pre` du brouillon), qui ne sont pas des réponses de la personne. Une
 * essentielle conditionnelle compte, au numérateur ET au dénominateur, seulement si elle est
 * remplie. Rien du contenu n'est gardé ni rendu : seulement des comptes.
 */
export function tauxDeReponses(
  valeurs: Readonly<Record<string, unknown>>,
  sq: Squelette | null,
  mode: ParcoursSquelette,
  exclus: ReadonlySet<string> = new Set(),
): TauxDeReponses {
  if (sq === null) {
    return {
      essentiellesRemplies: 0,
      essentiellesTotal: 0,
      pourcentage: null,
      reponsesEnPlus: 0,
      estimation: true,
    };
  }
  const p = sq.parcours[mode];
  const remplie = (id: string): boolean =>
    !id.startsWith("_") && !exclus.has(id) && estRempliePourLaPage(valeurs[id]);
  let remplies = 0;
  for (const id of p.essentielles) if (remplie(id)) remplies++;
  let total = p.essentielles.size;
  for (const id of p.essentiellesConditionnelles) {
    if (remplie(id)) {
      remplies++;
      total++;
    }
  }
  let enPlus = 0;
  for (const id of p.toutes) {
    if (p.essentielles.has(id) || p.essentiellesConditionnelles.has(id)) continue;
    if (remplie(id)) enPlus++;
  }
  const pourcentage =
    total === 0 ? null : remplies < total ? Math.min(99, Math.round((100 * remplies) / total)) : 100;
  return {
    essentiellesRemplies: remplies,
    essentiellesTotal: total,
    pourcentage,
    reponsesEnPlus: enPlus,
    estimation: p.nonAnalysables > 0 || !sq.niveauxConnus,
  };
}
