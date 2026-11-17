/**
 * Détection des règles du châssis e-mail — lot S1 (« Mesurer et garder »).
 *
 * Ce fichier ne contient AUCUN test : il porte les fonctions de mesure que
 * `chassis-regles.spec.tsx` applique aux 160+ gabarits, et que les tests du test
 * appliquent à de faux gabarits. Les fonctions sont pures (chaînes en entrée),
 * sauf `mesurerGabarit` qui reçoit la fonction de rendu : un faux rendu suffit
 * donc à vérifier qu'une règle rougit bien quand elle doit.
 *
 * Source : `emails-site/PLAN-STRUCTURE-ACCUSES.md` §2.2 (règles) et §2.4 (gardes).
 */

import { EMAIL_SIGNATURE } from "../../legal-footer";

/** Les huit règles à cliquet, dans l'ordre du plan §2.4. */
export const REGLES = [
  "nonMigre",
  "salutationHorsOuverture",
  "salutationNomComplet",
  "signatureDansLeCorps",
  "repondezDansLeCorps",
  "delaiEnDur",
  "valeurTechnique",
  "vocabulaire",
] as const;
export type Regle = (typeof REGLES)[number];

/** Ordre imposé des blocs rendus (plan §2.2-3). `titre` s'y ajoute : le grand titre existe encore. */
export const ORDRE_BLOCS = [
  "surtitre",
  "titre",
  "ouverture",
  "debut-corps",
  "fin-corps",
  "action",
  "lienEspace",
  "bandeau",
  "partage",
  "pas-vous",
  "soupape",
  "politesse",
  "signature",
  "pied",
] as const;

/** Sentinelle des valeurs techniques : jamais lisible dans un texte, seulement dans un `href`. */
export const SENTINELLE_TECHNIQUE = "ZZTECHZZ";

/** Nom complet de la charge d'exemple (`PAYLOAD_EXEMPLE.contactName`). */
export const NOM_COMPLET_EXEMPLE = "Camille Dupont";

export interface Rendu {
  readonly subject?: string;
  readonly html: string;
  readonly text: string;
}

/** Fonction de rendu injectée : `(charge, locale) → rendu`. Le test réel passe `renderEmailTemplate`. */
export type Rendre = (charge: Record<string, unknown>, locale: "fr" | "en") => Promise<Rendu>;

// ─────────────────────────────────────────────────────────────────────────────
// Lecture du HTML
// ─────────────────────────────────────────────────────────────────────────────

const ENTITES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  rsquo: "’",
  lsquo: "‘",
  laquo: "«",
  raquo: "»",
  hellip: "…",
  ndash: "–",
  mdash: "—",
  eacute: "é",
  egrave: "è",
  agrave: "à",
};

export function decoderEntites(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, n: string) => ENTITES[n.toLowerCase()] ?? m);
}

/** Balises qui coupent un paragraphe. Le plan dit `<p` et `<br` ; les autres blocs ne font que durcir. */
const COUPURE = /<\s*(?:p|br|div|li|tr|td|h[1-6]|table|hr)\b[^>]*>/gi;

/** Texte lisible d'un fragment HTML : balises retirées, entités décodées, espaces repliés. */
export function texteDe(fragment: string): string {
  return decoderEntites(fragment.replace(/<[^>]*>/g, ""))
    .replace(/[\s ]+/g, " ")
    .trim();
}

/** Découpe un fragment HTML en paragraphes de texte non vides. */
export function paragraphes(fragment: string): string[] {
  return fragment
    .replace(COUPURE, "\n")
    .split("\n")
    .map(texteDe)
    .filter((p) => p.length > 0);
}

/** Tranche du HTML entre les repères `debut-corps` et `fin-corps`. `null` si absents. */
export function corpsHtml(html: string): string | null {
  const debut = /<span[^>]*data-bloc="debut-corps"[^>]*>(?:\s*<\/span>)?/.exec(html);
  const fin = /<span[^>]*data-bloc="fin-corps"[^>]*>/.exec(html);
  if (!debut || !fin || fin.index < debut.index) return null;
  return html.slice(debut.index + debut[0].length, fin.index);
}

