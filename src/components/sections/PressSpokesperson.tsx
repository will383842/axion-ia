import * as React from "react";
import Image from "next/image";
import { ArrowUpRight, Download, Quote, Languages } from "lucide-react";
import { CopyTextButton } from "./CopyTextButton";

interface PressSpokespersonProps {
  /** Spokesperson identity + ready-to-cite copy (déjà localisés par le parent). */
  person: {
    name: string;
    role: string;
    bio: string;
    quote: string;
    linkedinUrl: string;
    languages: ReadonlyArray<string>;
    knowsAbout: ReadonlyArray<string>;
  };
  /** Portrait haute résolution (déjà localisé). */
  photo: { src: string; alt: string; width: number; height: number };
  /** Lien de téléchargement du portrait (asset kit presse). */
  photoDownloadUrl: string;
  /** Libellés UI déjà localisés. */
  labels: {
    quoteLabel: string;
    copyQuote: string;
    copied: string;
    languagesLabel: string;
    expertiseLabel: string;
    linkedin: string;
    downloadPhoto: string;
    interviewReady: string;
  };
}

// Porte-parole presse — bio factuelle (copy-paste) + citation attribuée prête à
// citer (bouton « Copier »), portrait téléchargeable, langues + domaines
// d'expertise. Conçu pour qu'un journaliste reparte avec bio + citation sans
// recontacter. Server component ; seul `CopyTextButton` embarque du JS.
export function PressSpokesperson({
  person,
  photo,
  photoDownloadUrl,
  labels,
}: PressSpokespersonProps) {
  // Citation copy-paste prête à coller (texte brut, guillemets français + tiret).
  const citableQuote = `« ${person.quote} » — ${person.name}, ${person.role}`;

  return (
    <div className="grid gap-10 lg:grid-cols-[300px_1fr] lg:items-start lg:gap-14">
      {/* Colonne portrait + actions */}
      <figure className="flex flex-col gap-4">
        <div className="border-border bg-paper relative overflow-hidden rounded-2xl border">
          <Image
            src={photo.src}
            alt={photo.alt}
            width={photo.width}
            height={photo.height}
            sizes="(min-width: 1024px) 300px, 100vw"
            className="h-auto w-full object-cover"
          />
        </div>
        <figcaption className="text-fg-muted text-xs leading-relaxed">
          {labels.interviewReady}
        </figcaption>
        <div className="flex flex-wrap gap-3">
          <a
            href={person.linkedinUrl}
            target="_blank"
            rel="noopener noreferrer external"
            className="border-border text-fg-soft hover:border-terracotta hover:text-terracotta focus-visible:ring-terracotta inline-flex min-h-[40px] items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            {labels.linkedin}
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </a>
          <a
            href={photoDownloadUrl}
            download
            className="border-border text-fg-soft hover:border-terracotta hover:text-terracotta focus-visible:ring-terracotta inline-flex min-h-[40px] items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <Download className="size-4" aria-hidden="true" />
            {labels.downloadPhoto}
          </a>
        </div>
      </figure>

      {/* Colonne bio + citation + chips */}
      <div className="flex flex-col gap-8">
        <div>
          <p className="text-fg text-2xl font-semibold tracking-tight">{person.name}</p>
          <p className="text-terracotta mt-1 text-sm font-medium">{person.role}</p>
          <p className="text-fg-soft mt-5 max-w-2xl text-lg leading-relaxed">{person.bio}</p>
        </div>

        {/* Citation attribuée prête à citer */}
        <figure className="border-border bg-paper relative rounded-2xl border p-6 sm:p-8">
          <Quote className="text-terracotta/30 absolute top-5 right-5 h-8 w-8" aria-hidden="true" />
          <p className="text-terracotta mb-4 text-[11px] font-semibold tracking-[0.18em] uppercase">
            {labels.quoteLabel}
          </p>
          <blockquote
            className="text-fg max-w-2xl text-lg leading-relaxed sm:text-xl"
            style={{ fontFamily: "var(--font-serif)", fontWeight: 400 }}
          >
            « {person.quote} »
          </blockquote>
          <figcaption className="text-fg-muted mt-4 text-sm">
            — {person.name}, {person.role}
          </figcaption>
          <div className="mt-6">
            <CopyTextButton
              text={citableQuote}
              label={labels.copyQuote}
              copiedLabel={labels.copied}
            />
          </div>
        </figure>

        {/* Langues + domaines d'expertise */}
        <dl className="grid gap-5 sm:grid-cols-2">
          <div>
            <dt className="text-fg-muted flex items-center gap-2 text-[11px] font-semibold tracking-[0.18em] uppercase">
              <Languages className="text-terracotta size-4" aria-hidden="true" />
              {labels.languagesLabel}
            </dt>
            <dd className="mt-2 flex flex-wrap gap-2">
              {person.languages.map((lang) => (
                <span
                  key={lang}
                  className="border-border text-fg-soft inline-flex rounded-full border px-3 py-1 text-xs font-medium uppercase"
                >
                  {lang}
                </span>
              ))}
            </dd>
          </div>
          <div>
            <dt className="text-fg-muted text-[11px] font-semibold tracking-[0.18em] uppercase">
              {labels.expertiseLabel}
            </dt>
            <dd className="mt-2 flex flex-wrap gap-2">
              {person.knowsAbout.map((topic) => (
                <span
                  key={topic}
                  className="border-border text-fg-soft inline-flex rounded-full border px-3 py-1 text-xs font-medium"
                >
                  {topic}
                </span>
              ))}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
