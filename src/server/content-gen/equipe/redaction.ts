/**
 * Rédacteur « pas de chiffre sans preuve » (équipe éditoriale, PR 6), derrière
 * `CONTENT_EQUIPE_EDITORIALE`.
 *
 * Module PUR : consigne d'écriture + contrôles du texte rédigé. La consigne reçoit le plan validé
 * (`equipe/plan.ts`) et le dossier de preuves de la phase A du vérificateur. Règle : aucun chiffre
 * sans preuve du dossier ; sans preuve, on écrit sans chiffre ; le prix passe uniquement par le
 * jeton de `brand/consigne-prix.ts`. Interrupteur éteint : consigne vide, aucun contrôle neuf.
 *
 * Les contrôles de structure et de longueur réutilisent l'existant (`compterH2`,
 * `PLANCHER_MOTS_RELECTURE`, `computeReadabilityFr`, `detecterTutoiement`).
 */

import { JETON_PRIX_JOURNEE_IA } from "../brand/consigne-prix";
import {
  equipeEditorialeActive,
  type EnvEquipeEditoriale,
} from "../fact-check/equipe-editoriale-drapeau";
import type { DossierPreuves } from "../fact-check/verificateur-deux-phases";
import { compterH2, PLANCHER_MOTS_RELECTURE } from "../quality/barrieres-publication";
import { computeReadabilityFr } from "../quality/readability";
import { detecterTutoiement } from "../quality/vouvoiement";

/** Plan minimal : un `Plan` validé (PR 5) convient, de même que le plan issu du générateur. */
export interface PlanRedaction {
  readonly sections: ReadonlyArray<{ readonly h2: string; readonly preuve?: string | undefined }>;
}

/** Moyenne maximale de mots par phrase (contrôle de lisibilité). */
export const MOTS_PAR_PHRASE_MAX = 20;

export interface ContexteRedaction {
  readonly plan?: PlanRedaction | undefined;
  readonly dossier?: DossierPreuves | undefined;
  readonly datePublication?: Date | undefined;
}

export interface ProblemeRedaction {
  readonly code:
    | "chiffre-hors-dossier"
    | "h2-hors-plan"
    | "mots-insuffisants"
    | "phrases-trop-longues"
    | "tutoiement";
  readonly message: string;
  readonly passages?: ReadonlyArray<string>;
}

export interface ResultatRedaction {
  readonly issues: ReadonlyArray<ProblemeRedaction>;
}

// ── Consigne d'écriture ─────────────────────────────────────────────────────

export function consigneRedactionEquipe(
  ctx: ContexteRedaction,
  env: EnvEquipeEditoriale = process.env,
): string {
  if (!equipeEditorialeActive(env)) return "";
  const preuves = ctx.dossier?.preuves ?? [];
  const lignes: string[] = [
    "",
    "## Règle d'écriture — pas de chiffre sans preuve (obligatoire)",
    "- N'écris AUCUN chiffre (pourcentage, montant, année, effectif, délai chiffré) qui ne figure pas dans le dossier de preuves ci-dessous.",
    "- S'il manque une preuve pour une affirmation, écris la phrase SANS chiffre.",
    `- Le prix s'écrit uniquement par le jeton \`${JETON_PRIX_JOURNEE_IA}\`, jamais en chiffres.`,
    "- Vouvoie le lecteur ; phrases de 20 mots en moyenne au plus ; respecte les <h2> du plan, dans l'ordre.",
  ];
  if (ctx.plan) {
    lignes.push("", "### Plan validé");
    ctx.plan.sections.forEach((s, i) => {
      lignes.push(`${i + 1}. ${s.h2}${s.preuve ? ` (preuve : ${s.preuve})` : ""}`);
    });
  }
  lignes.push("", "### Dossier de preuves");
  if (preuves.length === 0) {
    lignes.push("(aucune preuve disponible : écris tout le texte sans aucun chiffre)");
  } else {
    for (const p of preuves) {
      lignes.push(`- ${p.affirmation}${p.chiffre ? ` — chiffre : ${p.chiffre}` : ""} (${p.url})`);
    }
  }
  return `${lignes.join("\n")}\n`;
}

// ── Contrôle « chiffre absent du dossier » ──────────────────────────────────

