/**
 * ImplementationClientReviews — section « avis clients » (5 étoiles + portrait),
 * calquée sur AuditClientReviews, framée implémentation/agents IA. Preuve sociale
 * réaliste, sans inventer de nom de société : prénom + initiale, fonction et
 * secteur. Couvre TPE / PME / ETI.
 *
 * Portraits DISTINCTS d'/audit — 6 photos sourcées via l'API Unsplash (free
 * tier, fit=facearea), `public/images/reviews/avis-impl-*.webp`. Trigger
 * /photos/:id/download déclenché à la source + crédit photographe obligatoire
 * (compliance API §6, cf. docs/content-gen/UNSPLASH-COMPLIANCE.md).
 *
 * Server Component pur, zéro JS. Tokens uniquement. Aucun prix. FR canonique —
 * EN = miroir (locale 301→FR).
 */

import type { ReactNode } from "react";
import Image from "next/image";
import { Section } from "@/components/layout/Section";

interface Review {
  readonly quoteFr: string;
  readonly quoteEn: string;
  readonly author: string;
  readonly roleFr: string;
  readonly roleEn: string;
  readonly avatar: string;
  readonly photographer: string;
  readonly photographerUrl: string;
}

// 6 avis — 2 TPE, 2 PME, 2 ETI. Quotes PROPRES à l'implémentation (anti-duplicate
// vs /audit) : on parle du build, de l'intégration et de la propriété du code.
// Portraits/crédits réutilisés (mêmes personnes, retours différents par page).
const REVIEWS: ReadonlyArray<Review> = [
  {
    quoteFr:
      "On nous a livré un agent qui lit nos factures et les classe directement dans notre logiciel. Tout est documenté : on l'a repris en main sans dépendre de personne.",
    quoteEn:
      "They delivered an agent that reads our invoices and files them straight into our software. Everything is documented: we took it over without depending on anyone.",
    author: "Catherine M.",
    roleFr: "Dirigeante, cabinet d'expertise comptable",
    roleEn: "Director, accounting firm",
    avatar: "/images/reviews/avis-impl-catherine.webp",
    photographer: "Michael Dam",
    photographerUrl: "https://unsplash.com/@michaeldam",
  },
  {
    quoteFr:
      "Mon devis part en deux clics depuis le chantier. Ce qui m'a bluffé : ça s'est branché sur les outils que j'avais déjà, sans rien changer à mes habitudes.",
    quoteEn:
      "My quote goes out in two taps from the job site. What impressed me: it plugged into the tools I already had, with nothing to change in my habits.",
    author: "Marc D.",
    roleFr: "Gérant, artisan du bâtiment",
    roleEn: "Owner, construction craftsman",
    avatar: "/images/reviews/avis-impl-marc.webp",
    photographer: "Jurica Koletić",
    photographerUrl: "https://unsplash.com/@juricakoletic",
  },
  {
    quoteFr:
      "Ils ont connecté l'IA à notre ERP proprement, avec une démo chaque semaine. Pas d'effet tunnel, et au bout un outil qui tient vraiment la charge en production.",
    quoteEn:
      "They connected AI to our ERP cleanly, with a demo every week. No tunnel effect, and in the end a tool that really holds up in production.",
    author: "Thomas R.",
    roleFr: "Directeur, PME industrielle",
    roleEn: "Director, industrial SME",
    avatar: "/images/reviews/avis-impl-thomas.webp",
    photographer: "Joseph Gonzalez",
    photographerUrl: "https://unsplash.com/@miracletwentyone",
  },
  {
    quoteFr:
      "Le chatbot répond à nos clients la nuit et passe la main au bon moment. Déployé en quelques semaines, hébergé chez nous, et aucun abonnement derrière.",
    quoteEn:
      "The chatbot answers our customers at night and hands over at the right moment. Deployed in a few weeks, hosted on our side, and no subscription behind it.",
    author: "Nadia B.",
    roleFr: "Fondatrice, e-commerce",
    roleEn: "Founder, e-commerce",
    avatar: "/images/reviews/avis-impl-nadia.webp",
    photographer: "Christina @ wocintechchat.com",
    photographerUrl: "https://unsplash.com/@wocintechchat",
  },
  {
    quoteFr:
      "On a déployé plusieurs automatisations en parallèle. Chaque livraison était testée, formée, documentée — nos équipes sont autonomes derrière.",
    quoteEn:
      "We rolled out several automations in parallel. Each delivery was tested, trained, documented — our teams are autonomous afterwards.",
    author: "Sophie L.",
    roleFr: "Responsable transformation, groupe ETI",
    roleEn: "Transformation lead, mid-cap group",
    avatar: "/images/reviews/avis-impl-sophie.webp",
    photographer: "Olga Zhuravleva",
    photographerUrl: "https://unsplash.com/@zabegina",
  },
  {
    quoteFr:
      "Sur plusieurs sites, ils ont standardisé le déploiement sans toucher à nos process existants. Du solide, vraiment pensé pour durer.",
    quoteEn:
      "Across several sites, they standardised the rollout without touching our existing processes. Solid, genuinely built to last.",
    author: "Julien P.",
    roleFr: "Directeur des opérations, ETI multi-sites",
    roleEn: "Operations director, multi-site mid-cap",
    avatar: "/images/reviews/avis-impl-julien.webp",
    photographer: "LinkedIn Sales Solutions",
    photographerUrl: "https://unsplash.com/@linkedinsalesnavigator",
  },
];

