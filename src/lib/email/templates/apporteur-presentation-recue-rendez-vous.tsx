// E-mail — l'accusé envoyé à l'APPORTEUR après la saisie d'une entreprise, variante
// « validation par rendez-vous » (lot 7a, 2026-11-25). BRANCHÉ (lot 7b) : émis par
// `presentations.ts` (`construireEnvoisReponse`) seulement quand `regleDe` vaut `rendez_vous`
// (interrupteur `APPORTEURS_VALIDATION_RDV` allumé ET contrat signé ≥ 2.8). Sans `gabaritRepli`
// (voir `interrupteur-rendez-vous.ts`).
//
// L'accusé EN SERVICE (`apporteur-presentation-recue`, dans `apporteur-demarrage.tsx`,
// contrat 2.6 : attribution par le silence, « 30 jours ») reste intact.
//
// ── La règle que ce message dit ───────────────────────────────────────────
//   · l'entreprise est gardée à l'apporteur 60 jours à compter de la saisie ;
//   · elle est validée au premier rendez-vous qui a eu lieu, s'il a été PRIS pendant ces
//     60 jours ; un devis signé pendant ces 60 jours compte aussi ;
//   · les 6 mois partent du jour du rendez-vous ;
//   · sans rendez-vous pris en 60 jours, la réservation s'arrête, sans reproche, et
//     l'entreprise peut être présentée de nouveau après un nouveau contact ;
//   · une commission n'est due que sur une commande payée.
//
// ── Vocabulaire (anti-requalification, comme `apporteur-demarrage.tsx`) ───
// Aucun chiffre de commission, aucune promesse de résultat, aucune obligation de nombre de
// présentations ou de rendez-vous : l'apporteur n'a aucune obligation d'activité.
//
// Même châssis que l'accusé en service : famille B, sans rangée sociale, vouvoiement,
// signature courte du fondateur.

import { Text } from "@react-email/components";

import { EmailLayout, emailStyles } from "./_layout";
import { RESERVATION_PROVISOIRE_JOURS } from "@/features/apporteurs-reseau/regle-attribution";
import { salutation } from "../salutation";
import { FENETRE_ATTRIBUTION_APPORTEUR_MOIS } from "@/lib/commercial-application/kit-apporteur";
import type { Locale } from "../../../../prisma/generated/client";

/** Durée pendant laquelle l'entreprise est gardée à l'apporteur : celle du moteur des règles. */
export const RESERVATION_RENDEZ_VOUS_JOURS = RESERVATION_PROVISOIRE_JOURS;

interface Payload {
  /** L'apporteur : son prénom, ou à défaut le premier mot de `contactName`. */
  prenom?: string;
  contactName?: string;
  /** Entreprise présentée, telle que saisie. */
  entreprise?: string;
  /** Dernier jour de la réservation, déjà formaté en heure de Paris : « 24 janvier 2027 ». */
  dateFinReservation?: string;
}

interface Props {
  locale: Locale;
  payload: Record<string, unknown>;
}

function texteOuNull(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
}

export const COPY_PRESENTATION_RECUE_RENDEZ_VOUS = {
  subject: (e: string, jours: number) =>
    e
      ? `${e} : elle vous est gardée ${jours} jours`
      : `L'entreprise vous est gardée ${jours} jours`,
  title: "Bien reçu : elle vous est gardée",
  preview: "Ce qui la valide sur votre compte, et ce qui se passe ensuite.",
  recu: (e: string, jours: number, date: string | null) =>
    `Nous avons bien reçu votre présentation de ${e || "l'entreprise"} : elle vous est gardée ${jours} jours${date ? `, jusqu'au ${date}` : " à compter de votre saisie"}.`,
  suiteTitre: "La suite",
  validation: (date: string | null, jours: number, mois: number) =>
    `Elle sera validée sur votre compte dès qu'un premier rendez-vous avec Axion-IA aura eu lieu, s'il a été pris ${date ? "jusqu'à cette date incluse" : `pendant ces ${jours} jours`}. Les ${mois} mois pendant lesquels elle vous est rattachée partent alors du jour de ce rendez-vous.`,
  devis: (jours: number) => `Un devis signé pendant ces ${jours} jours compte aussi.`,
  sansRendezVous:
    "Sans rendez-vous pris d'ici là, la réservation s'arrête, sans aucun reproche : vous pourrez nous présenter de nouveau cette entreprise plus tard, après un nouveau contact avec elle.",
  commission: "Une commission n'est due que sur une commande payée.",
} as const;

export const apporteurPresentationRecueRendezVousSubject = (
  _locale: Locale,
  payload?: Record<string, unknown>,
): string =>
  COPY_PRESENTATION_RECUE_RENDEZ_VOUS.subject(
    texteOuNull((payload as Payload | undefined)?.entreprise) ?? "",
    RESERVATION_RENDEZ_VOUS_JOURS,
  );

export function ApporteurPresentationRecueRendezVousEmail({ locale, payload }: Props) {
  const p = payload as Payload;
  const t = COPY_PRESENTATION_RECUE_RENDEZ_VOUS;
  const prenom = texteOuNull(p.prenom) ?? (texteOuNull(p.contactName) ?? "").split(/\s+/)[0];
  const date = texteOuNull(p.dateFinReservation);
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
      <Text style={emailStyles.paragraphStyle}>
        {t.recu(texteOuNull(p.entreprise) ?? "", RESERVATION_RENDEZ_VOUS_JOURS, date)}
      </Text>
      <Text style={{ ...emailStyles.paragraphStyle, fontWeight: 700, margin: "20px 0 8px" }}>
        {t.suiteTitre}
      </Text>
      <Text style={emailStyles.paragraphStyle}>
        {t.validation(date, RESERVATION_RENDEZ_VOUS_JOURS, FENETRE_ATTRIBUTION_APPORTEUR_MOIS)}
      </Text>
      <Text style={emailStyles.paragraphStyle}>{t.devis(RESERVATION_RENDEZ_VOUS_JOURS)}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.sansRendezVous}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.commission}</Text>
    </EmailLayout>
  );
}
