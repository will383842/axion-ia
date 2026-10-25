// E-mail CLIENT — l'invitation au questionnaire avant audit (2026-10-24, réécrit le 2026-10-26).
//
// Envoyé UNIQUEMENT par clic de Will (« Envoyer » sur la rencontre, après aperçu de cet e-mail
// exact) : aucun chemin automatique. Le lien est un SECRET (jeton) propre au client : il n'est
// pas imprimé en clair (`ctaSecret`). Vouvoiement, mots simples, aucune durée de remplissage,
// aucune promesse. Textes : plan « e-mails, relances, Telegram » §7 E1, mot pour mot.
//
// Payload RÉTRO-COMPATIBLE : `{ prenom?, lien? }` comme avant, plus `auditTexte`, `auditCourt`,
// `lieuAudit` facultatifs et PRÉ-FORMATÉS par l'appelant (aucun calcul de fuseau au rendu).
//
// ⛔ Jamais « J'aide », « Aucun gain garanti », « Grenoble » (ordres de Will).

import { Fragment } from "react";
import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import { OBJET_MAX } from "../objet-email";
import {
  CORPS_MAX,
  CORPS_PAR_DEFAUT,
  MESSAGE_MAX,
  OBJET_PERSO_MAX,
  assainirLigne,
  assainirTexte,
  enParagraphes,
  remplacerJetonAudit,
} from "../questionnaire-avant-audit-texte";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  prenom?: string;
  /** Le lien secret du questionnaire. */
  lien?: string;
  /** « vendredi 6 novembre à 8 h 30 » */
  auditTexte?: string;
  /** « 6 novembre » */
  auditCourt?: string;
  /** « dans vos locaux » (texte de Will) */
  lieuAudit?: string;
  /**
   * Texte MODIFIABLE par Will avant le premier envoi (2026-10-25). TEXTE seulement : assaini ici
   * même (une charge forgée ne passe pas), rendu échappé. `objetPerso` remplace l'objet,
   * `messagePerso` s'insère après « Bonjour », `corpsPerso` remplace le corps (jeton {audit}).
   */
  objetPerso?: string;
  messagePerso?: string;
  corpsPerso?: string;
}

const texte = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/**
 * Le lieu après la date (vérification F) : « à 10 h, en visio », jamais « à 10 h En visio ». Une
 * préposition tapée avec une majuscule (« En visio », « Dans vos locaux ») passe en minuscule. PUR.
 */
export function apresLaDate(lieu: string): string {
  const l = lieu.trim();
  if (l === "") return "";
  const prep = /^(En|Dans|Chez|Au|Aux|À|Sur|Par)(?=\s|$)/u.test(l);
  return `, ${prep ? l.charAt(0).toLowerCase() + l.slice(1) : l}`;
}

/** L'objet daté s'il tient dans `OBJET_MAX`, sinon l'objet standard. */
export const objetOuRepli = (date: string, standard: string): string =>
  date.length <= OBJET_MAX ? date : standard;

export const OBJET_INVITATION = "Préparons votre audit : votre questionnaire";
export const BOUTON_INVITATION = "Ouvrir mon questionnaire";
export const NOTE_LIEN_PERSONNEL = "Ce lien vous est personnel : merci de ne pas le transférer.";

/** La formule de fin, rendue APRÈS le bouton (`apresCta`) : l'action d'abord, la signature ensuite. */
export function SignatureCorps() {
  return (
    <Text style={emailStyles.paragraphStyle}>
      À très bientôt,
      <br />
      Williams Jullin, Axion-IA
    </Text>
  );
}

/** Un paragraphe de texte saisi : les retours à la ligne simples deviennent des <br />. */
function ParagrapheSaisi({ contenu }: { contenu: string }) {
  const lignes = contenu.split("\n");
  return (
    <Text style={emailStyles.paragraphStyle}>
      {lignes.map((l, i) => (
        <Fragment key={i}>
          {i > 0 ? <br /> : null}
          {l}
        </Fragment>
      ))}
    </Text>
  );
}

export const questionnaireAvantAuditSubject = (
  _locale: Locale,
  payload: Record<string, unknown>,
): string => {
  const perso = assainirLigne((payload as Payload).objetPerso, OBJET_PERSO_MAX);
  if (perso !== "") return perso;
  const court = texte((payload as Payload).auditCourt);
  return court === ""
    ? OBJET_INVITATION
    : objetOuRepli(`Audit du ${court} : votre questionnaire`, OBJET_INVITATION);
};

export function QuestionnaireAvantAuditEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as unknown as Payload;
  const prenom = texte(p.prenom);
  const lien = texte(p.lien);
  const auditTexte = texte(p.auditTexte);
  const lieu = texte(p.lieuAudit);
  const prevu = auditTexte === "" ? "" : `, prévu le ${auditTexte}${apresLaDate(lieu)},`;
  const message = enParagraphes(assainirTexte(p.messagePerso, MESSAGE_MAX));
  const corpsSaisi = enParagraphes(assainirTexte(p.corpsPerso, CORPS_MAX));
  const corps = corpsSaisi.length > 0 ? corpsSaisi : enParagraphes(CORPS_PAR_DEFAUT);
  return (
    <EmailLayout
      famille="C"
      preview="Vos réponses nous permettent d'arriver avec des pistes concrètes pour votre entreprise."
      title="Préparons votre audit ensemble"
      {...(lien ? { cta: { label: BOUTON_INVITATION, href: lien } } : {})}
      ctaSecret
      apresCta={<SignatureCorps />}
      {...(lien ? { ctaNote: NOTE_LIEN_PERSONNEL } : {})}
      locale={locale}
    >
      <Text style={emailStyles.paragraphStyle}>{prenom ? `Bonjour ${prenom},` : "Bonjour,"}</Text>
      {message.map((m, i) => (
        <ParagrapheSaisi key={`m${i}`} contenu={m} />
      ))}
      {corps.map((c, i) => (
        <ParagrapheSaisi key={`c${i}`} contenu={remplacerJetonAudit(c, prevu)} />
      ))}
    </EmailLayout>
  );
}
