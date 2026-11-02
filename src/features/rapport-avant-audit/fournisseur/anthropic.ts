/**
 * Fournisseur d'IA Anthropic du rapport avant audit (2026-11-02).
 *
 * Branche l'API Messages sur l'interface `FournisseurIA` de `executer.ts`. Le `fetch` est
 * injectable : les tests n'appellent jamais le réseau. Aucune clé n'est lue ni stockée ici —
 * l'appelant les fournit (1 → 2 → 3).
 *
 * Rotation : crédits épuisés, 401/403 → la clé est écartée pour la suite ; 429 persistant → on
 * passe à la clé suivante (sans l'écarter). Toutes épuisées → `ErreurClesEpuisees`.
 * Les 5xx et les erreurs réseau/délai (600 s) sont réessayés 2 fois sur la même clé : ils ne
 * font JAMAIS basculer de clé. Le modèle est contrôlé AVANT tout appel réseau.
 *
 * Durée de vie : l'ensemble des clés écartées vit le temps du fournisseur ; créer un
 * fournisseur par rapport.
 *
 * Les réponses web sont des DONNÉES : on ne renvoie que le texte, jamais d'instruction exécutée.
 */

import { z } from "zod";

import type { AppelIA, FournisseurIA, ReponseIA } from "../executer";
import { exigerModeleAutorise } from "../modeles";

const URL_API = "https://api.anthropic.com/v1/messages";
const VERSION_API = "2023-06-01";
const MAX_TOKENS = 16_000;
export const PLAFOND_RECHERCHES = 8;
const REESSAIS_5XX = 2;
const REESSAIS_429 = 2;
const RELANCES_PAUSE = 2;
const DELAI_MS = 600_000;
const ATTENTE_429_MAX_MS = 30_000;

export class ErreurClesEpuisees extends Error {
  constructor(detail: string) {
    super(
      `Toutes les clés Anthropic fournies sont inutilisables (crédits épuisés, clé refusée ou ` +
        `limite de débit persistante). ${detail}`.trim(),
    );
    this.name = "ErreurClesEpuisees";
  }
}

export class ErreurAnthropic extends Error {
  constructor(
    readonly statut: number,
    message: string,
  ) {
    super(`Anthropic ${statut} : ${message}`);
    this.name = "ErreurAnthropic";
  }
}

export interface OptionsFournisseurAnthropic {
  readonly cles: ReadonlyArray<string>;
  readonly fetchImpl?: typeof fetch;
  /** Pause entre deux réessais (ms). 0 dans les tests. */
  readonly attenteMs?: number;
}

const CorpsReponse = z.object({
  content: z.array(
    z
      .object({
        type: z.string().optional(),
        text: z.string().optional(),
        name: z.string().optional(),
      })
      .passthrough(),
  ),
  stop_reason: z.string().nullish(),
  usage: z
    .object({
      input_tokens: z.number().optional(),
      output_tokens: z.number().optional(),
      server_tool_use: z.object({ web_search_requests: z.number().optional() }).nullish(),
    })
    .nullish(),
});
type CorpsReponse = z.infer<typeof CorpsReponse>;

type Verdict = "ecarter" | "reessayer-5xx" | "reessayer-429" | "fatal";

function classer(statut: number, corps: string): Verdict {
  if (statut === 401 || statut === 403 || statut === 402) return "ecarter";
  if (statut === 400 && /credit balance|billing/i.test(corps)) return "ecarter";
  if (statut === 429) return "reessayer-429";
  if (statut >= 500) return "reessayer-5xx";
  return "fatal";
}

const pause = (ms: number) => (ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve());

/** Attente avant un réessai 429 : `retry-after` (secondes) plafonné à 30 s, sinon le défaut. */
function attente429(res: Response, defautMs: number): number {
  const brut = res.headers.get("retry-after");
  if (brut !== null) {
    const s = Number(brut);
    if (Number.isFinite(s) && s >= 0) return Math.min(s * 1000, ATTENTE_429_MAX_MS);
  }
  return defautMs;
}

const messageDe = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 200);

