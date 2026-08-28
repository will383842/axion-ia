// Router des templates email × 2 locales (Sprint 15 / M8 step 4).
//
// Chaque template est un composant qui prend `locale` + `payload`. Le router
// `renderEmailTemplate(name, locale, payload)` retourne { subject, html, text }.

import { render } from "@react-email/render";
import type { ReactElement } from "react";
import type { EmailJobName } from "@/server/queue/types";
import type { Locale } from "../../../../prisma/generated/client";
import { getPublishedReviewStats } from "../review-stats";
import { setReviewStats } from "./_layout";
import { AuditConfirmedEmail, auditConfirmedSubject } from "./audit-confirmed";
import {
  ImplementationConfirmedEmail,
  implementationConfirmedSubject,
} from "./implementation-confirmed";
import {
  NewsletterConfirmOptinEmail,
  newsletterConfirmOptinSubject,
} from "./newsletter-confirm-optin";
import { ContactConfirmedEmail, contactConfirmedSubject } from "./contact-confirmed";
import { RoiReportEmail, roiReportSubject } from "./roi-report";
import { GdprExportLinkEmail, gdprExportLinkSubject } from "./gdpr-export-link";
import { RgpdDemandeRecueEmail, rgpdDemandeRecueSubject } from "./rgpd-demande-recue";
import {
  RgpdEffacementConfirmeEmail,
  rgpdEffacementConfirmeSubject,
} from "./rgpd-effacement-confirme";
import { PodcastDemandeRecueEmail, podcastDemandeRecueSubject } from "./podcast-demande-recue";
import { RappelConfirmeEmail, rappelConfirmeSubject } from "./rappel-confirme";
import { AppelRappelEmail, appelRappelSubject } from "./appel-rappel";
import {
  ChatbotDemandeTransmiseEmail,
  chatbotDemandeTransmiseSubject,
} from "./chatbot-demande-transmise";
import { CandidatureRecueEmail, candidatureRecueSubject } from "./candidature-recue";
import { AvisRecuEmail, avisRecuSubject } from "./avis-recu";
import { QuoteRequestReceivedEmail, quoteRequestReceivedSubject } from "./quote-request-received";
import { PaymentLinkEmail, paymentLinkSubject } from "./payment-link";
import { PaymentReceiptEmail, paymentReceiptSubject } from "./payment-receipt";
import { PaymentFailedEmail, paymentFailedSubject } from "./payment-failed";
import { ForceMajeureNoticeEmail, forceMajeureNoticeSubject } from "./force-majeure-notice";
import {
  CancellationConfirmedByUserEmail,
  cancellationConfirmedByUserSubject,
} from "./cancellation-confirmed-by-user";
import { SubmissionReplyEmail, submissionReplySubject } from "./submission-reply";
// T15 — emails auto Qualiopi lifecycle
import { QualiopiConvocationEmail, qualiopiConvocationSubject } from "./qualiopi-convocation";
import { QualiopiRappelJ7Email, qualiopiRappelJ7Subject } from "./qualiopi-rappel-j7";
import {
  QualiopiSatisfactionJ1Email,
  qualiopiSatisfactionJ1Subject,
} from "./qualiopi-satisfaction-j1";
import { QualiopiSuiviJ30Email, qualiopiSuiviJ30Subject } from "./qualiopi-suivi-j30";
import {
  QualiopiPositionnementEmail,
  qualiopiPositionnementSubject,
} from "./qualiopi-positionnement";
import {
  QualiopiQuestionnaireRelanceEmail,
  qualiopiQuestionnaireRelanceSubject,
} from "./qualiopi-questionnaire-relance";
import {
  QualiopiEnqueteEntrepriseEmail,
  qualiopiEnqueteEntrepriseSubject,
} from "./qualiopi-enquete-entreprise";
import { QualiopiPortailAccesEmail, qualiopiPortailAccesSubject } from "./qualiopi-portail-acces";
import {
  QualiopiEmargementLienEmail,
  qualiopiEmargementLienSubject,
} from "./qualiopi-emargement-lien";
import {
  QualiopiAttestationDisponibleEmail,
  qualiopiAttestationDisponibleSubject,
} from "./qualiopi-attestation-disponible";
import {
  QualiopiRelanceImpayeeEmail,
  qualiopiRelanceImpayeeSubject,
} from "./qualiopi-relance-impayee";
import {
  QualiopiAlerteInterneEmail,
  qualiopiAlerteInterneSubject,
} from "./qualiopi-alerte-interne";
import {
  DocumentsNouvelleVersionEmail,
  documentsNouvelleVersionSubject,
} from "./documents-nouvelle-version";
import { FormateurMagicLinkEmail, formateurMagicLinkSubject } from "./formateur-magic-link";
import { RessourcesMagicLinkEmail, ressourcesMagicLinkSubject } from "./ressources-magic-link";
import { DevisEnvoiEmail, devisEnvoiSubject } from "./devis-envoi";
import {
  CandidatureCommercialConfirmeeEmail,
  candidatureCommercialConfirmeeSubject,
} from "./candidature-commercial-confirmee";
import {
  CandidatureCommercialRecapEmail,
  candidatureCommercialRecapSubject,
} from "./candidature-commercial-recap";
import { VivierInformationEmail, vivierInformationSubject } from "./vivier-information";
import { ConventionEnvoiEmail, conventionEnvoiSubject } from "./convention-envoi";
import { FactureEnvoiEmail, factureEnvoiSubject } from "./facture-envoi";

