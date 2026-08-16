/**
 * L'adresse interne d'Axion-IA — UN seul endroit.
 *
 * ## Le défaut fermé ici
 *
 * Relevé par l'inventaire des envois du 16/08 (Lot 13,
 * `_AUDIT/LOT13-CARTOGRAPHIE-ENVOIS-2026-08-16.md`, §8.3) : le repli en dur sur
 * une **adresse Gmail personnelle** existait à deux endroits, recopié à la
 * main, et un troisième repliait sur une valeur différente.
 *
 * | Endroit | Repli avant | Ce qu'il envoie |
 * |---|---|---|
 * | `notifications-service.ts` | `williamsjullin@gmail.com` | toutes les alertes système |
 * | `commercial-application/actions.ts` | `williamsjullin@gmail.com` | 🔴 le **CV complet** d'un candidat |
 * | `content-weekly-report-worker.ts` | `contact@axion-ia.com` | le rapport hebdomadaire |
 *
 * 🔴 Le deuxième est le plus grave : une candidature complète — identité,
 * parcours, pièces — atterrissait dans une boîte personnelle, hors du domaine
 * de l'organisme. Ce n'est pas une question de confort de lecture, c'est le
 * traitement de données de candidats hors du canal déclaré.
 *
 * Trois valeurs pour une même question (« à qui écrit-on en interne ? »)
 * finissent toujours par diverger : c'est déjà arrivé, la troisième était juste
 * et les deux autres fausses. **Décision de Will le 16/08 : `contact@axion-ia.com`.**
 *
 * ## Pourquoi un repli, et pas un échec bruyant
 *
 * Le plan de charge (T3b) proposait de supprimer tout repli pour que l'envoi
 * échoue bruyamment sans destinataire configuré. C'est le bon réflexe quand le
 * repli est *faux* — une boîte personnelle que personne ne surveille au nom de
 * l'organisme. Il ne l'est plus : `contact@axion-ia.com` est l'adresse de
 * l'organisme, relevée, et c'est exactement là que ces messages doivent aller.
 *
 * Un repli JUSTE vaut mieux qu'un échec : une alerte système perdue parce
 * qu'une variable d'environnement manque est une alerte qui ne garde rien.
 *
 * Aucun import : pure lecture d'environnement, utilisable partout.
 */

/**
 * Adresse de l'organisme, dernier recours quand aucune variable n'est posée.
 *
 * ⚠️ Ne JAMAIS y remettre une adresse personnelle. Ce qui part ici comprend des
 * données de candidats et des alertes de conformité : cela doit rester dans le
 * domaine de l'organisme, sur une boîte qui survit au départ d'une personne.
 */
export const ADRESSE_INTERNE_PAR_DEFAUT = "contact@axion-ia.com";

/** Première valeur non vide d'une liste de variables d'environnement. */
function premiereRenseignee(...valeurs: ReadonlyArray<string | undefined>): string | null {
  for (const v of valeurs) {
    const t = v?.trim();
    if (t != null && t !== "") return t;
  }
  return null;
}

/**
 * Destinataire des **alertes système** (conformité, échéances, incidents).
 *
 * Ordre : `QUALIOPI_ALERTE_EMAIL` (le plus spécifique) → `WEEKLY_REPORT_EMAIL`
 * (le canal interne historique) → l'adresse de l'organisme.
 */
export function destinataireAlertesInternes(): string {
  return (
    premiereRenseignee(process.env["QUALIOPI_ALERTE_EMAIL"], process.env["WEEKLY_REPORT_EMAIL"]) ??
    ADRESSE_INTERNE_PAR_DEFAUT
  );
}

/**
 * Destinataire des **candidatures commerciales**.
 *
 * 🔴 Sa propre variable passe en premier, et c'est délibéré : une candidature
 * n'a pas à suivre le canal des alertes de conformité. Les deux publics
 * internes peuvent différer, et le jour où ils diffèrent, la chaîne de replis
 * doit le permettre sans qu'on retouche le code.
 */
export function destinataireCandidatures(): string {
  return (
    premiereRenseignee(
      process.env["COMMERCIAL_APPLICATIONS_EMAIL"],
      process.env["QUALIOPI_ALERTE_EMAIL"],
      process.env["WEEKLY_REPORT_EMAIL"],
    ) ?? ADRESSE_INTERNE_PAR_DEFAUT
  );
}

/** Destinataire du **rapport hebdomadaire** de génération de contenu. */
export function destinataireRapportHebdo(): string {
  return premiereRenseignee(process.env["WEEKLY_REPORT_EMAIL"]) ?? ADRESSE_INTERNE_PAR_DEFAUT;
}
