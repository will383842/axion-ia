import Image from "next/image";
import Link from "next/link";

import { JsonLd } from "@/components/marketing/JsonLd";
import { isQualiopiCertificationObtenue } from "@/server/qualiopi/config/flag";

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
 *
 * ───────────────────────────────────────────────────────────────────────────
 * 🔴 CORRECTIF 2026-08-19 — la clause « NON gatée » ne pouvait pas survivre
 * ───────────────────────────────────────────────────────────────────────────
 * Ce composant est rendu sur CHAQUE article de blog, et son unique appelant
 * (`app/[locale]/blog/[slug]/page.tsx`) l'invoque sans aucune condition. Mesuré
 * en ligne le 2026-08-19 : « organisme de formation certifié Qualiopi » était
 * servi sur tous les articles alors que la certification n'est PAS obtenue
 * (6 non-conformités majeures au 2026-08-15). L'en-tête de
 * `server/qualiopi/config/flag.ts` qualifie ce cas d'ILLÉGAL.
 *
 * L'intention du 2026-07-04 — clore un article par un bloc de réassurance
 * qualité — est PRÉSERVÉE : on ne masque pas le bloc, on bascule vers la
 * formulation NON ASSERTIVE que le dépôt utilise déjà dans le livret d'accueil
 * stagiaire (« démarche qualité alignée sur le référentiel national qualité »),
 * cf. `server/qualiopi/documents/templates/livret-accueil.tsx`.
 *
 * Trois choses disparaissent avec l'affirmation, et pour la même raison :
 *
 *   1. le LOGO officiel Qualiopi — c'est une marque de certification dont
 *      l'usage est réservé aux organismes certifiés : le reformuler à côté d'un
 *      logo affirmatif n'aurait rien réparé, l'image AFFIRME à elle seule ;
 *   2. le JSON-LD `hasCredential` — déclarer aux moteurs et aux assistants IA
 *      une `EducationalOccupationalCredential` « recognizedBy » le Ministère du
 *      Travail est exactement la même affirmation, en donnée structurée ;
 *   3. la mention de financement OPCO / France Travail — le même en-tête de
 *      `flag.ts` la range avec « Qualiopi » et « CPF » parmi les mentions
 *      interdites avant certification, parce qu'elle en découle directement.
 *
 * Le jour où `QUALIOPI_CERTIFICATION_OBTENUE=true` est posé, le badge d'origine
 * revient à l'identique, sans autre intervention.
 */
export function QualiopiContentBadge({ locale = "fr" }: { locale?: string }) {
  const isFr = locale !== "en";
  const certifie = isQualiopiCertificationObtenue();

  if (!certifie) {
    // Bloc de réassurance NON ASSERTIF : il dit ce qui est vrai aujourd'hui —
    // la démarche qualité est alignée sur le Référentiel National Qualité — sans
    // revendiquer le certificat. Texte seul : aucun logo officiel, aucun JSON-LD
    // de certification. Bonus non recherché mais bienvenu : zéro image en pied
    // d'article tant que la Phase A dure.
    const texteNonAssertif = isFr
      ? "Axion-IA applique une démarche qualité alignée sur le référentiel national qualité (Qualiopi) pour ses formations, audits et accompagnements en intelligence artificielle."
      : "Axion-IA applies a quality approach aligned with the French national quality framework (Qualiopi) for its AI trainings, audits and coaching.";

    return (
      <aside
        aria-label={isFr ? "Démarche qualité d'Axion-IA" : "Axion-IA quality approach"}
        data-speakable="true"
        className="mx-auto flex max-w-[52rem] flex-col items-center gap-4 rounded-xl border border-black/10 bg-black/[0.02] p-4 sm:flex-row dark:border-white/15 dark:bg-white/[0.03]"
      >
        <p className="text-fg text-sm leading-relaxed">{texteNonAssertif}</p>
      </aside>
    );
  }

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
