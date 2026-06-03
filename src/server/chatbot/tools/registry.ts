// Registre des tools chatbot (T-12, ADR-CB-09/CB-10).
//
// Chaque tool = { name, description, schema Zod, handler }. Le registre :
//   - valide l'input LLM via Zod (refus déterministe des payloads invalides) ;
//   - INJECTE `tenant_id` côté serveur (jamais depuis le payload LLM) ;
//   - dispatch vers le handler typé.
// Évolutivité (ADR-CB-10) : ajouter un tool = 1 register(), zéro autre changement.
//
// MVP : seul `rechercher_offres` (T-35) est câblé. Les 5 autres tools
// (qualifier_prospect, capturer_lead, proposer_rdv, chercher_ressource,
// escalader_question — MVP2/3, DB/Calendly/email) s'enregistreront ici.

import type { z } from "zod";
import {
  RechercherOffresInputSchema,
  rechercherOffres,
  type ToolContext,
} from "@/server/chatbot/tools/rechercher-offres";

export type { ToolContext };

/** Définition d'un tool. `I` = type de l'input validé. */
export interface ToolDefinition<I = unknown> {
  readonly name: string;
  readonly description: string;
  /** Schéma Zod de l'input fourni par le LLM (sans `tenant_id` — injecté serveur). */
  readonly schema: z.ZodType<I>;
  /** Handler exécuté avec l'input validé + le contexte serveur (tenant injecté). */
  readonly handler: (input: I, ctx: ToolContext) => Promise<unknown>;
}

export class ToolValidationError extends Error {
  constructor(
    public readonly toolName: string,
    public readonly issues: unknown,
  ) {
    super(`[chatbot:tool] payload invalide pour "${toolName}"`);
    this.name = "ToolValidationError";
  }
}

export class UnknownToolError extends Error {
  constructor(public readonly toolName: string) {
    super(`[chatbot:tool] tool inconnu : "${toolName}"`);
    this.name = "UnknownToolError";
  }
}

export class ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition<unknown>>();

  register<I>(def: ToolDefinition<I>): void {
    if (this.tools.has(def.name)) {
      throw new Error(`[chatbot:tool] tool déjà enregistré : "${def.name}"`);
    }
    this.tools.set(def.name, def as ToolDefinition<unknown>);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  get(name: string): ToolDefinition<unknown> | undefined {
    return this.tools.get(name);
  }

  /** Liste des noms de tools enregistrés. */
  names(): string[] {
    return [...this.tools.keys()];
  }

  /** Définitions (pour exposer les schémas au LLM via l'orchestrateur). */
  list(): ReadonlyArray<ToolDefinition<unknown>> {
    return [...this.tools.values()];
  }

  /**
   * Valide l'input (Zod), injecte le contexte serveur (tenant_id), dispatche.
   * Throw `UnknownToolError` / `ToolValidationError` (refus déterministe).
   */
  async dispatch(name: string, rawInput: unknown, ctx: ToolContext): Promise<unknown> {
    const def = this.tools.get(name);
    if (!def) throw new UnknownToolError(name);
    const parsed = def.schema.safeParse(rawInput);
    if (!parsed.success) throw new ToolValidationError(name, parsed.error.issues);
    return def.handler(parsed.data, ctx);
  }
}

// ── Registre par défaut (tools du MVP) ─────────────────────────────────────

export const chatbotTools = new ToolRegistry();

chatbotTools.register<typeof RechercherOffresInputSchema._type>({
  name: "rechercher_offres",
  description:
    "Recherche déterministe dans le catalogue d'offres Axion-IA par facettes " +
    "(prix, durée, effectif, sujet/outil, format, audience, tri). Retourne des " +
    "offres avec prix exact (SSOT) et lien FR. Utiliser pour toute demande de " +
    "prestation par critères (« formations entre X et Y € », « le moins cher », etc.).",
  schema: RechercherOffresInputSchema,
  handler: (input, ctx) => rechercherOffres(input, ctx),
});