const NBSP = /[   ]/g;
const NOMBRE = String.raw`\d+(?:[ .,]\d{3})*(?:[,.]\d+)?`;
const UNITES = String.raw`(?:%|€|eur(?:os?)?\b|k€|m€|millions?|milliards?|salari[ée]s?|employ[ée]s?|collaborateurs?|personnes|entreprises|pme|tpe|postes|utilisateurs|clients)`;
const MOTIF_CHIFFRE = new RegExp(
  `(?<![\\p{L}\\p{N}])(?:(${NOMBRE})\\s?${UNITES}|((?:19|20)\\d{2})(?![\\p{L}\\p{N}]))`,
  "giu",
);

const sansBalises = (html: string): string =>
  html
    .replace(/\{\{[^}]*\}\}/g, " ")
    .replace(/<(h[1-6])\b[^>]*>\s*(?:\d+\s*[.)\-:]\s*)/gi, "<$1>")
    .replace(/<\/(p|li|h[1-6]|div|td|th|blockquote)>/gi, ". ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(NBSP, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Forme canonique d'un nombre : chiffres seuls, virgule → point. */
function canonique(brut: string): string {
  const n = brut.replace(/\s/g, "").replace(",", ".");
  return n.includes(".") ? String(Number(n)) : n.replace(/^0+(?=\d)/, "");
}

function nombresDe(texte: string): Set<string> {
  const t = texte.replace(NBSP, " ");
  const out = new Set<string>();
  for (const m of t.matchAll(/\d+(?:[ ]\d{3})*(?:[,.]\d+)?/g)) {
    out.add(canonique(m[0]));
    // « 1 490 » mal lu en « 1 » + « 490 » : on garde aussi les groupes isolés.
    for (const g of m[0].split(" ")) out.add(canonique(g));
  }
  return out;
}

/** Liste des passages (phrases) contenant un chiffre absent du dossier. */
export function chiffresHorsDossier(
  html: string,
  dossier: DossierPreuves | undefined,
  opts: { datePublication?: Date } = {},
): string[] {
  const permis = new Set<string>();
  for (const p of dossier?.preuves ?? []) {
    for (const champ of [p.chiffre ?? "", p.affirmation, p.extrait]) {
      for (const n of nombresDe(champ)) permis.add(n);
    }
  }
  const anneePub = opts.datePublication ? String(opts.datePublication.getUTCFullYear()) : null;
  const passages: string[] = [];
  const phrases = sansBalises(html)
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const phrase of phrases) {
    for (const m of phrase.matchAll(MOTIF_CHIFFRE)) {
      const valeur = canonique(m[1] ?? m[2] ?? "");
      if (!m[1] && valeur === anneePub) continue;
      if (permis.has(valeur)) continue;
      passages.push(phrase);
      break;
    }
  }
  return passages;
}

// ── Contrôles combinés (existants réutilisés) ───────────────────────────────

export function controlerRedaction(
  html: string,
  ctx: ContexteRedaction,
  env: EnvEquipeEditoriale = process.env,
): ResultatRedaction {
  if (!equipeEditorialeActive(env)) return { issues: [] };
  const issues: ProblemeRedaction[] = [];

  const passages = chiffresHorsDossier(html, ctx.dossier, {
    ...(ctx.datePublication ? { datePublication: ctx.datePublication } : {}),
  });
  if (passages.length > 0) {
    issues.push({
      code: "chiffre-hors-dossier",
      message: `${passages.length} passage(s) avec un chiffre absent du dossier de preuves`,
      passages,
    });
  }

  if (ctx.plan) {
    const prevus = ctx.plan.sections.length;
    const obtenus = compterH2(html);
    if (obtenus < prevus) {
      issues.push({
        code: "h2-hors-plan",
        message: `${obtenus} titres h2 pour ${prevus} prévus au plan`,
      });
    }
  }

  const texte = sansBalises(html);
  const lisibilite = computeReadabilityFr(texte);
  if (lisibilite.wordCount < PLANCHER_MOTS_RELECTURE) {
    issues.push({
      code: "mots-insuffisants",
      message: `${lisibilite.wordCount} mots (plancher ${PLANCHER_MOTS_RELECTURE})`,
    });
  }
  if (lisibilite.avgWordsPerSentence > MOTS_PAR_PHRASE_MAX) {
    issues.push({
      code: "phrases-trop-longues",
      message: `${lisibilite.avgWordsPerSentence.toFixed(1)} mots par phrase (maximum ${MOTS_PAR_PHRASE_MAX})`,
    });
  }
  const tut = detecterTutoiement(html);
  if (tut.tutoie) {
    issues.push({ code: "tutoiement", message: `tutoiement détecté : « ${tut.extrait} »` });
  }
  return { issues };
}
