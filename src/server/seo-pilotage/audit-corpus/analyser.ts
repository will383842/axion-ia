/**
 * C2b — Audit du corpus déjà publié (docs/pilotage-seo-geo/CONCEPTION-CHAINE-EDITORIALE-IA.md § 12).
 *
 * Module PUR : aucune lecture, aucune écriture. Il reçoit des pages déjà lues et rend des
 * SIGNALEMENTS destinés à un humain (PLAN.md, principe 5 : aucune URL ne change jamais, ni
 * noindex, ni suppression, ni fusion, ni redirection automatiques). `null` ≠ 0 (principe 4) :
 * une donnée absente n'est jamais lue comme un zéro, elle est comptée « indisponible ».
 */

export type TypePageCorpus = "article" | "actualite" | "ville";

export interface PageCorpus {
  readonly url: string;
  readonly type: TypePageCorpus;
  readonly titre: string;
  /** Nombre de mots du corps ; `null` = inconnu. */
  readonly mots: number | null;
  /** Impressions Search Console ; `null` = source absente (≠ 0). */
  readonly impressions: number | null;
  readonly publieLe: Date | null;
  /** Titres h2/h3 dans l'ordre (pour le doublon de plan). */
  readonly plan: readonly string[];
  /** Texte du corps (pages villes : comparaison de gabarit). */
  readonly texte: string | null;
  readonly villeNom: string | null;
}

export type CodeSignalement =
  "faible_valeur" | "sans_impression" | "doublon_plan" | "ville_quasi_identique";

export interface Signalement {
  readonly code: CodeSignalement;
  readonly url: string;
  readonly type: TypePageCorpus;
  readonly motif: string;
  /** Autres URL concernées (doublons) ; jamais plus de `MAX_LIEES`. */
  readonly liees: readonly string[];
}

export interface Seuils {
  readonly motsMinArticle: number;
  readonly motsMinActualite: number;
  readonly motsMinVille: number;
  /** Ancienneté minimale (jours) avant de juger l'absence d'impression. */
  readonly ageMinJours: number;
  readonly similaritePlan: number;
  readonly titresMinPlan: number;
  readonly similariteVille: number;
}

export const SEUILS_DEFAUT: Seuils = {
  motsMinArticle: 600,
  motsMinActualite: 250,
  motsMinVille: 250,
  ageMinJours: 90,
  similaritePlan: 0.8,
  titresMinPlan: 4,
  similariteVille: 0.85,
};

export const MAX_LIEES = 5;

export interface ResultatAudit {
  readonly total: number;
  readonly signalements: readonly Signalement[];
  readonly donneesIndisponibles: {
    readonly mots: number;
    readonly impressions: number;
    readonly publieLe: number;
  };
}

