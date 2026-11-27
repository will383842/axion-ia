/**
 * Vérificateur en deux phases (équipe éditoriale, PR 7), derrière `CONTENT_EQUIPE_EDITORIALE`.
 *
 *  - Phase A « dossier de preuves » AVANT la rédaction : recherche web sur le sujet, rend des
 *    preuves {affirmation, chiffre, url, titre, extrait exact, consultée le, expire le}.
 *    Une preuve SANS extrait, ou dont l'URL n'a pas été renvoyée par l'outil, est refusée.
 *  - Phase B « vérification finale » sur le texte rédigé : chaque phrase factuelle doit
 *    correspondre à une preuve non expirée du dossier ; sinon l'outil `web_fetch` lit la page
 *    source ; si rien ne confirme, la phrase est marquée À RETIRER (fail-closed).
 *
 * Outils serveur de l'API : `web_search_20260318` et `web_fetch_20260318` (dernières versions
 * du SDK 0.120). Plafond : 6 recherches AU TOTAL par article (A + B). Le coût passe par la même
 * porte que le fact-check existant (`assertPlafondsClaude`, puis solde au coût réel).
 * Aucun appel réseau dans les tests : l'appel HTTP et le registre sont injectables.
 */

import { computeCost } from "../providers/anthropic";
import { assertPlafondsClaude, MODELES, type AccordBlogClaude } from "../providers/blog-claude";
import { solderReservation } from "../providers/blog-claude-ledger";
import type { GenerationRequest } from "../providers/IProvider";
import {
  FactCheckClaudeError,
  MAX_TOKENS_SORTIE,
  PRIX_RECHERCHE_USD,
  appelerMessagesApi,
  fraisFixesMaxUsd,
  sourcesDeLaRecherche,
  urlValide,
  type AppelMessages,
  type ReponseMessages,
} from "../clients/claude-search";

export const PLAFOND_RECHERCHES_ARTICLE = 6;
/** Part des 6 recherches laissée à la phase A (le reste sert la phase B). */
export const PLAFOND_RECHERCHES_PHASE_A = 4;
export const MAX_LECTURES_PAGE = 3;
export const VALIDITE_PREUVE_JOURS = 90;
/** Borne du texte d'une page lue (jetons) : sert aussi à dimensionner la réservation. */
export const JETONS_PAR_LECTURE = 15_000;
const EXTRAIT_MIN = 15;
const MAX_PREUVES = 20;
const MAX_PHRASES = 25;
const JOUR_MS = 86_400_000;

export const OUTIL_RECHERCHE = "web_search_20260318";
export const OUTIL_LECTURE = "web_fetch_20260318";

export interface Preuve {
  readonly affirmation: string;
  readonly chiffre: string | null;
  readonly url: string;
  readonly titreSource: string;
  readonly extrait: string;
  readonly consulteLe: string;
  readonly expireLe: string;
}

export interface DossierPreuves {
  readonly preuves: ReadonlyArray<Preuve>;
  /** Preuves écartées (extrait manquant, URL non renvoyée par l'outil, chiffre absent). */
  readonly refusees: number;
  /** Recherches réellement consommées : à passer à la phase B pour tenir le plafond. */
  readonly recherches: number;
  readonly coutUsd: number;
  readonly sources: ReadonlyArray<{ url: string; title: string }>;
}

export interface PhraseVerifiee {
  readonly phrase: string;
  readonly statut: "confirmee" | "a_retirer";
  readonly url: string | null;
  readonly via: "dossier" | "lecture" | null;
  readonly note: string;
}

export interface ResultatVerificationFinale {
  readonly phrases: ReadonlyArray<PhraseVerifiee>;
  /** Phrases à retirer du texte (non confirmées). */
  readonly aRetirer: ReadonlyArray<string>;
  readonly recherches: number;
  readonly lectures: number;
  readonly coutUsd: number;
  readonly sources: ReadonlyArray<{ url: string; title: string }>;
}

export interface DependancesDeuxPhases {
  readonly appeler?: AppelMessages;
  readonly reserver?: (
    req: GenerationRequest,
    role: "court",
    maintenant: Date,
    fraisFixesUsd: number,
  ) => Promise<AccordBlogClaude>;
  readonly solder?: typeof solderReservation;
}

// ── Appel avec réservation (même porte que le fact-check existant) ──────────

