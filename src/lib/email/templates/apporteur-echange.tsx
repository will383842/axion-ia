// E-mail — l'échange de 15 minutes avec un candidat apporteur : confirmation,
// rappel la veille, rappel une heure avant (2026-09-21).
//
// ── Le trou que ce gabarit ferme ──────────────────────────────────────────
// Un CLIENT qui réserve un appel reçoit trois messages sur notre charte
// (`appel-rappel.tsx`) : confirmation, J-1, H-1. Un candidat apporteur, lui,
// ne recevait RIEN : Calendly n'envoie qu'une INVITATION D'AGENDA (rappels et
// suivis par e-mail coupés, aucun workflow — relevé le 2026-09-21). Aucun
// doublon à craindre.
//
// ── 2026-10-07 — LA MÊME PRÉSENTATION QUE LES CLIENTS (décision de Will) ──
// « Le parcours apporteur doit avoir le même design que le parcours client. »
// Avant, ce gabarit rendait quatre paragraphes gris et renvoyait vers
// l'invitation d'agenda pour décaler — alors que la file lui passait déjà nos
// liens « déplacer » et « annuler » (`liensPourEmail`, `rappels-appel.ts`).
// Il reprend désormais les BRIQUES du gabarit client, importées et non
// recopiées (une seule vérité sur le canal, le lien et les liens de sortie) :
//   · confirmation (famille B) : le récapitulatif encadré EN PREMIER, puis la
//     salutation, « Ce qui se passe maintenant », déplacer/annuler en
//     secondaire ;
//   · J-1 et H-1 (famille C) : trois lignes, comme les clients ;
//   · aux trois moments, un bouton « Rejoindre la visioconférence » dès que
//     Calendly a créé le lien — sinon la phrase qui renvoie à l'invitation.
//
// Ce qui reste PROPRE au candidat : les mots (« votre échange », jamais
// « appel de découverte » ni « prospect »), le surtitre, et l'absence du guide
// IA entreprise (le candidat a son propre kit).
//
// Famille B sans la rangée sociale : même arbitrage que les autres e-mails du
// réseau (§5.4). Budget mesuré : logo, visio, déplacer, annuler, contact,
// opposition — le bouton réemploie le lien de visio, déjà compté.
//
// Vouvoiement : comme tout ce que reçoit un candidat (Will, 2026-09-29).

import { Button, Section, Text } from "@react-email/components";
import type { ReactElement } from "react";

import { EmailLayout, emailStyles } from "./_layout";
import {
  ActionsSecondaires,
  COMMUN,
  LigneLieu,
  RecapRendezVous,
  estUnLienDeReunion,
  formatDuRendezVous,
  type PayloadAppel,
} from "./appel-rappel";

type Locale = "fr" | "en";

/** Les trois moments, repris tels quels de la mécanique client. */
export type MomentEchange = "confirmation" | "j1" | "h1";

type Payload = Partial<PayloadAppel> & { moment?: MomentEchange };

const momentDe = (p: { moment?: MomentEchange }): MomentEchange => p.moment ?? "h1";

/** Une chaîne non vide, ou `null`. Aucune branche ne doit rendre « undefined ». */
const texteOuNull = (v: unknown): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
};

/**
 * « mardi 23 septembre à 11:30 », ou l'une des deux moitiés, ou rien.
 *
 * 🔴 CHAQUE MORCEAU EST FACULTATIF, ET LE RIEN EST UNE RÉPONSE : l'interpolation
 * naïve produit « le undefined à undefined », qui ne lève pas — il part.
 */
function quandTexte(locale: Locale, p: Payload, avecDate: boolean): string | null {
  const date = avecDate ? texteOuNull(p.date) : null;
  const heure = texteOuNull(p.heure);
  if (date && heure) return locale === "fr" ? date + " à " + heure : date + " at " + heure;
  if (heure) return locale === "fr" ? "à " + heure : "at " + heure;
  return date;
}

