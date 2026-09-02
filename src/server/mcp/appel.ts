/**
 * **L'EXÉCUTION D'UN APPEL** — de `tools/call` à la sortie standard.
 *
 * Étapes, dans l'ordre, et chacune peut refuser :
 *   1. l'outil existe                              → sinon `tool_not_found`
 *   2. l'entrée respecte son schéma FERMÉ          → sinon `invalid_input`
 *   3. le contexte est construit ICI (`identite`)  — jamais depuis la charge utile
 *   4. le handler s'exécute                        → sinon `upstream_unavailable`
 *   5. la sortie respecte son schéma               → sinon `internal` (dérive du code)
 *   6. la sortie tient dans la marge de compaction → sinon `result_too_large`
 *
 * ⚠️ L'ADAPTATEUR NE COMPACTE PAS : c'est le socle (§ 13.3), sur ses propres
 *    annotations. Mais il ne laisse pas non plus partir n'importe quoi sur le
 *    fil : au-delà de `MARGE_DE_COMPACTION × maxBytes` — le dernier palier de
 *    la cascade, 300 % —, aucune compaction ne peut plus sauver la réponse, et
 *    la refuser ici avec une indication de filtrage coûte moins qu'un transfert
 *    pour rien.
 *
 * Le journal reçoit une ligne à CHAQUE terminaison, refus compris — avec le
 * code, jamais le contenu (`journal.ts`).
 */

import type { ContexteOutil, OutilQuelconque } from "./contrat";
import { contexteDAppel, type MetaDAppel } from "./identite";
import { consigner, type CodeDeSortie } from "./journal";
import { octetsCanoniques, versValeurJson, type ValeurJson } from "./json-canonique";
import { trouverOutil } from "./registre";

/** Le dernier palier de la cascade de compaction du socle : 300 %. */
export const MARGE_DE_COMPACTION = 3;

export interface AppelReussi {
  readonly ok: true;
  readonly sortie: ValeurJson;
  readonly returned: number;
  readonly octets: number;
}

export interface AppelRefuse {
  readonly ok: false;
  readonly code: Exclude<CodeDeSortie, "ok">;
  /** Ce qu'il faut faire ensuite — jamais une valeur lue, jamais une trace. */
  readonly message: string;
  /** Les champs fautifs, pour `invalid_input` : chemin et attendu. */
  readonly details?: readonly { readonly chemin: string; readonly probleme: string }[];
}

export type ResultatAppel = AppelReussi | AppelRefuse;

function compterItems(sortie: ValeurJson): number {
  if (sortie === null || typeof sortie !== "object" || Array.isArray(sortie)) return 0;
  const items = (sortie as { items?: ValeurJson }).items;
  return Array.isArray(items) ? items.length : 0;
}

async function executerLeHandler(
  outil: OutilQuelconque,
  entree: unknown,
  ctx: ContexteOutil,
): Promise<unknown> {
  return outil.handler(entree as never, ctx);
}

export async function executerAppel(
  nom: string,
  argumentsBruts: unknown,
  metaDAppel: MetaDAppel,
  maintenant = new Date(),
): Promise<ResultatAppel> {
  const ctx = contexteDAppel(metaDAppel, maintenant);
  const depart = Date.now();
  const terminer = (
    code: CodeDeSortie,
    mesure: { returned: number | null; octets: number | null } = { returned: null, octets: null },
  ): void => {
    consigner({
      outil: nom,
      requestId: ctx.requestId,
      principal: ctx.principal,
      code,
      dureeMs: Date.now() - depart,
      returned: mesure.returned,
      octets: mesure.octets,
    });
  };

  const outil = trouverOutil(nom);
  if (outil === null) {
    terminer("tool_not_found");
    return {
      ok: false,
      code: "tool_not_found",
      message: `aucun outil nommé « ${nom} » — la liste servie est celle de tools/list.`,
    };
  }

  const lecture = outil.input.safeParse(argumentsBruts ?? {});
  if (!lecture.success) {
    terminer("invalid_input");
    return {
      ok: false,
      code: "invalid_input",
      message: "l'entrée ne respecte pas le schéma publié de l'outil.",
      details: lecture.error.issues.map((issue) => ({
        chemin: issue.path.length > 0 ? issue.path.map(String).join(".") : "(racine)",
        probleme: issue.message,
      })),
    };
  }

  let brut: unknown;
  try {
    brut = await executerLeHandler(outil, lecture.data, ctx);
  } catch (erreur) {
    // Le message d'une source (Prisma, Google) peut citer une valeur : on ne le
    // fait pas sortir. Le nom de l'erreur suffit à orienter.
    const nomErreur = erreur instanceof Error ? erreur.name : "Error";
    terminer("upstream_unavailable");
    return {
      ok: false,
      code: "upstream_unavailable",
      message: `la source de « ${nom} » n'a pas répondu (${nomErreur}) — réessayer plus tard.`,
    };
  }

  const validation = outil.output.safeParse(brut);
  if (!validation.success) {
    terminer("internal");
    return {
      ok: false,
      code: "internal",
      message:
        `la sortie de « ${nom} » ne respecte plus son propre schéma : ` +
        `${String(validation.error.issues.length)} écart(s). Requête ${ctx.requestId}.`,
    };
  }

  const sortie = versValeurJson(validation.data, `sortie de ${nom}`);
  const octets = octetsCanoniques(sortie);
  const returned = compterItems(sortie);
  if (octets > outil.maxBytes * MARGE_DE_COMPACTION) {
    terminer("result_too_large", { returned, octets });
    return {
      ok: false,
      code: "result_too_large",
      message:
        `${String(octets)} octets pour un plafond de ${String(outil.maxBytes)} : ` +
        "au-delà de ce que la compaction peut rattraper. Réduire « limite » ou filtrer.",
    };
  }

  terminer("ok", { returned, octets });
  return { ok: true, sortie, returned, octets };
}