async function appelerAvecReservation(
  a: {
    readonly jobId: string;
    readonly contentType: string;
    readonly system: string;
    readonly user: string;
    readonly recherchesMax: number;
    readonly lecturesMax: number;
  },
  deps: DependancesDeuxPhases,
  maintenant: Date,
): Promise<{
  reponse: ReponseMessages;
  recherches: number;
  lectures: number;
  coutUsd: number;
}> {
  const appeler = deps.appeler ?? appelerMessagesApi;
  const reserver = deps.reserver ?? assertPlafondsClaude;
  const solder = deps.solder ?? solderReservation;
  const model = MODELES.court;

  let accord: AccordBlogClaude;
  try {
    accord = await reserver(
      {
        jobId: a.jobId,
        contentType: a.contentType,
        role: "text",
        systemPrompt: a.system,
        userPrompt: a.user,
        maxTokens: MAX_TOKENS_SORTIE,
      } as GenerationRequest,
      "court",
      maintenant,
      fraisFixesMaxUsd(a.recherchesMax, a.lecturesMax, JETONS_PAR_LECTURE),
    );
  } catch (err) {
    throw new FactCheckClaudeError(
      `Réservation de coût refusée : ${err instanceof Error ? err.message : String(err)}`,
      "plafond_ou_config",
    );
  }

  const tools: Array<Record<string, unknown>> = [];
  if (a.recherchesMax > 0) {
    tools.push({ type: OUTIL_RECHERCHE, name: "web_search", max_uses: a.recherchesMax });
  }
  if (a.lecturesMax > 0) {
    tools.push({
      type: OUTIL_LECTURE,
      name: "web_fetch",
      max_uses: a.lecturesMax,
      max_content_tokens: JETONS_PAR_LECTURE,
    });
  }

  let reponse: ReponseMessages;
  try {
    reponse = await appeler({
      model,
      max_tokens: MAX_TOKENS_SORTIE,
      system: a.system,
      messages: [{ role: "user", content: a.user }],
      tools,
    });
  } catch (err) {
    // Réservation laissée au maximum (on compte trop, jamais trop peu), sauf clé absente.
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

  const usage = reponse.usage;
  const recherches =
    usage?.server_tool_use?.web_search_requests ?? (a.recherchesMax === 0 ? 0 : undefined);
  const lectures = usage?.server_tool_use?.web_fetch_requests ?? 0;
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

  if (reponse.stop_reason === "pause_turn" || reponse.stop_reason === "max_tokens") {
    throw new FactCheckClaudeError(
      `Réponse incomplète (${reponse.stop_reason}) : article non vérifié`,
      "reponse_invalide",
    );
  }
  if (recherches > a.recherchesMax) {
    throw new FactCheckClaudeError(
      `Plafond de recherches dépassé (${recherches} > ${a.recherchesMax}) : article non vérifié`,
      "plafond_ou_config",
    );
  }
  return { reponse, recherches, lectures, coutUsd };
}

function texteDe(reponse: ReponseMessages): string {
  return reponse.content
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text as string)
    .join("\n");
}