export function creerFournisseurAnthropic(options: OptionsFournisseurAnthropic): FournisseurIA {
  const cles = options.cles.map((c) => c.trim()).filter((c) => c.length > 0);
  const appelFetch = options.fetchImpl ?? fetch;
  const attente = options.attenteMs ?? 500;
  const ecartees = new Set<number>();

  return async (appel: AppelIA): Promise<ReponseIA> => {
    // Avant TOUT appel réseau : la liste blanche refuse Haiku et tout modèle inconnu.
    exigerModeleAutorise(appel.modele);
    if (cles.length === 0) throw new ErreurClesEpuisees("Aucune clé n'a été fournie.");

    const base: Record<string, unknown> = {
      model: appel.modele,
      max_tokens: MAX_TOKENS,
      system: appel.system,
    };
    if (appel.recherche) {
      base.tools = [
        { type: "web_search_20250305", name: "web_search", max_uses: PLAFOND_RECHERCHES },
      ];
    }
    const motifs: string[] = [];

    for (let i = 0; i < cles.length; i += 1) {
      if (ecartees.has(i)) continue;
      let essais5xx = 0;
      let essais429 = 0;
      let relances = 0;
      const messages: unknown[] = [{ role: "user", content: appel.user }];
      let texte = "";
      let jetonsEntree = 0;
      let jetonsSortie = 0;
      let nbRecherches = 0;

      for (;;) {
        let res: Response;
        try {
          res = await appelFetch(URL_API, {
            method: "POST",
            headers: {
              "x-api-key": cles[i]!,
              "anthropic-version": VERSION_API,
              "content-type": "application/json",
            },
            body: JSON.stringify({ ...base, messages }),
            signal: AbortSignal.timeout(DELAI_MS),
          });
        } catch (e) {
          // Erreur réseau ou délai dépassé : traitée comme un 5xx réessayable.
          if (essais5xx < REESSAIS_5XX) {
            essais5xx += 1;
            await pause(attente * essais5xx);
            continue;
          }
          throw new ErreurAnthropic(0, `erreur réseau ou délai dépassé (${messageDe(e)})`);
        }

        if (res.ok) {
          let lu: CorpsReponse;
          try {
            lu = CorpsReponse.parse(await res.json());
          } catch {
            throw new ErreurAnthropic(200, "réponse illisible");
          }
          const r = lireReponse(lu);
          texte += r.texte;
          jetonsEntree += r.jetonsEntree;
          jetonsSortie += r.jetonsSortie;
          nbRecherches += r.nbRecherches;
          const arret = lu.stop_reason ?? null;
          if (arret === "pause_turn") {
            if (relances >= RELANCES_PAUSE) {
              throw new ErreurAnthropic(200, "pause_turn persistant après 2 relances");
            }
            relances += 1;
            messages.push({ role: "assistant", content: lu.content });
            continue;
          }
          if (arret === "max_tokens") {
            throw new ErreurAnthropic(200, "réponse tronquée (max_tokens atteint)");
          }
          if (arret === "refusal") throw new ErreurAnthropic(200, "réponse refusée par le modèle");
          return { texte, jetonsEntree, jetonsSortie, nbRecherches };
        }

        const corpsErreur = (await res.text().catch(() => "")).slice(0, 300);
        const verdict = classer(res.status, corpsErreur);

        if (verdict === "ecarter") {
          ecartees.add(i);
          motifs.push(`clé ${i + 1} : ${res.status}`);
          break;
        }
        if (verdict === "reessayer-429") {
          if (essais429 < REESSAIS_429) {
            essais429 += 1;
            await pause(attente429(res, attente * essais429));
            continue;
          }
          motifs.push(`clé ${i + 1} : limite de débit persistante`);
          break;
        }
        if (verdict === "reessayer-5xx") {
          if (essais5xx < REESSAIS_5XX) {
            essais5xx += 1;
            await pause(attente * essais5xx);
            continue;
          }
          throw new ErreurAnthropic(res.status, corpsErreur);
        }
        throw new ErreurAnthropic(res.status, corpsErreur);
      }
    }
    throw new ErreurClesEpuisees(motifs.length > 0 ? `Détail : ${motifs.join(" ; ")}.` : "");
  };
}

function lireReponse(r: CorpsReponse): ReponseIA {
  const blocs = r.content;
  const texte = blocs
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text as string)
    .join("");
  const parBlocs = blocs.filter(
    (b) => b.type === "server_tool_use" && b.name === "web_search",
  ).length;
  const parUsage = r.usage?.server_tool_use?.web_search_requests;
  return {
    texte,
    jetonsEntree: r.usage?.input_tokens ?? 0,
    jetonsSortie: r.usage?.output_tokens ?? 0,
    nbRecherches: typeof parUsage === "number" ? parUsage : parBlocs,
  };
}
