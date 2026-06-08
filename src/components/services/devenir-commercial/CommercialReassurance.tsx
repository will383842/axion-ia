// Server Component — « Pas besoin d'être expert en IA ». Section de réassurance
// (Will 2026-06-08) : le candidat doit comprendre que c'est SIMPLE même sans
// compétence technique IA — on le forme aux bases de l'IA ET à la prospection.
// Contenu FIXE, ton rassurant, icônes.

import type { ReactNode } from "react";
import { GraduationCap, Handshake, Boxes, LifeBuoy } from "lucide-react";
import { Section } from "@/components/layout/Section";

export interface CommercialReassuranceProps {
  readonly isFr: boolean;
}

export function CommercialReassurance({ isFr }: CommercialReassuranceProps): ReactNode {
  const points = [
    {
      icon: GraduationCap,
      titleFr: "On vous forme aux bases de l'IA",
      titleEn: "We teach you AI basics",
      textFr:
        "Pas besoin de savoir coder ni d'être un expert. On vous explique simplement ce que l'IA apporte aux entreprises, pour que vous sachiez en parler avec confiance.",
      textEn:
        "No coding or expertise needed. We simply explain what AI brings to companies, so you can talk about it with confidence.",
    },
    {
      icon: Handshake,
      titleFr: "On vous forme à la prospection",
      titleEn: "We train you in prospecting",
      textFr:
        "Comment trouver les bonnes entreprises, les contacter, présenter l'offre et conclure : on vous donne une méthode claire, pas à pas.",
      textEn:
        "How to find the right companies, reach out, present the offer and close: we give you a clear, step-by-step method.",
    },
    {
      icon: Boxes,
      titleFr: "Une offre simple à retenir",
      titleEn: "A simple offer to remember",
      textFr:
        "Une dizaine de produits clairs, pas un catalogue interminable. Vous maîtrisez tout ce que vous vendez en quelques heures.",
      textEn:
        "About ten clear products, not an endless catalogue. You master everything you sell in a few hours.",
    },
    {
      icon: LifeBuoy,
      titleFr: "Une équipe derrière vous",
      titleEn: "A team behind you",
      textFr:
        "Supports de vente prêts à l'emploi, réponses techniques rapides, accompagnement au quotidien. Vous n'êtes jamais seul·e.",
      textEn:
        "Ready-to-use sales materials, fast technical answers, day-to-day support. You're never on your own.",
    },
  ];

  return (
    <Section
      tone="sand"
      eyebrow={isFr ? "C'est plus simple que vous ne le pensez" : "It's simpler than you think"}
      title={isFr ? "Pas besoin d'être expert en IA —" : "No need to be an AI expert —"}
      titleEm={isFr ? "on vous forme" : "we train you"}
      description={
        isFr
          ? "Vous avez la fibre commerciale et l'envie ? C'est l'essentiel. Le reste, on s'en occupe."
          : "Got the sales instinct and the drive? That's what matters. We handle the rest."
      }
    >
      <div className="grid gap-5 sm:grid-cols-2">
        {points.map((p, i) => {
          const Icon = p.icon;
          return (
            <div key={i} className="border-border bg-bg flex gap-4 rounded-2xl border p-6">
              <span className="bg-primary-soft text-primary flex h-12 w-12 shrink-0 items-center justify-center rounded-xl">
                <Icon aria-hidden="true" className="h-6 w-6" />
              </span>
              <div>
                <h3 className="text-fg text-lg font-semibold tracking-tight">
                  {isFr ? p.titleFr : p.titleEn}
                </h3>
                <p className="text-fg-soft mt-2 leading-relaxed">{isFr ? p.textFr : p.textEn}</p>
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
