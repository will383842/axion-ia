import Image from "next/image";
import Link from "next/link";

import { JsonLd } from "@/components/marketing/JsonLd";

const SITE_URL = process.env["NEXT_PUBLIC_SITE_URL"] ?? "https://axion-ia.com";

/**
 * Badge Qualiopi pour les CONTENUS éditoriaux (articles) — décision Will
 * 2026-07-04 : afficher la certification Qualiopi (catégorie « Actions de
 * formation ») en clôture d'article, de façon NON gatée (contrairement au
 * <QualiopiBadge> institutionnel, gaté par le flag + n° de certificat).
 *
 * Sans n° de certificat (non renseigné — décision Will) : logo officiel + mention
 * OBLIGATOIRE de catégorie. JAMAIS de CPF (Axion-IA non habilité) — financements
 * cités : OPCO, France Travail. Image optimisée par next/image (AVIF/WebP + lazy)
 * → Web Vitals préservés (CLS 0 via dimensions explicites, hors viewport initial).
 *
 * SEO/AEO/GEO : alt descriptif + JSON-LD `hasCredential`
 * (EducationalOccupationalCredential) rattaché à l'Organization du site via @id.
 */
export function QualiopiContentBadge({ locale = "fr" }: { locale?: string }) {
  const isFr = locale !== "en";
  const alt = isFr
    ? "Axion-IA — organisme de formation certifié Qualiopi au titre de la catégorie Actions de formation"
    : "Axion-IA — Qualiopi-certified training provider (training actions category)";
  const text = isFr
    ? "Axion-IA est un organisme de formation certifié Qualiopi au titre de la catégorie « Actions de formation ». Nos formations, audits et accompagnements sont finançables (OPCO, France Travail selon le dispositif et l'éligibilité)."
    : "Axion-IA is a Qualiopi-certified training provider for the “training actions” category. Our trainings, audits and coaching can be funded (OPCO, France Travail depending on the scheme and eligibility).";

  // JSON-LD : rattache la certification à l'Organization du site (merge par @id).
  const credentialJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    hasCredential: {
      "@type": "EducationalOccupationalCredential",
      name: "Certification Qualiopi — Actions de formation",
      credentialCategory: "quality certification",
      recognizedBy: {
        "@type": "GovernmentOrganization",
        name: "Ministère du Travail (République française)",
      },
    },
  };

  return (
    <aside
      aria-label={isFr ? "Certification Qualiopi d'Axion-IA" : "Axion-IA Qualiopi certification"}
      data-speakable="true"
      className="mx-auto flex max-w-[52rem] flex-col items-center gap-4 rounded-xl border border-black/10 bg-black/[0.02] p-4 sm:flex-row dark:border-white/15 dark:bg-white/[0.03]"
    >
      <Link href={`/${isFr ? "fr" : "en"}/formations`} className="shrink-0" aria-label={alt}>
        <Image
          src="/logos/qualiopi-axion-ia.png"
          alt={alt}
          width={300}
          height={200}
          loading="lazy"
          sizes="180px"
          className="h-auto w-[180px]"
        />
      </Link>
      <p className="text-fg text-sm leading-relaxed">{text}</p>
      <JsonLd data={credentialJsonLd} />
    </aside>
  );
}
