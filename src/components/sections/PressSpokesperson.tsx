import * as React from "react";
import { ArrowUpRight } from "lucide-react";

interface SpokespersonCard {
  id: string;
  name: string;
  role: string;
  bio: string;
  linkedinUrl: string;
  /** Languages spoken — short codes ("FR · EN"). */
  languagesLabel: string;
  /** Optional photo URL — falls back to serif initial on sand circle. */
  photoUrl?: string;
}

interface PressSpokespersonProps {
  spokespersons: ReadonlyArray<SpokespersonCard>;
  /** Localized labels. */
  labels: {
    /** "Disponible pour interviews" / "Available for interviews" */
    available: string;
    /** "Délai de réponse · 48 h ouvrées" / "Response time · 48 business hours" */
    responseTime: string;
    /** LinkedIn link aria/visible label. */
    linkedin: string;
    /** "Langues" / "Languages" */
    languagesLabel: string;
  };
}

// Press spokesperson card — éditorial v3, mirrors TeamGrid pattern with extra
// trust signals (LinkedIn, languages, response SLA). Photo placeholder = serif
// initial on sand. Phase 2 swaps to real photos via next/image.
export function PressSpokesperson({ spokespersons, labels }: PressSpokespersonProps) {
  return (
    <ul className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
      {spokespersons.map((p) => (
        <li
          key={p.id}
          className="border-border bg-paper flex flex-col rounded-xl border p-7 sm:p-8"
        >
          <div className="flex items-center gap-5">
            <div className="bg-sand text-fg-muted border-border flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border">
              {p.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.photoUrl} alt={p.name} className="h-full w-full object-cover" />
              ) : (
                <span className="text-2xl font-medium" style={{ fontFamily: "var(--font-serif)" }}>
                  {p.name.charAt(0)}
                </span>
              )}
            </div>
            <div>
              <h3
                className="text-fg text-2xl leading-tight font-medium"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {p.name}
              </h3>
              <p className="text-terracotta text-sm italic">{p.role}</p>
            </div>
          </div>
          <p className="text-fg-soft mt-6 text-base leading-relaxed">{p.bio}</p>

          <dl className="border-border text-fg-muted mt-7 space-y-2 border-t pt-6 text-xs">
            <div className="flex items-baseline justify-between gap-4">
              <dt>{labels.available}</dt>
              <dd className="text-fg font-semibold">{labels.responseTime}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt>{labels.languagesLabel}</dt>
              <dd className="text-fg font-semibold">{p.languagesLabel}</dd>
            </div>
          </dl>

          <a
            href={p.linkedinUrl}
            target="_blank"
            rel="noopener noreferrer external"
            className="border-border-strong text-fg hover:border-terracotta hover:text-terracotta focus-visible:ring-terracotta mt-6 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border px-4 text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            {labels.linkedin}
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </a>
        </li>
      ))}
    </ul>
  );
}
