/**
 * Retrait des mentions de financement — construction du PLAN (pur, sans base de données).
 *
 * Le script `scripts/content-gen/retrait-mentions-financement.ts` lit les lignes, appelle ces
 * fonctions et écrit. Tout ce qui décide du texte est ici, donc testable.
 */
import { createHash } from "node:crypto";
import {
  type Langue,
  classer,
  estVisee,
  htmlVersTexte,
  reecrireFaq,
  reecrireHtml,
  reecrireJson,
  reecrireTexte,
} from "./regles";

export const ACTION_RETRAIT = "retrait-financement-2026-11";
export const ACTION_RESTAURATION = "retrait-financement-2026-11-restauration";

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
}

/** Valeurs de remplacement validées par un humain pour un cas ambigu. */
export type Overrides = Record<string, Record<string, { origine: string; valeur: unknown }>>;

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

class Collecteur {
  avant: Champs = {};
  apres: Champs = {};
  ambigus: string[] = [];
  conserves: string[] = [];

  constructor(private readonly nom: string) {}

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
  }

  texte(champ: string, valeur: string | null | undefined, langue: Langue, titre = false): void {
    this.garder(champ, valeur);
    if (typeof valeur !== "string" || valeur === "") return;
    this.conserves.push(...conservees(valeur));
    const r = reecrireTexte(valeur, langue, { titre });
    this.champ(champ, valeur, r.valeur, r.modifie, r.ambigus);
  }

  html(champ: string, valeur: string | null | undefined, langue: Langue): string | null {
    this.garder(champ, valeur);
    if (typeof valeur !== "string" || valeur === "") return null;
    this.conserves.push(...conservees(htmlVersTexte(valeur)));
    const r = reecrireHtml(valeur, langue);
    this.champ(champ, valeur, r.valeur, r.modifie, r.ambigus);
    return r.modifie ? r.valeur : null;
  }

  json(champ: string, valeur: unknown, langue: Langue): void {
    this.garder(champ, valeur);
    if (valeur === null || valeur === undefined) return;
    const r = reecrireJson(valeur, langue);
    this.champ(champ, valeur, r.valeur, r.modifie, r.ambigus);
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
  const c = new Collecteur(`article_translation:${l.id}`);
  const langue: Langue = l.locale;
  c.texte("title", l.title, langue, true);
  c.texte("excerpt", l.excerpt, langue);
  const corps = c.html("body", l.body, langue);
  c.json("bodyJson", l.bodyJson, langue);
  if (corps !== null) c.champ("bodyText", l.bodyText, htmlVersTexte(corps), true, []);
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
  const c = new Collecteur(`article:${l.id}`);
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
      const r = reecrireFaq({ question: o.question, reponse: o.answer }, "fr");
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
  const c = new Collecteur(`faq:${l.id}`);
  for (const [langue, q, a, kq, ka] of [
    ["fr", l.questionFr, l.answerFr, "questionFr", "answerFr"],
    ["en", l.questionEn, l.answerEn, "questionEn", "answerEn"],
  ] as const) {
    const r = reecrireFaq({ question: q, reponse: a }, langue);
    c.champ(kq, q, r.valeur.question, r.valeur.question !== q, r.ambigus);
    c.champ(ka, a, r.valeur.reponse, r.valeur.reponse !== a, []);
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

/**
 * Avantages (`perks`) : un avantage dont le libellé parle de financement est retiré ; un libellé
 * qui ne contient qu'un fragment (« (CPF) ») est nettoyé. Tableau vide possible (la page masque
 * alors le bloc).
 */
export function reecrirePerks(perks: unknown): { valeur: unknown; modifie: boolean } {
  if (!Array.isArray(perks)) return { valeur: perks, modifie: false };
  let modifie = false;
  const sortie: unknown[] = [];
  for (const it of perks as unknown[]) {
    if (!it || typeof it !== "object") {
      sortie.push(it);
      continue;
    }
    const o = { ...(it as Record<string, unknown>) };
    let retire = false;
    for (const [cle, langue] of [
      ["labelFr", "fr"],
      ["labelEn", "en"],
    ] as const) {
      const v = o[cle];
      if (typeof v !== "string") continue;
      const r = reecrireTexte(v, langue);
      if (r.ambigus.length > 0) retire = true;
      else if (r.modifie) {
        o[cle] = r.valeur;
        modifie = true;
      }
    }
    if (retire) modifie = true;
    else sortie.push(o);
  }
  return { valeur: modifie ? sortie : perks, modifie };
}

export function proposerOffre(l: LigneOffre): Proposition | null {
  const c = new Collecteur(`job_offer:${l.id}`);
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
  if (fr !== null) c.champ("bodyTextFr", l.bodyTextFr, htmlVersTexte(fr), true, []);
  else c.garder("bodyTextFr", l.bodyTextFr);
  if (en !== null) c.champ("bodyTextEn", l.bodyTextEn, htmlVersTexte(en), true, []);
  else c.garder("bodyTextEn", l.bodyTextEn);
  c.texte("metaTitle", l.metaTitle, "fr", true);
  c.texte("metaDescription", l.metaDescription, "fr");
  if (l.perks !== undefined && l.perks !== null) {
    const p = reecrirePerks(l.perks);
    c.champ("perks", l.perks, p.valeur, p.modifie, []);
  }
  return c.resultat("job_offer", l.id);
}

// ───────────────────────────── overrides, empreinte ─────────────────────────────

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
  for (const [champ, o] of Object.entries(surcharges)) {
    const courant = champ in originaux ? originaux[champ] : undefined;
    if (empreinte(courant) !== o.origine) {
      ignores.push(
        `${p.cle}.${champ} : l'empreinte de l'original ne correspond plus, override ignoré`,
      );
      continue;
    }
    avant[champ] = courant;
    apres[champ] = o.valeur;
  }
  const ambigus = p.ambigus.filter(
    (a) =>
      !Object.keys(surcharges).some(
        (champ) =>
          a.startsWith(`${p.cle}.${champ} :`) && !ignores.some((i) => i.includes(`.${champ} :`)),
      ),
  );
  return { proposition: { ...p, avant, apres, ambigus }, ignores };
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

/** Empreinte du plan : (clé, valeurs après) triés. `apply` exige la même que l'essai à blanc. */
export function empreintePlan(propositions: readonly Proposition[]): string {
  const stable = [...propositions]
    .filter((p) => Object.keys(p.apres).length > 0)
    .sort((a, b) => a.cle.localeCompare(b.cle))
    .map((p) => [p.cle, p.apres]);
  return empreinte(stable);
}

export function resume(propositions: readonly Proposition[]): {
  a_reecrire: number;
  ambigus: number;
  total: number;
} {
  let aReecrire = 0;
  let ambigus = 0;
  for (const p of propositions) {
    const classe = classer({
      valeur: null,
      modifie: Object.keys(p.apres).length > 0,
      ambigus: p.ambigus,
    });
    if (classe === "ambigu") ambigus++;
    else if (classe === "a-reecrire") aReecrire++;
    if (classe === "ambigu" && Object.keys(p.apres).length > 0) aReecrire++;
  }
  return { a_reecrire: aReecrire, ambigus, total: propositions.length };
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
