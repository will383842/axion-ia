/**
 * Panel GEO (P11) : chaque jour ouvré, 3 questions de la liste VALIDÉE sont posées à Claude
 * (Sonnet 5.5 + `web_search`, `max_uses: 2`, sortie ≈ 1 000 jetons, `user_location` France). On garde
 * les URL et domaines cités, la présence et le rang d'axion-ia.com ; JAMAIS le texte de la réponse.
 *
 * ÉTEINT par défaut, à trois verrous : `CONTENT_PILOTAGE_SEO` (worker), clé `geo_panel`
 * `{ actif: true }` de `la table de réglages du contenu`, et une liste de questions validée par Will
 * (`geo_panel_questions`, `validee: true`). Aucun des trois : la tâche saute sans appel.
 *
 * Argent (fail-closed) : un job porteur de P0 (`origine: "pilotage"`, sous-plafonds 2 $/jour et
 * 30 $/mois) + `assertPlafondsClaude` RÉSERVENT le coût maximal AVANT chaque appel ; le premier refus
 * arrête la passe. Le coût réel solde la réservation. Aucun appel réseau dans les tests (injection).
 */
import type { PrismaClient } from "../../../../../prisma/generated/client";
import {
  appelerMessagesApi,
  PRIX_RECHERCHE_USD,
  JETONS_ENTREE_PAR_RECHERCHE,
  sourcesDeLaRecherche,
  type AppelMessages,
} from "../../clients/claude-search";
import { computeCost } from "../../providers/anthropic";
import { assertPlafondsClaude, interrupteurBlogClaude, MODELES } from "../../providers/blog-claude";
import { BlogClaudeRefusError, solderReservation } from "../../providers/blog-claude-ledger";
import { creerJobPorteur, type JobPorteur } from "../../providers/job-porteur";
import type { GenerationRequest } from "../../providers/IProvider";
import { listeValidee, type QuestionPanel } from "./panel-questions";

export const CLE_CONFIG_PANEL = "geo_panel";
export const CLE_CONFIG_QUESTIONS = "geo_panel_questions";
export const MOTEUR_PANEL = "claude-web-search";
export const QUESTIONS_PAR_JOUR = 3;
export const MAX_RECHERCHES_PANEL = 2;
export const MAX_TOKENS_PANEL = 1000;
export const DOMAINE_SITE = "axion-ia.com";
const MAX_URLS = 15;
const MAX_DOMAINES = 15;
/** Plafond de coût d'UNE passe (3 questions) sur le job porteur, en dollars. */
const PLAFOND_PASSE_USD = 2;

const SYSTEME =
  "Tu réponds en français à un dirigeant de TPE ou PME française. Utilise la recherche web si utile. " +
  "Réponse courte et factuelle (150 mots maximum).";

// ── Pur : analyse d'une réponse ───────────────────────────────────────────────

/** Vrai pour `axion-ia.com` et ses sous-domaines, jamais pour un domaine qui le contient seulement. */
export function estDomaineAxion(hote: string): boolean {
  const h = hote.toLowerCase().replace(/\.$/, "");
  return h === DOMAINE_SITE || h.endsWith(`.${DOMAINE_SITE}`);
}

