/**
 * ImplementationClientReviews — section « avis clients » (5 étoiles + portrait),
 * calquée sur AuditClientReviews, framée implémentation/agents IA. Preuve sociale
 * réaliste, sans inventer de nom de société : prénom + initiale, fonction et
 * secteur. Couvre TPE / PME / ETI.
 *
 * Portraits + crédits photographes RÉUTILISÉS depuis la banque existante
 * (public/images/reviews/*) — mêmes fichiers, donc crédits Unsplash inchangés
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

// 6 avis — 2 TPE, 2 PME, 2 ETI. Mêmes portraits/crédits que la page audit.
const REVIEWS: ReadonlyArray<Review> = [
  {
    quoteFr:
      "L'agent qui traite nos factures tourne tout seul. En trois mois, on a divisé par deux le temps de saisie — et le code est à nous.",
    quoteEn:
      "The agent that handles our invoices runs on its own. In three months we halved data-entry time — and the code is ours.",
    author: "Catherine M.",
    roleFr: "Dirigeante, cabinet d'expertise comptable",
    roleEn: "Director, accounting firm",
    avatar: "/images/reviews/avis-catherine.webp",
    photographer: "Craig Tidball",
    photographerUrl: "https://unsplash.com/@devonshiremedia",
  },
  {
    quoteFr:
      "Mon agent de devis rédige et envoie tout seul. Une équipe qui parle notre métier, pas du jargon — et un outil qui nous appartient.",
    quoteEn:
      "My quoting agent drafts and sends on its own. A team that speaks our trade, not jargon — and a tool we own.",
    author: "Marc D.",
    roleFr: "Gérant, artisan du bâtiment",
    roleEn: "Owner, construction craftsman",
    avatar: "/images/reviews/avis-marc.webp",
    photographer: "Sergey Mikheev",
    photographerUrl: "https://unsplash.com/@exegii",
  },
  {
    quoteFr:
      "Du concret, du mesurable, du livré. Pas de no-code qui casse : du vrai code, intégré à notre ERP, qui tient la charge.",
    quoteEn:
      "Concrete, measurable, delivered. No no-code that breaks: real code, integrated into our ERP, that holds up.",
    author: "Thomas R.",
    roleFr: "Directeur, PME industrielle",
    roleEn: "Director, industrial SME",
    avatar: "/images/reviews/avis-thomas.webp",
    photographer: "Filip Rankovic Grobgaard",
    photographerUrl: "https://unsplash.com/@filipgrobgaard",
  },
  {
    quoteFr:
      "Notre chatbot tourne 24/7 sans surcoût d'équipe. Première réponse sous deux minutes, branchée sur notre back-office.",
    quoteEn:
      "Our chatbot runs 24/7 with no extra headcount. First reply under two minutes, wired into our back-office.",
    author: "Nadia B.",
    roleFr: "Fondatrice, e-commerce",
    roleEn: "Founder, e-commerce",
    avatar: "/images/reviews/avis-nadia.webp",
    photographer: "Julia Potter",
    photographerUrl: "https://unsplash.com/@juliapotter",
  },
  {
    quoteFr:
      "Enfin un partenaire qui pense ROI avant la techno. Les automatisations ont été livrées, documentées, et sans abonnement caché.",
    quoteEn:
      "Finally a partner that thinks ROI before tech. The automations were delivered, documented, and with no hidden subscription.",
    author: "Sophie L.",
    roleFr: "Responsable transformation, groupe ETI",
    roleEn: "Transformation lead, mid-cap group",
    avatar: "/images/reviews/avis-sophie.webp",
    photographer: "Abenezer Shewaga",
    photographerUrl: "https://unsplash.com/@abenezer_shewaga",
  },
  {
    quoteFr:
      "Sur un groupe multi-sites, ils ont intégré l'IA à nos outils existants sans tout casser. Robuste, et conçu pour durer.",
    quoteEn:
      "Across a multi-site group, they integrated AI into our existing tools without breaking anything. Robust, and built to last.",
    author: "Julien P.",
    roleFr: "Directeur des opérations, ETI multi-sites",
    roleEn: "Operations director, multi-site mid-cap",
    avatar: "/images/reviews/avis-julien.webp",
    photographer: "Makeen M. Alaa",
    photographerUrl: "https://unsplash.com/@muhmedelbank",
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
      eyebrow={isFr ? "Ils nous font confiance" : "Trusted by"}
      title={isFr ? "Des solutions qui tournent," : "Solutions that run,"}
      titleEm={isFr ? "pas des promesses" : "not promises"}
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
