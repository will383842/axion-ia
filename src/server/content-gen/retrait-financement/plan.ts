/**
 * Retrait des mentions de financement — construction du PLAN (pur, sans base de données).
 *
 * Le script `scripts/content-gen/retrait-mentions-financement.ts` lit les lignes, appelle ces
 * fonctions et écrit. Tout ce qui décide du texte est ici, donc testable.
 */
import { createHash } from "node:crypto";
import {
  type Langue,
  capterRegles,
  classer,
  estVisee,
  htmlVersBlocs,
  htmlVersTexte,
  jsonContientMention,
  motsDe,
  questionParleDeFinancement,
  reecrireFaq,
  reecrireHtml,
  reecrireJson,
  reecrireTexte,
  retirerFragments,
  motsNonRetirables,
} from "./regles";
import {
  INTERDITS_PUBLICS,
  LEXIQUE_DUR,
  normaliserPourPorte2,
  termeRefuse,
  termesRefuses,
} from "./porte2";

export { INTERDITS_PUBLICS, normaliserPourPorte2 };

export const ACTION_RETRAIT = "retrait-financement-2026-11";
export const ACTION_RESTAURATION = "retrait-financement-2026-11-restauration";
/**
 * Override humain sur un contenu DÉJÀ traité : réécriture ciblée des seuls champs surchargés, avec
 * sa propre sauvegarde (ancienne valeur) et sa propre restauration. Jamais mêlée à la sauvegarde
 * du premier passage.
 */
export const ACTION_OVERRIDE = "retrait-financement-2026-11-override";
export const ACTION_RESTAURATION_OVERRIDE = "retrait-financement-2026-11-override-restauration";

/** Offres consacrées au financement : poste qu'Axion-IA ne propose pas → archivées (arbitrage 1). */
export const SLUGS_OFFRES_ARCHIVEES: readonly string[] = [
  "assistant-financements",
  "assistant-dossiers-financement-clients",
  "charge-subventions",
];

export type Table = "article_translation" | "article" | "faq" | "job_offer";
export type Champs = Record<string, unknown>;

export interface Proposition {
  /** Clé stable écrite dans `ContentGenAuditLog.settingKey` : `<table>:<id>`. */
  cle: string;
  table: Table;
  id: string;
  /**
   * SAUVEGARDE : valeurs d'origine de TOUS les champs textuels du contenu (et le statut pour les
   * offres), modifiés ou non. La restauration ne réécrit que les clés de `apres`.
   */
  avant: Champs;
  /** Nouvelles valeurs. */
  apres: Champs;
  /** Cas à trancher : la valeur d'origine est conservée pour ces champs. */
  ambigus: string[];
  /** Phrases « prise en charge » conservées (hors financement), listées à part dans le rapport. */
  conserves: string[];
  /** Règles ciblées appliquées (fragment retiré, décompte corrigé, cellule, question…). */
  regles?: string[];
  /** Champs réécrits par un override humain (sous-ensemble de `apres`). */
  surcharges?: string[];
  /** Mots non financiers perdus et ACCEPTÉS par l'override, par champ (`pertesAcceptees`). */
  pertes?: Record<string, string[]>;
  /**
   * Champs CONSERVÉS tels quels sur décision du dirigeant (entrée d'override avec `admis`), et les termes
   * de la porte 2 qu'il a admis. Rien n'est écrit pour ces champs : seuls leurs ambigus sont levés.
   */
  conservesSurDecision?: Record<string, string[]>;
  /**
   * Ambigus LEVÉS par une conservation sur décision, par champ : un par phrase que la porte 2 refuse et qui
   * reste donc en ligne, citée EN ENTIER (l'ambigu du filet coupe sa citation à 160 caractères). Imprimés
   * dans le rapport sous la ligne du champ : un seul terme de `admis` couvre toutes les phrases du champ
   * qui le contiennent.
   */
  phrasesConservees?: Record<string, string[]>;
}

/** Valeurs de remplacement validées par un humain pour un cas ambigu. */
export type Overrides = Record<
  string,
  Record<
    string,
    {
      origine: string;
      valeur: unknown;
      /**
       * Mots non financiers que l'override fait DISPARAÎTRE, listés à la main (casse et accents
       * ignorés). Tout mot perdu hors lexique et hors de cette liste fait ignorer l'override (A8).
       */
      pertesAcceptees?: string[];
      /**
       * « Conservé sur décision » : le champ est un FAUX POSITIF de la porte 2 (« services financiers ») et
       * reste tel quel. Liste des termes exacts refusés par la porte 2 et admis par le dirigeant. Acceptée
       * seulement si `valeur` est l'original, si le champ n'a que des ambigus « mention restante
       * (porte 2 : …) », si chaque terme refusé est listé, et sans aucun mot du lexique dur
       * (`refusDeConservation`).
       */
      admis?: string[];
    }
  >
>;

export function empreinte(valeur: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(valeur) ?? "null")
    .digest("hex");
}

function conservees(texte: string): string[] {
  return texte
    .split(/(?<=[.!?…])\s+/)
    .filter((p) => /prise en charge/i.test(p) && !estVisee(p))
    .map((p) => p.trim().slice(0, 160));
}

/**
 * A1 (essai du 20/11) : reporte dans le `bodyText` STOCKÉ les seuls passages modifiés entre deux
 * versions du `body`, au lieu de recalculer tout le champ (qui perdrait statistiques et sources,
 * et recevrait crédits photo et JSON-LD). Substitution à espaces tolérés. Rend `null` si un passage
 * est introuvable ou présent plusieurs fois : l'appelant garde le `bodyText` et lève un ambigu.
 */
