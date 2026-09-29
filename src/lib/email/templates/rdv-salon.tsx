// E-mail — la rencontre réservée sur un SALON (GOFAB, 13/10/2026) :
// confirmation, rappel J-2, rappel J-1 (2026-09-29).
//
// ── Pourquoi un gabarit à part ─────────────────────────────────────────────
// Les messages « appel de découverte » (`appel-rappel.tsx`) parlent d'un lien
// de visio ou d'un numéro de téléphone. Une rencontre sur un salon se fait EN
// PERSONNE : ce qu'il faut dire, c'est OÙ venir et comment trouver l'endroit
// une fois sur place. Le CANAL est mutualisé (`rappels-appel.ts` porte les
// horloges, l'idempotence et le plafond) ; les MOTS ne le sont pas.
//
// ── Ce que chaque message porte, aux trois moments ─────────────────────────
//   · la date et l'heure, la durée réelle (dérivée des bornes Calendly) ;
//   · le lieu et l'accès sur place (« espace affaires, espace Lyon Pacte PME
//     AURA » — décision de Will le 29/09 : pas de plan, cette phrase suffit) ;
//   · déplacer / annuler, pour libérer le créneau ;
//   · un échange en visio pour qui ne peut finalement pas venir.
//
// Famille B sans la rangée sociale : budget de liens (§5.4) réservé à l'action.
// Vouvoiement. Aucun numéro de téléphone (règle permanente de Will).

import { Link, Section, Text } from "@react-email/components";
import type { ReactElement } from "react";

import { EmailLayout, emailStyles } from "./_layout";

type Locale = "fr" | "en";

/** Les trois moments d'une rencontre salon. Pas de H-1 : la personne est déjà en route. */
export type MomentSalon = "confirmation" | "j2" | "j1";

/** Les salons connus : le lieu et l'accès ne se déduisent pas du texte libre de Calendly. */
const SALONS = {
  gofab: {
    nom: "salon GOFAB",
    lieu: "Arena Saint-Étienne Métropole, 1 rue André Jeantet, 42400 Saint-Chamond",
    acces:
      "Une fois dans l'Arena, rendez-vous dans l'espace affaires, sur l'espace Lyon Pacte PME AURA.",
    entree: "L'entrée visiteur est gratuite, sur inscription : ",
    urlInscription: "https://www.gofab.fr",
  },
} as const;

/** L'échange en visio proposé à qui ne peut finalement pas venir. */
const URL_VISIO = "https://calendly.com/axion-ia/premier-contact";

interface Payload {
  prenom?: string;
  heure?: string;
  date?: string;
  dureeMinutes?: number;
  /** Le lieu tel que saisi dans Calendly — repli quand le salon n'est pas reconnu. */
  lieu?: string;
  salon?: keyof typeof SALONS | null;
  cancelUrl?: string;
  rescheduleUrl?: string;
  moment?: MomentSalon;
}

const momentDe = (p: { moment?: MomentSalon }): MomentSalon => p.moment ?? "j1";

const texteOuNull = (v: unknown): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
};

const urlOuNull = (v: unknown): string | null => {
  const s = texteOuNull(v);
  return s && /^https?:\/\//i.test(s) ? s : null;
};

/** « mardi 13 octobre à 10:20 », ou l'une des deux moitiés, ou rien — jamais « undefined ». */
function quandTexte(p: Payload, avecDate: boolean): string | null {
  const date = avecDate ? texteOuNull(p.date) : null;
  const heure = texteOuNull(p.heure);
  if (date && heure) return date + " à " + heure;
  if (heure) return "à " + heure;
  return date;
}

const dureeTexte = (m?: number): string =>
  typeof m === "number" && m > 0 ? String(m) + " minutes" : "20 minutes";

const salonDe = (p: Payload) => (p.salon && p.salon in SALONS ? SALONS[p.salon] : null);

