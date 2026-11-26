// E-mail à l'APPORTEUR — la résiliation de son contrat lui est NOTIFIÉE par écrit
// (contrat 2.6, article 11 ; plan « sept points », lot L1a).
//
// ⛔ Livré SANS ÉMETTEUR : aucun code n'enfile ce gabarit avant le lot L1b. Le nom est connu du
// worker avant son premier émetteur (AGENTS.md, fenêtre app ↔ worker).
//
// Quatre fondements, un seul gabarit :
//   · `11.1-societe`   — la Société résilie avec préavis de 30 jours ; AUCUN motif (l'article 11.1
//                        dispense de motiver) : un motif présent dans la charge est ignoré ;
//   · `11.1-apporteur` — accusé de réception de la résiliation écrite de l'apporteur ;
//   · `11.2`           — décision motivée, après mise en demeure, sans préavis ;
//   · `12.5`           — fin de plein droit (cessation, radiation, décès), sans préavis.
//
// CHARGE INCOMPLÈTE : le rendu ne se replie JAMAIS sur `11.1-societe` (il annoncerait un préavis de
// 30 jours pour une résiliation immédiate). Fondement inconnu ou absent → phrase neutre, sans préavis
// ni date ; date d'effet absente → aucune date annoncée. Les gardes du dépôt rendent tous les
// gabarits avec une charge vide : l'ÉCHEC FRANC est donc dans `validerChargeResiliation`, que
// l'émetteur de L1b DOIT appeler avant d'enfiler (rien ne part si elle lève). L1b : le 11.2 exige une décision motivée (article 11.2) ; le refus d'un 11.2 sans
// motif se fait à l'émission, pas ici. Fin de plein droit par décès : l'émetteur de L1b doit
// trancher QUI reçoit l'e-mail (ayants droit ou mandataire), le gabarit salue le prénom de la charge.
//
// Notification d'une décision, rien d'autre : aucune invitation à agir, aucun chiffre d'activité.
// Salutation par le prénom seul.

import { Text } from "@react-email/components";

import { salutation } from "../salutation";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

export type FondementResiliation = "11.1-societe" | "11.1-apporteur" | "11.2" | "12.5";

interface Payload {
  prenom?: string;
  fondement?: FondementResiliation;
  /** Date de la notification écrite, déjà formatée (heure de Paris) : « 25 novembre 2026 ». */
  notifieeLe?: string;
  /** Date de prise d'effet, déjà formatée. */
  effetLe?: string;
  /** 11.2 : date de la mise en demeure, déjà formatée. */
  miseEnDemeureLe?: string;
  /** 11.2 et 12.5 seulement. Jamais rendu pour 11.1. */
  motif?: string;
}