function tableauJson(texte: string): unknown[] {
  const debut = texte.indexOf("[");
  const fin = texte.lastIndexOf("]");
  if (debut === -1 || fin <= debut) return [];
  try {
    const p: unknown = JSON.parse(texte.slice(debut, fin + 1));
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

/** URL des pages RÉELLEMENT lues par l'outil (jamais celles que le modèle écrit seul). */
function pagesLues(reponse: ReponseMessages): Map<string, string> {
  const lues = new Map<string, string>();
  for (const bloc of reponse.content) {
    if (bloc.type !== "web_fetch_tool_result") continue;
    const c = bloc.content as
      { type?: unknown; url?: unknown; content?: { source?: { data?: unknown } } } | undefined;
    if (c && c.type === "web_fetch_result" && urlValide(c.url)) {
      const data = c.content?.source?.data;
      lues.set(c.url, typeof data === "string" ? data : "");
    }
  }
  return lues;
}

const normaliser = (s: string) => s.replace(/[\s  ]+/g, "").toLowerCase();

/** Nombres d'une phrase, sans espaces (« 1 200 » → « 1200 »). */
function nombresDe(phrase: string): string[] {
  return (phrase.match(/\d+(?:[\s\u00a0\u202f.,]\d+)*/g) ?? []).map((n) => normaliser(n));
}

/** Chaque nombre de la phrase doit figurer dans le texte de la preuve ou de la page lue. */
function nombresPresents(phrase: string, texte: string): boolean {
  // Nombres entiers comparés entre eux (« 12 » n'est pas trouvé dans « 2012 »).
  const presents = new Set(
    (texte.match(/\d+(?:[ \u00a0\u202f.,]\d+)*/g) ?? []).flatMap((n) => [
      normaliser(n),
      ...n.split(/[ \u00a0\u202f]/),
    ]),
  );
  return nombresDe(phrase).every((n) => presents.has(n));
}

// ── Phase A ──────────────────────────────────────────────────────────────────

const SYSTEME_A = `Tu constitues un dossier de preuves AVANT la rédaction d'un article. Utilise la recherche web sur le sujet donné, puis réponds UNIQUEMENT par un tableau JSON :
[{"affirmation": "fait ou chiffre utilisable dans l'article", "chiffre": "12 %" ou null, "url": "https://...", "titre": "titre de la source", "extrait": "extrait EXACT recopié de la source, qui contient le fait et le chiffre"}]
Règles :
- Chaque preuve a un extrait EXACT, jamais reformulé ni inventé. Pas d'extrait = pas de preuve.
- N'utilise que des URL renvoyées par la recherche. Sources fiables et récentes (≤ 3 ans) uniquement.
- Si le fait porte un chiffre, "chiffre" doit apparaître tel quel dans "extrait".
- Aucune prose hors du tableau JSON.`;

export async function constituerDossierPreuves(
  args: {
    readonly jobId: string;
    readonly contentType: string;
    readonly sujet: string;
    readonly validiteJours?: number;
  },
  deps: DependancesDeuxPhases = {},
  maintenant: Date = new Date(),
): Promise<DossierPreuves> {
  const validite = args.validiteJours ?? VALIDITE_PREUVE_JOURS;
  const r = await appelerAvecReservation(
    {
      jobId: args.jobId,
      contentType: args.contentType,
      system: SYSTEME_A,
      user: `Sujet de l'article : « ${args.sujet.slice(0, 500)} »`,
      recherchesMax: PLAFOND_RECHERCHES_PHASE_A,
      lecturesMax: 0,
    },
    deps,
    maintenant,
  );
  const { sources, erreurs } = sourcesDeLaRecherche(r.reponse);
  if (erreurs > 0 && sources.size === 0) {
    throw new FactCheckClaudeError("Recherche web indisponible", "appel");
  }
  const consulteLe = maintenant.toISOString();
  const expireLe = new Date(maintenant.getTime() + validite * JOUR_MS).toISOString();
  const preuves: Preuve[] = [];
  let refusees = 0;
  for (const brut of tableauJson(texteDe(r.reponse)).slice(0, MAX_PREUVES)) {
    const b = (brut ?? {}) as Record<string, unknown>;
    const extrait = typeof b["extrait"] === "string" ? b["extrait"].trim() : "";
    const affirmation = typeof b["affirmation"] === "string" ? b["affirmation"].trim() : "";
    const url = b["url"];
    const chiffre =
      typeof b["chiffre"] === "string" && b["chiffre"].trim() ? b["chiffre"].trim() : null;
    const valide =
      extrait.length >= EXTRAIT_MIN &&
      affirmation.length > 0 &&
      urlValide(url) &&
      sources.has(url) &&
      (chiffre === null || normaliser(extrait).includes(normaliser(chiffre)));
    if (!valide) {
      refusees += 1;
      continue;
    }
    preuves.push({
      affirmation,
      chiffre,
      url: url as string,
      titreSource:
        typeof b["titre"] === "string" && b["titre"].trim()
          ? b["titre"].trim()
          : (sources.get(url as string) ?? ""),
      extrait,
      consulteLe,
      expireLe,
    });
  }
  return {
    preuves,
    refusees,
    recherches: r.recherches,
    coutUsd: r.coutUsd,
    sources: [...sources].map(([url, title]) => ({ url, title })),
  };
}

// ── Phase B ──────────────────────────────────────────────────────────────────

const SYSTEME_B = `Tu fais la vérification finale d'un article rédigé. Pour CHAQUE phrase numérotée, décide si son chiffre ou son affirmation factuelle est confirmé :
1. par une preuve numérotée du dossier fourni (donne son numéro dans "preuve") ;
2. sinon, lis la page source avec l'outil de lecture web (donne l'URL lue dans "url") ;
3. sinon, la phrase est à retirer.
Réponds UNIQUEMENT par un tableau JSON :
[{"id": 1, "statut": "confirmee" | "a_retirer", "preuve": 2 ou null, "url": "https://..." ou null, "note": "une phrase"}]
En cas de doute, choisis TOUJOURS "a_retirer". Ne cite jamais une URL que tu n'as pas lue. Aucune prose hors du tableau JSON.`;

export async function verifierTexteFinal(
  args: {
    readonly jobId: string;
    readonly contentType: string;
    readonly phrases: ReadonlyArray<string>;
    readonly dossier: DossierPreuves;
  },
  deps: DependancesDeuxPhases = {},
  maintenant: Date = new Date(),
): Promise<ResultatVerificationFinale> {
  if (args.phrases.length === 0) {
    return { phrases: [], aRetirer: [], recherches: 0, lectures: 0, coutUsd: 0, sources: [] };
  }
  const aVerifier = args.phrases.slice(0, MAX_PHRASES);
  const horsLimite = args.phrases.slice(MAX_PHRASES);
  const actives = args.dossier.preuves.filter((p) => Date.parse(p.expireLe) > maintenant.getTime());
  const restant = Math.max(0, PLAFOND_RECHERCHES_ARTICLE - args.dossier.recherches);

  const dossierTexte = actives.length
    ? actives
        .map(
          (p, i) =>
            `Preuve ${i + 1} : ${p.affirmation} — « ${p.extrait} » (${p.titreSource}, ${p.url})`,
        )
        .join("\n")
    : "(dossier vide)";
  const user =
    `Dossier de preuves :\n${dossierTexte}\n\nPhrases à vérifier :\n` +
    aVerifier.map((p, i) => `Phrase ${i + 1} : « ${p} »`).join("\n");

  const r = await appelerAvecReservation(
    {
      jobId: args.jobId,
      contentType: args.contentType,
      system: SYSTEME_B,
      user,
      recherchesMax: restant,
      lecturesMax: MAX_LECTURES_PAGE,
    },
    deps,
    maintenant,
  );
  const lues = pagesLues(r.reponse);
  const brut = tableauJson(texteDe(r.reponse));
  const { sources } = sourcesDeLaRecherche(r.reponse);
  for (const p of actives) if (!sources.has(p.url)) sources.set(p.url, p.titreSource);

  const verifiees: PhraseVerifiee[] = aVerifier.map((phrase, i) => {
    const ligne = brut.find((x) => (x as { id?: unknown } | null)?.id === i + 1) as
      Record<string, unknown> | undefined;
    const note = typeof ligne?.["note"] === "string" ? ligne["note"].slice(0, 400) : "";
    if (ligne?.["statut"] === "confirmee") {
      const idx = ligne["preuve"];
      const preuve =
        typeof idx === "number" && Number.isInteger(idx) ? actives[idx - 1] : undefined;
      if (preuve && nombresPresents(phrase, `${preuve.extrait} ${preuve.chiffre ?? ""}`)) {
        return { phrase, statut: "confirmee", url: preuve.url, via: "dossier", note };
      }
      const url = ligne["url"];
      if (urlValide(url) && lues.has(url) && nombresPresents(phrase, lues.get(url)!)) {
        return { phrase, statut: "confirmee", url, via: "lecture", note };
      }
    }
    return {
      phrase,
      statut: "a_retirer",
      url: null,
      via: null,
      note: note || "Aucune preuve ni page source ne confirme cette phrase",
    };
  });
  const toutes: PhraseVerifiee[] = [
    ...verifiees,
    ...horsLimite.map((phrase): PhraseVerifiee => ({
      phrase,
      statut: "a_retirer",
      url: null,
      via: null,
      note: "Au-delà du nombre de phrases vérifiables en un appel",
    })),
  ];
  return {
    phrases: toutes,
    aRetirer: toutes.filter((p) => p.statut === "a_retirer").map((p) => p.phrase),
    recherches: r.recherches,
    lectures: r.lectures,
    coutUsd: r.coutUsd,
    sources: [...sources].map(([url, title]) => ({ url, title })),
  };
}
