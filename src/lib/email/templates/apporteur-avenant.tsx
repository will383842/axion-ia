// E-mails à l'APPORTEUR — avenant 2.8 (lot S4 de l'issue #2512) : proposé, relance, acceptation
// enregistrée. Expéditeur : contact@ (expéditeur transactionnel par défaut, aucun réglage propre).
//
// ⛔ Livrés au worker SANS ÉMETTEUR : aucun code de l'application n'enfile ces trois gabarits avant
// le lot S3. Ils doivent être en ligne sur le worker AVANT l'application qui les émet (AGENTS.md,
// « RÈGLE SYMÉTRIQUE » et `gabaritRepli`).
//
// Règles de texte : français simple, vouvoiement, aucun prix, aucune pression, aucune mention de
// la règle du rendez-vous ni de la bascule des présentations (verrouillé par
// `apporteur-avenant.spec.tsx`). Un champ inattendu de la charge n'est jamais rendu.
//
// `gabaritRepli` : tout émetteur de l'un de ces trois noms DOIT poser dans sa charge
// `gabaritRepli: GABARIT_REPLI_AVENANT`, avec `lien` = le lien personnel de l'espace et
// `origine: "console"` (le texte du repli ne dit alors rien de faux : « Voici le lien de votre
// espace d'apporteur Axion-IA »). Un worker antérieur à ce lot reporte le job, puis rend ce repli.

import { Text } from "@react-email/components";

import { SITE_URL } from "@/lib/site-url";
import { salutation } from "../salutation";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

/** Gabarit ancien et sûr rendu par un worker qui ne connaît pas encore les trois noms ci-dessous. */
export const GABARIT_REPLI_AVENANT = "apporteur-lien-espace" as const;

interface Payload {
  prenom?: string;
  /** Version du contrat que l'apporteur a signée (« 2.6 »). */
  versionSignee?: string;
  /** Lien personnel de la page d'acceptation de l'avenant. */
  lienAvenant?: string;
  /** Acceptation enregistrée : date d'effet, déjà en toutes lettres. */
  dateEffet?: string;
}

