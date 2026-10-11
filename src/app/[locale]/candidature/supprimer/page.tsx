/**
 * `/fr/candidature/supprimer` — le candidat efface SA candidature, en un clic,
 * depuis le lien de nos e-mails (décision de Will, 2026-10-11).
 *
 * ## 🔴 CETTE PAGE N'EFFACE RIEN. ELLE AFFICHE.
 *
 * Les antivirus et les aperçus de messagerie pré-chargent les liens : un
 * effacement à l'ouverture détruirait des dossiers sans que personne n'ait
 * cliqué, et l'effet est irréversible. Le lien ouvre donc le poste concerné et
 * un bouton ; le bouton POSTe vers `supprimerMaCandidature`. C'est le motif de
 * `/appel/annuler`, et la limite que `/api/vivier-opposition` écrit pour
 * lui-même (« le même raisonnement ne vaudrait PAS pour une suppression »).
 *
 * ## Ce que la page ne dit pas
 *
 * Jeton absent, falsifié, expiré, d'une autre finalité, ou dossier
 * introuvable : un seul message, neutre. La page ne révèle jamais si un
 * dossier existe.
 *
 * Page serveur, zéro JavaScript client, non indexée.
 */

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { routing } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { lireDemandeEffacement } from "@/server/careers/effacement-par-le-candidat";
import { supprimerMaCandidature } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Supprimer ma candidature · Axion-IA" },
  robots: { index: false, follow: false },
};

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const CONTACT = "contact@axion-ia.com";

function Contact() {
  return (
    <a className="text-primary underline" href={`mailto:${CONTACT}`}>
      {CONTACT}
    </a>
  );
}

export default async function SupprimerCandidaturePage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const sp = await searchParams;
  const jeton = typeof sp["token"] === "string" ? sp["token"] : "";
  const fait = sp["fait"] === "1";
  const quota = sp["echec"] === "quota";

  if (fait) {
    return (
      <Cadre
        ok
        titre="C’est"
        titreEm="supprimé"
        description="Votre candidature a été supprimée."
        message="Votre dossier de candidature est effacé."
        detail="Votre CV, vos documents et l’historique de nos échanges ont été supprimés. Vous n’avez rien d’autre à faire."
      />
    );
  }

  const lecture = await lireDemandeEffacement(jeton);

  if (lecture.etat === "neutre") {
    return (
      <Cadre
        titre="Votre"
        titreEm="demande"
        description="Nous ne pouvons pas traiter ce lien."
        message="Ce lien n’est pas ou plus utilisable."
        detail="Il a peut-être été tronqué par votre messagerie, ou la demande a déjà été traitée."
      >
        <p>
          Si vous souhaitez que nous supprimions votre candidature, écrivez-nous à <Contact /> :
          nous traiterons votre demande.
        </p>
      </Cadre>
    );
  }

  if (lecture.etat === "recrute") {
    return (
      <Cadre
        titre="Votre"
        titreEm="dossier"
        description="Cette demande se traite avec nous directement."
        message="Ce dossier ne peut pas être supprimé depuis ce lien."
        detail="Il fait partie de votre dossier du personnel."
      >
        <p>
          Écrivez-nous à <Contact /> : nous verrons ensemble ce qui peut être effacé.
        </p>
      </Cadre>
    );
  }

  return (
    <>
      <Section
        titleAs="h1"
        eyebrow="RGPD · Candidature"
        title="Supprimer votre"
        titleEm="candidature"
        description="Rien n’est encore supprimé. Vérifiez le poste, puis confirmez."
      />

      <Section>
        <Container className="text-fg-soft max-w-2xl space-y-6 text-base leading-relaxed">
          <dl className="border-border bg-paper rounded-xl border-2 p-5">
            <dt className="text-fg-soft text-xs font-semibold tracking-widest uppercase">
              Poste concerné
            </dt>
            <dd className="text-fg mt-1 text-base font-semibold">{lecture.poste}</dd>
          </dl>

          <p>
            La suppression est <strong>définitive</strong> : votre CV, vos documents et l’historique
            de nos échanges seront effacés, et nous ne pourrons plus revenir vers vous au sujet de
            cette candidature.
          </p>

          {quota ? (
            <div
              role="alert"
              className="border-accent-red/40 bg-accent-red/10 text-fg rounded-xl border-2 p-5 text-sm"
            >
              Trop de demandes ont été envoyées depuis votre connexion. Réessayez dans une heure, ou
              écrivez-nous à <Contact />.
            </div>
          ) : null}

          {/* 🔑 Le geste passe par un FORMULAIRE : un envoi de formulaire n'est
              pas pré-chargé par les messageries, un lien l'est. */}
          <form action={supprimerMaCandidature}>
            <input type="hidden" name="token" value={jeton} />
            <button
              type="submit"
              data-cta="candidature_supprimer_confirmer"
              className="bg-terracotta text-mocha-fg hover:bg-terracotta-deep focus-visible:ring-terracotta flex h-12 w-full items-center justify-center rounded-lg text-base font-semibold transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              Supprimer définitivement ma candidature
            </button>
          </form>

          <p className="text-sm">
            Vous préférez nous écrire ? <Contact />
          </p>
        </Container>
      </Section>
    </>
  );
}

/** Un écran de résultat — même sobriété que `/vivier-opposition`. */
function Cadre({
  ok = false,
  titre,
  titreEm,
  description,
  message,
  detail,
  children,
}: {
  ok?: boolean;
  titre: string;
  titreEm: string;
  description: string;
  message: string;
  detail: string;
  children?: React.ReactNode;
}) {
  return (
    <>
      <Section
        titleAs="h1"
        eyebrow="RGPD · Candidature"
        title={titre}
        titleEm={titreEm}
        description={description}
      />
      <Section>
        <Container className="text-fg-soft max-w-2xl space-y-6 text-base leading-relaxed">
          <div
            role="status"
            className={
              ok
                ? "border-sage/40 bg-sage/10 rounded-xl border-2 p-5"
                : "border-border bg-paper rounded-xl border-2 p-5"
            }
          >
            <p className="text-fg text-base font-semibold">{message}</p>
            <p className="text-fg-soft mt-2 text-sm leading-relaxed">{detail}</p>
          </div>
          {children}
          <Cta href="/" size="lg">
            Retour à l’accueil →
          </Cta>
        </Container>
      </Section>
    </>
  );
}
