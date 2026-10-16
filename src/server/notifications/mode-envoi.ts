// Hub notifications — CHOIX du moment d'envoi selon l'appelant (relecture PR 1553).
//
// Les fonctions `enrichCalendlyEvent` / `discoverNewCalendlyEvents` ont deux
// familles d'appelants : le worker (attendre l'alerte ne gêne personne) et les
// requêtes web (annulation, report, webhook, rafraîchissement, console), où
// `await notify()` fait patienter le visiteur — jusqu'à ~24 s si Telegram pend.
//
// 🔑 Le défaut reste `immediat` (comportement historique, le worker n'a rien à
// changer) — c'est donc la GARDE `tests/unit/notifications/alertes-client-apres-la-reponse.spec.ts`
// qui rend le choix obligatoire : tout appelant de ces fonctions doit écrire
// `notifier:` en toutes lettres, un oubli rougit.
//
// `apres-reponse` est importé À LA DEMANDE : le worker ne charge jamais
// `next/server` (cf. l'en-tête de `./apres-reponse`).

import { notify } from "./index";
import type { NotifyInput } from "./types";

export type ModeEnvoiAlerte = "apres-reponse" | "immediat";

export interface OptionsNotifier {
  /** Défaut `immediat`. Une requête web passe `apres-reponse` (la garde l'exige). */
  readonly notifier?: ModeEnvoiAlerte;
}

/** Envoie l'alerte selon le mode. Ne throw pas en `apres-reponse`. */
export async function notifierSelonMode(
  input: NotifyInput,
  mode: ModeEnvoiAlerte | undefined,
  origine: string,
): Promise<void> {
  if (mode !== "apres-reponse") {
    await notify(input);
    return;
  }
  const { notifyApresReponse } = await import("./apres-reponse");
  notifyApresReponse(input, origine);
}
