/**
 * Ouverture du circuit visio : `ouvert` n'enregistre de vrais clients que si le
 * site l'ANNONCE (chantier visio, PR 8 ; V-15 ; LOTS-EXECUTION §0, ligne
 * « Préavis », décision de Will du 29/09).
 *
 * ## La règle
 *
 * Le mode demandé (`ferme | pilote | ouvert`) se lit à l'exécution dans les
 * variables `ENREGISTREMENT_VISIO_PILOTE` et `ENREGISTREMENT_VISIO_OUVERT`
 * (module `drapeau.ts` de la PR 5). Ce module-ci décide seulement de ce que
 * vaut `ouvert` : il n'est EFFECTIF que si la notice publique annonce
 * l'enregistrement (`ANNONCE_VISIO_ACTIVE`, `src/server/visio/visio-annonce.ts`).
 * Sinon `ouvert` vaut `pilote` (seule une rencontre du client fictif est
 * enregistrable) et une alerte « notice non publiée » est levée.
 *
 * Pourquoi : V-15 exige de dire ce que fait le circuit AVANT le premier
 * enregistrement réel. Tant que l'interrupteur de la notice n'a pas basculé
 * — il attend le texte relu par Will, le DPA d'OpenAI signé et le partage
 * pour l'entraînement désactivé —, le site promet « ni enregistrés ni
 * transcrits ». Une variable `ENREGISTREMENT_VISIO_OUVERT=true` posée dans
 * Coolify ne doit pas suffire à rompre cette promesse.
 *
 * ## Le préavis n'est PAS ici
 *
 * Décision de Will du 29/09 (« 1 ») : l'ouverture n'attend plus la fin du
 * préavis de 30 jours. Le préavis protège les seuls CLIENTS ACTIFS : leurs
 * rencontres sont refusées à l'enregistrement, route par route, tant que le
 * préavis court (`clientsActifsPourPreavis`, PR 5). Ce module ne porte donc
 * AUCUNE date : une seconde règle de préavis, ici, bloquerait l'ouverture
 * décidée par Will. La date d'effet se calcule d'un seul endroit,
 * `dateEffetPreavis` (`src/lib/email/templates/preavis-sous-traitants.tsx`).
 *
 * Garde : `__tests__/le-drapeau-ouvert-attend-la-notice-publique.spec.ts`
 * (règle, et `drapeau.ts` qui doit passer par `modeEffectif`).
 *
 * Module PUR : aucun import d'exécution (lu par le site, le worker et la CI).
 */

import { ANNONCE_VISIO_ACTIVE } from "./visio-annonce";

export type ModeCircuitVisio = "ferme" | "pilote" | "ouvert";

export interface ModeEffectif {
  readonly mode: ModeCircuitVisio;
  /** Alerte à lever (`AlerteVisio`), ou `null`. */
  readonly alerte: "notice_non_publiee" | null;
  /** Pourquoi `mode` diffère de la demande, en français pour Will, ou `null`. */
  readonly motif: string | null;
}

export const MOTIF_NOTICE_NON_PUBLIEE =
  "La politique de confidentialité n'annonce pas encore l'enregistrement : il reste limité au rendez-vous de test.";

/**
 * Ce que vaut réellement le mode demandé.
 *
 * - `ferme` et `pilote` passent tels quels (le pilote n'enregistre que le
 *   client fictif : il ne touche aucun client et n'attend pas la notice) ;
 * - `ouvert` n'est effectif que si la notice publique annonce
 *   l'enregistrement ; sinon `pilote` + alerte.
 */
export function modeEffectif(
  demande: ModeCircuitVisio,
  annonceActive: boolean = ANNONCE_VISIO_ACTIVE,
): ModeEffectif {
  if (demande !== "ouvert") return { mode: demande, alerte: null, motif: null };
  if (!annonceActive) {
    return { mode: "pilote", alerte: "notice_non_publiee", motif: MOTIF_NOTICE_NON_PUBLIEE };
  }
  return { mode: "ouvert", alerte: null, motif: null };
}
