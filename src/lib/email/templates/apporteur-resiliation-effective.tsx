// E-mail à l'APPORTEUR — le jour où la résiliation de son contrat PREND EFFET
// (contrat 2.6, articles 11 et 12 ; plan « sept points », lot L1a).
//
// ⛔ Livré SANS ÉMETTEUR : aucun code n'enfile ce gabarit avant le lot L1b.
//
// Rappelle seulement ce que le contrat prévoit : les commandes signées avant la date d'effet
// restent commissionnées, les commissions acquises sont versées. Si de l'argent est en jeu
// (`argentEnJeu`), la charge peut encore porter un lien, mais le gabarit NE L'AFFICHE PAS :
// le lien de l'espace est coupé à la fin du contrat (article 12.3, non modifié ici).
// Notification, rien d'autre : aucune invitation à agir.

import { Text } from "@react-email/components";

import { salutation } from "../salutation";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  prenom?: string;
  /** Date de prise d'effet, déjà formatée (heure de Paris). */
  effetLe?: string;
  /** Vrai si une commission reste à facturer ou à verser. */
  argentEnJeu?: boolean;
  /** Lien de l'espace en mode restreint ; lu seulement si `argentEnJeu`. */
  lien?: string;
}

export const COPY_RESILIATION_EFFECTIVE = {
  subject: "Fin de votre contrat d'apporteur",
  title: "Fin de votre contrat d'apporteur d'affaires",
  preview: "La résiliation de votre contrat prend effet aujourd'hui.",
  effet: (d: string) =>
    d
      ? `La résiliation de votre contrat d'apporteur d'affaires, qui vous a été notifiée, prend effet ce jour (${d}).`
      : "La résiliation de votre contrat d'apporteur d'affaires, qui vous a été notifiée, prend effet ce jour.",
  commissions:
    "Les commandes signées avant cette date par les entreprises qui vous sont attribuées ou réservées restent commissionnées (article 12.3), et vos commissions acquises vous sont facturées et versées normalement (article 12.2).",
  espace: "Votre accès à l'espace prend fin avec votre contrat.",
  fin: "Nous vous remercions de votre collaboration.",
} as const;

export const apporteurResiliationEffectiveSubject = (): string =>
  COPY_RESILIATION_EFFECTIVE.subject;

export function ApporteurResiliationEffectiveEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as Payload;
  const prenom = typeof p.prenom === "string" ? (p.prenom.trim().split(/\s+/)[0] ?? "") : "";
  const effet = typeof p.effetLe === "string" ? p.effetLe.trim() : "";
  return (
    <EmailLayout
      famille="B"
      preview={COPY_RESILIATION_EFFECTIVE.preview}
      title={COPY_RESILIATION_EFFECTIVE.title}
      locale={locale === "fr" ? "fr" : "en"}
      sansReseauxSociaux
      signature="fondateur-court"
    >
      <Text style={emailStyles.paragraphStyle}>
        {`${salutation({ prenom }, locale)} ${COPY_RESILIATION_EFFECTIVE.effet(effet)}`}
      </Text>
      <Text style={emailStyles.paragraphStyle}>{COPY_RESILIATION_EFFECTIVE.commissions}</Text>
      <Text style={emailStyles.paragraphStyle}>{COPY_RESILIATION_EFFECTIVE.espace}</Text>
      <Text style={emailStyles.paragraphStyle}>{COPY_RESILIATION_EFFECTIVE.fin}</Text>
    </EmailLayout>
  );
}
