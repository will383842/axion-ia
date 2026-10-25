// E-mail CLIENT — « Vos réponses sont bien arrivées » (questionnaire avant audit, 2026-10-26).
//
// Enfilé UNIQUEMENT par le balayage du worker (`features/questionnaire-preaudit/suivi.ts`), une
// fois par réponse reçue : au dirigeant (adresse à qui Will a envoyé le lien), au collaborateur
// ou au référent informatique (l'adresse qu'il a donnée, s'il a accepté le traitement). Texte
// NEUTRE pour les collaborateurs (décision 7 : rien sur qui lit quoi). Sans bouton.
// Textes : plan « e-mails, relances, Telegram » §7 E5, mot pour mot. Aucun délai, aucune promesse.
//
// ⛔ Jamais « J'aide », « Aucun gain garanti », « Grenoble » (ordres de Will).

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import { CONTACT_RGPD_DEFAUT, TEXTE_CONSERVATION } from "@/features/questionnaire-preaudit/config";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  role?: "dirigeant" | "collaborateur";
  prenom?: string;
  societe?: string;
  /** « 25 octobre » */
  recuLeTexte?: string;
  auditCourt?: string;
  conservation?: string;
  contactRgpd?: string;
}

const texte = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

export const questionnaireAvantAuditConfirmationSubject = (
  _locale: Locale,
  _payload: Record<string, unknown>,
): string => "Vos réponses sont bien arrivées";

export function QuestionnaireAvantAuditConfirmationEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as unknown as Payload;
  const dirigeant = p.role === "dirigeant";
  const prenom = texte(p.prenom);
  const societe = texte(p.societe);
  const recuLe = texte(p.recuLeTexte);
  const auditCourt = texte(p.auditCourt);
  const conservation = texte(p.conservation) || TEXTE_CONSERVATION;
  const contact = texte(p.contactRgpd) || CONTACT_RGPD_DEFAUT;
  const donnees = `Vos réponses sont conservées ${conservation}. Pour toute question sur vos données, ou pour demander à les consulter, les corriger ou les effacer, écrivez-nous à ${contact}.`;
  return (
    <EmailLayout
      famille="C"
      preview="Merci pour le temps consacré au questionnaire avant notre audit."
      title="Merci, vos réponses sont bien arrivées"
      locale={locale}
    >
      <Text style={emailStyles.paragraphStyle}>{prenom ? `Bonjour ${prenom},` : "Bonjour,"}</Text>
      {dirigeant ? (
        <>
          <Text style={emailStyles.paragraphStyle}>
            Merci pour le temps que vous avez consacré au questionnaire. Vos réponses nous sont bien
            parvenues{recuLe ? ` le ${recuLe}` : ""} ; elles vont nous servir à préparer notre audit
            {auditCourt ? ` du ${auditCourt}` : ""}.
          </Text>
          <Text style={emailStyles.paragraphStyle}>
            Si vos collaborateurs n&apos;ont pas encore répondu, ils peuvent toujours le faire avec
            le lien que vous leur avez transmis.
          </Text>
        </>
      ) : (
        <Text style={emailStyles.paragraphStyle}>
          Merci d&apos;avoir répondu au questionnaire{societe ? ` préparé pour ${societe}` : ""}.
          Vos réponses nous sont bien parvenues : elles nous aident à préparer l&apos;audit de votre
          entreprise.
        </Text>
      )}
      <Text style={emailStyles.paragraphStyle}>{donnees}</Text>
      <Text style={emailStyles.paragraphStyle}>
        À très bientôt,
        <br />
        Williams Jullin, Axion-IA
      </Text>
    </EmailLayout>
  );
}