function texte(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function fondementDe(p: Payload): FondementResiliation | null {
  const f = p.fondement;
  return f === "11.1-societe" || f === "11.1-apporteur" || f === "11.2" || f === "12.5" ? f : null;
}

/**
 * Garde d'ÉMISSION (L1b) : lève si le fondement est inconnu ou si la date d'effet manque. Le
 * 11.1 Apporteur doit indiquer la date de fin du contrat (article 11.1) ; le 11.1 Société ne peut
 * pas renvoyer à « notre notification », elle est cet e-mail.
 */
export function validerChargeResiliation(payload: Record<string, unknown>): void {
  const p = payload as Payload;
  if (fondementDe(p) === null) {
    throw new Error("apporteur-resiliation-notifiee : fondement inconnu ou absent");
  }
  if (!texte(p.effetLe)) throw new Error("apporteur-resiliation-notifiee : effetLe absent");
}

/** « le 25 décembre 2026 » ; vide si la date manque (la phrase de date est alors omise). */
function leDate(d: string): string {
  return d ? `le ${d}` : "";
}
const effetPrevu = (d: string): string => (d ? ` Elle prendra effet ${leDate(d)}.` : "");

export const COPY_RESILIATION_NOTIFIEE = {
  subject: "Résiliation de votre contrat d'apporteur",
  subjectApporteur: "Votre résiliation est enregistrée",
  title: "Résiliation de votre contrat d'apporteur d'affaires",
  subjectFin: "Fin de votre contrat d'apporteur",
  titleFin: "Fin de votre contrat d'apporteur d'affaires",
  preview: "Nous vous notifions la résiliation de votre contrat.",
  societe: (effet: string) =>
    `Nous vous notifions la résiliation de votre contrat d'apporteur d'affaires, conformément à son article 11.1.${effetPrevu(effet)} Jusqu'à la veille de cette date au soir, vous pouvez continuer à nous présenter des entreprises.`,
  apporteur: (notifiee: string, effet: string) =>
    `Nous accusons réception de votre résiliation écrite${notifiee ? ` du ${notifiee}` : ""}, conformément à l'article 11.1 de votre contrat.${effetPrevu(effet)} Jusqu'à la veille de cette date au soir, vous pouvez continuer à nous présenter des entreprises.`,
  inexecution: (effet: string, miseEnDemeure: string) =>
    `Nous vous notifions la résiliation de votre contrat d'apporteur d'affaires, conformément à son article 11.2${
      miseEnDemeure ? `, après notre mise en demeure du ${miseEnDemeure}` : ""
    }.${effet ? ` Elle prend effet ${leDate(effet)}, sans préavis.` : " Elle prend effet sans préavis."}`,
  finDePleinDroit: (effet: string) =>
    `Votre contrat d'apporteur d'affaires a pris fin de plein droit, conformément à son article 12.5. La fin du contrat est constatée${effet ? ` ${leDate(effet)}` : ""}, sans préavis.`,
  neutre: "Nous vous notifions la fin de votre contrat d'apporteur d'affaires.",
  motif: (m: string) => `Motif de cette décision : ${m}`,
  cause: (m: string) => `Cause constatée : ${m}`,
  commissions:
    "Les commandes signées avant cette date par les entreprises qui vous sont attribuées ou réservées restent commissionnées (article 12.3), et vos commissions acquises vous seront facturées et versées normalement (article 12.2).",
  commissionsFin:
    "Les commandes signées avant cette date par les entreprises qui vous sont attribuées ou réservées restent commissionnées (article 12.3). Vos commissions acquises sont versées à vous, à vos ayants droit ou à votre mandataire, sur justification de leur qualité et de coordonnées bancaires à leur nom (article 12.5).",
} as const;

export const apporteurResiliationNotifieeSubject = (
  _locale: Locale,
  payload: Record<string, unknown> = {},
): string => {
  const f = fondementDe(payload as Payload);
  return f === "11.1-apporteur"
    ? COPY_RESILIATION_NOTIFIEE.subjectApporteur
    : f === "12.5"
      ? COPY_RESILIATION_NOTIFIEE.subjectFin
      : COPY_RESILIATION_NOTIFIEE.subject;
};

export function ApporteurResiliationNotifieeEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as Payload;
  const f = fondementDe(p);
  const prenom = texte(p.prenom).split(/\s+/)[0] ?? "";
  const effet = texte(p.effetLe);
  const motif = texte(p.motif);
  const corps =
    f === "11.1-apporteur"
      ? COPY_RESILIATION_NOTIFIEE.apporteur(texte(p.notifieeLe), effet)
      : f === "11.2"
        ? COPY_RESILIATION_NOTIFIEE.inexecution(effet, texte(p.miseEnDemeureLe))
        : f === "12.5"
          ? COPY_RESILIATION_NOTIFIEE.finDePleinDroit(effet)
          : f === "11.1-societe"
            ? COPY_RESILIATION_NOTIFIEE.societe(effet)
            : COPY_RESILIATION_NOTIFIEE.neutre;
  // Le motif n'existe que pour 11.2 et 12.5 : l'article 11.1 dispense de motiver.
  const motifRendu = (f === "11.2" || f === "12.5") && motif;
  return (
    <EmailLayout
      famille="B"
      preview={COPY_RESILIATION_NOTIFIEE.preview}
      title={f === "12.5" ? COPY_RESILIATION_NOTIFIEE.titleFin : COPY_RESILIATION_NOTIFIEE.title}
      locale={locale === "fr" ? "fr" : "en"}
      sansReseauxSociaux
      signature="fondateur-court"
    >
      <Text style={emailStyles.paragraphStyle}>{`${salutation({ prenom }, locale)} ${corps}`}</Text>
      {motifRendu ? (
        <Text style={emailStyles.paragraphStyle}>
          {f === "12.5"
            ? COPY_RESILIATION_NOTIFIEE.cause(motifRendu)
            : COPY_RESILIATION_NOTIFIEE.motif(motifRendu)}
        </Text>
      ) : null}
      <Text style={emailStyles.paragraphStyle}>
        {f === "12.5"
          ? COPY_RESILIATION_NOTIFIEE.commissionsFin
          : COPY_RESILIATION_NOTIFIEE.commissions}
      </Text>
    </EmailLayout>
  );
}
