/**
 * Retrait des mentions de financement (blog + offres d'emploi) — règles PURES.
 *
 * Décision du fondateur (18/11/2026) : Axion-IA ne propose ni OPCO, ni CPF, ni France Travail,
 * ni Qualiopi. On MODIFIE les textes publiés (jamais de suppression), même URL.
 * Plan : `geo/PLAN-RETRAIT-FINANCEMENT.md` (dépôt axion-plans-prive).
 *
 * Ce fichier ne touche ni à la base, ni au réseau, ni à l'IA : texte entrant, texte sortant.
 * Il est IDEMPOTENT (une deuxième passe ne change rien) et ne réécrit JAMAIS un attribut
 * HTML (href, src, id…) — sauf les deux liens vers les pages retirées (cf. `LIENS_RETIRES`).
 */
import { JSDOM } from "jsdom";

export type Langue = "fr" | "en";

export const PHRASE_FR = "Financement : solutions indiquées au premier échange.";
export const PHRASE_EN = "Funding: options discussed at our first call.";
export const QUESTION_FR = "Comment se passe le financement ?";
export const QUESTION_EN = "How does funding work?";

export function phrase(langue: Langue): string {
  return langue === "en" ? PHRASE_EN : PHRASE_FR;
}
export function question(langue: Langue): string {
  return langue === "en" ? QUESTION_EN : QUESTION_FR;
}

