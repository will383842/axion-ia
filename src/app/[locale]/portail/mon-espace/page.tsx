/**
 * Espace stagiaire — accueil : ce que le bénéficiaire a à faire.
 *
 * ## Le choix d'ouverture
 *
 * L'ancienne page d'accueil listait tout : formations, documents, questionnaires,
 * handicap, RGPD, dans cet ordre. Le bénéficiaire arrivait donc sur un inventaire
 * et devait deviner ce qu'on attendait de lui.
 *
 * Elle s'ouvre désormais sur ses **actions en attente**, et sur rien d'autre.
 * Quand il n'y en a plus, elle le DIT — un écran vide se lit comme une panne,
 * pas comme « vous êtes à jour ».
 *
 * ## Les questionnaires se remplissent ICI
 *
 * Pas derrière un lien : l'action et le formulaire sont au même endroit. Un
 * questionnaire à trois clics de distance est un questionnaire non rempli, et
 * c'est de ces réponses que dépendent les preuves d'évaluation de l'organisme.
 */

import { CalendarDays, CircleCheckBig, ClipboardList, Sparkles } from "lucide-react";
// Espace privé : chemins absolus, hors `pathnames` publics.
import Link from "next/link";

import { CarteEspace } from "@/components/espace/CarteEspace";
import { PositionnementPortailForm } from "@/components/portail/PositionnementPortailForm";
import { SatisfactionPortailForm } from "@/components/portail/SatisfactionPortailForm";
import { soumettreSatisfactionPortailAction } from "@/server/actions/qualiopi/portail";

import { CoquilleStagiaire } from "./_coquille";
import { questionnairesEnAttente } from "./_chargement";

const TITRES_QUESTIONNAIRE: Record<string, string> = {
  positionnement: "Avant de commencer",
  satisfaction_chaud: "Votre avis sur la formation",
  satisfaction_froid: "Quelques semaines après",
};

const AIDES_QUESTIONNAIRE: Record<string, string> = {
  positionnement:
    "Quelques questions pour situer votre niveau de départ et adapter la formation à vos besoins.",
  satisfaction_chaud: "Votre retour à chaud, pendant que la formation est encore fraîche.",
  satisfaction_froid: "Ce que la formation vous a réellement apporté, avec du recul.",
};

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function MonEspaceAccueilPage({ params }: PageProps) {
  const { locale } = await params;

  return (
    <CoquilleStagiaire section="accueil" locale={locale}>
      {(espace) => {
        const aFaire = questionnairesEnAttente(espace);
        const prochaine = espace.formations[0];

        return (
          <>
            <header className="mb-8">
              <h1 className="text-mocha font-serif text-2xl leading-tight font-semibold sm:text-3xl">
                Bonjour {espace.trainee.prenom}
              </h1>
              <p className="text-fg-soft mt-2 text-sm sm:text-base">
                {aFaire.length === 0
                  ? "Vous n’avez rien à faire pour le moment."
                  : aFaire.length === 1
                    ? "Une chose vous attend."
                    : `${aFaire.length} choses vous attendent.`}
              </p>
            </header>

            {aFaire.length === 0 ? (
              <ToutEstAJour aProchaine={prochaine !== undefined} />
            ) : (
              <section aria-labelledby="a-faire" className="space-y-5">
                <h2 id="a-faire" className="sr-only">
                  Actions en attente
                </h2>

                {aFaire.map((q) => (
                  <CarteEspace
                    key={q.token}
                    ton="action"
                    icone={ClipboardList}
                    titre={TITRES_QUESTIONNAIRE[q.type] ?? "Questionnaire"}
                    description={
                      AIDES_QUESTIONNAIRE[q.type] ?? "Merci de prendre un instant pour répondre."
                    }
                    meta={q.sessionTitre}
                  >
                    {/*
                      Aiguillage sur le TYPE. Une version antérieure rendait le
                      formulaire de satisfaction pour les trois : le bénéficiaire
                      devait noter sa satisfaction avant même la formation, et
                      aucune analyse du besoin n'était collectée.
                    */}
                    {q.type === "positionnement" ? (
                      <PositionnementPortailForm
                        questionnaireToken={q.token}
                        objectifs={q.objectifs}
                        soumettreAction={soumettreSatisfactionPortailAction}
                      />
                    ) : (
                      <SatisfactionPortailForm
                        questionnaireToken={q.token}
                        soumettreSatisfactionAction={soumettreSatisfactionPortailAction}
                      />
                    )}
                  </CarteEspace>
                ))}
              </section>
            )}

            {/* Rappel discret de la formation en cours — repère, pas action. */}
            {prochaine ? (
              <section className="mt-10">
                <h2 className="text-fg-muted mb-3 text-xs font-semibold tracking-wide uppercase">
                  Votre formation
                </h2>
                {/*
                  `hover:-translate-y-0.5` : le soulèvement au survol est la
                  signature éditoriale du site (cf. `globals.css`). Une
                  translation ne déclenche pas de recalcul de mise en page, donc
                  elle ne coûte rien au CLS.
                */}
                <Link
                  href={`/${locale}/portail/mon-espace/formations`}
                  className="bg-paper shadow-card hover:shadow-elevated group block rounded-xl p-5 transition-all duration-200 hover:-translate-y-0.5"
                >
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden="true"
                      className="bg-sand text-mocha flex size-9 shrink-0 items-center justify-center rounded-lg"
                    >
                      <CalendarDays className="size-4.5" strokeWidth={1.9} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-mocha font-serif text-base font-semibold">
                        {prochaine.titre}
                      </p>
                      <p className="text-fg-muted mt-1 text-sm">
                        {formatPlage(prochaine.dateDebut, prochaine.dateFin)}
                      </p>
                      <p className="text-terracotta mt-3 text-sm font-medium group-hover:underline">
                        Voir le détail →
                      </p>
                    </div>
                  </div>
                </Link>
              </section>
            ) : null}
          </>
        );
      }}
    </CoquilleStagiaire>
  );
}

function ToutEstAJour({ aProchaine }: { aProchaine: boolean }) {
  return (
    <div className="border-border bg-paper rounded-xl border p-8 text-center">
      <span className="bg-sage-soft text-sage mx-auto mb-4 flex size-12 items-center justify-center rounded-full">
        <CircleCheckBig className="size-6" strokeWidth={1.8} aria-hidden="true" />
      </span>
      <p className="text-mocha font-serif text-lg font-semibold">Vous êtes à jour</p>
      <p className="text-fg-soft mx-auto mt-2 max-w-sm text-sm leading-relaxed">
        {aProchaine
          ? "Rien à remplir pour l’instant. Nous vous préviendrons par courriel dès qu’un questionnaire vous attendra."
          : "Rien à remplir pour l’instant. Vos documents restent accessibles à tout moment."}
      </p>
      <p className="text-fg-muted mt-6 flex items-center justify-center gap-2 text-xs">
        <Sparkles className="size-3.5" aria-hidden="true" />
        Vos documents sont conservés dans « Mes documents »
      </p>
    </div>
  );
}

function formatPlage(debut: Date, fin: Date | null): string {
  const f = (d: Date) =>
    new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(d);
  if (!fin || debut.getTime() === fin.getTime()) return f(debut);
  return `Du ${f(debut)} au ${f(fin)}`;
}
