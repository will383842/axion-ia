/**
 * Règles PURES (sans Prisma) du retrait des derniers anciens prix affichés (2026-11).
 * Règle de Will : seul prix public = Journée IA 1 490 € HT, le reste « sur devis ».
 *
 *  - 2 FAQ (`combien-coute-audit`, `qu-est-ce-qu-une-implementation`) : réponses remplacées par
 *    les textes de `prisma/seed.ts`, seulement si l'ancienne valeur contient un montant.
 *  - Boutons d'appel à l'action (CTA) des articles : « Réserver une formation · 2 450 € » devient
 *    « Réserver une formation » (le libellé seul, sans montant).
 *
 * Idempotent : un second passage ne change rien. Aucun accès base ici.
 */

/** Un montant en euros : un chiffre, puis chiffres/espaces/séparateurs, puis « € ». */
export const MONTANT_RE = /\d[\d   .,]*\s*€/;

export function contientMontant(texte: string | null | undefined): boolean {
  return typeof texte === "string" && MONTANT_RE.test(texte);
}

export interface FaqCible {
  slug: string;
  answerFr: string;
  answerEn: string;
}

/** Textes EXACTS de `prisma/seed.ts` (vérifiés par le test). */
export const FAQ_CIBLES: readonly FaqCible[] = [
  {
    slug: "combien-coute-audit",
    answerFr:
      "Sur devis, selon la taille de l'entreprise et le format (à distance ou sur site) : parlons-en lors du rendez-vous gratuit de 45 minutes.",
    answerEn:
      "On request, depending on company size and format (remote or on-site): let's discuss it during the free 45-minute call.",
  },
  {
    slug: "qu-est-ce-qu-une-implementation",
    answerFr:
      "C'est le déploiement d'une solution IA chez vous : automatisation, agents, IA custom. Sur devis selon l'ambition : parlons-en lors du rendez-vous gratuit de 45 minutes.",
    answerEn:
      "It's the deployment of an AI solution at your premises: automation, agents, custom AI. On request depending on scope: let's discuss it during the free 45-minute call.",
  },
];

/** Autres FAQ à inventorier (jamais écrites) : un de ces anciens montants dans la réponse. */
export const ANCIENS_MONTANTS_RE = /\b(?:290|1[\s  ]?990|990|50[\s  ]?000)[\s  ]*€/;

export interface ChampsFaq {
  answerFr: string;
  answerEn: string;
  metaDescription: string | null;
}

export interface PlanFaq {
  /** Champs à écrire (nom Prisma → nouvelle valeur). Vide = rien à faire. */
  ecritures: Partial<Record<"answerFr" | "answerEn", string>>;
  /** Champs qui portent un montant mais ne sont JAMAIS réécrits automatiquement. */
  aRevoir: string[];
}

export function planifierFaq(slug: string, actuel: ChampsFaq): PlanFaq | null {
  const cible = FAQ_CIBLES.find((c) => c.slug === slug);
  if (!cible) return null;
  const ecritures: PlanFaq["ecritures"] = {};
  if (contientMontant(actuel.answerFr) && actuel.answerFr !== cible.answerFr)
    ecritures.answerFr = cible.answerFr;
  if (contientMontant(actuel.answerEn) && actuel.answerEn !== cible.answerEn)
    ecritures.answerEn = cible.answerEn;
  const aRevoir: string[] = [];
  if (contientMontant(actuel.metaDescription)) aRevoir.push("meta_description");
  return { ecritures, aRevoir };
}

// ───────────────────────────── CTA des articles ─────────────────────────────

// Espaces, tirets et symboles possibles, caractères ou entités HTML.
const SP = String.raw`(?:[   ]|&nbsp;|&#160;|&#xa0;|&#8239;|&#x202f;|&thinsp;|&ensp;)`;
const SEP = String.raw`(?:[·•–-]|&middot;|&#183;|&#xb7;|&bull;|&#8226;|&ndash;|&#8211;)`;
const APOS = String.raw`(?:'|’|&#39;|&#x27;|&rsquo;|&#8217;)`;
const EURO = String.raw`(?:€|&euro;|&#8364;|&#x20ac;|EUR\b|[Ee]uros?\b)`;
const NOMBRE = String.raw`\d{1,3}(?:${SP}?\d{3}|[.,]\d{3})*(?:[.,]\d{1,2})?`;
const LIBELLE = String.raw`(Réserver une formation|Réserver l${APOS}intervention Essentielle|Faire faire par Axion-IA)`;

const SOURCE_CTA = String.raw`${LIBELLE}${SP}*${SEP}${SP}*${NOMBRE}${SP}*${EURO}(?:${SP}*HT\b)?`;

/** Fabrique une expression neuve (les expressions `g` gardent un état : pas de partage). */
export function motifCta(): RegExp {
  return new RegExp(SOURCE_CTA, "g");
}

/** Mots du libellé seul (sans montant), pour filtrer vite en SQL puis en JS. */
export const LIBELLES_CTA_SQL =
  "(Réserver une formation|Réserver l.{1,8}intervention Essentielle|Faire faire par Axion-IA)";

export function contientCtaAvecMontant(texte: string | null | undefined): boolean {
  return typeof texte === "string" && motifCta().test(texte);
}

function libelleSeul(libelle: string): string {
  return /Essentielle/.test(libelle) ? "Réserver une formation" : libelle;
}

export interface ResultatTexte {
  texte: string;
  remplacements: number;
}

/** Retire le montant des CTA. Ne touche à rien d'autre. Idempotent. */
export function retirerMontantCta(texte: string): ResultatTexte {
  let remplacements = 0;
  const out = texte.replace(motifCta(), (_m, libelle: string) => {
    remplacements++;
    return libelleSeul(libelle);
  });
  return { texte: out, remplacements };
}

/** Clés JSON dont la valeur est une adresse : jamais modifiées. */
const CLES_ADRESSE = new Set(["href", "url", "src", "srcset", "canonical"]);

export interface ResultatJson {
  valeur: unknown;
  remplacements: number;
}

/** Parcours récursif d'un JSON (Tiptap, etc.) : réécrit les chaînes, jamais les adresses. */
export function retirerMontantCtaJson(valeur: unknown, cle?: string): ResultatJson {
  if (typeof valeur === "string") {
    if (cle !== undefined && CLES_ADRESSE.has(cle)) return { valeur, remplacements: 0 };
    const r = retirerMontantCta(valeur);
    return { valeur: r.texte, remplacements: r.remplacements };
  }
  if (Array.isArray(valeur)) {
    let n = 0;
    const out = valeur.map((v) => {
      const r = retirerMontantCtaJson(v, cle);
      n += r.remplacements;
      return r.valeur;
    });
    return { valeur: out, remplacements: n };
  }
  if (valeur !== null && typeof valeur === "object") {
    let n = 0;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(valeur as Record<string, unknown>)) {
      const r = retirerMontantCtaJson(v, k);
      n += r.remplacements;
      out[k] = r.valeur;
    }
    return { valeur: out, remplacements: n };
  }
  return { valeur, remplacements: 0 };
}

/** Un JSON contient-il (en texte) un CTA avec montant ? Pour l'inventaire « à revoir ». */
export function jsonContientCtaAvecMontant(valeur: unknown): boolean {
  return contientCtaAvecMontant(
    typeof valeur === "string" ? valeur : JSON.stringify(valeur ?? null),
  );
}
