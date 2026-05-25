/**
 * InterventionsReservationFlow — Tunnel réservation 4 étapes + 2 CTAs.
 *
 * Sprint A Phase 2 (2026-05-25). Server Component. Réutilisé hub + pages
 * ville. Steps : calendar → call → form → adapted session.
 *
 * Si villeContext fourni : `data-source-ville` propagé sur les 2 CTAs
 * (« Ouvrir le calendrier » + « Question avant ? ») pour tracking.
 */

import { ArrowRight, Calendar, PhoneCall, ClipboardCheck, Target } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";
import type { VilleContext } from "@/components/services/types";

interface InterventionsReservationFlowProps {
  readonly isFr: boolean;
  readonly villeContext?: VilleContext;
}

const TIGHT_X = "lg:px-6 xl:px-10";

export function InterventionsReservationFlow({
  isFr,
  villeContext,
}: InterventionsReservationFlowProps) {
  const villeAttr = villeContext ? { "data-source-ville": villeContext.villeSlug } : {};

  const reservationFlow = [
    {
      icon: Calendar,
      title: isFr ? "Vous pré-réservez sur le calendrier" : "You pre-book on the calendar",
      detail: isFr
        ? "Choisissez une date disponible en temps réel sur le calendrier maison. Confirmation immédiate par email."
        : "Pick an available date in real time on the in-house calendar. Instant email confirmation.",
    },
    {
      icon: PhoneCall,
      title: isFr ? "Nous vous appelons" : "We call you",
      detail: isFr
        ? "Un appel pour valider le format choisi, l'effectif, et les premières contraintes pratiques."
        : "A call to confirm the chosen format, headcount, and the first practical constraints.",
    },
    {
      icon: ClipboardCheck,
      title: isFr
        ? "Formulaire envoyé pour mieux connaître l'équipe"
        : "Form sent to know the team better",
      detail: isFr
        ? "Un questionnaire sur les profils, outils déjà utilisés, douleurs métier — pour adapter l'intervention à votre contexte."
        : "A questionnaire on roles, current tools, pain points — to adapt the session to your context.",
    },
    {
      icon: Target,
      title: isFr ? "Intervention adaptée à votre entreprise" : "Session adapted to your company",
      detail: isFr
        ? "Le programme reste standardisé, mais les ateliers et exemples sont calibrés pour vos profils — pour un impact concret dès le lendemain."
        : "The programme stays standardised, but workshops and examples are calibrated to your roles — for concrete impact starting the very next day.",
    },
  ] as const;

  return (
    <Section
      tone="paper"
      eyebrow={isFr ? "Comment ça fonctionne" : "How it works"}
      title={isFr ? "De la pré-réservation" : "From pre-booking"}
      titleEm={isFr ? "à l'intervention adaptée" : "to the adapted session"}
      description={
        isFr
          ? "Vous pré-réservez en ligne. On vous appelle. Vous remplissez un court formulaire pour qu'on connaisse votre équipe. On adapte l'intervention à votre contexte. Quatre étapes, zéro surprise."
          : "You book online. We call you. You fill a short form so we know your team. We adapt the session to your context. Four steps, zero surprises."
      }
      contentClassName={TIGHT_X}
    >
      <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {reservationFlow.map((step, i) => {
          const Icon = step.icon;
          return (
            <li
              key={i}
              className="bg-paper border-border shadow-subtle relative rounded-2xl border p-6"
            >
              <div className="bg-terracotta-soft text-terracotta-deep mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl">
                <Icon aria-hidden="true" className="h-6 w-6" strokeWidth={1.75} />
              </div>
              <span className="text-fg-muted absolute top-4 right-5 text-[12px] font-semibold tracking-[0.12em] tabular-nums">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="text-fg text-base leading-tight font-semibold">{step.title}</h3>
              <p className="text-fg-soft mt-2 text-[14px] leading-relaxed">{step.detail}</p>
            </li>
          );
        })}
      </ol>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Cta href="/reserver" size="lg" {...villeAttr}>
          {isFr ? "Ouvrir le calendrier" : "Open the calendar"}
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </Cta>
        <Link
          href="/contact"
          {...villeAttr}
          className="text-fg hover:text-terracotta-deep text-sm font-medium underline underline-offset-4"
        >
          {isFr ? "Question avant de pré-réserver ?" : "Question before pre-booking?"}
        </Link>
      </div>
    </Section>
  );
}
