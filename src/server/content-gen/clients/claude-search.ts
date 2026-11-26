/**
 * Fact-check par Claude avec l'outil serveur `web_search` de l'API Messages (PR 5).
 *
 * Remplace la correction OpenAI et la vérification Perplexity pour les types activés
 * (`CONTENT_GEN_CLAUDE_TYPES`), derrière un drapeau dédié ÉTEINT par défaut
 * (`CONTENT_GEN_FACTCHECK_CLAUDE`). Règles de Will :
 *  - une affirmation NON vérifiée = article NON publié (relecture humaine) ;
 *  - erreur, plafond atteint, recherche indisponible = non publié aussi (fail-closed),
 *    JAMAIS un repli silencieux vers OpenAI ou Perplexity ;
 *  - les sources trouvées (URL) sont gardées avec l'article.
 *
 * Argent : le coût des recherches (10 $ / 1 000) ET des jetons (les résultats de recherche
 * comptent en entrée) est RÉSERVÉ dans le registre `cost_ledger` avant l'appel, par la même
 * porte que le texte (`assertPlafondsClaude` : plafonds jour/mois, réserve Qualiopi,
 * suspension, type autorisé), puis soldé au coût réel.
 *
 * Aucun appel réseau dans les tests : l'appel HTTP et le registre sont injectables.
 */

import { computeCost } from "../providers/anthropic";
import { assertPlafondsClaude, MODELES, type AccordBlogClaude } from "../providers/blog-claude";
import { solderReservation } from "../providers/blog-claude-ledger";
import type { GenerationRequest } from "../providers/IProvider";

const URL_API = "https://api.anthropic.com/v1/messages";
const VERSION_API = "2023-06-01";
const DELAI_MS = 300_000;

/** Tarif public de l'outil `web_search` : 10 $ pour 1 000 recherches. */
export const PRIX_RECHERCHE_USD = 10 / 1000;
/** Recherches autorisées par appel (borne dure envoyée à l'API : `max_uses`). */
export const MAX_RECHERCHES = 5;
/** Affirmations vérifiées par appel ; au-delà, les autres restent NON vérifiées. */
export const MAX_AFFIRMATIONS = 12;
/**
 * Jetons d'entrée supposés par recherche (résultats renvoyés au modèle). Sert UNIQUEMENT à
 * dimensionner la réservation ; le solde final utilise l'usage réel rapporté par l'API.
 */
export const JETONS_ENTREE_PAR_RECHERCHE = 30_000;
export const MAX_TOKENS_SORTIE = 4000;

export type StatutAffirmation = "verifiee" | "refutee" | "non-verifiee";

export interface VerdictAffirmation {
  readonly affirmation: string;
  readonly statut: StatutAffirmation;
  /** URL de sources réellement renvoyées par la recherche pour cette affirmation. */
  readonly sources: ReadonlyArray<string>;
  readonly note: string;
}

export interface ResultatFactCheck {
  readonly verdicts: ReadonlyArray<VerdictAffirmation>;
  /** Toutes les sources (URL) trouvées par la recherche, à garder avec l'article. */
  readonly sources: ReadonlyArray<{ url: string; title: string }>;
  readonly recherches: number;
  readonly coutUsd: number;
}

/** Échec du fact-check : l'appelant doit traiter l'article comme NON vérifié. */
export class FactCheckClaudeError extends Error {
  constructor(
    message: string,
    readonly code: "appel" | "reponse_invalide" | "plafond_ou_config" | "cle_absente",
  ) {
    super(message);
    this.name = "FactCheckClaudeError";
  }
}

// ── Forme minimale de la réponse Messages (non-streaming) ────────────────────

interface BlocReponse {
  readonly type: string;
  readonly text?: string;
  readonly content?: unknown;
  readonly citations?: ReadonlyArray<{ url?: string; title?: string }>;
}
export interface ReponseMessages {
  readonly content: ReadonlyArray<BlocReponse>;
  readonly stop_reason?: string | null;
  readonly usage?: {
    readonly input_tokens?: number;
    readonly output_tokens?: number;
    readonly cache_read_input_tokens?: number | null;
    readonly cache_creation_input_tokens?: number | null;
    readonly server_tool_use?: { readonly web_search_requests?: number } | null;
  };
}

export type AppelMessages = (corps: Record<string, unknown>) => Promise<ReponseMessages>;

/** Appel HTTP réel (jamais utilisé par les tests). */
export const appelerMessagesApi: AppelMessages = async (corps) => {
  const cle = process.env["ANTHROPIC_API_KEY"];
  if (!cle || cle.includes("stub.invalid")) {
    throw new FactCheckClaudeError("Clé Anthropic absente", "cle_absente");
  }
  const rep = await fetch(URL_API, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": cle,
      "anthropic-version": VERSION_API,
    },
    body: JSON.stringify(corps),
    signal: AbortSignal.timeout(DELAI_MS),
  });
  if (!rep.ok) {
    throw new FactCheckClaudeError(`API Anthropic : HTTP ${rep.status}`, "appel");
  }
  return (await rep.json()) as ReponseMessages;
};

