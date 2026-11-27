/**
 * Chaîne éditoriale — fiche C1 : « taux de blocage par contrôle » et « coût réel par
 * article et par rôle », module PUR (aucune base, aucun réseau, aucune écriture).
 *
 * Les lignes sont chargées par `lecture-blocage-cout.ts` (lecture seule) à partir de :
 *   - `ContentGenJob.outputJsonRaw` : `equipe` (journal par rôle : coût, décision),
 *     `intentAligned`, `doctrineHardFaults`, `barrieresRelecture`, `outlineDedupVerdict` ;
 *   - `GenerationLog.metadata.causes` (étape « validation », message « Publication
 *     automatique refusée »), qui dit en clair QUI a bloqué.
 *
 * Objectif du § 6.2 de la conception : remplacer les hypothèses par des chiffres.
 * Une valeur ABSENTE reste « inconnue » : on ne la compte jamais comme zéro.
 */

/** Contrôles dont le verdict fait `blockingFail` dans le worker de génération. */
export type CodeControle =
  | "plagiat"
  | "intention"
  | "plan-trop-proche"
  | "doctrine"
  | "doublon-semantique"
  | "benefice"
  | "barriere"
  | "cause-inconnue";

export interface LigneJobMesure {
  readonly id: string;
  readonly contentType: string;
  readonly status: string;
  /** Coût de l'exécution (colonne `costUsd`), ou null. */
  readonly costUsd: number | null;
  /** `outputJsonRaw` (peut être null ou de forme inattendue : on le lit défensivement). */
  readonly outputJsonRaw: unknown;
  /** `metadata.causes` du journal « Publication automatique refusée ». Vide si aucun. */
  readonly causes: ReadonlyArray<string>;
  /** `metadata.auto_publish_blocked` vu dans le journal. */
  readonly blocageJournalise: boolean;
}

export interface StatControle {
  readonly controle: string;
  readonly code: CodeControle;
  readonly bloques: number;
  /** bloques / total de jobs mesurés (0..1). */
  readonly taux: number;
}

export interface StatRole {
  readonly role: string;
  /** Nombre d'articles où le rôle a tourné (au moins une entrée). */
  readonly articles: number;
  readonly passes: number;
  readonly coutTotalUsd: number;
  /** Coût moyen par article où le rôle a tourné. */
  readonly coutMoyenParArticleUsd: number;
  readonly dureeMoyenneMs: number | null;
}

export interface StatCoutArticle {
  readonly articlesAvecEquipe: number;
  readonly totalUsd: number;
  readonly moyenneUsd: number | null;
  readonly medianeUsd: number | null;
  readonly p90Usd: number | null;
  readonly maxUsd: number | null;
}

export interface RapportBlocageCout {
  readonly totalJobs: number;
  readonly jobsBloques: number;
  readonly tauxBlocageGlobal: number;
  readonly controles: ReadonlyArray<StatControle>;
  /** Jobs ayant un journal d'équipe : seuls ceux-là donnent un coût par rôle. */
  readonly roles: ReadonlyArray<StatRole>;
  readonly coutArticle: StatCoutArticle;
  /** Issues du journal d'équipe (`publier`, `a_relire`…), comptées par valeur. */
  readonly issuesEquipe: Readonly<Record<string, number>>;
  /** Coût de l'exécution tel que lu dans la colonne `costUsd`, tous jobs. */
  readonly coutColonneTotalUsd: number;
  /** Jobs dont le blocage n'a pu être rattaché à aucun contrôle connu. */
  readonly bloquesSansCause: number;
  /** Entrées de journal d'équipe sans coût lisible : comptées 0 dans les totaux, mais signalées. */
  readonly entreesSansCout: number;
}

