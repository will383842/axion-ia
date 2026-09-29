/**
 * Le PRÉAVIS protège les clients ACTIFS, rencontre par rencontre
 * (chantier visio ; décision de Will du 29/09, LOTS-EXECUTION §0, ligne
 * « Préavis » ; ADR 0056 ; PR 5).
 *
 * ## La règle
 *
 * L'ouverture n'attend plus le préavis (`drapeau.ts` ne lit que ses deux
 * variables). Mais un client ACTIF (règle B3 : au moins un devis, une facture,
 * une formation…) a signé sous l'ancienne liste de sous-traitants : tant que
 * son préavis de 30 jours court, AUCUNE de ses rencontres ne s'enregistre, ni
 * en visio ni en dictée. Les routes `POST sessions` et `POST sessions/[id]/accord`
 * répondent 409 `client_actif_preavis_en_cours` ; l'extension affiche
 * « Pas d'enregistrement pour ce client avant le <date> : notes à la main ».
 *
 *   · `PREAVIS_SOUS_TRAITANTS` vaut `null` (préavis pas encore envoyé) :
 *     TOUS les clients actifs sont refusés, sans date de fin ;
 *   · posé (`{ envoyeLe, finLe }`, date réelle relevée dans `email_outbox`) :
 *     refusés jusqu'à `finLe` exclu, puis enregistrables ;
 *   · une rencontre SANS client validé (prospect « à classer », client
 *     seulement PROPOSÉ) n'est pas concernée : aucune pièce ne la lie encore.
 *
 * Tests : `un-client-actif-n-est-pas-enregistre-avant-la-fin-du-preavis`,
 * `un-prospect-est-enregistrable-sans-attendre-le-preavis`,
 * `sans-date-de-preavis-tout-client-actif-est-refuse`.
 *
 * Module sans `server-only` : la liste du jour le lit aussi.
 */

import { estClientActifParId, type LecteurUnClient } from "./preavis-destinataires";

export interface Preavis {
  readonly envoyeLe: string;
  readonly finLe: string;
}

/**
 * La SEULE déclaration du préavis. `null` = pas encore envoyé. Posé à la main,
 * par une PR d'une ligne, une fois l'envoi réel constaté (`envoyeLe` = date
 * d'envoi relevée, `finLe` = envoi + 30 jours), en ISO 8601 COMPLET avec
 * fuseau (`2026-10-30T00:00:00+01:00`) : le contrat de l'extension l'exige.
 */
export const PREAVIS_SOUS_TRAITANTS: Preavis | null = null;

/** Le préavis court-il encore, maintenant ? Une date illisible compte comme « court ». */
export function preavisEnCours(maintenant: Date, preavis: Preavis | null): boolean {
  if (preavis === null) return true;
  const fin = Date.parse(preavis.finLe);
  return !Number.isFinite(fin) || maintenant.getTime() < fin;
}

/** Ce que voit l'extension quand une rencontre est bloquée : `finLe` nul = pas de date encore. */
export interface BlocagePreavis {
  readonly finLe: string | null;
}

/**
 * Cette rencontre est-elle bloquée par le préavis ? `null` si elle peut
 * s'enregistrer (pas de client validé, client non actif, préavis échu).
 */
export async function blocagePreavis(
  db: LecteurUnClient,
  clientId: string | null,
  maintenant: Date,
  preavis: Preavis | null = PREAVIS_SOUS_TRAITANTS,
): Promise<BlocagePreavis | null> {
  if (clientId === null) return null;
  if (!preavisEnCours(maintenant, preavis)) return null;
  if (!(await estClientActifParId(db, clientId))) return null;
  return { finLe: preavis?.finLe ?? null };
}

/** « 30/10/2026 » en heure de Paris. */
function dateFr(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" });
}

/** Le texte du refus, pour Will (même texte que le bandeau de l'extension). */
export function messagePreavis(b: BlocagePreavis): string {
  return b.finLe === null
    ? "Pas d'enregistrement pour ce client : le préavis aux clients actifs n'est pas encore envoyé. Notes à la main."
    : `Pas d'enregistrement pour ce client avant le ${dateFr(b.finLe)} : notes à la main.`;
}

/** Une ligne pour la console (page « Enregistreur ») : où en est le préavis. */
export function etatDuPreavis(
  maintenant: Date,
  preavis: Preavis | null = PREAVIS_SOUS_TRAITANTS,
): string {
  if (preavis === null) {
    return "Préavis pas encore envoyé : aucun client actif n'est enregistré (notes à la main). Les prospects, oui.";
  }
  return preavisEnCours(maintenant, preavis)
    ? `Pas d'enregistrement des clients actifs avant le ${dateFr(preavis.finLe)}. Les prospects, oui.`
    : "Préavis échu : les clients actifs s'enregistrent comme les autres.";
}