export interface DependancesFactCheck {
  readonly appeler?: AppelMessages;
  readonly reserver?: (
    req: GenerationRequest,
    role: "court",
    maintenant: Date,
    fraisFixesUsd: number,
  ) => Promise<AccordBlogClaude>;
  readonly solder?: typeof solderReservation;
}

const SYSTEME = `Tu es un fact-checker rigoureux. Pour CHAQUE affirmation numérotée, utilise la recherche web puis réponds UNIQUEMENT par un tableau JSON :
[{"id": 1, "statut": "verifiee" | "refutee" | "non-verifiee", "sources": ["https://..."], "note": "une phrase"}]
Règles :
- "verifiee" : une source fiable et récente (≤ 3 ans) trouvée par la recherche confirme le chiffre ou le fait. Cite son URL exacte dans "sources".
- "refutee" : une source fiable contredit l'affirmation (donne la valeur correcte dans "note").
- "non-verifiee" : aucune source fiable trouvée, ambiguïté, ou doute. En cas de doute, choisis TOUJOURS "non-verifiee".
- Ne cite jamais une URL que la recherche n'a pas renvoyée. Aucune prose hors du tableau JSON.`;

function promptUtilisateur(affirmations: ReadonlyArray<string>): string {
  return (
    `Vérifie les ${affirmations.length} affirmations suivantes :\n\n` +
    affirmations.map((a, i) => `Affirmation ${i + 1} : « ${a} »`).join("\n")
  );
}

/**
 * Réserve maximale de frais fixes : recherches + jetons. Avec l'outil serveur, chaque tour de
 * la boucle interne RELIT tous les résultats précédents en entrée : pour n recherches
 * successives, l'entrée cumulée vaut au plus R × n(n+1)/2 (borne quadratique, pas linéaire).
 * La sortie est comptée à `max_tokens` pour chacun des n+1 tours.
 */
export function fraisFixesMaxUsd(): number {
  const n = MAX_RECHERCHES;
  return (
    n * PRIX_RECHERCHE_USD +
    computeCost(
      MODELES.court,
      JETONS_ENTREE_PAR_RECHERCHE * ((n * (n + 1)) / 2),
      MAX_TOKENS_SORTIE * n,
      0,
      0,
    )
  );
}

function urlValide(u: unknown): u is string {
  if (typeof u !== "string") return false;
  try {
    const p = new URL(u);
    return p.protocol === "https:" || p.protocol === "http:";
  } catch {
    return false;
  }
}

/** Sources RÉELLEMENT renvoyées par l'outil (jamais celles que le modèle écrit seul). */
function sourcesDeLaRecherche(reponse: ReponseMessages): {
  sources: Map<string, string>;
  erreurs: number;
} {
  const sources = new Map<string, string>();
  let erreurs = 0;
  for (const bloc of reponse.content) {
    if (bloc.type === "web_search_tool_result") {
      if (Array.isArray(bloc.content)) {
        for (const r of bloc.content as Array<{ url?: unknown; title?: unknown }>) {
          if (urlValide(r?.url)) sources.set(r.url, typeof r.title === "string" ? r.title : "");
        }
      } else {
        erreurs += 1; // objet `web_search_tool_result_error`
      }
    }
    if (bloc.type === "text" && Array.isArray(bloc.citations)) {
      for (const c of bloc.citations) {
        if (urlValide(c?.url) && !sources.has(c.url)) sources.set(c.url, c.title ?? "");
      }
    }
  }
  return { sources, erreurs };
}

function analyserVerdicts(
  texte: string,
  affirmations: ReadonlyArray<string>,
  sourcesTrouvees: ReadonlyMap<string, string>,
): ReadonlyArray<VerdictAffirmation> {
  const debut = texte.indexOf("[");
  const fin = texte.lastIndexOf("]");
  let brut: Array<{ id?: unknown; statut?: unknown; sources?: unknown; note?: unknown }> = [];
  if (debut !== -1 && fin > debut) {
    try {
      const parse: unknown = JSON.parse(texte.slice(debut, fin + 1));
      if (Array.isArray(parse)) brut = parse as typeof brut;
    } catch {
      brut = [];
    }
  }
  return affirmations.map((affirmation, i) => {
    const ligne = brut.find((b) => b?.id === i + 1);
    const statutBrut = ligne?.statut;
    const sources = Array.isArray(ligne?.sources)
      ? (ligne.sources as unknown[]).filter(
          (u): u is string => urlValide(u) && sourcesTrouvees.has(u),
        )
      : [];
    const note = typeof ligne?.note === "string" ? ligne.note.slice(0, 400) : "";
    // « verifiee » exige une source RÉELLEMENT trouvée ; sinon non vérifiée (fail-closed).
    if (statutBrut === "verifiee" && sources.length > 0) {
      return { affirmation, statut: "verifiee" as const, sources, note };
    }
    if (statutBrut === "refutee") {
      return { affirmation, statut: "refutee" as const, sources, note };
    }
    return {
      affirmation,
      statut: "non-verifiee" as const,
      sources,
      note: note || "Aucune source fiable confirmée",
    };
  });
}