const COPY = {
  fr: {
    eyebrow: "Échange apporteur d'affaires",
    confirmation: {
      title: "C'est confirmé",
      preview:
        "Votre échange est confirmé. Les liens pour déplacer ou annuler sont dans le message.",
      deroule:
        "Nous faisons connaissance, nous vous expliquons simplement comment ça marche, et vous posez toutes vos questions. Aucun engagement : vous décidez après.",
      puces: [
        "L'invitation d'agenda vous parvient séparément, par Calendly. C'est le même rendez-vous — vous n'avez rien à confirmer.",
        "Nous vous écrivons la veille, puis une dernière fois une heure avant.",
        "Rien à préparer de votre côté.",
      ],
      signature: "À très vite,\nL'équipe Axion-IA",
    },
    j1: {
      title: "Votre échange a lieu demain",
      preview: "Rien à préparer. Un imprévu ? Le lien pour déplacer est dans le message.",
      quand: (h: string) => "Petit rappel : nous nous parlons demain à " + h + " (heure de Paris).",
      signature: "À demain,\nL'équipe Axion-IA",
    },
    h1: {
      title: "Votre échange a lieu dans une heure",
      preview: "Rien à préparer de votre côté. Le lien de connexion est dans le message.",
      quand: (h: string) => "Petit rappel : nous nous parlons à " + h + " (heure de Paris).",
      signature: "À tout à l'heure,\nL'équipe Axion-IA",
    },
    rienAPreparer:
      "Rien à préparer : vous posez vos questions, nous vous expliquons comment ça marche.",
    heureDefaut: "l'heure prévue",
    rejoindre: "Rejoindre la visioconférence",
    question: "Une question d'ici là ? Répondez simplement à cet e-mail.",
  },
  en: {
    eyebrow: "Referral partner call",
    confirmation: {
      title: "You're all set",
      preview: "Your call is confirmed. Links to reschedule or cancel are inside.",
      deroule:
        "We get to know each other, explain simply how it works, and you ask anything you like. No commitment: you decide afterwards.",
      puces: [
        "Your calendar invitation arrives separately, from Calendly. Same meeting — nothing for you to confirm.",
        "We write to you the day before, then once more an hour ahead.",
        "Nothing to prepare on your side.",
      ],
      signature: "Talk soon,\nThe Axion-IA team",
    },
    j1: {
      title: "Your call is tomorrow",
      preview: "Nothing to prepare. Something came up? Reschedule inside.",
      quand: (h: string) => "A quick reminder: we talk tomorrow at " + h + " (Paris time).",
      signature: "Talk tomorrow,\nThe Axion-IA team",
    },
    h1: {
      title: "Your call is in one hour",
      preview: "Nothing to prepare on your side. The joining link is inside.",
      quand: (h: string) => "A quick reminder: we talk at " + h + " (Paris time).",
      signature: "Talk soon,\nThe Axion-IA team",
    },
    rienAPreparer: "Nothing to prepare: you ask your questions, we explain how it works.",
    heureDefaut: "the agreed time",
    rejoindre: "Join the video call",
    question: "A question in the meantime? Just reply to this email.",
  },
} as const;

/**
 * L'objet du message.
 *
 * 🔑 Composé SEULEMENT s'il y a de quoi composer : sans horaire, « Demain à
 * undefined » serait conforme à la borne de longueur, et faux.
 */
export const apporteurEchangeSubject = (
  locale: Locale,
  payload: Record<string, unknown>,
): string => {
  const p = payload as unknown as Payload;
  const l: Locale = locale === "fr" ? "fr" : "en";
  const m = momentDe(p);
  const heure = texteOuNull(p.heure);
  if (l === "fr") {
    if (m === "confirmation") {
      const quand = quandTexte("fr", p, true);
      return quand ? "Échange confirmé : " + quand : "C'est noté, on se parle bientôt";
    }
    if (m === "j1") return heure ? "Rappel : notre échange demain à " + heure : "C'est demain";
    return heure ? "Notre échange dans une heure, à " + heure : "Dans une heure";
  }
  if (m === "confirmation") {
    const quand = quandTexte("en", p, true);
    return quand ? "Call confirmed: " + quand : "All set, talk soon";
  }
  if (m === "j1") return heure ? "Reminder: our call tomorrow at " + heure : "It is tomorrow";
  return heure ? "Our call in one hour, at " + heure : "In one hour";
};

