// E-mail à l'ENTREPRISE — recueil du besoin, temps 1 (chantier QNC, lot L03).
//
// Part AUTOMATIQUEMENT dès la demande (avec relances J+3 puis J+6 au plus), AVANT
// le devis et la convention. Le bouton ouvre le questionnaire en ligne du
// chantier visio (`/questionnaire/<id>/<jeton>`) : lien secret, un par projet.
//
// ⛔ Le lien est porté par le bouton, jamais imprimé (`ctaSecret`).
// ⛔ Aucun prix, aucune donnée de santé : l'adaptation se dit sans sa cause.
// Un seul gabarit pour le premier envoi et les relances (`rang`).

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import { objetCompose } from "../objet-email";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  /** Nom de la personne contactée (facultatif). */
  destinataireNom?: string;
  /** Raison sociale de l'entreprise. */
  clientNom?: string;
  /** Intitulé de l'action de formation. */
  titreFormation?: string;
  /** Lien secret du questionnaire — porté par le bouton. */
  lienQuestionnaire?: string;
  /** 0 = premier envoi ; 1, 2 = relance. */
  rang?: number;
}

const texte = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const rangDe = (v: unknown): number => (typeof v === "number" && v > 0 ? Math.floor(v) : 0);

export const recueilBesoinSubject = (_locale: Locale, payload: Record<string, unknown>): string => {
  const titre = texte(payload["titreFormation"]) || "votre projet de formation";
  return rangDe(payload["rang"]) > 0
    ? objetCompose("Rappel — quelques questions sur", titre)
    : objetCompose("Quelques questions pour préparer", titre);
};

export function RecueilBesoinEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as unknown as Payload;
  const nom = texte(p.destinataireNom);
  const titre = texte(p.titreFormation) || "votre projet de formation";
  const client = texte(p.clientNom);
  const lien = texte(p.lienQuestionnaire);
  const relance = rangDe(p.rang) > 0;
  return (
    <EmailLayout
      famille="C"
      preview={
        relance
          ? "Nous n'avons pas encore reçu vos réponses : quelques minutes suffisent."
          : "Quelques minutes pour nous dire ce que vous attendez de la formation."
      }
      title={relance ? "Vos réponses nous manquent" : "Préparons votre formation ensemble"}
      {...(lien ? { cta: { label: "Répondre au questionnaire", href: lien } } : {})}
      ctaSecret
      locale={locale}
    >
      <Text style={emailStyles.paragraphStyle}>{nom ? `Bonjour ${nom},` : "Bonjour,"}</Text>
      <Text style={emailStyles.paragraphStyle}>
        {relance
          ? `Nous n'avons pas encore reçu vos réponses pour « ${titre} »${client ? ` (${client})` : ""}.`
          : `Pour préparer « ${titre} »${client ? ` avec ${client}` : ""}, nous avons besoin de mieux connaître votre besoin : objectifs, participants, contraintes, financement.`}
      </Text>
      <Text style={emailStyles.paragraphStyle}>
        Le questionnaire se remplit en quelques minutes, sans compte. Vos réponses sont envoyées en
        une seule fois, à la fin. Rien n&apos;est facturé ni engagé à ce stade : le devis viendra
        après.
      </Text>
      <Text style={emailStyles.paragraphStyle}>
        Vos réponses servent uniquement à préparer cette formation. Vous pouvez les consulter ou
        demander leur effacement en écrivant à contact@axion-ia.com (RGPD).
      </Text>
      <Text style={emailStyles.paragraphStyle}>
        Ce lien est personnel à votre projet : merci de ne le transmettre qu&apos;à un collègue
        concerné.
      </Text>
    </EmailLayout>
  );
}