export function corpsParagraphes(html: string): string[] {
  const corps = corpsHtml(html);
  return corps === null ? [] : paragraphes(corps);
}

/** Pré-en-tête : le texte de `<Preview>` (div masquée, sautée du rendu texte), sans son bourrage invisible. */
export function preEnTete(html: string): string | null {
  const m = /<div[^>]*data-skip-in-text="true"[^>]*>([^<]*)/.exec(html);
  if (!m) return null;
  const t = texteDe(m[1] ?? "")
    .replace(/[​-‏⁠﻿͏]/g, "")
    .trim();
  return t.length > 0 ? t : null;
}

/** Noms des `data-bloc` présents, dans l'ordre du document. */
export function blocsPresents(html: string): string[] {
  return [...html.matchAll(/data-bloc="([^"]+)"/g)].map((m) => m[1] as string);
}

// ─────────────────────────────────────────────────────────────────────────────
// Détecteurs (une règle = une fonction pure)
// ─────────────────────────────────────────────────────────────────────────────

export const SALUTATION_DANS_LE_CORPS = /\b(Bonjour|Bonsoir|Hello|Hi)\b/;
export const SALUTATION_ISOLEE = /^(bonjour|bonsoir|hello|hi)\b[^.!?]{0,40}[,.]?$/i;
export const SALUTATION_AU_DEBUT = /^\s*(bonjour|bonsoir|hello|hi)\b/i;
export const SIGNATURE_DANS_LE_CORPS =
  /cordialement|à très vite|l['’]équipe axion|kind regards|best regards|cabinet ia/i;
export const REPONDEZ_DANS_LE_CORPS =
  /r[ée]pondez( simplement)? à cet e-?mail|reply to this e-?mail/i;
export const DELAI_EN_DUR =
  /\b(sous|dans|d['’]ici|en|within|under)\s+\d+\s*(h|heures?|jours?|semaines?|minutes?|hours?|days?|weeks?)\b|jours ouvrés|business days|\d+\s*(à|-)\s*\d+\s*(jours|semaines|weeks|days)/i;

export const lignesSalutationIsolee = (paras: readonly string[]): string[] =>
  paras.filter((p) => SALUTATION_ISOLEE.test(p));

/** `\bemail\b` hors adresses et URL ; `Axion IA` sans tiret ; `IA custom`. */
export function vocabulaireFautif(paras: readonly string[]): boolean {
  const texte = paras
    .join("\n")
    .replace(/\S+@\S+/g, " ")
    .replace(/https?:\/\/\S+/g, " ");
  return /\bemail\b/.test(texte) || /Axion IA\b/.test(texte) || /IA custom/.test(texte);
}

/** Charge de test : toute clé `id`, `*Id`, `jobId`, `token`, `jeton` prend la sentinelle. */
export function chargeAvecSentinelles(charge: Record<string, unknown>): Record<string, unknown> {
  const sortie: Record<string, unknown> = { ...charge };
  for (const cle of Object.keys(sortie)) {
    if (/^(id|jobId|token|jeton)$/.test(cle) || /Id$/.test(cle)) {
      sortie[cle] = SENTINELLE_TECHNIQUE;
    }
  }
  return sortie;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mesure d'un gabarit
// ─────────────────────────────────────────────────────────────────────────────

export interface OptionsMesure {
  /** Gabarits dont une durée en dur est justifiée par une constante (`exceptionsDurees`). */
  readonly delaiTolere?: boolean;
}

/**
 * Ensemble des règles que ce gabarit viole. Mesure en fr et en en : une
 * violation dans l'une ou l'autre compte, sauf `vocabulaire`, propre au français.
 */
export async function mesurerGabarit(
  rendre: Rendre,
  charge: Record<string, unknown>,
  options: OptionsMesure = {},
): Promise<Set<Regle>> {
  const violees = new Set<Regle>();
  for (const locale of ["fr", "en"] as const) {
    const { html, text } = await rendre(charge, locale);
    const paras = corpsParagraphes(html);
    const corps = paras.join("\n");

    if (!html.includes("data-destinataire=")) violees.add("nonMigre");
    if (SALUTATION_DANS_LE_CORPS.test(corps)) violees.add("salutationHorsOuverture");
    if (new RegExp(`(Bonjour|Hello)[^.\\n]{0,25}${NOM_COMPLET_EXEMPLE}`).test(text)) {
      violees.add("salutationNomComplet");
    }
    if (SIGNATURE_DANS_LE_CORPS.test(corps) || corps.includes(EMAIL_SIGNATURE.fullName)) {
      violees.add("signatureDansLeCorps");
    }
    if (REPONDEZ_DANS_LE_CORPS.test(corps)) violees.add("repondezDansLeCorps");
    if (options.delaiTolere !== true && DELAI_EN_DUR.test(corps)) violees.add("delaiEnDur");
    if (locale === "fr" && vocabulaireFautif(paras)) violees.add("vocabulaire");

    // Valeur technique : un second rendu, où les identifiants valent la sentinelle. Elle ne doit
    // apparaître dans aucun texte (sujet et pré-en-tête compris), seulement dans un `href`.
    const sentinelle = await rendre(chargeAvecSentinelles(charge), locale);
    const lisible = [
      sentinelle.subject ?? "",
      preEnTete(sentinelle.html) ?? "",
      ...corpsParagraphes(sentinelle.html),
    ].join("\n");
    if (lisible.includes(SENTINELLE_TECHNIQUE)) violees.add("valeurTechnique");
  }
  return violees;
}

// ─────────────────────────────────────────────────────────────────────────────
// Gardes dures mesurées sur le rendu
// ─────────────────────────────────────────────────────────────────────────────

/** G-preheader : le pré-en-tête ne commence pas par une salutation. Rend la faute, ou null. */
export function fautePreEnTete(html: string): string | null {
  const p = preEnTete(html);
  return p !== null && SALUTATION_AU_DEBUT.test(p) ? p : null;
}

/** G-ordre : les `data-bloc` présents sont connus et strictement croissants selon `ORDRE_BLOCS`. */
export function fauteOrdre(html: string): string | null {
  const presents = blocsPresents(html);
  let dernier = -1;
  for (const b of presents) {
    const i = (ORDRE_BLOCS as readonly string[]).indexOf(b);
    if (i < 0) return `bloc inconnu « ${b} »`;
    if (i === dernier && b === "partage") continue; // avis et parrainage peuvent coexister
    if (i <= dernier) return `« ${b} » hors d'ordre (${presents.join(" > ")})`;
    dernier = i;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cliquet à deux sens
// ─────────────────────────────────────────────────────────────────────────────

export interface EcartCliquet {
  /** Violations constatées mais absentes de la liste : une régression. */
  readonly aCorriger: string[];
  /** Gabarits listés qui ne violent plus la règle : à retirer de la liste. */
  readonly aRetirer: string[];
}

export function ecartCliquet(constat: Iterable<string>, dette: Iterable<string>): EcartCliquet {
  const c = new Set(constat);
  const d = new Set(dette);
  return {
    aCorriger: [...c].filter((x) => !d.has(x)).sort(),
    aRetirer: [...d].filter((x) => !c.has(x)).sort(),
  };
}

export function messageCliquet(groupe: string, regle: Regle, e: EcartCliquet): string {
  const morceaux: string[] = [];
  if (e.aCorriger.length > 0) {
    morceaux.push(
      `${groupe}.${regle} : ${e.aCorriger.join(", ")} viole(nt) la règle sans être listé(s). ` +
        `Corrigez le gabarit : ne l'ajoutez jamais à la liste, elle ne fait que diminuer.`,
    );
  }
  if (e.aRetirer.length > 0) {
    morceaux.push(
      `${groupe}.${regle} : ${e.aRetirer.join(", ")} est/sont désormais conforme(s) : ` +
        `retirez-le(s) de la liste (le cliquet se resserre, il ne se rouvre pas).`,
    );
  }
  return morceaux.join("\n");
}
