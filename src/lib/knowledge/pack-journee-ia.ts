/**
 * Pack SEO/GEO « Journée IA » du 10/11/2026 — tri et mapping vers la base de connaissance.
 *
 * Module PUR (ni Prisma ni Next). Décision motivée : docs/knowledge/INTEGRATION-PACK-JOURNEE-IA.md.
 *
 *  - les 63 fiches questions/réponses (`faq_knowledge`) deviennent des BROUILLONS internes
 *    (type `faq`, statut `draft`, audience `team`, confidentialité `internal`), jamais publiés ;
 *  - les 623 expressions (`search_query`), 20 intentions de page, 18 sources et 10 décisions
 *    restent un référentiel éditorial HORS RAG : jamais servis comme des faits ;
 *  - toute fiche passe la porte de doctrine de la base (`verifierDoctrineTraduction`) PLUS
 *    les décisions du pack : un seul prix (Journée IA 1 490 € HT), pas de remise, pas de
 *    gain garanti, pas de Grenoble, « Williams » et jamais « Will ».
 */

import { verifierDoctrineTraduction } from "./banned-words";

/** Ligne brute du JSONL : champs libres, seul `id` et `type` sont garantis. */
export interface LignePack {
  readonly id: string;
  readonly type: string;
  readonly [cle: string]: unknown;
}

export interface EntreeKnowledgeDraft {
  readonly entry: {
    readonly type: "faq";
    readonly domain: "editorial";
    readonly audience: "team";
    readonly confidentiality: "internal";
    readonly status: "draft";
    readonly pipelineStage: "draft";
    readonly slug: string;
    readonly publishedAt: null;
    readonly briefMarkdown: string;
  };
  readonly translation: {
    readonly locale: "fr";
    readonly title: string;
    readonly slug: string;
    readonly body: string;
    readonly bodyText: string;
    readonly excerpt: string | null;
  };
}

export interface Rejet {
  readonly id: string;
  readonly raisons: readonly string[];
}

export interface ControleFiche {
  readonly ok: boolean;
  readonly raisons: readonly string[];
}

export interface Contradiction {
  readonly id: string;
  readonly description: string;
  readonly traitement: string;
}

export interface RapportPack {
  readonly total: number;
  readonly parType: Record<string, number>;
  readonly aImporter: readonly EntreeKnowledgeDraft[];
  readonly rejets: readonly Rejet[];
  /** Lignes volontairement non importées dans le RAG, par type. */
  readonly horsRag: Record<string, number>;
  readonly contradictions: readonly Contradiction[];
  /** Paires de fiches très proches (relecture humaine, pas un rejet). */
  readonly quasiDoublons: ReadonlyArray<readonly [string, string, number]>;
}

export const PREFIXE_SLUG = "pack-journee-ia-";

/** Seul prix affiché : Journée IA 1 490 € HT (espaces, NBSP, espace fine, décimales ,00 tolérés). */
const PRIX_AUTORISE = /^1[\s\u00a0\u202f]?490(?:[.,]00)?$/;
const MONTANT =
  /(\d(?:[\d\u00a0\u202f]| (?=\d{3}\b)|[.,](?=\d))*)\s?(?:€|euros?|eur\b)|€\s?(\d(?:[\d\u00a0\u202f]| (?=\d{3}\b)|[.,](?=\d))*)/gi;
/** « HT » doit suivre immédiatement le prix (espace, NBSP ou espace fine). */
const HT_APRES = /^\s*HT(?![\p{L}\d])/iu;
const MONTANT_K = /\d\s?k\s?€/i;
const NOMBRE_SANS_DEVISE_HT = /\d[\d\s\u00a0\u202f.,]*\s?HT(?![\p{L}\d])/iu;
const REDUCTION =
  /(?<![\p{L}])(?:réduction|reduction|rabais|offert|offerte|offerts|offertes)(?![\p{L}])/iu;
const TOUR_FRANCE_IA = /tour\s+(?:de\s+)?france\s+ia/i;

function texteDeLaFiche(l: LignePack): { titre: string; reponse: string } {
  const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  return { titre: s(l.question), reponse: s(l.answer_draft) };
}