function hoteDe(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

export interface AnalysePanel {
  readonly urls: ReadonlyArray<string>;
  readonly domaines: ReadonlyArray<string>;
  readonly presente: boolean;
  /** Rang (1 = premier) de la première URL d'axion-ia.com parmi les URL, ordre d'apparition. */
  readonly rang: number | null;
}

export function analyserSources(sources: ReadonlyArray<string>): AnalysePanel {
  const urls: string[] = [];
  const domaines: string[] = [];
  let rang: number | null = null;
  for (const brute of sources) {
    const hote = hoteDe(brute);
    if (!hote) continue;
    const u = new URL(brute);
    u.hash = "";
    const url = u.toString().slice(0, 500);
    if (urls.includes(url)) continue;
    urls.push(url);
    if (!domaines.includes(hote)) domaines.push(hote);
    if (rang === null && estDomaineAxion(hote)) rang = urls.length;
  }
  return {
    urls: urls.slice(0, MAX_URLS),
    domaines: domaines.slice(0, MAX_DOMAINES),
    presente: rang !== null,
    rang,
  };
}

/** Les `QUESTIONS_PAR_JOUR` questions du jour : rotation déterministe sur les jours ouvrés. */
export function questionsDuJour(
  questions: ReadonlyArray<QuestionPanel>,
  jour: string,
): ReadonlyArray<QuestionPanel> {
  const t = Date.parse(`${jour}T00:00:00Z`);
  const dow = new Date(t).getUTCDay(); // 0 dimanche … 6 samedi
  if (dow === 0 || dow === 6 || questions.length === 0) return [];
  const lundiRef = Date.parse("2026-01-05T00:00:00Z"); // un lundi
  const jours = Math.floor((t - lundiRef) / 86_400_000);
  const ouvres = Math.floor(jours / 7) * 5 + (dow - 1);
  const n = Math.min(QUESTIONS_PAR_JOUR, questions.length);
  return Array.from(
    { length: n },
    (_, i) => questions[(ouvres * QUESTIONS_PAR_JOUR + i) % questions.length] as QuestionPanel,
  );
}

/** Réservation maximale d'un appel : recherches + jetons (entrée cumulée quadratique, sortie par tour). */
export function coutMaxAppelUsd(): number {
  const n = MAX_RECHERCHES_PANEL;
  return (
    n * PRIX_RECHERCHE_USD +
    computeCost(
      MODELES.court,
      JETONS_ENTREE_PAR_RECHERCHE * ((n * (n + 1)) / 2 + n),
      MAX_TOKENS_PANEL * (n + 1),
      0,
      0,
    )
  );
}

// ── Appel d'UNE question ──────────────────────────────────────────────────────

export interface DepsPanel {
  readonly appeler?: AppelMessages;
  readonly reserver?: typeof assertPlafondsClaude;
  readonly solder?: typeof solderReservation;
  readonly creerPorteur?: typeof creerJobPorteur;
  readonly maintenant?: () => Date;
  readonly blogClaudeActif?: () => boolean;
}

export interface ReponsePanel extends AnalysePanel {
  readonly nbRecherches: number;
  readonly coutUsd: number;
}

export async function poserQuestion(
  question: QuestionPanel,
  porteur: JobPorteur,
  deps: DepsPanel,
): Promise<ReponsePanel> {
  const appeler = deps.appeler ?? appelerMessagesApi;
  const reserver = deps.reserver ?? assertPlafondsClaude;
  const solder = deps.solder ?? solderReservation;
  const model = MODELES.court;

  // 1. Réservation AVANT l'appel : un refus lève, rien n'est envoyé.
  const accord = await reserver(
    {
      jobId: porteur.jobId,
      contentType: porteur.contentType,
      role: "text",
      systemPrompt: SYSTEME,
      userPrompt: question.texte,
      maxTokens: MAX_TOKENS_PANEL,
    } as GenerationRequest,
    "court",
    (deps.maintenant ?? (() => new Date()))(),
    coutMaxAppelUsd(),
  );

  // 2. Appel. Sur erreur la réservation maximale reste (on compte trop, jamais trop peu).
  let rep;
  try {
    rep = await appeler({
      model,
      max_tokens: MAX_TOKENS_PANEL,
      system: SYSTEME,
      messages: [{ role: "user", content: question.texte }],
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
          max_uses: MAX_RECHERCHES_PANEL,
          user_location: { type: "approximate", country: "FR", timezone: "Europe/Paris" },
        },
      ],
    });
  } catch (err) {
    if ((err as { code?: unknown })?.code === "cle_absente") {
      await solder(accord.reservation.id, 0, { input: 0, output: 0 });
    }
    throw err;
  }

  // 3. Solde au coût réel ; usage absent = réservation maximale conservée, rien d'enregistré.
  const u = rep.usage;
  const nbRecherches = u?.server_tool_use?.web_search_requests;
  if (
    !u ||
    typeof u.input_tokens !== "number" ||
    typeof u.output_tokens !== "number" ||
    typeof nbRecherches !== "number"
  ) {
    throw new Error("Usage absent de la réponse : coût non établi, réservation maximale conservée");
  }
  const lecture = u.cache_read_input_tokens ?? 0;
  const ecriture = u.cache_creation_input_tokens ?? 0;
  const coutUsd =
    computeCost(model, u.input_tokens, u.output_tokens, lecture, ecriture) +
    nbRecherches * PRIX_RECHERCHE_USD;
  await solder(accord.reservation.id, coutUsd, {
    input: u.input_tokens + lecture + ecriture,
    output: u.output_tokens,
  });

  const { sources, erreurs } = sourcesDeLaRecherche(rep);
  if (erreurs > 0 && sources.size === 0) throw new Error("Recherche web indisponible");
  return { ...analyserSources([...sources.keys()]), nbRecherches, coutUsd };
}

