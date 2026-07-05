// Les 5 leviers de visibilité offerts aux clients Axion-IA, en BANDEAUX IMAGE
// alternés (parité image/texte). Server Component. Photos Unsplash réelles
// (manifeste `visibilite-entreprise-unsplash.ts`, download-trigger CGU §6 + crédit).
//
// Le paragraphe descriptif porte `data-speakable`/`data-answer` (AEO/GEO).

import type { ReactNode } from "react";
import Image from "next/image";
import { FileText, Link2, Mic, Share2, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import { UnsplashCredit } from "@/components/media/UnsplashCredit";
import { VISIBILITE_UNSPLASH } from "@/content/visibilite-entreprise-unsplash";

function bySlot(slot: string) {
  return VISIBILITE_UNSPLASH.find((i) => i.slot === slot);
}

interface Benefit {
  slot: string;
  icon: typeof Mic;
  accent: string;
  eyebrow: string;
  title: string;
  body: string;
  alt: string;
}

export function VisibiliteBenefits({ isFr }: { isFr: boolean }): ReactNode {
  const benefits: ReadonlyArray<Benefit> = [
    {
      slot: "podcast",
      icon: Mic,
      accent: "bg-terracotta-soft text-terracotta-deep",
      eyebrow: isFr ? "Levier 1 — Podcast" : "Lever 1 — Podcast",
      title: isFr
        ? "Un podcast avec votre dirigeant ou un collaborateur"
        : "A podcast with your executive or an employee",
      body: isFr
        ? "Un échange authentique entre un expert Axion-IA et vous, monté et diffusé sur nos canaux. Vous partagez votre vision et votre transformation par l'IA — un contenu qui vous positionne en référence de votre secteur et humanise votre marque."
        : "An authentic conversation between an Axion-IA expert and you, edited and shared on our channels. You share your vision and your AI transformation — content that positions you as a reference in your sector and humanises your brand.",
      alt: isFr
        ? "Enregistrement d'un podcast d'entreprise — le dirigeant partage sa transformation IA avec Axion-IA"
        : "Recording a corporate podcast — the executive shares their AI transformation with Axion-IA",
    },
    {
      slot: "interview",
      icon: Video,
      accent: "bg-primary-soft text-primary",
      eyebrow: isFr ? "Levier 2 — Interviews" : "Lever 2 — Interviews",
      title: isFr ? "Les interviews de vos participants" : "Interviews of your participants",
      body: isFr
        ? "On donne la parole à vos équipes volontaires : des témoignages vidéo sincères qui valorisent vos collaborateurs, créent une preuve sociale forte et renforcent votre marque employeur."
        : "We give the floor to your willing teams: sincere video testimonials that value your employees, build strong social proof and strengthen your employer brand.",
      alt: isFr
        ? "Interview vidéo d'un collaborateur d'entreprise cliente — témoignage filmé par Axion-IA"
        : "Video interview of a client-company employee — testimonial filmed by Axion-IA",
    },
    {
      slot: "page",
      icon: FileText,
      accent: "bg-sage-soft text-sage",
      eyebrow: isFr ? "Levier 3 — Page dédiée" : "Lever 3 — Dedicated page",
      title: isFr
        ? "Une page dédiée à votre entreprise sur axion-ia.com"
        : "A dedicated page about your company on axion-ia.com",
      body: isFr
        ? "Une page co-construite avec vous : votre entreprise, votre secteur d'activité, votre histoire avec l'IA. Un contenu éditorial de qualité, optimisé SEO, hébergé sur un domaine à forte autorité — indexé par Google et cité par les IA."
        : "A page co-built with you: your company, your sector, your AI story. Quality editorial content, SEO-optimised, hosted on a high-authority domain — indexed by Google and cited by AI.",
      alt: isFr
        ? "Page entreprise dédiée sur axion-ia.com — vitrine du secteur d'activité du client, optimisée SEO"
        : "Dedicated company page on axion-ia.com — showcase of the client's sector, SEO-optimised",
    },
    {
      slot: "backlink",
      icon: Link2,
      accent: "bg-terracotta-soft text-terracotta-deep",
      eyebrow: isFr ? "Levier 4 — Backlink dofollow" : "Lever 4 — Dofollow backlink",
      title: isFr
        ? "Un lien dofollow vers votre site (autorité SEO)"
        : "A dofollow link to your site (SEO authority)",
      body: isFr
        ? "Un backlink dofollow depuis axion-ia.com transmet de l'autorité de domaine à votre site : meilleur référencement Google, plus de trafic organique. Un actif SEO durable et rare — la plupart des prestataires ne l'offrent jamais."
        : "A dofollow backlink from axion-ia.com passes domain authority to your site: better Google ranking, more organic traffic. A durable, rare SEO asset — most providers never offer it.",
      alt: isFr
        ? "Tableau de bord d'analyse SEO — le backlink dofollow d'Axion-IA améliore le référencement du client"
        : "SEO analytics dashboard — Axion-IA's dofollow backlink improves the client's ranking",
    },
    {
      slot: "linkedin",
      icon: Share2,
      accent: "bg-primary-soft text-primary",
      eyebrow: isFr ? "Levier 5 — LinkedIn" : "Lever 5 — LinkedIn",
      title: isFr ? "Un relais sur LinkedIn" : "A share on LinkedIn",
      body: isFr
        ? "On relaie votre entreprise auprès de notre audience B2B sur LinkedIn : portée organique, notoriété auprès de dirigeants et décideurs, mise en relation avec notre réseau professionnel."
        : "We share your company with our B2B audience on LinkedIn: organic reach, awareness among executives and decision-makers, connections with our professional network.",
      alt: isFr
        ? "Relais LinkedIn d'une entreprise cliente par Axion-IA — portée auprès d'une audience B2B de décideurs"
        : "LinkedIn share of a client company by Axion-IA — reach to a B2B decision-maker audience",
    },
  ];

  return (
    <div className="flex flex-col gap-8 lg:gap-12">
      {benefits.map((b, i) => {
        const image = bySlot(b.slot);
        const reverse = i % 2 === 1;
        return (
          <div key={b.slot}>
            <div className="border-border bg-bg grid grid-cols-1 overflow-hidden rounded-3xl border lg:grid-cols-2 lg:items-stretch">
              <figure
                className={cn(
                  "relative order-first m-0 min-h-[240px] lg:min-h-[380px]",
                  reverse && "lg:order-last",
                )}
              >
                {image ? (
                  <Image
                    src={image.src}
                    alt={b.alt}
                    fill
                    sizes="(min-width: 1024px) 50vw, 100vw"
                    loading="lazy"
                    className="object-cover"
                  />
                ) : (
                  <span className="bg-sand block h-full w-full" aria-hidden="true" />
                )}
              </figure>
              <div className="flex flex-col justify-center gap-4 p-8 lg:p-12">
                <span
                  className={cn(
                    "inline-flex h-12 w-12 items-center justify-center rounded-2xl",
                    b.accent,
                  )}
                >
                  <b.icon aria-hidden="true" className="h-6 w-6" />
                </span>
                <p className="text-fg-muted text-[13px] font-semibold tracking-[0.16em] uppercase">
                  {b.eyebrow}
                </p>
                <h3 className="text-fg text-xl font-semibold tracking-tight lg:text-2xl">
                  {b.title}
                </h3>
                <p data-speakable data-answer className="text-fg-soft leading-relaxed">
                  {b.body}
                </p>
              </div>
            </div>
            {image ? (
              <UnsplashCredit
                photographerName={image.photographer}
                photographerUrl={image.photographerUrl}
                className="mt-1.5 px-1"
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
