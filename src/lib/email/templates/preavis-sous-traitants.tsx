// Email — PRÉAVIS aux clients actifs : l'enregistrement des visioconférences,
// avec accord, et son compte rendu par OpenAI (chantier visio, PR 1, 2026-09-29).
//
// ── Pourquoi ce message existe ──────────────────────────────────────────────
// Un client qui a déjà une pièce chez nous (devis, facture, session, contrat,
// dossier de financement) a signé sous une liste de sous-traitants et sous une
// politique qui disait « ni enregistrés ni transcrits ». Avant qu'un seul de
// ses rendez-vous puisse être enregistré, il reçoit ce préavis, 30 jours avant
// la date d'effet (règle B3 du chantier ; ADR 0056). C'est la date d'envoi réel
// de ce message qui fixe la date d'ouverture du circuit.
//
// ── La date d'effet est calculée AU RENDU, c'est-à-dire à l'envoi ────────────
// Le message part par la file de validation (Will le relit). Il est rendu une
// première fois dans l'aperçu de la console, puis une seconde fois par le
// worker, au moment où il part vraiment. Une date figée dans la charge utile à
// la mise en file serait fausse d'autant de jours que le message a attendu :
// le client lirait un préavis plus court que 30 jours. On la calcule donc à
// chaque rendu : « aujourd'hui + 30 jours », ce qui, au rendu du worker, vaut
// exactement « date d'envoi + 30 jours ».
//
// ── L'entité responsable n'est JAMAIS écrite ici ─────────────────────────────
// Elle arrive dans la charge utile, résolue à la mise en file par
// `resolveLegalIdentity()` (`src/server/visio/preavis-envoi.ts`). Le repli,
// pour l'aperçu sans charge utile, est la SSOT `IDENTITE_LEGALE` — jamais un
// littéral. Garde : `__tests__/le-preavis-nomme-l-entite-de-la-ssot.spec.tsx`.
//
// ── Pourquoi il n'y a pas de version anglaise ───────────────────────────────
// Le texte est relu et validé par Will en français (point d'arrêt du chantier).
// Une traduction serait un second texte d'information non validé. Le gabarit
// sert donc le texte français quelle que soit la locale (même choix que
// `vivier-information.tsx`).

import { Link, Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import { IDENTITE_LEGALE } from "@/lib/identite-legale-ssot";
import { CONSERVATION_VISIO } from "@/content/visio-annonce";
import type { Locale } from "../../../../prisma/generated/client";

/** Délai du préavis, en jours : la date d'effet est la date d'envoi + ce délai. */
export const DELAI_PREAVIS_JOURS = 30;

/**
 * Durée maximale de conservation du son sur nos serveurs, annoncée au client.
 * DÉRIVÉE de la notice publique (`CONSERVATION_VISIO`, que la purge applique) :
 * le préavis et la politique de confidentialité ne peuvent pas diverger.
 */
export const CONSERVATION_SON_MAX_JOURS: number = CONSERVATION_VISIO.audioJoursMax;

interface Payload {
  /** Raison sociale du responsable, lue par `resolveLegalIdentity()` à la mise en file. */
  responsable?: string;
  /** Adresse de contact RGPD, lue par `resolveLegalIdentity()` à la mise en file. */
  contactRgpd?: string;
}

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";
const URL_SOUS_PROCESSEURS = `${SITE}/fr/sous-processeurs`;
const URL_POLITIQUE = `${SITE}/fr/politique-confidentialite`;

const TITRE = "Vos visioconférences avec nous : un compte rendu, avec votre accord";
const OBJET = "Nos visioconférences : ce qui change";

/** Date d'effet du préavis : `maintenant` + 30 jours. */
export function dateEffetPreavis(maintenant: Date): Date {
  return new Date(maintenant.getTime() + DELAI_PREAVIS_JOURS * 24 * 60 * 60 * 1000);
}

/** « 29 octobre 2026 », à l'heure de Paris. */
export function formaterDateEffet(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  }).format(date);
}

export const preavisSousTraitantsSubject = (_locale: Locale, _p: Record<string, unknown>): string =>
  OBJET;

export function PreavisSousTraitantsEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as unknown as Payload;
  const responsable =
    typeof p.responsable === "string" && p.responsable.trim() !== ""
      ? p.responsable
      : IDENTITE_LEGALE.legalName;
  const contact =
    typeof p.contactRgpd === "string" && p.contactRgpd.trim() !== ""
      ? p.contactRgpd
      : "contact@axion-ia.com";
  const dateEffet = formaterDateEffet(dateEffetPreavis(new Date()));

  return (
    <EmailLayout
      famille="C"
      preview={`À partir du ${dateEffet}, seulement si vous êtes d'accord. Vous pouvez refuser.`}
      title={TITRE}
      locale={locale}
    >
      <Text style={emailStyles.paragraphStyle}>
        À partir du <strong>{dateEffet}</strong>, avec votre accord oral au début de chaque
        visioconférence Google Meet, le son peut être enregistré. Il est transcrit, et un compte
        rendu est rédigé, par <strong>OpenAI, LLC</strong> (États-Unis, clauses contractuelles
        types), sous-traitant déjà listé sur notre{" "}
        <Link href={URL_SOUS_PROCESSEURS} style={{ color: emailStyles.COLORS.accent }}>
          page des sous-traitants
        </Link>
        .
      </Text>

      <Text style={emailStyles.paragraphStyle}>
        Bonjour, nous vous prévenons {DELAI_PREAVIS_JOURS} jours à l&apos;avance parce que vous
        travaillez déjà avec nous. Ce compte rendu nous sert à préparer la suite de vos projets
        (proposition, devis, questions à vous poser) sans rien oublier de ce que vous nous avez dit.
      </Text>

      <Text style={emailStyles.paragraphStyle}>
        OpenAI n&apos;utilise pas ces données pour entraîner ses modèles. Le son est effacé de nos
        serveurs au plus tard {CONSERVATION_SON_MAX_JOURS} jours après le rendez-vous.
      </Text>

      <Text style={emailStyles.paragraphStyle}>
        Rien n&apos;est enregistré sans votre accord : il vous est demandé à voix haute au début de
        l&apos;appel. Vous pouvez refuser, ou retirer votre accord à tout moment, même après le
        rendez-vous, en nous écrivant à {contact}.
      </Text>

      <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
        Responsable du traitement : {responsable}. Détails dans notre{" "}
        <Link href={URL_POLITIQUE} style={{ color: emailStyles.COLORS.textMuted }}>
          politique de confidentialité
        </Link>
        .
      </Text>
    </EmailLayout>
  );
}