export function reporterDansTexteBrut(
  bodyTextOrigine: string,
  bodyAvant: string,
  bodyApres: string,
): string | null {
  const a = htmlVersBlocs(bodyAvant);
  const b = htmlVersBlocs(bodyApres);
  let courant = bodyTextOrigine;
  const mots = (t: string): string[] => t.split(/\s+/).filter((x) => x !== "");
  for (const [i0, i1, j0, j1] of groupesDeBlocs(a, b)) {
    // P4 : chaque groupe de blocs modifiés est découpé en MORCEAUX par un diff mot à mot, et chaque
    // morceau est reporté séparément (deux retraits proches ne forment plus un seul long passage).
    const wa = mots(a.slice(i0, i1).join(" "));
    const wb = mots(b.slice(j0, j1).join(" "));
    // Contexte gauche pris du côté « après » (déjà reporté dans `courant`), droit du côté « avant ».
    const hors = {
      gauche: b.slice(0, j0).join(" "),
      droite: a.slice(i1).join(" "),
    };
    for (const [x0, x1, y0, y1] of groupesDeBlocs(wa, wb)) {
      const avant = wa.slice(x0, x1).join(" ");
      const apres = wb.slice(y0, y1).join(" ");
      let p = 0;
      const max = Math.min(avant.length, apres.length);
      while (p < max && avant[p] === apres[p]) p++;
      let s = 0;
      while (s < max - p && avant[avant.length - 1 - s] === apres[apres.length - 1 - s]) s++;
      let retire = avant.slice(p, avant.length - s);
      const ajoute = apres.slice(p, apres.length - s);
      if (retire.replace(/\s+/g, "") === ajoute.replace(/\s+/g, "")) continue;
      const gauche0 = [hors.gauche, wb.slice(0, y0).join(" ")].filter(Boolean).join(" ");
      const gaucheTexte = (gauche0 ? gauche0 + " " : "") + avant.slice(0, p);
      const reste = [wa.slice(x1).join(" "), hors.droite].filter(Boolean).join(" ");
      let droiteTexte = avant.slice(avant.length - s) + (reste ? " " + reste : "");
      // Un mot retiré emporte une espace voisine, sinon il laisse une double espace.
      if (ajoute === "" && droiteTexte.startsWith(" ")) {
        retire += " ";
        droiteTexte = droiteTexte.slice(1);
      }
      let fait = false;
      for (const k of [0, 20, 40, 80]) {
        const gauche = k === 0 ? "" : gaucheTexte.slice(-k);
        const droite = k === 0 ? "" : droiteTexte.slice(0, k);
        if ((gauche + retire + droite).trim() === "") continue;
        // Q3 : la ponctuation peut être écrite « Intro. » dans le corps et « Intro . » dans le texte
        // brut : une espace est tolérée devant chaque ponctuation. Le contexte est CAPTURÉ et recopié
        // tel qu'il est stocké (seul le fragment retiré change).
        const re = new RegExp(
          `(${motifTolerant(gauche)})(${motifTolerant(retire)})(${motifTolerant(droite)})`,
          "g",
        );
        const n = courant.match(re)?.length ?? 0;
        // Un contexte qui ne se retrouve pas n'est pas fatal : on essaie le contexte plus large.
        if (n === 0 && k === 0) return null;
        if (n !== 1) continue;
        courant = courant.replace(re, (_m, g: string, _r: string, d: string) => g + ajoute + d);
        fait = true;
        break;
      }
      if (!fait) return null;
    }
  }
  return courant;
}

/** Motif d'un texte : espaces quelconques entre mots, espace tolérée devant la ponctuation. */
function motifTolerant(texte: string): string {
  // Les espaces aux extrémités comptent (elles séparent le contexte du fragment retiré).
  const debut = /^\s/.test(texte) ? "\\s+" : "";
  const fin = /\s$/.test(texte) ? "\\s+" : "";
  return (
    debut +
    texte
      .split(/\s+/)
      .filter((x) => x !== "")
      .map((mot) =>
        mot
          .split(/([.,;:!?])/)
          .filter((x) => x !== "")
          .map((part) =>
            /^[.,;:!?]$/.test(part) ? `\\s*${echapperRegExp(part)}` : echapperRegExp(part),
          )
          .join(""),
      )
      .join("\\s+") +
    fin
  );
}

const echapperRegExp = (x: string): string => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Groupes de blocs différents : [début avant, fin avant, début après, fin après[ (sous-suite commune). */
function groupesDeBlocs(
  a: readonly string[],
  b: readonly string[],
): Array<[number, number, number, number]> {
  const n = a.length;
  const m = b.length;
  const t: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      t[i]![j] = a[i] === b[j] ? t[i + 1]![j + 1]! + 1 : Math.max(t[i + 1]![j]!, t[i]![j + 1]!);
  const out: Array<[number, number, number, number]> = [];
  let i = 0;
  let j = 0;
  let di = 0;
  let dj = 0;
  const clore = (): void => {
    if (i > di || j > dj) out.push([di, i, dj, j]);
  };
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      clore();
      i++;
      j++;
      di = i;
      dj = j;
    } else if (t[i + 1]![j]! >= t[i]![j + 1]!) i++;
    else j++;
  }
  i = n;
  j = m;
  clore();
  return out;
}

/** Ajoute `bodyText` : report des seuls passages modifiés, ou ambigu « à resynchroniser ». */
function reporterTexteBrut(
  c: Collecteur,
  champ: string,
  bodyTextOrigine: string | null | undefined,
  bodyAvant: string,
  bodyApres: string,
): void {
  if (typeof bodyTextOrigine !== "string") return c.garder(champ, bodyTextOrigine);
  const nouveau = reporterDansTexteBrut(bodyTextOrigine, bodyAvant, bodyApres);
  if (nouveau === null)
    c.champ(champ, bodyTextOrigine, bodyTextOrigine, false, [
      "bodyText à resynchroniser : passage modifié dans le body introuvable, ou présent plusieurs fois, dans le texte brut stocké",
    ]);
  else c.champ(champ, bodyTextOrigine, nouveau, nouveau !== bodyTextOrigine, []);
}

/** Forme comparable d'une phrase (espaces, casse, parenthèses) pour ne pas citer deux fois la même. */
const reduitPorte2 = (s: string): string => s.replace(/\s+/g, " ").trim().toLowerCase();

