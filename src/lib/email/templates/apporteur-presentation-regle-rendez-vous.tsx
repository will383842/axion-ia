// E-mail à l'APPORTEUR — une entreprise qu'il a présentée, encore en attente, passe à la règle du
// premier rendez-vous tenu (contrat 2.8, art. 13.5, clause transitoire). Émis par le passage
// quotidien (`etapeBasculeRegleRendezVous`), une fois par présentation.
//
// Court, factuel, vouvoiement, aucun montant ni promesse de résultat. PAS de `gabaritRepli`
// (AGENTS.md, lot S3) : aucun gabarit ancien n'est vrai pour ce message.
// Texte à relire par Will.

import { Text } from "@react-email/components";

import { objetCompose } from "../objet-email";
import { salutation } from "../salutation";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  contactName?: string;
  entreprise?: string;
  /** Dernier jour pour obtenir le rendez-vous, déjà formaté en heure de Paris. */
  dateLimite?: string;
}

interface Props {
  locale: Locale;
  payload: Record<string, unknown>;
}

function texte(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export const COPY_REGLE_RENDEZ_VOUS = {
  subject: (e: string) => objetCompose("Nouvelle règle :", e || "votre présentation"),
  title: "La règle de validation change pour cette entreprise",
  preview: "Elle est désormais validée au premier rendez-vous tenu.",
  corps: (e: string) =>
    `Votre présentation de ${e || "cette entreprise"} était en attente. Depuis l'acceptation de la version 2.8 de votre contrat, elle suit la règle du premier rendez-vous tenu (article 3.2) : elle est validée à votre nom dès qu'un premier rendez-vous avec Axion-IA a eu lieu.`,
  date: (d: string) =>
    d
      ? `Pour cela, ce rendez-vous doit être pris au plus tard le ${d}. Passé cette date sans rendez-vous pris, la réservation prend fin.`
      : "Pour cela, ce rendez-vous doit être pris dans les trente jours. Passé ce délai sans rendez-vous pris, la réservation prend fin.",
  fin: "Un rendez-vous déjà pris avec cette entreprise est à nous signaler en répondant à ce message.",
} as const;

export const apporteurPresentationRegleRendezVousSubject = (
  _locale: Locale,
  payload: Record<string, unknown> = {},
): string => COPY_REGLE_RENDEZ_VOUS.subject(texte((payload as Payload).entreprise));

export function ApporteurPresentationRegleRendezVousEmail({ locale, payload }: Props) {
  const p = payload as Payload;
  const prenom = texte(p.contactName).split(/\s+/)[0] ?? "";
  const t = COPY_REGLE_RENDEZ_VOUS;
  return (
    <EmailLayout
      famille="B"
      preview={t.preview}
      title={t.title}
      locale={locale === "fr" ? "fr" : "en"}
      sansReseauxSociaux
      signature="fondateur-court"
    >
      <Text style={emailStyles.paragraphStyle}>{salutation({ prenom }, "fr")}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.corps(texte(p.entreprise))}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.date(texte(p.dateLimite))}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.fin}</Text>
    </EmailLayout>
  );
}
