/**
 * LE SEUL POINT DE CONTACT du circuit visio avec OpenAI (ADR 0055 ; garde
 * `tests/unit/ci/le-circuit-visio-ne-parle-qu-a-openai-par-un-seul-module.spec.ts`).
 *
 * C'est le seul fichier du circuit qui importe le SDK `openai`. Tout le reste
 * parle à l'interface étroite `ClientOpenAIVisio` ci-dessous — que les tests
 * remplacent par un faux client, et qui garantit par construction :
 *
 *   · `store: false` sur CHAQUE appel à l'API Responses (aucun état conservé
 *     chez OpenAI ; la transcription, elle, n'est jamais conservée) ;
 *   · aucun outil, jamais de `temperature` ;
 *   · `maxRetries: 0` : les reprises sont celles des ÉTAPES du circuit
 *     (`etapes.ts`), comptées en base — pas des reprises cachées du SDK qui
 *     paieraient deux fois sans laisser de trace ;
 *   · le `fetch` NATIF de Node (comme `content-gen/providers/openai.ts` : le
 *     client HTTP par défaut du SDK coupe les réponses longues).
 *
 * Paresseux : aucun client n'est construit à l'import (build `stub.invalid`,
 * SSG). La clé `OPENAI_API_KEY` est lue au premier appel, jamais journalisée.
 *
 * ⚠️ On n'utilise pas `responses.parse` : il lève sur un JSON tronqué AVANT
 * qu'on ait pu lire `status` et `incomplete_details`, et une sortie coupée
 * deviendrait une erreur réseau. On appelle `responses.create` avec le même
 * `text.format` (JSON Schema strict généré par `zodTextFormat`), et
 * `passe.ts` revalide la sortie par Zod.
 */

import OpenAI, { toFile } from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { ZodType } from "zod";

import { ProviderError } from "@/server/content-gen/providers/IProvider";

/** Une demande de transcription d'une tranche (fichier WebM autonome). */
export interface DemandeTranscription {
  readonly octets: Buffer;
  readonly modele: string;
  readonly langue: string;
}

/** Le format de sortie imposé (JSON Schema strict), produit par `formatDeSortie`. */
export interface FormatSortie {
  readonly type: "json_schema";
  readonly name: string;
  readonly strict: true;
  readonly schema: Record<string, unknown>;
}

/** Une demande à l'API Responses. */
export interface DemandeReponse {
  readonly modele: string;
  /** Bloc commun + consigne de la passe : identique d'un appel à l'autre (cache). */
  readonly instructions: string;
  /** Les données variables. Jamais journalisées. */
  readonly entree: string;
  readonly format: FormatSortie;
  readonly effort: "low" | "medium" | "high";
  readonly maxSortie: number;
}

/** La réponse de l'API Responses, réduite à ce que le circuit lit. */
export interface ReponseBrute {
  readonly statut: string;
  readonly raisonIncomplete: string | null;
  readonly modele: string;
  readonly texte: string | null;
  readonly refus: string | null;
  readonly jetonsEntree: number;
  readonly jetonsEntreeEnCache: number;
  readonly jetonsSortie: number;
}

/** L'interface étroite : tout le circuit passe par elle. */
export interface ClientOpenAIVisio {
  /** Rend la réponse BRUTE (revalidée par Zod dans `transcrire-tranche.ts`). */
  readonly transcrire: (demande: DemandeTranscription) => Promise<unknown>;
  readonly repondre: (demande: DemandeReponse) => Promise<ReponseBrute>;
}

/** Le JSON Schema strict envoyé à l'API, produit depuis un schéma Zod. */
export function formatDeSortie(schema: ZodType, nom: string): FormatSortie {
  const f = zodTextFormat(schema, nom) as unknown as {
    type: "json_schema";
    name: string;
    schema: Record<string, unknown>;
  };
  return { type: "json_schema", name: f.name, strict: true, schema: f.schema };
}

/** Les paramètres EXACTS d'un appel Responses : un seul endroit, `store: false` compris. */
export function parametresResponses(demande: DemandeReponse) {
  return {
    model: demande.modele,
    instructions: demande.instructions,
    input: demande.entree,
    text: { format: demande.format },
    reasoning: { effort: demande.effort },
    max_output_tokens: demande.maxSortie,
    store: false as const,
  };
}

function lireReponse(r: OpenAI.Responses.Response): ReponseBrute {
  let refus: string | null = null;
  for (const item of r.output ?? []) {
    if (item.type !== "message") continue;
    for (const c of item.content ?? []) {
      if (c.type === "refusal") refus = c.refusal;
    }
  }
  return {
    statut: r.status ?? "inconnu",
    raisonIncomplete: r.incomplete_details?.reason ?? null,
    modele: r.model,
    texte: r.output_text ?? null,
    refus,
    jetonsEntree: r.usage?.input_tokens ?? 0,
    jetonsEntreeEnCache: r.usage?.input_tokens_details?.cached_tokens ?? 0,
    jetonsSortie: r.usage?.output_tokens ?? 0,
  };
}

let instance: ClientOpenAIVisio | null = null;

/** Le client réel, construit au premier appel. */
export function obtenirClientOpenAI(): ClientOpenAIVisio {
  if (instance) return instance;
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) {
    // Classée `configuration` par `erreurs.ts` : l'étape est suspendue et une
    // alerte technique part. Jamais une reprise en boucle.
    throw new ProviderError("OPENAI_API_KEY absente", "auth_failed", "openai", false);
  }
  const sdk = new OpenAI({ apiKey, timeout: 120_000, maxRetries: 0, fetch: globalThis.fetch });
  instance = {
    transcrire: async (d) => {
      const fichier = await toFile(d.octets, "tranche.webm", { type: "audio/webm" });
      // ⚠️ LE SEUL TRANSTYPAGE DU CIRCUIT : le SDK 4.104 ne connaît pas encore
      // `diarized_json` ni `chunking_strategy` pour ce modèle (on ne monte pas
      // en version majeure : risque sur content-gen et le chatbot). La réponse
      // est revalidée par Zod (`ReponseDiarizee`).
      const params = {
        file: fichier,
        model: d.modele,
        language: d.langue,
        response_format: "diarized_json",
        chunking_strategy: "auto",
      } as unknown as OpenAI.Audio.TranscriptionCreateParamsNonStreaming;
      return sdk.audio.transcriptions.create(params);
    },
    repondre: async (d) => {
      const r = await sdk.responses.create(
        parametresResponses(d) as unknown as OpenAI.Responses.ResponseCreateParamsNonStreaming,
      );
      return lireReponse(r);
    },
  };
  return instance;
}

/** Tests : oublie le client construit. */
export function oublierClientOpenAI(): void {
  instance = null;
}