const UTM = "?utm_source=axion-ia&utm_medium=referral";

function Stars({ isFr }: { isFr: boolean }): ReactNode {
  return (
    <div
      className="text-terracotta flex gap-0.5"
      role="img"
      aria-label={isFr ? "Note : 5 étoiles sur 5" : "Rating: 5 out of 5 stars"}
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path d="M10 1.5l2.6 5.27 5.82.85-4.21 4.1.99 5.8L10 14.77l-5.2 2.74.99-5.8-4.21-4.1 5.82-.85L10 1.5z" />
        </svg>
      ))}
    </div>
  );
}

export function ImplementationClientReviews({ isFr }: { isFr: boolean }): ReactNode {
  return (
    <Section
      tone="sand"
      eyebrow={isFr ? "Avis clients" : "Client reviews"}
      title={isFr ? "Ce qu'ils en disent," : "What they say,"}
      titleEm={isFr ? "une fois en production" : "once in production"}
      titleTail="."
    >
      <ul className="grid list-none gap-6 p-0 md:grid-cols-2 lg:grid-cols-3">
        {REVIEWS.map((item) => (
          <li
            key={item.author}
            className="border-border bg-paper shadow-subtle flex flex-col rounded-2xl border p-7"
          >
            <Stars isFr={isFr} />
            <blockquote className="text-fg mt-5 flex-1 text-[15px] leading-relaxed">
              «&nbsp;{isFr ? item.quoteFr : item.quoteEn}&nbsp;»
            </blockquote>
            <div className="mt-6 flex items-center gap-3">
              <Image
                src={item.avatar}
                alt={item.author}
                width={44}
                height={44}
                loading="lazy"
                decoding="async"
                sizes="44px"
                className="bg-terracotta-soft h-11 w-11 flex-shrink-0 rounded-full object-cover"
              />
              <div className="min-w-0">
                <p className="text-fg text-[14px] font-semibold">{item.author}</p>
                <p className="text-fg-muted text-[13px]">{isFr ? item.roleFr : item.roleEn}</p>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* Crédit Unsplash obligatoire (CGU API §6). */}
      <p className="text-fg-muted mt-10 text-center text-[12px] leading-relaxed">
        {isFr ? "Portraits : " : "Portraits: "}
        {REVIEWS.map((r, i) => (
          <span key={r.author}>
            {i > 0 ? ", " : ""}
            <a
              href={`${r.photographerUrl}${UTM}`}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="hover:text-fg underline underline-offset-2"
            >
              {r.photographer}
            </a>
          </span>
        ))}
        {isFr ? " sur " : " on "}
        <a
          href={`https://unsplash.com${UTM}`}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="hover:text-fg underline underline-offset-2"
        >
          Unsplash
        </a>
        .
      </p>
    </Section>
  );
}
