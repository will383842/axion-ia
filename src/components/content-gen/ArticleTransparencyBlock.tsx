import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import type { Locale } from "@/i18n/routing";

interface ArticleTransparencyBlockProps {
  readonly lastVerified: Date | string | null | undefined;
  readonly updateCycleDays?: number;
  readonly locale: Locale;
}

/**
 * Brique partagée — bloc de transparence E-E-A-T (chantier templates 2026-06-21).
 *
 * Signal de fraîcheur lu par Google + moteurs IA (ChatGPT/Perplexity) : affiche
 * la date de dernière vérification éditoriale + la cadence de revue. Alimenté par
 * la donnée DB réelle `Article.lastVerifiedAt` → rendu UNIQUEMENT si une vraie
 * date est renseignée, jamais inventée : pas de date = pas de bloc (CLS = 0).
 *
 * Server component, 0 JS, hauteur réservée. `data-aeo="freshness"` = sélecteur
 * d'extraction du signal de fraîcheur par les moteurs IA.
 */
export function ArticleTransparencyBlock({
  lastVerified,
  updateCycleDays,
  locale,
}: ArticleTransparencyBlockProps) {
  if (!lastVerified) return null;

  const date = lastVerified instanceof Date ? lastVerified : new Date(lastVerified);
  if (Number.isNaN(date.getTime())) return null;

  const isFr = locale === "fr";
  const formatted = new Intl.DateTimeFormat(isFr ? "fr-FR" : "en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
  const iso = date.toISOString().slice(0, 10);

  const hasCycle = typeof updateCycleDays === "number" && updateCycleDays > 0;

  return (
    <Section spacing="compact">
      <Container className="max-w-3xl">
        <aside
          data-aeo="freshness"
          aria-label={isFr ? "Transparence éditoriale" : "Editorial transparency"}
          className="bg-sand text-fg-muted flex items-center gap-2 rounded-md px-4 py-3 text-sm"
        >
          <span
            aria-hidden="true"
            className="bg-sage-soft inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
          >
            <span className="bg-sage h-2 w-2 rounded-full" />
          </span>
          <p>
            {isFr ? "Dernière vérification le " : "Last reviewed on "}
            <time dateTime={iso} className="text-fg-soft font-semibold">
              {formatted}
            </time>
            {"."}
            {hasCycle ? (
              <>
                {" "}
                {isFr
                  ? `Ce contenu est revu tous les ${updateCycleDays} jours.`
                  : `This content is reviewed every ${updateCycleDays} days.`}
              </>
            ) : null}
          </p>
        </aside>
      </Container>
    </Section>
  );
}