/** Phrases d'un texte brut (fin de phrase suivie d'une majuscule ou d'un chiffre) ; chaque ligne à part. */
const decouperPhrases = (t: string): string[] =>
  t
    .split(/\n+/)
    .flatMap((l) => l.split(/(?<=[.!?…])\s+(?=[A-ZÀ-ÝÉ«"“0-9])/))
    .map((x) => x.trim())
    .filter((x) => x !== "");

/** Début du message d'un ambigu levé par le filet « valeur finale » (et lui seul). */
const MENTION_PORTE2 = "mention restante (porte 2 : ";

class Collecteur {
  avant: Champs = {};
  apres: Champs = {};
  ambigus: string[] = [];
  conserves: string[] = [];
  regles: string[] = [];

  /**
   * `controlerPorte2` : le filet « valeur finale » ne s'applique qu'aux contenus du BLOG (traductions,
   * articles, FAQ). Une offre d'emploi ne parle pas de formation : « Responsable administratif et
   * financier », « tenir la maison côté finances » y sont légitimes, et un override ne pourrait jamais les
   * garder. Le moteur (règles de réécriture) continue, lui, de traiter les offres.
   */
  constructor(
    private readonly nom: string,
    private readonly options: { controlerPorte2: boolean },
  ) {}

  /** Garde la valeur d'origine d'un champ dans la sauvegarde, qu'il soit modifié ou non. */
  garder(champ: string, original: unknown): void {
    this.avant[champ] = original === undefined ? null : original;
  }

  champ(
    champ: string,
    original: unknown,
    nouveau: unknown,
    modifie: boolean,
    ambigus: string[],
  ): void {
    this.garder(champ, original);
    if (modifie) this.apres[champ] = nouveau;
    for (const a of ambigus) this.ambigus.push(`${this.nom}.${champ} : ${a}`);
    if (this.options.controlerPorte2)
      this.filetPorte2(champ, modifie ? nouveau : original, ambigus);
  }

  /**
   * B1 (essai à blanc n° 2) : la valeur FINALE du champ (réécrite ou non) passe la porte 2, la même règle
   * que celle des overrides humains. Chaque phrase refusée devient un ambigu « mention restante (porte 2) »
   * qui la cite : le moteur et les overrides n'ont plus qu'UNE règle, et « ambigus : 0 » après l'apply
   * prouve vraiment qu'aucune phrase de financement ne reste.
   * - une phrase déjà citée par un ambigu du même champ n'est pas répétée, y compris quand le moteur la cite
   *   SANS le fragment qu'il sait retirer (« (CPF) ») ;
   * - une FAQ (question, réponse, `faqJson`) déjà ambiguë est bloquée en bloc : on ne la découpe pas.
   */
  private filetPorte2(champ: string, valeur: unknown, ambigusDuChamp: string[]): void {
    if (valeur === null || valeur === undefined) return;
    if (ambigusDuChamp.length > 0 && /^(?:question|answer|faqJson)/.test(champ)) return;
    const cites = this.ambigus
      .filter((a) => a.startsWith(`${this.nom}.${champ} : `))
      .map(reduitPorte2);
    const vus = new Set<string>();
    for (const t of textesDe(valeur)) {
      for (const phrase of decouperPhrases(t)) {
        const normalise = normaliserPourPorte2(phrase);
        const interdit = INTERDITS_PUBLICS.exec(normalise);
        if (!interdit) continue;
        const r = reduitPorte2(phrase);
        // Le moteur cite parfois la phrase sans le fragment retiré : on compare aussi cette forme.
        const sansFragment = reduitPorte2(retirerFragments(phrase));
        const formes = sansFragment.length >= 8 && sansFragment !== r ? [r, sansFragment] : [r];
        if (vus.has(r) || formes.some((f) => cites.some((a) => a.includes(f.slice(0, 80)))))
          continue;
        vus.add(r);
        this.ambigus.push(
          `${this.nom}.${champ} : ${MENTION_PORTE2}${termeRefuse(normalise, interdit)}) : « ${phrase.slice(0, 160)} »`,
        );
      }
    }
  }

  texte(champ: string, valeur: string | null | undefined, langue: Langue, titre = false): void {
    this.garder(champ, valeur);
    if (typeof valeur !== "string" || valeur === "") return;
    this.conserves.push(...conservees(valeur));
    const { valeur: r, regles } = capterRegles(() => reecrireTexte(valeur, langue, { titre }));
    this.noterRegles(champ, regles);
    this.champ(champ, valeur, r.valeur, r.modifie, r.ambigus);
  }

  html(champ: string, valeur: string | null | undefined, langue: Langue): string | null {
    this.garder(champ, valeur);
    if (typeof valeur !== "string" || valeur === "") return null;
    this.conserves.push(...conservees(htmlVersTexte(valeur)));
    const { valeur: r, regles } = capterRegles(() => reecrireHtml(valeur, langue));
    this.noterRegles(champ, regles);
    this.champ(champ, valeur, r.valeur, r.modifie, r.ambigus);
    return r.modifie ? r.valeur : null;
  }

  json(champ: string, valeur: unknown, langue: Langue): void {
    this.garder(champ, valeur);
    if (valeur === null || valeur === undefined) return;
    const { valeur: r, regles } = capterRegles(() => reecrireJson(valeur, langue));
    this.noterRegles(champ, regles);
    const ambigus = [...r.ambigus];
    // Jamais de silence : une mention encore présente dans bodyJson (structure inattendue)
    // réintroduirait l'ancien texte dans l'éditeur ; on la signale au lieu de la laisser passer.
    if (jsonContientMention(r.valeur))
      ambigus.push("mention encore présente dans le JSON après réécriture (structure inattendue)");
    this.champ(champ, valeur, r.valeur, r.modifie, ambigus);
  }

  noterRegles(champ: string, regles: string[]): void {
    for (const x of regles) this.regles.push(`${this.nom}.${champ} : ${x}`);
  }

  /** Règles ciblées appliquées à un champ calculé hors de `texte` / `html` / `json`. */
  capter<T>(champ: string, f: () => T): T {
    const { valeur, regles } = capterRegles(f);
    this.noterRegles(champ, regles);
    return valeur;
  }

  resultat(table: Table, id: string): Proposition | null {
    if (Object.keys(this.apres).length === 0 && this.ambigus.length === 0) return null;
    return {
      cle: `${table}:${id}`,
      table,
      id,
      avant: this.avant,
      apres: this.apres,
      ambigus: this.ambigus,
      conserves: this.conserves,
      regles: this.regles,
    };
  }
}

// ───────────────────────────── lignes ─────────────────────────────

export interface LigneTraduction {
  id: string;
  locale: "fr" | "en";
  title: string;
  excerpt: string | null;
  body: string;
  bodyJson: unknown;
  bodyText: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  ogImageAlt: string | null;
}

export function proposerTraduction(l: LigneTraduction): Proposition | null {
  const c = new Collecteur(`article_translation:${l.id}`, { controlerPorte2: true });
  const langue: Langue = l.locale;
  c.texte("title", l.title, langue, true);
  c.texte("excerpt", l.excerpt, langue);
  const corps = c.html("body", l.body, langue);
  c.json("bodyJson", l.bodyJson, langue);
  if (corps !== null) reporterTexteBrut(c, "bodyText", l.bodyText, l.body, corps);
  else c.garder("bodyText", l.bodyText);
  c.texte("metaTitle", l.metaTitle, langue, true);
  c.texte("metaDescription", l.metaDescription, langue);
  c.texte("ogImageAlt", l.ogImageAlt, langue);
  return c.resultat("article_translation", l.id);
}

export interface QuestionReponse {
  question: string;
  answer: string;
}

export interface LigneArticle {
  id: string;
  directAnswer: string | null;
  faqJson: unknown;
  keyTakeaway: string | null;
  expertQuoteText: string | null;
  featuredImageAltFr: string | null;
  featuredImageAltEn: string | null;
}

export function proposerArticle(l: LigneArticle): Proposition | null {
  const c = new Collecteur(`article:${l.id}`, { controlerPorte2: true });
  c.texte("directAnswer", l.directAnswer, "fr");
  c.texte("keyTakeaway", l.keyTakeaway, "fr");
  c.texte("expertQuoteText", l.expertQuoteText, "fr");
  c.texte("featuredImageAltFr", l.featuredImageAltFr, "fr");
  c.texte("featuredImageAltEn", l.featuredImageAltEn, "en");
  if (Array.isArray(l.faqJson)) {
    let modifie = false;
    const ambigus: string[] = [];
    const sortie = (l.faqJson as unknown[]).map((it) => {
      if (!it || typeof it !== "object") return it;
      const o = it as Record<string, unknown>;
      if (typeof o.question !== "string" || typeof o.answer !== "string") return it;
      const r = c.capter("faqJson", () =>
        reecrireFaq({ question: o.question as string, reponse: o.answer as string }, "fr"),
      );
      if (r.modifie) modifie = true;
      ambigus.push(...r.ambigus);
      return r.modifie ? { ...o, question: r.valeur.question, answer: r.valeur.reponse } : it;
    });
    c.champ("faqJson", l.faqJson, sortie, modifie, ambigus);
  } else c.garder("faqJson", l.faqJson);
  return c.resultat("article", l.id);
}

export interface LigneFaq {
  id: string;
  questionFr: string;
  answerFr: string;
  questionEn: string;
  answerEn: string;
  metaTitle: string | null;
  metaDescription: string | null;
}

export function proposerFaq(l: LigneFaq): Proposition | null {
  const c = new Collecteur(`faq:${l.id}`, { controlerPorte2: true });
  for (const [langue, q, a, kq, ka] of [
    ["fr", l.questionFr, l.answerFr, "questionFr", "answerFr"],
    ["en", l.questionEn, l.answerEn, "questionEn", "answerEn"],
  ] as const) {
    const r = c.capter(kq, () => reecrireFaq({ question: q, reponse: a }, langue));
    // L'ambigu d'une réponse se range sous le champ RÉPONSE : un override sur la question seule
    // ne doit pas lever le refus d'apply alors que le passage reste dans la réponse.
    const surQuestion = r.ambigus.filter((x) => !r.ambigusReponse.includes(x));
    c.champ(kq, q, r.valeur.question, r.valeur.question !== q, surQuestion);
    c.champ(ka, a, r.valeur.reponse, r.valeur.reponse !== a, r.ambigusReponse);
  }
  c.texte("metaTitle", l.metaTitle, "fr", true);
  c.texte("metaDescription", l.metaDescription, "fr");
  return c.resultat("faq", l.id);
}

export interface LigneOffre {
  id: string;
  slug: string;
  status: string;
  titleFr: string;
  titleEn: string;
  summaryFr: string;
  summaryEn: string;
  bodyFr: string;
  bodyEn: string;
  bodyJsonFr: unknown;
  bodyJsonEn: unknown;
  bodyTextFr: string;
  bodyTextEn: string;
  metaTitle: string | null;
  metaDescription: string | null;
  /** `[{ labelFr, labelEn }]` : avantages affichés sur la page de l'offre. */
  perks?: unknown;
}

/** Champs textuels d'une offre, tous gardés dans la sauvegarde d'une offre archivée. */
const CHAMPS_TEXTE_OFFRE = [
  "titleFr",
  "titleEn",
  "summaryFr",
  "summaryEn",
  "bodyFr",
  "bodyEn",
  "bodyJsonFr",
  "bodyJsonEn",
  "bodyTextFr",
  "bodyTextEn",
  "metaTitle",
  "metaDescription",
  "perks",
] as const;

/** Tous les libellés texte (`labelFr`, `labelEn`) n'ont que des mots du lexique fermé. */
function tousLibellesRetirables(o: Record<string, unknown>): boolean {
  return ["labelFr", "labelEn"].every((k) => {
    const v = o[k];
    return typeof v !== "string" || motsNonRetirables(v, "").length === 0;
  });
}

/**
 * Avantages (`perks`) : un avantage dont le libellé est ENTIÈREMENT du financement (phrases pures)
 * est retiré ; un libellé qui ne contient qu'un fragment (« (CPF) ») est nettoyé ; un libellé
 * AMBIGU est gardé tel quel et remonté au rapport (jamais supprimé en silence). Tableau vide
 * possible (la page masque alors le bloc).
 */
export function reecrirePerks(perks: unknown): {
  valeur: unknown;
  modifie: boolean;
  /** Avantages dont un libellé est ambigu : GARDÉS tels quels, à trancher à la main. */
  ambigus: string[];
} {
  if (!Array.isArray(perks)) return { valeur: perks, modifie: false, ambigus: [] };
  let modifie = false;
  const ambigus: string[] = [];
  const sortie: unknown[] = [];
  for (const it of perks as unknown[]) {
    if (!it || typeof it !== "object") {
      sortie.push(it);
      continue;
    }
    const o = { ...(it as Record<string, unknown>) };
    let retire = false;
    let ambigu = false;
    let change = false;
    for (const [cle, langue] of [
      ["labelFr", "fr"],
      ["labelEn", "en"],
    ] as const) {
      const v = o[cle];
      if (typeof v !== "string") continue;
      const r = reecrireTexte(v, langue);
      if (r.ambigus.length > 0) {
        // « champ entièrement visé » : toutes les phrases du libellé sont PURES (sujet = financement,
        // sinon l'ambigu serait « phrase mixte ») → l'avantage de financement est retiré, comme avant.
        // Verrou final : le libellé disparaît en entier, donc tous ses mots doivent être retirables.
        // Audit passe 8 : CHAQUE libellé texte (Fr ET En) ne doit avoir que des mots du lexique.
        if (
          r.ambigus.every((a) => a.startsWith("champ entièrement visé")) &&
          tousLibellesRetirables(it as Record<string, unknown>)
        )
          retire = true;
        else {
          ambigu = true;
          ambigus.push(`avantage ${cle} ambigu : « ${v.slice(0, 160)} »`);
        }
      } else if (r.modifie) {
        o[cle] = r.valeur;
        change = true;
      }
    }
    // Un avantage ambigu (dans l'une ou l'autre langue) est gardé en entier : jamais supprimé en
    // silence, jamais réécrit à moitié.
    if (ambigu) {
      sortie.push(it);
      continue;
    }
    if (retire) modifie = true;
    else {
      if (change) modifie = true;
      sortie.push(o);
    }
  }
  return { valeur: modifie ? sortie : perks, modifie, ambigus };
}

export function proposerOffre(l: LigneOffre): Proposition | null {
  const c = new Collecteur(`job_offer:${l.id}`, { controlerPorte2: false });
  if (SLUGS_OFFRES_ARCHIVEES.includes(l.slug)) {
    // Arbitrage 1 : poste que nous ne proposons pas → statut existant « archived », données gardées.
    if (l.status === "archived") return null;
    // Sauvegarde complète : statut ET tous les champs textuels d'origine (rien n'est supprimé).
    for (const k of CHAMPS_TEXTE_OFFRE) c.garder(k, (l as unknown as Champs)[k]);
    c.champ("status", l.status, "archived", true, []);
    return c.resultat("job_offer", l.id);
  }
  c.texte("titleFr", l.titleFr, "fr", true);
  c.texte("titleEn", l.titleEn, "en", true);
  c.texte("summaryFr", l.summaryFr, "fr");
  c.texte("summaryEn", l.summaryEn, "en");
  const fr = c.html("bodyFr", l.bodyFr, "fr");
  const en = c.html("bodyEn", l.bodyEn, "en");
  c.json("bodyJsonFr", l.bodyJsonFr, "fr");
  c.json("bodyJsonEn", l.bodyJsonEn, "en");
  if (fr !== null) reporterTexteBrut(c, "bodyTextFr", l.bodyTextFr, l.bodyFr, fr);
  else c.garder("bodyTextFr", l.bodyTextFr);
  if (en !== null) reporterTexteBrut(c, "bodyTextEn", l.bodyTextEn, l.bodyEn, en);
  else c.garder("bodyTextEn", l.bodyTextEn);
  c.texte("metaTitle", l.metaTitle, "fr", true);
  c.texte("metaDescription", l.metaDescription, "fr");
  if (l.perks !== undefined && l.perks !== null) {
    const p = reecrirePerks(l.perks);
    c.champ("perks", l.perks, p.valeur, p.modifie, p.ambigus);
  }
  return c.resultat("job_offer", l.id);
}

// ───────────────────────────── overrides, empreinte ─────────────────────────────

/** Champ HTML → champ de texte brut dérivé (recalculé quand le HTML est surchargé). */
const CHAMP_TEXTE_DU_CORPS: Record<string, string> = {
  body: "bodyText",
  bodyFr: "bodyTextFr",
  bodyEn: "bodyTextEn",
};

/**
 * Comme `appliquerOverrides`, mais aussi pour un contenu SANS proposition (déjà traité, plus aucune
 * mention) : un override présent est appliqué si son empreinte correspond, sinon signalé.
 */
export function integrerOverrides(
  p: Proposition | null,
  cle: string,
  originaux: Champs,
  overrides: Overrides,
): { proposition: Proposition | null; ignores: string[] } {
  if (p) return appliquerOverrides(p, originaux, overrides);
  if (!overrides[cle]) return { proposition: null, ignores: [] };
  const i = cle.indexOf(":");
  const vide: Proposition = {
    cle,
    table: cle.slice(0, i) as Table,
    id: cle.slice(i + 1),
    avant: {},
    apres: {},
    ambigus: [],
    conserves: [],
  };
  const r = appliquerOverrides(vide, originaux, overrides);
  return {
    proposition: Object.keys(r.proposition.apres).length > 0 ? r.proposition : null,
    ignores: r.ignores,
  };
}

/** Textes lisibles d'une valeur d'override (HTML → texte, JSON → chaînes hors liens/ids). */
const CLES_NON_TEXTE = new Set([
  "href",
  "src",
  "url",
  "id",
  "slug",
  "type",
  "class",
  "rel",
  "target",
]);
function textesDe(valeur: unknown): string[] {
  if (typeof valeur === "string")
    return [/<[a-z][\s\S]*>/i.test(valeur) ? htmlVersTexte(valeur) : valeur];
  if (Array.isArray(valeur)) return valeur.flatMap(textesDe);
  if (valeur && typeof valeur === "object")
    return Object.entries(valeur).flatMap(([k, v]) => (CLES_NON_TEXTE.has(k) ? [] : textesDe(v)));
  return [];
}

/** Mots non financiers que `valeur` fait disparaître de `origine` (porte 3, A8). */
function motsPerdus(origine: unknown, valeur: unknown): string[] {
  return [...new Set(motsNonRetirables(textesDe(origine).join(" "), textesDe(valeur).join(" ")))];
}

/**
 * Une valeur d'override est-elle PROPRE ? Elle repasse dans les mêmes règles que le contenu : si le
 * résultat n'est pas « propre » (mention restante, ambigu), l'override est ignoré. Rend la raison,
 * ou `null` si la valeur est propre.
 */
function valeurSale(champ: string, valeur: unknown): string | null {
  // Porte 2 : contrôle lexical strict, AVANT les règles de réécriture (A4).
  // V4-4 : tirets Unicode ramenés au tiret ASCII, espaces insécables à l'espace (sauts de ligne conservés).
  const texte = normaliserPourPorte2(textesDe(valeur).join("\n"));
  const interdit = INTERDITS_PUBLICS.exec(texte);
  if (interdit) return `interdit public « ${interdit[0]} »`;
  const langue: Langue = /En$/.test(champ) ? "en" : "fr";
  const r =
    champ === "perks"
      ? reecrirePerks(valeur)
      : typeof valeur === "string"
        ? CHAMP_TEXTE_DU_CORPS[champ] || /<[a-z][\s\S]*>/i.test(valeur)
          ? reecrireHtml(valeur, langue)
          : reecrireTexte(valeur, langue, { titre: /title/i.test(champ) })
        : Array.isArray(valeur) && /faq/i.test(champ)
          ? reecrireFaqs(valeur, langue)
          : reecrireJson(valeur, langue);
  const c = classer(r as { valeur: unknown; modifie: boolean; ambigus: string[] });
  if (c === "propre") {
    if (typeof valeur !== "string" && jsonContientMention(valeur)) return "mention dans le JSON";
    return null;
  }
  return c === "ambigu" ? "ambigu" : "à réécrire";
}

function reecrireFaqs(
  valeur: unknown[],
  langue: Langue,
): { valeur: unknown; modifie: boolean; ambigus: string[] } {
  let modifie = false;
  const ambigus: string[] = [];
  for (const it of valeur) {
    if (!it || typeof it !== "object") continue;
    const o = it as Record<string, unknown>;
    if (typeof o.question !== "string" || typeof o.answer !== "string") continue;
    const r = reecrireFaq({ question: o.question, reponse: o.answer }, langue);
    modifie = modifie || r.modifie;
    ambigus.push(...r.ambigus);
  }
  return { valeur, modifie, ambigus };
}

/**
 * « Conservé sur décision » (relecture des correctifs de l'essai à blanc n° 2, bloquant 1, voie 2). La
 * porte 2 refuse des textes légitimes du blog (« services financiers », « équipes juridiques, RH et
 * financières ») ; un override ordinaire ne peut jamais les garder (`valeurSale`). Une entrée qui porte
 * `admis` garde le champ TEL QUEL, et seulement si TOUT ce qui suit est vrai :
 *  1. `valeur` est strictement égale à l'original lu maintenant (et l'empreinte `origine` correspond) :
 *     cette voie ne réécrit rien, elle ne sert jamais à faire passer un autre texte ;
 *  2. tous les ambigus du champ sont des « mention restante (porte 2 : …) » : si le MOTEUR vise ou réécrit
 *     le champ, ce n'est pas un faux positif de la porte ;
 *  3. chaque terme que la porte 2 refuse dans la valeur figure, mot pour mot, dans `admis` ;
 *  4. aucun mot du lexique dur (`LEXIQUE_DUR`), ni dans la valeur, ni dans `admis`.
 * Rend la raison du refus, ou `null` si la conservation est acceptée.
 */
function refusDeConservation(
  p: Proposition,
  champ: string,
  o: { origine: string; valeur: unknown; admis?: unknown },
  courant: unknown,
): string | null {
  const admis = o.admis;
  if (
    !Array.isArray(admis) ||
    admis.length === 0 ||
    !admis.every((t) => typeof t === "string" && t.trim() !== "")
  )
    return "admis doit lister au moins un terme";
  if (empreinte(courant) !== o.origine) return "l'empreinte de l'original ne correspond plus";
  if (empreinte(o.valeur) !== empreinte(courant))
    return "valeur différente de l'original : une conservation ne réécrit rien";
  if (champ in p.apres) return "le moteur réécrit ce champ";
  const prefixe = `${p.cle}.${champ} : `;
  const duChamp = p.ambigus.filter((a) => a.startsWith(prefixe));
  if (duChamp.length === 0) return "aucun ambigu de porte 2 sur ce champ : rien à conserver";
  if (!duChamp.every((a) => a.startsWith(prefixe + MENTION_PORTE2)))
    return "un ambigu du moteur reste sur ce champ";
  const textes = textesDe(o.valeur);
  const dur = [...textes, ...(admis as string[])]
    .map((t) => LEXIQUE_DUR.exec(normaliserPourPorte2(t))?.[0])
    .find((x) => x !== undefined);
  if (dur !== undefined) return `mot du lexique dur « ${dur} »`;
  // Les deux lectures de la porte 2 : le champ entier (celle des overrides) et phrase à phrase (celle du filet).
  const refuses = new Set<string>(termesRefuses(textes.join("\n")));
  for (const t of textes)
    for (const ph of decouperPhrases(t)) for (const x of termesRefuses(ph)) refuses.add(x);
  const manquants = [...refuses].filter((t) => !(admis as string[]).includes(t));
  if (manquants.length > 0)
    return `terme(s) refusé(s) par la porte 2 absent(s) de admis (${manquants.join(", ")})`;
  return null;
}

/** Longueur de la citation dans un ambigu « mention restante (porte 2 : …) » du filet. */
const CITATION_PORTE2 = 160;

/**
 * Ambigus du champ levés par une conservation, sans le préfixe « clé.champ : », sur une ligne chacun. Une
 * citation coupée par le filet est remplacée par la phrase entière, retrouvée dans la valeur du champ ; si
 * elle est introuvable ou ne désigne pas une seule phrase, la coupure est signalée par « … ».
 */
function phrasesLevees(p: Proposition, champ: string, valeur: unknown): string[] {
  const prefixe = `${p.cle}.${champ} : `;
  const phrases = textesDe(valeur).flatMap((t) => decouperPhrases(t));
  return p.ambigus
    .filter((a) => a.startsWith(prefixe))
    .map((a) => {
      const message = a.slice(prefixe.length);
      const i = message.indexOf(") : « ");
      if (i < 0 || !message.endsWith(" »")) return message;
      const cite = message.slice(i + 6, -2);
      let phrase = cite;
      if (cite.length >= CITATION_PORTE2) {
        const entieres = [
          ...new Set(phrases.filter((ph) => ph.slice(0, CITATION_PORTE2) === cite)),
        ];
        phrase = entieres.length === 1 ? entieres[0]! : `${cite}…`;
      }
      return `${message.slice(0, i + 6)}${phrase} »`;
    })
    .map((m) => m.replace(/\s+/g, " ").trim());
}

/**
 * Applique les remplacements humains aux cas ambigus. Un override n'est pris que si l'empreinte
 * de la valeur d'ORIGINE correspond à la valeur lue maintenant : si le texte a changé depuis,
 * il est ignoré et signalé (jamais appliqué à l'aveugle).
 */
export function appliquerOverrides(
  p: Proposition,
  originaux: Champs,
  overrides: Overrides,
): { proposition: Proposition; ignores: string[] } {
  const surcharges = overrides[p.cle];
  if (!surcharges) return { proposition: p, ignores: [] };
  const avant = { ...p.avant };
  const apres = { ...p.apres };
  const ignores: string[] = [];
  const appliques: string[] = [];
  const pertes: Record<string, string[]> = { ...(p.pertes ?? {}) };
  const resynchro: string[] = [];
  const conserves: Record<string, string[]> = { ...(p.conservesSurDecision ?? {}) };
  const phrasesConservees: Record<string, string[]> = { ...(p.phrasesConservees ?? {}) };
  for (const [champ, o] of Object.entries(surcharges)) {
    if (o.valeur === "" || o.valeur === null || o.valeur === undefined) {
      ignores.push(`${p.cle}.${champ} : valeur vide (gabarit non rempli), override ignoré`);
      continue;
    }
    // Voie « conservé sur décision » : une entrée qui porte `admis` ne passe JAMAIS par la voie ordinaire.
    if (o.admis !== undefined) {
      const refus = refusDeConservation(
        p,
        champ,
        o,
        champ in originaux ? originaux[champ] : undefined,
      );
      if (refus)
        ignores.push(
          `${p.cle}.${champ} : conservation sur décision refusée (${refus}), override ignoré`,
        );
      else {
        conserves[champ] = [...o.admis];
        phrasesConservees[champ] = phrasesLevees(p, champ, o.valeur);
      }
      continue;
    }
    const sale = valeurSale(champ, o.valeur);
    if (sale) {
      ignores.push(
        `${p.cle}.${champ} : l'override contient encore une mention de financement (non propre : ${sale}), override ignoré`,
      );
      continue;
    }
    const courant = champ in originaux ? originaux[champ] : undefined;
    if (empreinte(courant) !== o.origine) {
      ignores.push(
        `${p.cle}.${champ} : l'empreinte de l'original ne correspond plus, override ignoré`,
      );
      continue;
    }
    // Porte 3 : aucun mot non financier perdu hors de `pertesAcceptees` (A8). La perte est explicite.
    const perdus = motsPerdus(courant, o.valeur);
    const acceptes = new Set(motsDe((o.pertesAcceptees ?? []).join(" ")));
    const nonAcceptes = perdus.filter((m) => !acceptes.has(m));
    if (nonAcceptes.length > 0) {
      ignores.push(
        `${p.cle}.${champ} : mots non financiers perdus et absents de pertesAcceptees (${nonAcceptes.slice(0, 8).join(", ")}), override ignoré`,
      );
      continue;
    }
    avant[champ] = courant;
    apres[champ] = o.valeur;
    appliques.push(champ);
    if (perdus.length > 0) pertes[champ] = perdus;
    // Le corps réécrit à la main redevient la source du texte brut : le bodyText* STOCKÉ reçoit les
    // seuls passages modifiés (A1), sinon il garderait le passage ambigu (indexation, recherche).
    const texte = CHAMP_TEXTE_DU_CORPS[champ];
    if (texte && typeof originaux[texte] === "string" && typeof o.valeur === "string") {
      const nouveau = reporterDansTexteBrut(
        originaux[texte] as string,
        typeof courant === "string" ? courant : "",
        o.valeur,
      );
      if (nouveau === null) {
        resynchro.push(
          `${p.cle}.${texte} : bodyText à resynchroniser : passage modifié par l'override introuvable, ou présent plusieurs fois, dans le texte brut stocké`,
        );
      } else {
        avant[texte] = originaux[texte];
        apres[texte] = nouveau;
        appliques.push(texte);
      }
    }
  }
  const ambigus = [
    ...p.ambigus.filter(
      (a) =>
        !Object.keys(surcharges).some(
          (champ) =>
            a.startsWith(`${p.cle}.${champ} :`) && !ignores.some((i) => i.includes(`.${champ} :`)),
        ) &&
        // Le bodyText resynchronisé par l'override n'est plus à resynchroniser.
        !appliques.some((champ) => a.startsWith(`${p.cle}.${champ} :`)),
    ),
    ...resynchro,
  ];
  return {
    proposition: {
      ...p,
      avant,
      apres,
      ambigus,
      surcharges: [...(p.surcharges ?? []), ...appliques],
      ...(Object.keys(pertes).length > 0 ? { pertes } : {}),
      ...(Object.keys(conserves).length > 0 ? { conservesSurDecision: conserves } : {}),
      ...(Object.keys(phrasesConservees).length > 0 ? { phrasesConservees } : {}),
    },
    ignores,
  };
}

export interface AmbiguRestant {
  cle: string;
  champ: string;
  message: string;
}

/** Ambigus non couverts par un override : l'application est refusée tant qu'il en reste. */
export function ambigusNonCouverts(propositions: readonly Proposition[]): AmbiguRestant[] {
  const out: AmbiguRestant[] = [];
  for (const p of propositions)
    for (const a of p.ambigus) {
      const reste = a.startsWith(`${p.cle}.`) ? a.slice(p.cle.length + 1) : a;
      const i = reste.indexOf(" : ");
      out.push({
        cle: p.cle,
        champ: i < 0 ? reste : reste.slice(0, i),
        message: i < 0 ? "" : reste.slice(i + 3),
      });
    }
  return out;
}

/** `--apply` : lève une erreur claire tant qu'un ambigu n'est pas couvert par un override. */
export function refuserSiAmbigus(
  propositions: readonly Proposition[],
  source: string | null,
): void {
  const restants = ambigusNonCouverts(propositions);
  if (restants.length === 0) return;
  const ids = [...new Set(restants.map((x) => `${x.cle}.${x.champ}`))];
  throw new Error(
    `--apply REFUSÉ : ${restants.length} ambigu(s) non couvert(s) par ${source ?? "retrait-financement-overrides.json"} ` +
      `(${ids.slice(0, 5).join(", ")}${ids.length > 5 ? ", …" : ""}). ` +
      "Le rapport (--report) liste chaque passage complet et le gabarit JSON à remplir.",
  );
}

/**
 * Gabarit JSON à remplir dans `retrait-financement-overrides.json` : une entrée par (contenu, champ)
 * ambigu, avec l'empreinte de l'original ; `valeur` (texte FINAL du champ) est à écrire à la main.
 */
const QUESTION_DE_REPONSE: Record<string, string> = {
  answerFr: "questionFr",
  answerEn: "questionEn",
};

export function gabaritOverrides(propositions: readonly Proposition[]): Overrides {
  const g: Overrides = {};
  for (const r of ambigusNonCouverts(propositions)) {
    const p = propositions.find((x) => x.cle === r.cle);
    if (!p || !(r.champ in p.avant)) continue;
    (g[r.cle] ??= {})[r.champ] = { origine: empreinte(p.avant[r.champ]), valeur: "" };
    // A7 : la question d'une FAQ de financement doit être surchargée AVEC la réponse, sinon elle
    // reste publiée (et dans `faqJson` du parent).
    const q = QUESTION_DE_REPONSE[r.champ];
    if (p.table === "faq" && q && q in p.avant) {
      const texteQ = p.avant[q];
      if (typeof texteQ === "string" && questionParleDeFinancement(texteQ))
        (g[r.cle] ??= {})[q] ??= { origine: empreinte(texteQ), valeur: "" };
    }
  }
  return g;
}

/**
 * Restauration : on ne remet QUE les champs que le script a écrits (clés de `apres`), avec leur
 * valeur d'origine tirée de la sauvegarde complète (`avant`). Les autres champs, éventuellement
 * modifiés à la main depuis, ne sont jamais touchés. Compatible avec les anciennes sauvegardes
 * (qui ne portaient que les champs modifiés).
 */
export function champsARestaurer(avant: Champs, apres: Champs): Champs {
  const out: Champs = {};
  for (const k of Object.keys(apres)) out[k] = avant[k] === undefined ? null : avant[k];
  return out;
}

/**
 * Empreinte du plan : (clé, valeurs après) triés. `apply` exige la même que l'essai à blanc.
 *
 * Deuxième relecture, remarque 3 : les champs « conservés sur décision » entrent dans l'empreinte, en paires
 * (clé, champs et termes admis) triées — une entrée `admis` ajoutée, retirée ou modifiée après l'essai à
 * blanc fait refuser l'apply. Sans aucune conservation, l'empreinte est EXACTEMENT celle d'avant (même
 * valeur hachée) : un essai à blanc sans entrée `admis` garde son `PLAN_SHA`.
 */
export function empreintePlan(propositions: readonly Proposition[]): string {
  const tri = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
  const stable = [...propositions]
    .filter((p) => Object.keys(p.apres).length > 0)
    .sort((a, b) => a.cle.localeCompare(b.cle))
    .map((p) => [p.cle, p.apres]);
  const conserves = propositions
    .filter((p) => Object.keys(p.conservesSurDecision ?? {}).length > 0)
    .map((p) => [
      p.cle,
      Object.entries(p.conservesSurDecision ?? {})
        .map(([champ, termes]) => [champ, [...termes].sort(tri)] as [string, string[]])
        .sort((a, b) => tri(a[0], b[0])),
    ])
    .sort((a, b) => tri(a[0] as string, b[0] as string));
  return conserves.length === 0 ? empreinte(stable) : empreinte({ apres: stable, conserves });
}

export function resume(propositions: readonly Proposition[]): {
  a_reecrire: number;
  ambigus: number;
  /** Ambigus qui portent AUSSI une réécriture partielle (déjà dans `ambigus`, jamais dans `a_reecrire`). */
  partiels: number;
  total: number;
} {
  let aReecrire = 0;
  let ambigus = 0;
  let partiels = 0;
  for (const p of propositions) {
    const classe = classer({
      valeur: null,
      modifie: Object.keys(p.apres).length > 0,
      ambigus: p.ambigus,
    });
    if (classe === "ambigu") ambigus++;
    else if (classe === "a-reecrire") aReecrire++;
    if (classe === "ambigu" && Object.keys(p.apres).length > 0) partiels++;
  }
  return { a_reecrire: aReecrire, ambigus, partiels, total: propositions.length };
}

/** Rapport de restauration : clés et noms de champs seulement (aucun contenu). */
export function rapportRestauration(r: {
  restaures: number;
  divergences: string[];
  lignes: string[];
}): string {
  const l = [
    "# Retrait des mentions de financement — restore",
    "",
    `Contenus restaurés : ${r.restaures}`,
    "",
    "## Restaurés",
    ...r.lignes.map((x) => `- ${x}`),
    "",
    "## Divergences (non restaurés)",
    ...r.divergences.map((x) => `- ${x}`),
  ];
  return `${l.join("\n")}\n`;
}
