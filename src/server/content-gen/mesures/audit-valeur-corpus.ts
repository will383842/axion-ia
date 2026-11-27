/**
 * Chaîne éditoriale — fiche C2b : audit du corpus DÉJÀ publié (articles et pages villes
 * gabaritées), module PUR. Il signale ; il ne décide de rien.
 *
 * ⛔ Règle (PLAN.md, principe 5 ; décision de Will « ne jamais supprimer de données ») :
 * ce module ne renvoie QUE des signalements pour un humain. Il n'existe ici aucun geste
 * (noindex, suppression, fusion, redirection) et il n'en sera jamais ajouté : le type
 * `Signalement` ne porte aucun champ « action ».
 *
 * Trois familles de signalement, indépendantes (une page peut en cumuler plusieurs) :
 *   - `faible-valeur`   : peu de mots, ou score qualité bas ;
 *   - `sans-impressions`: aucune impression Search Console sur la fenêtre, pour une page
 *                         publiée depuis assez longtemps. N'est calculé que si Search
 *                         Console a répondu (sinon « inconnu », jamais « zéro ») ;
 *   - `doublon-de-plan` : plans H2 quasi identiques (Jaccard sur titres normalisés),
 *                         regroupés en grappes.
 */

export type TypePage = "article" | "page-ville";

export type FamilleSignalement = "faible-valeur" | "sans-impressions" | "doublon-de-plan";

export interface PageCorpus {
  readonly id: string;
  readonly type: TypePage;
  readonly url: string;
  readonly titre: string;
  readonly mots: number;
  readonly qualityScore: number | null;
  readonly publieLe: Date | null;
  /** Titres H2 dans l'ordre du texte. */
  readonly plan: ReadonlyArray<string>;
  /** Mots à retirer avant de comparer les plans (nom de la ville, de la région…). */
  readonly motsVariables?: ReadonlyArray<string>;
  /** Impressions sur la fenêtre ; `null` = Search Console n'a rien répondu pour cette page. */
  readonly impressions: number | null;
}

export interface Seuils {
  /** Articles : en dessous, signalé « faible valeur ». */
  readonly motsMinArticle: number;
  /** Pages villes : en dessous, signalé « faible valeur ». */
  readonly motsMinPageVille: number;
  readonly scoreQualiteMin: number;
  /** Ancienneté minimale (jours) avant de reprocher l'absence d'impressions. */
  readonly ancienneteMinJours: number;
  /** Jaccard minimal entre deux plans pour parler de doublon. */
  readonly jaccardPlanMin: number;
  /** Nombre minimal de titres H2 pour comparer un plan (un plan court n'est pas probant). */
  readonly titresMinPlan: number;
}

export const SEUILS_DEFAUT: Seuils = {
  motsMinArticle: 500,
  motsMinPageVille: 350,
  scoreQualiteMin: 60,
  ancienneteMinJours: 60,
  jaccardPlanMin: 0.8,
  titresMinPlan: 4,
};

export interface Signalement {
  readonly id: string;
  readonly type: TypePage;
  readonly url: string;
  readonly titre: string;
  readonly famille: FamilleSignalement;
  /** Phrase en français simple, lisible par un humain qui décide. */
  readonly motif: string;
  /** Pour `doublon-de-plan` : identifiant de grappe (même valeur = plans voisins). */
  readonly grappe?: string;
}

export interface GrappePlans {
  readonly grappe: string;
  readonly pages: ReadonlyArray<{
    readonly id: string;
    readonly url: string;
    readonly titre: string;
  }>;
  /** Plus faible similarité observée entre deux pages voisines de la grappe (0..1). */
  readonly similariteMin: number;
}

export interface RapportCorpus {
  readonly totalPages: number;
  readonly signalements: ReadonlyArray<Signalement>;
  readonly grappes: ReadonlyArray<GrappePlans>;
  readonly parFamille: Readonly<Record<FamilleSignalement, number>>;
  /** `false` : aucune page n'a de donnée Search Console, « sans impressions » non calculé. */
  readonly impressionsDisponibles: boolean;
  readonly pagesDistinctesSignalees: number;
}