/** Pages retirées du site : un lien vers elles est redirigé vers le catalogue. */
export const LIENS_RETIRES =
  /\/(?:fr|en)\/(?:financement-opco-france-travail|certification-qualiopi)(?=[/?#]|$)/i;

/** Toujours visés, quel que soit le contexte. */
const TOUJOURS: readonly RegExp[] = [
  /\bOPCOs?\b/i,
  /qualiopi/i,
  /datadock/i,
  /\bEDOF\b/,
  /subrogation/i,
  /mon ?compte ?formation/i,
  /FNE[- ]Formation/i,
  /\bAIF\b/,
  /finan[cç]ables?/i,
  // « Axion-IA prépare la certification qualité », « certifié qualité » : même retrait que Qualiopi.
  /certifi(?:cation|[ée]e?s?)\s+qualit[ée]/i,
];

/** Visés seulement avec un marqueur de financement dans la MÊME phrase. */
const CONDITIONNELS: readonly RegExp[] = [
  /\bCPF\b/,
  /France Travail/i,
  /P[ôo]le[- ]emploi/i,
  /compte personnel de formation/i,
  /personal training account/i,
];

const MARQUEUR =
  /financ|[ée]ligible|mobilis|rembours|co[ûu]t|plan de d[ée]veloppement des comp[ée]tences|skills development plan|france comp[ée]tences|\bfund/i;

/** « prise en charge » : visée seulement au sens financier (« prise en charge des appels » reste). */
const PRISE_EN_CHARGE = /pris(?:e|es)? en charge|covered by|taken care of by/i;
/**
 * Marqueurs d'un sens FINANCIER de « prise en charge ». Ni « coût », ni « tarif », ni « € »,
 * ni « gratuit » n'y suffisent : « La prise en charge des appels réduit le coût de 30 % » reste.
 */
const SENS_FINANCIER = new RegExp(
  [
    "financ",
    "\\bfund",
    "OPCO",
    "\\bCPF\\b",
    "France Travail",
    "P[ôo]le[- ]emploi",
    "France Comp[ée]tences",
    "formations? certifiantes?",
    "rembours",
    "reimburs",
    "subrogation",
    "subvention",
    "[ée]ligible",
    "\\beligible",
    "pris(?:e|es)? en charge (?:totale|partielle|financi[èe]re)",
    "(?:totally|fully|partially) covered",
    "pris(?:e|es)? en charge par (?:l'|le |la |les )?(?:organisme|op[ée]rateur|r[ée]gion|[ÉEée]tat|employeur|branche|agefiph|conseil r[ée]gional)",
  ].join("|"),
  "i",
);

/** Titre qui parle de financement (pour ne retirer une section que si elle en parle). */
const TITRE_FINANCEMENT = /financ|\bfund|prise en charge|subvention|rembours/i;

// ───────────────────────────── utilitaires texte ─────────────────────────────

function normaliser(s: string): string {
  return s.replace(/[  ]/g, " ").replace(/[’‘`]/g, "'");
}

let documentPartage: Document | null = null;
function doc(): Document {
  if (!documentPartage) documentPartage = new JSDOM("<!doctype html><body></body>").window.document;
  return documentPartage;
}

/** Texte brut (entités décodées, balises retirées) d'un fragment HTML. */
export function htmlVersTexte(html: string): string {
  const d = doc().createElement("div");
  d.innerHTML = html;
  return (d.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** Une phrase (texte brut) est-elle visée ? */
export function estVisee(texte: string): boolean {
  const t = normaliser(texte);
  if (TOUJOURS.some((r) => r.test(t))) return true;
  if (PRISE_EN_CHARGE.test(t) && SENS_FINANCIER.test(t)) return true;
  if (CONDITIONNELS.some((r) => r.test(t)) && MARQUEUR.test(t)) return true;
  return false;
}

const SIGLES =
  "(?:CPF|OPCOs?|France Travail|P[ôo]le emploi|France Comp[ée]tences|AIF|FNE-Formation|Qualiopi|EDOF)";
const FRAGMENT_PARENTHESE = new RegExp(
  `\\s*\\(\\s*(?:${SIGLES}(?:\\s*(?:,|;|et|ou|/|and|or)\\s*)?)+\\)`,
  "gi",
);
const FRAGMENT_FINANCABLES = /,\s*finan[cç]ables?\s+(?:par|via)\s+(?:les\s+)?OPCOs?\s*,/gi;

/** Retire les fragments qui se suffisent à eux-mêmes : « (CPF, OPCO, France Travail) ». */
function retirerFragments(s: string): string {
  return s.replace(FRAGMENT_PARENTHESE, "").replace(FRAGMENT_FINANCABLES, ",");
}

/** Découpe en phrases sur une chaîne HTML ou texte (la balise fermante après le point est permise). */
function phrases(s: string): string[] {
  return s
    .split(/(?<=[.!?…]|[.!?…]<\/[a-z0-9]+>)\s+(?=(?:<[^>]+>)*[A-ZÀ-ÝÉ«"“0-9])/)
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}

interface Bloc {
  /** Contenu (HTML ou texte) après réécriture. */
  contenu: string;
  modifie: boolean;
  /** Au moins une phrase visée avant réécriture. */
  visee: boolean;
  /** Vide après réécriture : l'élément doit être retiré. */
  vide: boolean;
}

/**
 * Règle d'un paragraphe (ou d'un champ long) :
 * - ≥ la moitié des phrases visées (ou ≥ 2 sur un paragraphe de 4 phrases ou moins), ou ouverture
 *   sur le financement avec au moins une phrase visée → phrase standard ;
 * - sinon retrait des seules phrases visées.
 */
function traiterBloc(contenu: string, langue: Langue, estHtml: boolean): Bloc {
  const sansFragments = retirerFragments(contenu);
  const brut = (x: string) => (estHtml ? htmlVersTexte(x) : x);
  const liste = phrases(sansFragments);
  const marques = liste.map((p) => estVisee(brut(p)));
  const v = marques.filter(Boolean).length;
  if (v === 0) {
    const modifie = sansFragments !== contenu;
    return {
      contenu: modifie ? sansFragments.replace(/\s{2,}/g, " ").trim() : contenu,
      modifie,
      visee: false,
      vide: false,
    };
  }
  const n = liste.length;
  const ouverture = MARQUEUR.test(normaliser(brut(liste[0] ?? "")));
  if (ouverture || v * 2 >= n || (v >= 2 && n <= 4)) {
    return { contenu: phrase(langue), modifie: true, visee: true, vide: false };
  }
  const gardees = liste.filter((_, i) => !marques[i]);
  const resultat = gardees.join(" ");
  return { contenu: resultat, modifie: true, visee: true, vide: resultat.trim() === "" };
}

// ───────────────────────────── résultats ─────────────────────────────

export interface Resultat<T = string> {
  valeur: T;
  modifie: boolean;
  /** Cas à trancher par un humain (la valeur d'origine est conservée pour ces cas). */
  ambigus: string[];
}

/** Retire « (financement) » en fin de libellé : arbitrage 2 (offres d'emploi). */
function sansSuffixeFinancement(s: string): string {
  return s.replace(/\s*\((?:financements?|funding)\)\s*$/i, "");
}

/**
 * Champ court (extrait, méta, réponse directe, résumé, texte alternatif…) : retrait des phrases
 * visées. Champ qui devient vide → ambigu (valeur gardée). `titre: true` : un titre visé n'est
 * jamais réécrit seul → ambigu.
 */
export function reecrireTexte(
  texte: string,
  langue: Langue,
  options: { titre?: boolean } = {},
): Resultat {
  const origine = texte;
  let courant = options.titre ? sansSuffixeFinancement(texte) : texte;
  courant = retirerFragments(courant);
  const liste = phrases(courant);
  const visees = liste.filter((p) => estVisee(p));
  if (visees.length === 0) {
    const modifie = courant !== origine;
    return {
      valeur: modifie ? courant.replace(/\s{2,}/g, " ").trim() : origine,
      modifie,
      ambigus: [],
    };
  }
  if (options.titre) {
    return { valeur: origine, modifie: false, ambigus: [`titre à reformuler : « ${origine} »`] };
  }
  const gardees = liste
    .filter((p) => !estVisee(p))
    .join(" ")
    .trim();
  if (gardees === "") {
    return {
      valeur: origine,
      modifie: false,
      ambigus: [`champ entièrement visé : « ${origine.slice(0, 120)} »`],
    };
  }
  return { valeur: gardees, modifie: true, ambigus: [] };
}

export interface Faq {
  question: string;
  reponse: string;
}

/** Question/réponse : visée → « Comment se passe le financement ? » + phrase standard. */
export function reecrireFaq(f: Faq, langue: Langue): Resultat<Faq> {
  const qVisee = estVisee(f.question);
  const rVisee = estVisee(htmlVersTexte(f.reponse));
  if (!qVisee && !rVisee) {
    const q = reecrireTexte(f.question, langue);
    const r = reecrireBloc(f.reponse, langue);
    return {
      valeur: { question: q.valeur, reponse: r.valeur },
      modifie: q.modifie || r.modifie,
      ambigus: [...q.ambigus, ...r.ambigus],
    };
  }
  const parleDeFinancement = TITRE_FINANCEMENT.test(normaliser(f.question));
  if (qVisee || parleDeFinancement) {
    return {
      valeur: { question: question(langue), reponse: phrase(langue) },
      modifie: true,
      ambigus: [],
    };
  }
  // Question sans rapport, réponse visée : réécriture de la réponse seule, sinon ambigu.
  const r = reecrireBloc(f.reponse, langue);
  if (r.valeur.trim() === "" || r.valeur === phrase(langue)) {
    return {
      valeur: f,
      modifie: false,
      ambigus: [`FAQ à relire (question étrangère au financement) : « ${f.question} »`],
    };
  }
  return {
    valeur: { question: f.question, reponse: r.valeur },
    modifie: r.modifie,
    ambigus: r.ambigus,
  };
}

/** Réponse de FAQ (fragment HTML ou texte) : règle de paragraphe, sans structure de document. */
function reecrireBloc(contenu: string, langue: Langue): Resultat {
  const estHtml = /<[a-z][\s\S]*>/i.test(contenu);
  if (!estHtml) {
    const b = traiterBloc(contenu, langue, false);
    return {
      valeur: b.vide ? contenu : b.contenu,
      modifie: b.vide ? false : b.modifie,
      ambigus: b.vide ? ["bloc vide après retrait"] : [],
    };
  }
  return reecrireHtml(contenu, langue);
}

// ───────────────────────────── HTML ─────────────────────────────

const BLOCS_STRUCTURE =
  "p, ul, ol, li, table, div, blockquote, h1, h2, h3, h4, h5, h6, dl, details";
const NIVEAU = /^H([1-6])$/;

function niveau(el: Element): number {
  const m = NIVEAU.exec(el.tagName);
  return m ? Number(m[1]) : 0;
}

function creerP(d: Document, langue: Langue): HTMLElement {
  const p = d.createElement("p");
  p.textContent = phrase(langue);
  return p;
}

function estPhraseStandard(el: Element | null): boolean {
  if (!el || el.tagName !== "P") return false;
  const t = (el.textContent ?? "").trim();
  return t === PHRASE_FR || t === PHRASE_EN;
}

/** Faut-il remplacer le TEXTE d'un lien vers une page retirée ? (HTML et JSON : même règle.) */
function texteLienARemplacer(texte: string): boolean {
  return estVisee(texte) || MARQUEUR.test(texte) || TOUJOURS.some((r) => r.test(texte));
}

function hrefReecrit(href: string): string {
  return /\/en\//i.test(href) ? "/en/formations" : "/fr/formations";
}

function texteLienRemplace(langue: Langue): string {
  return langue === "en" ? "our training courses" : "nos formations";
}

/**
 * Ligne de tableau consacrée au financement (HTML et JSON : même règle). `"retirer"` : première
 * colonne visée, ou libellé de financement avec une autre cellule visée ; `"ambigu"` : cellule
 * visée hors première colonne ; `"garder"` sinon.
 */
function verdictLigne(premiere: string, autres: string[]): "retirer" | "ambigu" | "garder" {
  const p = premiere.trim();
  if (estVisee(p) || (TITRE_FINANCEMENT.test(normaliser(p)) && autres.some((c) => estVisee(c))))
    return "retirer";
  return autres.some((c) => estVisee(c)) ? "ambigu" : "garder";
}

function reecrireLiens(racine: Element, langue: Langue): boolean {
  let modifie = false;
  for (const a of Array.from(racine.querySelectorAll("a[href]"))) {
    const href = a.getAttribute("href") ?? "";
    if (!LIENS_RETIRES.test(href)) continue;
    // Seuls ces deux liens sont réécrits ; la langue du lien d'origine est conservée.
    a.setAttribute("href", hrefReecrit(href));
    if (texteLienARemplacer(a.textContent ?? "")) a.textContent = texteLienRemplace(langue);
    modifie = true;
  }
  return modifie;
}

/** Section d'un titre : éléments suivants jusqu'au prochain titre de niveau ≤ `niv`. */
function section(enfants: Element[], i: number, niv: number): Element[] {
  const corps: Element[] = [];
  for (let j = i + 1; j < enfants.length; j++) {
    const n = niveau(enfants[j]!);
    if (n > 0 && n <= niv) break;
    corps.push(enfants[j]!);
  }
  return corps;
}

function sectionVisee(corps: Element[]): boolean {
  return corps.some(
    (el) =>
      phrases(htmlVersTexte(el.outerHTML)).some((p) => estVisee(p)) ||
      estVisee(htmlVersTexte(el.outerHTML)),
  );
}

/** Titres H2-H4 : questions et sections consacrées au financement. */
function traiterTitres(racine: Element, d: Document, langue: Langue, ambigus: string[]): boolean {
  let modifie = false;
  // Parcours récursif : les titres imbriqués dans section / div / article sont traités comme ceux
  // de la racine (chaque conteneur qui porte au moins un titre est traité).
  const conteneurs = [
    racine,
    ...Array.from(racine.querySelectorAll("*")).filter((e) =>
      Array.from(e.children).some((c) => niveau(c) > 0),
    ),
  ];
  for (const conteneur of conteneurs) {
    if (!conteneur.isConnected) continue;
    modifie = traiterTitresDe(conteneur, d, langue, ambigus) || modifie;
  }
  return modifie;
}

function traiterTitresDe(racine: Element, d: Document, langue: Langue, ambigus: string[]): boolean {
  let modifie = false;
  const enfants = Array.from(racine.children);
  for (let i = 0; i < enfants.length; i++) {
    const h = enfants[i]!;
    const niv = niveau(h);
    if (niv < 2 || niv > 4) continue;
    if (!h.isConnected) continue;
    const titre = (h.textContent ?? "").replace(/\s+/g, " ").trim();
    const corps = section(enfants, i, niv);
    const titreVise = estVisee(titre);
    const finance = TITRE_FINANCEMENT.test(normaliser(titre));
    const concerne = titreVise || (finance && sectionVisee(corps));
    if (!concerne) continue;
    const estQuestion = /\?\s*$/.test(titre);
    if (estQuestion) {
      h.textContent = question(langue);
      corps.forEach((el) => el.remove());
      h.after(creerP(d, langue));
      modifie = true;
    } else if (niv <= 3) {
      corps.forEach((el) => el.remove());
      h.replaceWith(creerP(d, langue));
      modifie = true;
    } else {
      ambigus.push(`titre H${niv} à reformuler : « ${titre} »`);
    }
  }
  return modifie;
}

/** `<details><summary>question</summary>réponse</details>` : même règle que les FAQ. */
function traiterDetails(racine: Element, d: Document, langue: Langue): boolean {
  let modifie = false;
  for (const det of Array.from(racine.querySelectorAll("details"))) {
    const sum = det.querySelector("summary");
    if (!sum) continue;
    const q = (sum.textContent ?? "").trim();
    const reste = Array.from(det.children).filter((c) => c !== sum);
    const rep = reste.map((c) => c.outerHTML).join("");
    if (!estVisee(q) && !estVisee(htmlVersTexte(rep))) continue;
    if (estVisee(q) || TITRE_FINANCEMENT.test(normaliser(q))) {
      sum.textContent = question(langue);
      reste.forEach((c) => c.remove());
      det.append(creerP(d, langue));
      modifie = true;
    }
  }
  return modifie;
}

function traiterListes(racine: Element, d: Document, langue: Langue): boolean {
  let modifie = false;
  for (const liste of Array.from(racine.querySelectorAll("ul, ol"))) {
    if (!liste.isConnected || liste.querySelector("ul, ol, table")) continue;
    const items = Array.from(liste.children).filter((c) => c.tagName === "LI");
    if (items.length === 0) continue;
    const visees = items.filter(
      (li) =>
        htmlVersTexte(li.innerHTML) !== "" &&
        phrases(htmlVersTexte(li.innerHTML)).some((p) => estVisee(p)),
    );
    if (visees.length === 0) continue;
    const intro = liste.previousElementSibling;
    const introFinancement =
      !!intro &&
      intro.tagName === "P" &&
      /:\s*$/.test((intro.textContent ?? "").trim()) &&
      MARQUEUR.test(normaliser(intro.textContent ?? ""));
    if (visees.length === items.length || introFinancement) {
      if (introFinancement && intro) intro.remove();
      liste.replaceWith(creerP(d, langue));
    } else {
      visees.forEach((li) => li.remove());
    }
    modifie = true;
  }
  return modifie;
}

function traiterTableaux(racine: Element, ambigus: string[]): boolean {
  let modifie = false;
  for (const tr of Array.from(racine.querySelectorAll("tbody tr, table > tr"))) {
    const cellules = Array.from(tr.children);
    if (cellules.length === 0) continue;
    const autres = cellules.slice(1).map((c) => c.textContent ?? "");
    const v = verdictLigne(cellules[0]!.textContent ?? "", autres);
    if (v === "retirer") {
      tr.remove();
      modifie = true;
    } else if (v === "ambigu") {
      const autre = autres.find((c) => estVisee(c)) ?? "";
      ambigus.push(
        `tableau : cellule visée hors première colonne : « ${autre.trim().slice(0, 100)} »`,
      );
    }
  }
  return modifie;
}

function traiterFeuilles(racine: Element, langue: Langue, ambigus: string[]): boolean {
  let modifie = false;
  const feuilles = Array.from(
    racine.querySelectorAll("p, li, dd, dt, figcaption, blockquote, h4, h5, h6"),
  ).filter((el) => !el.querySelector(BLOCS_STRUCTURE));
  for (const el of feuilles) {
    if (!el.isConnected) continue;
    if (el.tagName === "P" && estPhraseStandard(el)) continue;
    const niv = niveau(el);
    if (niv >= 4) {
      const t = (el.textContent ?? "").trim();
      if (estVisee(t)) ambigus.push(`titre H${niv} à reformuler : « ${t} »`);
      continue;
    }
    const b = traiterBloc(el.innerHTML, langue, true);
    if (!b.modifie) continue;
    if (b.vide) el.remove();
    else el.innerHTML = b.contenu;
    modifie = true;
  }
  return modifie;
}

/** Retire les phrases standard consécutives en double (deux sections voisines remplacées). */
function dedoublonner(racine: Element): boolean {
  let modifie = false;
  for (const p of Array.from(racine.querySelectorAll("p"))) {
    if (!p.isConnected || !estPhraseStandard(p)) continue;
    const suivant = p.nextElementSibling;
    if (estPhraseStandard(suivant)) {
      suivant!.remove();
      modifie = true;
    }
  }
  return modifie;
}

/**
 * Réécrit un corps HTML. Renvoie la chaîne d'ORIGINE, octet pour octet, si rien ne change
 * (pas de sérialisation parasite). Idempotent.
 */
export function reecrireHtml(html: string, langue: Langue): Resultat {
  const fenetre = new JSDOM(`<!doctype html><body>${html}</body>`).window;
  const d = fenetre.document;
  const racine = d.body;
  const ambigus: string[] = [];
  let modifie = false;
  modifie = reecrireLiens(racine, langue) || modifie;
  modifie = traiterDetails(racine, d, langue) || modifie;
  modifie = traiterTitres(racine, d, langue, ambigus) || modifie;
  modifie = traiterListes(racine, d, langue) || modifie;
  modifie = traiterTableaux(racine, ambigus) || modifie;
  modifie = traiterFeuilles(racine, langue, ambigus) || modifie;
  modifie = dedoublonner(racine) || modifie;
  const sortie = modifie ? racine.innerHTML : html;
  fenetre.close();
  return { valeur: sortie, modifie, ambigus };
}

// ───────────────────────────── Tiptap JSON ─────────────────────────────

interface NoeudTiptap {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: NoeudTiptap[];
  [k: string]: unknown;
}

function texteNoeud(n: NoeudTiptap): string {
  if (typeof n.text === "string") return n.text;
  return (n.content ?? []).map(texteNoeud).join("");
}

function paragrapheStandard(langue: Langue): NoeudTiptap {
  return { type: "paragraph", content: [{ type: "text", text: phrase(langue) }] };
}

/**
 * Document Tiptap : mêmes règles que le HTML, au niveau des paragraphes, listes et sections
 * (titres H2/H3), lignes de tableau et liens vers les pages retirées (même règle que le HTML).
 * Un paragraphe réécrit perd ses marques en ligne (gras, lien) ; un paragraphe intact est
 * conservé tel quel.
 */
export function reecrireJson(documentJson: unknown, langue: Langue): Resultat<unknown> {
  if (!documentJson || typeof documentJson !== "object")
    return { valeur: documentJson, modifie: false, ambigus: [] };
  const racine = structuredClone(documentJson) as NoeudTiptap;
  const ambigus: string[] = [];
  let modifie = false;

  /** Liens vers les pages retirées : même réécriture que le HTML (href et, si besoin, texte). */
  const reecrireLiensJson = (n: NoeudTiptap): void => {
    const marques = Array.isArray(n.marks) ? (n.marks as NoeudTiptap[]) : [];
    for (const m of marques) {
      const href = typeof m.attrs?.href === "string" ? m.attrs.href : "";
      if (m.type !== "link" || !LIENS_RETIRES.test(href)) continue;
      m.attrs = { ...m.attrs, href: hrefReecrit(href) };
      if (typeof n.text === "string" && texteLienARemplacer(n.text))
        n.text = texteLienRemplace(langue);
      modifie = true;
    }
    for (const c of n.content ?? []) reecrireLiensJson(c);
  };
  reecrireLiensJson(racine);

  /** Tableau : mêmes retraits de lignes que le HTML (lignes d'en-tête exclues). */
  const traiterTableauJson = (t: NoeudTiptap): void => {
    t.content = (t.content ?? []).filter((ligne) => {
      const cellules = ligne.content ?? [];
      if (cellules.length === 0 || cellules.every((c) => c.type === "tableHeader")) return true;
      const v = verdictLigne(texteNoeud(cellules[0]!), cellules.slice(1).map(texteNoeud));
      if (v === "retirer") {
        modifie = true;
        return false;
      }
      if (v === "ambigu") {
        const autre =
          cellules
            .slice(1)
            .map(texteNoeud)
            .find((c) => estVisee(c)) ?? "";
        ambigus.push(
          `tableau : cellule visée hors première colonne : « ${autre.trim().slice(0, 100)} »`,
        );
      }
      return true;
    });
  };

  const traiterParagraphe = (n: NoeudTiptap): "garde" | "modifie" | "vide" => {
    const t = texteNoeud(n);
    if (t === PHRASE_FR || t === PHRASE_EN) return "garde";
    const b = traiterBloc(t, langue, false);
    if (!b.modifie) return "garde";
    if (b.vide) return "vide";
    n.content = [{ type: "text", text: b.contenu }];
    return "modifie";
  };

  const traiterConteneur = (n: NoeudTiptap): void => {
    const enfants = n.content ?? [];
    const sortie: NoeudTiptap[] = [];
    for (let i = 0; i < enfants.length; i++) {
      const c = enfants[i]!;
      if (c.type === "heading") {
        const niv = Number((c.attrs as { level?: number } | undefined)?.level ?? 0);
        const titre = texteNoeud(c).trim();
        if (niv >= 2 && niv <= 4) {
          let fin = i + 1;
          while (fin < enfants.length) {
            const e = enfants[fin]!;
            const ne =
              e.type === "heading"
                ? Number((e.attrs as { level?: number } | undefined)?.level ?? 0)
                : 0;
            if (ne > 0 && ne <= niv) break;
            fin++;
          }
          const corps = enfants.slice(i + 1, fin);
          const corpsVise = corps.some((e) => phrases(texteNoeud(e)).some((p) => estVisee(p)));
          const concerne =
            estVisee(titre) || (TITRE_FINANCEMENT.test(normaliser(titre)) && corpsVise);
          if (concerne) {
            const estQuestion = /\?\s*$/.test(titre);
            if (estQuestion) {
              sortie.push(
                { ...c, content: [{ type: "text", text: question(langue) }] },
                paragrapheStandard(langue),
              );
              modifie = true;
              i = fin - 1;
              continue;
            }
            if (niv <= 3) {
              sortie.push(paragrapheStandard(langue));
              modifie = true;
              i = fin - 1;
              continue;
            }
            ambigus.push(`titre H${niv} à reformuler : « ${titre} »`);
          }
        }
        sortie.push(c);
        continue;
      }
      if (c.type === "paragraph") {
        const r = traiterParagraphe(c);
        if (r === "vide") {
          modifie = true;
          continue;
        }
        if (r === "modifie") modifie = true;
        sortie.push(c);
        continue;
      }
      if (c.type === "bulletList" || c.type === "orderedList") {
        const items = c.content ?? [];
        const visees = items.filter((li) => phrases(texteNoeud(li)).some((p) => estVisee(p)));
        if (visees.length === 0) {
          sortie.push(c);
          continue;
        }
        const prec = sortie[sortie.length - 1];
        const introFinancement =
          !!prec &&
          prec.type === "paragraph" &&
          /:\s*$/.test(texteNoeud(prec).trim()) &&
          MARQUEUR.test(normaliser(texteNoeud(prec)));
        if (visees.length === items.length || introFinancement) {
          if (introFinancement) sortie.pop();
          sortie.push(paragrapheStandard(langue));
        } else {
          c.content = items.filter((li) => !visees.includes(li));
          sortie.push(c);
        }
        modifie = true;
        continue;
      }
      if (c.type === "table") {
        traiterTableauJson(c);
        sortie.push(c);
        continue;
      }
      if (c.content) traiterConteneur(c);
      sortie.push(c);
    }
    // Phrases standard consécutives en double.
    n.content = sortie.filter(
      (e, i) =>
        !(
          i > 0 &&
          texteNoeud(e) === texteNoeud(sortie[i - 1]!) &&
          (texteNoeud(e) === PHRASE_FR || texteNoeud(e) === PHRASE_EN)
        ),
    );
  };

  traiterConteneur(racine);
  if (!modifie) return { valeur: documentJson, modifie: false, ambigus };
  return { valeur: racine, modifie: true, ambigus };
}

// ───────────────────────────── classement ─────────────────────────────

export type Classe = "propre" | "a-reecrire" | "ambigu";

/** Classe un résultat : propre (rien à faire), à réécrire, ou ambigu (humain, cf. overrides). */
export function classer(r: Resultat<unknown>): Classe {
  if (r.ambigus.length > 0) return "ambigu";
  return r.modifie ? "a-reecrire" : "propre";
}