export function normaliser(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fnv(s: string, graine: number): number {
  let h = (0x811c9dc5 ^ graine) >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

const N_SIGNATURE = 48;

function signature(ensemble: ReadonlySet<string>): Uint32Array {
  const sig = new Uint32Array(N_SIGNATURE).fill(0xffffffff);
  for (const el of ensemble) {
    for (let k = 0; k < N_SIGNATURE; k++) {
      const h = fnv(el, k * 7919 + 1);
      if (h < sig[k]!) sig[k] = h;
    }
  }
  return sig;
}

function jaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  const [p, g] = a.size <= b.size ? [a, b] : [b, a];
  for (const x of p) if (g.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

/** Paires d'indices dont le Jaccard exact atteint `seuil` (préfiltre par signature MinHash). */
function pairesSimilaires(
  ensembles: readonly ReadonlySet<string>[],
  seuil: number,
): [number, number][] {
  const sigs = ensembles.map(signature);
  const marge = 0.2;
  const paires: [number, number][] = [];
  for (let i = 0; i < ensembles.length; i++) {
    if (ensembles[i]!.size === 0) continue;
    for (let j = i + 1; j < ensembles.length; j++) {
      if (ensembles[j]!.size === 0) continue;
      let egaux = 0;
      for (let k = 0; k < N_SIGNATURE; k++) if (sigs[i]![k] === sigs[j]![k]) egaux++;
      if (egaux / N_SIGNATURE < seuil - marge) continue;
      if (jaccard(ensembles[i]!, ensembles[j]!) >= seuil) paires.push([i, j]);
    }
  }
  return paires;
}

/** Intertitres communs à presque tous les gabarits : ils ne prouvent aucun doublon. */
const TITRES_GENERIQUES: ReadonlySet<string> = new Set([
  "conclusion",
  "faq",
  "questions frequentes",
  "foire aux questions",
  "sources",
  "introduction",
  "en resume",
  "a retenir",
  "pour aller plus loin",
]);

function ensemblePlan(plan: readonly string[]): Set<string> {
  const s = new Set<string>();
  for (const t of plan) {
    const n = normaliser(t);
    if (n && !TITRES_GENERIQUES.has(n)) s.add(n);
  }
  return s;
}

function ensembleTexteVille(texte: string, villeNom: string | null): Set<string> {
  let n = normaliser(texte);
  if (villeNom) {
    const v = normaliser(villeNom);
    if (v) n = ` ${n} `.split(` ${v} `).join("  ").trim();
  }
  const mots = n.split(" ").filter(Boolean);
  const s = new Set<string>();
  for (let i = 0; i + 3 <= mots.length; i++) s.add(mots.slice(i, i + 3).join(" "));
  return s;
}

function regrouper(
  pages: readonly PageCorpus[],
  paires: readonly [number, number][],
  code: CodeSignalement,
  motif: (n: number) => string,
): Signalement[] {
  const voisins = new Map<number, number[]>();
  for (const [i, j] of paires) {
    (voisins.get(i) ?? voisins.set(i, []).get(i)!).push(j);
    (voisins.get(j) ?? voisins.set(j, []).get(j)!).push(i);
  }
  return [...voisins.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([i, js]) => ({
      code,
      url: pages[i]!.url,
      type: pages[i]!.type,
      motif: motif(js.length),
      liees: js
        .map((j) => pages[j]!.url)
        .sort()
        .slice(0, MAX_LIEES),
    }));
}

const JOUR_MS = 86_400_000;

export function analyserCorpus(
  pages: readonly PageCorpus[],
  maintenant: Date,
  seuils: Seuils = SEUILS_DEFAUT,
): ResultatAudit {
  const signalements: Signalement[] = [];
  let motsInconnus = 0;
  let impressionsInconnues = 0;
  let dateInconnue = 0;

  for (const p of pages) {
    const min =
      p.type === "ville"
        ? seuils.motsMinVille
        : p.type === "actualite"
          ? seuils.motsMinActualite
          : seuils.motsMinArticle;
    if (p.mots === null) motsInconnus++;
    else if (p.mots < min) {
      signalements.push({
        code: "faible_valeur",
        url: p.url,
        type: p.type,
        motif: `${p.mots} mots (seuil ${min})`,
        liees: [],
      });
    }

    if (p.impressions === null) impressionsInconnues++;
    if (p.publieLe === null) dateInconnue++;
    if (p.impressions === 0 && p.publieLe !== null) {
      const age = Math.floor((maintenant.getTime() - p.publieLe.getTime()) / JOUR_MS);
      if (age >= seuils.ageMinJours) {
        signalements.push({
          code: "sans_impression",
          url: p.url,
          type: p.type,
          motif: `0 impression, publiée depuis ${age} jours`,
          liees: [],
        });
      }
    }
  }

  // Doublons de plan : articles et actualités, plan assez long pour juger.
  const idxPlan = pages
    .map((p, i) => ({ p, i }))
    .filter(
      ({ p }) =>
        (p.type === "article" || p.type === "actualite") &&
        ensemblePlan(p.plan).size >= seuils.titresMinPlan,
    );
  const pairesPlan = pairesSimilaires(
    idxPlan.map(({ p }) => ensemblePlan(p.plan)),
    seuils.similaritePlan,
  );
  signalements.push(
    ...regrouper(
      idxPlan.map(({ p }) => p),
      pairesPlan,
      "doublon_plan",
      (n) => `plan quasi identique à ${n} autre(s) page(s)`,
    ),
  );

  // Pages villes gabaritées : texte identique au nom de ville près.
  const idxVille = pages.filter((p) => p.type === "ville" && p.texte);
  const pairesVille = pairesSimilaires(
    idxVille.map((p) => ensembleTexteVille(p.texte!, p.villeNom)),
    seuils.similariteVille,
  );
  signalements.push(
    ...regrouper(
      idxVille,
      pairesVille,
      "ville_quasi_identique",
      (n) => `texte quasi identique à ${n} autre(s) page(s) ville, nom de ville mis à part`,
    ),
  );

  return {
    total: pages.length,
    signalements,
    donneesIndisponibles: {
      mots: motsInconnus,
      impressions: impressionsInconnues,
      publieLe: dateInconnue,
    },
  };
}