type TemplateMap = {
  [K in EmailJobName]: {
    subject: (locale: Locale, payload: Record<string, unknown>) => string;
    component: (props: { locale: Locale; payload: Record<string, unknown> }) => ReactElement;
  };
};

const TEMPLATES: TemplateMap = {
  "audit-confirmed": {
    subject: auditConfirmedSubject,
    component: AuditConfirmedEmail,
  },
  "implementation-confirmed": {
    subject: implementationConfirmedSubject,
    component: ImplementationConfirmedEmail,
  },
  "newsletter-confirm-optin": {
    subject: newsletterConfirmOptinSubject,
    component: NewsletterConfirmOptinEmail,
  },
  "contact-confirmed": {
    subject: contactConfirmedSubject,
    component: ContactConfirmedEmail,
  },
  "roi-report": {
    subject: roiReportSubject,
    component: RoiReportEmail,
  },
  "gdpr-export-link": {
    subject: gdprExportLinkSubject,
    component: GdprExportLinkEmail,
  },
  "rgpd-demande-recue": {
    subject: rgpdDemandeRecueSubject,
    component: RgpdDemandeRecueEmail,
  },
  "rgpd-effacement-confirme": {
    subject: rgpdEffacementConfirmeSubject,
    component: RgpdEffacementConfirmeEmail,
  },
  "podcast-demande-recue": {
    subject: podcastDemandeRecueSubject,
    component: PodcastDemandeRecueEmail,
  },
  "rappel-confirme": {
    subject: rappelConfirmeSubject,
    component: RappelConfirmeEmail,
  },
  "appel-rappel": {
    subject: appelRappelSubject,
    component: AppelRappelEmail,
  },
  "chatbot-demande-transmise": {
    subject: chatbotDemandeTransmiseSubject,
    component: ChatbotDemandeTransmiseEmail,
  },
  "candidature-recue": {
    subject: candidatureRecueSubject,
    component: CandidatureRecueEmail,
  },
  "avis-recu": {
    subject: avisRecuSubject,
    component: AvisRecuEmail,
  },
  "quote-request-received": {
    subject: quoteRequestReceivedSubject,
    component: QuoteRequestReceivedEmail,
  },
  "payment-link": {
    subject: paymentLinkSubject,
    component: PaymentLinkEmail,
  },
  "payment-receipt": {
    subject: paymentReceiptSubject,
    component: PaymentReceiptEmail,
  },
  "payment-failed": {
    subject: paymentFailedSubject,
    component: PaymentFailedEmail,
  },
  "force-majeure-notice": {
    subject: forceMajeureNoticeSubject,
    component: ForceMajeureNoticeEmail,
  },
  "cancellation-confirmed-by-user": {
    subject: cancellationConfirmedByUserSubject,
    component: CancellationConfirmedByUserEmail,
  },
  "submission-reply": {
    subject: submissionReplySubject,
    component: SubmissionReplyEmail,
  },
  // T15 — emails auto Qualiopi lifecycle
  "qualiopi-convocation": {
    subject: qualiopiConvocationSubject,
    component: QualiopiConvocationEmail,
  },
  "qualiopi-rappel-j7": {
    subject: qualiopiRappelJ7Subject,
    component: QualiopiRappelJ7Email,
  },
  "qualiopi-satisfaction-j1": {
    subject: qualiopiSatisfactionJ1Subject,
    component: QualiopiSatisfactionJ1Email,
  },
  "qualiopi-suivi-j30": {
    subject: qualiopiSuiviJ30Subject,
    component: QualiopiSuiviJ30Email,
  },
  "qualiopi-positionnement": {
    subject: qualiopiPositionnementSubject,
    component: QualiopiPositionnementEmail,
  },
  "qualiopi-questionnaire-relance": {
    subject: qualiopiQuestionnaireRelanceSubject,
    component: QualiopiQuestionnaireRelanceEmail,
  },
  "qualiopi-enquete-entreprise": {
    subject: qualiopiEnqueteEntrepriseSubject,
    component: QualiopiEnqueteEntrepriseEmail,
  },
  "qualiopi-attestation-disponible": {
    subject: qualiopiAttestationDisponibleSubject,
    component: QualiopiAttestationDisponibleEmail,
  },
  // F59 — relance d'impayé. Passe par la corbeille de validation : jamais
  // envoyée sans relecture (cf. `outbox-policy.ts`).
  "qualiopi-relance-impayee": {
    subject: qualiopiRelanceImpayeeSubject,
    component: QualiopiRelanceImpayeeEmail,
  },
  "qualiopi-portail-acces": {
    subject: qualiopiPortailAccesSubject,
    component: QualiopiPortailAccesEmail,
  },
  // Lien personnel de signature de présence. Gabarit DÉDIÉ : réemployer
  // `qualiopi-portail-acces` ferait dire au message « vous pouvez ignorer cet
  // email » à quelqu'un qui doit précisément ne pas l'ignorer.
  "qualiopi-emargement-lien": {
    subject: qualiopiEmargementLienSubject,
    component: QualiopiEmargementLienEmail,
  },
  "qualiopi-alerte-interne": {
    subject: qualiopiAlerteInterneSubject,
    component: QualiopiAlerteInterneEmail,
  },
  "documents-nouvelle-version": {
    subject: documentsNouvelleVersionSubject,
    component: DocumentsNouvelleVersionEmail,
  },
  "formateur-magic-link": {
    subject: formateurMagicLinkSubject,
    component: FormateurMagicLinkEmail,
  },
  "ressources-magic-link": {
    subject: ressourcesMagicLinkSubject,
    component: RessourcesMagicLinkEmail,
  },
  // Hub facturation — envois MANUELS admin (PDF joint par le worker, clé R2).
  "devis-envoi": { subject: devisEnvoiSubject, component: DevisEnvoiEmail },
  "convention-envoi": { subject: conventionEnvoiSubject, component: ConventionEnvoiEmail },
  "facture-envoi": { subject: factureEnvoiSubject, component: FactureEnvoiEmail },
  // Candidature commerciale (tunnel sans CV, Mémorial de l'Isère 2026-08-12)
  "candidature-commercial-confirmee": {
    subject: candidatureCommercialConfirmeeSubject,
    component: CandidatureCommercialConfirmeeEmail,
  },
  "candidature-commercial-recap": {
    subject: candidatureCommercialRecapSubject,
    component: CandidatureCommercialRecapEmail,
  },
  "vivier-information": {
    subject: vivierInformationSubject,
    component: VivierInformationEmail,
  },
};

/** Tous les noms de templates email enregistrés (pour tests de couverture). */
export const EMAIL_TEMPLATE_NAMES = Object.keys(TEMPLATES) as EmailJobName[];

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export async function renderEmailTemplate(
  name: EmailJobName,
  locale: Locale,
  payload: Record<string, unknown>,
): Promise<RenderedEmail> {
  const tpl = TEMPLATES[name];
  const Component = tpl.component;
  const subject = tpl.subject(locale, payload);
  // Injecte les stats avis RÉELLES (DB, cache 15 min) dans le bandeau de confiance
  // de tous les templates, sans changer chaque template. On pose la valeur AVANT
  // chaque `render` synchrone (parcours React sync → pas d'interleave concurrent).
  const reviewStats = await getPublishedReviewStats();
  const element = <Component locale={locale} payload={payload} />;
  setReviewStats(reviewStats);
  const html = await render(element, { pretty: false });
  setReviewStats(reviewStats);
  const text = await render(element, { plainText: true });
  return { subject, html, text };
}
