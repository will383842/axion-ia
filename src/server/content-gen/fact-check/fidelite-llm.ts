/**
 * Contrôle de fidélité par Claude (fiche K5). Un article qui CONTREDIT la base de
 * connaissances (prix, garantie, présence du dirigeant, format, lieu, déplacement,
 * acompte…) n'est jamais publié : barrière `fidelite-llm` → `needs_review`.
 *
 * Interrupteur `CONTENT_FIDELITY_CHECK` : ÉTEINT par défaut, SEULE la valeur exacte
 * `true` allume (ni trim, ni casse). FAIL-CLOSED : erreur du fournisseur, plafond de
 * budget atteint, recherche indisponible, aucune fiche, réponse inexploitable →
 * barrière (jamais de publication par défaut).
 *
 * Pur : aucune base, aucun Redis ; les E/S sont injectées (`fidelite-llm-sources.ts`).
 */

import type { BarriereRelecture } from "../quality/barrieres-publication";
import { extraireJsonTolerant } from "../providers/anthropic";

export type EnvFidelite = Readonly<Record<string, string | undefined>>;

export function controleFideliteLlmActif(env: EnvFidelite = process.env): boolean {
  return env["CONTENT_FIDELITY_CHECK"] === "true";
}

export interface FicheReference {
  readonly id: string;
  readonly titre: string;
  readonly texte: string;
}

export interface CitationContradiction {
  readonly extraitArticle: string;
  readonly ficheId: string | null;
  readonly extraitFiche: string;
  readonly explication: string;
}

export type VerdictFidelite =
  | { readonly statut: "conforme" }
  | { readonly statut: "contradiction"; readonly citations: ReadonlyArray<CitationContradiction> }
  | { readonly statut: "invalide"; readonly raison: string };

export const MAX_CITATIONS = 10;
export const MAX_FICHES = 10;
export const MAX_CARACTERES_FICHE = 6_000;
export const MAX_CARACTERES_ARTICLE = 60_000;

/** Constante figée : rien de variable (cache de prompt), aucun fait chiffré (la source est la base). */
export const SYSTEME_FIDELITE = `Tu es relecteur de fidélité. Tu compares un article aux fiches de la base de connaissances fournies. Seules les fiches font foi.

Une affirmation de l'article absente des fiches n'est PAS une contradiction. Est une contradiction toute affirmation de l'article incompatible avec une fiche.

Points d'attention : prix ou montant, remise, autre prix public ; garantie (formulation, multiple, objet « gains identifiés » contre « gains obtenus ») ; présence du dirigeant ; format présentiel ou distanciel ; lieu ou zone d'intervention (ville d'implantation, région, couverture nationale) ; frais de déplacement, d'hébergement ou de repas ; acompte, annulation, délais.

En cas de doute sur une incompatibilité réelle : contradiction.

Réponds uniquement par un objet JSON : {"statut":"conforme"|"contradiction","citations":[{"extrait_article":"...","fiche_id":"...","extrait_fiche":"...","explication":"..."}]}. « conforme » : citations vide. « contradiction » : au moins une citation.`;

/** Texte public de l'article (ce que le lecteur verra). */
export function textePublic(output: unknown): string {
  const o = (output ?? {}) as Record<string, unknown>;
  const s = (v: unknown): string => (typeof v === "string" ? v : "");
  const corps = s(o["bodyText"]) || s(o["bodyHtml"]).replace(/<[^>]+>/g, " ");
  const faq = Array.isArray(o["faq"])
    ? (o["faq"] as Array<Record<string, unknown>>)
        .map((f) => `${s(f?.["question"])} ${s(f?.["answer"])}`)
        .join("\n")
    : "";
  const quote = (o["expertQuote"] as Record<string, unknown> | undefined)?.["text"];
  return [
    s(o["title"]),
    s(o["metaTitle"]),
    s(o["metaDescription"]),
    s(o["directAnswer"]),
    corps,
    s(o["keyTakeaway"]),
    faq,
    s(quote),
  ]
    .filter((x) => x.trim().length > 0)
    .join("\n\n");
}

export function promptUtilisateur(article: string, fiches: ReadonlyArray<FicheReference>): string {
  const bloc = fiches
    .slice(0, MAX_FICHES)
    .map(
      (f) =>
        `<fiche id="${f.id}" titre="${f.titre.replace(/"/g, "'")}">\n${f.texte.slice(0, MAX_CARACTERES_FICHE)}\n</fiche>`,
    )
    .join("\n");
  return `<fiches>\n${bloc}\n</fiches>\n<article>\n${article}\n</article>`;
}

const tronque = (v: unknown, max: number): string | null =>
  typeof v === "string" ? v.slice(0, max) : null;