/**
 * Le bouton « Rejoindre la visioconférence » — seulement quand le lien EXISTE.
 *
 * 🔴 Calendly crée la conférence de façon asynchrone : à la confirmation, le
 * lien manque souvent. Pas de lien, pas de bouton — la ligne de lieu renvoie
 * alors à l'invitation d'agenda, qui le portera.
 */
function BoutonRejoindre({ lien, label }: { lien: string | null; label: string }) {
  if (!lien || !estUnLienDeReunion(lien)) return null;
  return (
    <Section style={{ textAlign: "center", margin: "6px 0 22px 0" }}>
      <Button href={lien} style={emailStyles.ctaStyle} className="ax-cta">
        {label} &nbsp;→
      </Button>
    </Section>
  );
}

const titreBloc: React.CSSProperties = {
  margin: "0 0 10px 0",
  fontSize: "13px",
  lineHeight: 1.4,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  fontWeight: 700,
  color: emailStyles.COLORS.textMuted,
};
const puceTexte: React.CSSProperties = {
  fontSize: "15px",
  lineHeight: 1.6,
  color: emailStyles.COLORS.text,
  margin: "0 0 8px 0",
};

export function ApporteurEchangeEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}): ReactElement {
  const p = payload as unknown as Payload;
  const l: Locale = locale === "fr" ? "fr" : "en";
  const c = COPY[l];
  const commun = COMMUN[l];
  const m = momentDe(p);
  // Une seule dérivation du canal pour tout le rendu (`le-rappel-nomme-le-bon-canal`).
  const format = formatDuRendezVous(p);
  const lien = format === "visio" ? texteOuNull(p.lieu) : null;
  const prenom = texteOuNull(p.prenom) ?? "";
  // Les briques client lisent une charge complète ; la nôtre peut être partielle,
  // et chacune d'elles omet ce qui manque.
  const pc = p as PayloadAppel;

  // ── Famille B — la confirmation ────────────────────────────────────────────
  if (m === "confirmation") {
    const t = c.confirmation;
    return (
      <EmailLayout
        famille="B"
        sansReseauxSociaux
        locale={l}
        eyebrow={c.eyebrow}
        title={t.title}
        preview={t.preview}
      >
        {/* Le récapitulatif EN PREMIER : c'est ce que le destinataire cherche, et
            ce que les résumés des boîtes de réception affichent (§3.6). */}
        <RecapRendezVous locale={l} p={pc} format={format} c={commun} />
        <BoutonRejoindre lien={lien} label={c.rejoindre} />

        <Text style={emailStyles.paragraphStyle}>
          {commun.intro(prenom)}
          <br />
          {t.deroule}
        </Text>

        <Section style={{ margin: "26px 0 0 0" }}>
          <Text style={titreBloc}>{commun.maintenantTitre}</Text>
          {t.puces.map((puce) => (
            <Text key={puce} style={puceTexte}>
              <span style={{ color: emailStyles.COLORS.terracotta, fontWeight: 700 }}>•</span>{" "}
              {puce}
            </Text>
          ))}
        </Section>

        <ActionsSecondaires p={pc} c={commun} encadre />
        <Text style={emailStyles.paragraphStyle}>{c.question}</Text>
        <Text style={emailStyles.paragraphStyle}>{t.signature}</Text>
      </EmailLayout>
    );
  }

  // ── Famille C — les rappels J-1 et H-1 : trois lignes, comme les clients ────
  const t = c[m === "j1" ? "j1" : "h1"];
  const heure = texteOuNull(p.heure) ?? c.heureDefaut;
  return (
    <EmailLayout famille="C" locale={l} title={t.title} preview={t.preview}>
      <Text style={emailStyles.paragraphStyle}>{t.quand(heure)}</Text>
      {lien && estUnLienDeReunion(lien) ? (
        <BoutonRejoindre lien={lien} label={c.rejoindre} />
      ) : (
        <LigneLieu lieu={p.lieu} format={format} c={commun} />
      )}
      <Text style={emailStyles.paragraphStyle}>
        {commun.intro(prenom)}
        <br />
        {c.rienAPreparer}
      </Text>
      <ActionsSecondaires p={pc} c={commun} encadre={false} />
      <Text style={emailStyles.paragraphStyle}>{t.signature}</Text>
    </EmailLayout>
  );
}
