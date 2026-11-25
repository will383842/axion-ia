/**
 * Règles PURES (sans Prisma) du retrait des derniers anciens prix affichés (2026-11).
 * Règle de Will : seul prix public = Journée IA 1 490 € HT, le reste « sur devis ».
 *
 *  - 2 FAQ (`combien-coute-audit`, `qu-est-ce-qu-une-implementation`) : réponses remplacées par
 *    les textes de `prisma/seed.ts`, seulement si l'ancienne valeur contient un montant.
 *  - Boutons d'appel à l'action (CTA) des articles : « Réserver une formation · 2 450 € » devient
 *    « Réserver une formation » (le libellé seul, sans montant). Seuls les anciens montants de
 *    `MONTANTS_RETIRES` sont retirés ; toute autre forme est signalée « à revoir », jamais écrite.
 *
 * Idempotent : un second passage ne change rien. Aucun accès base ici.
 */

/**
 * Un montant en euros, sous toutes ses formes : « 1 990 € », « 1 990 euros », « 990 EUR »,
 * « €1,990 ». Sert à DÉTECTER (jamais à réécrire).
 */
export const MONTANT_RE =
  /\d[\d   .,]*\s*(?:€|&euro;|&#8364;|&#x20ac;|euros?\b|EUR\b)|(?:€|&euro;)\s?\d/i;

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
  /** Colonnes à faire relire par un humain : JAMAIS réécrites automatiquement. */
  aRevoir: Array<"answer_fr" | "answer_en" | "meta_description">;
}

export function planifierFaq(slug: string, actuel: ChampsFaq): PlanFaq | null {
  const cible = FAQ_CIBLES.find((c) => c.slug === slug);
  if (!cible) return null;
  const ecritures: PlanFaq["ecritures"] = {};
  if (contientMontant(actuel.answerFr) && actuel.answerFr !== cible.answerFr)
    ecritures.answerFr = cible.answerFr;
  if (contientMontant(actuel.answerEn) && actuel.answerEn !== cible.answerEn)
    ecritures.answerEn = cible.answerEn;
  const aRevoir: PlanFaq["aRevoir"] = [];
  // Différente du texte attendu mais sans montant reconnu : pas réécrite, mais signalée.
  if (actuel.answerFr !== cible.answerFr && ecritures.answerFr === undefined)
    aRevoir.push("answer_fr");
  if (actuel.answerEn !== cible.answerEn && ecritures.answerEn === undefined)
    aRevoir.push("answer_en");
  if (contientMontant(actuel.metaDescription)) aRevoir.push("meta_description");
  return { ecritures, aRevoir };
}

// ───────────────────────────── CTA des articles ─────────────────────────────

// Espaces, tirets et symboles possibles, caractères ou entités HTML.
const SP = String.raw`(?:[   ]|&nbsp;|&#160;|&#xa0;|&#8239;|&#x202f;|&thinsp;|&ensp;)`;
const SEP = String.raw`(?:[·•–—-]|&middot;|&#183;|&#xb7;|&bull;|&#8226;|&ndash;|&#8211;|&mdash;|&#8212;)`;
const APOS = String.raw`(?:'|’|&#39;|&#039;|&#x27;|&apos;|&rsquo;|&#8217;)`;
const EURO = String.raw`(?:€|&euro;|&#8364;|&#x20ac;|EUR\b|[Ee]uros?\b)`;
const NOMBRE = String.raw`\d{1,3}(?:${SP}?\d{3}|[.,]\d{3})*(?:[.,]\d{1,2})?`;
const LIBELLE = String.raw`(?:Réserver une formation|Réserver l${APOS}intervention Essentielle|Faire faire par Axion-IA)`;

const SOURCE_CTA = String.raw`(${LIBELLE})${SP}*${SEP}${SP}*(${NOMBRE})${SP}*${EURO}(?:${SP}*HT\b)?`;

/**
 * Seuls ces anciens montants sont retirés. Tout autre montant derrière un bouton (à commencer
 * par 1 490 €, le prix public de la Journée IA) reste en place et part en « à revoir ».
 */
export const MONTANTS_RETIRES: readonly number[] = [2450, 1900, 490];

/** « 2&#8239;450 » ou « 2.450,00 » → 2450. */
function valeurNombre(nombre: string): number {
  const sansEspaces = nombre.replace(new RegExp(SP, "g"), "");
  const sansDecimales = sansEspaces.replace(/[.,]\d{1,2}$/, "");
  return Number(sansDecimales.replace(/[.,]/g, ""));
}