export function analyserVerdictFidelite(
  brut: string,
  idsFiches: ReadonlySet<string>,
): VerdictFidelite {
  try {
    const json = extraireJsonTolerant(typeof brut === "string" ? brut : "");
    if (json === null) return { statut: "invalide", raison: "réponse sans JSON exploitable" };
    const v = JSON.parse(json) as Record<string, unknown>;
    if (v["statut"] !== "conforme" && v["statut"] !== "contradiction") {
      return { statut: "invalide", raison: "statut inconnu" };
    }
    const citations: CitationContradiction[] = [];
    if (Array.isArray(v["citations"])) {
      for (const c of v["citations"].slice(0, MAX_CITATIONS)) {
        if (typeof c !== "object" || c === null) continue;
        const r = c as Record<string, unknown>;
        const extraitArticle = tronque(r["extrait_article"], 300);
        if (extraitArticle === null || extraitArticle.trim() === "") continue;
        const id = typeof r["fiche_id"] === "string" ? r["fiche_id"] : null;
        citations.push({
          extraitArticle,
          ficheId: id !== null && idsFiches.has(id) ? id : null,
          extraitFiche: tronque(r["extrait_fiche"], 300) ?? "",
          explication: tronque(r["explication"], 400) ?? "",
        });
      }
    }
    if (v["statut"] === "conforme") {
      return citations.length === 0
        ? { statut: "conforme" }
        : { statut: "contradiction", citations };
    }
    return citations.length === 0
      ? { statut: "invalide", raison: "contradiction sans citation exploitable" }
      : { statut: "contradiction", citations };
  } catch (err) {
    return { statut: "invalide", raison: err instanceof Error ? err.message : String(err) };
  }
}

export function barriereFideliteLlm(
  v: VerdictFidelite | { readonly erreur: string },
  titres: ReadonlyMap<string, string> = new Map(),
): BarriereRelecture | null {
  if ("erreur" in v || v.statut === "invalide") {
    const raison = "erreur" in v ? v.erreur : v.raison;
    return {
      code: "fidelite-llm",
      libelle: `Contrôle de fidélité par Claude indisponible (${raison}) : article NON vérifié, relecture humaine`,
      detail: { statut: "erreur", raison },
    };
  }
  if (v.statut === "conforme") return null;
  const premiere = v.citations[0]!;
  const titre = premiere.ficheId ? titres.get(premiere.ficheId) : undefined;
  return {
    code: "fidelite-llm",
    libelle: `Contredit la base de connaissances (${v.citations.length} point(s)) : « ${premiere.extraitArticle} »${titre ? ` ≠ fiche « ${titre} »` : ""} — relecture humaine, article NON publié`,
    detail: { statut: "contradiction", citations: v.citations },
  };
}

export interface DependancesFideliteLlm {
  readonly rechercherFiches: (a: {
    output: unknown;
    kbEntryIds?: ReadonlyArray<string>;
  }) => Promise<ReadonlyArray<FicheReference>>;
  readonly juger: (a: {
    jobId: string;
    contentType: string;
    systemPrompt: string;
    userPrompt: string;
  }) => Promise<{ output: string; costUsd: number }>;
}

export interface DecisionFideliteLlm {
  readonly executee: boolean;
  readonly fiches: number;
  readonly verdict: VerdictFidelite | null;
  readonly barriere: BarriereRelecture | null;
  readonly coutUsd: number;
}

const echec = (erreur: string, fiches = 0): DecisionFideliteLlm => ({
  executee: true,
  fiches,
  verdict: null,
  barriere: barriereFideliteLlm({ erreur }),
  coutUsd: 0,
});

/** Ne lève JAMAIS. Éteint : aucun appel aux dépendances. Toute défaillance → barrière. */
export async function decisionFideliteLlm(
  args: {
    readonly actif: boolean;
    readonly jobId: string;
    readonly contentType: string;
    readonly output: unknown;
    readonly kbEntryIds?: ReadonlyArray<string> | null | undefined;
  },
  deps: DependancesFideliteLlm,
): Promise<DecisionFideliteLlm> {
  if (!args.actif) return { executee: false, fiches: 0, verdict: null, barriere: null, coutUsd: 0 };
  try {
    let fiches: ReadonlyArray<FicheReference>;
    try {
      fiches = await deps.rechercherFiches({
        output: args.output,
        ...(args.kbEntryIds ? { kbEntryIds: args.kbEntryIds } : {}),
      });
    } catch (err) {
      return echec(
        `recherche des fiches indisponible : ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    if (fiches.length === 0) return echec("aucune fiche de référence retrouvée");
    const article = textePublic(args.output);
    if (article.length > MAX_CARACTERES_ARTICLE) {
      return echec("article trop long pour le contrôle", fiches.length);
    }
    let rep: { output: string; costUsd: number };
    try {
      rep = await deps.juger({
        jobId: args.jobId,
        contentType: args.contentType,
        systemPrompt: SYSTEME_FIDELITE,
        userPrompt: promptUtilisateur(article, fiches),
      });
    } catch (err) {
      return echec(
        `appel au juge impossible : ${err instanceof Error ? err.message : String(err)}`,
        fiches.length,
      );
    }
    const verdict = analyserVerdictFidelite(rep.output, new Set(fiches.map((f) => f.id)));
    const titres = new Map(fiches.map((f) => [f.id, f.titre]));
    const barriere = barriereFideliteLlm(verdict, titres);
    return {
      executee: true,
      fiches: fiches.length,
      verdict,
      barriere,
      coutUsd: Number.isFinite(rep.costUsd) ? rep.costUsd : 0,
    };
  } catch (err) {
    return echec(err instanceof Error ? err.message : String(err));
  }
}