const COPY = {
  confirmation: {
    title: "Notre rendez-vous au salon est confirmé",
    preview: "Votre rendez-vous avec Axion IA est confirmé. Voici où nous retrouver.",
    corps: (quand: string | null, duree: string, nom: string) =>
      "Votre rendez-vous de " +
      duree +
      " avec Axion IA est confirmé" +
      (quand ? ", " + quand : "") +
      ", au " +
      nom +
      ". Nous partirons de vos besoins et de votre quotidien pour voir ce que l'intelligence artificielle peut concrètement apporter à votre entreprise.",
    apres: "Au plaisir de vous rencontrer.",
  },
  j2: {
    title: "Rendez-vous après-demain au salon",
    preview: "Petit rappel : nous nous retrouvons après-demain au salon.",
    corps: (quand: string | null, duree: string, nom: string) =>
      "Petit rappel : nous nous retrouvons après-demain" +
      (quand ? ", " + quand : "") +
      ", au " +
      nom +
      ", pour " +
      duree +
      ".",
    apres: null,
  },
  j1: {
    title: "C'est demain au salon",
    preview: "Rappel : notre rendez-vous au salon a lieu demain.",
    corps: (quand: string | null, duree: string, nom: string) =>
      "Rappel : notre rendez-vous de " +
      duree +
      " a lieu demain" +
      (quand ? " " + quand : "") +
      ", au " +
      nom +
      ".",
    apres: null,
  },
} as const;

// Objet ≤ 45 caractères (§3.4) : le salon ne dure qu'une journée, l'heure suffit.
export const rdvSalonSubject = (_locale: Locale, payload: Record<string, unknown>): string => {
  const p = payload as unknown as Payload;
  const m = momentDe(p);
  const nom = salonDe(p)?.nom ?? "salon";
  const heure = texteOuNull(p.heure);
  if (m === "confirmation") {
    return heure ? "Rendez-vous confirmé au " + nom + " à " + heure : COPY.confirmation.title;
  }
  if (m === "j2") {
    return heure ? "Après-demain à " + heure + ", au " + nom : COPY.j2.title;
  }
  return heure ? "Demain à " + heure + " : rendez-vous au " + nom : COPY.j1.title;
};

export function RdvSalonEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}): ReactElement {
  const p = payload as unknown as Payload;
  const m = momentDe(p);
  const bloc = COPY[m];
  const salon = salonDe(p);
  const nom = salon?.nom ?? "salon";
  const quand = quandTexte(p, m !== "j1");
  const lieu = salon?.lieu ?? texteOuNull(p.lieu);
  const annuler = urlOuNull(p.cancelUrl);
  const deplacer = urlOuNull(p.rescheduleUrl);
  const intro = texteOuNull(p.prenom) ? "Bonjour " + texteOuNull(p.prenom) + "," : "Bonjour,";

  return (
    <EmailLayout
      famille="B"
      sansReseauxSociaux
      locale={locale === "fr" ? "fr" : "en"}
      title={bloc.title}
      preview={bloc.preview}
    >
      <Text style={emailStyles.paragraphStyle}>{intro}</Text>
      <Text style={emailStyles.paragraphStyle}>
        {bloc.corps(quand, dureeTexte(p.dureeMinutes), nom)}
      </Text>

      <Section>
        <Text style={{ ...emailStyles.paragraphStyle, fontWeight: "bold", marginBottom: "4px" }}>
          Où nous retrouver
        </Text>
        {lieu ? (
          <Text style={{ ...emailStyles.paragraphStyle, marginTop: "0" }}>{lieu}</Text>
        ) : null}
        {salon ? <Text style={emailStyles.paragraphStyle}>{salon.acces}</Text> : null}
        {salon && m !== "j1" ? (
          <Text style={emailStyles.paragraphStyle}>
            {salon.entree}
            <Link href={salon.urlInscription}>gofab.fr</Link>
          </Text>
        ) : null}
      </Section>

      {bloc.apres ? <Text style={emailStyles.paragraphStyle}>{bloc.apres}</Text> : null}

      {/*
        Déplacer / annuler : toujours proposés, aux trois moments. Un créneau
        annulé se libère pour quelqu'un d'autre ; quelqu'un qui ne peut pas se
        décommander ne prévient pas — il ne vient pas.
      */}
      <Text style={emailStyles.paragraphStyle}>
        Un imprévu ? {deplacer ? <Link href={deplacer}>Déplacer ce rendez-vous</Link> : null}
        {deplacer && annuler ? " ou " : null}
        {annuler ? <Link href={annuler}>l&apos;annuler</Link> : null}
        {!deplacer && !annuler
          ? "Vous pouvez déplacer ou annuler ce rendez-vous depuis l'invitation d'agenda reçue à la réservation"
          : null}
        .
      </Text>
      <Text style={emailStyles.paragraphStyle}>
        Vous ne pouvez finalement pas venir au salon ?{" "}
        <Link href={URL_VISIO}>Réservez plutôt un échange en visio</Link>.
      </Text>
      <Text style={emailStyles.paragraphStyle}>
        Une question d&apos;ici là ? Répondez simplement à cet e-mail.
      </Text>
    </EmailLayout>
  );
}