/**
 * Vérifie des affirmations. Lève `FactCheckClaudeError` au moindre problème : l'appelant
 * traite alors l'article comme NON vérifié. Les affirmations au-delà de `MAX_AFFIRMATIONS`
 * restent « non-verifiee » (jamais supposées vraies).
 */
export async function verifierAffirmationsAvecClaude(
  args: {
    readonly jobId: string;
    readonly contentType: string;
    readonly affirmations: ReadonlyArray<string>;
  },
  deps: DependancesFactCheck = {},
): Promise<ResultatFactCheck> {
  const appeler = deps.appeler ?? appelerMessagesApi;
  const reserver = deps.reserver ?? assertPlafondsClaude;
  const solder = deps.solder ?? solderReservation;

  if (args.affirmations.length === 0) {
    return { verdicts: [], sources: [], recherches: 0, coutUsd: 0 };
  }
  const aVerifier = args.affirmations.slice(0, MAX_AFFIRMATIONS);
  const restantes = args.affirmations.slice(MAX_AFFIRMATIONS);
  const model = MODELES.court;
  const userPrompt = promptUtilisateur(aVerifier);

  // 1. Réservation AVANT l'appel (plafonds jour/mois, réserve Qualiopi, suspension, type).
  let accord: AccordBlogClaude;
  try {
    accord = await reserver(
      {
        jobId: args.jobId,
        contentType: args.contentType,
        role: "text",
        systemPrompt: SYSTEME,
        userPrompt,
        maxTokens: MAX_TOKENS_SORTIE,
      } as GenerationRequest,
      "court",
      new Date(),
      fraisFixesMaxUsd(),
    );
  } catch (err) {
    throw new FactCheckClaudeError(
      `Réservation de coût refusée : ${err instanceof Error ? err.message : String(err)}`,
      "plafond_ou_config",
    );
  }

  // 2. Appel. Sur erreur, la réservation reste au MAXIMUM (on compte trop, jamais trop peu),
  //    sauf si aucune requête n'a pu partir (clé absente) : rien de facturé, solde à zéro.
  let reponse: ReponseMessages;
  try {
    reponse = await appeler({
      model,
      max_tokens: MAX_TOKENS_SORTIE,
      system: SYSTEME,
      messages: [{ role: "user", content: userPrompt }],
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: MAX_RECHERCHES }],
    });
  } catch (err) {
    if (err instanceof FactCheckClaudeError && err.code === "cle_absente") {
      await solder(accord.reservation.id, 0, { input: 0, output: 0 });
    }
    throw err instanceof FactCheckClaudeError
      ? err
      : new FactCheckClaudeError(
          `Appel Claude impossible : ${err instanceof Error ? err.message : String(err)}`,
          "appel",
        );
  }

  // 3. Solde au coût RÉEL (jetons + recherches). Usage absent = réservation maximale gardée.
  const usage = reponse.usage;
  const recherches = usage?.server_tool_use?.web_search_requests;
  if (
    !usage ||
    typeof usage.input_tokens !== "number" ||
    typeof usage.output_tokens !== "number" ||
    typeof recherches !== "number"
  ) {
    throw new FactCheckClaudeError(
      "Usage absent de la réponse : coût non établi, réservation maximale conservée",
      "reponse_invalide",
    );
  }
  const lecture = usage.cache_read_input_tokens ?? 0;
  const ecriture = usage.cache_creation_input_tokens ?? 0;
  const coutUsd =
    computeCost(model, usage.input_tokens, usage.output_tokens, lecture, ecriture) +
    recherches * PRIX_RECHERCHE_USD;
  await solder(accord.reservation.id, coutUsd, {
    input: usage.input_tokens + lecture + ecriture,
    output: usage.output_tokens,
  });

  // 4. Lecture fail-closed.
  if (reponse.stop_reason === "pause_turn" || reponse.stop_reason === "max_tokens") {
    throw new FactCheckClaudeError(
      `Réponse incomplète (${reponse.stop_reason}) : article non vérifié`,
      "reponse_invalide",
    );
  }
  const { sources, erreurs } = sourcesDeLaRecherche(reponse);
  if (erreurs > 0 && sources.size === 0) {
    throw new FactCheckClaudeError("Recherche web indisponible", "appel");
  }
  const texte = reponse.content
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text as string)
    .join("\n");
  const verdicts = [
    ...analyserVerdicts(texte, aVerifier, sources),
    ...restantes.map((affirmation): VerdictAffirmation => ({
      affirmation,
      statut: "non-verifiee",
      sources: [],
      note: "Au-delà du nombre d'affirmations vérifiables en un appel",
    })),
  ];
  return {
    verdicts,
    sources: [...sources].map(([url, title]) => ({ url, title })),
    recherches,
    coutUsd,
  };
}