function normaliserTitre(t: string, retirer: ReadonlyArray<string>): string {
  let s = t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ");
  for (const m of retirer) {
    const mn = m
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .trim();
    if (mn.length > 0) s = s.split(mn).join(" ");
  }
  return s.replace(/\s+/g, " ").trim();
}

/** Ensemble des titres H2 normalisés (sans les mots variables). Les vides sont ignorés. */
export function empreintePlan(
  plan: ReadonlyArray<string>,
  retirer: ReadonlyArray<string> = [],
): ReadonlySet<string> {
  const ens = new Set<string>();
  for (const t of plan) {
    const n = normaliserTitre(t, retirer);
    if (n.length > 0) ens.add(n);
  }
  return ens;
}

export function jaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function joursEntre(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / 86_400_000;
}

export function auditerCorpus(
  pages: ReadonlyArray<PageCorpus>,
  maintenant: Date,
  seuils: Seuils = SEUILS_DEFAUT,
): RapportCorpus {
  const signalements: Signalement[] = [];
  const impressionsDisponibles = pages.some((p) => p.impressions !== null);

  for (const p of pages) {
    const base = { id: p.id, type: p.type, url: p.url, titre: p.titre } as const;

    const motsMin = p.type === "article" ? seuils.motsMinArticle : seuils.motsMinPageVille;
    const raisons: string[] = [];
    if (p.mots < motsMin) raisons.push(`${p.mots} mots (seuil d'attention ${motsMin})`);
    if (p.qualityScore !== null && p.qualityScore < seuils.scoreQualiteMin) {
      raisons.push(`score qualité ${p.qualityScore} (seuil d'attention ${seuils.scoreQualiteMin})`);
    }
    if (raisons.length > 0) {
      signalements.push({ ...base, famille: "faible-valeur", motif: raisons.join(" ; ") });
    }

    if (
      p.impressions !== null &&
      p.impressions === 0 &&
      p.publieLe !== null &&
      joursEntre(p.publieLe, maintenant) >= seuils.ancienneteMinJours
    ) {
      signalements.push({
        ...base,
        famille: "sans-impressions",
        motif: `aucune impression Search Console, publiée depuis ${Math.floor(joursEntre(p.publieLe, maintenant))} jours`,
      });
    }
  }

  // Doublons de plan : comparaison deux à deux dans chaque type (un article n'est jamais
  // comparé à une page ville), puis grappes par composantes connexes.
  const grappes: GrappePlans[] = [];
  for (const type of ["article", "page-ville"] as const) {
    const candidates = pages
      .filter((p) => p.type === type)
      .map((p) => ({ p, emp: empreintePlan(p.plan, p.motsVariables ?? []) }))
      .filter((x) => x.emp.size >= seuils.titresMinPlan);
    const parent = candidates.map((_, i) => i);
    const trouver = (i: number): number => {
      let r = i;
      while (parent[r] !== r) r = parent[r] as number;
      return r;
    };
    const simMin = new Map<number, number>();
    const liens: Array<[number, number, number]> = [];
    for (let i = 0; i < candidates.length; i++) {
      for (let j = i + 1; j < candidates.length; j++) {
        const s = jaccard(
          (candidates[i] as (typeof candidates)[number]).emp,
          (candidates[j] as (typeof candidates)[number]).emp,
        );
        if (s >= seuils.jaccardPlanMin) {
          liens.push([i, j, s]);
          const ri = trouver(i);
          const rj = trouver(j);
          if (ri !== rj) parent[rj] = ri;
        }
      }
    }
    for (const [i, , s] of liens) {
      const r = trouver(i);
      simMin.set(r, Math.min(simMin.get(r) ?? 1, s));
    }
    const groupes = new Map<number, number[]>();
    candidates.forEach((_, i) => {
      const r = trouver(i);
      groupes.set(r, [...(groupes.get(r) ?? []), i]);
    });
    for (const [r, idx] of groupes) {
      if (idx.length < 2) continue;
      const membres = idx
        .map((i) => (candidates[i] as (typeof candidates)[number]).p)
        .sort((a, b) => a.url.localeCompare(b.url, "fr"));
      const grappe = `${type}-${[...membres.map((m) => m.id)].sort()[0]}`;
      grappes.push({
        grappe,
        pages: membres.map((m) => ({ id: m.id, url: m.url, titre: m.titre })),
        similariteMin: Math.round((simMin.get(r) ?? 1) * 1000) / 1000,
      });
      for (const m of membres) {
        signalements.push({
          id: m.id,
          type: m.type,
          url: m.url,
          titre: m.titre,
          famille: "doublon-de-plan",
          grappe,
          motif:
            type === "page-ville"
              ? `plan identique à ${membres.length - 1} autre(s) page(s) ville : gabarit sans contenu propre à vérifier`
              : `plan quasi identique à ${membres.length - 1} autre(s) article(s) de la grappe`,
        });
      }
    }
  }

  grappes.sort((a, b) => b.pages.length - a.pages.length || a.grappe.localeCompare(b.grappe, "fr"));
  signalements.sort(
    (a, b) => a.famille.localeCompare(b.famille) || a.url.localeCompare(b.url, "fr"),
  );

  const parFamille: Record<FamilleSignalement, number> = {
    "faible-valeur": 0,
    "sans-impressions": 0,
    "doublon-de-plan": 0,
  };
  for (const s of signalements) parFamille[s.famille] += 1;

  return {
    totalPages: pages.length,
    signalements,
    grappes,
    parFamille,
    impressionsDisponibles,
    pagesDistinctesSignalees: new Set(signalements.map((s) => `${s.type}:${s.id}`)).size,
  };
}

