// La catégorie de notification d'une demande du formulaire unifié.
//
// Module FEUILLE (aucun import d'exécution) : `actions.ts` est un fichier « use server » qui ne
// peut exporter que des fonctions asynchrones, et le récap quotidien des demandes de clients
// (`server/alertes-clients/recap.ts`, worker) a besoin de la même table. Un type de formulaire
// absent (`details.unifiedType` manquant : message du chatbot, ancienne demande) est une demande
// CLIENT ordinaire : `categorieDemandeSansType`.

import type { UnifiedContactType } from "@/lib/schemas/unified-contact-schema";
import type { NotificationCategory } from "@/server/notifications";

export function notifCategoryFor(type: UnifiedContactType): NotificationCategory {
  switch (type) {
    case "audit":
      return "AUDIT_REQUEST_SUBMITTED";
    case "implementation":
      return "IMPLEMENTATION_REQUEST_SUBMITTED";
    case "formation":
    case "un_a_un":
    case "journee_ia":
      return "INTERVENTION_REQUEST_SUBMITTED";
    case "devis":
      return "QUOTE_REQUEST_RECEIVED";
    // Form v2 — catégories dédiées pour routage Telegram fin
    case "presse":
      return "PRESS_REQUEST_SUBMITTED";
    case "recrutement":
      return "RECRUITMENT_RECEIVED";
    case "speaker":
      return "SPEAKER_INVITATION_RECEIVED";
    case "investisseur":
      return "INVESTOR_INQUIRY_RECEIVED";
    case "support_client":
      return "CUSTOMER_SUPPORT_REQUEST";
    case "partenariat":
    case "autre":
      return "CONTACT_FORM_SUBMITTED";
  }
}

/** Catégorie d'une demande dont le type de formulaire n'est pas enregistré : une demande client. */
export const categorieDemandeSansType: NotificationCategory = "CONTACT_FORM_SUBMITTED";