/** Chemin exact de la page de l'avenant : `/apporteur/dossier/<id>/<jeton>/avenant`. */
const CHEMIN_AVENANT = /^\/apporteur\/dossier\/[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+\/avenant$/;

export const COPY_AVENANT = {
  propose: {
    subject: "Une mise à jour de votre contrat",
    title: "Une mise à jour de votre contrat vous est proposée",
    preview: "Rien d'autre à faire que d'ouvrir votre lien personnel.",
  },
  relance: {
    subject: "Rappel : la mise à jour de votre contrat",
    title: "Un rappel au sujet de la mise à jour de votre contrat",
    preview: "Pour mémoire : une mise à jour de votre contrat vous est proposée.",
    pourMemoire: "Ceci est un simple rappel de notre message précédent.",
  },
  commun: {
    miseAJour: (version: string) =>
      version
        ? `Une mise à jour de votre contrat d'apporteur vous est proposée : vous avez signé la version ${version}, et nous vous proposons la version 2.8.`
        : "Une mise à jour de votre contrat d'apporteur vous est proposée : nous vous proposons la version 2.8.",
    lien: "Vous la trouverez sur votre lien personnel, avec le texte complet.",
    rien: "Il n'y a rien d'autre à faire.",
    garder:
      "Vous pouvez aussi garder votre version actuelle : cela n'a aucune conséquence pour vous.",
    cta: "Voir la mise à jour",
  },
  enregistre: {
    subject: "Votre acceptation est enregistrée",
    title: "Votre acceptation est enregistrée",
    preview: "La version 2.8 de votre contrat s'applique à partir de la date indiquée.",
    merci: "Nous avons bien enregistré votre acceptation de la mise à jour de votre contrat.",
    effet: (date: string) =>
      date
        ? `La version 2.8 s'applique à partir du ${date}.`
        : "La version 2.8 s'applique à partir de la date d'effet indiquée dans l'avenant.",
    documents: "Vous trouvez ci-joint l'avenant, le contrat 2.8 et la preuve de votre acceptation.",
    retrouver: "Vous les retrouvez aussi à tout moment dans « Mes documents », sur votre espace.",
  },
} as const;

export const apporteurAvenantProposeSubject = (): string => COPY_AVENANT.propose.subject;
export const apporteurAvenantRelanceSubject = (): string => COPY_AVENANT.relance.subject;
export const apporteurAvenantEnregistreSubject = (): string => COPY_AVENANT.enregistre.subject;

const texte = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** Version affichée : seulement « 2.6 »-like (chiffres et points), sinon rien. */
function versionSure(v: unknown): string {
  const t = texte(v);
  return /^\d{1,2}(\.\d{1,2}){0,2}$/.test(t) ? t : "";
}

/** Lien rendu seulement en `https://`, sur l'origine du site, au chemin exact de la page de l'avenant. */
function lienAvenantSur(v: unknown): string | null {
  if (typeof v !== "string") return null;
  try {
    const u = new URL(v.trim());
    const ok =
      u.protocol === "https:" &&
      u.host === new URL(SITE_URL).host &&
      u.username === "" &&
      u.password === "" &&
      u.search === "" &&
      u.hash === "" &&
      CHEMIN_AVENANT.test(u.pathname);
    return ok ? u.href : null;
  } catch {
    return null;
  }
}

function Proposition({
  locale,
  payload,
  relance,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
  relance: boolean;
}) {
  const p = payload as Partial<Payload>;
  const prenom = texte(p.prenom);
  const lien = lienAvenantSur(p.lienAvenant);
  const copie = relance ? COPY_AVENANT.relance : COPY_AVENANT.propose;
  return (
    <EmailLayout
      famille="B"
      preview={copie.preview}
      title={copie.title}
      locale={locale === "fr" ? "fr" : "en"}
      {...(lien ? { cta: { label: COPY_AVENANT.commun.cta, href: lien }, ctaSecret: true } : {})}
      sansReseauxSociaux
      signature="fondateur-court"
    >
      <Text style={emailStyles.paragraphStyle}>
        {salutation({ prenom }, locale)}{" "}
        {COPY_AVENANT.commun.miseAJour(versionSure(p.versionSignee))}
      </Text>
      {relance ? (
        <Text style={emailStyles.paragraphStyle}>{COPY_AVENANT.relance.pourMemoire}</Text>
      ) : null}
      <Text style={emailStyles.paragraphStyle}>
        {COPY_AVENANT.commun.lien} {COPY_AVENANT.commun.rien}
      </Text>
      <Text style={emailStyles.paragraphStyle}>{COPY_AVENANT.commun.garder}</Text>
    </EmailLayout>
  );
}

type Props = { locale: Locale; payload: Record<string, unknown> };

export const ApporteurAvenantProposeEmail = (props: Props) => (
  <Proposition {...props} relance={false} />
);
export const ApporteurAvenantRelanceEmail = (props: Props) => <Proposition {...props} relance />;

export function ApporteurAvenantEnregistreEmail({ locale, payload }: Props) {
  const p = payload as Partial<Payload>;
  const prenom = texte(p.prenom);
  const c = COPY_AVENANT.enregistre;
  return (
    <EmailLayout
      famille="B"
      preview={c.preview}
      title={c.title}
      locale={locale === "fr" ? "fr" : "en"}
      sansReseauxSociaux
      signature="fondateur-court"
    >
      <Text style={emailStyles.paragraphStyle}>
        {salutation({ prenom }, locale)} {c.merci}
      </Text>
      <Text style={emailStyles.paragraphStyle}>{c.effet(texte(p.dateEffet))}</Text>
      <Text style={emailStyles.paragraphStyle}>
        {c.documents} {c.retrouver}
      </Text>
    </EmailLayout>
  );
}
