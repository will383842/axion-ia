// E-mails à l'APPORTEUR — changement du compte bancaire de versement des commissions.
// Plan : docs/plans/apporteurs-changement-iban-2026-11-25.md (lot 2 ; textes : section 12.3).
//
// ⛔ Livré SANS ÉMETTEUR : aucun code n'enfile ces cinq gabarits avant le lot 4.
//
// Règles (plan, section 6.1) :
//  - JAMAIS d'IBAN entier : la charge porte seulement la fin du compte, et le gabarit la
//    ramène lui-même aux 4 derniers caractères (même si un IBAN entier arrive par erreur) ;
//  - aucun lien personnel de l'espace (`/apporteur/dossier/<id>/<jeton>`) : les liens de
//    l'e-mail 1 pointent vers `/apporteur/dossier/compte/<idDemande>/<signature>` ;
//  - aucun gabarit de repli (champ de reprise de la charge), et c'est voulu : voir la section 6.1 du plan (un repli neutre
//    redonnerait le lien personnel, ou dirait faux). Verrouillé par `apporteur-compte.spec.tsx`.

import { Link, Text } from "@react-email/components";

import { salutation } from "../salutation";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  prenom?: string;
  /** Fin du compte NEUF (4 derniers caractères ; tout le reste est coupé). */
  nouveauFin?: string;
  /** Fin du compte ACTUEL / ANCIEN (idem). */
  ancienFin?: string;
  /** E-mail 3 : date d'effet, déjà formatée (heure de Paris). */
  effetLe?: string;
  /** E-mail 4 : motif écrit par l'administrateur. */
  motif?: string;
  /** E-mail 1 : liens signés de la demande (jamais le lien personnel). */
  lienConfirmer?: string;
  lienBloquer?: string;
}