export function formaterRapportCorpus(r: RapportCorpus): string {
  const l: string[] = [];
  l.push("# Audit du corpus publié — signalements pour un humain (lecture seule)");
  l.push("");
  l.push(
    "Aucune action n'est exécutée : ni noindex, ni suppression, ni fusion. À toi de décider, page par page.",
  );
  l.push("");
  l.push(
    `Pages auditées : ${r.totalPages} · pages signalées : ${r.pagesDistinctesSignalees} · faible valeur : ${r.parFamille["faible-valeur"]} · sans impressions : ${r.parFamille["sans-impressions"]} · doublons de plan : ${r.parFamille["doublon-de-plan"]}`,
  );
  if (!r.impressionsDisponibles) {
    l.push("⚠️ Search Console n'a rien répondu : « sans impressions » n'a PAS été calculé.");
  }
  for (const f of ["faible-valeur", "sans-impressions"] as const) {
    l.push("");
    l.push(`## ${f}`);
    const liste = r.signalements.filter((s) => s.famille === f);
    if (liste.length === 0) l.push("Rien à signaler.");
    for (const s of liste) l.push(`- [${s.type}] ${s.url} — ${s.motif}`);
  }
  l.push("");
  l.push("## doublon-de-plan (grappes)");
  if (r.grappes.length === 0) l.push("Rien à signaler.");
  for (const g of r.grappes) {
    l.push(`- ${g.grappe} : ${g.pages.length} pages, similarité min ${g.similariteMin}`);
    for (const p of g.pages) l.push(`    · ${p.url}`);
  }
  return l.join("\n");
}

/** Titres H2 d'un corps HTML, balises internes retirées, dans l'ordre du texte. */
export function extraireH2(html: string): string[] {
  const sortie: string[] = [];
  const re = /<h2\b[^>]*>([\s\S]*?)<\/h2>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const t = (m[1] ?? "")
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (t.length > 0) sortie.push(t);
  }
  return sortie;
}

/** Compare deux adresses sans tenir compte de la barre finale ni de la casse du domaine. */
export function cleUrl(u: string): string {
  return u.trim().replace(/\/+$/, "").toLowerCase();
}
