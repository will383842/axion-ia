/**
 * Interrupteurs publics de l'enregistrement des visios — SOURCE UNIQUE
 * (chantier visio ; LOTS-EXECUTION, correction anti-doublon D2 ; PR 4, 5, 8).
 *
 * ## Ce que ce module décide, et lui seul
 *
 *   · `ETAT_COMPTES_RENDUS_VISIO` / `ANNONCE_VISIO_ACTIVE` — le site annonce-t-il
 *     l'enregistrement ? Tous les textes publics (`src/content/visio-annonce-textes.ts`)
 *     et la règle d'ouverture (`ouverture.ts`) en dérivent ;
 *   · `ENREGISTREMENT_ANNONCE_AUX_CLIENTS` — la phrase d'enregistrement de la
 *     création de rencontre (PR 4) : DÉRIVÉE, jamais réglée à la main ;
 *   · `DICTEE_ANNONCEE` — la dictée après un appel (B5, B14) : DÉRIVÉE ;
 *   · `DISCUTONS_MEET_SEUL` — « Discutons de votre projet IA » en Meet seul (B5) ;
 *   · `PREAVIS_SOUS_TRAITANTS` et `refusPourPreavis` — la règle du préavis par
 *     client actif (décision de Will du 29/09, LOTS-EXECUTION §0, ligne « Préavis »).
 *
 * Toute autre déclaration de ces noms sous `src/` rougit
 * (`__tests__/les-interrupteurs-publics-ont-une-seule-source.spec.ts`). Les PR 4
 * et 5 importent d'ICI : au rebase, leurs constantes locales disparaissent.
 *
 * ## Le préavis ne retarde plus l'ouverture
 *
 * Décision de Will du 29/09 (« 1 ») : `ouvert` n'attend pas la fin du préavis.
 * Le préavis protège les seuls CLIENTS ACTIFS (règle B3,
 * `clientsActifsPourPreavis`) : tant que `PREAVIS_SOUS_TRAITANTS` vaut `null`
 * (préavis pas encore envoyé) ou que sa fin n'est pas atteinte, une rencontre
 * dont le client VALIDÉ est actif est refusée à l'enregistrement et à la dictée
 * (409 `client_actif_preavis_en_cours`, routes de la PR 5). Un prospect « à
 * classer » n'est pas concerné.
 *
 * Module PUR (aucun import d'exécution) : lu par les pages publiques, les
 * gabarits d'e-mail, les routes et le worker.
 */

/**
 * 🔑 L'INTERRUPTEUR. L'entrée « OpenAI, LLC (comptes rendus de rendez-vous) »
 * de `subprocessors.ts` doit porter CETTE valeur dans `activationStatus`
 * (garde `le-destinataire-des-comptes-rendus-suit-le-module-openai.spec.ts`).
 *
 * Passer à `active` suppose, dans cet ordre (LOTS-EXECUTION §5, PR 8) : le
 * texte « après » LU ET ACCEPTÉ par Will ; le DPA d'OpenAI signé et le partage
 * pour l'entraînement désactivé ; une PR d'une ligne qui change cette constante.
 */
// `as` et non une annotation : une annotation laisserait TypeScript réduire le
// type à la seule valeur écrite, et la comparaison ci-dessous ne compilerait plus.
export const ETAT_COMPTES_RENDUS_VISIO = "pending_activation" as "active" | "pending_activation";

/** Vrai quand le site annonce l'enregistrement des visios. */
export const ANNONCE_VISIO_ACTIVE: boolean = ETAT_COMPTES_RENDUS_VISIO === "active";

/**
 * La création de rencontre (PR 4) n'écrit la phrase d'enregistrement dans
 * l'invitation d'un vrai client que si la notice l'annonce. DÉRIVÉ.
 */
export const ENREGISTREMENT_ANNONCE_AUX_CLIENTS: boolean = ANNONCE_VISIO_ACTIVE;

/**
 * La dictée après un appel téléphonique (B5, B14 : intérêt légitime 6.1.f)
 * n'est annoncée que par le texte « après » de la notice. DÉRIVÉ, jamais réglé
 * à la main (garde `la-dictee-n-est-active-que-si-la-notice-la-mentionne.spec.ts`).
 */
export const DICTEE_ANNONCEE: boolean = ANNONCE_VISIO_ACTIVE;

/**
 * B5 (Will, 28/09, « 1 ET 2 ») : « Discutons de votre projet IA » se tient en
 * Google Meet SEULEMENT. Le site cesse de promettre le téléphone ; le réglage
 * de Calendly est un geste de Will, APRÈS la mise en ligne. Les rendez-vous
 * téléphoniques déjà pris restent servis (branche téléphone de
 * `appel-rappel.tsx` conservée).
 */
export const DISCUTONS_MEET_SEUL = true;

// ═════════════════════════════════════════════════════════════════════════════
// PRÉAVIS AUX CLIENTS ACTIFS (décision de Will du 29/09)
// ═════════════════════════════════════════════════════════════════════════════

export interface Preavis {
  /** Date réelle d'envoi relevée dans `email_outbox`, ISO 8601. */
  readonly envoyeLe: string;
  /** `envoyeLe` + `DELAI_PREAVIS_JOURS` (`preavis-sous-traitants.tsx`), ISO 8601. */
  readonly finLe: string;
}

/**
 * `null` tant que le préavis n'est pas parti : TOUS les clients actifs sont
 * alors refusés. Posé par une PR d'une ligne avec la date relevée dans
 * `email_outbox` (LOTS-EXECUTION §6, PR 8, geste 2).
 */
export const PREAVIS_SOUS_TRAITANTS: Preavis | null = null;

export const CODE_REFUS_PREAVIS = "client_actif_preavis_en_cours" as const;

/** Ce que la route doit savoir du client de la rencontre. */
export interface ClientDeLaRencontre {
  /** Client rattaché ET validé (un prospect « à classer » vaut `false`). */
  readonly valide: boolean;
  /** Actif au sens de B3 (au moins un devis, une facture ou une formation). */
  readonly actif: boolean;
}

export type RefusPreavis =
  | { readonly refuse: false }
  | {
      readonly refuse: true;
      readonly code: typeof CODE_REFUS_PREAVIS;
      /** Bandeau de l'extension, en français pour Will. */
      readonly message: string;
    };

function jourFr(iso: string): string {
  const [a, m, j] = iso.slice(0, 10).split("-");
  return `${j}/${m}/${a}`;
}

/**
 * La règle du préavis par client actif. Appelée par les routes
 * `/api/enregistreur/sessions` et `accord` (PR 5) et par la dictée.
 */
export function refusPourPreavis(
  client: ClientDeLaRencontre,
  maintenant: Date = new Date(),
  preavis: Preavis | null = PREAVIS_SOUS_TRAITANTS,
): RefusPreavis {
  if (!client.valide || !client.actif) return { refuse: false };
  if (preavis === null) {
    return {
      refuse: true,
      code: CODE_REFUS_PREAVIS,
      message:
        "Pas d'enregistrement pour ce client : le préavis n'est pas encore parti. Notes à la main.",
    };
  }
  const fin = Date.parse(preavis.finLe);
  if (!Number.isFinite(fin) || maintenant.getTime() < fin) {
    return {
      refuse: true,
      code: CODE_REFUS_PREAVIS,
      message: `Pas d'enregistrement pour ce client avant le ${jourFr(preavis.finLe)} : notes à la main.`,
    };
  }
  return { refuse: false };
}
