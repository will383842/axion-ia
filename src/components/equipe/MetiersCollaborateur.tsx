import { ArrowRight } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { Link } from "@/i18n/navigation";
import type { ContenuFiche } from "@/lib/equipe";

/** Services : le NOM du service en H3, la promesse en paragraphe, un lien vers sa page. */
export function MetiersCollaborateur({
  donnees,
}: {
  donnees: NonNullable<ContenuFiche["services"]>;
}) {
  return (
    <Section title={donnees.titre}>
      <div className="max-w-4xl">
        <p className="text-fg-soft text-lg leading-relaxed">{donnees.intro}</p>
        <div className="mt-10 grid gap-6 lg:grid-cols-2 lg:gap-8">
          {donnees.items.map((s) => (
            <article
              key={s.id}
              id={s.id}
              className="border-border bg-paper flex flex-col rounded-2xl border p-7"
            >
              <h3
                className="text-fg text-2xl leading-snug font-semibold tracking-tight"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {s.nom}
              </h3>
              <p className="text-fg-soft mt-4 text-base leading-relaxed">{s.texte}</p>
              <p className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2">
                {s.liens.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href as never}
                    className="text-terracotta hover:text-terracotta-deep inline-flex items-center gap-1.5 text-sm font-semibold underline-offset-4 hover:underline"
                  >
                    {l.libelle}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                ))}
              </p>
            </article>
          ))}
        </div>
      </div>
    </Section>
  );
}