const IBAN_GLOBAL = /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){2,7}(?:\s?[A-Z0-9]{1,4})?\b/g;
const LIEN_PERSONNEL =
  /\/apporteur\/dossier\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:[/?#]|$)/i;

export const COPY_COMPTE = {
  aConfirmer: {
    subject: "Confirmez votre changement de compte bancaire",
    title: "Confirmez votre changement de compte bancaire",
    preview: "Confirmez votre demande de changement de compte.",
    demande: "Vous avez demandé à changer le compte sur lequel nous versons vos commissions.",
    nouveau: (fin: string) => `Nouveau compte : il se termine par ${fin}.`,
    pourConfirmer: "Pour confirmer, cliquez ici :",
    confirmer: "Je confirme",
    duree: "Ce bouton fonctionne pendant 24 heures.",
    ensuite:
      "Ensuite, nous vérifions votre RIB et nous vous appelons. Cela prend au moins 3 jours.",
    attente:
      "En attendant, vos virements sont en attente de la décision ; vos commissions continuent d'être enregistrées.",
    pasVous: "Ce n'est pas vous ?",
    bloquerIntro: "Cliquez ici :",
    bloquer: "Bloquer cette demande",
    inchange: "Votre compte ne changera pas.",
    jamais: "Nous ne vous demanderons jamais votre IBAN par e-mail ou par téléphone.",
  },
  bloquee: {
    subject: "La demande de changement de compte est bloquée",
    title: "La demande de changement de compte est bloquée",
    preview: "Nous avons annulé la demande. Votre compte n'a pas changé.",
    dit: "Vous nous avez dit que vous n'aviez pas demandé à changer de compte.",
    annule: "Nous avons annulé cette demande. Votre compte n'a pas changé.",
    lien: "Par sécurité, l'ancien lien de votre espace ne fonctionne plus. Nous vous envoyons le nouveau dans un e-mail séparé.",
    appel: "Nous vous appelons dans les prochains jours pour faire le point.",
  },
  change: {
    subject: "Votre compte bancaire est changé",
    title: "Votre compte bancaire est changé",
    preview: "Vos commissions seront versées sur votre nouveau compte.",
    fait: (date: string, fin: string) =>
      date
        ? `C'est fait. À partir du ${date}, nous versons vos commissions sur le compte qui se termine par ${fin}.`
        : `C'est fait. Nous versons vos commissions sur le compte qui se termine par ${fin}.`,
    ancien: (fin: string) => `L'ancien compte (qui se termine par ${fin}) ne sera plus utilisé.`,
    lien: "Par sécurité, l'ancien lien de votre espace ne fonctionne plus. Nous vous envoyons le nouveau dans un e-mail séparé.",
    pasAccord: "Vous n'êtes pas d'accord ?",
    repondez: "Répondez tout de suite à cet e-mail ou appelez-nous.",
  },
  refuse: {
    subject: "Votre demande de changement de compte n'est pas acceptée",
    title: "Votre demande de changement de compte n'est pas acceptée",
    preview: "Votre compte n'a pas changé.",
    pasPu: "Nous n'avons pas pu accepter votre demande de changement de compte.",
    raison: (m: string) => `Raison : ${m}`,
    inchange: (fin: string) => `Votre compte n'a pas changé : il se termine toujours par ${fin}.`,
    refaire: "Vous pouvez faire une nouvelle demande depuis votre espace.",
  },
  expire: {
    subject: "Votre demande de changement de compte est annulée",
    title: "Votre demande de changement de compte est annulée",
    preview: "Votre demande n'a pas été confirmée dans les 24 heures.",
    annulee: "Vous n'avez pas confirmé votre demande dans les 24 heures. Nous l'avons annulée.",
    inchange: "Votre compte n'a pas changé.",
    refaire: "Vous pouvez refaire la demande depuis votre espace.",
  },
} as const;

export const apporteurCompteAConfirmerSubject = (): string => COPY_COMPTE.aConfirmer.subject;
export const apporteurCompteDemandeBloqueeSubject = (): string => COPY_COMPTE.bloquee.subject;
export const apporteurCompteChangeSubject = (): string => COPY_COMPTE.change.subject;
export const apporteurCompteRefuseSubject = (): string => COPY_COMPTE.refuse.subject;
export const apporteurCompteExpireSubject = (): string => COPY_COMPTE.expire.subject;

/** Les 4 derniers caractères alphanumériques ; jamais plus, même si on reçoit un IBAN entier. */
function fin4(v: unknown): string {
  const f = typeof v === "string" ? v.replace(/[^A-Za-z0-9]/g, "").slice(-4) : "";
  // Charge sans fin de compte : jamais « par . » ; quatre points de masque, aucune donnée.
  return f || "••••";
}

/** Texte libre de l'administrateur : toute suite qui a la forme d'un IBAN est retirée. */
function sansIban(v: unknown): string {
  if (typeof v !== "string") return "";
  return v.replace(IBAN_GLOBAL, "[IBAN retiré]").trim();
}

/** Un lien n'est rendu que s'il est une adresse web et n'est PAS le lien personnel de l'espace. */
function lienSur(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const l = v.trim();
  if (!/^https?:\/\//i.test(l) || LIEN_PERSONNEL.test(l)) return null;
  return l;
}

function prenomDe(p: Payload): string {
  return typeof p.prenom === "string" ? (p.prenom.trim().split(/\s+/)[0] ?? "") : "";
}

interface Props {
  locale: Locale;
  payload: Record<string, unknown>;
}

const para = emailStyles.paragraphStyle;

export function ApporteurCompteAConfirmerEmail({ locale, payload }: Props) {
  const p = payload as Payload;
  const c = COPY_COMPTE.aConfirmer;
  const confirmer = lienSur(p.lienConfirmer);
  const bloquer = lienSur(p.lienBloquer);
  return (
    <EmailLayout
      famille="B"
      preview={c.preview}
      title={c.title}
      locale={locale === "fr" ? "fr" : "en"}
      {...(confirmer ? { cta: { label: c.confirmer, href: confirmer } } : {})}
      sansReseauxSociaux
      signature="fondateur-court"
    >
      <Text style={para}>{`${salutation({ prenom: prenomDe(p) }, locale)} ${c.demande}`}</Text>
      <Text style={para}>{c.nouveau(fin4(p.nouveauFin))}</Text>
      <Text style={para}>{`${c.pourConfirmer} ${c.confirmer}. ${c.duree}`}</Text>
      <Text style={para}>{`${c.ensuite} ${c.attente}`}</Text>
      <Text style={para}>
        <strong>{c.pasVous}</strong>
        {` ${c.bloquerIntro} `}
        {bloquer ? <Link href={bloquer}>{c.bloquer}</Link> : c.bloquer}
        {` ${c.inchange}`}
      </Text>
      <Text style={para}>{c.jamais}</Text>
    </EmailLayout>
  );
}

export function ApporteurCompteDemandeBloqueeEmail({ locale, payload }: Props) {
  const p = payload as Payload;
  const c = COPY_COMPTE.bloquee;
  return (
    <EmailLayout
      famille="B"
      preview={c.preview}
      title={c.title}
      locale={locale === "fr" ? "fr" : "en"}
      sansReseauxSociaux
      signature="fondateur-court"
    >
      <Text style={para}>{`${salutation({ prenom: prenomDe(p) }, locale)} ${c.dit}`}</Text>
      <Text style={para}>{c.annule}</Text>
      <Text style={para}>{c.lien}</Text>
      <Text style={para}>{c.appel}</Text>
    </EmailLayout>
  );
}

export function ApporteurCompteChangeEmail({ locale, payload }: Props) {
  const p = payload as Payload;
  const c = COPY_COMPTE.change;
  const date = typeof p.effetLe === "string" ? p.effetLe.trim() : "";
  return (
    <EmailLayout
      famille="B"
      preview={c.preview}
      title={c.title}
      locale={locale === "fr" ? "fr" : "en"}
      sansReseauxSociaux
      signature="fondateur-court"
    >
      <Text style={para}>
        {`${salutation({ prenom: prenomDe(p) }, locale)} ${c.fait(date, fin4(p.nouveauFin))}`}
      </Text>
      <Text style={para}>{c.ancien(fin4(p.ancienFin))}</Text>
      <Text style={para}>{c.lien}</Text>
      <Text style={para}>
        <strong>{c.pasAccord}</strong>
        {` ${c.repondez}`}
      </Text>
    </EmailLayout>
  );
}

export function ApporteurCompteRefuseEmail({ locale, payload }: Props) {
  const p = payload as Payload;
  const c = COPY_COMPTE.refuse;
  const motif = sansIban(p.motif);
  return (
    <EmailLayout
      famille="B"
      preview={c.preview}
      title={c.title}
      locale={locale === "fr" ? "fr" : "en"}
      sansReseauxSociaux
      signature="fondateur-court"
    >
      <Text style={para}>{`${salutation({ prenom: prenomDe(p) }, locale)} ${c.pasPu}`}</Text>
      {motif ? <Text style={para}>{c.raison(motif)}</Text> : null}
      <Text style={para}>{`${c.inchange(fin4(p.ancienFin))} ${c.refaire}`}</Text>
    </EmailLayout>
  );
}

export function ApporteurCompteExpireEmail({ locale, payload }: Props) {
  const p = payload as Payload;
  const c = COPY_COMPTE.expire;
  return (
    <EmailLayout
      famille="B"
      preview={c.preview}
      title={c.title}
      locale={locale === "fr" ? "fr" : "en"}
      sansReseauxSociaux
      signature="fondateur-court"
    >
      <Text style={para}>{`${salutation({ prenom: prenomDe(p) }, locale)} ${c.annulee}`}</Text>
      <Text style={para}>{`${c.inchange} ${c.refaire}`}</Text>
    </EmailLayout>
  );
}
