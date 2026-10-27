/**
 * Tour France IA : la demande part au CRM Pro (PR-2a).
 *
 * Par le canal EXISTANT de la synchro site → CRM (`syncFormSubmissionToCrm`, file `crm_sync_outbox`
 * vidée par le worker) : un formulaire de type « autre », source `tour-france-ia`. Rien de nouveau
 * dans le contrat : le CRM reçoit un lead `form_submission`, sans SIREN (arbitrage côté CRM).
 *
 *   · la clé de la personne est l'empreinte de l'e-mail — la MÊME que celle du futur rendez-vous
 *     (`calendly_booked`) : une seule personne côté CRM quand elle prend ensuite son rendez-vous ;
 *   · ni `consent` ni `tags` : la base légale est la demande de la personne (mesures
 *     précontractuelles), pas un consentement marketing ; aucune valeur n'est ajoutée à
 *     `CRM_FORM_TYPES` ;
 *   · `event_id` DÉTERMINISTE (`event-id.ts`) : rejouer l'envoi ne crée pas de seconde activité ;
 *   · drapeau `CRM_SYNC_ENABLED` éteint : la synchro ne fait STRICTEMENT rien (voir `index.ts`).
 *
 * La synchro ne lève jamais et ne fait aucun appel réseau (l'émission part par la file).
 */

import { syncFormSubmissionToCrm } from "@/server/crm-sync";
import { eventIdDeterministe } from "@/server/crm-sync/event-id";

/** La source écrite au CRM. */
export const SOURCE_CRM_TOUR = "tour-france-ia";

export interface DemandePourCrm {
  readonly id: string;
  readonly nom: string;
  readonly email: string;
  readonly telephone: string;
  /** Le nom du référentiel, sinon la ville telle que tapée. */
  readonly ville: string;
  readonly depuis: string | null;
  readonly utmSource: string | null;
  readonly utmMedium: string | null;
  readonly utmCampaign: string | null;
  readonly utmContent: string | null;
}

/** Met la demande en file pour le CRM Pro. */
export async function envoyerAuCrm(d: DemandePourCrm): Promise<void> {
  const utm: Record<string, string> = {};
  if (d.utmSource !== null) utm["utm_source"] = d.utmSource;
  if (d.utmMedium !== null) utm["utm_medium"] = d.utmMedium;
  if (d.utmCampaign !== null) utm["utm_campaign"] = d.utmCampaign;
  if (d.utmContent !== null) utm["utm_content"] = d.utmContent;

  await syncFormSubmissionToCrm({
    formType: "autre",
    sourceSlug: SOURCE_CRM_TOUR,
    subjectRef: `site:tour-demande:${d.id}`,
    person: { email: d.email, fullName: d.nom, phone: d.telephone },
    company: { city: d.ville },
    payload: {
      circuit: "tour_france_ia",
      ville: d.ville,
      ...(d.depuis !== null ? { depuis: d.depuis } : {}),
      ...utm,
    },
    eventId: eventIdDeterministe(`tour_demande:${d.id}`),
  });
}
