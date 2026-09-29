// Server Component — « Comment nous rejoindre » : process de recrutement en 3
// étapes (formulaire → invitation par e-mail → échange visio de 15 min) + CTA
// vers la candidature. 29/09 : l'invitation part seule ~15 min après un dossier
// complet (`invitation-auto.ts`) — plus de « réponse sous quelques jours ».
// Bande contrastée (façon bandeau de conversion). Contenu FIXE.

import type { ReactNode } from "react";
import { ClipboardList, Mail, Video, ArrowRight } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";

export interface CommercialProcessProps {
  readonly isFr: boolean;
}

export function CommercialProcess({ isFr }: CommercialProcessProps): ReactNode {
  const steps = [
    {
      icon: ClipboardList,
      titleFr: "Remplissez le formulaire",
      titleEn: "Fill in the form",
      textFr:
        "Quelques informations sur votre profil, votre secteur et votre motivation. 3 minutes.",
      textEn: "A few details about your profile, sector and motivation. 3 minutes.",
    },
    {
      icon: Mail,
      titleFr: "Une invitation par e-mail",
      titleEn: "An invitation by email",
      textFr:
        "Vous recevez un e-mail de confirmation, puis, dans les minutes qui suivent, une invitation à réserver un échange.",
      textEn:
        "You receive a confirmation email, then, within minutes, an invitation to book a call.",
    },
    {
      icon: Video,
      titleFr: "Un échange de 15 minutes en visio",
      titleEn: "A 15-minute video call",
      textFr: "Nous faisons connaissance et répondons à vos questions.",
      textEn: "We get to know each other and answer your questions.",
    },
  ];

  return (
    <section className="bg-halo-cool border-border border-y py-20 sm:py-24">
      <Container>
        <div className="max-w-2xl">
          <p className="text-fg-muted text-[13px] font-medium tracking-[0.16em] uppercase">
            <span
              aria-hidden="true"
              className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
            />
            {isFr ? "Comment nous rejoindre" : "How to join us"}
          </p>
          <h2 className="text-fg mt-5 text-[clamp(2rem,4vw,3rem)] leading-[1.05] font-semibold tracking-tight">
            {isFr ? "Rejoindre Axion-IA," : "Joining Axion-IA,"}{" "}
            <span className="text-terracotta italic" style={{ fontFamily: "var(--font-serif)" }}>
              {isFr ? "en 3 étapes" : "in 3 steps"}
            </span>
          </h2>
          <p className="text-fg-soft mt-4 text-lg leading-relaxed">
            {isFr
              ? "Nous développons un réseau de plus de 200 apporteurs d'affaires partout en France. Remplissez le formulaire : dans les minutes qui suivent, vous recevez une invitation à réserver un échange de 15 minutes en visio."
              : "We're building a network of 200+ business introducers across France. Fill in the form: within minutes, you receive an invitation to book a 15-minute video call."}
          </p>
        </div>

        <ol className="mt-12 grid list-none gap-5 p-0 lg:grid-cols-3">
          {steps.map((s, i) => {
            const Icon = s.icon;
            return (
              <li
                key={i}
                className="border-border bg-bg relative flex flex-col rounded-2xl border p-7"
              >
                {/* 🔴 a11y 2026-08-21 — axe rendait `color-contrast` (serious) sur ces
                    trois filigranes. Ils sont PURE DÉCORATION : l'ordre est déjà porté
                    par le `<ol>` et par la position visuelle, et ils sont déjà
                    `aria-hidden`. Remonter l'opacité changerait le dessin ; les rendre
                    en contenu de pseudo-élément les sort du flux de texte, ce qui est la
                    façon normalisée de déclarer « ceci est un ornement » (WCAG 1.4.3
                    exempte explicitement le texte purement décoratif). Rendu identique. */}
                <span
                  aria-hidden="true"
                  data-numero={String(i + 1).padStart(2, "0")}
                  className="text-fg-muted/15 absolute top-5 right-6 font-mono text-4xl font-bold tabular-nums before:content-[attr(data-numero)]"
                />
                <span className="bg-terracotta-soft text-terracotta-deep flex h-12 w-12 items-center justify-center rounded-xl">
                  <Icon aria-hidden="true" className="h-6 w-6" />
                </span>
                <h3 className="text-fg mt-5 text-lg font-semibold tracking-tight">
                  {isFr ? s.titleFr : s.titleEn}
                </h3>
                <p className="text-fg-soft mt-2 leading-relaxed">{isFr ? s.textFr : s.textEn}</p>
              </li>
            );
          })}
        </ol>

        <div className="mt-10">
          <Cta
            href="/devenir-commercial-ia/candidature"
            size="lg"
            className="bg-primary text-primary-fg hover:bg-primary-hover shadow-[0_8px_24px_-8px_rgba(26,77,217,0.6)]"
            track="commercial-process-apply"
          >
            {isFr ? "Remplir le formulaire" : "Fill in the form"}
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Cta>
        </div>
      </Container>
    </section>
  );
}
