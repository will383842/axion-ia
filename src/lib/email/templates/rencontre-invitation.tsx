// Email — INVITATION à un rendez-vous créé dans la console (chantier visio,
// PR 4, 2026-09-29).
//
// ── Quand il part ─────────────────────────────────────────────────────────────
// Will crée un rendez-vous de VISIO sur la fiche d'un client (« Nouveau
// rendez-vous », deuxième ou troisième rendez-vous hors Calendly). Le message
// est PRÉPARÉ et garé dans « E-mails à valider » (`exigerValidation: true`) :
// Will le relit, l'envoie, ou l'écarte s'il a déjà écrit au client. Rien ne
// part sans lui (`features/dossier-client/actions-rencontres.ts`).
//
// ── La phrase sur l'enregistrement ────────────────────────────────────────────
// Elle n'apparaît que si `phraseEnregistrement` est vrai : quand la notice
// ANNONCE l'enregistrement (PR 8 du chantier), ou pour un rendez-vous de TEST
// (client fictif du pilote). Avant, elle promettrait au client un traitement
// que la politique de confidentialité ne décrit pas encore.
//
// ── Ce qu'il ne dit jamais ────────────────────────────────────────────────────
// Aucun numéro de téléphone (ordre permanent du 23/09), aucun prix. Texte
// français seulement : c'est un texte lu par un client, validé par Will.

import { Link, Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  /** Titre du rendez-vous. */
  titre?: string;
  /** Début, ISO 8601. */
  debutIso?: string;
  /** Durée en minutes. */
  dureeMin?: number;
  /** Lien de la visio (https). */
  lienVisio?: string | null;
  /** La phrase d'information sur l'enregistrement est-elle due ? */
  phraseEnregistrement?: boolean;
}

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";
const URL_POLITIQUE = `${SITE}/fr/politique-confidentialite`;

/** « vendredi 3 octobre à 10 h 30 », à l'heure de Paris ; `null` si illisible. */
export function quandLisible(debutIso: string | undefined): string | null {
  if (!debutIso) return null;
  const d = new Date(debutIso);
  if (Number.isNaN(d.getTime())) return null;
  const jour = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Paris",
  }).format(d);
  const heure = new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  })
    .format(d)
    .replace(":", " h ");
  return `${jour} à ${heure}`;
}

export const rencontreInvitationSubject = (_locale: Locale, p: Record<string, unknown>): string => {
  const quand = quandLisible(typeof p["debutIso"] === "string" ? p["debutIso"] : undefined);
  return quand ? `Notre visio du ${quand.split(" à ")[0]}` : "Notre prochaine visio";
};

export function RencontreInvitationEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as unknown as Payload;
  const quand = quandLisible(p.debutIso);
  const lien =
    typeof p.lienVisio === "string" && p.lienVisio.startsWith("https://") ? p.lienVisio : null;
  const duree = typeof p.dureeMin === "number" && p.dureeMin > 0 ? p.dureeMin : null;

  return (
    <EmailLayout
      famille="C"
      preview={
        quand
          ? `Le ${quand}${duree ? `, ${duree} minutes` : ""} — le lien est dans ce message.`
          : "La date et le lien de notre prochain échange."
      }
      title="Notre prochain échange en visio"
      locale={locale}
    >
      <Text style={emailStyles.paragraphStyle}>
        {quand ? (
          <>
            Notre rendez-vous est prévu le <strong>{quand}</strong>
            {duree ? ` (${duree} minutes)` : ""}, en visioconférence Google Meet.
          </>
        ) : (
          <>Notre prochain rendez-vous se tiendra en visioconférence Google Meet.</>
        )}
      </Text>

      {lien ? (
        <Text style={emailStyles.paragraphStyle}>
          Pour nous rejoindre :{" "}
          <Link href={lien} style={{ color: emailStyles.COLORS.accent }}>
            ouvrir la visio
          </Link>
          .
        </Text>
      ) : (
        <Text style={emailStyles.paragraphStyle}>
          Le lien de la visio vous sera envoyé avant le rendez-vous.
        </Text>
      )}

      {p.phraseEnregistrement === true ? (
        <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
          Si vous en êtes d&apos;accord, le son de la visio peut être enregistré pour que nous en
          tirions un compte rendu : votre accord vous est demandé à voix haute au début, et vous
          pouvez refuser. Détails dans notre{" "}
          <Link href={URL_POLITIQUE} style={{ color: emailStyles.COLORS.textMuted }}>
            politique de confidentialité
          </Link>
          .
        </Text>
      ) : null}

      <Text style={emailStyles.paragraphStyle}>
        Un empêchement ? Répondez simplement à ce message et nous trouverons un autre moment.
      </Text>
    </EmailLayout>
  );
}