// ── Tâche `panel-geo` ─────────────────────────────────────────────────────────

export type IssuePanelGeo =
  | {
      readonly tache: "panel-geo";
      readonly issue: "saute";
      readonly motif: string;
      readonly anormal: boolean;
    }
  | {
      readonly tache: "panel-geo";
      readonly issue: "fait";
      readonly posees: number;
      readonly dejaFaites: number;
      readonly arret: string | null;
    };

type PrismaPanel = Pick<PrismaClient, "contentGenConfig" | "geoPanelReponse">;

const enJourParis = (d: Date): string =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris" }).format(d);

function saute(motif: string, anormal = false): IssuePanelGeo {
  return { tache: "panel-geo", issue: "saute", motif, anormal };
}

export async function tachePanelGeo(
  deps: DepsPanel & { readonly prisma: PrismaPanel },
): Promise<IssuePanelGeo> {
  const { prisma } = deps;
  const maintenant = (deps.maintenant ?? (() => new Date()))();

  const reglage = await prisma.contentGenConfig.findUnique({ where: { key: CLE_CONFIG_PANEL } });
  const v = reglage?.value as { actif?: unknown } | null | undefined;
  if (!v || typeof v !== "object" || v.actif !== true) return saute("panel_eteint");

  const liste = listeValidee(
    (await prisma.contentGenConfig.findUnique({ where: { key: CLE_CONFIG_QUESTIONS } }))?.value,
  );
  if (!liste) return saute("liste_non_validee");

  const jour = enJourParis(maintenant);
  const du_jour = questionsDuJour(liste.questions, jour);
  if (du_jour.length === 0) return saute("jour_non_ouvre");

  const date = new Date(`${jour}T00:00:00Z`);
  const existantes = await prisma.geoPanelReponse.findMany({
    where: { date, version: liste.version, moteur: MOTEUR_PANEL },
    select: { questionId: true },
  });
  const faites = new Set(existantes.map((e) => e.questionId));
  const restantes = du_jour.filter((q) => !faites.has(q.id));
  if (restantes.length === 0)
    return { tache: "panel-geo", issue: "fait", posees: 0, dejaFaites: faites.size, arret: null };

  if (!(deps.blogClaudeActif ?? interrupteurBlogClaude)()) return saute("claude_eteint");

  let porteur: JobPorteur;
  try {
    porteur = await (deps.creerPorteur ?? creerJobPorteur)({
      origine: "pilotage",
      plafondJobUsd: PLAFOND_PASSE_USD,
    });
  } catch (err) {
    if (err instanceof BlogClaudeRefusError) return saute(`porte_de_cout:${err.code}`, true);
    throw err;
  }

  let posees = 0;
  let arret: string | null = null;
  for (const q of restantes) {
    try {
      const r = await poserQuestion(q, porteur, deps);
      await prisma.geoPanelReponse.create({
        data: {
          date,
          questionId: q.id,
          version: liste.version,
          moteur: MOTEUR_PANEL,
          question: q.texte,
          urlsCitees: [...r.urls],
          domainesCites: [...r.domaines],
          presente: r.presente,
          rang: r.rang,
          nbRecherches: r.nbRecherches,
          coutUsd: r.coutUsd,
        },
      });
      posees += 1;
    } catch (err) {
      // Refus de la porte (plafond, suspension…) ou panne : on s'arrête, jamais de repli.
      arret = err instanceof BlogClaudeRefusError ? `porte_de_cout:${err.code}` : "appel_en_echec";
      break;
    }
  }
  return { tache: "panel-geo", issue: "fait", posees, dejaFaites: faites.size, arret };
}
