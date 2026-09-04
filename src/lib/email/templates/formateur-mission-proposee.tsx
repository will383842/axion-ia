// Email — proposition de mission au FORMATEUR (2026-09-03).
//
// Avant ce gabarit, affecter un formateur à une session ne lui disait RIEN :
// aucun message, aucune demande d'accord. L'organisme découvrait à J-7, ou le
// matin même, que la personne n'était pas disponible. Ce message lui demande
// une réponse — accepter, ou refuser en donnant le motif — par un lien qui
// désigne CETTE sollicitation et rien d'autre.
//
// Sert aussi de RELANCE (`relance: true`) : même contenu, en-tête qui dit que
// c'est la seconde demande. Un second gabarit aurait été une copie.

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import { objetCompose } from "../objet-email";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  formateurPrenomNom: string;
  titreFormation: string;
  numeroSession: string;
  dateDebut: string;
  dateFin: string;
  modalite: string;
  lieu: string;
  effectif: string;
  /** « formateur principal » ou « co-formateur ». */
  roleLibelle: string;
  /** Lien SECRET vers la page de réponse (jeton de sollicitation). */
  lienReponse: string;
  /** Date d'ÉCHÉANCE de la réponse — plus le démarrage, cf. `delaiReponse`. */
  dateLimiteReponse: string;
  /** « sous 5 heures », « sous 2 jours » — dérivé, jamais écrit en dur. */
  delaiReponse?: string;
  /** Quand les informations pratiques arriveront RÉELLEMENT. */
  infosPratiques?: string;
  relance?: boolean;
}

export const formateurMissionProposeeSubject = (
  locale: Locale,
  payload: Record<string, unknown>,
): string => {
  const p = payload as unknown as Payload;
  const prefixe = p.relance === true ? "Relance mission —" : "Mission proposée —";
  if (locale === "fr") return objetCompose(prefixe, p.titreFormation ?? "Formation");
  return objetCompose(
    p.relance === true ? "Reminder —" : "Assignment offer —",
    p.titreFormation ?? "Training",
  );
};

export function FormateurMissionProposeeEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as unknown as Payload;
  const relance = p.relance === true;
  return (
    <EmailLayout
      famille="C"
      preview={
        relance
          ? "Sans réponse de votre part, nous devrons confier la session à quelqu'un d'autre."
          : "Un clic pour accepter — ou refuser en indiquant le motif. Merci de répondre vite."
      }
      title={relance ? "Votre réponse est attendue" : "Une mission vous est proposée"}
      cta={{ label: "Répondre à la proposition", href: p.lienReponse }}
      ctaSecret
      locale={locale}
    >
      <Text style={emailStyles.paragraphStyle}>
        {relance ? "Nous n'avons pas encore votre réponse pour " : "Nous vous proposons d'animer "}
        <strong>{p.titreFormation}</strong> du <strong>{p.dateDebut}</strong> au{" "}
        <strong>{p.dateFin}</strong>, en tant que {p.roleLibelle}.
      </Text>
      <Text style={emailStyles.paragraphStyle}>
        Bonjour {p.formateurPrenomNom} — voici l&apos;essentiel : {p.modalite} · {p.lieu} ·{" "}
        {p.effectif}. Les informations pratiques complètes (adresse, salle, contact sur place,
        consignes d&apos;accès, horaires){" "}
        {/*
          🔴 C'était « vous seront envoyées une semaine avant le démarrage », EN
          DUR. Pour une session le lendemain, c'est une promesse impossible — et
          le formateur a reçu, dix minutes après ce message, le rappel « votre
          session de demain ». Deux messages du même expéditeur qui se
          contredisent dans le même quart d'heure.

          Même famille que le « demain » du rappel J-1 corrigé le 2026-09-04 :
          ce qui dépend du délai se DÉRIVE du délai. La valeur de repli garde
          l'ancienne phrase, qui reste juste pour une session lointaine.
        */}
        {p.infosPratiques ?? "vous seront envoyées une semaine avant le démarrage"} et restent
        consultables dans votre espace formateur.
      </Text>
      <Text style={emailStyles.paragraphStyle}>
        <strong>Merci de répondre {p.delaiReponse ?? "au plus vite"}</strong> : acceptez, ou refusez
        en indiquant le motif. Un refus libère la session pour qu&apos;un autre formateur puisse la
        prendre — plus il arrive tôt, mieux c&apos;est.
      </Text>
      {/*
        🔴 Le paragraphe disait « il cesse de fonctionner … au démarrage de la
        session ». Exact pour le JETON, faux pour la RÉPONSE : passé l'échéance,
        la session est libérée et réaffectée. Un formateur qui lisait « j'ai
        jusqu'au démarrage » pouvait accepter à H-1 une session déjà confiée à
        quelqu'un d'autre — deux personnes convaincues d'animer la même journée.
      */}
      <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
        Ce lien est personnel et ne vaut que pour cette proposition. Sans réponse d&apos;ici au{" "}
        {p.dateLimiteReponse}, nous confierons la session à quelqu&apos;un d&apos;autre — le lien
        vous permettra encore de nous écrire, mais plus d&apos;accepter. Référence :{" "}
        {p.numeroSession}.
      </Text>
    </EmailLayout>
  );
}
