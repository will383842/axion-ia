// E-mail INTERNE — un client a envoyé ses réponses au questionnaire de cadrage
// en ligne (2026-10-01).
//
// Destinataire : l'équipe Axion-IA (contact@axion-ia.com), jamais le client.
// Il dit QUI a répondu (client · projet) et mène à la fiche projet de la
// console, vue « Questionnaire ».
//
// ⛔ AUCUNE réponse dans ce message, ni le nom de la personne qui répond : les
// réponses sont des paroles chiffrées en base (`chiffrerParole`) ; les recopier
// dans une boîte de réception les ferait sortir de ce chiffrement. On les lit
// dans la console, derrière la garde A2.

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import { objetCompose } from "../objet-email";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  /** Raison sociale du client. */
  client?: string;
  /** Titre du projet. */
  projet?: string;
  /** Lien vers la fiche projet, vue « Questionnaire », dans la console. */
  consoleUrl?: string;
}

const texte = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

export const questionnaireReponsesRecuesSubject = (
  _locale: Locale,
  payload: Record<string, unknown>,
): string => {
  const client = texte(payload["client"]) || "un client";
  const projet = texte(payload["projet"]);
  return objetCompose("Réponses reçues :", projet ? `${client} · ${projet}` : client);
};

export function QuestionnaireReponsesRecuesEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as unknown as Payload;
  const client = texte(p.client) || "un client";
  const projet = texte(p.projet);
  const consoleUrl = texte(p.consoleUrl);
  return (
    <EmailLayout
      famille="C"
      preview={`Questionnaire en ligne envoyé par ${client}${projet ? ` pour « ${projet} »` : ""} : à lire dans la console.`}
      title="Réponses au questionnaire reçues"
      /* L'URL mène à la console : on ne l'imprime pas en clair (préfixe secret). */
      {...(consoleUrl
        ? { cta: { label: "Ouvrir le questionnaire du projet", href: consoleUrl } }
        : {})}
      ctaSecret
      locale={locale}
    >
      <Text style={emailStyles.paragraphStyle}>
        <strong>Client :</strong> {client}
        {projet ? (
          <>
            {" "}
            · <strong>Projet :</strong> {projet}
          </>
        ) : null}
      </Text>
      <Text style={emailStyles.paragraphStyle}>
        Les réponses ne figurent pas dans ce message : elles sont rangées sous chaque question, dans
        la fiche du projet (vue « Questionnaire »).
      </Text>
    </EmailLayout>
  );
}
