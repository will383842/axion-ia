/**
 * E-mail — RAPPEL D'ENTRETIEN à un candidat, J-1 puis H-1.
 *
 * ## Famille C, comme la réponse au candidat
 *
 * Ni réseaux sociaux, ni bandeau de confiance, ni demande d'avis. Un rappel
 * d'entretien est un message de service : il doit dire l'heure, le format et le
 * lieu, et rien d'autre. La soupape de réponse reste ouverte — c'est par elle
 * qu'un candidat prévient qu'il aura vingt minutes de retard.
 *
 * ## Ce qui distingue J-1 de H-1
 *
 * À J-1 on donne la DATE, parce que le message se lit la veille au milieu
 * d'autres. À H-1 on ne la donne pas : la répéter à une heure du rendez-vous
 * est du bruit, et l'heure seule est ce qu'on cherche.
 *
 * 🛑 Ce message ne mentionne aucun enregistrement, aucune transcription, aucun
 * résumé automatique — parce qu'il n'y en a pas. Ordre permanent.
 */

import { Text } from "@react-email/components";

import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  /** `j1` la veille, `h1` une heure avant. */
  moment: string;
  prenom: string;
  /** Intitulé du poste, rappelé en surtitre. */
  offerTitle: string;
  /** Heure de début, déjà formatée par l'appelant, en heure de Paris. */
  heure: string;
  /** Date de début, formatée. Fournie au J-1 seulement. */
  date?: string;
  dureeMinutes?: number;
  /** Lien de visioconférence, ou adresse. */
  lieu?: string;
  /** `telephone` | `visio` | `sur_site`. */
  format: string;
  /** Numéro de tour. Un second entretien le dit, un premier n'en parle pas. */
  tour?: number;
}

const FORMAT_FR: Record<string, string> = {
  telephone: "par téléphone",
  visio: "en visioconférence",
  sur_site: "sur place",
};

const FORMAT_EN: Record<string, string> = {
  telephone: "by phone",
  visio: "by video call",
  sur_site: "on site",
};

export const candidatureEntretienRappelSubject = (
  locale: Locale,
  payload: Record<string, unknown>,
): string => {
  const p = payload as unknown as Payload;
  const isEn = locale === "en";
  // 🔑 Objet borné : le référentiel donne 45 caractères visibles. « Entretien
  // demain à 14:30 » en fait 27, « Entretien dans 1 h — 14:30 » en fait 26.
  // Y ajouter l'intitulé du poste les ferait exploser, et c'est le surtitre
  // qui le porte.
  if (p.moment === "j1") {
    return isEn ? `Interview tomorrow at ${p.heure}` : `Entretien demain à ${p.heure}`;
  }
  return isEn ? `Interview in 1 h — ${p.heure}` : `Entretien dans 1 h — ${p.heure}`;
};

export function CandidatureEntretienRappelEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as unknown as Payload;
  const isEn = locale === "en";
  const format = (isEn ? FORMAT_EN : FORMAT_FR)[p.format] ?? "";
  const duree = p.dureeMinutes && p.dureeMinutes > 0 ? ` (${p.dureeMinutes} min)` : "";
  const estLien = typeof p.lieu === "string" && /^https?:\/\//i.test(p.lieu);

  // Le récapitulatif, d'un bloc : c'est ce que le destinataire cherche, et ce
  // que les résumés automatiques des messageries affichent dans la liste.
  const quand =
    p.moment === "j1" && p.date
      ? isEn
        ? `${p.date} at ${p.heure}${duree}, ${format}.`
        : `${p.date} à ${p.heure}${duree}, ${format}.`
      : isEn
        ? `Today at ${p.heure}${duree}, ${format}.`
        : `Aujourd'hui à ${p.heure}${duree}, ${format}.`;

  // 🔑 Pré-en-tête DISTINCT de l'objet (§3.5). L'objet dit quand ; le
  // pré-en-tête dit le format et le lieu — l'information qui décide d'ouvrir
  // quand on cherche son lien de connexion trois minutes avant.
  const preEnTete = isEn
    ? `${format}${p.lieu ? ` — ${estLien ? "your link is inside" : p.lieu}` : ""}`
    : `${format}${p.lieu ? ` — ${estLien ? "votre lien est dans le message" : p.lieu}` : ""}`;

  return (
    <EmailLayout
      famille="C"
      preview={preEnTete}
      title={
        p.moment === "j1"
          ? isEn
            ? "Your interview is tomorrow"
            : "Votre entretien, c'est demain"
          : isEn
            ? "Your interview is in one hour"
            : "Votre entretien est dans une heure"
      }
      locale={locale}
      eyebrow={
        p.tour && p.tour > 1
          ? `${p.offerTitle} · ${isEn ? "round" : "tour"} ${p.tour}`
          : p.offerTitle
      }
    >
      <Text style={{ ...emailStyles.paragraphStyle, fontWeight: 600 }}>{quand}</Text>

      {p.lieu ? (
        <Text style={emailStyles.paragraphStyle}>
          {estLien ? (
            <a
              href={p.lieu}
              style={{ color: emailStyles.COLORS.accent, textDecoration: "underline" }}
            >
              {isEn ? "Join the call" : "Rejoindre la visioconférence"}
            </a>
          ) : (
            p.lieu
          )}
        </Text>
      ) : null}

      <Text style={emailStyles.paragraphStyle}>
        {isEn
          ? `Hello ${p.prenom}, we look forward to speaking with you.`
          : `Bonjour ${p.prenom}, au plaisir d'échanger avec vous.`}
        <br />
        {/* La soupape, dite explicitement : un candidat qui aura du retard ne
            prévient que s'il sait qu'il peut répondre à ce message. */}
        {isEn
          ? "If anything changes — a delay, a conflict — simply reply to this message."
          : "Si quelque chose change — un retard, un imprévu — répondez simplement à ce message."}
      </Text>
    </EmailLayout>
  );
}