function objet(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function nombreFini(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Les libellés écrits par le worker (`blockCauses`) → contrôle. Préfixes, sans accent fragile. */
export function controleDepuisCause(cause: string): { code: CodeControle; libelle: string } {
  const c = cause.trim();
  if (/^Dedup s[ée]mantique/i.test(c)) return { code: "doublon-semantique", libelle: c };
  if (/^Plagiat/i.test(c)) return { code: "plagiat", libelle: "Plagiat lexical" };
  if (/^Structure trop proche/i.test(c)) {
    return { code: "plan-trop-proche", libelle: "Plan H2/H3 trop proche d'un existant" };
  }
  if (/^Intention de recherche/i.test(c)) {
    return { code: "intention", libelle: "Intention de recherche non respectée" };
  }
  if (/^Doctrine/i.test(c)) return { code: "doctrine", libelle: "Doctrine (faute dure)" };
  if (/^B[ée]n[ée]fice concret/i.test(c)) {
    return { code: "benefice", libelle: "Bénéfice concret insuffisant" };
  }
  return { code: "barriere", libelle: c };
}

interface Blocage {
  readonly cle: string;
  readonly code: CodeControle;
  readonly libelle: string;
}

/**
 * Contrôles qui ont bloqué UN job : union du journal (causes) et de `outputJsonRaw`.
 * Un même contrôle n'est compté qu'une fois par job.
 */
export function blocagesDuJob(l: LigneJobMesure): ReadonlyArray<Blocage> {
  const sortie = new Map<string, Blocage>();
  const ajouter = (code: CodeControle, libelle: string, cle?: string): void => {
    const k = cle ?? code;
    if (!sortie.has(k)) sortie.set(k, { cle: k, code, libelle });
  };

  const out = objet(l.outputJsonRaw);
  const barrieres = Array.isArray(out?.["barrieresRelecture"]) ? out["barrieresRelecture"] : [];
  const codesBarrieres = new Map<string, string>();
  for (const b of barrieres) {
    const o = objet(b);
    if (typeof o?.["code"] === "string") {
      codesBarrieres.set(o["libelle"] === undefined ? o["code"] : String(o["libelle"]), o["code"]);
    }
  }

  for (const cause of l.causes) {
    const { code, libelle } = controleDepuisCause(cause);
    if (code === "barriere") {
      // Rattache le libellé à son code stable quand `barrieresRelecture` le donne.
      const codeStable = codesBarrieres.get(cause) ?? null;
      ajouter("barriere", libelle, `barriere:${codeStable ?? libelle}`);
    } else {
      ajouter(code, libelle);
    }
  }

  // Repli sur `outputJsonRaw` (journal absent ou tronqué).
  if (out) {
    if (out["intentAligned"] === false) {
      ajouter("intention", "Intention de recherche non respectée");
    }
    if (Array.isArray(out["doctrineHardFaults"]) && out["doctrineHardFaults"].length > 0) {
      ajouter("doctrine", "Doctrine (faute dure)");
    }
    if (out["outlineDedupVerdict"] === "duplicate_template" && l.contentType !== "blog_from_rss") {
      ajouter("plan-trop-proche", "Plan H2/H3 trop proche d'un existant");
    }
    for (const b of barrieres) {
      const o = objet(b);
      if (typeof o?.["code"] === "string") {
        const libelle = typeof o["libelle"] === "string" ? o["libelle"] : o["code"];
        ajouter("barriere", libelle, `barriere:${o["code"]}`);
      }
    }
  }
  return [...sortie.values()];
}

/** Le job a-t-il été bloqué ? (journal, causes, ou état de `outputJsonRaw`). */
function estBloque(l: LigneJobMesure, blocages: ReadonlyArray<Blocage>): boolean {
  // Le tier 3 posé par un générateur (soft-404, score bas…) n'est PAS un blocage de contrôle :
  // seul le journal « Publication automatique refusée » ou un contrôle relu le prouve.
  return blocages.length > 0 || l.blocageJournalise;
}

function quantile(tries: ReadonlyArray<number>, q: number): number | null {
  if (tries.length === 0) return null;
  const idx = Math.min(tries.length - 1, Math.max(0, Math.ceil(q * tries.length) - 1));
  return tries[idx] ?? null;
}

function arrondi(n: number, d = 4): number {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

interface EntreeRole {
  readonly role: string;
  /** null = coût absent du journal : inconnu, jamais compté comme zéro. */
  readonly coutUsd: number | null;
  readonly dureeMs: number | null;
}

function entreesEquipe(out: Record<string, unknown> | null): {
  entrees: EntreeRole[];
  coutTotal: number | null;
  issue: string | null;
} | null {
  const eq = objet(out?.["equipe"]);
  if (!eq) return null;
  const brut = Array.isArray(eq["entrees"]) ? eq["entrees"] : [];
  const entrees: EntreeRole[] = [];
  for (const e of brut) {
    const o = objet(e);
    if (!o || typeof o["role"] !== "string") continue;
    entrees.push({
      role: o["role"],
      coutUsd: nombreFini(o["coutUsd"]),
      dureeMs: nombreFini(o["dureeMs"]),
    });
  }
  return {
    entrees,
    coutTotal: nombreFini(eq["coutTotalUsd"]),
    issue: typeof eq["issue"] === "string" ? eq["issue"] : null,
  };
}

export function calculerRapportBlocageCout(
  lignes: ReadonlyArray<LigneJobMesure>,
): RapportBlocageCout {
  const total = lignes.length;
  const parControle = new Map<string, { code: CodeControle; libelle: string; n: number }>();
  let bloquesJobs = 0;
  let sansCause = 0;
  let sansCout = 0;
  let coutColonne = 0;

  const coutsArticle: number[] = [];
  const parRole = new Map<
    string,
    { articles: number; passes: number; cout: number; dureeSomme: number; dureeN: number }
  >();
  const issues: Record<string, number> = {};

  for (const l of lignes) {
    coutColonne += l.costUsd !== null && Number.isFinite(l.costUsd) ? l.costUsd : 0;

    const blocages = blocagesDuJob(l);
    if (estBloque(l, blocages)) {
      bloquesJobs += 1;
      if (blocages.length === 0) {
        sansCause += 1;
        const k = "cause-inconnue";
        const cur = parControle.get(k) ?? {
          code: "cause-inconnue" as const,
          libelle: "Bloqué, cause non journalisée",
          n: 0,
        };
        cur.n += 1;
        parControle.set(k, cur);
      }
    }
    for (const b of blocages) {
      const cur = parControle.get(b.cle) ?? { code: b.code, libelle: b.libelle, n: 0 };
      cur.n += 1;
      parControle.set(b.cle, cur);
    }

    const eq = entreesEquipe(objet(l.outputJsonRaw));
    if (!eq) continue;
    if (eq.issue) issues[eq.issue] = (issues[eq.issue] ?? 0) + 1;
    const somme = eq.entrees.reduce((t, e) => t + (e.coutUsd ?? 0), 0);
    coutsArticle.push(eq.coutTotal ?? somme);
    const vus = new Set<string>();
    for (const e of eq.entrees) {
      if (e.coutUsd === null) sansCout += 1;
      const cur = parRole.get(e.role) ?? {
        articles: 0,
        passes: 0,
        cout: 0,
        dureeSomme: 0,
        dureeN: 0,
      };
      if (!vus.has(e.role)) {
        cur.articles += 1;
        vus.add(e.role);
      }
      cur.passes += 1;
      cur.cout += e.coutUsd ?? 0;
      if (e.dureeMs !== null) {
        cur.dureeSomme += e.dureeMs;
        cur.dureeN += 1;
      }
      parRole.set(e.role, cur);
    }
  }

  const controles: StatControle[] = [...parControle.entries()]
    .map(([, v]) => ({
      controle: v.libelle,
      code: v.code,
      bloques: v.n,
      taux: total === 0 ? 0 : arrondi(v.n / total),
    }))
    .sort((a, b) => b.bloques - a.bloques || a.controle.localeCompare(b.controle, "fr"));

  const roles: StatRole[] = [...parRole.entries()]
    .map(([role, v]) => ({
      role,
      articles: v.articles,
      passes: v.passes,
      coutTotalUsd: arrondi(v.cout),
      coutMoyenParArticleUsd: v.articles === 0 ? 0 : arrondi(v.cout / v.articles),
      dureeMoyenneMs: v.dureeN === 0 ? null : Math.round(v.dureeSomme / v.dureeN),
    }))
    .sort((a, b) => b.coutTotalUsd - a.coutTotalUsd || a.role.localeCompare(b.role, "fr"));

  const tries = [...coutsArticle].sort((a, b) => a - b);
  const totalUsd = coutsArticle.reduce((t, c) => t + c, 0);
  const coutArticle: StatCoutArticle = {
    articlesAvecEquipe: coutsArticle.length,
    totalUsd: arrondi(totalUsd),
    moyenneUsd: coutsArticle.length === 0 ? null : arrondi(totalUsd / coutsArticle.length),
    medianeUsd: quantile(tries, 0.5),
    p90Usd: quantile(tries, 0.9),
    maxUsd: tries.length === 0 ? null : (tries[tries.length - 1] ?? null),
  };

  return {
    totalJobs: total,
    jobsBloques: bloquesJobs,
    tauxBlocageGlobal: total === 0 ? 0 : arrondi(bloquesJobs / total),
    controles,
    roles,
    coutArticle,
    issuesEquipe: issues,
    coutColonneTotalUsd: arrondi(coutColonne),
    bloquesSansCause: sansCause,
    entreesSansCout: sansCout,
  };
}

export function formaterRapportBlocageCout(r: RapportBlocageCout, jours: number): string {
  const pct = (x: number): string => `${(x * 100).toFixed(1)} %`;
  const usd = (x: number | null): string => (x === null ? "n/d" : `${x.toFixed(4)} $`);
  const l: string[] = [];
  l.push(`# Taux de blocage et coût réel — ${jours} derniers jours (lecture seule)`);
  l.push("");
  l.push(
    `Jobs mesurés : ${r.totalJobs} · bloqués : ${r.jobsBloques} (${pct(r.tauxBlocageGlobal)})`,
  );
  l.push(`dont cause non journalisée : ${r.bloquesSansCause}`);
  if (r.entreesSansCout > 0) {
    l.push(
      `⚠️ ${r.entreesSansCout} entrée(s) de journal sans coût lisible : comptées 0 $ dans les totaux.`,
    );
  }
  l.push("");
  l.push("## Blocage par contrôle (un job peut cumuler plusieurs contrôles)");
  if (r.controles.length === 0) l.push("Aucun blocage sur la période.");
  for (const c of r.controles) l.push(`- ${c.controle} : ${c.bloques} (${pct(c.taux)})`);
  l.push("");
  l.push("## Coût par article (journal d'équipe)");
  const a = r.coutArticle;
  l.push(`Articles avec journal d'équipe : ${a.articlesAvecEquipe}`);
  l.push(
    `moyenne ${usd(a.moyenneUsd)} · médiane ${usd(a.medianeUsd)} · p90 ${usd(a.p90Usd)} · max ${usd(a.maxUsd)} · total ${usd(a.totalUsd)}`,
  );
  l.push(`Coût colonne \`costUsd\` (tous jobs) : ${usd(r.coutColonneTotalUsd)}`);
  l.push("");
  l.push("## Coût par rôle");
  if (r.roles.length === 0) l.push("Aucun journal d'équipe sur la période (équipe éteinte ?).");
  for (const x of r.roles) {
    l.push(
      `- ${x.role} : ${x.articles} article(s), ${x.passes} passe(s), total ${usd(x.coutTotalUsd)}, moyenne/article ${usd(x.coutMoyenParArticleUsd)}${x.dureeMoyenneMs === null ? "" : `, ${x.dureeMoyenneMs} ms/passe`}`,
    );
  }
  l.push("");
  l.push("## Issues de l'équipe");
  const cles = Object.keys(r.issuesEquipe).sort();
  if (cles.length === 0) l.push("n/d");
  for (const k of cles) l.push(`- ${k} : ${r.issuesEquipe[k]}`);
  return l.join("\n");
}
