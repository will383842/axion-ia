/**
 * SitesWebReviews — section « avis clients » (note 5 étoiles + portrait), placée
 * après les réalisations.
 *
 * Fusion 2026-06-01 (Will) — calqué sur `AuditClientReviews` (template /audit) :
 * preuve sociale réaliste sans nom de société (prénom + initiale, fonction +
 * secteur), quotes propres au web augmenté IA. Réutilise les 6 portraits
 * `public/images/reviews/avis-<slug>.webp` — crédit photographe Unsplash
 * obligatoire (cf. docs/content-gen/UNSPLASH-COMPLIANCE.md), identique à /audit.
 *
 * Server Component pur, zéro JS. FR canonique — EN = miroir (locale 301→FR).
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

// 6 avis web/SaaS — mêmes portraits que /audit (crédit Unsplash conservé).
const REVIEWS: ReadonlyArray<Review> = [
  {
    quoteFr:
      "Le chatbot RAG répond à 80 % des questions sur notre site, ancré sur nos vraies données. Plus de tickets pour des questions simples.",
    quoteEn:
      "The RAG chatbot answers 80% of questions on our site, grounded in our real data. No more tickets for simple questions.",
    author: "Nadia B.",
    roleFr: "Fondatrice, e-commerce",
    roleEn: "Founder, e-commerce",
    avatar: "/images/reviews/avis-nadia.webp",
    photographer: "Julia Potter",
    photographerUrl: "https://unsplash.com/@juliapotter",
  },
  {
    quoteFr:
      "Ils ont greffé l'IA sur notre app existante sans tout refaire ni downtime. La recherche comprend enfin l'intention des utilisateurs.",
    quoteEn:
      "They grafted AI onto our existing app without a full rebuild or downtime. Search finally understands user intent.",
    author: "Thomas R.",
    roleFr: "Directeur produit, plateforme SaaS B2B",
    roleEn: "Product director, B2B SaaS platform",
    avatar: "/images/reviews/avis-thomas.webp",
    photographer: "Filip Rankovic Grobgaard",
    photographerUrl: "https://unsplash.com/@filipgrobgaard",
  },
  {
    quoteFr:
      "Une équipe qui parle notre stack, pas du jargon. Intégration propre via API, code livré, on est totalement propriétaires.",
    quoteEn:
      "A team that speaks our stack, not jargon. Clean API integration, code delivered, we fully own it.",
    author: "Marc D.",
    roleFr: "CTO, éditeur de logiciel",
    roleEn: "CTO, software vendor",
    avatar: "/images/reviews/avis-marc.webp",
    photographer: "Sergey Mikheev",
    photographerUrl: "https://unsplash.com/@exegii",
  },
  {
    quoteFr:
      "Notre portail client est devenu autonome : self-care, relances automatiques, personnalisation par profil. Le support a fondu de 60 %.",
    quoteEn:
      "Our client portal became self-sufficient: self-care, automatic follow-ups, personalisation by profile. Support dropped by 60%.",
    author: "Sophie L.",
    roleFr: "Responsable digital, groupe ETI",
    roleEn: "Digital lead, mid-cap group",
    avatar: "/images/reviews/avis-sophie.webp",
    photographer: "Abenezer Shewaga",
    photographerUrl: "https://unsplash.com/@abenezer_shewaga",
  },
  {
    quoteFr:
      "Du concret et du mesurable : forfait fixe, devis ferme en 24-48 h, livré dans les délais. La perso temps réel a dopé notre engagement.",
    quoteEn:
      "Concrete and measurable: fixed fee, firm quote in 24-48 h, delivered on time. Real-time personalisation boosted our engagement.",
    author: "Catherine M.",
    roleFr: "Dirigeante, site média & contenu",
    roleEn: "Director, media & content site",
    avatar: "/images/reviews/avis-catherine.webp",
    photographer: "Craig Tidball",
    photographerUrl: "https://unsplash.com/@devonshiremedia",
  },
  {
    quoteFr:
      "Sur une plateforme multi-sites, ils ont cadré le périmètre sans nous noyer. Hébergement UE, RGPD natif, zéro dépendance imposée.",
    quoteEn:
      "Across a multi-site platform, they scoped the work without overwhelming us. EU hosting, GDPR native, no imposed lock-in.",
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

export function SitesWebReviews({ isFr }: { isFr: boolean }): ReactNode {
  return (
    <Section
      tone="sand"
      eyebrow={isFr ? "Ils nous font confiance" : "Trusted by"}
      title={isFr ? "Des sites qui convertissent," : "Sites that convert,"}
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

      {/* Crédit Unsplash obligatoire (CGU API §6) — cf. docs/content-gen/UNSPLASH-COMPLIANCE.md */}
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
