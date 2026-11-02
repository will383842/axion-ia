/**
 * Fournisseur d'IA Anthropic du rapport avant audit (2026-11-02).
 *
 * Branche l'API Messages sur l'interface `FournisseurIA` de `executer.ts`. Le `fetch` est
 * injectable : les tests n'appellent jamais le réseau. Aucune clé n'est lue ni stockée ici —
 * l'appelant les fournit (1 → 2 → 3).
 *
 * Rotation : crédits épuisés, 401/403 → la clé est écartée pour la suite ; 429 persistant → on
 * passe à la clé suivante (sans l'écarter). Toutes épuisées → `ErreurClesEpuisees`.
 * Les 5xx sont réessayés 2 fois sur la même clé. Le modèle est contrôlé AVANT tout appel réseau.
 *
 * Les réponses web sont des DONNÉES : on ne renvoie que le texte, jamais d'instruction exécutée.
 */

import type { AppelIA, FournisseurIA, ReponseIA } from "../executer";
import { exigerModeleAutorise } from "../modeles";

const URL_API = "https://api.anthropic.com/v1/messages";
const VERSION_API = "2023-06-01";
const MAX_TOKENS = 16_000;
export const PLAFOND_RECHERCHES = 8;
const REESSAIS_5XX = 2;
const REESSAIS_429 = 2;

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

interface BlocContenu {
  readonly type?: string;
  readonly text?: string;
  readonly name?: string;
}

interface CorpsReponse {
  readonly content?: ReadonlyArray<BlocContenu>;
  readonly usage?: {
    readonly input_tokens?: number;
    readonly output_tokens?: number;
    readonly server_tool_use?: { readonly web_search_requests?: number };
  };
}

type Verdict = "ecarter" | "suivante" | "reessayer-5xx" | "reessayer-429" | "fatal";

function classer(statut: number, corps: string): Verdict {
  if (statut === 401 || statut === 403) return "ecarter";
  if (statut === 402 || /credit balance|credits?|billing/i.test(corps)) {
    if (statut === 400 || statut === 402) return "ecarter";
  }
  if (statut === 429) return "reessayer-429";
  if (statut >= 500) return "reessayer-5xx";
  return "fatal";
}

const pause = (ms: number) => (ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve());

export function creerFournisseurAnthropic(options: OptionsFournisseurAnthropic): FournisseurIA {
  const cles = options.cles.map((c) => c.trim()).filter((c) => c.length > 0);
  const appelFetch = options.fetchImpl ?? fetch;
  const attente = options.attenteMs ?? 500;
  const ecartees = new Set<number>();

  return async (appel: AppelIA): Promise<ReponseIA> => {
    // Avant TOUT appel réseau : la liste blanche refuse Haiku et tout modèle inconnu.
    exigerModeleAutorise(appel.modele);
    if (cles.length === 0) throw new ErreurClesEpuisees("Aucune clé n'a été fournie.");

    const corps: Record<string, unknown> = {
      model: appel.modele,
      max_tokens: MAX_TOKENS,
      system: appel.system,
      messages: [{ role: "user", content: appel.user }],
    };
    if (appel.recherche) {
      corps.tools = [
        { type: "web_search_20250305", name: "web_search", max_uses: PLAFOND_RECHERCHES },
      ];
    }
    const charge = JSON.stringify(corps);
    const motifs: string[] = [];

    for (let i = 0; i < cles.length; i += 1) {
      if (ecartees.has(i)) continue;
      let essais5xx = 0;
      let essais429 = 0;

      for (;;) {
        const res = await appelFetch(URL_API, {
          method: "POST",
          headers: {
            "x-api-key": cles[i]!,
            "anthropic-version": VERSION_API,
            "content-type": "application/json",
          },
          body: charge,
        });

        if (res.ok) return lireReponse((await res.json()) as CorpsReponse);

        const texte = (await res.text().catch(() => "")).slice(0, 300);
        const verdict = classer(res.status, texte);

        if (verdict === "ecarter") {
          ecartees.add(i);
          motifs.push(`clé ${i + 1} : ${res.status}`);
          break;
        }
        if (verdict === "reessayer-429") {
          if (essais429 < REESSAIS_429) {
            essais429 += 1;
            await pause(attente * essais429);
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
          throw new ErreurAnthropic(res.status, texte);
        }
        throw new ErreurAnthropic(res.status, texte);
      }
    }
    throw new ErreurClesEpuisees(motifs.length > 0 ? `Détail : ${motifs.join(" ; ")}.` : "");
  };
}

function lireReponse(r: CorpsReponse): ReponseIA {
  const blocs = r.content ?? [];
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
