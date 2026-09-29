/**
 * Le PRÉAVIS appliqué rencontre par rencontre : QUI est protégé
 * (chantier visio ; décision de Will du 29/09, REPONSES-WILL « OUVERTURE = 1 »,
 * LOTS-EXECUTION §0, ligne « Préavis » ; ADR 0056 ; PR 5).
 *
 * ## Ce module ne déclare PAS la règle
 *
 * La déclaration du préavis (`PREAVIS_SOUS_TRAITANTS`), son code de refus et
 * le texte montré à Will (`refusPourPreavis`) ont UNE source :
 * `src/server/visio/visio-annonce.ts` (anti-doublon D2, verrou
 * `les-interrupteurs-publics-ont-une-seule-source.spec.ts`). Ce module ne fait
 * que la LECTURE de la base : à quel(s) client(s) une rencontre se rattache, et
 * l'un d'eux est-il actif (règle B3, `estClientActifParId`) ?
 *
 * ## Qui est protégé : le client actif, validé OU reconnaissable
 *
 * « SEULES les visios de ce(s) client(s) actif(s) sont refusées […] bloquées
 * automatiquement » (Will, 29/09). Or une rencontre Calendly naît « à classer »,
 * sans client validé (A4 : validée seulement « Après l'appel »). Ne regarder que
 * `clientId` laisserait enregistrer le client actif qui réserve « Discutons de
 * votre projet IA ». Une rencontre est donc bloquée si elle se rattache à un
 * client actif par l'un de ces liens :
 *
 *   · le client VALIDÉ (`clientId`) ;
 *   · le client PROPOSÉ (`clientProposeId`) — proposer n'est pas ranger (A4),
 *     mais c'est assez pour ne PAS enregistrer ;
 *   · le client d'un participant (`RencontreParticipant.clientId`, ou celui de
 *     sa fiche personne `contactId`) ;
 *   · une adresse connue d'une personne d'un client (`ClientContactAdresse`) qui
 *     est celle de l'invité Calendly ou d'un participant (clé `emailHash`).
 *
 * Un VRAI prospect (aucun de ces liens) reste enregistrable sans attendre le
 * préavis. Dans le doute on bloque : Will prend des notes à la main.
 *
 * Tests : `un-client-actif-n-est-pas-enregistre-avant-la-fin-du-preavis`,
 * `un-prospect-est-enregistrable-sans-attendre-le-preavis`,
 * `sans-date-de-preavis-tout-client-actif-est-refuse`.
 *
 * Module sans `server-only` : la liste du jour le lit aussi.
 */

import type { PrismaClient } from "../../../prisma/generated/client";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { estClientActifParId } from "./preavis-destinataires";
import { PREAVIS_SOUS_TRAITANTS, refusPourPreavis, type Preavis } from "./visio-annonce";

/** Le préavis court-il encore, maintenant ? Dérivé de la règle unique (`refusPourPreavis`). */
export function preavisEnCours(maintenant: Date, preavis: Preavis | null): boolean {
  return refusPourPreavis({ valide: true, actif: true }, maintenant, preavis).refuse;
}

/** Ce que voit l'extension quand une rencontre est bloquée : `finLe` nul = pas de date encore. */
export interface BlocagePreavis {
  readonly finLe: string | null;
  /** Le texte de `refusPourPreavis`, tel quel. */
  readonly message: string;
}

export type LecteurRattachement = Pick<
  PrismaClient,
  "rencontre" | "rencontreParticipant" | "clientContact" | "clientContactAdresse" | "client"
>;

/**
 * Les clients auxquels cette rencontre se rattache (validé, proposé,
 * participants, adresses reconnues). Sans doublon, sans ordre.
 */
export async function clientsDeLaRencontre(
  db: LecteurRattachement,
  rencontreId: string,
): Promise<string[]> {
  const r = await db.rencontre.findUnique({
    where: { id: rencontreId },
    select: {
      clientId: true,
      clientProposeId: true,
      calendlyEvent: { select: { inviteeEmail: true } },
    },
  });
  if (!r) return [];
  const ids = new Set<string>();
  if (r.clientId) ids.add(r.clientId);
  if (r.clientProposeId) ids.add(r.clientProposeId);

  const participants = await db.rencontreParticipant.findMany({
    where: { rencontreId },
    select: { clientId: true, contactId: true, emailHash: true },
  });
  const contacts = new Set<string>();
  const empreintes = new Set<string>();
  const invite = hashEmailForLookup(r.calendlyEvent?.inviteeEmail ?? null);
  if (invite) empreintes.add(invite);
  for (const p of participants) {
    if (p.clientId) ids.add(p.clientId);
    if (p.contactId) contacts.add(p.contactId);
    if (p.emailHash) empreintes.add(p.emailHash);
  }

  if (empreintes.size > 0) {
    const adresses = await db.clientContactAdresse.findMany({
      where: { emailHash: { in: [...empreintes] } },
      select: { contactId: true },
    });
    for (const a of adresses) contacts.add(a.contactId);
  }
  if (contacts.size > 0) {
    const fiches = await db.clientContact.findMany({
      where: { id: { in: [...contacts] } },
      select: { clientId: true },
    });
    for (const f of fiches) ids.add(f.clientId);
  }
  return [...ids];
}

/**
 * Cette rencontre est-elle bloquée par le préavis ? `null` si elle peut
 * s'enregistrer (préavis échu, ou aucun client actif rattachable).
 */
export async function blocagePreavis(
  db: LecteurRattachement,
  rencontreId: string,
  maintenant: Date,
  preavis: Preavis | null = PREAVIS_SOUS_TRAITANTS,
): Promise<BlocagePreavis | null> {
  // Préavis échu : personne n'est plus protégé, aucune lecture.
  if (!preavisEnCours(maintenant, preavis)) return null;
  let actif = false;
  for (const id of await clientsDeLaRencontre(db, rencontreId)) {
    if (await estClientActifParId(db, id)) {
      actif = true;
      break;
    }
  }
  // `valide: true` : un client actif RECONNAISSABLE est protégé comme un client
  // validé (décision de Will du 29/09, voir l'en-tête).
  const refus = refusPourPreavis({ valide: true, actif }, maintenant, preavis);
  return refus.refuse ? { finLe: preavis?.finLe ?? null, message: refus.message } : null;
}

/** « 30/10/2026 », comme `refusPourPreavis`. */
function jourFr(iso: string): string {
  const [a, m, j] = iso.slice(0, 10).split("-");
  return `${j}/${m}/${a}`;
}

/** Une ligne pour la console (page « Enregistreur ») : où en est le préavis. */
export function etatDuPreavis(
  maintenant: Date,
  preavis: Preavis | null = PREAVIS_SOUS_TRAITANTS,
): string {
  if (preavis === null) {
    return "Préavis pas encore parti : aucun client actif n'est enregistré (notes à la main). Les prospects, oui.";
  }
  return preavisEnCours(maintenant, preavis)
    ? `Pas d'enregistrement des clients actifs avant le ${jourFr(preavis.finLe)}. Les prospects, oui.`
    : "Préavis échu : les clients actifs s'enregistrent comme les autres.";
}
