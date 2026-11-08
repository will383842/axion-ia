/**
 * KB — porte de doctrine à l'ENTRÉE de la base de connaissance.
 *
 * Audit knowledge du 08/11/2026 : la liste de motifs de ce fichier était vide, donc
 * aucune fiche n'était contrôlée (import API, publication en console, seed). Une
 * fiche qui dit « Qualiopi », « Grenoble » ou vise les ETI partait au chatbot et sur
 * `/connaissances`.
 *
 * Ce module ne définit AUCUN motif de la doctrine : il appelle
 * `detecterInterditsSurface` (`src/lib/contenu/interdits-publication.ts`, source
 * unique). Seul ajout propre à la base de connaissance : la cible. La doctrine
 * générale n'a pas de code « ETI » (le filtre de sujets `sujet-cible.ts` est
 * un autre mécanisme, sur des mots-clés), or Axion-IA parle aux dirigeants de PME.
 *
 * Module PUR (ni Prisma ni Next) : utilisable par le seed, les server actions et
 * les scripts.
 *
 * Le mot « formation » n'est PAS interdit (décision Williams, 2026-08-10). La
 * protection Qualiopi reste portée par la doctrine ET par le drapeau
 * `isQualiopiPublicDisclosureEnabled()`.
 */

import {
  detecterInterditsSurface,
  normaliserPourControle,
  raisonInterdit,
  type CodeInterdit,
} from "../contenu/interdits-publication";

/** Codes de violation d'une fiche : ceux de la doctrine + la cible « ETI ». */
export type CodeViolationFiche = CodeInterdit | "eti-hors-cible";

export interface ViolationFiche {
  readonly champ: string;
  readonly code: CodeViolationFiche;
  readonly extrait: string;
  readonly raison: string;
}

export const RAISON_ETI =
  "Cible ETI / grands groupes : Axion-IA s'adresse aux dirigeants de PME. Reformuler pour une PME.";

// Texte normalisé (minuscules, sans accents) : bornes de mot explicites.
const ETI_RE = /(?<![a-z0-9])(?:etis?|entreprises? de taille intermediaire)(?![a-z0-9])/;

/**
 * Contrôle les champs d'une fiche. `financementPublicAutorise: false` : par défaut
 * OPCO / France Travail ne sont pas citables (contrat de `qualiopi/config`).
 */
export function verifierDoctrineFiche(
  champs: Readonly<Record<string, string | null | undefined>>,
): ReadonlyArray<ViolationFiche> {
  const textes: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(champs)) if (v) textes[k] = v;

  const out: ViolationFiche[] = detecterInterditsSurface(textes, {
    actualite: false,
    financementPublicAutorise: false, // OPCO / France Travail non citables dans la base (contrat qualiopi/config)
  }).map((d) => ({
    champ: d.champ,
    code: d.code,
    extrait: d.extrait,
    raison: raisonInterdit(d.code),
  }));

  for (const [champ, valeur] of Object.entries(textes)) {
    const n = normaliserPourControle(valeur ?? "");
    const m = ETI_RE.exec(n);
    if (m) {
      const de = Math.max(0, m.index - 25);
      out.push({
        champ,
        code: "eti-hors-cible",
        extrait: n.slice(de, m.index + m[0].length + 25).trim(),
        raison: RAISON_ETI,
      });
    }
  }
  return out;
}

/** Phrase lisible pour un brouillon bloqué (champ, code, raison). */
export function raisonBlocage(violations: ReadonlyArray<ViolationFiche>): string {
  const vus = new Set<string>();
  const parts: string[] = [];
  for (const v of violations) {
    const k = `${v.champ}:${v.code}`;
    if (vus.has(k)) continue;
    vus.add(k);
    parts.push(`${v.champ} [${v.code}] ${v.raison}`);
  }
  return `Doctrine : ${parts.join(" ; ")}`;
}

export interface BannedWordCheck {
  readonly valid: boolean;
  readonly fieldViolations: ReadonlyArray<{ field: string; snippet: string; code: string }>;
  readonly reason?: string;
}

/**
 * Retire l'étiquette bibliographique « Source : … » que le seed ajoute au corps
 * d'un fait (`<p><em>Source : …</em></p>` en HTML, ` Source : …` en fin de texte).
 * C'est un renvoi, pas une affirmation : « Source : Axion-IA — Catalogue 2026 »
 * déclencherait sinon le motif « statistique attribuée à Axion-IA ». La même règle
 * vaut au seed ET en console, pour qu'une fiche acceptée par l'un ne soit pas
 * refusée par l'autre.
 */
export function sansEtiquetteSource(texte: string): string {
  let t = texte.replace(/<p>\s*<em>\s*Source\s*:[\s\S]*?<\/em>\s*<\/p>/gi, " ");
  const i = t.lastIndexOf(" Source : ");
  if (i >= 0 && !t.slice(i + 10).includes(". ")) t = t.slice(0, i);
  return t;
}

export interface TraductionAControler {
  readonly title?: string | null | undefined;
  readonly excerpt?: string | null | undefined;
  readonly body?: string | null | undefined;
  readonly bodyText?: string | null | undefined;
  readonly metaTitle?: string | null | undefined;
  readonly metaDescription?: string | null | undefined;
}

/**
 * Porte de doctrine de la base de connaissance (publication, import, création).
 * Le corps HTML ET le texte brut sont contrôlés (un `bodyText` vide ne masque pas le `body`).
 */
export function verifierDoctrineTraduction(input: TraductionAControler): BannedWordCheck {
  const violations = verifierDoctrineFiche({
    title: input.title,
    excerpt: input.excerpt,
    body: input.body ? sansEtiquetteSource(input.body) : input.body,
    bodyText: input.bodyText ? sansEtiquetteSource(input.bodyText) : input.bodyText,
    metaTitle: input.metaTitle,
    metaDescription: input.metaDescription,
  });
  if (violations.length === 0) return { valid: true, fieldViolations: [] };
  return {
    valid: false,
    fieldViolations: violations.map((v) => ({ field: v.champ, snippet: v.extrait, code: v.code })),
    reason: raisonBlocage(violations),
  };
}

/**
 * Ancien contrôle « mots proscrits » : liste VIDE depuis le 2026-08-10, conservé
 * tel quel pour `server/videos/gardes-contenu.ts`, qui a ses propres règles et ses
 * propres options (OPCO, Qualiopi) et ne doit pas hériter de la doctrine de la
 * base de connaissance. La base de connaissance utilise `verifierDoctrineTraduction`.
 */
export function checkTranslationBannedWords(_input: TraductionAControler): BannedWordCheck {
  return { valid: true, fieldViolations: [] };
}
