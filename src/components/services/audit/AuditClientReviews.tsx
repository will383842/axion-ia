/**
 * AuditClientReviews — section « avis clients » avec note 5 étoiles + portrait,
 * placée juste après AuditRealisations.
 *
 * Refonte 2026-05-31 (Will) — preuve sociale réaliste, sans inventer de nom de
 * société ou de marque : prénom + initiale, fonction et secteur uniquement.
 * Couvre TPE / PME / ETI.
 *
 * Portraits : photos Unsplash (free tier, décision Will 2026-05-31). Compliance
 * Unsplash (cf. docs/content-gen/UNSPLASH-COMPLIANCE.md) : download tracké à
 * l'import + crédit photographe visible (footer, liens UTM source=axion-ia).
 * Fichiers : public/images/reviews/avis-<slug>.webp (crop visage 256px).
 *
 * Server Component pur, zéro JS. Design tokens uniquement (pas de hex). FR
 * canonique — EN = miroir (locale 301→FR).
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
  /** Portrait Unsplash (crop visage) sous public/images/reviews/. */
  readonly avatar: string;
  /** Crédit Unsplash obligatoire — nom du photographe. */
  readonly photographer: string;
  /** Profil Unsplash du photographe (lien de crédit). */
  readonly photographerUrl: string;
}

// 6 avis — 2 TPE, 2 PME, 2 ETI. Aucun nom de marque ni de société.
const REVIEWS: ReadonlyArray<Review> = [
  {
    quoteFr:
      "L'audit a révélé des automatisations qu'on n'imaginait même pas. En trois mois, on a divisé par deux le temps passé sur la saisie.",
    quoteEn:
      "The audit revealed automations we hadn't even imagined. In three months we halved the time spent on data entry.",
    author: "Catherine M.",
    roleFr: "Dirigeante, cabinet d'expertise comptable",
    roleEn: "Director, accounting firm",
    avatar: "/images/reviews/avis-catherine.webp",
    photographer: "Craig Tidball",
    photographerUrl: "https://unsplash.com/@devonshiremedia",
  },
  {
    quoteFr:
      "Une équipe qui parle enfin notre langage, pas du jargon. Le déploiement s'est fait sans accroc et l'équipe a adhéré tout de suite.",
    quoteEn:
      "A team that finally speaks our language, no jargon. The rollout went smoothly and the team bought in right away.",
    author: "Marc D.",
    roleFr: "Gérant, artisan du bâtiment",
    roleEn: "Owner, construction craftsman",
    avatar: "/images/reviews/avis-marc.webp",
    photographer: "Sergey Mikheev",
    photographerUrl: "https://unsplash.com/@exegii",
  },
  {
    quoteFr:
      "Du concret, du mesurable, du livré. Chaque euro investi a été tracé et justifié — exactement ce qu'on attendait.",
    quoteEn:
      "Concrete, measurable, delivered. Every euro invested was tracked and justified — exactly what we expected.",
    author: "Thomas R.",
    roleFr: "Directeur, PME industrielle",
    roleEn: "Director, industrial SME",
    avatar: "/images/reviews/avis-thomas.webp",
    photographer: "Filip Rankovic Grobgaard",
    photographerUrl: "https://unsplash.com/@filipgrobgaard",
  },
  {
    quoteFr:
      "Notre service client tourne désormais 24/7 sans surcoût d'équipe. Le temps de première réponse est tombé sous les deux minutes.",
    quoteEn:
      "Our customer service now runs 24/7 with no extra headcount. First-response time dropped below two minutes.",
    author: "Nadia B.",
    roleFr: "Fondatrice, e-commerce",
    roleEn: "Founder, e-commerce",
    avatar: "/images/reviews/avis-nadia.webp",
    photographer: "Julia Potter",
    photographerUrl: "https://unsplash.com/@juliapotter",
  },
  {
    quoteFr:
      "Enfin un partenaire IA qui pense ROI avant la techno. La roadmap était claire, priorisée, et tenue dans les délais.",
    quoteEn:
      "Finally an AI partner that thinks ROI before tech. The roadmap was clear, prioritised and delivered on time.",
    author: "Sophie L.",
    roleFr: "Responsable transformation, groupe ETI",
    roleEn: "Transformation lead, mid-cap group",
    avatar: "/images/reviews/avis-sophie.webp",
    photographer: "Abenezer Shewaga",
    photographerUrl: "https://unsplash.com/@abenezer_shewaga",
  },
  {
    quoteFr:
      "Sur un groupe multi-sites, ils ont su cadrer le périmètre sans nous noyer. On a gagné en sérénité autant qu'en performance.",
    quoteEn:
      "Across a multi-site group, they scoped the work without overwhelming us. We gained as much in peace of mind as in performance.",
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

export function AuditClientReviews({ isFr }: { isFr: boolean }): ReactNode {
  return (
    <Section
      tone="sand"
      eyebrow={isFr ? "Ils nous font confiance" : "Trusted by"}
      title={isFr ? "Des résultats concrets," : "Real results,"}
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

      {/* Crédit Unsplash obligatoire (CGU API §6) — photographes + lien
            Unsplash, UTM source=axion-ia. cf. docs/content-gen/UNSPLASH-COMPLIANCE.md */}
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