/** Fabrique une expression neuve (les expressions `g` gardent un état : pas de partage). */
export function motifCta(): RegExp {
  return new RegExp(SOURCE_CTA, "g");
}

/** Mots du libellé seul (sans montant), pour filtrer vite en SQL puis en JS. */
export const LIBELLES_CTA_SQL =
  "(Réserver une formation|Réserver l.{1,8}intervention Essentielle|Faire faire par Axion-IA)";

function libelleSeul(libelle: string): string {
  // « Intervention Essentielle » : offre retirée du catalogue, le bouton devient générique.
  return /Essentielle/.test(libelle) ? "Réserver une formation" : libelle;
}

export interface Fragment {
  avant: string;
  apres: string;
  /** Les 30 caractères qui suivent (« / jour », « TTC »…) : à lire dans le rapport. */
  suite: string;
}

export interface ResultatTexte {
  texte: string;
  remplacements: number;
  fragments: Fragment[];
}

/** Retire le montant des CTA (montants de `MONTANTS_RETIRES` seulement). Idempotent. */
export function retirerMontantCta(texte: string): ResultatTexte {
  const fragments: Fragment[] = [];
  const out = texte.replace(
    motifCta(),
    (m: string, libelle: string, nombre: string, position: number) => {
      if (!MONTANTS_RETIRES.includes(valeurNombre(nombre))) return m;
      const apres = libelleSeul(libelle);
      fragments.push({
        avant: m,
        apres,
        suite: texte.slice(position + m.length, position + m.length + 30),
      });
      return apres;
    },
  );
  return { texte: out, remplacements: fragments.length, fragments };
}

/** Vrai si le texte porte un bouton que la règle RETIRERAIT (montant de la liste). */
export function contientCtaAvecMontant(texte: string | null | undefined): boolean {
  return typeof texte === "string" && retirerMontantCta(texte).remplacements > 0;
}

/**
 * Boutons SUSPECTS : un libellé suivi, à moins de `fenetre` caractères, d'un montant. À appeler
 * sur le texte APRÈS retrait : ce qui reste est une forme que la règle ne reconnaît pas (tiret
 * inconnu, « à partir de », balise intercalée, autre montant). Jamais réécrit : « à revoir ».
 */
export function ctaSuspects(texte: string | null | undefined, fenetre = 60): string[] {
  if (typeof texte !== "string") return [];
  const out: string[] = [];
  for (const m of texte.matchAll(new RegExp(LIBELLE, "g"))) {
    const fin = (m.index ?? 0) + m[0].length;
    const suite = texte.slice(fin, fin + fenetre);
    if (MONTANT_RE.test(suite)) out.push(`${m[0]}${suite}`);
  }
  return out;
}

/** Clés JSON dont la valeur est une adresse : jamais modifiées. */
const CLES_ADRESSE = new Set(["href", "url", "src", "srcset", "canonical"]);

export interface ResultatJson {
  valeur: unknown;
  remplacements: number;
  fragments: Fragment[];
}

/** Parcours récursif d'un JSON (Tiptap, etc.) : réécrit les chaînes, jamais les adresses. */
export function retirerMontantCtaJson(valeur: unknown, cle?: string): ResultatJson {
  if (typeof valeur === "string") {
    if (cle !== undefined && CLES_ADRESSE.has(cle))
      return { valeur, remplacements: 0, fragments: [] };
    const r = retirerMontantCta(valeur);
    return { valeur: r.texte, remplacements: r.remplacements, fragments: r.fragments };
  }
  if (Array.isArray(valeur)) {
    const fragments: Fragment[] = [];
    const out = valeur.map((v) => {
      const r = retirerMontantCtaJson(v, cle);
      fragments.push(...r.fragments);
      return r.valeur;
    });
    return { valeur: out, remplacements: fragments.length, fragments };
  }
  if (valeur !== null && typeof valeur === "object") {
    const fragments: Fragment[] = [];
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(valeur as Record<string, unknown>)) {
      const r = retirerMontantCtaJson(v, k);
      fragments.push(...r.fragments);
      out[k] = r.valeur;
    }
    return { valeur: out, remplacements: fragments.length, fragments };
  }
  return { valeur, remplacements: 0, fragments: [] };
}

/** Texte d'un JSON, pour chercher les boutons suspects (nœuds découpés compris). */
export function texteJson(valeur: unknown): string {
  return typeof valeur === "string" ? valeur : JSON.stringify(valeur ?? null);
}
