import { cn } from "@/lib/utils";

interface TestimonialCardProps {
  quote: string;
  author: string;
  role?: string;
  company?: string;
  className?: string;
}

// Editorial v3 — pull-quote en Fraunces serif italique, guillemet ouvrant
// terracotta géant. Pas de Card/border : style pull-quote pur.
export function TestimonialCard({ quote, author, role, company, className }: TestimonialCardProps) {
  return (
    <figure className={cn("border-border-strong flex flex-col gap-6 border-t pt-8", className)}>
      <span
        aria-hidden="true"
        className="text-terracotta text-6xl leading-none"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        &ldquo;
      </span>
      <blockquote
        className="text-fg text-xl leading-[1.4] font-medium"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        {quote}
      </blockquote>
      <figcaption className="text-fg-soft text-sm">
        <span className="text-fg font-semibold">{author}</span>
        {role || company ? (
          <>
            <span className="mx-2">·</span>
            <span>
              {role ?? ""}
              {role && company ? " · " : ""}
              {company ?? ""}
            </span>
          </>
        ) : null}
      </figcaption>
    </figure>
  );
}
