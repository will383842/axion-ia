/**
 * Doublure des deux actions de capture VSL — POUR LES TESTS SEULEMENT.
 *
 * Elle respecte le contrat de `lead-vsl-contrat.ts` (celui que le développeur
 * « back » implémente dans `lead-vsl-actions.ts`). Aucun fichier de production
 * ne l'importe : elle vit sous `__tests__/` et n'est PAS exportée par un module
 * applicatif. Quand la PR capture sera fusionnée, les tests de l'île pourront
 * garder cette doublure (ils testent l'île, pas le serveur).
 */
import type {
  CapturerLeadVslInput,
  CapturerLeadVslResultat,
  CompleterLeadVslInput,
  CompleterLeadVslResultat,
} from "../lead-vsl-contrat";

export interface SortiesVslStub {
  capturer?: CapturerLeadVslResultat | (() => Promise<CapturerLeadVslResultat>);
  completer?: CompleterLeadVslResultat | (() => Promise<CompleterLeadVslResultat>);
}

export function creerActionsVslStub(sorties: SortiesVslStub = {}) {
  const appelsCapturer: CapturerLeadVslInput[] = [];
  const appelsCompleter: CompleterLeadVslInput[] = [];

  const capturer = async (input: CapturerLeadVslInput): Promise<CapturerLeadVslResultat> => {
    appelsCapturer.push(input);
    const s = sorties.capturer;
    if (typeof s === "function") return s();
    return s ?? { ok: true, jeton: "jeton-de-test", leadId: "lead-de-test" };
  };

  const completer = async (input: CompleterLeadVslInput): Promise<CompleterLeadVslResultat> => {
    appelsCompleter.push(input);
    const s = sorties.completer;
    if (typeof s === "function") return s();
    return s ?? { ok: true, merciUrl: "/apporteur-affaires/video/merci?utm_source=facebook" };
  };

  return { capturer, completer, appelsCapturer, appelsCompleter };
}