/** Règles propres au pack (décisions de Williams), en plus de la doctrine de la base. */
function reglesDuPack(texte: string): string[] {
  const raisons: string[] = [];
  for (const m of texte.matchAll(MONTANT)) {
    const nombre = (m[1] ?? m[2] ?? "").trim();
    if (!PRIX_AUTORISE.test(nombre)) {
      raisons.push(`prix non autorisé : « ${m[0]} »`);
      continue;
    }
    const suite = texte.slice((m.index ?? 0) + m[0].length);
    if (!HT_APRES.test(suite)) raisons.push(`prix sans « HT » juste après : « ${m[0]} »`);
  }
  if (/\bttc\b/i.test(texte)) raisons.push("« TTC » interdit : seul prix affiché = 1 490 € HT");
  if (MONTANT_K.test(texte)) raisons.push("montant en k€ interdit");
  if (NOMBRE_SANS_DEVISE_HT.test(texte)) raisons.push("nombre sans devise suivi de « HT »");
  if (REDUCTION.test(texte)) raisons.push("réduction, rabais ou « offert » : un seul prix affiché");
  if (TOUR_FRANCE_IA.test(texte)) raisons.push("« Tour France IA » exclu de ce pack");
  if (/\bremises?\b/i.test(texte)) raisons.push("remise : un seul prix affiché, sans remise");
  if (/\bgrenoble\b/i.test(texte)) raisons.push("« Grenoble » interdit en communication");
  if (/\bwill\b/i.test(texte)) raisons.push("écrire « Williams », jamais « Will »");
  if (
    /aucun gain (n[’']est )?garanti|aucune garantie de (gain|r[ée]sultat)|gains? non garantis?/i.test(
      texte,
    )
  )
    raisons.push("formule « Aucun gain garanti » interdite");
  if (
    /(gains?|r[ée]sultats?|retour sur investissement|roi)\s+garanti|garantit?\s+(un|des|le|les)\s+(gains?|r[ée]sultats?)|gains?\s+assur[ée]s?|satisfait ou rembours|garanti[^.]*rembours/i.test(
      texte,
    )
  ) {
    raisons.push(
      "promesse de gain ou de remboursement : gains identifiés et estimés, jamais garantis",
    );
  }
  return raisons;
}

export function controlerFiche(l: LignePack): ControleFiche {
  const { titre, reponse } = texteDeLaFiche(l);
  const raisons: string[] = [];
  if (!titre) raisons.push("question vide");
  if (!reponse) raisons.push("réponse vide");
  if (raisons.length === 0) {
    const doctrine = verifierDoctrineTraduction({
      title: titre,
      body: `<p>${echapper(reponse)}</p>`,
      bodyText: reponse,
    });
    if (!doctrine.valid) raisons.push(doctrine.reason ?? "doctrine");
    const libres = [
      l.source,
      l.factual_check,
      l.canonical_url,
      l.page_id,
      l.status,
      l.publication_gate,
    ]
      .filter((v): v is string => typeof v === "string")
      .join("\n");
    raisons.push(...reglesDuPack(`${titre}\n${reponse}\n${libres}`));
  }
  return { ok: raisons.length === 0, raisons };
}

function echapper(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function slugDeLaFiche(id: string): string {
  return `${PREFIXE_SLUG}${id
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")}`;
}

const MARQUE_NON_VERIFIE = "NON VÉRIFIÉ — scénario ou point juridique à confirmer";

function sansAccent(t: string): string {
  return t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Scénario non constaté, point à vérifier ou juridique : `factual_check` ne vaut alors rien. */
export function estNonVerifiee(l: LignePack): boolean {
  const t = sansAccent([l.status, l.source].filter((v) => typeof v === "string").join(" "));
  return /non constate|a verifier|juridique/.test(t);
}

export function versEntreeKnowledge(l: LignePack): EntreeKnowledgeDraft {
  const { titre, reponse } = texteDeLaFiche(l);
  const slug = slugDeLaFiche(l.id);
  const s = (v: unknown, def = "non renseigné") => (typeof v === "string" && v ? v : def);
  const nonVerifiee = estNonVerifiee(l);
  const note = [
    ...(nonVerifiee ? [MARQUE_NON_VERIFIE] : []),
    `[pack Journée IA 2026-11-10] ${l.id}`,
    `Source : ${s(l.source)}`,
    `Date de source : ${s(l.source_date)}`,
    `Nature : ${s(l.status)}`,
    `Garde de publication : ${s(l.publication_gate)}`,
    ...(nonVerifiee ? [] : [`Contrôle factuel à faire : ${s(l.factual_check)}`]),
    `Page cible : ${s(l.page_id)} — ${s(l.canonical_url)}`,
    "Brouillon : relecture humaine requise avant toute publication. Jamais publié automatiquement.",
  ].join("\n");
  return {
    entry: {
      type: "faq",
      domain: "editorial",
      audience: "team",
      confidentiality: "internal",
      status: "draft",
      pipelineStage: "draft",
      slug,
      publishedAt: null,
      briefMarkdown: note,
    },
    translation: {
      locale: "fr",
      title: titre.slice(0, 255),
      slug,
      body: `<p>${echapper(reponse)}</p>`,
      bodyText: reponse,
      excerpt: null,
    },
  };
}

export function lignesDepuisJsonl(contenu: string): LignePack[] {
  const out: LignePack[] = [];
  contenu.split(/\r?\n/).forEach((brut, i) => {
    if (!brut.trim()) return;
    let v: unknown;
    try {
      v = JSON.parse(brut);
    } catch {
      throw new Error(`JSONL invalide à la ligne ${i + 1}`);
    }
    if (
      !v ||
      typeof v !== "object" ||
      typeof (v as LignePack).id !== "string" ||
      typeof (v as LignePack).type !== "string"
    ) {
      throw new Error(`JSONL invalide à la ligne ${i + 1} : id et type attendus`);
    }
    out.push(v as LignePack);
  });
  return out;
}

function jetons(t: string): string[] {
  return t
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

function empreintes(t: string, n = 3): Set<string> {
  const j = jetons(t);
  const s = new Set<string>();
  for (let i = 0; i + n <= j.length; i++) s.add(j.slice(i, i + n).join(" "));
  return s;
}

/** Similarité de Jaccard sur trigrammes de mots (garde anti-doublon, après Controle_Doublons.py). */
export function similarite(a: string, b: string): number {
  const A = empreintes(a);
  const B = empreintes(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

export const SEUIL_QUASI_DOUBLON = 0.8;

/** Décisions du pack qui contredisent les décisions de Williams : signalées, jamais importées. */
const TRAITEMENT_CONTRADICTION: Record<string, string> = {
  D02: "Écartée : seul prix affiché = Journée IA 1 490 € HT, sans remise ni contrepartie tournage.",
  D03: "Écartée : gains identifiés et estimés, jamais garantis ; garantie/CGV/devis = brouillons, aucune promesse juridique.",
};

export function analyserPack(lignes: readonly LignePack[]): RapportPack {
  const parType: Record<string, number> = {};
  for (const l of lignes) parType[l.type] = (parType[l.type] ?? 0) + 1;

  const aImporter: EntreeKnowledgeDraft[] = [];
  const rejets: Rejet[] = [];
  const vus = new Set<string>();
  for (const l of lignes) {
    if (l.type !== "faq_knowledge") continue;
    const slug = slugDeLaFiche(l.id);
    if (vus.has(slug)) {
      rejets.push({ id: l.id, raisons: ["identifiant en double dans le pack"] });
      continue;
    }
    vus.add(slug);
    const c = controlerFiche(l);
    if (c.ok) aImporter.push(versEntreeKnowledge(l));
    else rejets.push({ id: l.id, raisons: c.raisons });
  }

  const horsRag: Record<string, number> = {};
  for (const [t, n] of Object.entries(parType)) if (t !== "faq_knowledge") horsRag[t] = n;

  const contradictions: Contradiction[] = lignes
    .filter((l) => l.type === "editorial_decision" && l.id in TRAITEMENT_CONTRADICTION)
    .map((l) => ({
      id: l.id,
      description: typeof l.description === "string" ? l.description : "",
      traitement: TRAITEMENT_CONTRADICTION[l.id] ?? "",
    }));

  const quasiDoublons: Array<readonly [string, string, number]> = [];
  for (let i = 0; i < aImporter.length; i++) {
    for (let j = i + 1; j < aImporter.length; j++) {
      const a = aImporter[i]!;
      const b = aImporter[j]!;
      const s = similarite(a.translation.bodyText, b.translation.bodyText);
      if (s >= SEUIL_QUASI_DOUBLON)
        quasiDoublons.push([a.entry.slug, b.entry.slug, Math.round(s * 100) / 100]);
    }
  }

  return {
    total: lignes.length,
    parType,
    aImporter,
    rejets,
    horsRag,
    contradictions,
    quasiDoublons,
  };
}

/** Sous-ensemble de PrismaClient dont l'import a besoin : aucune méthode d'écriture autre que `create`. */
export interface ClientImport {
  readonly knowledgeEntry: {
    findUnique(a: {
      where: { slug: string };
      select: { id: true };
    }): Promise<{ id: string } | null>;
    create(a: {
      data: EntreeKnowledgeDraft["entry"] & {
        translations: { create: EntreeKnowledgeDraft["translation"][] };
      };
      select: { id: true };
    }): Promise<unknown>;
  };
}

export interface RapportImport {
  crees: number;
  /** Fiche déjà en base (détectée avant, ou créée entre-temps : P2002 sur le slug de la fiche). */
  dejaPresents: number;
  /** P2002 sur (locale, slug) de la traduction : la fiche n'a PAS été créée. */
  conflitsSlugTraduction: string[];
}

/** Vrai si la contrainte violée (meta.target d'un P2002) est celle de la traduction. */
function cibleTraduction(erreur: unknown): boolean {
  const cible = (erreur as { meta?: { target?: unknown } }).meta?.target;
  const texte = Array.isArray(cible) ? cible.join(",") : typeof cible === "string" ? cible : "";
  return /locale|translation/i.test(texte);
}

/**
 * Crée seulement les fiches absentes. Ne met jamais à jour ni ne supprime : le client n'expose
 * que `findUnique` et `create`. Idempotent : une 2e exécution ne crée rien.
 */
export async function importerBrouillons(
  client: ClientImport,
  fiches: readonly EntreeKnowledgeDraft[],
): Promise<RapportImport> {
  const rapport: RapportImport = { crees: 0, dejaPresents: 0, conflitsSlugTraduction: [] };
  for (const f of fiches) {
    const deja = await client.knowledgeEntry.findUnique({
      where: { slug: f.entry.slug },
      select: { id: true },
    });
    if (deja) {
      rapport.dejaPresents++;
      continue;
    }
    try {
      await client.knowledgeEntry.create({
        data: { ...f.entry, translations: { create: [f.translation] } },
        select: { id: true },
      });
      rapport.crees++;
    } catch (e) {
      if ((e as { code?: string }).code !== "P2002") throw e;
      if (cibleTraduction(e)) rapport.conflitsSlugTraduction.push(f.entry.slug);
      else rapport.dejaPresents++;
    }
  }
  return rapport;
}

export interface GardeCommit {
  readonly autorise: boolean;
  /** Hôte de la base visée (jamais d'identifiant ni de mot de passe). */
  readonly hote: string | null;
  readonly raison?: string;
}

const HOTES_LOCAUX = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/** Garde-fou production : `--commit` refusé hors base locale ou en production sans `--confirmer-prod`. */
export function evaluerGardeCommit(p: {
  commit: boolean;
  nodeEnv: string | undefined;
  databaseUrl: string | undefined;
  confirmerProd?: boolean;
}): GardeCommit {
  if (!p.commit) return { autorise: false, hote: null, raison: "dry-run : aucune écriture" };
  let hote: string;
  try {
    hote = new URL(p.databaseUrl ?? "").hostname;
  } catch {
    return { autorise: false, hote: null, raison: "DATABASE_URL absente ou illisible" };
  }
  if (!hote) return { autorise: false, hote: null, raison: "DATABASE_URL sans hôte" };
  const local = HOTES_LOCAUX.has(hote.toLowerCase());
  const production = p.nodeEnv === "production";
  if ((production || !local) && !p.confirmerProd) {
    return {
      autorise: false,
      hote,
      raison: `écriture refusée (${production ? "NODE_ENV=production" : "base non locale"}) : relancer avec --confirmer-prod après accord de Williams`,
    };
  }
  return { autorise: true, hote };
}
