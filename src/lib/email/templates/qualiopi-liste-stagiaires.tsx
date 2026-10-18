// Email — demande de la LISTE DES STAGIAIRES à l'entreprise (chantier QNC, L04).
//
// Part seul, une fois la convention signée, tant que la session compte moins
// d'inscrits que prévu ; relancé deux fois au plus (`liste-stagiaires.ts`).
//
// ⚠️ Destinataire = le CONTACT CLIENT. Le message ne demande que des noms et des
// adresses e-mail : aucune information sur la santé ou la situation des salariés.

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import { objetCompose } from "../objet-email";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  contactNom?: string;
  raisonSociale?: string;
  titreFormation?: string;
  dateDebutFormation?: string;
  numeroSession?: string;
  nbPrevus?: number;
  nbInscrits?: number;
  relance?: boolean;
}

export const qualiopiListeStagiairesSubject = (
  locale: Locale,
  payload: Record<string, unknown>,
): string => {
  const p = payload as Payload;
  if (locale === "fr") {
    return objetCompose(
      p.relance === true ? "Rappel : liste des participants" : "Liste des participants",
      p.titreFormation ?? "",
    );
  }
  return objetCompose("List of participants", p.titreFormation ?? "");
};

export function QualiopiListeStagiairesEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as Payload;
  const manquants =
    typeof p.nbPrevus === "number" && typeof p.nbInscrits === "number"
      ? Math.max(0, p.nbPrevus - p.nbInscrits)
      : null;
  return (
    <EmailLayout
      famille="B"
      preview="Pour préparer la formation, il nous faut le nom et l'adresse e-mail de chaque participant."
      title="La liste des participants"
      locale={locale}
    >
      <Text style={emailStyles.paragraphStyle}>
        Bonjour{p.contactNom ? ` ${p.contactNom}` : ""}, la convention de la formation{" "}
        <strong>{p.titreFormation}</strong>
        {p.dateDebutFormation ? ` (début le ${p.dateDebutFormation})` : ""} est signée : merci.
      </Text>
      <Text style={emailStyles.paragraphStyle}>
        Pour préparer la session, nous avons besoin, pour chaque participant
        {p.raisonSociale ? ` de ${p.raisonSociale}` : ""}, de son <strong>nom</strong>, de son{" "}
        <strong>prénom</strong> et de son <strong>adresse e-mail</strong>
        {manquants !== null && manquants > 0
          ? ` (${manquants} participant${manquants > 1 ? "s" : ""} à nous indiquer)`
          : ""}
        . Chacun recevra ensuite son questionnaire de positionnement et sa convocation.
      </Text>
      <Text style={emailStyles.paragraphStyle}>
        Il suffit de répondre à ce courriel avec la liste. Ne nous transmettez aucune information
        sur la santé de vos salariés : si l&apos;un d&apos;eux a besoin d&apos;un aménagement, il
        pourra l&apos;indiquer lui-même, de façon confidentielle, dans son questionnaire.
        {p.numeroSession ? ` Session ${p.numeroSession}.` : ""}
      </Text>
    </EmailLayout>
  );
}
